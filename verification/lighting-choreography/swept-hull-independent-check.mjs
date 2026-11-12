import assert from 'node:assert/strict';
import fs from 'node:fs';
import crypto from 'node:crypto';
import * as THREE from '../../vendor/three.module.js';
import { classifyFireworkSweepViewport } from '../../fireworks.js';

const f = Math.fround, add = (a, b) => f(f(a) + f(b)), mul = (a, b) => f(f(a) * f(b));
const dot = (a, b) => a.reduce((sum, v, i) => add(sum, mul(v, b[i])), 0);
let seed = 0x123ac7;
const random = () => ((seed = Math.imul(seed, 1664525) + 1013904223 >>> 0) / 2 ** 32), range = (a, b) => a + (b - a) * random();
const failures = [], cases = [];
let total = 0, outside = 0, continuousSamples = 0, cornerSamples = 0, dofOutside = 0;
function check(name, fn) { try { fn(); cases.push({ name, passed: true }); } catch (error) { cases.push({ name, passed: false, error: String(error.stack) }); } }
function sigmaAt(p, clipW, camera, optics) {
  const depth = Math.max(.001, clipW), scale = Math.abs(camera.projectionMatrix.elements[5]) * optics.height * .5 / depth;
  const world = f(p.radius) * scale * .70710678;
  const focal = f(optics.focalMm), focus = Math.max(focal + 1, f(optics.focusMetres) * 1000), s = depth * 1000;
  const coc = optics.dof ? Math.abs(focal * focal * (s - focus) / (f(optics.aperture) * Math.max(s, focal + 1) * (focus - focal))) / f(optics.sensorHeightMm) * optics.height * .5 : 0;
  return Math.max(f(optics.firelightSigmaPixels), Math.sqrt(.0784 + 1 / 24 + world * world + coc * coc * .25));
}
check('Independent Float32 transforms of corners and continuous swept source samples remain outside Gaussian/DOF support', () => {
  for (let ci = 0; ci < 1600; ci++) {
    const width = [384, 960, 1920, 3840][ci % 4], height = Math.round(width / range(.7, 2.3));
    const camera = new THREE.PerspectiveCamera(range(25, 145), width / height, .15, 120000);
    camera.position.set(range(-100, 100), range(-30, 100), range(-100, 100)); camera.lookAt(range(-30, 30), range(-30, 30), range(-30, 30)); camera.updateMatrixWorld();
    if (ci % 7 === 0) { const P = camera.projectionMatrix.elements; P[2] += .03; P[6] -= .02; P[10] += .01; }
    const depth = 10 ** range(-1.5, 3), local = new THREE.Vector3(range(-100, 100), range(-100, 100), -depth), position = local.applyMatrix4(camera.matrixWorld).toArray();
    const p = { kind: 'star', position, radius: 10 ** range(-5, -1), velocity: [range(-80, 80), range(-80, 80), range(-80, 80)], stretch: ci % 5 ? [range(-5, 5), range(-5, 5), range(-5, 5)] : [0, 0, 0], vectorEmission: ci % 3 === 0 };
    if (p.vectorEmission && ci % 2 === 0) { p.rasterVelocity = p.velocity.map(v => v * .5); p.rasterExposureSeconds = 1 / 60; }
    const optics = { width, height, focalMm: range(24, 70), aperture: range(1.4, 16), focusMetres: 10 ** range(-.3, 3), sensorHeightMm: 24, dof: ci % 2 === 0, shutterSeconds: [0, 1 / 120, 1 / 30, .2][ci % 4], legacyShutterSeconds: ci % 7 ? undefined : 0, firelightSigmaPixels: .42 };
    const result = classifyFireworkSweepViewport(p, camera, optics); total++;
    if (!result.outside) continue;
    outside++; dofOutside += Number(optics.dof);
    const M = new THREE.Matrix4().multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse).elements.map(f);
    const exposure = f(p.vectorEmission ? p.rasterExposureSeconds ?? optics.shutterSeconds : optics.legacyShutterSeconds ?? optics.shutterSeconds);
    const V = (p.rasterVelocity ?? p.velocity).map(f), T = p.stretch.map(f), X = p.position.map(f);
    const trail = dot(T, T) > f(1e-12), transform = point => [0, 1, 3].map(k => dot([M[k], M[k + 4], M[k + 8], M[k + 12]], [...point, 1]));
    for (let u = 0; u <= 12; u++) for (let v = 0; v <= 12; v++) {
      const point = X.map((x, axis) => add(add(x, trail ? mul(T[axis], f(u / 12 - .5)) : 0), mul(mul(V[axis], exposure), f(v / 12 - .5))));
      const [x, y, w] = transform(point);
      continuousSamples++; if ((u === 0 || u === 12) && (v === 0 || v === 12)) cornerSamples++;
      if (w <= 0) continue;
      const centre = [x / w * width * .5, y / w * height * .5], support = 16 * sigmaAt(p, w, camera, optics) + 2;
      const gap = Math.max(Math.abs(centre[0]) - width / 2, Math.abs(centre[1]) - height / 2);
      if (gap <= support && failures.length < 5) failures.push({ ci, u, v, centre, w, support, gap, p, optics });
    }
  }
  assert(outside > 500 && dofOutside > 250, 'Exercise substantial outside domains with and without DOF');
  assert(continuousSamples > 100000 && cornerSamples === outside * 4, 'Include all four corners and the full continuous sample grid');
  assert.equal(failures.length, 0);
});
const camera = new THREE.PerspectiveCamera(65, 4 / 3, .15, 120000); camera.updateMatrixWorld();
const optics = { width: 960, height: 720, focalMm: 70, aperture: 1.4, focusMetres: 60, sensorHeightMm: 24, dof: false, shutterSeconds: 1 / 120, firelightSigmaPixels: .42 };
const base = { kind: 'star', position: [100, 0, -10], velocity: [0, 0, 0], stretch: [0, 0, 0], radius: .0018 };
const classify = (p = base, o = optics) => classifyFireworkSweepViewport(p, camera, o).outside;
check('A physical sweep crossing the viewport is retained even when its centre is far outside', () => {
  assert.equal(classify(base), true);
  assert.equal(classify({ ...base, stretch: [220, 0, 0] }), false);
  assert.equal(classify({ ...base, velocity: [30000, 0, 0] }), false);
});
check('Near-plane-crossing but wholly top-side physical sweeps are excluded', () => {
  assert.equal(classify({ ...base, position: [0, 300, -.2], stretch: [0, 0, 3], velocity: [1, 1, 20] }), true);
});
check('DOF can retain a close offscreen source whose blur reaches the viewport', () => {
  const x = 2 * 520 / (camera.projectionMatrix.elements[0] * 960), p = { ...base, position: [x, 0, -1], radius: 1e-8 };
  assert.equal(classify(p), true); assert.equal(classify(p, { ...optics, dof: true }), false);
});
check('Vector raster exposure and scalar zero-duration shutter use the correct world domain', () => {
  const p = { ...base, position: [10, 0, -10], velocity: [1000, 0, 0] };
  assert.equal(classify(p, { ...optics, legacyShutterSeconds: 0 }), true);
  assert.equal(classify({ ...p, vectorEmission: true, rasterExposureSeconds: .2 }, { ...optics, shutterSeconds: .001, legacyShutterSeconds: 0 }), false);
  assert.equal(classify({ ...p, vectorEmission: true, viewExposure: { durationSeconds: .2 } }, { ...optics, shutterSeconds: .001, legacyShutterSeconds: 0 }), false);
  assert.equal(classify({ ...p, vectorEmission: true, rasterVelocity: [0, 0, 0], rasterExposureSeconds: .2 }), true);
});
check('Public Float32 attributes and reversed shutter direction keep equivalent swept domains', () => {
  const typed = Object.fromEntries(['position', 'velocity', 'stretch'].map(key => [key, new Float32Array(base[key])]));
  assert.equal(classify({ ...base, ...typed }), true);
  const crossing = { ...base, position: new Float32Array([10, 0, -10]), velocity: new Float32Array([1000, 0, 0]), stretch: new Float32Array([0, 0, 0]) };
  assert.equal(classify(crossing, { ...optics, shutterSeconds: .2 }), false);
  assert.equal(classify(crossing, { ...optics, shutterSeconds: -.2 }), false);
});
check('Smoke, threshold uncertainty and nonfinite input retain their existing upload', () => {
  assert.equal(classify({ ...base, kind: 'smoke' }), false);
  assert.equal(classify({ ...base, stretch: [1e-6, 0, 0] }), false);
  for (const value of [NaN, Infinity, -Infinity]) for (const key of ['position', 'velocity', 'stretch']) assert.equal(classify({ ...base, [key]: [value, 0, 0] }), false);
});
check('Viewport side-plane and ordinary on-axis support boundaries are retained', () => {
  for (const depth of [.02, .15, 1, 10, 100]) {
    assert.equal(classify({ ...base, position: [0, 0, -depth] }), false);
    const x = depth / camera.projectionMatrix.elements[0] * (1 + 1e-7);
    assert.equal(classify({ ...base, position: [x, 0, -depth] }), false);
  }
});
const paths = ['fireworks.js', 'main.js', 'verification/lighting-choreography/swept-hull-independent-check.mjs'];
const pins = Object.fromEntries(paths.map(path => [path, crypto.createHash('sha256').update(fs.readFileSync(new URL('../../' + path, import.meta.url))).digest('hex')]));
const passed = cases.every(item => item.passed) && failures.length === 0;
const report = { status: passed ? 'passed' : 'failed', scope: 'Independent operation-rounded Float32 world sweep sampling plus Gaussian/DOF support; CPU only, not proof of legacy screen-streak equality', pins, total, classifiedOutside: outside, dofOutside, continuousSamples, cornerSamples, cases, failures };
fs.writeFileSync(new URL('./swept-hull-independent-check.json', import.meta.url), JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify(report));
assert(passed);
