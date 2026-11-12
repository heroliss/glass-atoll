// Targeted CPU checks for the opt-in storage-budget gate. No renderer or GL.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import * as THREE from '../../vendor/three.module.js';
import { classifyFireworkSourceVisibility, createFireworks } from '../../fireworks.js';
import { createAtollAirSurface } from '../../firework-surface.js';

const root = new URL('../../', import.meta.url);
const read = path => readFileSync(new URL(path, root));
const sha256 = value => createHash('sha256').update(value).digest('hex');
const jsonSHA256 = value => sha256(JSON.stringify(value));
const scriptPath = 'verification/lighting-choreography/budget-source-pin-check.mjs';
const fixturePath = 'verification/lighting-choreography/kernel-viewport-independent-check.mjs';
const historicalPath = 'verification/lighting-choreography/before-viewport-budget/spike-before-quad.json';
const sourcePaths = new Set();
function collectModule(path) {
  if (sourcePaths.has(path)) return;
  sourcePaths.add(path);
  const source = read(path).toString('utf8');
  for (const match of source.matchAll(/(?:from\s*|import\s*)['"](\.{1,2}\/[^'"]+)['"]/g)) {
    const url = new URL(match[1], new URL(path, root));
    if (url.href.startsWith(root.href)) collectModule(decodeURIComponent(url.href.slice(root.href.length)));
  }
}
collectModule('fireworks.js');
collectModule('firework-surface.js');
collectModule('vendor/three.module.js');
for (const path of [scriptPath, fixturePath, historicalPath, 'main.js']) sourcePaths.add(path);
const pins = Object.fromEntries([...sourcePaths].sort().map(path => [path, { sha256: sha256(read(path)), bytes: read(path).length }]));

