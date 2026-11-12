const { chromium } = require('playwright');
const fs = require('node:fs/promises');
const path = require('node:path');
const crypto = require('node:crypto');
const output = __dirname;
const root = path.resolve(output, '../..');
const mode = process.argv[2] || 'benchmark';
const sha = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
const save = async (name, value) => fs.writeFile(path.join(output, name), JSON.stringify(value, null, 2) + '\n');
function decodeDataURL(value) {
  // MediaRecorder MIME parameters can contain commas (vp9,opus). The payload
  // starts after the base64 marker, not after the first comma in the URL.
  const marker = ';base64,', at = value.indexOf(marker);
  if (at < 0) throw Error('Expected a base64 data URL');
  return Buffer.from(value.slice(at + marker.length), 'base64');
}

async function prepare(browser, arm = 'current') {
  const context = await browser.newContext({ viewport: { width: 960, height: 720 }, deviceScaleFactor: 1 });
  if (arm === 'baseline') {
    const source = await fs.readFile(path.join(output, 'before/fireworks.js'), 'utf8');
    await context.route('**/fireworks.js', route => route.fulfill({ status: 200, contentType: 'text/javascript', body: source }));
  }
  const page = await context.newPage(), issues = [];
  page.on('pageerror', error => issues.push({ kind: 'exception', message: error.stack || error.message }));
  page.on('console', message => { if (message.type() === 'error') issues.push({ kind: 'console', message: message.text() }); });
  await page.goto('http://127.0.0.1:5186/', { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.__ATOLL__?.state.ready, null, { timeout: 120000 });
  await page.evaluate(async () => {
    const a = window.__ATOLL__; a.pause(true);
    await a.setQuality('medium'); await a.setGraphics({ hdrMode: 'sdr' });
    await a.timePreset('stars'); await a.setTime({ running: false });
    a.setFireworks({ type: 'display-flower', effectProfile: 'legacy', autoLaunch: false, autoFrame: false, autoDirection: false, azimuth: 110, elevation: 80, launchSpreadDegrees: 0, burstTiltDegrees: 0, burstRollDegrees: 0, smokeQuality: 'light', persistentSmoke: false, resolvedSmokeLighting: false });
    a.setView('fireworks-close');
  });
  await page.waitForFunction(() => !window.__ATOLL__.cameraTransition(), null, { timeout: 20000 });
  return { context, page, issues };
}

async function benchmark(browser, sourceHashes) {
  const report = { date: new Date().toISOString(), schema: 'glass-atoll.continued-polish.browser-performance.v1', sourceHashes, viewport: [960, 720], arms: [], limits: ['Four matched seeded display-flower events, medium preset, light smoke, SDR, isolated Chrome.', 'ABBA short observations include normal machine/JIT variance; they are not a sustained 60 FPS guarantee.', 'Frozen draws and evolving simulation are reported separately.'] };
  for (const [index, arm] of ['baseline', 'current', 'current', 'baseline'].entries()) {
    const { context, page, issues } = await prepare(browser, arm);
    try {
      const launch = await page.evaluate(() => {
        const a = window.__ATOLL__, launches = [101, 202, 303, 404].map(seed => a.launchFirework({ type: 'display-flower', seed }));
        if (launches.some(item => !item.accepted)) throw Error('Matched launch was rejected');
        const target = Math.max(...launches.map(item => item.burstTime)) + 1.35;
        a.pauseAtPhysicalTime(target); return { launches, target };
      });
      await page.waitForFunction(() => window.__ATOLL__.state.parameters.paused, null, { timeout: 45000 });
      const frozen = await page.evaluate(async () => {
        const a = window.__ATOLL__; a.profileFrames(3.1);
        const result = await a.benchmarkFrozenSmoke({ seconds: 3 });
        return { result, profile: a.frameProfile(), fireworks: a.fireworks(), gl: a.readGLErrors('matched-frozen') };
      });
      const evolving = await page.evaluate(async () => {
        const a = window.__ATOLL__; a.pause(false); a.profileFrames(3.1);
        const before = { time: a.state.time, wall: performance.now() }, result = await a.benchmark(3);
        const after = { time: a.state.time, wall: performance.now() }; a.pause(true);
        return { result, profile: a.frameProfile(), physicalSeconds: after.time - before.time, wallSeconds: (after.wall - before.wall) / 1000, fireworks: a.fireworks(), gl: a.readGLErrors('matched-evolving') };
      });
      const passed = [frozen, evolving].every(sample => sample.result.validity === 'valid' && sample.gl.errors.length === 0) && issues.length === 0;
      report.arms.push({ index, arm, launch, frozen, evolving, issues, passed });
      await save('browser-performance.json', report);
      console.log(JSON.stringify({ mode: 'benchmark', index, arm, passed, frozenFps: frozen.result.averageFps, frozenCPU: frozen.result.cpuMs.median, evolvingFps: evolving.result.averageFps, evolvingCPU: evolving.result.cpuMs.median, drift: evolving.physicalSeconds - evolving.wallSeconds }));
      if (!passed) throw Error('Browser performance arm failed');
    } finally { await context.close(); }
  }
  report.passed = report.arms.length === 4 && report.arms.every(arm => arm.passed);
  await save('browser-performance.json', report);
}

async function gallery(browser, sourceHashes) {
  const { context, page, issues } = await prepare(browser);
  const report = { date: new Date().toISOString(), schema: 'glass-atoll.continued-polish.dynamic-gallery.v1', sourceHashes, viewport: [960, 720], clips: [], issues, limits: ['Actual full-scene SDR canvas and production audio recorded in an isolated browser context.', 'Recording, frame capture and sampling affect performance; these are not benchmark runs.', 'Complete event lifecycle coverage and finite frames do not establish subjective photorealism or listening acceptance.'] };
  try {
    await page.locator('#sound').click();
    await page.waitForFunction(() => window.__ATOLL__.audio.enabled && window.__ATOLL__.fireworks().audio.variantsLoaded.length === 5, null, { timeout: 30000 });
    // Warm the actual firework shaders and lazy buffers before recording. This
    // preserves production timing; cold startup is measured separately.
    report.stage = 'warmup';
    await page.evaluate(() => { window.__ATOLL__.launchFirework({ type: 'display-flower', seed: 618 }); });
    await page.waitForFunction(() => window.__ATOLL__.fireworks().active === 0, null, { timeout: 60000 });
    const types = await page.evaluate(async () => (await import('/complex-fireworks.js')).COMPLEX_FIREWORK_TYPES.map(({ id, label }) => ({ id, label })));
    for (const type of types) {
      report.currentType = type.id; report.stage = 'configure';
      await page.evaluate(type => { const a = window.__ATOLL__; a.pause(true); a.clearSmoke(); a.setFireworks({ type, autoLaunch: false }); a.setView('fireworks-close'); }, type.id);
      await page.waitForFunction(() => !window.__ATOLL__.cameraTransition(), null, { timeout: 20000 });
      await page.evaluate(() => window.__ATOLL__.pause(false));
      await page.waitForFunction(() => window.__ATOLL__.audio.contextState === 'running', null, { timeout: 10000 });
      await page.evaluate(() => new Promise(resolve => setTimeout(resolve, 750)));
      report.stage = 'record';
      const clip = await page.evaluate(async type => {
        const a = window.__ATOLL__, canvas = document.querySelector('#scene canvas'), chunks = [], samples = [], frames = [];
        let video, audio, recorder, interval, watchdog, complete = false, launch, snapshotPending = false;
        const captureStart = { time: a.state.time, wall: performance.now() }, beforeAudio = a.fireworks().audio;
        let start;
        try {
          video = canvas.captureStream(30); audio = a.captureAudio();
          const tracks = [...video.getVideoTracks(), ...audio.getAudioTracks()], audioTracksBefore = audio.getAudioTracks().map(track => ({ kind: track.kind, readyState: track.readyState, enabled: track.enabled }));
          const mime = ['video/webm;codecs=vp9,opus', 'video/webm;codecs=vp8,opus', 'video/webm'].find(value => MediaRecorder.isTypeSupported(value));
          recorder = new MediaRecorder(new MediaStream(tracks), { mimeType: mime, videoBitsPerSecond: 6500000, audioBitsPerSecond: 192000 });
          const finished = new Promise((resolve, reject) => { recorder.onstop = resolve; recorder.onerror = event => reject(event.error || Error('Recording failed')); });
          recorder.ondataavailable = event => { if (event.data.size) chunks.push(event.data); };
          recorder.start(500);
          await new Promise(resolve => setTimeout(resolve, 750));
          start = { time: a.state.time, wall: performance.now() };
          launch = a.launchFirework({ type: type.id, seed: 619, launchSpreadDegrees: 0, burstOrientation: { yawDegrees: 0, tiltDegrees: 0, rollDegrees: 0 } });
          if (!launch.accepted) throw Error('Gallery launch rejected');
          const frameTimes = type.id === 'display-vfan' ? [4, 12, 21] : type.id === 'display-waterfall' ? [launch.burstTime - start.time + .7, 12, 15] : [launch.burstTime - start.time + .5, launch.burstTime - start.time + 2, launch.burstTime - start.time + 4];
          interval = setInterval(() => {
            const state = a.state, fw = a.fireworks(), elapsed = state.time - start.time;
            samples.push({ physicalSeconds: elapsed, wallSeconds: (performance.now() - start.wall) / 1000, active: fw.active, records: fw.records, fps: state.fps });
            if (frames.length < frameTimes.length && elapsed >= frameTimes[frames.length] && !snapshotPending) {
              snapshotPending = true;
              a.setFrameProbe(() => { frames.push({ time: a.state.time - start.time, dataURL: canvas.toDataURL('image/png') }); snapshotPending = false; });
            }
            if (elapsed > .5 && fw.active === 0) { complete = true; clearInterval(interval); recorder.stop(); }
          }, 200);
          watchdog = setTimeout(() => { clearInterval(interval); if (recorder.state === 'recording') recorder.stop(); }, 65000);
          await finished;
          a.pause(true);
          const end = { time: a.state.time, wall: performance.now() }, afterAudio = a.fireworks().audio;
          const blob = new Blob(chunks, { type: mime }), dataURL = await new Promise((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(reader.result); reader.onerror = reject; reader.readAsDataURL(blob); });
          return { id: type.id, label: type.label, seed: 619, launch, completed: complete, physicalSeconds: end.time - start.time, wallSeconds: (end.wall - start.wall) / 1000, recordingWallSeconds: (end.wall - captureStart.wall) / 1000, recordingPhysicalSeconds: end.time - captureStart.time, preRollSeconds: (start.wall - captureStart.wall) / 1000, mime, bytes: blob.size, dimensions: [canvas.width, canvas.height], recordedAudio: audio.getAudioTracks().length > 0, audioTracksBefore, audioTracksAfter: audio.getAudioTracks().map(track => ({ kind: track.kind, readyState: track.readyState, enabled: track.enabled })), audio: { scheduled: afterAudio.scheduled - beforeAudio.scheduled, synthesizedPlays: afterAudio.synthesizedPlays - beforeAudio.synthesizedPlays, recordedPlays: afterAudio.recordedPlays - beforeAudio.recordedPlays, accentPlays: afterAudio.accentPlays - beforeAudio.accentPlays, peakGuard: a.audio.peakGuard }, gl: a.readGLErrors(type.id + '-complete'), samples, frames, dataURL };
        } finally {
          clearInterval(interval); clearTimeout(watchdog); a.setFrameProbe(null);
          if (recorder?.state === 'recording') recorder.stop();
          video?.getTracks().forEach(track => track.stop()); if (audio) a.stopAudioCapture(); a.pause(true);
        }
      }, type);
      const { dataURL, frames, ...metadata } = clip;
      const mediaBytes = decodeDataURL(dataURL);
      if (mediaBytes.length !== clip.bytes || mediaBytes.subarray(0, 4).toString('hex') !== '1a45dfa3') throw Error('Recorded WebM payload is incomplete');
      await fs.writeFile(path.join(output, type.id + '.webm'), mediaBytes);
      metadata.exportBytes = mediaBytes.length;
      metadata.frames = [];
      for (const [index, frame] of frames.entries()) {
        const file = type.id + '-phase-' + (index + 1) + '.png';
        await fs.writeFile(path.join(output, file), decodeDataURL(frame.dataURL));
        metadata.frames.push({ file, time: frame.time });
      }
      const expectedSound = type.id === 'display-vfan' ? metadata.audio.synthesizedPlays > 0 : metadata.audio.recordedPlays > 0;
      metadata.passed = metadata.completed && metadata.bytes > 0 && metadata.recordedAudio && metadata.audioTracksBefore.every(track => track.readyState === 'live' && track.enabled) && metadata.audioTracksAfter.every(track => track.readyState === 'live' && track.enabled) && metadata.audio.scheduled > 0 && expectedSound && metadata.gl.errors.length === 0 && metadata.frames.length === 3;
      report.clips.push(metadata); await save('dynamic-gallery.json', report);
      console.log(JSON.stringify({ mode: 'gallery', id: type.id, passed: metadata.passed, physicalSeconds: metadata.physicalSeconds, wallSeconds: metadata.wallSeconds, frames: metadata.frames.length, bytes: metadata.bytes }));
      if (!metadata.passed || issues.length) throw Error('Dynamic gallery clip failed');
    }
    report.passed = report.clips.length === 10 && report.clips.every(clip => clip.passed) && issues.length === 0;
    report.stage = 'complete'; delete report.currentType;
    await save('dynamic-gallery.json', report);
  } catch (error) { report.passed = false; report.error = error.stack || String(error); await save('dynamic-gallery.json', report); throw error; }
  finally { await context.close(); }
}

(async () => {
  await fs.mkdir(output, { recursive: true });
  const names = ['main.js', 'fireworks.js', 'fireworks-physics.js', 'complex-fireworks.js', 'complex-fireworks-style.js'], sourceHashes = {};
  for (const name of names) sourceHashes[name] = sha(await fs.readFile(path.join(root, name)));
  sourceHashes.baselineFireworks = sha(await fs.readFile(path.join(output, 'before/fireworks.js')));
  const browser = await chromium.launch({ headless: true, executablePath: process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe', args: ['--autoplay-policy=no-user-gesture-required'] });
  try {
    if (mode === 'benchmark') await benchmark(browser, sourceHashes);
    else if (mode === 'gallery') await gallery(browser, sourceHashes);
    else if (mode === 'gpu') {
      const { context, page, issues } = await prepare(browser);
      try { const result = await page.evaluate(() => window.__ATOLL__.runComplexStylesCheck()); await save('current-styles-gpu.json', { sourceHashes, issues, result }); console.log(JSON.stringify({ mode, passed: result.passed, total: result.checks?.length })); if (!result.passed || issues.length) throw Error('Current style GPU gate failed'); }
      finally { await context.close(); }
    } else throw Error('Unknown review mode');
    for (const name of names) if (sourceHashes[name] !== sha(await fs.readFile(path.join(root, name)))) throw Error('Production source changed during browser review: ' + name);
  } finally { await browser.close(); }
})().catch(error => { console.error(error.stack || error); process.exitCode = 1; });
