// Parent-owned browser scheduling: this file is not run by the QA subagent.
const { chromium } = require('playwright');
const fs = require('node:fs/promises');
const path = require('node:path');
const { createHash } = require('node:crypto');
const { execFile } = require('node:child_process');
const { promisify } = require('node:util');
const run = promisify(execFile), root = path.resolve(__dirname, '../..'), output = __dirname;
const only = process.argv.find(arg => arg.startsWith('--only='))?.slice(7);
const sha = data => createHash('sha256').update(data).digest('hex');
const decode = value => Buffer.from(value.slice(value.indexOf(';base64,') + 8), 'base64');
const save = (name, value) => fs.writeFile(path.join(output, name), JSON.stringify(value, null, 2) + '\n');
const sourceFiles = ['main.js', 'audio.js', 'fireworks-audio.js', 'audio-peak-guard.js', 'audio-peak-worklet.js', 'audio-peak-kernel.js', 'lens.js', 'local-lights.js', 'environment-local-lights.js', 'aerial-perspective.js', 'indirect-lighting.js', 'fireworks.js', 'fireworks-physics.js', 'complex-fireworks.js', 'complex-fireworks-style.js', 'complex-fireworks-motion.js', 'firework-receiver-lighting.js', 'water.js', 'water-reflection.js', 'water-optics.js', 'pyro-smoke.js', 'pyro-smoke-renderer.js', 'pyro-smoke-state.js', 'pyro-smoke-light-field.js'];
const scenes = [
  { id: 'island-light', label: '多发烟花照亮小岛', position: [-65, 30, 54], target: [2, 3, 0], focal: 24 },
  { id: 'multi-fireworks', label: '星冠与锦冠完整燃放', position: [-150, 85, 315], target: [15, 140, 0], focal: 18 },
];
const sequence = [
  { type: 'display-flower', seed: 9021, palette: 'red', azimuth: 55, elevation: 78, atSeconds: 0 },
  { type: 'display-brocade', seed: 9024, palette: 'blue', azimuth: 155, elevation: 78, atSeconds: 1 },
];
async function hashes() {
  const files = [...sourceFiles, ...(await fs.readdir(path.join(root, 'assets/audio/fireworks'))).filter(f => /\.ogg$/i.test(f)).map(f => 'assets/audio/fireworks/' + f)];
  return Object.fromEntries(await Promise.all(files.map(async name => [name, sha(await fs.readFile(path.join(root, name)))])));
}
async function assertReceipt(receipt) {
  const current = await hashes(), changed = Object.keys(receipt).filter(name => receipt[name] !== current[name]);
  if (Object.keys(current).some(name => !Object.hasOwn(receipt, name))) changed.push('asset-inventory');
  if (changed.length) throw Error('Production source/assets changed during recording: ' + changed.join(', '));
}
async function record(page, context, scene) {
  const captureCamera = await page.evaluate(() => ({ position: [...window.__ATOLL__.state.camera], target: [...window.__ATOLL__.state.target], lens: structuredClone(window.__ATOLL__.state.parameters.lens) }));
  const receiverLightingSetup = await page.evaluate(() => structuredClone(window.__ATOLL__.localLights()));
  const cdp = await context.newCDPSession(page), screenshots = [], errors = [];
  cdp.on('Page.screencastFrame', event => {
    const stamp = event.metadata.timestamp;
    if (Number.isFinite(stamp) && (!screenshots.length || stamp - screenshots.at(-1).stamp >= 1 / 30)) screenshots.push({ stamp, bytes: Buffer.from(event.data, 'base64') });
    cdp.send('Page.screencastFrameAck', { sessionId: event.sessionId }).catch(error => errors.push(String(error)));
  });
  await cdp.send('Page.startScreencast', { format: 'jpeg', quality: 95, maxWidth: 960, maxHeight: 720, everyNthFrame: 1 });
  try {
    const result = await page.evaluate(async ({ scene, sequence }) => {
      const a = window.__ATOLL__, canvas = document.querySelector('#scene canvas');
      // The soundscape suspends its AudioContext while the scene is paused.
      // Resume and settle before both capture clocks start; otherwise
      // MediaRecorder omits the silent pre-roll and rebases audio to t=0.
      a.pause(false);
      await new Promise((resolve, reject) => { const started = performance.now(); const check = () => { if (a.audio.contextState === 'running') resolve(); else if (performance.now() - started > 5000) reject(Error('AudioContext did not resume before recording')); else requestAnimationFrame(check); }; check(); });
      await new Promise(resolve => setTimeout(resolve, 300));
      const audio = a.captureAudio(), chunks = [], samples = [], telemetry = [], frames = [], launches = [], recentLayers = new Map();
      const recorder = new MediaRecorder(audio, { mimeType: 'audio/webm;codecs=opus', audioBitsPerSecond: 192000 });
      const completeRecording = new Promise((resolve, reject) => { recorder.onstop = resolve; recorder.onerror = event => reject(event.error); });
      recorder.ondataavailable = event => { if (event.data.size) chunks.push(event.data); };
      const beforeAudio = a.fireworks().audio, captureStart = { epoch: performance.timeOrigin + performance.now(), time: a.state.time, wall: performance.now(), contextState: a.audio.contextState };
      let start, lastEventEndedAt = null, secondPending = false, complete = false, launchError = null;
      const y = rgb => .2126 * rgb[0] + .7152 * rgb[1] + .0722 * rgb[2];
      function sourceSummary(clusters) {
        const rgb = [0, 0, 0], p = [0, 0, 0]; let weight = 0;
        for (const c of clusters) { const colour = c.linearColor ?? c.color ?? [1, 1, 1], i = c.referenceCandela ?? c.candela ?? c.intensity ?? 0, w = i * y(colour); weight += w; for (let k = 0; k < 3; k++) { rgb[k] += colour[k] * i; p[k] += c.position[k] * w; } }
        return { count: clusters.length, referenceRGB: rgb, referenceY: y(rgb), centroidMetres: weight ? p.map(v => v / weight) : null };
      }
      const launch = request => {
        const physicalTime = a.state.time, value = a.launchFirework({ ...request, launchSpreadDegrees: 0, burstOrientation: { yawDegrees: 0, tiltDegrees: 0, rollDegrees: 0 } });
        if (!value.accepted || value.queued) throw Error('Recording launch was not immediate'); launches.push({ request, physicalTime, atSeconds: physicalTime - start.time, ...value });
      };
      function observe() {
        const elapsed = a.state.time - start.time, fw = a.fireworks(), p = a.photometry();
        telemetry.push({ physicalSeconds: elapsed, wallSeconds: (performance.now() - start.wall) / 1000, active: fw.active, events: fw.activeEvents.map(e => ({ id: e.id, type: e.type })), source: sourceSummary(a.fireworkReceiverClusters()), lights: a.localLights().lights.slice(4), storageEV: p.storageEV, cameraEV: p.cameraEV });
        // Clamp exactly to the second launch time. The microtask resumes after
        // the frame's target-pause bookkeeping, before another audio update;
        // no paused frame cancels already scheduled ascent/burst voices.
        if (!secondPending && launches.length === 1 && elapsed >= sequence[1].atSeconds) { secondPending = true; queueMicrotask(() => { try { launch(sequence[1]); } catch (error) { launchError = error; } }); }
        if (launches.length === sequence.length && elapsed > 1 && fw.active === 0 && lastEventEndedAt === null) lastEventEndedAt = a.state.time;
        const relativeBurst = elapsed - (launches[0].burstTime - start.time), frameTimes = [-.4, .08, 1.2, 3.5, 6.5];
        if (frames.length < frameTimes.length && relativeBurst >= frameTimes[frames.length]) frames.push({ physicalSeconds: elapsed, phaseSeconds: relativeBurst, dataURL: canvas.toDataURL('image/png') });
        complete = lastEventEndedAt !== null && a.state.time >= lastEventEndedAt + .7;
        if (!complete) a.setFrameProbe(observe);
      }
      try {
        recorder.start(500); await new Promise(resolve => setTimeout(resolve, 750));
        start = { time: a.state.time, wall: performance.now() }; launch(sequence[0]); a.pauseAtPhysicalTime(start.time + sequence[1].atSeconds); a.setFrameProbe(observe);
        while (!complete && performance.now() - start.wall < 120000) {
          await new Promise(resolve => setTimeout(resolve, 200)); if (launchError) throw launchError; const fw = a.fireworks();
          samples.push({ physicalSeconds: a.state.time - start.time, wallSeconds: (performance.now() - start.wall) / 1000, active: fw.active, fps: a.state.fps, audio: { scheduled: fw.audio.scheduled, recordedPlays: fw.audio.recordedPlays, synthesizedPlays: fw.audio.synthesizedPlays, accentPlays: fw.audio.accentPlays, voiceLimitDrops: fw.audio.voiceLimitDrops, staleDrops: fw.audio.staleDrops, variantPlays: fw.audio.variantPlays, layerPlays: fw.audio.layerPlays } });
          for (const layer of fw.audio.recentLayers) if (launches.some(l => l.id === layer.eventId)) recentLayers.set([layer.time, layer.eventId, layer.role, layer.source].join(':'), layer);
        }
        const end = { time: a.state.time, wall: performance.now(), epoch: performance.timeOrigin + performance.now() }; a.setFrameProbe(null);
        recorder.stop(); await completeRecording; const afterAudio = a.fireworks().audio, blob = new Blob(chunks, { type: recorder.mimeType });
        const dataURL = await new Promise(resolve => { const reader = new FileReader(); reader.onload = () => resolve(reader.result); reader.readAsDataURL(blob); });
        const difference = key => Object.fromEntries(Object.entries(afterAudio[key]).map(([id, count]) => [id, count - (beforeAudio[key][id] ?? 0)]));
        return { id: scene.id, label: scene.label, sequence, launches, completed: complete, lastEventEndedPhysicalSeconds: lastEventEndedAt === null ? null : lastEventEndedAt - start.time, postEventPhysicalSeconds: lastEventEndedAt === null ? null : end.time - lastEventEndedAt,
          physicalSeconds: end.time - start.time, wallSeconds: (end.wall - start.wall) / 1000, recordingWallSeconds: (end.wall - captureStart.wall) / 1000, recordingPhysicalSeconds: end.time - captureStart.time, captureEpochSeconds: captureStart.epoch / 1000, endEpochSeconds: end.epoch / 1000, captureAudioContextState: captureStart.contextState, preRollSeconds: (start.wall - captureStart.wall) / 1000, dimensions: [canvas.width, canvas.height],
          audio: { scheduled: afterAudio.scheduled - beforeAudio.scheduled, synthesizedPlays: afterAudio.synthesizedPlays - beforeAudio.synthesizedPlays, recordedPlays: afterAudio.recordedPlays - beforeAudio.recordedPlays, accentPlays: afterAudio.accentPlays - beforeAudio.accentPlays, voiceLimitDrops: afterAudio.voiceLimitDrops - beforeAudio.voiceLimitDrops, staleDrops: afterAudio.staleDrops - beforeAudio.staleDrops, variantPlays: difference('variantPlays'), layerPlays: difference('layerPlays'), recentLayers: [...recentLayers.values()], before: beforeAudio, after: afterAudio },
          gl: a.readGLErrors(scene.id + '-multi-screencast'), samples, telemetry, frames, dataURL };
      } finally { a.setFrameProbe(null); if (recorder.state === 'recording') recorder.stop(); a.stopAudioCapture(); a.pause(true); }
    }, { scene, sequence });
    const { dataURL, frames, ...clip } = result; clip.captureCamera = captureCamera; clip.receiverLightingSetup = receiverLightingSetup;
    const directory = path.join(output, 'multi-screencast-source', scene.id); await fs.mkdir(directory, { recursive: true });
    await fs.writeFile(path.join(directory, 'audio.webm'), decode(dataURL));
    const before = screenshots.filter(frame => frame.stamp <= clip.captureEpochSeconds).at(-1), selected = screenshots.filter(frame => frame.stamp > clip.captureEpochSeconds && frame.stamp <= clip.endEpochSeconds);
    if (!selected.length) throw Error('No compositor frames'); if (before) selected.unshift({ ...before, stamp: clip.captureEpochSeconds });
    const timeline = selected.map((frame, i) => ({ file: String(i).padStart(5, '0') + '.jpg', seconds: Math.max(0, frame.stamp - clip.captureEpochSeconds), sha256: sha(frame.bytes) }));
    for (let i = 0; i < selected.length; i++) await fs.writeFile(path.join(directory, timeline[i].file), selected[i].bytes);
    const concat = ['ffconcat version 1.0'];
    for (let i = 0; i < timeline.length; i++) { concat.push("file '" + timeline[i].file + "'"); concat.push('duration ' + Math.max(.001, (timeline[i + 1]?.seconds ?? clip.recordingWallSeconds) - timeline[i].seconds).toFixed(6)); }
    concat.push("file '" + timeline.at(-1).file + "'"); await fs.writeFile(path.join(directory, 'timeline.ffconcat'), concat.join('\n') + '\n');
    const intervals = timeline.slice(1).map((frame, i) => frame.seconds - timeline[i].seconds);
    const activeFrames = timeline.filter(frame => frame.seconds >= clip.preRollSeconds);
    const activeIntervals = activeFrames.slice(1).map((frame, i) => frame.seconds - activeFrames[i].seconds);
    clip.screencast = { frames: timeline.length, firstSeconds: timeline[0].seconds, lastSeconds: timeline.at(-1).seconds, maxIntervalSeconds: Math.max(...intervals), firstActiveDelaySeconds: activeFrames[0]?.seconds - clip.preRollSeconds, maxActiveIntervalSeconds: Math.max(0, ...activeIntervals), errors, method: 'CDP compositor JPEG95 retains actual wall cadence on concat 40ms grid; separately captured production WebAudio Opus is approximately synchronized. No interpolation or time scaling. Active cadence excludes static pre-roll.' };
    await fs.writeFile(path.join(directory, 'timeline.json'), JSON.stringify({ captureEpochSeconds: clip.captureEpochSeconds, endEpochSeconds: clip.endEpochSeconds, recordingWallSeconds: clip.recordingWallSeconds, timeline, screencast: clip.screencast }, null, 2));
    await run('ffmpeg', ['-v', 'error', '-y', '-f', 'concat', '-safe', '0', '-i', 'timeline.ffconcat', '-i', 'audio.webm', '-map', '0:v:0', '-map', '1:a:0', '-c:v', 'libvpx', '-cpu-used', '4', '-threads', '4', '-crf', '10', '-b:v', '3000k', '-auto-alt-ref', '0', '-pix_fmt', 'yuv420p', '-c:a', 'copy', '-fps_mode', 'vfr', '-t', clip.recordingWallSeconds.toFixed(6), path.join(output, scene.id + '.webm')], { cwd: directory, windowsHide: true, maxBuffer: 2 * 1024 * 1024 });
    clip.frames = [];
    for (const [i, frame] of frames.entries()) { const file = scene.id + '-phase-' + (i + 1) + '.png'; await fs.writeFile(path.join(output, file), decode(frame.dataURL)); clip.frames.push({ file, physicalSeconds: frame.physicalSeconds, phaseSeconds: frame.phaseSeconds }); }
    clip.bytes = (await fs.stat(path.join(output, scene.id + '.webm'))).size; clip.encodedSha256 = sha(await fs.readFile(path.join(output, scene.id + '.webm')));
    clip.checks = [
      { name: 'both complete events recorded through 0.7s post-roll', passed: clip.completed && clip.launches.length === 2 && clip.postEventPhysicalSeconds >= .7 },
      { name: 'actual launches staggered by exactly one physical second', passed: Math.abs(clip.launches[1].atSeconds - clip.launches[0].atSeconds - 1) < 1e-9, launches: clip.launches.map(l => ({ id: l.id, atSeconds: l.atSeconds })) },
      { name: 'all five stage images captured', passed: clip.frames.length === 5 },
      { name: 'actual shared receiver-source telemetry includes overlapping events', passed: clip.telemetry.some(f => f.events.length === 2 && f.source.count > 0 && f.lights.filter(l => l.candela > 0).length >= 2) },
      { name: 'production primary/body/crackle/ascent layers scheduled', passed: clip.audio.recordedPlays >= 2 && clip.audio.synthesizedPlays >= 2 && clip.audio.accentPlays >= 4 && ['primary', 'low-body', 'crackle-tail', 'late-crackle', 'ascent'].every(role => clip.audio.layerPlays[role] > 0), layerPlays: clip.audio.layerPlays },
      { name: 'two distinct recording attacks actually scheduled', passed: ['bang', 'boom-b'].every(id => clip.audio.variantPlays[id] > 0), variantPlays: clip.audio.variantPlays },
      { name: 'no stale or voice-cap event drops', passed: clip.audio.voiceLimitDrops === 0 && clip.audio.staleDrops === 0 },
      { name: 'audio capture begins with a running context', passed: clip.captureAudioContextState === 'running' },
      { name: 'compositor capture covers active fireworks without long gaps', passed: errors.length === 0 && clip.screencast.firstSeconds <= .25 && clip.screencast.firstActiveDelaySeconds <= .25 && clip.screencast.maxActiveIntervalSeconds <= .25 && clip.recordingWallSeconds - clip.screencast.lastSeconds <= .25, screencast: clip.screencast },
      { name: 'no GL errors', passed: clip.gl.errors.length === 0, gl: clip.gl },
    ]; clip.passed = clip.checks.every(c => c.passed); return clip;
  } finally { await cdp.send('Page.stopScreencast'); await cdp.detach(); }
}