const terrainSource = read('main.js').toString('utf8').match(/export function terrainHeight\(x,z\)\{[\s\S]+?\n\}/)?.[0];
assert(terrainSource, 'Read the actual standalone production terrainHeight function');
const terrainHeight = new Function(terrainSource.replace('export ', '') + ';return terrainHeight;')();
const factoryOptions = {
  origin: [29, 0, 7], seed: 14271, trailIntegration: 'adaptive',
  simulationOptions: { referenceBrightnessGain: 64, maxActive: 32 },
};
const configuration = {
  type: 'display-flower', effectProfile: 'legacy', autoLaunch: false, autoFrame: false,
  autoDirection: false, azimuth: 110, elevation: 80, launchSpreadDegrees: 0,
  burstTiltDegrees: 0, burstRollDegrees: 0,
};
const launchOptions = {
  type: 'display-flower', seed: 619, launchSpreadDegrees: 0,
  burstOrientation: { yawDegrees: 0, tiltDegrees: 0, rollDegrees: 0 },
};
const windVector = [1.6848, 0, .6336], phases = [1.7, 1.9, 2.2, 2.339122570832462, 2.7020225708328347, 3.1];
assert(phases.every((phase, i) => i === 0 || phase > phases[i - 1]), 'Physical updates follow strictly increasing phase time');
const camera = new THREE.PerspectiveCamera(50, 4 / 3, .15, 120000);
camera.filmGauge = 36;
camera.setFocalLength(24);
camera.position.set(-65, 30, 54);
camera.lookAt(2, 3, 0);
camera.updateMatrixWorld();
const optics = {
  width: 960, height: 720, focalMm: 24, aperture: 8,
  focusMetres: camera.position.distanceTo(new THREE.Vector3(2, 3, 0)),
  sensorHeightMm: camera.getFilmHeight(), dof: false,
  shutterSeconds: 1 / 120, firelightSigmaPixels: .42,
};
const checks = [], rows = [], historicalHeads = [];
function check(name, operation) {
  try { const detail = operation(); checks.push({ name, passed: true, ...(detail === undefined ? {} : { detail }) }); }
  catch (error) { checks.push({ name, passed: false, error: String(error.stack ?? error).slice(0, 5000) }); }
}
const fw = createFireworks(THREE, { ...factoryOptions, terrainHeight, airSurface: createAtollAirSurface(terrainHeight) });
let launch;
try {
  fw.setQuality({ trailSegments: 8 });
  fw.configure(configuration);
  fw.update({ time: 0, windVector });
  launch = fw.launch(launchOptions);
  assert(launch.accepted, 'The real factory accepts the fixed launch');
  for (const phase of phases) check(`Real factory phase ${phase}: complete trace, classified budget removal and prepared upload counts`, () => {
    fw.update({ time: launch.burstTime + phase, windVector });
    const before = fw.diagnostics(), traces = { original: [], tightened: [] };
    const original = fw.getRadianceBound({ camera, optics: { ...optics, kernelBudgetFloat32: false }, onSourceBound: row => traces.original.push(row) });
    assert.equal(fw.diagnostics().records, before.records);
    assert.equal(fw.diagnostics().active, before.active);
    const tightened = fw.getRadianceBound({ camera, optics: { ...optics, kernelBudgetFloat32: true }, onSourceBound: row => traces.tightened.push(row) });
    assert.deepEqual(traces.tightened, traces.original, 'Every field in every source/bound callback remains identical');
    assert.equal(fw.diagnostics().records, before.records, 'Budget calls preserve physical records');
    assert.equal(fw.diagnostics().active, before.active, 'Budget calls preserve active events');
    assert.equal(tightened.globalFiniteSurfaceCeiling, original.globalFiniteSurfaceCeiling);
    assert(tightened.maximumRawRadiance <= original.maximumRawRadiance);
    assert.equal(original.kernelOutsideBudgetSources ?? 0, 0);
    assert.equal(original.quadOutsideBudgetSources ?? 0, 0);

    const classified = traces.original.map(row => ({ ...row, classification: classifyFireworkSourceVisibility(row.source, camera, optics) }));
    const reasonCounts = {};
    for (const { classification } of classified) reasonCounts[classification.reason] = (reasonCounts[classification.reason] ?? 0) + 1;
    const projectedVisibleQuad = classified.filter(row => row.projected && row.bound.visible && row.classification.reason === 'complete-quad-outside');
    assert.equal(tightened.quadOutsideBudgetSources, projectedVisibleQuad.length, 'Budget quad count exactly matches independently classified callback sources');
    const depthCulled = reasonCounts['homogeneous-depth'] ?? 0, quadCulled = reasonCounts['complete-quad-outside'] ?? 0;
    const expectedConservativeCount = traces.original.length - depthCulled - quadCulled;
    const preparedCounts = {};
    const prepared = (mode, kernelBudgetFloat32) => {
      fw.setSourceVisibility(mode);
      const handle = fw.prepareSourceView({ camera, target: { width: optics.width, height: optics.height }, optics: { ...optics, kernelBudgetFloat32 }, legacySmoke: false });
      try {
        const info = fw.getPreparedSourceViewInfo(handle);
        assert.equal(info.legacySmoke, false);
        assert.equal(info.sourceVersion, null);
        assert.equal(info.requestVersionAllocated, false);
        assert.equal(info.transmissionRequested, false);
        return info.count;
      } finally {
        assert.equal(fw.discardPreparedSourceView(handle), true);
        assert.equal(fw.discardPreparedSourceView(handle), false);
        assert.throws(() => fw.getPreparedSourceViewInfo(handle));
      }
    };
    preparedCounts.none = prepared('none', false);
    preparedCounts.depth = prepared('depth', false);
    preparedCounts.conservativeOriginal = prepared('conservative', false);
    preparedCounts.conservativeTightened = prepared('conservative', true);
    assert.equal(preparedCounts.none, traces.original.length, 'Prepared input rows equal complete callback count');
    assert.equal(preparedCounts.depth, traces.original.length - depthCulled);
    assert.equal(preparedCounts.conservativeOriginal, expectedConservativeCount, 'Actual prepared upload count matches all conservative classification rejections');
    assert.equal(preparedCounts.conservativeTightened, expectedConservativeCount, 'Storage-budget option preserves prepared upload rows');
    assert.equal(preparedCounts.depth - preparedCounts.conservativeOriginal, quadCulled, 'Actual complete-quad upload rejection count matches classifier');
    assert.equal(fw.diagnostics().records, before.records);
    assert.equal(fw.diagnostics().active, before.active);
    const row = {
      phase, time: launch.burstTime + phase, records: before.records, active: before.active,
      callbacks: traces.original.length, completeTraceExactlyEqual: true,
      traceSHA256: { original: jsonSHA256(traces.original), tightened: jsonSHA256(traces.tightened) },
      original, tightened, reasonCounts, depthCulled, quadCulled,
      projectedVisibleQuadSources: projectedVisibleQuad.map(({ source, bound }) => ({ index: source.index, bodyId: source.bodyId, kind: source.kind, peak: bound.peak, nearPlaneFallback: bound.nearPlaneFallback, sourceSHA256: jsonSHA256(source) })),
      classificationSHA256: jsonSHA256(classified.map(({ source, classification }) => ({ index: source.index, ...classification }))),
      expectedConservativeCount, preparedCounts,
    };
    rows.push(row);
    return { callbacks: row.callbacks, quadOutsideBudgetSources: tightened.quadOutsideBudgetSources, kernelOutsideBudgetSources: tightened.kernelOutsideBudgetSources, preparedCounts };
  });
  check('The targeted factory phases exercise the real opt-in budget gate', () => {
    assert.equal(rows.length, phases.length);
    assert(rows.some(row => row.tightened.kernelOutsideBudgetSources > 0));
    assert(rows.some(row => row.tightened.quadOutsideBudgetSources > 0), 'The historical high-peak phases must exercise the new complete-quad budget branch');
    return { phases: rows.length, kernelBudgetRemovals: rows.map(row => row.tightened.kernelOutsideBudgetSources), quadBudgetRemovals: rows.map(row => row.tightened.quadOutsideBudgetSources) };
  });
} finally { fw.dispose(); }

