// Browser/GPU work is deliberately launched only by the parent agent.
const { chromium } = require('playwright');
const fs = require('node:fs/promises');
const path = require('node:path');
const { createHash } = require('node:crypto');
const root = path.join(__dirname, '../..');
const sourceFiles = ['main.js', 'lens.js', 'fireworks.js', 'fireworks-physics.js', 'firework-receiver-lighting.js', 'local-lights.js', 'indirect-lighting.js', 'water.js', 'vegetation.js'];
const failureContext = { stage: 'startup', issues: [], reports: [], sourceHashes: {} };
async function hashes() { return Object.fromEntries(await Promise.all(sourceFiles.map(async file => [file, createHash('sha256').update(await fs.readFile(path.join(root, file))).digest('hex')]))); }
async function persist(name, report) {
  const { images = [], ...body } = report;
  for (const item of images) await fs.writeFile(path.join(__dirname, item.name), Buffer.from(item.dataURL.split(';base64,')[1], 'base64'));
  body.images = images.map(({ dataURL, ...item }) => item);
  await fs.writeFile(path.join(__dirname, name + '.json'), JSON.stringify(body, null, 2));
  return body;
}
async function open(browser, issues) {
  const page = await browser.newPage({ viewport: { width: 960, height: 720 }, deviceScaleFactor: 1 });
  page.on('pageerror', e => issues.push(String(e)));
  page.on('console', m => { if (m.type() === 'error') issues.push(m.text()); });
  await page.goto('http://127.0.0.1:5186/');
  const status = await page.waitForFunction(() => {
    const error = document.querySelector('#error'), detail = document.querySelector('#error-detail')?.textContent?.trim();
    if (error && !error.hidden) return { ready: false, error: detail || error.textContent.trim(), loading: document.querySelector('#loading')?.textContent?.trim() };
    if (window.__ATOLL__?.state.ready) return { ready: true };
    return false;
  }, null, { timeout: 120000, polling: 100 });
  const loaded = await status.jsonValue(); await status.dispose();
  if (!loaded.ready) { issues.push('Application initialization failed: ' + loaded.error); throw Error('Application initialization failed: ' + loaded.error + (loaded.loading ? '\nLoading state: ' + loaded.loading : '')); }
  await page.evaluate(async () => { const a = window.__ATOLL__; a.pause(true); await a.setQuality('medium'); await a.setGraphics({ hdrMode: 'sdr' }); });
  await page.addStyleTag({ content: 'body > :not(#scene){visibility:hidden!important}' });
  return page;
}
async function naturalProbe(page) {
  return page.evaluate(async () => {
    const a = window.__ATOLL__, wait = ms => new Promise(r => setTimeout(r, ms)), frames = [], images = [], checks = [];
    const y = rgb => .2126 * rgb[0] + .7152 * rgb[1] + .0722 * rgb[2];
    function sources(clusters) {
      const rgb = [0, 0, 0], position = [0, 0, 0]; let weight = 0;
      for (const c of clusters) { const colour = c.linearColor ?? c.color ?? [1, 1, 1], i = c.referenceCandela ?? c.candela ?? c.intensity ?? 0, w = i * y(colour); weight += w; for (let k = 0; k < 3; k++) { rgb[k] += colour[k] * i; position[k] += c.position[k] * w; } }
      return { count: clusters.length, referenceRGB: rgb, referenceY: y(rgb), centroidMetres: weight ? position.map(v => v / weight) : null };
    }
    a.pause(true); a.setDirector({ mode: 'off' }); await a.timePreset('stars'); await a.setTime({ running: false });
    a.setFireworks({ type: 'chrysanthemum', effectProfile: 'legacy', autoLaunch: false, autoFrame: false, autoDirection: false, elevation: 78, launchSpreadDegrees: 0, burstTiltDegrees: 0, burstRollDegrees: 0, smokeQuality: 'light', persistentSmoke: false, resolvedSmokeLighting: false }); a.clearSmoke();
    a.setLens({ focal: 24, dof: false, vignette: false, temporal: true, temporalJitter: false, glintAA: true, opticalFlare: false, shutterSeconds: 1 / 120 });
    a.setCamera([-65, 30, 54], [2, 3, 0], { expandFramingLimits: true }); const fixedCameraEV = a.photometry().cameraEV; a.setDiagnosticCameraEV(fixedCameraEV);
    const launches = [{ seed: 9021, palette: 'red', azimuth: 35 }, { seed: 9022, palette: 'blue', azimuth: 215 }].map(o => a.launchFirework({ type: 'chrysanthemum', ...o, elevation: 78, launchSpreadDegrees: 0 }));
    if (launches.some(l => !l.accepted || l.queued)) throw Error('Natural launches not immediately accepted');
    const started = performance.now(), burst = launches[0].burstTime, captureTimes = [-.5, .025, .8, 2.2, 3.9]; let done = false;
    function observe() {
      const phase = a.state.time - burst, source = sources(a.fireworkReceiverClusters()), lights = a.localLights().lights.slice(4), photometry = a.photometry();
      frames.push({ time: a.state.time, phaseSeconds: phase, source, lights, storageEV: photometry.storageEV, cameraEV: photometry.cameraEV, activeEvents: a.fireworks().activeEvents.map(e => ({ id: e.id, type: e.type })) });
      if (images.length < captureTimes.length && phase >= captureTimes[images.length]) images.push({ name: 'natural-multi-' + images.length + '.png', phaseSeconds: phase, physicalTime: a.state.time, dataURL: document.querySelector('#scene canvas').toDataURL('image/png') });
      done = phase > .5 && a.fireworks().active === 0;
      if (!done) a.setFrameProbe(observe);
    }
    a.setFrameProbe(observe); a.pause(false);
    try { while (!done) { if (performance.now() - started > 180000) throw Error('Natural lifecycle timed out'); await wait(100); } }
    finally { a.pause(true); a.setFrameProbe(null); }
    const live = frames.filter(f => f.source.referenceY > 0), first = live[0], last = live.at(-1), peak = Math.max(...live.map(f => f.source.referenceY)), tail = live.filter(f => f.phaseSeconds > 1), cutoff = peak * 1e-4;
    const gaps = first && last ? frames.filter(f => f.time > first.time && f.time < last.time && f.source.referenceY === 0) : [];
    const centroidTravelMetres = first ? Math.max(...live.map(f => Math.hypot(...f.source.centroidMetres.map((v, k) => v - first.source.centroidMetres[k])))) : 0;
    const terminal = frames.at(-1), fade = tail.filter(f => f.source.referenceY <= cutoff);
    checks.push({ name: 'actual rendered frames cover ascent, burst and late burn', passed: frames.some(f => f.phaseSeconds < -.5 && f.source.referenceY > 0) && frames.some(f => f.phaseSeconds >= 0 && f.phaseSeconds < .2 && f.source.referenceY > 0) && frames.some(f => f.phaseSeconds > 3 && f.source.referenceY > 0) });
    checks.push({ name: 'no all-dark source gap between first and last live frame', passed: gaps.length === 0, gaps: gaps.map(f => ({ time: f.time, phaseSeconds: f.phaseSeconds })) });
    checks.push({ name: 'source light position evolves in natural playback', passed: centroidTravelMetres > 1, centroidTravelMetres });
    checks.push({ name: 'terminal emission falls below 0.01 percent of peak before expiry', passed: fade.length >= 2, peakReferenceY: peak, thresholdReferenceY: cutoff, terminalLiveReferenceY: last?.source.referenceY, lowTailFrames: fade.length });
    checks.push({ name: 'all real firework lamps extinguish at event completion', passed: terminal.source.count === 0 && terminal.lights.every(l => l.candela === 0 && l.rawRGB.every(v => v === 0)), terminal });
    const gl = a.readGLErrors('natural-multi-lifecycle'); checks.push({ name: 'no GL errors', passed: gl.errors.length === 0, gl });
    return { schema: 'glass-atoll.natural-multi-light.v1', dateUTC: new Date().toISOString(), launches, fixedCameraEV, frames, images, checks, passed: checks.every(c => c.passed), limits: ['Per-frame means actual rendered frames, not fixed-rate simulation ticks or FPS/performance acceptance.', 'This source/native-lamp continuity trace complements the separate exact-time actual island attachment readbacks.', 'Finite per-rendered-frame coverage cannot exclude unrendered sub-frame discontinuities; CPU lifecycle checks provide denser sampling.'] };
  });
}
(async () => {
  const before = await hashes(); failureContext.sourceHashes = before;
  const browser = await chromium.launch({ headless: true, executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe' }), reports = failureContext.reports, issues = failureContext.issues;
  try {
    if (!process.argv.includes('--natural-only')) {
      failureContext.stage = 'exact-scene';
      const page = await open(browser, issues);
      if (!await page.evaluate(() => typeof window.__ATOLL__.runMultiReceiverLightCheck === 'function')) throw Error('main.js must expose runMultiReceiverLightCheck wrapper before this runner starts');
      const result = await page.evaluate(() => window.__ATOLL__.runMultiReceiverLightCheck({ capture: true }));
      result.sourceHashes = before; result.browserIssues = [...issues]; result.passed &&= issues.length === 0;
      reports.push(await persist('multi-receiver-scene', result)); await page.close();
    }
    if (!process.argv.includes('--exact-only')) {
      failureContext.stage = 'natural-lifecycle';
      const page = await open(browser, issues), result = await naturalProbe(page);
      result.sourceHashes = before; result.browserIssues = [...issues]; result.passed &&= issues.length === 0;
      reports.push(await persist('natural-multi-lifecycle', result)); await page.close();
    }
    const after = await hashes(), changed = sourceFiles.filter(file => before[file] !== after[file]);
    const summary = { passed: reports.length > 0 && reports.every(r => r.passed) && changed.length === 0, changedSources: changed, browserIssues: issues, reports: reports.map(r => ({ schema: r.schema, passed: r.passed, checks: r.checks, error: r.error, phaseCount: r.phases?.length, frameCount: r.frames?.length })) };
    await fs.writeFile(path.join(__dirname, 'multi-receiver-browser-summary.json'), JSON.stringify(summary, null, 2)); console.log(JSON.stringify(summary, null, 2)); if (!summary.passed) process.exitCode = 1;
  } finally { await browser.close(); }
})().catch(async error => {
  const failure = { schema: 'glass-atoll.multi-receiver-browser-failure.v1', dateUTC: new Date().toISOString(), passed: false, stage: failureContext.stage, sourceHashes: failureContext.sourceHashes, browserIssues: failureContext.issues, reports: failureContext.reports, exception: { message: error.message, stack: String(error.stack || error) } };
  try { await fs.writeFile(path.join(__dirname, 'multi-receiver-browser-summary.json'), JSON.stringify(failure, null, 2)); } catch (writeError) { console.error('Could not persist failure report: ' + writeError); }
  console.error(error.stack || error); process.exitCode = 1;
});
