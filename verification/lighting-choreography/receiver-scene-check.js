// QA-only actual-scene fixture. The parent owns browser/GPU scheduling.
// No production file edits; no synthetic lamp or replacement island scene.
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
const clone = value => structuredClone(value);
const Y = rgb => .2126 * rgb[0] + .7152 * rgb[1] + .0722 * rgb[2];
const distance = (a, b) => Math.hypot(...a.map((value, i) => value - b[i]));
const chroma = rgb => { const sum = rgb.reduce((a, b) => a + Math.max(0, b), 0); return sum > 0 ? rgb.map(v => Math.max(0, v) / sum) : [0, 0, 0]; };
const percentile = (values, p) => { const sorted = [...values].sort((a, b) => a - b); return sorted.length ? sorted[Math.floor((sorted.length - 1) * p)] : 0; };

async function until(test, label, timeout = 30000) {
  const end = performance.now() + timeout;
  while (!test()) { if (performance.now() > end) throw Error('Timed out: ' + label); await delay(12); }
}

function sourceSummary(clusters) {
  const rgb = [0, 0, 0], position = [0, 0, 0]; let weight = 0;
  for (const c of clusters) {
    const colour = c.linearColor ?? c.color ?? [1, 1, 1], intensity = c.referenceCandela ?? c.candela ?? c.intensity ?? 0;
    const w = Math.max(0, intensity * Y(colour)); weight += w;
    for (let k = 0; k < 3; k++) { rgb[k] += colour[k] * intensity; position[k] += c.position[k] * w; }
  }
  return { count: clusters.length, referenceY: Y(rgb), referenceRGB: rgb, chromaticityRGB: chroma(rgb), centroidMetres: weight ? position.map(v => v / weight) : null };
}

function differenceStats(on, off, repeat, classify, width, height) {
  const groups = Object.fromEntries(['sand', 'leaves', 'water'].map(id => [id, { samples: 0, positivePixels: 0, negativePixels: 0, sumRGB: [0, 0, 0], positiveY: 0, peakY: 0, noisePeakY: 0, weightedUV: [0, 0], uvBounds: [1, 1, 0, 0], positiveUVBounds: [1, 1, 0, 0] }]));
  const extend = (box, u, v) => { box[0] = Math.min(box[0], u); box[1] = Math.min(box[1], v); box[2] = Math.max(box[2], u); box[3] = Math.max(box[3], v); };
  let bad = 0;
  for (let i = 0; i < on.colour.length; i += 4) {
    const rgbOn = Array.from(on.colour.subarray(i, i + 3), v => v / 2 ** on.storageEV);
    const rgbOff = Array.from(off.colour.subarray(i, i + 3), v => v / 2 ** off.storageEV);
    const rgbRepeat = Array.from(repeat.colour.subarray(i, i + 3), v => v / 2 ** repeat.storageEV);
    if (![...rgbOn, ...rgbOff, ...rgbRepeat].every(Number.isFinite)) { bad++; continue; }
    const id = classify(i / 4, on.meta), g = groups[id]; if (!g) continue;
    const delta = rgbOn.map((v, k) => v - rgbOff[k]), dy = Y(delta), noise = Math.abs(Y(rgbOn.map((v, k) => v - rgbRepeat[k])));
    const tolerance = Math.max(1e-18, Math.abs(Y(rgbOn)) * .0015, noise * 4);
    const u = ((i / 4) % width + .5) / width, v = (Math.floor(i / 4 / width) + .5) / height;
    g.samples++; extend(g.uvBounds, u, v); g.noisePeakY = Math.max(g.noisePeakY, noise); g.peakY = Math.max(g.peakY, dy);
    for (let k = 0; k < 3; k++) g.sumRGB[k] += delta[k];
    if (dy > tolerance) {
      g.positivePixels++; g.positiveY += dy; extend(g.positiveUVBounds, u, v);
      g.weightedUV[0] += u * dy;
      g.weightedUV[1] += v * dy;
    }
    if (dy < -tolerance) g.negativePixels++;
  }
  return { nonfiniteSamples: bad, receivers: Object.fromEntries(Object.entries(groups).map(([id, g]) => [id, {
    ...g, uvBounds: g.samples ? g.uvBounds : null, positiveUVBounds: g.positivePixels ? g.positiveUVBounds : null,
    meanDeltaRGB: g.sumRGB.map(v => v / Math.max(1, g.samples)), chromaticityRGB: chroma(g.sumRGB),
    meanPositiveDeltaY: g.positiveY / Math.max(1, g.samples), centroidUV: g.positiveY ? g.weightedUV.map(v => v / g.positiveY) : null,
    signalOverRepeatNoise: g.positivePixels >= 4 && g.peakY > Math.max(1e-18, 4 * g.noisePeakY),
  }])) };
}

