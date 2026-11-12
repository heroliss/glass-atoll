// Isolated, serial Chrome A/B. Baseline overrides only the two saved source
// files; every other module and asset comes from the running production server.
// Run with NODE_PATH pointing to the bundled Playwright/pngjs dependencies.
const { chromium } = require('playwright');
const { PNG } = require('pngjs');
const fs = require('node:fs/promises');
const path = require('node:path');
const crypto = require('node:crypto');

const output = __dirname;
const root = path.resolve(output, '../..');
const baseUrl = process.env.ATOLL_URL || 'http://127.0.0.1:5186/';
const full = process.argv.includes('--full');
const stress = process.argv.includes('--stress');
const waterComparison = process.argv.includes('--water');
const baselineFiles = waterComparison ? ['water.js'] : ['main.js', 'quality-governor.js'];
const only = process.argv.find(arg => arg.startsWith('--only='))?.slice(7);
if (only && !['low', 'high'].includes(only)) throw Error('Use --only=low or --only=high');
const viewports = [
  { id: 'low', width: 960, height: 720, seconds: 10, maxWaitMs: 90000, phase: 'burst-plus-0.7s' },
  { id: 'high', width: 2560, height: 1215, seconds: stress ? 26 : 14, maxWaitMs: 180000, phase: 'launch-plus-0.22s' },
].filter(item => !only || item.id === only);
const order = full ? ['baseline', 'candidate', 'candidate', 'baseline'] : ['baseline', 'candidate'];
const tracked = ['main.js', 'quality-governor.js', 'lens.js', 'fireworks.js', 'fireworks-audio.js', 'local-lights.js', 'firework-receiver-lighting.js', 'water.js', 'pyro-smoke-renderer.js'];
const hash = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
const sourceHash = async name => hash(await fs.readFile(path.join(root, name)));
const save = async (name, object) => fs.writeFile(path.join(output, name), JSON.stringify(object, null, 2) + '\n');
const progress = object => console.log(JSON.stringify(object));

function stats(values) {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const q = p => sorted[Math.min(sorted.length - 1, Math.floor(p * (sorted.length - 1)))];
  return { count: sorted.length, median: q(.5), p95: q(.95), maximum: q(1) };
}
function phases(profile) {
  const groups = {};
  for (const frame of profile?.frames || []) {
    for (const [name, ms] of Object.entries(frame.phases || {})) {
      if (Number.isFinite(ms)) (groups[name] ||= []).push(ms);
    }
  }
  return Object.fromEntries(Object.entries(groups).map(([name, values]) => [name, stats(values)]));
}
function bench(result) {
  return {
    status: result.status, validity: result.validity, reason: result.reason,
    elapsedSeconds: result.elapsedSeconds, frames: result.frames,
    averageFps: result.averageFps, frameMs: result.frameMs,
    cpuMs: result.cpuMs, gpuMs: result.gpuMs,
    framesOver16_67ms: result.framesOver16_67ms,
    initial: result.initial && {
      viewport: result.initial.viewport, dpr: result.initial.dpr,
      renderScale: result.initial.renderScale, lensSize: [result.initial.lens?.width, result.initial.lens?.height],
      qualityPreset: result.initial.parameters?.qualityPreset,
      governor: result.initial.performance,
    },
    final: result.final && {
      viewport: result.final.viewport, dpr: result.final.dpr,
      renderScale: result.final.renderScale, lensSize: [result.final.lens?.width, result.final.lens?.height],
      qualityPreset: result.final.parameters?.qualityPreset,
      governor: result.final.performance,
    },
  };
}
function pixelDiff(left, right) {
  const a = PNG.sync.read(left), b = PNG.sync.read(right);
  if (a.width !== b.width || a.height !== b.height) return { comparable: false, reason: 'canvas dimensions differ', sizes: [[a.width, a.height], [b.width, b.height]] };
  const regions = {
    full: [0, 0, 1, 1],
    island: [.18, .45, .76, .86],
    sky: [.30, .05, .84, .55],
  };
  const result = {};
  for (const [name, rect] of Object.entries(regions)) {
    const x0 = Math.floor(rect[0] * a.width), y0 = Math.floor(rect[1] * a.height);
    const x1 = Math.ceil(rect[2] * a.width), y1 = Math.ceil(rect[3] * a.height);
    let count = 0, sum = 0, changed = 0, referenceY = 0, candidateY = 0;
    const histogram = new Uint32Array(256);
    for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) {
      const i = (y * a.width + x) * 4;
      const dr = Math.abs(a.data[i] - b.data[i]);
      const dg = Math.abs(a.data[i + 1] - b.data[i + 1]);
      const db = Math.abs(a.data[i + 2] - b.data[i + 2]);
      const peak = Math.max(dr, dg, db);
      histogram[peak]++; count++; sum += (dr + dg + db) / 3; changed += Number(peak > 8);
      referenceY += .2126 * a.data[i] + .7152 * a.data[i + 1] + .0722 * a.data[i + 2];
      candidateY += .2126 * b.data[i] + .7152 * b.data[i + 1] + .0722 * b.data[i + 2];
    }
    let cumulative = 0, p95 = 0;
    for (let v = 0; v < histogram.length; v++) { cumulative += histogram[v]; if (cumulative >= count * .95) { p95 = v; break; } }
    result[name] = { pixels: count, meanAbsRgb8: sum / count, p95MaxChannel8: p95, fractionMaxChannelAbove8: changed / count,
      referenceMeanLuma8: referenceY / count, candidateMeanLuma8: candidateY / count };
  }
  return { comparable: true, width: a.width, height: a.height, regions: result,
    caution: 'Dynamic renderScale, temporal history and physically moving effects can change pixels without losing perceived detail. Inspect paired PNGs for composition, colour and highlight retention.' };
}

