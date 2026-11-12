import { strict as assert } from 'node:assert';
import { writeFileSync } from 'node:fs';
import * as THREE from '../../vendor/three.module.js';
import { classifyFireworkKernelViewport, createFireworks } from '../../fireworks.js';

// Independent operation-rounded Float32 shader oracle. This is a CPU check,
// not proof of the browser's actual arithmetic, clipping or rasterization.
const f = Math.fround;
const add = (a, b) => f(f(a) + f(b)), sub = (a, b) => f(f(a) - f(b));
const mul = (a, b) => f(f(a) * f(b)), div = (a, b) => f(f(a) / f(b));
const dot = (a, b) => a.reduce((sum, x, i) => add(sum, mul(x, b[i])), 0);
function erf(value) {
  const sign = Math.sign(value), x = f(Math.abs(value));
  const t = div(1, add(1, mul(.3275911, x)));
  let p = sub(mul(1.061405429, t), 1.453152027);
  p = add(mul(p, t), 1.421413741);
  p = sub(mul(p, t), .284496736);
  p = add(mul(p, t), .254829592);
  p = mul(mul(p, t), f(Math.exp(f(-mul(x, x)))));
  return mul(sign, sub(1, p));
}
function gaussian1D(offset, sigma) {
  return sub(erf(div(add(offset, .5), mul(sigma, 1.41421356237))), erf(div(sub(offset, .5), mul(sigma, 1.41421356237))));
}
function actualTaps(p, camera, o) {
  const m = new THREE.Matrix4().multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse).elements.map(f);
  const row = (position, k) => dot([m[k], m[k + 4], m[k + 8], m[k + 12]], [...position, 1]);
  const centre = p.position.map(f), velocity = (p.rasterVelocity ?? p.velocity).map(f), stretch = p.stretch.map(f);
  const project = position => {
    const w = Math.max(row(position, 3), f(1e-5));
    return [0, 1].map(k => mul(mul(div(row(position, k), w), k ? o.height : o.width), .5));
  };
  const clipW = row(centre, 3), depth = Math.max(clipW, f(.001));
  const pixelScale = div(mul(mul(Math.abs(f(camera.projectionMatrix.elements[5])), o.height), .5), depth);
  const worldSigma = mul(mul(p.radius, pixelScale), .70710678);
  const s = mul(depth, 1000), focal = f(o.focalMm), focus = Math.max(add(focal, 1), mul(o.focusMetres, 1000));
  let coc = div(Math.abs(div(mul(mul(focal, focal), sub(s, focus)), mul(mul(o.aperture, Math.max(s, add(focal, 1))), sub(focus, focal)))), o.sensorHeightMm);
  coc = mul(mul(mul(coc, o.height), .5), o.dof ? 1 : 0);
  let sigma = f(Math.sqrt(add(add(.0784, mul(worldSigma, worldSigma)), mul(mul(coc, coc), .25))));
  if (o.firelightSigmaPixels > .28 && !p.vectorEmission && f(p.radius) !== f(.0018) && stretch.every(v => v === 0) && sigma < f(o.firelightSigmaPixels)) sigma = f(o.firelightSigmaPixels);
  const exposure = f(p.vectorEmission ? p.rasterExposureSeconds ?? o.shutterSeconds : o.legacyShutterSeconds ?? o.shutterSeconds);
  const segment = (v, duration) => {
    const a = centre.map((value, i) => add(value, mul(mul(v[i], duration), .5)));
    const b = centre.map((value, i) => sub(value, mul(mul(v[i], duration), .5)));
    const pa = project(a), pb = project(b);
    return pa.map((value, i) => sub(value, pb[i]));
  };
  const shutter = segment(velocity, exposure), trail = dot(stretch, stretch) > f(1e-12), motion = trail ? segment(stretch, 1) : shutter;
  let explicit = false;
  if (trail) {
    if (p.vectorEmission) explicit = exposure > 0;
    else if (f(Math.sqrt(dot(shutter, shutter))) <= 1) sigma = f(Math.sqrt(add(mul(sigma, sigma), div(dot(shutter, shutter), 24))));
    else explicit = true;
  }
  let adaptiveEffective = false, adaptiveN1 = 8;
  if (trail) {
    const length = f(Math.sqrt(dot(motion, motion)));
    if (length > f(1e-4)) {
      const axis = motion.map(v => div(v, length));
      const x = Math.max(7, div(length, mul(.5, Math.max(1, sigma))));
      adaptiveN1 = add(add(Math.floor(x), 1), 1);
      let support = add(add(mul(.5, add(Math.abs(axis[0]), Math.abs(axis[1]))), mul(6, sigma)), .02);
      if (explicit) support = add(support, mul(.38729833462, Math.abs(dot(shutter, axis))));
      const maxLocal = Math.min(adaptiveN1, add(Math.ceil(div(mul(mul(2, support), adaptiveN1), length)), 4));
      adaptiveEffective = adaptiveN1 <= 65536 && maxLocal <= 128;
    }
  }
  const shifts = trail ? p.vectorEmission ? Array.from({ length: 8 }, (_, i) => sub(div(add(i, .5), 8), .5)) : explicit ? [0, f(-.38729833462), f(.38729833462)] : [0] : [0];
  const origin = project(centre), taps = [];
  for (let i = 0; i < 8; i++) for (const temporal of shifts) {
    const u = sub(div(add(i, .5), 8), .5);
    taps.push(origin.map((v, axis) => add(add(v, mul(motion[axis], u)), mul(shutter[axis], temporal))));
  }
  return { taps, sigma, clipW, adaptiveEffective, adaptiveN1 };
}