/** Main QA wrapper passes actual closure objects, e.g.
 * runReceiverLightCheck(window.__ATOLL__, {THREE,renderer,fireworks,lens,camera,terrainHeight,localLights,scene,...options})
 * A new isolated page is required: physical time/emitted events cannot be undone.
 */
export async function runReceiverLightCheck(atoll, {
  THREE, renderer, fireworks, lens, camera, terrainHeight, localLights, scene,
  type = 'display-flower', seed = 619, phases = [.015, .06, .18, .65, 1.6, 3.2],
  receiverCamera = { position: [-65, 30, 54], target: [2, 3, 0] }, coreView = 'fireworks-close',
  width = 320, height = 240, coreExtentPixels = 192, exposureEV = null, capture = true,
  baseline = null, sample = null, requireColourChange = false, minimumReceiverSamples = 8, minimumCoreReduction = .02,
} = {}) {
  const a = atoll;
  if (!THREE || !renderer?.render || !fireworks?.getLightClusters || !fireworks?.getReceiverLightClusters || !lens?.getDiagnosticTargets || !camera || !localLights || !scene || !terrainHeight || !a?.pauseAtPhysicalTime) throw TypeError('Pass the actual scene objects, both production cluster getters, lens.getDiagnosticTargets and __ATOLL__');
  if (a.state.graphicsContextInterrupted || a.fireworks().active || a.fireworks().queued) throw Error('Use a healthy, empty, isolated page');
  if (!phases.length || phases.some((v, i) => !Number.isFinite(v) || v < 0 || i && v <= phases[i - 1])) throw RangeError('phases must increase from nonnegative burst-relative seconds');
  width = Math.max(64, Math.min(640, Math.round(width))); height = Math.max(48, Math.min(480, Math.round(height)));
  const saved = { paused: a.state.parameters.paused, lens: clone(a.state.parameters.lens), fireworks: clone(a.fireworks().settings), diagnosticEV: a.diagnosticCameraEV,
    camera: clone(a.state.camera), target: clone(a.state.target), clock: clone(a.celestial()), director: clone(a.state.parameters.director) };
  const originals = { render: renderer.render, cloud: fireworks.getLightClusters, receiver: fireworks.getReceiverLightClusters };
  const report = { schema: 'glass-atoll.receiver-light-scene.v1', dateUTC: new Date().toISOString(), type, seed, phases: [], checks: [], images: [], passed: false,
    method: 'Actual production scene and exact physical pauses. Both source-cluster getters off/on; same emitted bodies. Pre-tone-map FP16 scene/composed textures sampled into RGBA32F, divided by each capture storage 2^P.',
    limits: ['Diagnostic readbacks and PNG captures are not FPS measurements.', 'Sand mask is terrain-height/depth agreement above water; the leaves key denotes covered grove vegetation, including woody parts, from the real motion-depth attachment; water uses the production .70 alpha tag. Masks and counts are reported, not a claim of hand-reviewed segmentation.', 'Receiver grid is a bounded spatial sample; core crop reads every source texel in its rectangle. No absolute lux/nit or subjective appearance calibration.', 'Visible-core reduction needs a separate saved baseline from matching seed/phases/camera/lens/C. Technical pass without a baseline does not accept core reduction.', 'Preferences/overrides are restored; physical time and emitted events cannot be rewound.'] };
  const check = (name, passed, evidence = {}) => report.checks.push({ name, passed: !!passed, evidence });
  let off = false, opaqueTarget, composedTarget, timeout, phaseLabel = 'setup';
  const target = new THREE.WebGLRenderTarget(width, height, { type: THREE.FloatType, format: THREE.RGBAFormat, count: 2, depthBuffer: false });
  target.textures.forEach(t => { t.colorSpace = THREE.NoColorSpace; t.minFilter = t.magFilter = THREE.NearestFilter; });
  const probeMaterial = new THREE.ShaderMaterial({ glslVersion: THREE.GLSL3, toneMapped: false, depthTest: false, depthWrite: false,
    uniforms: { tColour: { value: null }, tDepth: { value: null }, tLeaves: { value: null }, uSourceSize: { value: new THREE.Vector2() }, uRect: { value: new THREE.Vector4(0, 0, 1, 1) } },
    vertexShader: 'out vec2 vUv; void main(){vUv=uv;gl_Position=vec4(position.xy,0.,1.);}',
    fragmentShader: 'precision highp float; in vec2 vUv; uniform sampler2D tColour,tDepth,tLeaves; uniform vec2 uSourceSize; uniform vec4 uRect; layout(location=0) out vec4 colour; layout(location=1) out vec4 meta; void main(){vec2 p=uRect.xy+vUv*uRect.zw;p=(floor(p*uSourceSize)+.5)/uSourceSize;colour=texture(tColour,p);meta=vec4(texture(tDepth,p).r,texture(tLeaves,p).r,colour.a,1.);}' });
  const probeGeometry = new THREE.PlaneGeometry(2, 2), probeScene = new THREE.Scene(), probeCamera = new THREE.Camera();
  probeScene.add(new THREE.Mesh(probeGeometry, probeMaterial));
  const readErrors = () => { const gl = renderer.getContext(), errors = []; for (let i = 0; i < 16; i++) { const value = gl.getError(); if (value === gl.NO_ERROR) break; errors.push(value); } return errors; };
  function read(kind, w, h, rect = [0, 0, 1, 1]) {
    ({opaque: opaqueTarget, composed: composedTarget} = lens.getDiagnosticTargets());
    const colourTarget = kind === 'opaque' ? opaqueTarget : composedTarget;
    if (!opaqueTarget?.depthTexture || !opaqueTarget.textures?.[2] || !colourTarget?.texture) throw Error('Actual opaque/composed targets unavailable');
    const previous = renderer.getRenderTarget(), face = renderer.getActiveCubeFace(), mip = renderer.getActiveMipmapLevel(), viewport = renderer.getViewport(new THREE.Vector4()), scissor = renderer.getScissor(new THREE.Vector4()), scissorTest = renderer.getScissorTest(), autoClear = renderer.autoClear;
    const colour = new Float32Array(w * h * 4), meta = new Float32Array(w * h * 4);
    try {
      target.setSize(w, h); probeMaterial.uniforms.tColour.value = colourTarget.texture; probeMaterial.uniforms.tDepth.value = opaqueTarget.depthTexture; probeMaterial.uniforms.tLeaves.value = opaqueTarget.textures[2];
      probeMaterial.uniforms.uSourceSize.value.set(colourTarget.width, colourTarget.height); probeMaterial.uniforms.uRect.value.fromArray(rect);
      renderer.autoClear = true; renderer.setRenderTarget(target); renderer.setScissorTest(false); renderer.setViewport(0, 0, w, h);
      originals.render.call(renderer, probeScene, probeCamera);
      renderer.readRenderTargetPixels(target, 0, 0, w, h, colour, undefined, 0); renderer.readRenderTargetPixels(target, 0, 0, w, h, meta, undefined, 1);
    } finally { renderer.autoClear = autoClear; renderer.setRenderTarget(previous, face, mip); renderer.setViewport(viewport); renderer.setScissor(scissor); renderer.setScissorTest(scissorTest); }
    return { colour, meta, sourceSize: [colourTarget.width, colourTarget.height], storageEV: a.photometry().storageEV, physicalTime: a.state.time };
  }
  function refresh() { a.setDiagnosticCameraEV(report.fixedCameraEV); }
  async function frame(label, callback) {
    refresh();
    return new Promise((resolve, reject) => {
      timeout = setTimeout(() => { a.setFrameProbe(null); reject(Error('No actual frame: ' + label)); }, 10000);
      a.setFrameProbe(() => { clearTimeout(timeout); try {
        if (capture) report.images.push({ name: label + '.png', physicalTime: a.state.time, camera: clone(a.state.camera), target: clone(a.state.target), dataURL: renderer.domElement.toDataURL('image/png') });
        resolve(callback());
      } catch (error) { reject(error); } });
    });
  }
  async function pose(position, lookAt) { a.setCamera(position, lookAt); await frame(phaseLabel + '-pose', () => null); }
  async function pauseExactly(time) { a.pauseAtPhysicalTime(time); if (a.state.time < time) a.pause(false); await until(() => a.state.parameters.paused, 'physical pause'); if (a.state.time !== time) throw Error('Physical pause missed exact target'); }
  function sampleUV(index, sourceSize) {
    const u = (index % width + .5) / width, v = (Math.floor(index / width) + .5) / height;
    return [(Math.floor(u * sourceSize[0]) + .5) / sourceSize[0], (Math.floor(v * sourceSize[1]) + .5) / sourceSize[1]];
  }
  function observedPosition(index, meta, sourceSize) {
    const depth = meta[index * 4]; if (!(depth >= 0 && depth < .999999)) return null;
    const [u, v] = sampleUV(index, sourceSize);
    return new THREE.Vector3(u * 2 - 1, v * 2 - 1, depth * 2 - 1).unproject(camera);
  }
  function classify(index, meta) {
    const k = index * 4, depth = meta[k]; if (!(depth >= 0 && depth < .999999)) return null;
    if (meta[k + 1] > 0) return 'leaves';
    if (Math.abs(meta[k + 2] - .70) < .012) return 'water';
    const p = observedPosition(index, meta, [opaqueTarget.width, opaqueTarget.height]), y = terrainHeight(p.x, p.z);
    return y > .15 && Math.abs(p.y - y) < .12 ? 'sand' : null;
  }
  function patchSamples(on, dark, repeat) {
    if (!sample) return [];
    const patches = [];
    for (const [i, point] of (sample.worldPoints ?? sample.worldpoints ?? []).entries()) {
      if (!Array.isArray(point.position) || point.position.length !== 3 || !point.position.every(Number.isFinite)) throw Error('sample.worldPoints positions must contain three finite world metres');
      const world = new THREE.Vector3(...point.position), p = world.clone().project(camera), uv = [p.x * .5 + .5, p.y * .5 + .5];
      const inCamera = p.z >= -1 && p.z <= 1 && uv.every(v => v >= 0 && v <= 1), radius = Math.max(1, Math.min(256, point.radiusPixels ?? 16));
      const row = { id: point.id ?? 'world-' + i, kind: 'worldPoint', positionMetres: [...point.position], projectedNDC: p.toArray(), centreUV: uv, inCamera, receiver: point.receiver ?? null,
        rect: [uv[0] - radius / on.sourceSize[0], uv[1] - radius / on.sourceSize[1], 2 * radius / on.sourceSize[0], 2 * radius / on.sourceSize[1]], radiusSourcePixels: radius };
      if (inCamera) {
        const index = Math.min(height - 1, Math.floor(uv[1] * height)) * width + Math.min(width - 1, Math.floor(uv[0] * width)), observed = observedPosition(index, on.meta, on.sourceSize);
        row.centreObservedReceiver = classify(index, on.meta); row.centreObservedWorldMetres = observed?.toArray() ?? null;
        row.centreDistanceDeltaMetres = observed ? observed.distanceTo(camera.position) - world.distanceTo(camera.position) : null;
        const tolerance = point.visibilityToleranceMetres ?? 1.5;
        row.pointVisibility = !observed ? 'no-covered-centre' : row.centreDistanceDeltaMetres < -tolerance ? 'occluded-at-grid-centre' : row.centreDistanceDeltaMetres > tolerance ? 'point-in-front-of-observed-surface' : 'geometry-consistent-at-grid-centre';
      } else row.pointVisibility = 'outside-camera';
      patches.push(row);
    }
    for (const [i, patch] of (sample.fixedPatches ?? sample.fixedpatches ?? []).entries()) {
      if (!Array.isArray(patch.rect) || patch.rect.length !== 4 || !patch.rect.every(Number.isFinite) || patch.rect[2] <= 0 || patch.rect[3] <= 0) throw Error('sample.fixedPatches rect must be [u0,v0,width,height] with positive size');
      patches.push({ id: patch.id ?? 'fixed-' + i, kind: 'fixedPatch', rect: [...patch.rect], receiver: patch.receiver ?? null, inCamera: patch.rect[0] < 1 && patch.rect[1] < 1 && patch.rect[0] + patch.rect[2] > 0 && patch.rect[1] + patch.rect[3] > 0 });
    }
    return patches.map(patch => {
      const [x, y, w, h] = patch.rect;
      const stats = differenceStats(on, dark, repeat, (index, meta) => {
        if (!patch.inCamera) return null;
        const [u, v] = sampleUV(index, on.sourceSize); if (u < x || u > x + w || v < y || v > y + h) return null;
        const id = classify(index, meta); return !patch.receiver || id === patch.receiver ? id : null;
      }, width, height);
      return { ...patch, ...stats, measuredReceiverSamples: Object.values(stats.receivers).reduce((n, g) => n + g.samples, 0),
        limit: patch.kind === 'worldPoint' ? 'Visibility is a coarse depth check at the bounded-grid centre; patch statistics describe only actual visible geometry, not guaranteed visibility of the requested point.' : 'Normalized bottom-left UV rectangle intersects the bounded grid; missing semantic coverage is reported as zero samples.' };
    });
  }
  try {
    a.pause(true); a.setDirector({ mode: 'off' }); await a.timePreset('stars'); await a.setTime({ running: false });
    // Vegetation coverage depth is written only with motion capture enabled.
    // Quantitative receiver reads use opaque sceneTarget, before temporal resolve.
    a.setLens({ focal: 24, dof: false, vignette: false, temporal: true, temporalJitter: false, glintAA: true, opticalFlare: false, shutterSeconds: 1 / 120 });
    a.setFireworks({ type, effectProfile: 'legacy', autoLaunch: false, autoFrame: false, autoDirection: false, azimuth: 110, elevation: 80, launchSpreadDegrees: 0, burstTiltDegrees: 0, burstRollDegrees: 0, smokeQuality: 'light', persistentSmoke: false });
    a.clearSmoke(); report.fixedCameraEV = exposureEV ?? a.photometry().cameraEV; refresh();
    fireworks.getLightClusters = function(...args) { return off ? [] : originals.cloud.apply(this, args); };
    fireworks.getReceiverLightClusters = function(...args) { return off ? [] : originals.receiver.apply(this, args); };
    const launch = a.launchFirework({ type, seed, launchSpreadDegrees: 0, burstOrientation: { yawDegrees: 0, tiltDegrees: 0, rollDegrees: 0 } });
    if (!launch.accepted || launch.queued) throw Error('Seeded event was not immediately accepted'); report.launch = clone(launch);
    for (const seconds of phases) {
      phaseLabel = 'burst-' + seconds.toFixed(3); await pauseExactly(launch.burstTime + seconds);
      off = false; await pose(receiverCamera.position, receiverCamera.target);
      const receiverClusters = clone(originals.receiver.call(fireworks)), cloudClusters = clone(originals.cloud.call(fireworks));
      const on = await frame(phaseLabel + '-receivers-on', () => read('opaque', width, height));
      const lightsOn = clone(localLights.state); off = true;
      const dark = await frame(phaseLabel + '-receivers-off', () => read('opaque', width, height));
      const lightsOff = clone(localLights.state); off = false;
      const repeat = await frame(phaseLabel + '-receivers-repeat', () => read('opaque', width, height));
      const differences = differenceStats(on, dark, repeat, classify, width, height);
      const row = { phaseSeconds: seconds, physicalTime: a.state.time, receiverCamera: clone(a.state.camera), receiverTarget: clone(a.state.target), sampleGrid: [width, height], sourceSize: on.sourceSize, storageEVs: [on.storageEV, dark.storageEV, repeat.storageEV], cloudClusters, receiverClusters, source: sourceSummary(receiverClusters), lightsOn, lightsOff, ...differences, patches: patchSamples(on, dark, repeat) };
      check(phaseLabel + ': exact same physical time and finite readbacks', on.physicalTime === dark.physicalTime && on.physicalTime === repeat.physicalTime && differences.nonfiniteSamples === 0, { times: [on.physicalTime, dark.physicalTime, repeat.physicalTime] });
      check(phaseLabel + ': both native receiver lights are zero in off arm', lightsOff.lights.slice(4, 6).every(light => light.candela === 0 && light.rawRGB.every(v => v === 0)), { off: lightsOff.lights.slice(4, 6) });
      a.setView(coreView); await until(() => !a.cameraTransition(), 'core camera');
      const core = await frame(phaseLabel + '-core', () => {
        const bounds = a.fireworks().bounds, centre = bounds.centre ?? bounds.center ?? receiverClusters[0]?.position;
        if (!centre) return { measured: false, reason: 'no active source bounds' };
        composedTarget = lens.getDiagnosticTargets().composed;
        const p = new THREE.Vector3(...centre).project(camera), sw = composedTarget.width, sh = composedTarget.height;
        if (Math.abs(p.x) > 1 || Math.abs(p.y) > 1 || p.z < -1 || p.z > 1) return { measured: false, reason: 'source centre outside actual core camera', projected: p.toArray() };
        const w = Math.min(sw, coreExtentPixels), h = Math.min(sh, coreExtentPixels), x = Math.max(0, Math.min(sw - w, Math.round((p.x * .5 + .5) * sw - w / 2))), y = Math.max(0, Math.min(sh - h, Math.round((p.y * .5 + .5) * sh - h / 2)));
        const sampled = read('composed', w, h, [x / sw, y / sh, w / sw, h / sh]), values = [];
        let nonfinite = 0; for (let i = 0; i < sampled.colour.length; i += 4) { const rgb = Array.from(sampled.colour.subarray(i, i + 3), v => v / 2 ** sampled.storageEV); if (!rgb.every(Number.isFinite)) nonfinite++; else values.push(Y(rgb)); }
        return { measured: true, target: 'actual composed linear HDR before bloom/tone mapping', cropPixels: [x, y, w, h], camera: clone(a.state.camera), targetPoint: clone(a.state.target), focalMm: a.state.lens.focalMm, storageEV: sampled.storageEV, nonfinite, peakRawY: Math.max(0, ...values), p99RawY: percentile(values, .99), meanRawY: values.reduce((s, v) => s + v, 0) / Math.max(1, values.length) };
      }); row.core = core;
      check(phaseLabel + ': visible core crop is finite and nonzero', core.measured && core.nonfinite === 0 && core.peakRawY > 0, core);
      row.glErrors = readErrors(); check(phaseLabel + ': no GL errors', row.glErrors.length === 0, row.glErrors); report.phases.push(row);
    }
    for (const id of ['sand', 'leaves', 'water']) {
      const observations = report.phases.map(p => p.receivers[id]);
      check(id + ': actual receiver mask has sufficient samples', observations.every(g => g.samples >= minimumReceiverSamples), observations.map(g => g.samples));
      check(id + ': at least one phase has light above same-time repeat noise', observations.some(g => g.signalOverRepeatNoise), observations.map(g => ({ peakY: g.peakY, noisePeakY: g.noisePeakY, positivePixels: g.positivePixels })));
    }
    const sources = report.phases.map(p => p.source).filter(s => s.referenceY > 0), first = sources[0];
    report.temporal = { referenceY: sources.map(s => s.referenceY), sourceCentroids: sources.map(s => s.centroidMetres), chromaticityRGB: sources.map(s => s.chromaticityRGB), brightnessRange: sources.length ? Math.max(...sources.map(s => s.referenceY)) - Math.min(...sources.map(s => s.referenceY)) : 0,
      positionRangeMetres: first ? Math.max(...sources.map(s => distance(s.centroidMetres, first.centroidMetres))) : 0, colourRange: first ? Math.max(...sources.map(s => distance(s.chromaticityRGB, first.chromaticityRGB))) : 0 };
    check('actual source brightness changes across fixed burn phases', report.temporal.brightnessRange > Math.max(1e-12, (first?.referenceY ?? 0) * .01), report.temporal);
    check('actual source position follows evolving burning bodies', report.temporal.positionRangeMetres > .1, { rangeMetres: report.temporal.positionRangeMetres });
    if (requireColourChange) check('selected multicolour source changes chromaticity', report.temporal.colourRange > .005, { range: report.temporal.colourRange });
    if (baseline) {
      const comparisons = report.phases.filter(p => p.phaseSeconds <= .04).map(p => {
        const b = baseline.phases.find(q => q.phaseSeconds === p.phaseSeconds);
        // OrbitControls can reconstruct the same pose with 1e-13 metre roundoff.
        // Keep crop/focal/C/type/seed exact; bound only this numeric pose noise.
        const poseToleranceMetres = 1e-9, cameraDifferenceMetres = b?.core?.camera ? distance(b.core.camera, p.core.camera) : Infinity, targetDifferenceMetres = b?.core?.targetPoint ? distance(b.core.targetPoint, p.core.targetPoint) : Infinity;
        const compatible = baseline.type === type && baseline.seed === seed && baseline.fixedCameraEV === report.fixedCameraEV && b?.core?.measured && p.core.measured && cameraDifferenceMetres <= poseToleranceMetres && targetDifferenceMetres <= poseToleranceMetres && b.core.focalMm === p.core.focalMm && JSON.stringify(b.core.cropPixels) === JSON.stringify(p.core.cropPixels);
        return { phaseSeconds: p.phaseSeconds, compatible, poseToleranceMetres, cameraDifferenceMetres, targetDifferenceMetres, baselinePeakRawY: b?.core?.peakRawY, candidatePeakRawY: p.core.peakRawY, ratio: compatible ? p.core.peakRawY / Math.max(1e-30, b.core.peakRawY) : null };
      }); report.coreComparison = comparisons;
      check('visible burst core is lower than matching baseline', comparisons.length > 0 && comparisons.every(c => c.compatible && c.ratio <= 1 - minimumCoreReduction), { minimumCoreReduction, comparisons });
    } else report.coreComparison = { assessed: false, reason: 'baseline not supplied; core reduction remains unaccepted' };
  } catch (error) { report.error = { phase: phaseLabel, message: error.message, stack: error.stack }; check('scene fixture completes', false, report.error); }
  finally {
    clearTimeout(timeout); a.setFrameProbe(null); a.pause(true); off = false;
    if (fireworks.getLightClusters !== originals.cloud) fireworks.getLightClusters = originals.cloud;
    if (fireworks.getReceiverLightClusters !== originals.receiver) fireworks.getReceiverLightClusters = originals.receiver;
    try {
      a.setFireworks(saved.fireworks); a.setLens(saved.lens); a.setCamera(saved.camera, saved.target); a.setDiagnosticCameraEV(saved.diagnosticEV);
      await a.setTime({ utcMs: saved.clock.utcMs, ...saved.clock.observer, mode: saved.clock.mode, rate: saved.clock.rate, running: saved.clock.running, timeZoneOffsetMinutes: saved.clock.timeZoneOffsetMinutes });
      if (saved.director) a.setDirector(saved.director);
      await new Promise(resolve => { const timer = setTimeout(resolve, 3000); a.setFrameProbe(() => { clearTimeout(timer); resolve(); }); });
      report.restore = { getters: fireworks.getLightClusters === originals.cloud && fireworks.getReceiverLightClusters === originals.receiver, renderer: renderer.render === originals.render, preferences: true, physicalTimeRewound: false }; a.pause(saved.paused);
    } catch (error) { report.restore = { passed: false, error: String(error.stack || error) }; }
    target.dispose(); probeMaterial.dispose(); probeGeometry.dispose();
  }
  check('temporary getter/render hooks restored', report.restore?.getters && report.restore?.renderer && report.restore?.preferences, report.restore);
  report.passed = report.checks.every(c => c.passed); report.coreReductionAccepted = !!baseline && report.checks.some(c => c.name === 'visible burst core is lower than matching baseline' && c.passed); return report;
}
