// QA ONLY; caller runs this after the frozen production main has been reloaded.
// Uses public APIs only: no renderer ownership, private hosts, source edits,
// artificial audio replay, density overrides or unsafe fixed storage exposure.
// One explicit setup clear BEFORE A. NEVER clears between A/B or in finally.
// Preference restoration cannot rewind physical time/matter or replace the
// ring-burn host while it contains matter; that host remains until reload.
const clone = value => structuredClone(value);
const json = value => JSON.stringify(value);
const norm = values => Math.hypot(...values);
const distance = (a, b) => Math.hypot(...a.map((v, i) => v - b[i]));
const near = (a, b, tolerance = 1e-8) => Number.isFinite(a) && Number.isFinite(b) && Math.abs(a - b) <= tolerance;
function exact(a, b) {
  if (typeof a === 'number' || typeof b === 'number') return typeof a === 'number' && typeof b === 'number' && Number.isFinite(a) && Number.isFinite(b) && Object.is(a, b);
  if (a === null || b === null || typeof a !== 'object' || typeof b !== 'object') return a === b;
  const ak = Object.keys(a).sort(), bk = Object.keys(b).sort();
  return json(ak) === json(bk) && ak.every(k => exact(a[k], b[k]));
}
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
function nextFrame(deadline) {
  return new Promise((resolve, reject) => {
    const remaining = Math.min(5000, deadline - performance.now());
    if (!(remaining > 0)) { reject(new Error('Two-event QA wall deadline exceeded')); return; }
    let handle;
    const timer = setTimeout(() => { cancelAnimationFrame(handle); reject(new Error('Animation frame/deadline timeout; QA did not advance a hidden tab')); }, remaining);
    handle = requestAnimationFrame(() => { clearTimeout(timer); resolve(); });
  });
}
function audioState(a) {
  const d = a.fireworks().audio;
  return { enabled: a.audio.enabled, scheduled: d.scheduled, discarded: d.discarded, recordedPlays: d.recordedPlays, synthesizedPlays: d.synthesizedPlays,
    settings: { relativeBurstGain: d.relativeBurstGain, postCompressorHeadroomGain: d.postCompressorHeadroomGain, compressorAttackSeconds: d.compressorAttackSeconds, source: d.source } };
}
const quality = s => ({ graphics: s.parameters.graphics, preset: s.parameters.qualityPreset, sampling: s.parameters.renderSampling, renderScale: s.renderScale,
  width: s.lens.width, height: s.lens.height, outputWidth: s.lens.outputWidth, outputHeight: s.lens.outputHeight, samples: s.lens.samples });