let seed = 0x51ad8, total = 0, outside = 0, saturated = 0, nearCrossing = 0, adaptiveOutside = 0;
const random = () => ((seed = Math.imul(seed, 1664525) + 1013904223 >>> 0) / 2 ** 32);
const range = (a, b) => a + (b - a) * random();
const failures = [];
for (let i = 0; i < 6000; i++) {
  const w = [384, 960, 1920, 3840][i % 4], h = Math.round(w / range(.7, 2.4));
  const camera = new THREE.PerspectiveCamera(range(25, 145), w / h, .1, 30000);
  camera.position.set(range(-100, 100), range(-20, 100), range(-100, 100));
  camera.lookAt(range(-50, 50), range(-50, 50), range(-50, 50));
  camera.updateMatrixWorld();
  if (i % 5 === 0) { const projection = camera.projectionMatrix.elements; projection[2] += .03; projection[6] -= .02; projection[10] += .01; }
  const local = new THREE.Vector3(range(-120, 120), range(-120, 120), -(10 ** range(-1.7, 2.7)));
  const world = local.clone().applyMatrix4(camera.matrixWorld);
  const vectorEmission = i % 3 === 0;
  const p = { kind: 'star', position: world.toArray(), velocity: [range(-80, 80), range(-80, 80), range(-80, 80)], stretch: i % 4 === 0 ? [0, 0, 0] : [range(-5, 5), range(-5, 5), range(-5, 5)], radius: i % 2 ? .0018 : 10 ** range(-4, -1), vectorEmission };
  const o = { width: w, height: h, focalMm: range(24, 70), focusMetres: 10 ** range(-.3, 3), aperture: range(1.4, 16), sensorHeightMm: 24, shutterSeconds: [0, 1 / 120, 1 / 30, .2][i % 4], legacyShutterSeconds: i % 6 === 0 ? 0 : undefined, dof: i % 2 === 0, firelightSigmaPixels: .42 };
  if (vectorEmission && i % 7 === 0) { p.rasterVelocity = p.velocity.map(v => v * .5); p.rasterExposureSeconds = 1 / 60; }
  const result = classifyFireworkKernelViewport(p, camera, o);
  const adaptive = classifyFireworkKernelViewport(p, camera, { ...o, trailIntegration: 'adaptive' });
  total++;
  if (adaptive.outside) {
    adaptiveOutside++;
    const actual = actualTaps(p, camera, o);
    if (actual.adaptiveEffective || !(actual.adaptiveN1 > 65536)) failures.push({ i, kind: 'Adaptive gate did not prove shader legacy fallback', actual, p, o });
  }
  if (!result.outside) continue;
  outside++;
  const actual = actualTaps(p, camera, o);
  if (actual.clipW < camera.near + 2.5) nearCrossing++;
  if (!(Number.isFinite(actual.sigma) && actual.sigma > 0)) continue;
  for (const tap of actual.taps) {
    // Evaluate the nearest viewport pixel and all corners. A separable positive
    // Gaussian is largest at the nearest coordinate to its tap, independently
    // of the production classifier's rectangle/interval implementation.
    const xs = [-w / 2 + .5, w / 2 - .5, Math.max(-w / 2 + .5, Math.min(w / 2 - .5, tap[0]))];
    const ys = [-h / 2 + .5, h / 2 - .5, Math.max(-h / 2 + .5, Math.min(h / 2 - .5, tap[1]))];
    for (const x of xs) for (const y of ys) {
      const kernel = mul(gaussian1D(sub(x, tap[0]), actual.sigma), gaussian1D(sub(y, tap[1]), actual.sigma));
      saturated++;
      if (kernel !== 0 && failures.length < 5) failures.push({ i, tap, sigma: actual.sigma, kernel, point: [x, y], p, o });
    }
  }
}
for (const depth of [.02, .1, 1, 10, 100]) {
  const camera = new THREE.PerspectiveCamera(65, 4 / 3, .1, 30000); camera.updateMatrixWorld();
  for (const vectorEmission of [false, true]) {
    const p = { kind: 'star', position: [0, 0, -depth], velocity: [0, 0, 10], stretch: [0, 0, .4], radius: .0018, vectorEmission };
    assert.equal(classifyFireworkKernelViewport(p, camera, { width: 960, height: 720 }).outside, false, 'An on-axis kernel must retain its bound');
  }
}
const boundaries = [];
function boundary(name, fn) {
  try { fn(); boundaries.push({ name, passed: true }); }
  catch (error) { boundaries.push({ name, passed: false, error: String(error.message) }); }
}
const boundaryCamera = new THREE.PerspectiveCamera(65, 4 / 3, .1, 30000); boundaryCamera.updateMatrixWorld();
const base = { kind: 'star', position: [100, 0, -1], velocity: [0, 0, 0], stretch: [0, 0, 0], radius: .0018 };
const baseOptics = { width: 960, height: 720, focalMm: 70, focusMetres: 60, aperture: 1.4, sensorHeightMm: 24, shutterSeconds: 1 / 120 };
const classified = (p = base, o = baseOptics, camera = boundaryCamera) => classifyFireworkKernelViewport(p, camera, o).outside;
boundary('Far offscreen finite scalar and vector kernels are removable', () => {
  for (const vectorEmission of [false, true]) assert.equal(classified({ ...base, vectorEmission }), true);
});
boundary('Uncertain Float32 trail threshold retains the original bound', () => {
  for (const x of [1e-6, 1e-6 * (1 - 1e-7), 1e-6 * (1 + 1e-7)]) assert.equal(classified({ ...base, stretch: [x, 0, 0] }), false);
});
boundary('Nonfinite and overflowing source inputs retain the original bound', () => {
  for (const bad of [NaN, Infinity, -Infinity]) for (const key of ['position', 'velocity', 'stretch']) assert.equal(classified({ ...base, [key]: [bad, 0, 0] }), false, `${key} ${bad}`);
  assert.equal(classified({ ...base, position: [1e39, 0, -1] }), false);
  assert.equal(classified({ ...base, radius: NaN }), false);
});
boundary('Uncertain nonfinite projection retains the original bound', () => {
  const camera = boundaryCamera.clone(); camera.updateMatrixWorld(); camera.projectionMatrix.elements[0] = Infinity;
  assert.equal(classified(base, baseOptics, camera), false);
});
boundary('Footprints near the viewport boundary retain their Gaussian support', () => {
  const worldAtPixelX = x => 2 * x / (boundaryCamera.projectionMatrix.elements[0] * baseOptics.width);
  for (const vectorEmission of [false, true]) {
    assert.equal(classified({ ...base, radius: 1e-8, vectorEmission, position: [worldAtPixelX(482), 0, -1] }), false);
    assert.equal(classified({ ...base, radius: 1e-8, vectorEmission, position: [worldAtPixelX(500), 0, -1] }), true);
  }
});
boundary('DOF broadening can retain an otherwise offscreen kernel', () => {
  const x = 2 * 520 / (boundaryCamera.projectionMatrix.elements[0] * baseOptics.width);
  const p = { ...base, radius: 1e-8, position: [x, 0, -1] };
  assert.equal(classified(p, { ...baseOptics, dof: false }), true);
  assert.equal(classified(p, { ...baseOptics, dof: true }), false);
});
boundary('Ordinary adaptive trails and nontrail sources retain their bound', () => {
  assert.equal(classified(base, { ...baseOptics, trailIntegration: 'adaptive' }), false);
  assert.equal(classified({ ...base, stretch: [.01, 0, 0] }, { ...baseOptics, trailIntegration: 'adaptive' }), false);
});
boundary('Adaptive index fallback is proved only beyond a conservative boundary', () => {
  const worldPerPixel = 2 / (boundaryCamera.projectionMatrix.elements[0] * baseOptics.width);
  for (const vectorEmission of [false, true]) for (const motion of [32766, 32767, 32768, 32769, 40000]) {
    const p = { ...base, vectorEmission, radius: 1e-8, position: [100000 * worldPerPixel, 0, -1], stretch: [motion * worldPerPixel, 0, 0] };
    const outside = classified(p, { ...baseOptics, trailIntegration: 'adaptive' });
    const shader = actualTaps(p, boundaryCamera, baseOptics);
    if (motion <= 32768) assert.equal(outside, false, `Uncertain boundary must retain ${motion}`);
    if (motion >= 32769) assert.equal(outside, true, `Far boundary should prove fallback ${motion}`);
    if (outside) { assert.equal(shader.adaptiveEffective, false); assert(shader.adaptiveN1 > 65536); }
  }
});
let factoryBudget = null;
boundary('Real factory budget gate preserves all source callbacks and emission records', () => {
  const fw = createFireworks(THREE, { origin: [29, 0, 7], terrainHeight: () => 0, seed: 14271, trailIntegration: 'adaptive', simulationOptions: { referenceBrightnessGain: 64, maxActive: 32 } });
  try {
    const camera = new THREE.PerspectiveCamera(50, 4 / 3, .1, 30000);
    camera.setFocalLength(24); camera.position.set(-65, 30, 54); camera.lookAt(2, 3, 0); camera.updateMatrixWorld();
    const optics = { width: 960, height: 720, focalMm: 24, aperture: 8, focusMetres: camera.position.distanceTo(new THREE.Vector3(2, 3, 0)), sensorHeightMm: camera.getFilmHeight(), dof: false, shutterSeconds: 1 / 120, firelightSigmaPixels: .42 };
    fw.configure({ type: 'display-flower', effectProfile: 'legacy', autoLaunch: false, autoFrame: false, autoDirection: false, azimuth: 110, elevation: 80, launchSpreadDegrees: 0, burstTiltDegrees: 0, burstRollDegrees: 0 });
    fw.update({ time: 0, windVector: [1.6848, 0, .6336] });
    const launch = fw.launch({ type: 'display-flower', seed: 619, launchSpreadDegrees: 0, burstOrientation: { yawDegrees: 0, tiltDegrees: 0, rollDegrees: 0 } });
    const rows = [];
    for (const phase of [1.7, 1.9, 2.2, 3.1]) {
      fw.update({ time: launch.burstTime + phase, windVector: [1.6848, 0, .6336] });
      const before = fw.diagnostics(), sourcesBefore = [], sourcesAfter = [];
      const original = fw.getRadianceBound({ camera, optics: { ...optics, kernelBudgetFloat32: false }, onSourceBound: row => sourcesBefore.push(row) });
      const tightened = fw.getRadianceBound({ camera, optics: { ...optics, kernelBudgetFloat32: true }, onSourceBound: row => sourcesAfter.push(row) });
      assert.deepEqual(sourcesAfter, sourcesBefore, 'Budget gate must preserve the complete source callback trace');
      assert.equal(fw.diagnostics().records, before.records, 'Budget gate cannot change physical/optical records');
      assert.equal(fw.diagnostics().active, before.active);
      assert.equal(tightened.globalFiniteSurfaceCeiling, original.globalFiniteSurfaceCeiling);
      assert(tightened.maximumRawRadiance <= original.maximumRawRadiance);
      assert.equal(original.kernelOutsideBudgetSources ?? 0, 0);
      rows.push({ phase, callbacks: sourcesBefore.length, records: before.records, original: original.maximumRawRadiance, tightened: tightened.maximumRawRadiance, removedFromBudget: tightened.kernelOutsideBudgetSources });
    }
    assert(rows.some(row => row.removedFromBudget > 0), 'The fixture must exercise the actual storage budget gate');
    assert(rows.some(row => row.original > row.tightened * 1000), 'The fixture must exercise a material false peak');
    factoryBudget = rows;
  } finally { fw.dispose(); }
});
let erfCases = 0;
boundary('16 sigma plus two pixels saturates the Float32 erf difference', () => {
  for (let e = -30; e <= 30; e += .1) for (const sign of [-1, 1]) for (const extra of [0, .125, 1, 1024]) {
    assert.equal(gaussian1D(f(sign * (16 * 2 ** e + 2 + extra)), f(2 ** e)), 0);
    erfCases++;
  }
});
const passed = failures.length === 0 && boundaries.every(item => item.passed);
const report = { status: passed ? 'passed' : 'failed', scope: 'Independent operation-rounded Float32 CPU shader model; no GPU/rasterization claim', total, classifiedOutside: outside, provenAdaptiveFallbackOutside: adaptiveOutside, nearCrossingOutside: nearCrossing, gaussianSamples: saturated, erfSaturationCases: erfCases, boundaries, factoryBudget, failures };
writeFileSync(new URL('./kernel-viewport-independent-check.json', import.meta.url), JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify(report));
assert.equal(passed, true);
