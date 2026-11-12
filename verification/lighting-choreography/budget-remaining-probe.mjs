import fs from 'node:fs';
import crypto from 'node:crypto';
import * as THREE from '../../vendor/three.module.js';
import { createAtollAirSurface } from '../../firework-surface.js';
import { classifyFireworkSourceVisibility } from '../../fireworks.js';
import { factory } from '../r38-fw-cpu-fixture.mjs';
const root = new URL('../../', import.meta.url), read = path => fs.readFileSync(new URL(path, root), 'utf8');
const source = read('fireworks.js'), main = read('main.js');
const helperStart = source.indexOf('function fireworkKernelOutsideViewport('), helperEnd = source.indexOf('export function classifyFireworkKernelViewport', helperStart);
let helper = source.slice(helperStart, helperEnd);
helper = helper.replace('const exposure=', 'globalThis.__kernelProbe={taps:[]};const exposure=');
helper = helper.replace('if(!(D[index]>65536))return false;', 'globalThis.__kernelProbe.index=[D[index],D[index+1]];if(!(D[index]>65536))return false;');
helper = helper.replace('const temporal=trail?', 'Object.assign(globalThis.__kernelProbe,{centre:centre.map(v=>[D[v],D[v+1]]),motion:motion.map(v=>[D[v],D[v+1]]),shutter:shutter.map(v=>[D[v],D[v+1]]),sigma2:[D[sigma2],D[sigma2+1]],support:[D[support],D[support+1]],magnitude,maxSupport});const temporal=trail?');
helper = helper.replace('if(!tap.every(', 'globalThis.__kernelProbe.taps.push({j,t,interval:tap.map(v=>[D[v],D[v+1]])});if(!tap.every(');
const instrumented = (source.slice(0, helperStart) + helper + source.slice(helperEnd)).replace(/from (['"])(\.\/[^'"]+)\1/g, (_, quote, path) => `from '${new URL(path.slice(2), root).href}'`);
const probe = await import('data:text/javascript;base64,' + Buffer.from(instrumented).toString('base64'));
const oracleSource = read('verification/lighting-choreography/kernel-viewport-independent-check.mjs');
const actualTaps = new Function('THREE', oracleSource.slice(oracleSource.indexOf('const f = Math.fround'), oracleSource.indexOf('let seed =')) + ';return actualTaps;')(THREE);
const terrain = new Function(main.match(/export function terrainHeight\(x,z\)\{[\s\S]+?\n\}/)[0].replace('export ', '') + ';return terrainHeight;')();
const create = await factory(source), fw = create(THREE, { terrainHeight: terrain, airSurface: createAtollAirSurface(terrain), origin: [29, 0, 7], seed: 14271, clusterModel: 'moments', trailIntegration: 'adaptive', simulationOptions: { referenceBrightnessGain: 64, maxActive: 32 } });
const camera = new THREE.PerspectiveCamera(40, 4 / 3, .15, 120000);
camera.filmGauge = 36; camera.setFocalLength(24); camera.position.set(-65, 30, 54); camera.lookAt(2, 3, 0); camera.updateMatrixWorld();
const optics = { width: 960, height: 720, focalMm: 24, aperture: 8, focusMetres: camera.position.distanceTo(new THREE.Vector3(2, 3, 0)), sensorHeightMm: 27, dof: false, shutterSeconds: 1 / 120, firelightSigmaPixels: .42, kernelBudgetFloat32: true, trailIntegration: 'adaptive' };
const reports = [];
try {
  fw.setQuality({ trailSegments: 8 });
  fw.configure({ type: 'display-flower', effectProfile: 'legacy', autoLaunch: false, autoFrame: false, autoDirection: false, azimuth: 110, elevation: 80, launchSpreadDegrees: 0, burstTiltDegrees: 0, burstRollDegrees: 0, starDragModel: 'bounded-descent' });
  fw.update({ time: .055, windVector: [1.6848, 0, .6336] });
  const launch = fw.launch({ type: 'display-flower', seed: 619, launchSpreadDegrees: 0, burstOrientation: { yawDegrees: 0, tiltDegrees: 0, rollDegrees: 0 } });
  for (const phase of [2.085, 2.11, 2.115, 2.335, 2.3764225708313482, 3.15]) {
    fw.update({ time: launch.burstTime + phase, windVector: [1.6848, 0, .6336] });
    const traces = [];
    const bound = fw.getRadianceBound({ camera, optics, onSourceBound: row => { if (row.projected && row.bound.visible && row.bound.peak > 100) traces.push(row); } });
    const rows = fw.r38Rows(1 / 120), retained = [];
    for (const entry of traces) {
      const p = rows[entry.source.index], visibility = classifyFireworkSourceVisibility(p, camera, optics);
      if (visibility.clipped) continue;
      const result = probe.classifyFireworkKernelViewport(p, camera, optics), debug = globalThis.__kernelProbe;
      if (result.outside) continue;
      const actual = actualTaps(p, camera, optics);
      const nearest = actual.taps.map((tap, index) => ({ index, tap, gap: Math.max(Math.abs(tap[0]) - 480, Math.abs(tap[1]) - 360) })).sort((a, b) => a.gap - b.gap)[0];
      retained.push({ source: entry.source, bound: entry.bound, visibility, result, helper: debug, actualFloat32: { sigma: actual.sigma, adaptiveEffective: actual.adaptiveEffective, adaptiveN1: actual.adaptiveN1, nearest, support16SigmaPlus2: 16 * actual.sigma + 2 } });
    }
    reports.push({ phase, bound, retained });
  }
  const hash = value => crypto.createHash('sha256').update(value).digest('hex');
  const report = { scope: 'In-memory helper instrumentation plus independent operation-rounded Float32 shader model; CPU only', pins: { fireworks: hash(source), main: hash(main), script: hash(fs.readFileSync(new URL('./budget-remaining-probe.mjs', import.meta.url))) }, reports };
  fs.writeFileSync(new URL('./budget-remaining-probe.json', import.meta.url), JSON.stringify(report, null, 2) + '\n');
  console.log(JSON.stringify({ ...report, reports: reports.map(row => ({ phase: row.phase, max: row.bound.maximumRawRadiance, retained: row.retained.map(entry => ({ body: entry.source.bodyId, index: entry.source.index, actualFloat32: entry.actualFloat32, helper: entry.helper })) })) }));
} finally { fw.dispose(); }