(async () => {
  if (only && !scenes.some(scene => scene.id === only)) throw Error('Unknown --only scene');
  const sourceHashes = await hashes(), report = { schema: 'glass-atoll.multi-light-audio-previews.v1', dateUTC: new Date().toISOString(), sourceHashes, viewport: [960, 720], sequence, passed: false, clips: [], issues: [], limits: ['Actual isolated Chrome, medium SDR; light smoke/persistent volumetric smoke off. Capture overhead is not a performance benchmark.', 'Complex displays retain authored multi-colour curves. Palette input requests do not replace their authored colour choreography.', 'CDP JPEG95 with independent Opus retains wall cadence on the ffconcat grid; audio/video synchronization is approximate without a shared measured sample clock.', 'Scheduling/decoded-file evidence does not replace normal playback and subjective listening.'] };
  const browser = await chromium.launch({ headless: true, executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', args: ['--autoplay-policy=no-user-gesture-required'] });
  try {
    for (const scene of scenes.filter(scene => !only || scene.id === only)) {
      await assertReceipt(sourceHashes); report.currentScene = scene.id; report.stage = 'prepare'; await save('multi-previews.json', report);
      const context = await browser.newContext({ viewport: { width: 960, height: 720 }, deviceScaleFactor: 1 }), page = await context.newPage();
      page.on('pageerror', error => report.issues.push(String(error.stack || error)));
      page.on('console', message => { if (message.type() === 'error') report.issues.push(message.text()); });
      await page.goto('http://127.0.0.1:5186/'); await page.waitForFunction(() => window.__ATOLL__?.state.ready, null, { timeout: 120000 });
      await page.evaluate(async () => { const a = window.__ATOLL__; a.pause(true); await a.setQuality('medium'); await a.setGraphics({ hdrMode: 'sdr' }); await a.timePreset('stars'); await a.setTime({ running: false }); a.setDirector({ mode: 'off' }); a.setFireworks({ type: 'display-flower', effectProfile: 'legacy', autoLaunch: false, autoFrame: false, autoDirection: false, elevation: 78, launchSpreadDegrees: 0, burstTiltDegrees: 0, burstRollDegrees: 0, smokeQuality: 'light', persistentSmoke: false, resolvedSmokeLighting: false }); });
      if (await page.locator('#sound').getAttribute('aria-pressed') === 'false') await page.locator('#sound').click(); else await page.keyboard.press('Shift');
      await page.waitForFunction(() => window.__ATOLL__.audio.enabled && window.__ATOLL__.audio.loaded && window.__ATOLL__.audio.contextState === 'running' && window.__ATOLL__.fireworks().audio.variantsLoaded.length === 5, null, { timeout: 30000 });
      // Warm shaders and production audio before receipt-controlled recording.
      await page.evaluate(scene => { const a = window.__ATOLL__; a.pause(true); a.clearSmoke(); a.setLens({ focal: scene.focal, dof: false, vignette: false }); a.setCamera(scene.position, scene.target, { expandFramingLimits: true }); document.activeElement?.blur(); }, scene);
      // Exercise both actual display materials from the final camera before
      // recording. This keeps first-use shader work out of the launch frame.
      for (const [type, seed] of [['display-flower', 618], ['display-brocade', 619]]) {
        await page.evaluate(({ type, seed }) => { const a = window.__ATOLL__; a.launchFirework({ type, seed }); a.pause(false); }, { type, seed });
        await page.waitForFunction(() => window.__ATOLL__.fireworks().active === 0, null, { timeout: 90000 });
      }
      await page.evaluate(() => { const a = window.__ATOLL__; a.pause(true); a.clearSmoke(); });
      await page.waitForTimeout(2500);
      await page.addStyleTag({ content: 'body > :not(#scene){visibility:hidden!important}' });
      report.stage = 'record'; await assertReceipt(sourceHashes); await save('multi-previews.json', report); const clip = await record(page, context, scene); await assertReceipt(sourceHashes);
      report.clips.push(clip); await save('multi-previews.json', report); await context.close(); console.log(JSON.stringify({ id: clip.id, passed: clip.passed, physicalSeconds: clip.physicalSeconds, wallSeconds: clip.wallSeconds, frames: clip.screencast.frames, maxGap: clip.screencast.maxIntervalSeconds, layers: clip.audio.layerPlays, failed: clip.checks.filter(c => !c.passed) }));
      if (!clip.passed) throw Error('Multi-preview acceptance failed for ' + scene.id);
    }
    await assertReceipt(sourceHashes); report.passed = report.clips.length === (only ? 1 : scenes.length) && report.clips.every(c => c.passed) && report.issues.length === 0; report.stage = 'complete'; delete report.currentScene; await save('multi-previews.json', report); if (!report.passed) process.exitCode = 1;
  } catch (error) { report.passed = false; report.error = error.stack || String(error); await save('multi-previews.json', report); throw error; }
  finally { await browser.close(); }
})().catch(error => { console.error(error.stack || error); process.exitCode = 1; });
