const { chromium } = require('playwright');
const fs = require('node:fs/promises');
const path = require('node:path');
const { createHash } = require('node:crypto');
const { execFile } = require('node:child_process');
const { promisify } = require('node:util');
const run = promisify(execFile);
const pilot = process.argv.includes('--pilot');
const output = pilot ? path.join(__dirname, 'screencast-pilot') : __dirname;
const root = path.resolve(__dirname, '../..');
const save = (name, data) => fs.writeFile(path.join(output, name), JSON.stringify(data, null, 2) + '\n');
const sha = data => createHash('sha256').update(data).digest('hex');
const decode = value => Buffer.from(value.slice(value.indexOf(';base64,') + 8), 'base64');

async function record(page, context, type) {
  const cdp = await context.newCDPSession(page), screenshots = [], errors = [];
  cdp.on('Page.screencastFrame', event => {
    const stamp = event.metadata.timestamp;
    if (Number.isFinite(stamp) && (!screenshots.length || stamp - screenshots.at(-1).stamp >= 1 / 30)) screenshots.push({ stamp, bytes: Buffer.from(event.data, 'base64') });
    cdp.send('Page.screencastFrameAck', { sessionId: event.sessionId }).catch(error => errors.push(String(error)));
  });
  await cdp.send('Page.startScreencast', { format: 'jpeg', quality: 95, maxWidth: 960, maxHeight: 720, everyNthFrame: 1 });
  try {
    const data = await page.evaluate(async type => {
      const a = window.__ATOLL__, canvas = document.querySelector('#scene canvas'), audio = a.captureAudio(), chunks = [], samples = [], frames = [];
      const recorder = new MediaRecorder(audio, { mimeType: 'audio/webm;codecs=opus', audioBitsPerSecond: 192000 });
      const beforeAudio = a.fireworks().audio;
      const completeRecording = new Promise((resolve, reject) => { recorder.onstop = resolve; recorder.onerror = event => reject(event.error); });
      recorder.ondataavailable = event => { if (event.data.size) chunks.push(event.data); };
      const captureStart = { epoch: performance.timeOrigin + performance.now(), time: a.state.time, wall: performance.now() };
      let start, launch, complete = false, pending = false;
      try {
        recorder.start(500);
        await new Promise(resolve => setTimeout(resolve, 750));
        start = { time: a.state.time, wall: performance.now() };
        launch = a.launchFirework({ type: type.id, seed: 619, launchSpreadDegrees: 0, burstOrientation: { yawDegrees: 0, tiltDegrees: 0, rollDegrees: 0 } });
        if (!launch.accepted) throw Error('Screencast launch rejected');
        const frameTimes = type.id === 'display-vfan' ? [4, 12, 21] : type.id === 'display-waterfall' ? [launch.burstTime - start.time + .7, 12, 15] : [launch.burstTime - start.time + .5, launch.burstTime - start.time + 2, launch.burstTime - start.time + 4];
        while (performance.now() - start.wall < 65000) {
          await new Promise(resolve => setTimeout(resolve, 200));
          const fw = a.fireworks(), elapsed = a.state.time - start.time;
          samples.push({ physicalSeconds: elapsed, wallSeconds: (performance.now() - start.wall) / 1000, active: fw.active, fps: a.state.fps });
          if (frames.length < frameTimes.length && elapsed >= frameTimes[frames.length] && !pending) {
            pending = true; a.setFrameProbe(() => { frames.push({ time: a.state.time - start.time, dataURL: canvas.toDataURL('image/png') }); pending = false; });
          }
          if (elapsed > .5 && fw.active === 0) { complete = true; break; }
        }
        const end = { time: a.state.time, wall: performance.now(), epoch: performance.timeOrigin + performance.now() };
        recorder.stop(); await completeRecording;
        const afterAudio = a.fireworks().audio;
        const blob = new Blob(chunks, { type: recorder.mimeType });
        const dataURL = await new Promise(resolve => { const reader = new FileReader(); reader.onload = () => resolve(reader.result); reader.readAsDataURL(blob); });
        return { id: type.id, label: type.label, seed: 619, launch, completed: complete, physicalSeconds: end.time - start.time, wallSeconds: (end.wall - start.wall) / 1000, recordingWallSeconds: (end.wall - captureStart.wall) / 1000, recordingPhysicalSeconds: end.time - captureStart.time, captureEpochSeconds: captureStart.epoch / 1000, endEpochSeconds: end.epoch / 1000, preRollSeconds: (start.wall - captureStart.wall) / 1000, dimensions: [canvas.width, canvas.height], audio: { scheduled: afterAudio.scheduled - beforeAudio.scheduled, synthesizedPlays: afterAudio.synthesizedPlays - beforeAudio.synthesizedPlays, recordedPlays: afterAudio.recordedPlays - beforeAudio.recordedPlays, accentPlays: afterAudio.accentPlays - beforeAudio.accentPlays }, gl: a.readGLErrors(type.id + '-screencast'), samples, frames, dataURL };
      } finally { a.setFrameProbe(null); if (recorder.state === 'recording') recorder.stop(); a.stopAudioCapture(); a.pause(true); }
    }, type);
    const { dataURL, frames, ...clip } = data;
    const directory = path.join(output, 'screencast-source', type.id);
    await fs.mkdir(directory, { recursive: true });
    await fs.writeFile(path.join(directory, 'audio.webm'), decode(dataURL));
    const before = screenshots.filter(frame => frame.stamp <= clip.captureEpochSeconds).at(-1);
    const selected = screenshots.filter(frame => frame.stamp > clip.captureEpochSeconds && frame.stamp <= clip.endEpochSeconds);
    if (!selected.length) throw Error('No screencast frames');
    if (before) selected.unshift({ ...before, stamp: clip.captureEpochSeconds });
    const timeline = selected.map((frame, index) => ({ file: String(index).padStart(5, '0') + '.jpg', seconds: Math.max(0, frame.stamp - clip.captureEpochSeconds), sha256: sha(frame.bytes) }));
    for (let index = 0; index < selected.length; index++) await fs.writeFile(path.join(directory, timeline[index].file), selected[index].bytes);
    const concat = ['ffconcat version 1.0'];
    for (let index = 0; index < timeline.length; index++) {
      concat.push("file '" + timeline[index].file + "'");
      concat.push('duration ' + Math.max(.001, (timeline[index + 1]?.seconds ?? clip.recordingWallSeconds) - timeline[index].seconds).toFixed(6));
    }
    concat.push("file '" + timeline.at(-1).file + "'");
    await fs.writeFile(path.join(directory, 'timeline.ffconcat'), concat.join('\n') + '\n');
    const intervals = timeline.slice(1).map((frame, index) => frame.seconds - timeline[index].seconds);
    clip.screencast = { frames: timeline.length, firstSeconds: timeline[0].seconds, lastSeconds: timeline.at(-1).seconds, maxIntervalSeconds: Math.max(...intervals), errors, method: 'CDP compositor JPEG95 frames retain wall-clock cadence, quantized by JPEG concat to a 40ms grid; production WebAudio Opus is captured independently and approximately synchronized. No time scaling or interpolation.' };
    await save(path.relative(output, path.join(directory, 'timeline.json')), { captureEpochSeconds: clip.captureEpochSeconds, endEpochSeconds: clip.endEpochSeconds, recordingWallSeconds: clip.recordingWallSeconds, timeline, screencast: clip.screencast });
    await run('ffmpeg', ['-v', 'error', '-y', '-f', 'concat', '-safe', '0', '-i', 'timeline.ffconcat', '-i', 'audio.webm', '-map', '0:v:0', '-map', '1:a:0', '-c:v', 'libvpx', '-cpu-used', '4', '-threads', '4', '-crf', '10', '-b:v', '3000k', '-auto-alt-ref', '0', '-pix_fmt', 'yuv420p', '-c:a', 'copy', '-fps_mode', 'vfr', '-t', clip.recordingWallSeconds.toFixed(6), path.join(output, type.id + '.webm')], { cwd: directory, windowsHide: true, maxBuffer: 2 * 1024 * 1024 });
    clip.frames = [];
    for (const [index, frame] of frames.entries()) {
      const file = type.id + '-phase-' + (index + 1) + '.png'; await fs.writeFile(path.join(output, file), decode(frame.dataURL)); clip.frames.push({ file, time: frame.time });
    }
    clip.bytes = (await fs.stat(path.join(output, type.id + '.webm'))).size;
    clip.encodedSha256 = sha(await fs.readFile(path.join(output, type.id + '.webm')));
    clip.captureMethod = clip.screencast.method;
    clip.passed = clip.completed && clip.frames.length === 3 && clip.gl.errors.length === 0 && clip.audio.scheduled > 0 && errors.length === 0 && clip.screencast.firstSeconds <= .25 && clip.screencast.maxIntervalSeconds <= .25 && clip.recordingWallSeconds - clip.screencast.lastSeconds <= .25;
    return clip;
  } finally { await cdp.send('Page.stopScreencast'); await cdp.detach(); }
}

