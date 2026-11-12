// Actual-scene QA. Run in a fresh isolated page; the parent schedules GPU use.
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
const clone = value => structuredClone(value);
const luminance = rgb => .2126 * rgb[0] + .7152 * rgb[1] + .0722 * rgb[2];
const kinds = ['sand', 'vegetation', 'water'];
const chroma = rgb => { const s = rgb.reduce((a, b) => a + Math.max(0, b), 0); return s ? rgb.map(v => Math.max(0, v) / s) : [0, 0, 0]; };
const distance = (a, b) => Math.hypot(...a.map((v, i) => v - b[i]));
async function until(test, label, limit = 45000) {
  const deadline = performance.now() + limit;
  while (!test()) { if (performance.now() > deadline) throw Error('Timed out: ' + label); await sleep(12); }
}
function sourceSummary(clusters) {
  const rgb = [0, 0, 0], p = [0, 0, 0]; let weight = 0;
  for (const c of clusters) {
    const i = c.referenceCandela ?? c.candela ?? c.intensity ?? 0, colour = c.linearColor ?? c.color ?? [1, 1, 1], w = Math.max(0, luminance(colour) * i);
    weight += w; for (let k = 0; k < 3; k++) { rgb[k] += colour[k] * i; p[k] += c.position[k] * w; }
  }
  return { count: clusters.length, referenceRGB: rgb, referenceY: luminance(rgb), chromaticityRGB: chroma(rgb), centroidMetres: weight ? p.map(v => v / weight) : null };
}
function raw(capture, pixel, channel) { return capture.colour[pixel * 4 + channel] / 2 ** capture.storageEV; }
function differences(on, off, repeat, mask) {
  const groups = Object.fromEntries(kinds.map(id => [id, { samples: 0, positivePixels: 0, negativePixels: 0, sumRGB: [0, 0, 0], signalSquared: 0, repeatSquared: 0, peakY: 0, noisePeakY: 0 }]));
  let nonfiniteSamples = 0;
  for (let p = 0; p < mask.length; p++) {
    const g = groups[mask[p]]; if (!g) continue;
    const delta = [0, 1, 2].map(c => raw(on, p, c) - raw(off, p, c)), noise = [0, 1, 2].map(c => raw(on, p, c) - raw(repeat, p, c));
    if (![...delta, ...noise].every(Number.isFinite)) { nonfiniteSamples++; continue; }
    const dy = luminance(delta), ny = Math.abs(luminance(noise)), floor = Math.max(1e-18, 4 * ny, Math.abs(luminance([0, 1, 2].map(c => raw(on, p, c)))) * .0015);
    g.samples++; g.positivePixels += Number(dy > floor); g.negativePixels += Number(dy < -floor); g.peakY = Math.max(g.peakY, dy); g.noisePeakY = Math.max(g.noisePeakY, ny);
    for (let c = 0; c < 3; c++) { g.sumRGB[c] += delta[c]; g.signalSquared += delta[c] ** 2; g.repeatSquared += noise[c] ** 2; }
  }
  for (const g of Object.values(groups)) {
    g.meanDeltaRGB = g.sumRGB.map(v => v / Math.max(1, g.samples)); g.meanDeltaY = luminance(g.meanDeltaRGB); g.chromaticityRGB = chroma(g.sumRGB);
    g.signalNorm = Math.sqrt(g.signalSquared); g.repeatNorm = Math.sqrt(g.repeatSquared); g.signalAboveRepeat = g.positivePixels >= 4 && g.peakY > Math.max(1e-18, g.noisePeakY * 4);
    delete g.signalSquared; delete g.repeatSquared;
  }
  return { nonfiniteSamples, receivers: groups };
}
function additiveError(combined, off, singleArms, repeat, mask) {
  const groups = Object.fromEntries(kinds.map(id => [id, { samples: 0, residual2: 0, signal2: 0, noise2: 0, fp16Bound2: 0 }]));
  for (let p = 0; p < mask.length; p++) {
    const g = groups[mask[p]]; if (!g) continue; g.samples++;
    for (let c = 0; c < 3; c++) {
      const b = raw(off, p, c), ab = raw(combined, p, c), r = raw(repeat, p, c), arms = singleArms.map(a => raw(a, p, c));
      const signal = ab - b, predicted = arms.reduce((s, v) => s + v - b, 0);
      // Each stored FP16 colour has <= half an ULP relative error in normal
      // range. Use a full ULP to cover source/readback rounding, and report it.
      const rounding = 2 ** -10 * (Math.abs(ab) + (arms.length - 1) * Math.abs(b) + arms.reduce((s, v) => s + Math.abs(v), 0));
      g.residual2 += (signal - predicted) ** 2; g.signal2 += signal ** 2; g.noise2 += (ab - r) ** 2; g.fp16Bound2 += rounding ** 2;
    }
  }
  return Object.fromEntries(Object.entries(groups).map(([id, g]) => {
    const residualNorm = Math.sqrt(g.residual2), signalNorm = Math.sqrt(g.signal2), repeatNorm = Math.sqrt(g.noise2), fp16RoundingBound = Math.sqrt(g.fp16Bound2), uncertainty = 4 * repeatNorm + fp16RoundingBound;
    return [id, { samples: g.samples, residualNorm, signalNorm, relativeResidual: residualNorm / Math.max(1e-30, signalNorm), repeatNorm, fp16RoundingBound, uncertainty, relativeTolerance: .01, resolvable: signalNorm > 10 * uncertainty, passed: signalNorm > 10 * uncertainty && residualNorm <= .01 * signalNorm + uncertainty }];
  }));
}

