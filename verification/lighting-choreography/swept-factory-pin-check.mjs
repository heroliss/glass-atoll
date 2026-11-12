// CPU-only production factory A/B: world sweep upload rejection preserves light ledgers.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import * as THREE from '../../vendor/three.module.js';
import { createFireworks, classifyFireworkSourceVisibility, classifyFireworkSweepViewport } from '../../fireworks.js';
import { createAtollAirSurface } from '../../firework-surface.js';

const root = new URL('../../', import.meta.url), read = path => readFileSync(new URL(path, root));
const sha256 = value => createHash('sha256').update(value).digest('hex');
const jsonSHA256 = value => sha256(JSON.stringify(value));
const scriptPath = 'verification/lighting-choreography/swept-factory-pin-check.mjs';
const basisPaths = ['verification/lighting-choreography/budget-dense-scan.mjs', 'verification/lighting-choreography/budget-source-pin-check.mjs'];
const paths = new Set();
function collect(path) {
  if (paths.has(path)) return;
  paths.add(path);
  for (const match of read(path).toString('utf8').matchAll(/(?:from\s*|import\s*)['"](\.{1,2}\/[^'"]+)['"]/g)) {
    const url = new URL(match[1], new URL(path, root));
    if (url.href.startsWith(root.href)) collect(decodeURIComponent(url.href.slice(root.href.length)));
  }
}
for (const path of ['fireworks.js', 'firework-surface.js', 'vendor/three.module.js']) collect(path);
for (const path of [scriptPath, ...basisPaths, 'main.js']) paths.add(path);
const pins = Object.fromEntries([...paths].sort().map(path => [path, { sha256: sha256(read(path)), bytes: read(path).length }]));
const terrainSource = read('main.js').toString('utf8').match(/export function terrainHeight\(x,z\)\{[\s\S]+?\n\}/)?.[0];
assert(terrainSource, 'Use the actual standalone production terrainHeight');
const terrainHeight = new Function(terrainSource.replace('export ', '') + ';return terrainHeight;')();
const factoryOptions = {
  origin: [29, 0, 7], seed: 14271, clusterModel: 'moments', trailIntegration: 'adaptive',
  sourceVisibility: 'conservative', simulationOptions: { referenceBrightnessGain: 64, maxActive: 32 },
};
const configuration = {
  type: 'display-flower', effectProfile: 'legacy', autoLaunch: false, autoFrame: false,
  autoDirection: false, azimuth: 110, elevation: 80, launchSpreadDegrees: 0,
  burstTiltDegrees: 0, burstRollDegrees: 0, starDragModel: 'bounded-descent',
};
const launchOptions = { type: 'display-flower', seed: 619, launchSpreadDegrees: 0, burstOrientation: { yawDegrees: 0, tiltDegrees: 0, rollDegrees: 0 } };
const initialTime = .055, windVector = [1.6848, 0, .6336];
const phases = [1.7, 1.9, 2.085, 2.11, 2.115, 2.2, 2.335, 2.3764225708313482, 2.7020225708328347, 3.15];
assert(phases.every((phase, i) => !i || phase > phases[i - 1]));
const camera = new THREE.PerspectiveCamera(40, 4 / 3, .15, 120000);
camera.filmGauge = 36; camera.setFocalLength(24); camera.position.set(-65, 30, 54); camera.lookAt(2, 3, 0); camera.updateMatrixWorld();
const optics = { width: 960, height: 720, focalMm: 24, aperture: 8, focusMetres: camera.position.distanceTo(new THREE.Vector3(2, 3, 0)), sensorHeightMm: camera.getFilmHeight(), dof: false, shutterSeconds: 1 / 120, firelightSigmaPixels: .42, kernelBudgetFloat32: true };
const checks = [], rows = [];
function check(name, operation) {
  try { const detail = operation(); checks.push({ name, passed: true, ...(detail === undefined ? {} : { detail }) }); }
  catch (error) { checks.push({ name, passed: false, error: String(error.stack).slice(0, 7000) }); }
}
function ledgerSnapshot(fw) {
  const ledger = fw.getEmissionLedger();
  const { data, ...metadata } = ledger;
  return { ...metadata, activeData: Array.from(data.subarray(0, ledger.count * ledger.stride)), fullBufferSHA256: sha256(Buffer.from(data.buffer, data.byteOffset, data.byteLength)) };
}
function physicalSummary(fw) {
  const d = fw.diagnostics();
  return { time: d.time, records: d.records, active: d.active, quality: d.quality, opticalCapacity: d.opticalCapacity, physicalLedgerCapacity: d.physicalLedgerCapacity };
}
function prepare(fw, mode) {
  fw.setSourceVisibility(mode);
  const handle = fw.prepareSourceView({ camera, target: { width: optics.width, height: optics.height }, optics, legacySmoke: false });
  try {
    const info = fw.getPreparedSourceViewInfo(handle);
    assert.equal(info.sourceVisibility, mode);
    assert.equal(info.legacySmoke, false);
    assert.equal(info.requestVersionAllocated, false);
    assert.equal(info.sourceVersion, null);
    assert.equal(info.transmissionRequested, false);
    return { count: info.count, recordsGeneration: info.recordsGeneration, time: info.time };
  } finally {
    assert.equal(fw.discardPreparedSourceView(handle), true);
    assert.equal(fw.discardPreparedSourceView(handle), false);
    assert.throws(() => fw.getPreparedSourceViewInfo(handle));
  }
}
const factories = Object.fromEntries(['original', 'swept'].map(mode => [mode, createFireworks(THREE, { ...factoryOptions, terrainHeight, airSurface: createAtollAirSurface(terrainHeight), sweptSourceVisibility: mode === 'swept' })]));
const launches = {};
try {
  for (const [mode, fw] of Object.entries(factories)) {
    fw.setQuality({ trailSegments: 8 }); fw.configure(configuration); fw.update({ time: initialTime, windVector });
    launches[mode] = fw.launch(launchOptions); assert(launches[mode].accepted);
  }
  check('Both unmodified production factories accept the same deterministic launch', () => assert.deepEqual(launches.swept, launches.original));
  for (const phase of phases) check(`Phase ${phase}: full callbacks, physical state, emission ledger and prepared upload rows`, () => {
    for (const fw of Object.values(factories)) fw.update({ time: launches.original.burstTime + phase, windVector });
    const physicalBefore = Object.fromEntries(Object.entries(factories).map(([mode, fw]) => [mode, physicalSummary(fw)]));
    const ledgerBefore = Object.fromEntries(Object.entries(factories).map(([mode, fw]) => [mode, ledgerSnapshot(fw)]));
    assert.deepEqual(physicalBefore.swept, physicalBefore.original);
    assert.deepEqual(ledgerBefore.swept, ledgerBefore.original, 'Complete ledger metadata and every active Float32 row are identical');
    const traces = { original: [], swept: [] }, bounds = {};
    for (const [mode, fw] of Object.entries(factories)) bounds[mode] = fw.getRadianceBound({ camera, optics, onSourceBound: row => traces[mode].push(row) });
    assert.deepEqual(traces.swept, traces.original, 'Every field of every callback is identical');
    assert.equal(bounds.swept.globalFiniteSurfaceCeiling, bounds.original.globalFiniteSurfaceCeiling);
    assert(bounds.swept.maximumRawRadiance <= bounds.original.maximumRawRadiance);
    assert.equal(bounds.original.worldSweepOutsideBudgetSources ?? 0, 0);

    const classified = traces.original.map(row => ({ source: row.source, visibility: classifyFireworkSourceVisibility(row.source, camera, optics), sweep: classifyFireworkSweepViewport(row.source, camera, optics) }));
    const reasonCounts = {};
    for (const { visibility } of classified) reasonCounts[visibility.reason] = (reasonCounts[visibility.reason] ?? 0) + 1;
    const expectedSweep = classified.filter(row => row.visibility.reason === 'conservative-retain' && row.sweep.outside);
    const depthCulled = reasonCounts['homogeneous-depth'] ?? 0, quadCulled = reasonCounts['complete-quad-outside'] ?? 0;
    const prepared = {};
    for (const [mode, fw] of Object.entries(factories)) prepared[mode] = Object.fromEntries(['none', 'depth', 'conservative'].map(visibility => [visibility, prepare(fw, visibility)]));
    assert.deepEqual(prepared.swept.none, prepared.original.none);
    assert.deepEqual(prepared.swept.depth, prepared.original.depth);
    assert.equal(prepared.original.none.count, traces.original.length);
    assert.equal(prepared.original.depth.count, traces.original.length - depthCulled);
    assert.equal(prepared.original.conservative.count, traces.original.length - depthCulled - quadCulled);
    assert.equal(prepared.original.conservative.count - prepared.swept.conservative.count, expectedSweep.length, 'Actual prepared upload delta equals only the independent public sweep classifications on retained rows');
    assert.equal(prepared.swept.conservative.recordsGeneration, prepared.original.conservative.recordsGeneration);
    for (const [mode, fw] of Object.entries(factories)) {
      assert.deepEqual(physicalSummary(fw), physicalBefore[mode], 'Queries/prepared uploads preserve physical state');
      assert.deepEqual(ledgerSnapshot(fw), ledgerBefore[mode], 'Queries/prepared uploads preserve the full emission ledger and version');
    }
    const row = { phase, time: launches.original.burstTime + phase, physical: physicalBefore.original, callbacks: traces.original.length, completeCallbacksExactlyEqual: true, traceSHA256: { original: jsonSHA256(traces.original), swept: jsonSHA256(traces.swept) }, ledgerExactlyEqual: true, ledgerSHA256: { original: jsonSHA256(ledgerBefore.original), swept: jsonSHA256(ledgerBefore.swept) }, ledgerCount: ledgerBefore.original.count, ledgerVersion: ledgerBefore.original.version, bounds, reasonCounts, prepared, expectedSweepCount: expectedSweep.length, expectedSweepSources: expectedSweep.map(({ source }) => ({ index: source.index, bodyId: source.bodyId, kind: source.kind, sourceSHA256: jsonSHA256(source) })) };
    rows.push(row);
    return { callbacks: row.callbacks, ledgerCount: row.ledgerCount, originalBound: bounds.original.maximumRawRadiance, sweptBound: bounds.swept.maximumRawRadiance, worldSweepOutsideBudgetSources: bounds.swept.worldSweepOutsideBudgetSources, expectedUploadRejections: expectedSweep.length };
  });
  check('Both exact historical residual-spike phases exercise upload and budget sweep rejection', () => {
    for (const phase of [2.085, 2.3764225708313482]) {
      const row = rows.find(row => row.phase === phase); assert(row);
      assert(row.expectedSweepCount > 0, 'Exact phase exercises real prepared upload rejection');
      assert(row.bounds.swept.worldSweepOutsideBudgetSources > 0, 'Exact phase exercises the budget sweep branch');
      assert(row.bounds.original.maximumRawRadiance > 100, 'Fixed original factory reproduces the old spike');
      assert(row.bounds.swept.maximumRawRadiance < 1, 'Swept factory removes the false spike');
    }
    return { phases: [2.085, 2.3764225708313482] };
  });
} finally { for (const fw of Object.values(factories)) fw.dispose(); }
check('All transitive production sources and fixture inputs remain pinned throughout the run', () => {
  for (const [path, pin] of Object.entries(pins)) assert.equal(sha256(read(path)), pin.sha256, path);
  return { files: Object.keys(pins).length };
});
const passed = checks.every(check => check.passed);
const report = { schema: 'glass-atoll.swept-factory-pin-check.v1', status: passed ? 'passed' : 'failed', passed, scope: 'CPU-only direct production factories; no modified source, browser, GPU, actual raster pixels or legacy shader equivalence claim', provenance: { factoryOptions, configurations: configuration, launchOptions, initialTime, windVector, phases, launches, quality: { trailSegments: 8 }, terrainFunctionSHA256: sha256(terrainSource), camera: { position: camera.position.toArray(), target: [2, 3, 0], filmGauge: camera.filmGauge, focalLength: camera.getFocalLength(), near: camera.near, far: camera.far, projectionMatrix: camera.projectionMatrix.toArray() }, optics, basisPaths, node: process.version, platform: process.platform, script: fileURLToPath(import.meta.url) }, checks, rows, pins };
writeFileSync(new URL('./swept-factory-pin-check.json', import.meta.url), JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify({ status: report.status, checks, rows: rows.map(({ phase, callbacks, ledgerCount, prepared, expectedSweepCount, bounds }) => ({ phase, callbacks, ledgerCount, preparedOriginal: prepared.original.conservative.count, preparedSwept: prepared.swept.conservative.count, expectedSweepCount, originalBound: bounds.original.maximumRawRadiance, sweptBound: bounds.swept.maximumRawRadiance, sweepBudget: bounds.swept.worldSweepOutsideBudgetSources })), productionSHA256: pins['fireworks.js'].sha256 }));
if (!passed) process.exitCode = 1;