(async () => {
  await fs.mkdir(output, { recursive: true });
  const sourceHashes = {};
  for (const name of ['main.js', 'fireworks.js', 'fireworks-physics.js', 'complex-fireworks.js', 'complex-fireworks-style.js']) sourceHashes[name] = sha(await fs.readFile(path.join(root, name)));
  const report = { date: new Date().toISOString(), schema: 'glass-atoll.continued-polish.dynamic-gallery.v2', sourceHashes, viewport: [960, 720], passed: false, clips: [], issues: [], limits: ['Warm isolated Chrome, medium quality, SDR, light smoke. Screen capture overhead is not a performance benchmark.', 'Compositor JPEG frames retain wall-clock cadence on a 40ms concat grid; separately captured production WebAudio is approximately synchronized, without a shared measured sample clock. No generated in-between frames or time scaling.', 'Technical continuity does not establish subjective visual or listening acceptance.'] };
  const browser = await chromium.launch({ headless: true, executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', args: ['--autoplay-policy=no-user-gesture-required'] });
  try {
    const context = await browser.newContext({ viewport: { width: 960, height: 720 }, deviceScaleFactor: 1 });
    const page = await context.newPage();
    page.on('pageerror', error => report.issues.push(String(error.stack || error)));
    await page.goto('http://127.0.0.1:5186/');
    await page.waitForFunction(() => window.__ATOLL__?.state.ready, null, { timeout: 120000 });
    await page.evaluate(async () => {
      const a = window.__ATOLL__; a.pause(true); await a.setQuality('medium'); await a.setGraphics({ hdrMode: 'sdr' }); await a.timePreset('stars'); await a.setTime({ running: false });
      a.setFireworks({ type: 'display-flower', effectProfile: 'legacy', autoLaunch: false, autoFrame: false, autoDirection: false, azimuth: 110, elevation: 80, launchSpreadDegrees: 0, burstTiltDegrees: 0, burstRollDegrees: 0, smokeQuality: 'light', persistentSmoke: false, resolvedSmokeLighting: false }); a.setView('fireworks-close');
    });
    await page.waitForFunction(() => !window.__ATOLL__.cameraTransition(), null, { timeout: 20000 });
    await page.locator('#sound').click();
    await page.waitForFunction(() => window.__ATOLL__.fireworks().audio.variantsLoaded.length === 5, null, { timeout: 30000 });
    await page.evaluate(() => window.__ATOLL__.launchFirework({ type: 'display-flower', seed: 618 }));
    await page.waitForFunction(() => window.__ATOLL__.fireworks().active === 0, null, { timeout: 60000 });
    await page.evaluate(() => document.activeElement?.blur()); await page.keyboard.press('h');
    await page.addStyleTag({ content: '#restore-ui,#toast{display:none!important}' });
    let types = await page.evaluate(async () => (await import('/complex-fireworks.js')).COMPLEX_FIREWORK_TYPES.map(({ id, label }) => ({ id, label })));
    if (pilot) types = types.slice(0, 1);
    for (const type of types) {
      report.currentType = type.id; report.stage = 'configure'; await save('dynamic-gallery.json', report);
      await page.evaluate(id => { const a = window.__ATOLL__; a.pause(true); a.clearSmoke(); a.setFireworks({ type: id, autoLaunch: false }); a.setView('fireworks-close'); }, type.id);
      await page.waitForFunction(() => !window.__ATOLL__.cameraTransition(), null, { timeout: 20000 });
      await page.evaluate(() => window.__ATOLL__.pause(false));
      await page.waitForFunction(() => window.__ATOLL__.audio.contextState === 'running', null, { timeout: 10000 });
      report.stage = 'record'; const clip = await record(page, context, type); report.clips.push(clip); await save('dynamic-gallery.json', report);
      console.log(JSON.stringify({ id: clip.id, passed: clip.passed, frames: clip.screencast.frames, maxGap: clip.screencast.maxIntervalSeconds, wall: clip.wallSeconds, physical: clip.physicalSeconds }));
      if (!clip.passed) throw Error('Screencast continuity gate failed');
    }
    report.passed = report.clips.length === types.length && report.issues.length === 0; report.stage = 'complete'; delete report.currentType;
    await save('dynamic-gallery.json', report);
    for (const [name, hash] of Object.entries(sourceHashes)) if (sha(await fs.readFile(path.join(root, name))) !== hash) throw Error('Production source changed during recording: ' + name);
  } catch (error) { report.passed = false; report.error = error.stack || String(error); await save('dynamic-gallery.json', report); throw error; }
  finally { await browser.close(); }
})().catch(error => { console.error(error.stack || error); process.exitCode = 1; });