async function runArm(browser, viewport, arm, index, referenceEV, beforeSources) {
  const issues = [], context = await browser.newContext({ viewport: { width: viewport.width, height: viewport.height }, deviceScaleFactor: 1 });
  const page = await context.newPage();
  page.on('pageerror', error => issues.push({ kind: 'pageerror', message: String(error.stack || error) }));
  page.on('console', message => { if (['error', 'warning'].includes(message.type())) issues.push({ kind: message.type(), message: message.text() }); });
  const result = { arm, index, viewport: viewport.id, status: 'started', issues };
  try {
    if (arm === 'baseline') {
      for (const name of baselineFiles) {
        const file = path.join(output, 'before', name), body = await fs.readFile(file);
        await context.route('**/' + name, route => route.fulfill({ status: 200, contentType: 'text/javascript; charset=utf-8', body }));
      }
    }
    progress({ stage: 'load', viewport: viewport.id, arm, index });
    await page.goto(baseUrl, { waitUntil: 'domcontentloaded', timeout: 120000 });
    await page.waitForFunction(() => window.__ATOLL__?.state.ready, null, { timeout: 150000, polling: 200 });
    progress({ stage: 'fixture', viewport: viewport.id, arm, index });
    const fixture = await page.evaluate(async ({ high, referenceEV, stress }) => {
      const a = window.__ATOLL__;
      a.pause(true);
      await a.setQuality(stress ? 'high' : 'medium');
      await a.setGraphics({ hdrMode: 'sdr' });
      await a.timePreset('stars');
      await a.setTime({ running: false });
      a.setDirector({ mode: 'off' });
      a.setFireworks({ type: 'chrysanthemum', effectProfile: 'legacy', autoLaunch: false, autoFrame: false,
        autoDirection: false, elevation: 78, launchSpreadDegrees: 0, burstTiltDegrees: 0,
        burstRollDegrees: 0, smokeQuality: stress ? 'full' : 'light', persistentSmoke: stress, resolvedSmokeLighting: stress });
      a.clearSmoke();
      a.setLens({ focal: 24, dof: false, vignette: false, automatic: true, temporal: true, temporalJitter: false,
        glintAA: true, opticalFlare: false, shutterSeconds: 1 / 120 });
      a.setCamera([-65, 30, 54], [2, 3, 0], { expandFramingLimits: true });
      const fixedEV = referenceEV ?? a.photometry().cameraEV;
      a.setDiagnosticCameraEV(fixedEV);
      const start = a.state.time;
      const requests = [{ seed: 9021, palette: 'red', azimuth: 35 }, { seed: 9022, palette: 'blue', azimuth: 215 }];
      const launches = requests.map(o => a.launchFirework({ type: 'chrysanthemum', ...o, elevation: 78, launchSpreadDegrees: 0 }));
      if (launches.some(l => !l.accepted || l.queued)) throw Error('Two fixed-seed fireworks were not launched immediately');
      const target = high ? start + .22 : Math.max(...launches.map(l => l.burstTime)) + .7;
      a.pauseAtPhysicalTime(target); a.pause(false);
      return { fixedEV, start, target, targetOffsetSeconds: target - start,
        launches: launches.map((l, i) => ({ id: l.id, seed: requests[i].seed, type: l.type,
          palette: requests[i].palette, azimuth: requests[i].azimuth,
          burstOffsetSeconds: l.burstTime - start })),
        qualityPreset: a.state.parameters.qualityPreset, audioEnabled: a.audio.enabled,
        audioContextState: a.audio.contextState };
    }, { high: viewport.id === 'high', referenceEV, stress });
    result.fixture = fixture;
    await page.waitForFunction(target => {
      const a = window.__ATOLL__;
      return a.state.parameters.paused && Math.abs(a.state.time - target) < 1e-6;
    }, fixture.target, { timeout: viewport.maxWaitMs, polling: 200 });
    progress({ stage: 'frozen', viewport: viewport.id, arm, index, physicalTarget: fixture.targetOffsetSeconds });
    const still = await page.evaluate(() => {
      const a = window.__ATOLL__, canvas = document.querySelector('#scene canvas');
      return { canvas: [canvas.width, canvas.height],
        physicalTime: a.state.time, qualityPreset: a.state.parameters.qualityPreset,
        camera: a.state.camera, target: a.state.target, lens: a.state.parameters.lens,
        fireworkActive: a.fireworks().active, fireworkSources: a.fireworkReceiverClusters().length,
        audioEnabled: a.audio.enabled, audioContextState: a.audio.contextState };
    });
    const imageName = 'ab-' + (stress ? 'stress-' : '') + (waterComparison ? 'water-' : 'governor-') + viewport.id + '-' + arm + '-' + index + '.png';
    await fs.writeFile(path.join(output, imageName), await page.locator('#scene canvas').first().screenshot());
    result.still = { ...still, file: imageName, sha256: hash(await fs.readFile(path.join(output, imageName))) };
    const frozen = await page.evaluate(async seconds => {
      const a = window.__ATOLL__;
      a.profileFrames(seconds + .25);
      const measured = await a.benchmarkFrozenSmoke({ seconds });
      return { measured, profile: a.frameProfile() };
    }, viewport.seconds);
    result.frozen = { benchmark: bench(frozen.measured), phases: phases(frozen.profile),
      workloadStable: !frozen.measured.workload?.interrupted,
      workload: frozen.measured.workload?.before };
    progress({ stage: 'evolving', viewport: viewport.id, arm, index });
    const evolving = await page.evaluate(async seconds => {
      const a = window.__ATOLL__;
      a.pause(false); a.profileFrames(seconds + .25);
      const start = { physical: a.state.time, wall: performance.now() };
      const measured = await a.benchmark(seconds);
      const end = { physical: a.state.time, wall: performance.now() };
      a.pause(true);
      return { measured, profile: a.frameProfile(), physicalSeconds: end.physical - start.physical,
        wallSeconds: (end.wall - start.wall) / 1000,
        gl: a.readGLErrors('performance-ab-' + seconds),
        contextInterrupted: a.state.graphicsContextInterrupted,
        sound: { enabled: a.audio.enabled, contextState: a.audio.contextState, loaded: a.audio.loaded } };
    }, viewport.seconds);
    result.evolving = { benchmark: bench(evolving.measured), phases: phases(evolving.profile),
      physicalSeconds: evolving.physicalSeconds, wallSeconds: evolving.wallSeconds,
      physicalMinusWallSeconds: evolving.physicalSeconds - evolving.wallSeconds,
      gl: evolving.gl, contextInterrupted: evolving.contextInterrupted, sound: evolving.sound };
    result.passed = result.frozen.benchmark.validity === 'valid' && result.frozen.workloadStable &&
      result.evolving.benchmark.validity === 'valid' && !result.evolving.contextInterrupted &&
      result.evolving.gl.errors.length === 0 && !issues.some(issue => issue.kind === 'error' || issue.kind === 'pageerror');
    result.status = 'complete';
    progress({ stage: 'complete-arm', viewport: viewport.id, arm, index, passed: result.passed,
      frozenFps: result.frozen.benchmark.averageFps, evolvingFps: result.evolving.benchmark.averageFps,
      frozenScale: result.frozen.benchmark.final?.renderScale,
      evolvingScale: result.evolving.benchmark.final?.renderScale });
  } catch (error) {
    result.status = 'error'; result.passed = false; result.error = String(error.stack || error);
    progress({ stage: 'error', viewport: viewport.id, arm, index, error: result.error });
  } finally {
    await context.close().catch(error => issues.push({ kind: 'close', message: String(error) }));
  }
  return result;
}