const historical = JSON.parse(read(historicalPath));
check('Both pinned historical spike rows contain a zero-stretch high-peak head rejected as a complete quad', () => {
  assert.equal(historical.rows.length, 2);
  for (const row of historical.rows) {
    assert.deepEqual(row.mainBound.mainSize, [optics.width, optics.height]);
    row.camera.forEach((value, i) => assert(Math.abs(value - camera.position.toArray()[i]) < 1e-10));
    const head = row.mainBound.top.filter(item => item.source.stretch.every(value => value === 0)).sort((a, b) => b.peak - a.peak)[0];
    assert(head, 'Each historical row has a zero-stretch head');
    assert(head.peak > 100000, 'The selected head is the original false high peak');
    assert.equal(head.projected, true);
    assert.equal(head.nearPlaneFallback, true);
    const classification = classifyFireworkSourceVisibility(head.source, camera, optics);
    assert.deepEqual(classification, { clipped: true, reason: 'complete-quad-outside' });
    historicalHeads.push({ phase: row.phase, peak: head.peak, bodyId: head.source.bodyId, originalTraceSource: head.source, classification, sourceSHA256: jsonSHA256(head.source), rowSHA256: jsonSHA256(row) });
  }
  return { heads: historicalHeads.length, sourceFile: historicalPath, sourceSHA256: pins[historicalPath].sha256 };
});
check('Every pinned source and input remains unchanged throughout the CPU check', () => {
  for (const [path, pin] of Object.entries(pins)) assert.equal(sha256(read(path)), pin.sha256, path);
  return { files: Object.keys(pins).length };
});
const passed = checks.every(check => check.passed);
const report = {
  schema: 'glass-atoll.budget-source-pin-check.v1', status: passed ? 'passed' : 'failed', passed,
  scope: 'Targeted CPU-only real factory; six strictly increasing fixed phases and two pinned historical heads; no renderer, browser, GL context, rasterization, or 6000-case broad oracle',
  provenance: {
    fixtureBasis: fixturePath, fixtureDifferences: 'Production terrainHeight/airSurface, medium trailSegments=8 and exact production probe camera; factory launch/configuration and four phases reuse the existing independent check, with the two exact historical head phases inserted in ascending order',
    factoryOptions, configuration, launchOptions, windVector, phases, quality: { trailSegments: 8 }, launch,
    terrainFunctionSHA256: sha256(terrainSource),
    camera: { position: camera.position.toArray(), target: [2, 3, 0], filmGauge: camera.filmGauge, focalLength: camera.getFocalLength(), near: camera.near, far: camera.far, projectionMatrix: camera.projectionMatrix.toArray() }, optics,
    historicalInput: historicalPath, historicalInputNote: 'Preserved original two-row spike-probe report; current spike-probe.json can be overwritten by browser runs',
    node: process.version, platform: process.platform, script: fileURLToPath(import.meta.url),
  },
  checks, rows, historicalHeads, pins,
};
writeFileSync(new URL('./budget-source-pin-check.json', import.meta.url), JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify({ status: report.status, checks: checks.map(({ name, passed, error }) => ({ name, passed, ...(error ? { error } : {}) })), rows: rows.map(({ phase, callbacks, reasonCounts, preparedCounts, tightened }) => ({ phase, callbacks, reasonCounts, preparedCounts, quadOutsideBudgetSources: tightened.quadOutsideBudgetSources, kernelOutsideBudgetSources: tightened.kernelOutsideBudgetSources })), historicalHeads: historicalHeads.map(({ phase, bodyId, peak, classification }) => ({ phase, bodyId, peak, classification })), sourceSHA256: pins['fireworks.js'].sha256 }));
if (!passed) process.exitCode = 1;