/** Production wrapper supplies {THREE,renderer,fireworks,lens,camera,terrainHeight,localLights}. */
export async function runMultiReceiverLightCheck(atoll, {
  THREE, renderer, fireworks, lens, camera, terrainHeight, localLights,
  seeds = [9021, 9022], azimuths = [35, 215], palettes = ['red', 'blue'], type = 'chrysanthemum',
  width = 320, height = 240, capture = true, exposureEV = null,
} = {}) {
  const a = atoll;
  if (!fireworks?.getReceiverLightClusters || !fireworks?.smokeSourceProvider?.describeCombustion || !lens?.getDiagnosticTargets || !a?.pauseAtPhysicalTime) throw Error('Pass actual production scene objects and combustion provider');
  if (a.state.graphicsContextInterrupted || a.fireworks().active || a.fireworks().queued) throw Error('Use a healthy empty isolated page');
  width = Math.max(64, Math.min(640, Math.round(width))); height = Math.max(48, Math.min(480, Math.round(height)));
  const saved = { paused: a.state.parameters.paused, lens: clone(a.state.parameters.lens), fireworks: clone(a.fireworks().settings), camera: clone(a.state.camera), target: clone(a.state.target), ev: a.diagnosticCameraEV, clock: clone(a.celestial()), director: clone(a.state.parameters.director) };
  const original = fireworks.getReceiverLightClusters, originalEnvironment = fireworks.getLightClusters, originalRender = renderer.render;
  const report = { schema: 'glass-atoll.multi-receiver-scene.v1', dateUTC: new Date().toISOString(), checks: [], phases: [], images: [], passed: false,
    method: 'Actual same-time production scene. Only the receiver getter is filtered; cloud/source getters retain the same full scene. Opaque pre-temporal RGBA16F sampled into RGBA32F and normalized by each capture storage 2^P. Light diagnostics describe shared receiver-source records; native scene participation is not inferred from a PointLight mirror.',
    limits: ['A and B are recompressed independently. Their sum is compared with normal AB as spatial approximation error, never claimed strictly linear.', 'Strict GPU superposition holds all normal AB proxy positions/radii/colours fixed and isolates each proxy without recompression.', 'Sand uses source-centre-UV depth/terrain agreement; vegetation mask includes leaves, branches and trunks; water uses the production alpha tag.', 'Sparse lifecycle snapshots establish sampled receiver coverage; natural continuity needs the separate per-rendered-frame probe.', 'No calibrated lux, subjective sound/appearance acceptance, FPS claim, or physical-time rewind.'] };
  const check = (name, passed, evidence = {}) => report.checks.push({ name, passed: !!passed, evidence });
  let arm = 'AB', frozen = [], selectedId = null, timer, phase = 'setup';
  fireworks.getReceiverLightClusters = function(...args) {
    if (arm === 'off' || arm === 'surface-off') return [];
    if (arm === 'proxy') return frozen[selectedId] ? [frozen[selectedId]] : [];
    if (arm === 'frozen') return frozen;
    if (arm === 'A' || arm === 'B') return original.call(this, { eventIds: [report.launches[arm === 'A' ? 0 : 1].id] });
    return original.apply(this, args);
  };
  // Water and air use a separate two-cluster environment path. Filter it too
  // for on/off and per-event comparisons, while fixed-proxy tests hold it AB.
  fireworks.getLightClusters = function(...args) {
    const clusters = originalEnvironment.apply(this, args);
    if (arm === 'off') return [];
    if (arm === 'A' || arm === 'B') {
      const eventId = report.launches[arm === 'A' ? 0 : 1].id;
      return clusters.filter(c => c.eventId === eventId || c.mergedEventIds?.includes(eventId));
    }
    return clusters;
  };
  const target = new THREE.WebGLRenderTarget(width, height, { type: THREE.FloatType, format: THREE.RGBAFormat, count: 2, depthBuffer: false });
  target.textures.forEach(t => { t.colorSpace = THREE.NoColorSpace; t.minFilter = t.magFilter = THREE.NearestFilter; });
  const material = new THREE.ShaderMaterial({ glslVersion: THREE.GLSL3, toneMapped: false, depthTest: false, depthWrite: false,
    uniforms: { tColour: { value: null }, tDepth: { value: null }, tVegetation: { value: null }, uSourceSize: { value: new THREE.Vector2() } },
    vertexShader: 'out vec2 vUv;void main(){vUv=uv;gl_Position=vec4(position.xy,0.,1.);}',
    fragmentShader: 'precision highp float;in vec2 vUv;uniform sampler2D tColour,tDepth,tVegetation;uniform vec2 uSourceSize;layout(location=0)out vec4 colour;layout(location=1)out vec4 meta;void main(){vec2 p=(floor(vUv*uSourceSize)+.5)/uSourceSize;colour=texture(tColour,p);meta=vec4(texture(tDepth,p).r,texture(tVegetation,p).r,colour.a,1.);}' });
  const geometry = new THREE.PlaneGeometry(2, 2), probeScene = new THREE.Scene(), probeCamera = new THREE.Camera(); probeScene.add(new THREE.Mesh(geometry, material));
  function read() {
    const source = lens.getDiagnosticTargets().opaque;
    if (!source?.depthTexture || !source.textures?.[2]) throw Error('Actual opaque depth and vegetation coverage attachment required');
    const previous = renderer.getRenderTarget(), face = renderer.getActiveCubeFace(), mip = renderer.getActiveMipmapLevel(), viewport = renderer.getViewport(new THREE.Vector4()), scissor = renderer.getScissor(new THREE.Vector4()), scissorTest = renderer.getScissorTest(), autoClear = renderer.autoClear;
    const colour = new Float32Array(width * height * 4), meta = new Float32Array(width * height * 4);
    try {
      material.uniforms.tColour.value = source.texture; material.uniforms.tDepth.value = source.depthTexture; material.uniforms.tVegetation.value = source.textures[2]; material.uniforms.uSourceSize.value.set(source.width, source.height);
      renderer.autoClear = true; renderer.setRenderTarget(target); renderer.setScissorTest(false); renderer.setViewport(0, 0, width, height); originalRender.call(renderer, probeScene, probeCamera);
      renderer.readRenderTargetPixels(target, 0, 0, width, height, colour, undefined, 0); renderer.readRenderTargetPixels(target, 0, 0, width, height, meta, undefined, 1);
    } finally { renderer.autoClear = autoClear; renderer.setRenderTarget(previous, face, mip); renderer.setViewport(viewport); renderer.setScissor(scissor); renderer.setScissorTest(scissorTest); }
    return { colour, meta, storageEV: a.photometry().storageEV, physicalTime: a.state.time, sourceSize: [source.width, source.height] };
  }
  function classify(sample) {
    return Array.from({ length: width * height }, (_, p) => {
      const k = p * 4, depth = sample.meta[k]; if (!(depth >= 0 && depth < .999999)) return null;
      if (sample.meta[k + 1] > 0) return 'vegetation';
      if (Math.abs(sample.meta[k + 2] - .70) < .012) return 'water';
      const u = (Math.floor((p % width + .5) / width * sample.sourceSize[0]) + .5) / sample.sourceSize[0], v = (Math.floor((Math.floor(p / width) + .5) / height * sample.sourceSize[1]) + .5) / sample.sourceSize[1];
      const world = new THREE.Vector3(u * 2 - 1, v * 2 - 1, depth * 2 - 1).unproject(camera), y = terrainHeight(world.x, world.z);
      return y > .15 && Math.abs(world.y - y) < .12 ? 'sand' : null;
    });
  }
  async function frame(label, image = false) {
    a.setDiagnosticCameraEV(report.fixedCameraEV);
    return new Promise((resolve, reject) => {
      timer = setTimeout(() => { a.setFrameProbe(null); reject(Error('No actual frame: ' + label)); }, 10000);
      a.setFrameProbe(() => { clearTimeout(timer); try {
        const value = read(); if (capture && image) report.images.push({ name: label + '.png', physicalTime: a.state.time, dataURL: renderer.domElement.toDataURL('image/png') }); resolve(value);
      } catch (error) { reject(error); } });
    });
  }
  async function pauseAt(time) { a.pauseAtPhysicalTime(time); if (a.state.time < time) a.pause(false); await until(() => a.state.parameters.paused, 'exact physical pause'); if (a.state.time !== time) throw Error('Physical target mismatch'); }
  try {
    a.pause(true); a.setDirector({ mode: 'off' }); await a.timePreset('stars'); await a.setTime({ running: false });
    a.setLens({ focal: 24, dof: false, vignette: false, temporal: true, temporalJitter: false, glintAA: true, opticalFlare: false, shutterSeconds: 1 / 120 });
    a.setFireworks({ type, effectProfile: 'legacy', autoLaunch: false, autoFrame: false, autoDirection: false, elevation: 78, launchSpreadDegrees: 0, burstTiltDegrees: 0, burstRollDegrees: 0, smokeQuality: 'light', persistentSmoke: false, resolvedSmokeLighting: false }); a.clearSmoke();
    a.setCamera([-65, 30, 54], [2, 3, 0], { expandFramingLimits: true }); report.fixedCameraEV = exposureEV ?? a.photometry().cameraEV;
    report.receiverLightingSetup = clone(localLights.state);
    await frame('empty-scene');
    report.launches = seeds.map((seed, i) => a.launchFirework({ type, seed, palette: palettes[i], azimuth: azimuths[i], elevation: 78, launchSpreadDegrees: 0 }));
    if (report.launches.some(l => !l.accepted || l.queued)) throw Error('Both actual events must launch immediately');
    report.metadata = report.launches.map(l => { const m = fireworks.smokeSourceProvider.describeCombustion(l.id); return { id: m.id, type: m.type, launchTime: m.launchTime, burstTime: m.burstTime, endTime: m.endTime, burnEnd: Math.max(...m.nodes.filter(n => n.role !== 'mortar-carrier').map(n => n.endTime)) }; });
    const [m] = report.metadata, burnSpan = Math.max(...report.metadata.map(v => v.burnEnd)) - m.burstTime, end = Math.max(...report.metadata.map(v => v.endTime));
    if (!report.metadata.every(v => v.burstTime === m.burstTime && v.launchTime === m.launchTime)) throw Error('Fixture requires synchronous equal-height events');
    const plan = [ ['launch', m.launchTime + .05], ['ascent', (m.launchTime + m.burstTime) / 2], ['before-burst', m.burstTime - .04], ['burst', m.burstTime + .025], ['overlap', m.burstTime + .6], ['mid-burn', m.burstTime + burnSpan * .5], ['late-burn', m.burstTime + burnSpan * .9], ['extinguished', end + .1] ].sort((a, b) => a[1] - b[1]);
    for (const [label, time] of plan) {
      phase = label; await pauseAt(time); arm = 'AB';
      const on = await frame(label + '-on', true), clusters = clone(original.call(fireworks)), mask = classify(on), lightsOn = clone(localLights.state.lights.slice(4));
      arm = 'off'; const off = await frame(label + '-off', label === 'overlap'), lightsOff = clone(localLights.state.lights.slice(4));
      arm = 'AB'; const repeat = await frame(label + '-repeat'), stats = differences(on, off, repeat, mask);
      const row = { label, physicalTime: time, phaseSeconds: time - m.burstTime, storageEVs: [on.storageEV, off.storageEV, repeat.storageEV], source: sourceSummary(clusters), clusters, lightsOn, lightsOff, ...stats };
      check(label + ': exact same time and finite captures', [on, off, repeat].every(v => v.physicalTime === time) && stats.nonfiniteSamples === 0);
      check(label + ': shared receiver-source records are zero in off arm', lightsOff.every(l => l.candela === 0 && l.rawRGB.every(v => v === 0)), lightsOff);
      if (label !== 'extinguished') check(label + ': both event subsets contain luminous sources', report.launches.every(l => sourceSummary(original.call(fireworks, { eventIds: [l.id] })).referenceY > 0));
      if (label === 'overlap') {
        frozen = clone(clusters); arm = 'frozen'; const fixedAB = await frame('overlap-fixedAB');
        arm = 'surface-off'; const surfaceOff = await frame('overlap-surface-off');
        const singleArms = [];
        for (let i = 0; i < frozen.length; i++) { arm = 'proxy'; selectedId = i; singleArms.push(await frame('overlap-fixed-proxy-' + i)); }
        arm = 'frozen'; const fixedRepeat = await frame('overlap-fixed-repeat');
        row.fixedProxySuperposition = { proxyCount: frozen.length, method: 'Every normal AB receiver proxy retained at its exact position, radius, colour and intensity; environment clusters remain AB, without recompression.', receivers: additiveError(fixedAB, surfaceOff, singleArms, fixedRepeat, mask) };
        for (const id of kinds) { const v = row.fixedProxySuperposition.receivers[id]; check('fixed-proxy residual within FP16 readback bound: ' + id, v.residualNorm <= .01 * v.signalNorm + v.uncertainty, v); }
        check('fixed-proxy vegetation signal resolves above FP16 uncertainty', row.fixedProxySuperposition.receivers.vegetation.resolvable, row.fixedProxySuperposition.receivers.vegetation);
        arm = 'A'; const onlyA = await frame('overlap-only-A'), repeatA = await frame('overlap-only-A-repeat'), sourceA = sourceSummary(original.call(fireworks, { eventIds: [report.launches[0].id] }));
        arm = 'B'; const onlyB = await frame('overlap-only-B'), repeatB = await frame('overlap-only-B-repeat'), sourceB = sourceSummary(original.call(fireworks, { eventIds: [report.launches[1].id] }));
        row.eventSubsetComparison = { sourceA, sourceB, onlyA: differences(onlyA, off, repeatA, mask), onlyB: differences(onlyB, off, repeatB, mask), marginalA: differences(on, onlyB, repeat, mask), marginalB: differences(on, onlyA, repeat, mask), approximationError: additiveError(on, off, [onlyA, onlyB], repeat, mask), approximationErrorIsAcceptanceCriterion: false };
        check('event filter distinguishes red and blue events', distance(sourceA.chromaticityRGB, sourceB.chromaticityRGB) > .05, { sourceA, sourceB });
        for (const id of kinds) check('each event contributes to actual combined receiver: ' + id, row.eventSubsetComparison.marginalA.receivers[id].signalAboveRepeat && row.eventSubsetComparison.marginalB.receivers[id].signalAboveRepeat, { marginalA: row.eventSubsetComparison.marginalA.receivers[id], marginalB: row.eventSubsetComparison.marginalB.receivers[id] });
      }
      report.phases.push(row); arm = 'AB';
    }
    for (const id of kinds) {
      const illuminated = report.phases.filter(p => p.label !== 'extinguished');
      check(id + ': sufficient actual receiver coverage', illuminated.every(p => p.receivers[id].samples >= 8), illuminated.map(p => ({ phase: p.label, samples: p.receivers[id].samples })));
      check(id + ': launch, ascent, burst and mid-burn illuminate receiver', ['launch', 'ascent', 'burst', 'mid-burn'].every(label => report.phases.find(p => p.label === label).receivers[id].signalAboveRepeat), report.phases.map(p => ({ phase: p.label, signal: p.receivers[id].signalAboveRepeat, peakY: p.receivers[id].peakY })));
    }
    const live = report.phases.filter(p => p.source.referenceY > 0), first = live[0];
    report.evolution = { luminance: live.map(p => p.source.referenceY), positionRangeMetres: Math.max(...live.map(p => distance(p.source.centroidMetres, first.source.centroidMetres))), colourRange: Math.max(...live.map(p => distance(p.source.chromaticityRGB, first.source.chromaticityRGB))) };
    check('actual light centroid moves through lifecycle', report.evolution.positionRangeMetres > 1, report.evolution);
    const dark = report.phases.find(p => p.label === 'extinguished');
    check('shared receiver sources are zero after combustion and optical tails finish', dark.source.count === 0 && dark.lightsOn.every(l => l.candela === 0), { source: dark.source, lights: dark.lightsOn });
    report.gl = a.readGLErrors('multi-receiver-scene'); check('no GL errors', report.gl.errors.length === 0, report.gl);
  } catch (error) { report.error = { phase, message: error.message, stack: error.stack }; check('actual scene fixture completes', false, report.error); }
  finally {
    clearTimeout(timer); a.setFrameProbe(null); a.pause(true); fireworks.getReceiverLightClusters = original; fireworks.getLightClusters = originalEnvironment;
    try {
      a.setFireworks(saved.fireworks); a.setLens(saved.lens); a.setCamera(saved.camera, saved.target); a.setDiagnosticCameraEV(saved.ev);
      await a.setTime({ utcMs: saved.clock.utcMs, ...saved.clock.observer, mode: saved.clock.mode, rate: saved.clock.rate, running: saved.clock.running, timeZoneOffsetMinutes: saved.clock.timeZoneOffsetMinutes });
      if (saved.director) a.setDirector(saved.director); a.pause(saved.paused);
      report.restore = { receiverGetter: fireworks.getReceiverLightClusters === original, render: renderer.render === originalRender, preferences: true, physicalTimeRewound: false };
    } catch (error) { report.restore = { error: String(error.stack || error) }; }
    target.dispose(); material.dispose(); geometry.dispose();
  }
  check('temporary hooks and preferences restored', report.restore?.receiverGetter && report.restore?.render && report.restore?.preferences, report.restore);
  report.passed = report.checks.every(c => c.passed); return report;
}