(async () => {
  const sourceHashes = Object.fromEntries(await Promise.all(tracked.map(async name => [name, await sourceHash(name)])));
  const baselineHashes = Object.fromEntries(await Promise.all(baselineFiles.map(async name =>
    [name, hash(await fs.readFile(path.join(output, 'before', name)))])));
  const report = { schema: 'glass-atoll.performance-20261101.ab-browser.v1', dateUTC: new Date().toISOString(),
    url: baseUrl, mode: full ? 'ABBA' : 'AB', sourceReceipt: { candidateBefore: sourceHashes, baseline: baselineHashes },
    fixtures: viewports, arms: [], imageComparisons: [], passed: false,
    limits: ['Only '+baselineFiles.join(', ')+' are overridden for baseline. All other sources and assets are shared.',
      'Low viewport pauses 0.7s after burst; high viewport pauses 0.22s after launch to bound the 1 FPS case. Compare versions within each viewport, not across viewports.',
      'Short isolated Chrome benchmarks are not sustained application FPS or subjective visual acceptance.',
      'Visual pixel differences may reflect dynamic renderScale or temporal history. Inspect paired images for composition, colour, fine highlights and island illumination.'] };
  const file = 'ab-' + (stress ? 'stress-' : '') + (waterComparison ? 'water' : 'browser') + '-' + (full ? 'full' : 'quick') + (only ? '-' + only : '') + '.json';
  const browser = await chromium.launch({ headless: true, executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe',
    args: ['--autoplay-policy=no-user-gesture-required'] });
  try {
    for (const viewport of viewports) {
      let referenceEV = null;
      for (const [index, arm] of order.entries()) {
        const current = await runArm(browser, viewport, arm, index, referenceEV, sourceHashes);
        report.arms.push(current);
        if (referenceEV === null && current.fixture?.fixedEV !== undefined) referenceEV = current.fixture.fixedEV;
        await save(file, report);
      }
      const baseline = report.arms.find(item => item.viewport === viewport.id && item.arm === 'baseline' && item.still);
      const candidate = report.arms.find(item => item.viewport === viewport.id && item.arm === 'candidate' && item.still);
      if (baseline && candidate) {
        report.imageComparisons.push({ viewport: viewport.id, baseline: baseline.still.file, candidate: candidate.still.file,
          baselineScale: baseline.frozen?.benchmark?.initial?.renderScale,
          candidateScale: candidate.frozen?.benchmark?.initial?.renderScale,
          pixel: pixelDiff(await fs.readFile(path.join(output, baseline.still.file)), await fs.readFile(path.join(output, candidate.still.file))),
          comparablePhysicalPhase: Math.abs(baseline.fixture.targetOffsetSeconds - candidate.fixture.targetOffsetSeconds) < 1e-4,
          comparableCamera: JSON.stringify(baseline.still.camera) === JSON.stringify(candidate.still.camera) &&
            JSON.stringify(baseline.still.target) === JSON.stringify(candidate.still.target),
          comparableOutputSize: JSON.stringify(baseline.still.canvas) === JSON.stringify(candidate.still.canvas) });
      }
      await save(file, report);
    }
  } finally { await browser.close(); }
  const after = Object.fromEntries(await Promise.all(tracked.map(async name => [name, await sourceHash(name)])));
  report.sourceReceipt.candidateAfter = after;
  report.sourceReceipt.stable = JSON.stringify(sourceHashes) === JSON.stringify(after);
  report.passed = report.sourceReceipt.stable && report.arms.length === viewports.length * order.length &&
    report.arms.every(item => item.passed) && report.imageComparisons.length === viewports.length &&
    report.imageComparisons.every(item => item.comparablePhysicalPhase && item.comparableCamera && item.comparableOutputSize);
  await save(file, report);
  progress({ stage: 'complete', passed: report.passed, report: file, arms: report.arms.length,
    comparisons: report.imageComparisons.map(item => ({ viewport: item.viewport, pixel: item.pixel.regions?.full })) });
  if (!report.passed) process.exitCode = 1;
})().catch(error => { console.error(error.stack || error); process.exitCode = 1; });