function fieldState(a, smoke) {
  return { public: clone(a.fireworks().lightingField), volume: clone(smoke.rendering?.resolvedLighting ?? null), lastRender: clone(smoke.rendering?.lastRender ?? null) };
}
function readyField(status, packetCount, hot) {
  const p = status.public, v = status.volume, f = v?.field;
  return !!p && (p.requestedEnabled ?? p.requested) === true && p.effective === true && p.supported === true && p.reason === 'ready' && !p.hidden && !p.awaitingSmoke &&
    v?.effective === true && v.supported === true && f?.effective === true && f.supported === true && f.reason === 'ready' &&
    f.packetCount === packetCount && Number.isSafeInteger(f.sourceCount) && (hot ? f.sourceCount > 0 : f.sourceCount === 0) &&
    f.requiredPairs === packetCount * f.sourceCount && f.requiredPairs <= f.maxBakePairs &&
    status.lastRender?.resolvedPyroField === true && status.lastRender.resolvedFieldVersion === f.version;
}
function disabledField(status) {
  return (status.public?.requestedEnabled ?? status.public?.requested) === false && status.public?.effective === false && status.volume?.effective !== true && status.lastRender?.resolvedPyroField !== true;
}
function safeRanges(ranges) {
  return ['opaque', 'composed', 'reflection'].every(k => {
    const r = ranges[k];
    return r && r.classifierVersion === 'ieee-bits-v2' && r.countNaN === 0 && r.countInf === 0 && r.countNegative === 0 && r.counterConsistency && r.stateRestored && Number.isFinite(r.globalMax);
  });
}
function rawRanges(ranges, P) {
  return Object.fromEntries(['opaque', 'composed', 'reflection'].map(k => [k, { minimumRawRGB: ranges[k].minRGB.map(v => v === null ? null : v / 2 ** P),
    maximumRawRGB: ranges[k].maxRGB.map(v => v === null ? null : v / 2 ** P), maximumRaw: ranges[k].globalMax / 2 ** P }]));
}
async function decodePNG(url) {
  if (typeof url !== 'string' || !url.startsWith('data:image/png;base64,')) throw new Error('Forced production screenshot was not PNG');
  const image = new Image(); image.src = url; await image.decode();
  const canvas = document.createElement('canvas'); canvas.width = image.naturalWidth; canvas.height = image.naturalHeight;
  const context = canvas.getContext('2d', { colorSpace: 'srgb', willReadFrequently: true });
  if (!context) throw new Error('Canvas2D PNG decoder unavailable');
  context.drawImage(image, 0, 0);
  return { width: canvas.width, height: canvas.height, data: context.getImageData(0, 0, canvas.width, canvas.height).data };
}
function pngStats(image) {
  let lo = 255, hi = 0, nonblack = 0;
  for (let i = 0; i < image.data.length; i += 4) { const v = Math.max(image.data[i], image.data[i + 1], image.data[i + 2]); lo = Math.min(lo, v); hi = Math.max(hi, v); nonblack += Number(v > 2); }
  return { width: image.width, height: image.height, minimum: lo, maximum: hi, nonblackPixels: nonblack, nonblank: nonblack > 0 && hi > lo };
}
function pngDifference(a, b) {
  if (a.width !== b.width || a.height !== b.height) throw new Error('PNG comparison dimensions changed');
  let changed = 0, maximum = 0, squared = 0, positive = 0, negative = 0;
  for (let i = 0; i < a.data.length; i += 4) {
    let m = 0;
    for (let c = 0; c < 3; c++) { const d = b.data[i + c] - a.data[i + c]; m = Math.max(m, Math.abs(d)); squared += d * d; positive += Math.max(0, d); negative += Math.max(0, -d); }
    changed += Number(m > 0); maximum = Math.max(maximum, m);
  }
  return { changedPixels: changed, totalPixels: a.width * a.height, changedFraction: changed / (a.width * a.height), maximumByteDifference: maximum,
    rmsByteDifference: Math.sqrt(squared / (a.width * a.height * 3)), positiveByteSum: positive, negativeByteSum: negative,
    scope: 'Full actual SDR PNG, no semantic old-smoke mask. Display nonlinearities mean this is not a linear energy/isolated cross-event-lighting proof.' };
}
async function sourceHashes() {
  const files = ['main.js', 'fireworks.js', 'fireworks-physics.js', 'fireworks-audio.js', 'pyro-smoke.js', 'pyro-smoke-state.js', 'pyro-smoke-trajectory-events.js', 'pyro-smoke-renderer.js', 'pyro-smoke-light-field.js'];
  return Object.fromEntries(await Promise.all(files.map(async file => {
    const response = await fetch(new URL('../' + file, import.meta.url), { cache: 'no-store' });
    if (!response.ok) throw new Error('Source hash HTTP ' + response.status + ': ' + file);
    const hash = await crypto.subtle.digest('SHA-256', await response.arrayBuffer());
    return [file, Array.from(new Uint8Array(hash), v => v.toString(16).padStart(2, '0')).join('')];
  })));
}

