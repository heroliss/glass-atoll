import fs from 'node:fs';
import crypto from 'node:crypto';
import * as THREE from '../../vendor/three.module.js';
import { createAtollAirSurface } from '../../firework-surface.js';
import { classifyFireworkSourceVisibility, classifyFireworkKernelViewport } from '../../fireworks.js';
import { factory } from '../r38-fw-cpu-fixture.mjs';

const root = new URL('../../', import.meta.url), read = name => fs.readFileSync(new URL(name, root), 'utf8');
const source = read('fireworks.js'), mainSource = read('main.js');
const terrainText = mainSource.match(/export function terrainHeight\(x,z\)\{[\s\S]+?\n\}/)[0].replace('export ', '');
const terrain = new Function(terrainText + ';return terrainHeight;')();
const create = await factory(source);
const fw = create(THREE, { terrainHeight: terrain, airSurface: createAtollAirSurface(terrain), origin: [29, 0, 7], seed: 14271, clusterModel: 'moments', trailIntegration: 'adaptive', sweptSourceVisibility: true, simulationOptions: { referenceBrightnessGain: 64, maxActive: 32 } });
const camera = new THREE.PerspectiveCamera(40, 4 / 3, .15, 120000);
camera.filmGauge = 36; camera.setFocalLength(24); camera.position.set(-65, 30, 54); camera.lookAt(2, 3, 0); camera.updateMatrixWorld();
const optics = { width: 960, height: 720, focalMm: 24, aperture: 8, focusMetres: camera.position.distanceTo(new THREE.Vector3(2, 3, 0)), sensorHeightMm: camera.getFilmHeight(), dof: false, shutterSeconds: 1 / 120, firelightSigmaPixels: .42, kernelBudgetFloat32: true };
const summaries = [], spikes = [];
try {
  fw.setQuality({ trailSegments: 8 });
  fw.configure({ type: 'display-flower', effectProfile: 'legacy', autoLaunch: false, autoFrame: false, autoDirection: false, azimuth: 110, elevation: 80, launchSpreadDegrees: 0, burstTiltDegrees: 0, burstRollDegrees: 0, starDragModel: 'bounded-descent' });
  fw.update({ time: .055, windVector: [1.6848, 0, .6336] });
  const launch = fw.launch({ type: 'display-flower', seed: 619, launchSpreadDegrees: 0, burstOrientation: { yawDegrees: 0, tiltDegrees: 0, rollDegrees: 0 } });
  for (let tick = 0; tick <= 460; tick++) {
    const phase = 1.4 + tick * .005;
    fw.update({ time: launch.burstTime + phase, windVector: [1.6848, 0, .6336] });
    const traces = [];
    const bound = fw.getRadianceBound({ camera, optics, onSourceBound: row => { if (row.projected && row.bound.visible && row.bound.peak > 100) traces.push(row); } });
    summaries.push({ phase, max: bound.maximumRawRadiance, quad: bound.quadOutsideBudgetSources, sweep: bound.worldSweepOutsideBudgetSources, kernel: bound.kernelOutsideBudgetSources });
    if (bound.maximumRawRadiance <= 100) continue;
    const rows = fw.r38Rows(optics.shutterSeconds), retained = [];
    for (const entry of traces) {
      const p = rows[entry.source.index], visibility = classifyFireworkSourceVisibility(p, camera, optics);
      if (visibility.clipped) continue;
      const kernel = classifyFireworkKernelViewport(p, camera, { ...optics, trailIntegration: 'adaptive' });
      const sizeTrigger = Math.max(...entry.bound.stretchPixels.map(Math.abs), ...entry.bound.shutterPixels.map(Math.abs)) > 4 * Math.max(optics.width, optics.height);
      if ((entry.bound.nearPlaneFallback || sizeTrigger) && kernel.outside) continue;
      const depth = entry.bound.depth, pixelScale = Math.abs(camera.projectionMatrix.elements[5]) * optics.height * .5 / Math.max(depth, .001);
      const originalSigma = Math.sqrt(.0784 + (p.radius * pixelScale * .70710678) ** 2);
      const L = Math.hypot(...entry.bound.shutterPixels), trail = p.stretch?.some(v => v !== 0) ?? false;
      const sigma = trail && L <= 1 && !p.vectorEmission ? Math.sqrt(originalSigma ** 2 + L * L / 24) : originalSigma;
      const motion = trail ? entry.bound.stretchPixels : entry.bound.shutterPixels, motionL = Math.hypot(...motion);
      const x = trail ? Math.max(7, motionL / (.5 * Math.max(1, sigma))) : motionL / (4 * Math.max(1, sigma));
      const n1 = trail ? Math.floor(x) + 2 : 8 * Math.floor(x) + 8;
      const axis = motionL > 0 ? motion.map(v => v / motionL) : [0, 0];
      let support = .5 * (Math.abs(axis[0]) + Math.abs(axis[1])) + 6 * sigma + .02;
      if (trail && L > 1) support += .38729833462 * Math.abs(entry.bound.shutterPixels[0] * axis[0] + entry.bound.shutterPixels[1] * axis[1]);
      const maxLocal = Math.min(n1, Math.ceil(2 * support * n1 / Math.max(1e-30, motionL)) + 4);
      const adaptiveEffective = motionL > 1e-4 && (trail || !p.vectorEmission && p.radius !== .0018 && x > 1) && n1 <= 65536 && maxLocal <= 128;
      retained.push({ ...entry, visibility, kernel, sizeTrigger, approximateShader: { scope: 'Binary64 source optics only; root must verify actual Float32/render', trail, vectorEmission: !!p.vectorEmission, sigma, motionL, x, n1, maxLocal, adaptiveEffective } });
    }
    retained.sort((a, b) => b.bound.peak - a.bound.peak);
    spikes.push({ phase, bound, retained: retained.slice(0, 8), estimator: fw.r38Estimate(camera, optics) });
  }
  const hash = text => crypto.createHash('sha256').update(text).digest('hex');
  const report = { status: 'completed', scope: 'Read-only dense production factory CPU scan; no GPU/rasterization evidence', pins: { fireworks: hash(source), main: hash(mainSource), script: hash(fs.readFileSync(new URL('./budget-dense-scan.mjs', import.meta.url))) }, launch, camera: { filmGauge: camera.filmGauge, near: camera.near, far: camera.far, fov: camera.fov, position: camera.position.toArray(), target: [2, 3, 0] }, optics, grid: { from: 1.4, to: 3.7, step: .005, frames: summaries.length }, spikeFrames: spikes.length, maximumBound: Math.max(...summaries.map(row => row.max)), summaries, spikes };
  fs.writeFileSync(new URL('./budget-dense-scan.json', import.meta.url), JSON.stringify(report, null, 2) + '\n');
  console.log(JSON.stringify({ ...report, summaries: undefined, spikes: spikes.map(row => ({ phase: row.phase, max: row.bound.maximumRawRadiance, retained: row.retained.map(entry => ({ body: entry.source.bodyId, index: entry.source.index, peak: entry.bound.peak, depth: entry.bound.depth, visibility: entry.visibility.reason, approximateShader: entry.approximateShader })) })).slice(0, 16) }));
} finally { fw.dispose(); }