export async function runTwoEventRelightSceneCheck(a, { restorePreferences = true, leftPaused = true, hotPhase = 1.1, secondPalette = 'red', maxWallMs = 300000 } = {}) {
  if (typeof restorePreferences !== 'boolean' || typeof leftPaused !== 'boolean') throw new TypeError('Restore/leftPaused options must be boolean');
  if (hotPhase !== .12 && hotPhase !== 1.1) throw new RangeError('Use the declared B hot phase .12 or 1.1 seconds');
  if (secondPalette !== null && secondPalette !== 'red') throw new RangeError('secondPalette must be red or null (original two-tone ring)');
  if (!Number.isFinite(maxWallMs) || maxWallMs < 30000 || maxWallMs > 600000) throw new RangeError('QA wall bound requires 30..600 seconds');
  const initial = clone(a.state), saved = { clock: clone(a.celestial()), sun: clone(initial.parameters.sun), lens: clone(initial.parameters.lens), weather: clone(initial.parameters.weather),
    camera: [...initial.camera], target: [...initial.target], paused: initial.parameters.paused, night: clone(a.night().settings), fireworks: clone(a.fireworks().settings),
    director: clone(initial.parameters.director), diagnosticCameraEV: a.diagnosticCameraEV, renderScale: initial.renderScale };
  const report = { schema: 'glass-atoll.two-event-shared-smoke-continuous-scene.v1', dateUTC: new Date().toISOString(), checks: [], captures: [], images: {}, runtimeErrors: [],
    technicalPassed: false, visualAcceptance: 'pending_independent_root_review', controls: { events: [{ label: 'A', seed: 42 }, { label: 'B', seed: 43 }], type: 'ring', smileyLayout: 'reference',
      flightModel: 'timed-reference', burstDelaySeconds: 3, elevationDegrees: 80, intensityScale: 4, secondPalette, AHotPhaseSeconds: 1.1, BHotPhaseSeconds: hotPhase, coldPhaseSeconds: 6,
      sourceProfile: 'ring-burn', perEventReferenceMaterial: 20.35, totalReferenceMaterial: 40.7, cameraEV: 16.5, storageP: 'natural safe full-chain envelope; may vary',
      scope: 'Continuous A→B shared-matter witness plus same-state proxy/resolved lighting toggle; NOT isolated old-smoke-only GPU relighting or 2×2 linear-source proof.' },
    restoration: { requested: restorePreferences, leftPaused }, exposureSamples: [], setupClears: 0 };
  const check = (id, passed, evidence = {}) => report.checks.push({ id, passed: !!passed, evidence });
  const error = event => report.runtimeErrors.push({ kind: 'error', message: String(event.message), time: a.state.time });
  const rejection = event => report.runtimeErrors.push({ kind: 'unhandledrejection', message: String(event.reason?.message ?? event.reason), time: a.state.time });
  window.addEventListener('error', error); window.addEventListener('unhandledrejection', rejection);
  const deadline = performance.now() + maxWallMs;
  let locked = false, fixedPose = null, fixedQuality = null, fixedUTC = null, oldPackets = null, oldSourceIDs = null, setupClearCount = null, profileInstalled = false;
  function sampleExposure(stage) {
    const s = a.state, p = a.photometry();
    report.exposureSamples.push({ stage, time: s.time, C: p.cameraEV, P: p.storageEV, lock: a.diagnosticCameraEV, paused: s.parameters.paused });
    if (report.exposureSamples.length > 20000) throw new Error('Exposure observation cap exceeded');
  }
  async function settle(stage) {
    for (let i = 0; i < 45; i++) { await nextFrame(deadline); if (locked) sampleExposure(stage); }
    let extra = 0;
    while (Math.abs(a.photometry().storageEV - a.photometry().targetEV) > 1e-10 && extra < 420) { await nextFrame(deadline); if (locked) sampleExposure(stage); extra++; }
    if (Math.abs(a.photometry().storageEV - a.photometry().targetEV) > 1e-10) throw new Error('Natural storageP did not settle; no override was used');
    return { minimumRAFs: 45, extraPAdaptationRAFs: extra };
  }
  function initializePausedPhase(stage) {
    // A paused radiometry update has dt0, so a naturally rising P cannot keep
    // adapting. Reapply the SAME absoluteC through its documented public setter:
    // it recomputes the complete safe budget, without editing P or advancing dt.
    const before = { state: clone(a.state), snapshot: clone(a.smokeSnapshot()), clusters: clone(a.fireworkClusters()), photometry: clone(a.photometry()), UTC: a.celestial().utcMs };
    const response = clone(a.setDiagnosticCameraEV(16.5));
    const after = { state: clone(a.state), snapshot: clone(a.smokeSnapshot()), clusters: clone(a.fireworkClusters()), photometry: clone(a.photometry()), UTC: a.celestial().utcMs };
    const p = after.photometry, sum = Object.values(p.components).reduce((total, v) => total + v, 0);
    const row = { stage, reason: 'Explicit fixture phase initialization: same absoluteC lock, full safe-P rebudget; no direct storageEV write and no pretend positive dt.', response,
      beforePhotometry: before.photometry, afterPhotometry: p, physicalTimeBefore: before.state.time, physicalTimeAfter: after.state.time,
      density: { bitExact: exact(before.snapshot, after.snapshot), revisionBefore: before.snapshot.revision, revisionAfter: after.snapshot.revision, packetsBefore: before.snapshot.packets.length, packetsAfter: after.snapshot.packets.length },
      source: { bitExact: exact(before.clusters, after.clusters), before: before.clusters, after: after.clusters },
      rawBoundsBitExact: exact(before.photometry.components, p.components) && Object.is(before.photometry.maxRawRGB, p.maxRawRGB),
      boundScope: 'Before/after full raw envelopes retained. The setter may refresh cached base lighting as well; equality is observed explicitly, not presumed from an unchanged UI value.' };
    report.phaseInitializations ??= []; report.phaseInitializations.push(row);
    check(stage + ': sameC safe rebudget cannot change physical time density sources UTC or pose', response.enabled === true && Object.is(response.cameraEV, 16.5) && before.state.parameters.paused && after.state.parameters.paused &&
      Object.is(before.photometry.cameraEV, 16.5) && Object.is(p.cameraEV, 16.5) && Object.is(a.diagnosticCameraEV, 16.5) && before.state.time === after.state.time &&
      row.density.bitExact && row.source.bitExact && before.UTC === after.UTC && exact(before.state.camera, after.state.camera) && exact(before.state.target, after.state.target), row);
    check(stage + ': full recomputed raw budget selects its own safe targetP', Number.isFinite(sum) && Object.values(p.components).every(v => Number.isFinite(v) && v >= 0) &&
      Object.is(sum, p.maxRawRGB) && Object.is(p.storageEV, p.targetEV) && p.storedBound <= p.safeMaximum * (1 + 1e-12) &&
      near(p.outputExposureScale / (.76 * 2 ** (p.cameraEV - p.storageEV)), 1, 1e-12), { beforeP: before.photometry.storageEV, afterP: p.storageEV, targetP: p.targetEV,
      componentsBefore: before.photometry.components, componentsAfter: p.components, rawBoundsBitExact: row.rawBoundsBitExact, storedBound: p.storedBound, safeMaximum: p.safeMaximum });
    sampleExposure(stage + '_initialized');
  }
  async function advanceTo(target, stage) {
    if (!Number.isFinite(target) || target < a.state.time) throw new Error('Physical target would rewind time');
    const from = a.state.time, started = performance.now();
    report.pauseRequests ??= []; report.pauseRequests.push({ stage, ...clone(a.pauseAtPhysicalTime(target)) });
    if (a.state.time < target) a.pause(false);
    while (!a.state.parameters.paused || a.state.time < target - 1e-8) {
      if (performance.now() - started > 60000) throw new Error('Bounded exact physical pause timed out: ' + stage);
      await nextFrame(deadline); sampleExposure(stage);
    }
    if (!near(a.state.time, target)) throw new Error('Exact physical pause missed ' + stage);
    initializePausedPhase(stage);
    return { from, target, actual: a.state.time, wallSeconds: (performance.now() - started) / 1000 };
  }
  function oldMatter(snapshot, smoke) {
    if (!oldPackets) return null;
    const noMerge = smoke.state.merges === 0 && smoke.state.forcedMerges === 0;
    if (!noMerge) return { established: false, reason: 'Merge occurred; old-ID attribution is no longer a valid proof', merges: smoke.state.merges, forcedMerges: smoke.state.forcedMerges };
    const byID = new Map(snapshot.packets.map(p => [p.id, p])), missing = [], alteredMass = [], rows = [];
    for (const [id, mass] of oldPackets) {
      const p = byID.get(id);
      if (!p) missing.push(id); else { if (!Object.is(mass, p.mass)) alteredMass.push({ id, old: mass, current: p.mass }); rows.push(p); }
    }
    const mass = rows.reduce((sum, p) => sum + p.mass, 0);
    return { established: true, expectedIDs: oldPackets.size, foundIDs: rows.length, missingIDs: missing, alteredMass, mass, expectedMass: 20.35,
      oldSourceIDs: [...oldSourceIDs], exclusiveSourceOwnership: rows.every(p => oldSourceIDs.has(p.sourceId)),
      sourceIDsSharedByNewPackets: snapshot.packets.filter(p => !oldPackets.has(p.id) && oldSourceIDs.has(p.sourceId)).map(p => p.id),
      valid: missing.length === 0 && alteredMass.length === 0 && near(mass, 20.35, 2e-9) };
  }
  async function capture(id, { hot, field = true, phaseEvent, phase, toggle = true, expectedMass } = {}) {
    if (toggle) a.setFireworks({ resolvedSmokeLighting: field });
    const settling = await settle(id), before = clone(a.photometry()), snapshotBefore = clone(a.smokeSnapshot()), image = a.screenshot(), s = clone(a.state), p = clone(a.photometry()),
      decoded = await decodePNG(image), stats = pngStats(decoded), ranges = await a.inspectRadiance(), after = clone(a.photometry()), smoke = clone(a.smoke()), snapshot = clone(a.smokeSnapshot()),
      fireworks = clone(a.fireworks()), clusters = clone(a.fireworkClusters()), status = fieldState(a, smoke), audio = clone(audioState(a));
    const row = { id, time: s.time, phaseEvent, burstPhaseSeconds: s.time - report.launches[phaseEvent].burstTime, camera: s.camera, target: s.target, UTC: a.celestial().utcMs,
      photometry: p, beforePhotometry: before, afterPhotometry: after, range: ranges, rawRanges: rawRanges(ranges, p.storageEV), smoke, snapshot, fireworks, clusters,
      fieldStatus: status, lens: s.lens, quality: quality(s), imageStats: stats, audio, settling, oldMatter: oldMatter(snapshot, smoke) };
    report.images[id] = image; report.captures.push(row);
    check(id + ': exact phase absoluteC UTC and locked actual pose', s.parameters.paused && near(row.burstPhaseSeconds, phase) && Object.is(p.cameraEV, 16.5) && Object.is(a.diagnosticCameraEV, 16.5) &&
      row.UTC === fixedUTC && distance(s.camera, fixedPose.camera) < 1e-8 && distance(s.target, fixedPose.target) < 1e-8, { time: s.time, phase: row.burstPhaseSeconds, C: p.cameraEV, P: p.storageEV, lock: a.diagnosticCameraEV });
    check(id + ': screenshot/range cannot advance matter or physical state', exact(snapshotBefore, snapshot) && near(s.time, a.state.time), { revisionBefore: snapshotBefore.revision, revisionAfter: snapshot.revision });
    check(id + ': complete real main mirror HDR finite nonnegative safe', safeRanges(ranges) && p.storedBound <= p.safeMaximum * (1 + 1e-12) && ['opaque', 'composed', 'reflection'].every(k => ranges[k].globalMax <= p.safeMaximum * (1 + 1e-4) && ranges[k].globalMax < 65504),
      { storedBound: p.storedBound, safeMaximum: p.safeMaximum, maxima: Object.fromEntries(['opaque', 'composed', 'reflection'].map(k => [k, ranges[k].globalMax])) });
    check(id + ': P remains independently safe and display compensated once', [before.storageEV, ranges.storageEV, ranges.photometry.storageEV, after.storageEV].every(v => near(v, p.storageEV, 1e-10)) &&
      near(p.outputExposureScale / (.76 * 2 ** (p.cameraEV - p.storageEV)), 1, 1e-12), { P: p.storageEV, C: p.cameraEV, outputExposureScale: p.outputExposureScale });
    check(id + ': actual field branch reports ready source count or explicit disabled', field ? readyField(status, snapshot.packets.length, hot) : disabledField(status), { hot, field, status });
    check(id + ': fixed production quality weather and original audio settings', exact(row.quality, fixedQuality) && exact(s.parameters.weather, saved.weather) && exact(audio.settings, report.audioBefore.settings) && audio.enabled === report.audioBefore.enabled,
      { quality: row.quality, audio });
    check(id + ': only the declared fixed-scale timed3 events and frozen source preferences', fireworks.settings.type === 'ring' && fireworks.settings.intensityScale === 4 && fireworks.settings.autoLaunch === false && fireworks.settings.autoFrame === false &&
      fireworks.settings.persistentSmoke === true && fireworks.settings.cloudIllumination === saved.fireworks.cloudIllumination && fireworks.activeEvents.every(e =>
        Object.values(report.launches).some(l => l.id === e.id) && e.type === 'ring' && e.intensityScale === 4 && e.actualStarCount === 120 && e.heightInfo?.flightInfo?.model === 'timed-reference' && e.heightInfo.flightInfo.burstDelaySeconds === 3),
      { activeEvents: fireworks.activeEvents, settings: fireworks.settings });
    check(id + ': no density merge no reset no hidden material retirement', smoke.state.merges === 0 && smoke.state.forcedMerges === 0 && smoke.clears === setupClearCount && smoke.events.parameters.emissionProfile === 'ring-uniform-burn-v1' &&
      snapshot.dispersion?.model === 'taylor' && snapshot.dispersion.lagrangianSeconds === 10 && snapshot.ledger.deposited === 0 && snapshot.ledger.escaped === 0, { merges: smoke.state.merges, forcedMerges: smoke.state.forcedMerges, clears: smoke.clears, ledger: snapshot.ledger, sourceProfile: smoke.events.parameters.emissionProfile });
    check(id + ': forced PNG is native size nonblank not discarded black buffer', stats.nonblank && stats.width === s.lens.outputWidth && stats.height === s.lens.outputHeight, stats);
    if (expectedMass !== undefined) check(id + ': cold full authored material budget has actually arrived', near(snapshot.ledger.airborne, expectedMass, 2e-9) && near(snapshot.ledger.emitted, expectedMass, 2e-9) && snapshot.pendingEmissions === 0 &&
      smoke.events.pendingPlans === 0 && near(smoke.events.reservedArea, 0, 1e-12), { expectedMass, ledger: snapshot.ledger, pendingPlans: smoke.events.pendingPlans, reservedArea: smoke.events.reservedArea, packets: snapshot.packets.length });
    if (oldPackets) check(id + ': every oldA packet ID and mass retained without merge attribution', row.oldMatter?.established && row.oldMatter.valid && row.oldMatter.exclusiveSourceOwnership && row.oldMatter.sourceIDsSharedByNewPackets.length === 0, row.oldMatter);
    return { row, decoded };
  }
  try {
    for (const key of ['setDiagnosticCameraEV', 'setSmokeReviewProfile', 'pauseAtPhysicalTime', 'smokeSnapshot', 'smoke', 'photometry', 'fireworkClusters', 'setFireworks', 'screenshot', 'inspectRadiance', 'clearSmoke']) if (typeof a[key] !== 'function') throw new Error('Reload frozen main with public QA API: ' + key);
    if (saved.diagnosticCameraEV !== null && !Number.isFinite(saved.diagnosticCameraEV)) throw new Error('Loaded diagnosticCameraEV getter unavailable');
    report.sourceSHA256Before = await sourceHashes(); report.audioBefore = clone(audioState(a));
    a.setDirector({ mode: 'off' }); a.setFireworks({ autoLaunch: false, autoFrame: false, resolvedSmokeLighting: false });
    if (Math.abs(initial.parameters.wind) > 1e-12) throw new Error('Caller must set native wind target0 before this fixture; helper never forges wind');
    a.pause(false); const windTime = a.state.time, windWall = performance.now();
    while (norm(a.smokeSnapshot().currentWind) >= 1e-4) { if (a.state.time - windTime > 20 || performance.now() - windWall > 45000 || performance.now() > deadline) throw new Error('Native effective wind did not settle within bounds'); await delay(80); }
    report.wind = { target: initial.parameters.wind, actual: clone(a.smokeSnapshot().currentWind), waitedPhysicalSeconds: a.state.time - windTime };
    const retireTime = a.state.time, retireWall = performance.now();
    while (a.fireworks().active || a.fireworks().queued) { if (a.state.time - retireTime > 90 || performance.now() - retireWall > 150000 || performance.now() > deadline) throw new Error('Prior events failed to retire naturally; none was deleted'); await delay(80); }
    a.pause(true); report.priorRetirement = { physicalSeconds: a.state.time - retireTime, physicalTime: a.state.time };
    a.clearSmoke(); report.setupClears++; report.installedProfile = clone(a.setSmokeReviewProfile('ring-burn')); profileInstalled = true; setupClearCount = a.smoke().clears;
    check('fresh QA host installed only after old events retired and explicit setup clear', !a.fireworks().active && !a.fireworks().queued && a.smokeSnapshot().packets.length === 0 && report.setupClears === 1 && a.smoke().events.parameters.emissionProfile === 'ring-uniform-burn-v1');
    const clock = a.celestial();
    if (!(clock.mode === 'astronomical' && clock.sun.altitudeDeg < -6 && clock.moon.altitudeDeg > 0)) { await a.timePreset('moon'); report.appliedMoonPreset = true; }
    await a.setTime({ running: false }); fixedUTC = a.celestial().utcMs;
    a.setLens({ focal: 28, exposure: 0, dof: false, opticalFlare: false, automatic: false });
    a.setDiagnosticCameraEV(16.5); locked = true;
    a.setCamera([-48, 12, -40], [0, 2.5, 0]);
    a.setFireworks({ type: 'ring', autoDirection: true, elevation: 80, autoFrame: true, autoLaunch: false, persistentSmoke: true, resolvedSmokeLighting: true, intensityScale: 4 });
    report.launches = {};
    report.launchRequests = { A: { type: 'ring', seed: 42, smileyLayout: 'reference', intensityScale: 4, flightModel: 'timed-reference', burstDelaySeconds: 3 },
      B: { type: 'ring', seed: 43, smileyLayout: 'reference', intensityScale: 4, flightModel: 'timed-reference', burstDelaySeconds: 3, ...(secondPalette ? { palette: secondPalette } : {}) } };
    report.launchCountBeforeA = a.fireworks().launches;
    const startA = a.state.time; report.launches.A = clone(a.launchFirework(report.launchRequests.A));
    if (!report.launches.A.accepted || report.launches.A.queued) throw new Error('A was not immediately accepted');
    check('A actual accepted timed3 ring keeps authored scale4', report.launches.A.type === 'ring' && report.launches.A.intensityScale === 4 && near(report.launches.A.burstTime - startA, 3), report.launches.A);
    await advanceTo(report.launches.A.burstTime + 1.1, 'A_hot'); await settle('actual_autoFrame_fit');
    fixedPose = { camera: [...a.state.camera], target: [...a.state.target] }; a.setFireworks({ autoFrame: false }); a.setCamera(fixedPose.camera, fixedPose.target);
    await settle('lock_actual_fit'); fixedQuality = quality(a.state); report.fixedPose = clone(fixedPose); report.fixedQuality = clone(fixedQuality); report.UTC = fixedUTC;
    await capture('A_hot', { hot: true, phaseEvent: 'A', phase: 1.1 });
    await advanceTo(report.launches.A.burstTime + 6, 'A_cold');
    const coldA = await capture('A_cold', { hot: false, phaseEvent: 'A', phase: 6, expectedMass: 20.35 });
    if (coldA.row.smoke.state.merges === 0 && coldA.row.smoke.state.forcedMerges === 0) {
      oldPackets = new Map(coldA.row.snapshot.packets.map(p => [p.id, p.mass])); oldSourceIDs = new Set(coldA.row.snapshot.packets.map(p => p.sourceId));
      check('coldA packet lineage is unique and usable before B', oldPackets.size === coldA.row.snapshot.packets.length && !oldSourceIDs.has(null), { count: oldPackets.size, sourceIDs: [...oldSourceIDs] });
    } else { check('oldA attribution established only when merge0', false, { status: 'NOT_ESTABLISHED', merges: coldA.row.smoke.state.merges, forcedMerges: coldA.row.smoke.state.forcedMerges }); throw new Error('Cannot attest oldA IDs after merge; no manufactured attribution fallback'); }
    report.oldA = { packetIDs: [...oldPackets.keys()], packetMasses: [...oldPackets], sourceIDs: [...oldSourceIDs], mass: coldA.row.snapshot.ledger.airborne, snapshot: coldA.row.snapshot };
    const beforeB = clone(a.smokeSnapshot()), startB = a.state.time, launchCountBefore = a.fireworks().launches;
    report.launches.B = clone(a.launchFirework(report.launchRequests.B));
    if (!report.launches.B.accepted || report.launches.B.queued) throw new Error('B was not accepted in the second real slot');
    check('B same-clock launch keeps existing smoke before any physical advance', exact(beforeB, a.smokeSnapshot()) && a.fireworks().launches === launchCountBefore + 1 && report.launches.B.id !== report.launches.A.id && report.launches.B.intensityScale === 4 && near(report.launches.B.burstTime - startB, 3), report.launches.B);
    await advanceTo(report.launches.B.burstTime + hotPhase, 'B_hot');
    const off = await capture('B_hot_field_off', { hot: true, field: false, phaseEvent: 'B', phase: hotPhase }),
      repeat = await capture('B_hot_field_off_repeat', { hot: true, field: false, phaseEvent: 'B', phase: hotPhase, toggle: false }),
      on = await capture('B_hot_field_on', { hot: true, field: true, phaseEvent: 'B', phase: hotPhase });
    check('B hot off/repeat/on keep entire shared snapshot source UTC camera actualC identical', [repeat.row, on.row].every(r => exact(r.snapshot, off.row.snapshot) && exact(r.clusters, off.row.clusters) && r.UTC === off.row.UTC && exact(r.camera, off.row.camera) && exact(r.target, off.row.target) && Object.is(r.photometry.cameraEV, off.row.photometry.cameraEV)),
      { oldAMass: [off.row.oldMatter?.mass, repeat.row.oldMatter?.mass, on.row.oldMatter?.mass], totalMass: [off.row.snapshot.ledger.airborne, repeat.row.snapshot.ledger.airborne, on.row.snapshot.ledger.airborne], P: [off.row.photometry.storageEV, repeat.row.photometry.storageEV, on.row.photometry.storageEV] });
    report.sameStateLightingComparison = { from: off.row.id, to: on.row.id, difference: pngDifference(off.decoded, on.decoded), offRepeatFloor: pngDifference(off.decoded, repeat.decoded),
      observationOnly: true, oldSmokeIsolatedProof: false, sourceToggle2x2: false, modelChange: 'Proxy RMS pyro lighting versus actual-source Gaussian SH1 field; all shared old/new matter remains.',
      limitation: 'An image delta can arise in B own smoke as well as A smoke. This continuous integration witness does not replace the independent resolved-field GPU composition oracle or establish linear PNG addition.' };
    await advanceTo(report.launches.B.burstTime + 6, 'B_cold');
    const coldB = await capture('B_cold', { hot: false, phaseEvent: 'B', phase: 6, expectedMass: 40.7 });
    const oldIDs = new Set(report.oldA.packetIDs), newPackets = coldB.row.snapshot.packets.filter(p => !oldIDs.has(p.id));
    check('newB matter is additional20_35 while oldA remains20_35', coldB.row.oldMatter?.valid && near(newPackets.reduce((sum, p) => sum + p.mass, 0), 20.35, 2e-9) && near(coldB.row.snapshot.ledger.airborne, 40.7, 2e-9),
      { oldMass: coldB.row.oldMatter?.mass, newMass: newPackets.reduce((sum, p) => sum + p.mass, 0), oldCount: oldIDs.size, newCount: newPackets.length, total: coldB.row.snapshot.ledger.airborne });
    report.finalMatter = { time: a.state.time, snapshot: clone(a.smokeSnapshot()), diagnostics: clone(a.smoke()) }; report.audioAfter = clone(audioState(a));
    report.sourceSHA256After = await sourceHashes();
    check('all observed integration/capture phases held absoluteC16_5 not UIEV', report.exposureSamples.length > 0 && report.exposureSamples.every(s => Object.is(s.C, 16.5) && Object.is(s.lock, 16.5)),
      { observedFrames: report.exposureSamples.length, observedPhysicalRange: [report.exposureSamples[0]?.time, report.exposureSamples.at(-1)?.time], scope: 'Public readings after observed rAFs; no claim of an independent per-draw GPU exposure tracer.' });
    check('exactly two real launch calls no extra helper audio/gain/requeue', a.fireworks().launches === report.launchCountBeforeA + 2 && a.fireworks().launches === launchCountBefore + 1 && exact(report.audioBefore.settings, report.audioAfter.settings) && report.audioBefore.enabled === report.audioAfter.enabled,
      { A: report.launches.A.id, B: report.launches.B.id, actualNewLaunches: a.fireworks().launches - report.launchCountBeforeA, audioBefore: report.audioBefore, audioAfter: report.audioAfter, scope: 'Normal actual event audio remains enabled if originally enabled; no synthetic replay or subjective listening/SPL claim.' });
    check('served runtime source bytes unchanged during continuous scenario', exact(report.sourceSHA256Before, report.sourceSHA256After), { caveat: 'Fetched served bytes do not establish arbitrary older ESM cache identity; caller must reload the frozen source first.' });
    check('no asynchronous frame errors hidden behind captures', report.runtimeErrors.length === 0, { errors: report.runtimeErrors });
  } catch (e) {
    report.failure = { message: String(e.message ?? e), stack: String(e.stack ?? '') };
    check('bounded continuous two-event scenario completes', false, report.failure);
  } finally {
    a.pause(true);
    const beforeRestore = { physicalTime: a.state.time, snapshot: clone(a.smokeSnapshot()), clears: a.smoke().clears };
    if (restorePreferences) {
      const attempts = [];
      async function restore(name, operation) { try { await operation(); attempts.push({ name, passed: true }); } catch (e) { attempts.push({ name, passed: false, error: String(e.stack ?? e) }); } }
      await restore('disable director for restoration', () => a.setDirector({ mode: 'off' }));
      await restore('lens preferences', () => a.setLens(saved.lens));
      await restore('night preferences', () => a.setNight(saved.night));
      await restore('UTC/location preferences (not physical time)', () => a.setTime({ utcMs: saved.clock.utcMs, ...saved.clock.observer, mode: saved.clock.mode, rate: saved.clock.rate,
        running: saved.clock.running, timeZoneOffsetMinutes: saved.clock.timeZoneOffsetMinutes, refraction: saved.clock.refraction }));
      if (saved.clock.mode === 'artistic') await restore('artistic sun preferences', () => a.setSun(saved.sun));
      if (!exact(a.state.parameters.weather, saved.weather)) await restore('weather preferences', () => a.setWeather(saved.weather));
      await restore('camera preferences', () => a.setCamera(saved.camera, saved.target));
      await restore('fireworks preferences', () => a.setFireworks(saved.fireworks));
      await restore('render scale', () => a.setRenderScale(saved.renderScale));
      await restore('absolute QA exposure lock', () => a.setDiagnosticCameraEV(saved.diagnosticCameraEV));
      if (saved.director.mode !== 'off') await restore('director mode (private old phase unavailable)', () => a.setDirector(saved.director));
      report.restoration.attempts = attempts; report.restoration.completed = attempts.every(x => x.passed);
      check('ordinary preferences and QA exposure lock restored', report.restoration.completed && exact(a.state.parameters.lens, saved.lens) && exact(a.fireworks().settings, saved.fireworks) &&
        exact(a.state.parameters.weather, saved.weather) && a.celestial().utcMs === saved.clock.utcMs && exact(a.night().settings, saved.night) &&
        Object.is(a.diagnosticCameraEV, saved.diagnosticCameraEV) && distance(a.state.camera, saved.camera) < 1e-8 && distance(a.state.target, saved.target) < 1e-8, report.restoration);
    } else {
      // Even when leaving the review preferences visible, the QA-only absolute
      // exposure override must never leak beyond this call.
      try { a.setDiagnosticCameraEV(saved.diagnosticCameraEV); report.restoration.exposureLockRestored = Object.is(a.diagnosticCameraEV, saved.diagnosticCameraEV); check('QA-only absolute exposure override restored even without preference restoration', report.restoration.exposureLockRestored, { saved: saved.diagnosticCameraEV, actual: a.diagnosticCameraEV }); }
      catch (e) { report.restoration.error = String(e.stack ?? e); check('QA exposure lock restore', false, report.restoration); }
    }
    report.restoration.physicalTime = a.state.time;
    report.restoration.profileLeftInstalled = profileInstalled ? 'ring-burn (QA host remains until explicit clear+replacement or reload)' : null;
    report.restoration.matterNotRewoundOrCleared = exact(beforeRestore.snapshot, a.smokeSnapshot()) && near(beforeRestore.physicalTime, a.state.time) && beforeRestore.clears === a.smoke().clears;
    check('finally does not clear or rewind retained two-event matter', report.restoration.matterNotRewoundOrCleared, { before: beforeRestore.physicalTime, after: a.state.time, clears: a.smoke().clears, profileLeftInstalled: report.restoration.profileLeftInstalled });
    a.pause(leftPaused ? true : saved.paused);
    report.restoration.finalPaused = a.state.parameters.paused; report.restoration.remainingActive = a.fireworks().active; report.restoration.remainingQueued = a.fireworks().queued;
    window.removeEventListener('error', error); window.removeEventListener('unhandledrejection', rejection);
  }
  report.total = report.checks.length; report.passedCount = report.checks.filter(c => c.passed).length;
  report.passed = report.technicalPassed = report.checks.every(c => c.passed) && report.captures.length === 6;
  report.limits = ['No absolute kg/cd/nit calibration or photographic/subjective audio acceptance. Fixed reference I4 is an authored source scale, not a measured shell.',
    'One explicit setup clear before A and natural old-event retirement are irreversible QA actions. No clear between A/B or at the end. Preferences restore cannot recover earlier matter/director phase or the replaced QA host.',
    'Shared old/new smoke is real production state; IDs attest old mass only while merges0. On/off PNG delta is not old-smoke-only proof, not source-A/source-B 2x2 isolation, and not linear display-energy addition.',
    'Field cold-source count0 plus nonzero persistent matter tests source/density decoupling. Cold PNG darkness is not a mass-removal oracle.',
    'Actual main/mirror extrema/counts attest finite headroom, not per-pixel path correctness or equal energy. Natural safe P may vary and is separately output-compensated.',
    'Every new exact pause explicitly reapplies the sameC16.5 QA lock to recompute the current complete safe budget because dt0 cannot raise P. Before/after bounds/P/C/source/density are reported; no direct P write or fictitious physical/adaptation step is used.',
    'Main field/shader finite-Gaussian/SH1, source-path extinction and overlap approximations retain their existing limits. No new cloud/GI/air source model is enabled by this helper.',
    'Forced screenshot explicitly renders immediately before PNG export; capture overhead/settle waits are not performance measurements. PNGs are SDR despite a native HDR presentation path.',
    'The call launches exactly two physical events, so normal original event audio may play. It neither reschedules audio for lighting modes nor changes source, gain, distance or delay; actual listening is outside this report.',
    'The first actual autoFrame uses production body bounds. Its accepted pose is then frozen for every phase; B does not reframe or billboard the smiley.'];
  return report;
}
