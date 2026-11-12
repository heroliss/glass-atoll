const { chromium } = require('playwright');
const fs = require('node:fs/promises');
const path = require('node:path');
const { createHash } = require('node:crypto');

// Run explicitly, with the normal glass-atoll server already listening:
// node glass-atoll/verification/lighting-choreography/kernel-viewport-gpu.cjs
// Owns one isolated headless Chrome and one separate production effect/GL
// context. It never borrows or changes the application's renderer or sources.
const root = path.resolve(__dirname, '../..');
const fixtureFile = path.join(__dirname, 'before-viewport-budget/natural-before-wiring.json');
const spikeFile = path.join(__dirname, 'before-viewport-budget/spike-before-quad.json');
const sweepDenseFile = path.join(__dirname, 'budget-dense-scan-before-sweep.json');
const sweepNaturalFile = path.join(__dirname, 'before-viewport-budget/natural-before-sweep.json');
const outputFile = path.join(__dirname, 'kernel-viewport-gpu.json');
const sha = value => createHash('sha256').update(value).digest('hex');
const sourceFiles = [
  'main.js', 'fireworks.js', 'fireworks-physics.js', 'firework-exposure-window.js',
  'wind-response.js', 'firework-trail-profile.js', 'firework-tail-field.js',
  'firework-contact-support.js', 'firework-contact-optics.js',
  'firework-powered-optics.js', 'firework-show-envelope.js',
  'complex-fireworks.js', 'complex-fireworks-style.js',
  'complex-fireworks-motion.js', 'firework-receiver-lighting.js',
  'vendor/three.module.js', 'vendor/three.core.js',
];
async function hashes() {
  return Object.fromEntries(await Promise.all(sourceFiles.map(async name => [name, sha(await fs.readFile(path.join(root, name)))])));
}

(async () => {
  const sourceHashes = await hashes();
  const fixtureBytes = await fs.readFile(fixtureFile);
  const fixture = JSON.parse(fixtureBytes);
  const spikeBytes = await fs.readFile(spikeFile);
  const spikeFixture = JSON.parse(spikeBytes);
  const sweepDenseBytes = await fs.readFile(sweepDenseFile), sweepDense = JSON.parse(sweepDenseBytes);
  const sweepNaturalBytes = await fs.readFile(sweepNaturalFile), sweepNatural = JSON.parse(sweepNaturalBytes);
  const sweepCandidates = [
    ...sweepDense.spikes.flatMap((frame, rowIndex) => frame.retained.map((item, topIndex) => ({ fixtureKind: 'sweep-dense', rowIndex, topIndex,
      phase: frame.phase, source: item.source, fixtureBound: item.bound, optics: sweepDense.optics, requiredRemainingTail: true }))),
    ...(sweepNatural.frames || []).flatMap((frame, rowIndex) => (frame.main?.top || []).map((item, topIndex) => ({ fixtureKind: 'sweep-natural', rowIndex, topIndex,
      phase: frame.phase, source: item.source, fixtureBound: item.bound || item, optics: sweepDense.optics, requiredRemainingTail: false }))),
  ].filter(item => item.source && !item.source.vectorEmission && item.source.kind !== 'smoke');
  if (sweepCandidates.filter(item => item.requiredRemainingTail).length < 5) throw Error('Archived dense sweep fixture lost its five remaining scalar tails');
  const productionSource = await fs.readFile(path.join(root, 'fireworks.js'), 'utf8');
  const apiAnchor = 'const api={rig,effectsScene,types:FIREWORK_TYPES,smokeSourceProvider,';
  if (productionSource.split(apiAnchor).length !== 2) throw Error('QA seam anchor must match exactly once');
  // Test-module-only record injection. Original opticalRows, source culling,
  // getRadianceBound and fillRecords consume these same scalar source objects.
  // There are no post-render buffer edits in the sweep-path checks.
  const qaSource = productionSource.replace(apiAnchor, apiAnchor+'__qaSetRows(rows){if(!Array.isArray(rows)||rows.some(p=>p.vectorEmission))throw new TypeError(\'QA seam accepts scalar optical rows only\');invalidatePreparedSourceViews(\'qa-record-injection\');records=rows;recordsGeneration++;boundCache=null;clusterCache=null;receiverClusterCache=null;},');
  const savedMain = await fs.readFile(path.join(__dirname, 'before-viewport-budget/main.js'), 'utf8');
  const probeSource = await fs.readFile(path.join(__dirname, 'natural-light-probe.cjs'), 'utf8');
  if (!savedMain.includes('shutterSeconds:l?.shutterSeconds??parameters.lens.shutterSeconds??1/120')) throw Error('Archived fixture shutter provenance changed');
  if (!probeSource.includes('a.setLens({focal:24})')) throw Error('Fixture probe no longer documents the 24mm/default-shutter setup');
  const extract = (data, fixtureKind) => data.rows.flatMap((row, rowIndex) => (row.mainBound?.top || []).map((top, topIndex) => ({
    fixtureKind, rowIndex, topIndex, phase: row.phase, physicalTime: row.photometry?.frame?.time,
    fixtureBound: { peak: top.peak, rect: top.rect, nearPlaneFallback: top.nearPlaneFallback, projected: top.projected },
    source: top.source,
    // This legacy trace did not include shutter or emission-bin weights. Its
    // probe changes only focal length, so the archived production default is
    // the evidence for 1/120 s. Unit bin weights are a positive full-emission
    // envelope: an exactly-zero spatial kernel remains zero for real weights.
    shutterSeconds: row.mainBound?.mainLastRender?.legacyShutterSeconds ?? 1 / 120,
    firelightSigmaPixels: row.mainBound?.mainLastRender?.firelightSigmaPixels ?? .42,
  })));
  const candidates = extract(fixture, 'natural');
  const spikeCandidates = extract(spikeFixture, 'spike').filter(item => item.fixtureBound.nearPlaneFallback && item.source.kind !== 'smoke' && item.source.stretch.every(v => v === 0));
  if (!candidates.length) throw Error('Fixture has no mainBound.top sources');
  if (spikeCandidates.length !== 2) throw Error(`Expected two archived nontrail near-plane spike sources; found ${spikeCandidates.length}`);
  if (JSON.stringify(spikeFixture.launch) !== JSON.stringify(fixture.launch)) throw Error('Spike and natural fixtures use different launches');
  const report = {
    schema: 'glass-atoll.firework-kernel-viewport-gpu.v1', date: new Date().toISOString(), passed: false,
    verifierSha256: sha(await fs.readFile(__filename)), sourceHashes,
    fixture: { file: path.relative(root, fixtureFile).replaceAll('\\', '/'), sha256: sha(fixtureBytes),
      savedMainSha256: sha(savedMain), probeSha256: sha(probeSource), rows: fixture.rows.length, tracedTopSources: candidates.length },
    spikeFixture: { file: path.relative(root, spikeFile).replaceAll('\\', '/'), sha256: sha(spikeBytes), rows: spikeFixture.rows.length,
      nontrailNearSpikeSources: spikeCandidates.length },
    sweepFixtures: { dense: { file: path.relative(root, sweepDenseFile).replaceAll('\\', '/'), sha256: sha(sweepDenseBytes) },
      natural: { file: path.relative(root, sweepNaturalFile).replaceAll('\\', '/'), sha256: sha(sweepNaturalBytes) },
      candidates: sweepCandidates.length, remainingDenseTails: sweepCandidates.filter(item => item.requiredRemainingTail).length, qaSourceSha256: sha(qaSource),
      seam: 'Only __qaSetRows record setter is added in a QA blob; original opticalRows, source cull, fillRecords, material and getRadianceBound run unchanged' },
    provenance: { geometry: 'position, velocity, stretch, radius, colour, and unmodulatedIntensity are copied without scaling from the archived real source trace',
      shutter: 'legacy source trace lacks shutter; 1/120 s is the archived currentOptics fallback, unchanged by this probe',
      temporalWeights: 'eight unit weights: full unmodulated emission envelope; exact spatial zero is independent of the omitted positive real bin means',
      selection: 'all archived natural mainBound.top scalar emitters for which the current kernel classifier returns outside; not restricted to old nearPlaneFallback',
      quadSelection: 'the two archived spike nontrail sources with near-plane fallback must have complete-quad-outside visibility and exact zero pixels in all four combinations' },
    issues: [], limits: ['This checks the real production shader at one 960x720 camera and these traced sources; it is not a universal proof or a frame-rate measurement.',
      'Swept-domain culling intentionally corrects misleading recentered projected streaks: its disabled baseline may contain lit pixels, so no old-shader-zero claim is made for sweep fixtures.',
      'The production aggregator is also called on independently replayed production records with the Float32 budget gate both off and on; no private record injection or production hook is added.'],
  };
  let browser;
  try {
    browser = await chromium.launch({ headless: true, executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe' });
    const context = await browser.newContext({ viewport: { width: 960, height: 720 } });
    const page = await context.newPage();
    page.on('pageerror', error => report.issues.push(String(error)));
    page.on('console', message => { if (message.type() === 'error') report.issues.push(message.text()); });
    await page.goto('http://127.0.0.1:5186/', { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => window.__ATOLL__?.state.ready, null, { timeout: 180000 });
    await page.evaluate(() => window.__ATOLL__.pause(true));
    report.gpu = await page.evaluate(async ({ candidates, spikeCandidates, sweepCandidates, qaSource, fixture, spikeFixture }) => {
      const THREE = await import('./vendor/three.module.js');
      const { createFireworks, getFireworkSourceBound, classifyFireworkKernelViewport, classifyFireworkSourceVisibility, classifyFireworkSweepViewport } = await import('./fireworks.js');
      const width = 960, height = 720, raw = 3.6e-5, checks = [], draws = [], combinations = [], aggregator = [], sweepDraws = [], sweepControls = [], errors = [], shaderErrors = [];
      const check = (name, passed, detail = {}) => checks.push({ name, passed: !!passed, detail });
      const renderer = new THREE.WebGLRenderer({ canvas: document.createElement('canvas'), antialias: false, alpha: true, powerPreference: 'high-performance' });
      renderer.setPixelRatio(1); renderer.setSize(width, height, false); renderer.autoClear = false;
      renderer.shadowMap.autoUpdate = false; renderer.shadowMap.needsUpdate = false;
      renderer.toneMapping = THREE.NoToneMapping;
      renderer.debug.checkShaderErrors = true;
      renderer.debug.onShaderError = (gl, program, vertex, fragment) => shaderErrors.push({ program: gl.getProgramInfoLog(program), vertex: gl.getShaderInfoLog(vertex), fragment: gl.getShaderInfoLog(fragment) });
      const gl = renderer.getContext(), debug = gl.getExtension('WEBGL_debug_renderer_info');
      const device = { renderer: gl.getParameter(gl.RENDERER), vendor: gl.getParameter(gl.VENDOR), version: gl.getParameter(gl.VERSION),
        unmaskedRenderer: debug ? gl.getParameter(debug.UNMASKED_RENDERER_WEBGL) : null,
        unmaskedVendor: debug ? gl.getParameter(debug.UNMASKED_VENDOR_WEBGL) : null };
      renderer.domElement.addEventListener('webglcontextlost', () => errors.push({ stage: 'context', error: 'webglcontextlost' }));
      const drain = stage => { const found = []; for (let i = 0; i < 32; i++) { const error = gl.getError(); if (error === gl.NO_ERROR) break; found.push(error); } if (found.length) errors.push({ stage, codes: found }); return found; };
      const colorFloat = !!gl.getExtension('EXT_color_buffer_float'), floatBlend = !!gl.getExtension('EXT_float_blend');
      const highp = [gl.VERTEX_SHADER, gl.FRAGMENT_SHADER].map(stage => { const format = gl.getShaderPrecisionFormat(stage, gl.HIGH_FLOAT);
        return { stage, precision: format?.precision, rangeMin: format?.rangeMin, rangeMax: format?.rangeMax }; });
      const float32Gate = highp.every(format => format.precision >= 23 && format.rangeMin >= 126 && format.rangeMax >= 127);
      check('actual_context_satisfies_production_Float32_highp_gate', float32Gate, { highp });
      if (!float32Gate) throw Error('The actual GL context does not satisfy the production Float32 gate');
      check('required_RGBA32F_render_and_blend_extensions', colorFloat && floatBlend, { colorFloat, floatBlend });
      if (!colorFloat || !floatBlend) throw Error('RGBA32F blending needs EXT_color_buffer_float and EXT_float_blend');
      const camera = new THREE.PerspectiveCamera(40, width / height, .15, 120000);
      camera.filmGauge = 36; camera.setFocalLength(24); camera.position.set(-65, 30, 54); camera.lookAt(2, 3, 0); camera.updateMatrixWorld();
      const baseOptics = { width, height, focalMm: 24, aperture: 8, focusMetres: 60, sensorHeightMm: camera.getFilmHeight(),
        shutterSeconds: 1 / 120, legacyShutterSeconds: 1 / 120, firelightSigmaPixels: .42, vignette: false };
      const target = new THREE.WebGLRenderTarget(width, height, { type: THREE.FloatType, format: THREE.RGBAFormat,
        minFilter: THREE.NearestFilter, magFilter: THREE.NearestFilter, depthBuffer: false, stencilBuffer: false, samples: 0 });
      target.texture.internalFormat = 'RGBA32F'; target.texture.colorSpace = THREE.NoColorSpace; target.texture.generateMipmaps = false;
      const effect = createFireworks(THREE, { origin: [0, 0, 0], terrainHeight: () => 0, seed: 17, sourceVisibility: 'none' });
      const replay = fixture.launch, az = replay.azimuth * Math.PI / 180, el = replay.elevation * Math.PI / 180;
      const axis = [Math.sin(az) * Math.cos(el), Math.sin(el), -Math.cos(az) * Math.cos(el)];
      const base = [replay.origin[0] - .66 * axis[0], 0, replay.origin[2] - .66 * axis[2]];
      const ground = replay.origin[1] - .66 * axis[1] - .17 - .04;
      const aggregateEffect = createFireworks(THREE, { origin: base, terrainHeight: () => ground, seed: 14271, sourceVisibility: 'none',
        simulationOptions: { referenceBrightnessGain: 64, maxActive: 32 } });
      const absoluteQaSource = qaSource.replace(/from\s+(['"])(\.[^'"]+)\1/g, (_, quote, relative) => 'from '+quote+new URL(relative, new URL('./fireworks.js', location.href)).href+quote);
      const qaURL = URL.createObjectURL(new Blob([absoluteQaSource], { type: 'text/javascript' }));
      const { createFireworks: createQaFireworks } = await import(qaURL);
      URL.revokeObjectURL(qaURL);
      const sweepEffect = createQaFireworks(THREE, { terrainHeight: () => 0, origin: [0, 0, 0], sourceVisibility: 'conservative', sweptSourceVisibility: true });
      const sweepBaseline = createQaFireworks(THREE, { terrainHeight: () => 0, origin: [0, 0, 0], sourceVisibility: 'conservative', sweptSourceVisibility: false });
      const pixels = new Float32Array(width * height * 4);
      let attachment, productionShaders;
      const restoreSource = s => ({ ...s, position: s.positionInputFloat32 ? new Float32Array(s.position) : [...s.position] });
      const hashText = async value => Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value))), v => v.toString(16).padStart(2, '0')).join('');
      const eligibility = (source, bound, projected, optics) => projected && bound.visible && source.kind !== 'smoke' &&
        classifyFireworkSourceVisibility(source, camera, optics).reason !== 'homogeneous-depth' &&
        (bound.nearPlaneFallback || Math.max(...bound.stretchPixels.map(Math.abs), ...bound.shutterPixels.map(Math.abs)) > 4 * Math.max(width, height));
      function draw(source, optics, trailIntegration, name) {
        effect.configure({ trailIntegration: trailIntegration === 'legacy' ? 'legacy8' : 'adaptive' });
        renderer.setRenderTarget(target); renderer.setClearColor(0, 0); renderer.clear(true, false, false);
        // Production render prepares its actual matrices, depth sampler,
        // physical shutter, DOF, colour path and adaptive uniform first.
        effect.render({ renderer, target, camera, frame: { storageEV: 0, rawPerCandela: raw }, optics, air: { enabled: false } });
        const mesh = effect.effectsScene.children[0], geometry = mesh.geometry, material = mesh.material;
        if (source.vectorEmission) throw Error('Archived vector sources need their real RGB bin trace; not available in this fixture');
        const values = { aCentre: source.position, aVelocity: source.velocity, aStretch: source.stretch, aColour: source.colour,
          aShape: [0, source.radius, source.unmodulatedIntensity, 0], aSmokeLight: [0, 0, 0],
          aTemporal0: [1, 1, 1, 1], aTemporal1: [1, 1, 1, 1], aTemporal2: [0, 0, 0, 0],
          aTemporal3: [0, 0, 0, 0], aTemporal4: [0, 0, 0, 0], aTemporal5: [0, 0, 0, 0] };
        for (const [key, value] of Object.entries(values)) {
          const attribute = geometry.getAttribute(key); attribute.array.set(value, 0);
          attribute.clearUpdateRanges(); attribute.addUpdateRange(0, attribute.itemSize); attribute.needsUpdate = true;
        }
        geometry.instanceCount = 1;
        renderer.setRenderTarget(target); renderer.setClearColor(0, 0); renderer.clear(true, false, false);
        renderer.render(effect.effectsScene, camera);
        pixels.fill(NaN); renderer.readRenderTargetPixels(target, 0, 0, width, height, pixels);
        let nonzeroComponents = 0, nonfiniteComponents = 0, litPixels = 0, peakRGB = 0, peakAlpha = 0, firstNonzero = null;
        for (let i = 0; i < pixels.length; i += 4) {
          let lit = false;
          for (let c = 0; c < 4; c++) { const value = pixels[i + c];
            if (!Number.isFinite(value)) nonfiniteComponents++;
            if (value !== 0) { nonzeroComponents++; if (!firstNonzero) firstNonzero = { pixel: i / 4, x: (i / 4) % width, y: Math.floor(i / 4 / width), channel: c, value }; }
            if (c < 3) { peakRGB = Math.max(peakRGB, value); lit ||= value > 0; } else peakAlpha = Math.max(peakAlpha, value);
          }
          if (lit) litPixels++;
        }
        return { nonzeroComponents, nonfiniteComponents, litPixels, peakRGB, peakAlpha, firstNonzero, errors: drain(name),
          uniformShutterSeconds: material.uniforms.uLegacyShutter.value, adaptiveUniform: material.uniforms.uTrailAdaptive.value,
          dofUniform: material.uniforms.uDof.value, instanceCount: geometry.instanceCount,
          drawCalls: renderer.info.render.calls, triangles: renderer.info.render.triangles };
      }
      // Independent binary64 geometry check. Uses the four physical world
      // corners and camera matrices directly, without the production interval
      // implementation or the projected endpoint-difference quad.
      function physicalSweepProof(source, optics) {
        const velocity = source.rasterVelocity ?? source.velocity ?? [0, 0, 0], stretch = source.stretch ?? [0, 0, 0];
        const exposure = source.vectorEmission ? source.rasterExposureSeconds ?? source.viewExposure?.durationSeconds ?? optics.shutterSeconds : optics.legacyShutterSeconds ?? optics.shutterSeconds;
        const trail = stretch.reduce((sum, v) => sum + v * v, 0) > 1e-12, corners = [];
        for (const spatial of [-1, 1]) for (const temporal of [-1, 1]) {
          const world = Array.from(source.position, (value, axis) => value + (trail ? spatial * stretch[axis] / 2 : 0) + temporal * velocity[axis] * exposure / 2);
          const clip = new THREE.Vector4(...world, 1).applyMatrix4(camera.matrixWorldInverse).applyMatrix4(camera.projectionMatrix);
          corners.push({ spatial, temporal, world, clip: clip.toArray(), planes: [clip.x - clip.w, -clip.x - clip.w, clip.y - clip.w, -clip.y - clip.w] });
        }
        const depths = corners.map(corner => corner.clip[3]), minimumDepth = Math.max(.001, Math.min(...depths)), maximumDepth = Math.max(.001, Math.max(...depths));
        const worldSigma = source.radius * Math.abs(camera.projectionMatrix.elements[5]) * optics.height / (2 * minimumDepth) * .70710678;
        const focal = optics.focalMm, focus = Math.max(focal + 1, optics.focusMetres * 1000);
        const cocAt = depth => { const s = depth * 1000; return Math.abs(focal * focal * (s - focus) / (optics.aperture * Math.max(s, focal + 1) * (focus - focal))) / optics.sensorHeightMm * optics.height / 2; };
        const cocDepths = [minimumDepth, maximumDepth];
        if (minimumDepth * 1000 < focal + 1 && maximumDepth * 1000 > focal + 1) cocDepths.push((focal + 1) / 1000);
        const maximumCoC = optics.dof ? Math.max(...cocDepths.map(cocAt)) : 0;
        const sigma2 = Math.max(.0784 + 1 / 24 + worldSigma * worldSigma + maximumCoC * maximumCoC / 4, optics.firelightSigmaPixels ** 2);
        // Slightly wider than the binary64 support value, so comparison is
        // strict even if a receipt rounds printed decimal values.
        const supportPixels = (16 * Math.sqrt(sigma2) + 2) * 1.0001 + .0001;
        const maximumAbsW = Math.max(...depths.map(Math.abs)), padX = 2 * supportPixels * maximumAbsW / optics.width, padY = 2 * supportPixels * maximumAbsW / optics.height;
        const minimumPlanes = [0, 1, 2, 3].map(axis => Math.min(...corners.map(corner => corner.planes[axis])));
        const pads = [padX, padX, padY, padY], strictMargins = minimumPlanes.map((value, i) => value - pads[i]);
        const index = strictMargins.indexOf(Math.max(...strictMargins)), finite = [...minimumPlanes, ...pads, ...strictMargins].every(Number.isFinite);
        return { outside: finite && strictMargins[index] > 1e-7, sameSidePlane: ['right', 'left', 'top', 'bottom'][index],
          minimumPlanes, pads, strictMargins, chosenStrictMargin: strictMargins[index], corners, minimumDepth, maximumDepth,
          worldSigma, maximumCoC, sigma2, supportPixels, exposureSeconds: exposure,
          scope: 'independent binary64 physical four-corner common side-plane exclusion, wider Gaussian/DOF support; not the old shader footprint' };
      }
      function readUploaded(effectOwner, source, optics, trailIntegration, name) {
        effectOwner.configure({ trailIntegration: trailIntegration === 'legacy' ? 'legacy8' : 'adaptive' });
        effectOwner.__qaSetRows([source]);
        const budgetOff = effectOwner.getRadianceBound({ camera, optics: { ...optics, kernelBudgetFloat32: false }, rawPerCandela: raw });
        const budgetOn = effectOwner.getRadianceBound({ camera, optics: { ...optics, kernelBudgetFloat32: true }, rawPerCandela: raw });
        renderer.setRenderTarget(target); renderer.setClearColor(0, 0); renderer.clear(true, false, false);
        // Production render owns opticalRows -> prepareSourceRows -> actual
        // cull -> fillRecords -> instanceCount -> production material draw.
        // Nothing writes attributes or instanceCount after this call.
        effectOwner.render({ renderer, target, camera, frame: { storageEV: 0, rawPerCandela: raw }, optics, air: { enabled: false } });
        pixels.fill(NaN); renderer.readRenderTargetPixels(target, 0, 0, width, height, pixels);
        let nonzeroComponents = 0, nonfiniteComponents = 0, litPixels = 0, peakRGB = 0;
        for (let i = 0; i < pixels.length; i += 4) { let lit = false;
          for (let c = 0; c < 4; c++) { const value = pixels[i + c]; if (!Number.isFinite(value)) nonfiniteComponents++; if (value !== 0) nonzeroComponents++;
            if (c < 3) { peakRGB = Math.max(peakRGB, value); lit ||= value > 0; } }
          if (lit) litPixels++;
        }
        const mesh = effectOwner.effectsScene.children[0], diagnostics = effectOwner.diagnostics();
        return { nonzeroComponents, nonfiniteComponents, litPixels, peakRGB, instanceCount: mesh.geometry.instanceCount,
          lastRender: diagnostics.lastRender, sweptSourceVisibility: diagnostics.sweptSourceVisibility === true,
          budgetOff, budgetOn, errors: drain(name) };
      }
      try {
        effect.update({ time: 0 }); effect.launch(); effect.update({ time: .2 });
        renderer.setRenderTarget(target); renderer.clear(true, false, false);
        const component = pname => gl.getFramebufferAttachmentParameter(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, pname);
        attachment = { width, height, status: gl.checkFramebufferStatus(gl.FRAMEBUFFER), expectedComplete: gl.FRAMEBUFFER_COMPLETE,
          componentType: component(gl.FRAMEBUFFER_ATTACHMENT_COMPONENT_TYPE), expectedFloat: gl.FLOAT,
          bits: [gl.FRAMEBUFFER_ATTACHMENT_RED_SIZE, gl.FRAMEBUFFER_ATTACHMENT_GREEN_SIZE, gl.FRAMEBUFFER_ATTACHMENT_BLUE_SIZE, gl.FRAMEBUFFER_ATTACHMENT_ALPHA_SIZE].map(component),
          internalFormat: target.texture.internalFormat, samples: target.samples };
        check('actual_target_is_complete_960x720_RGBA32F', attachment.status === gl.FRAMEBUFFER_COMPLETE && attachment.componentType === gl.FLOAT && attachment.bits.every(v => v === 32) && target.samples === 0, attachment);
        const material = effect.effectsScene.children[0].material;
        productionShaders = { vertexSha256: await hashText(material.vertexShader), fragmentSha256: await hashText(material.fragmentShader),
          materialName: material.name, glslVersion: material.glslVersion, productionSceneName: effect.effectsScene.name };
        const qaMaterial = sweepEffect.effectsScene.children[0].material;
        const qaShaders = { vertexSha256: await hashText(qaMaterial.vertexShader), fragmentSha256: await hashText(qaMaterial.fragmentShader), qaModuleSha256: await hashText(absoluteQaSource) };
        check('QA_record_seam_preserves_exact_production_shaders', qaShaders.vertexSha256 === productionShaders.vertexSha256 && qaShaders.fragmentSha256 === productionShaders.fragmentSha256, qaShaders);
        productionShaders.qa = qaShaders;
        const allSelection = new Map();
        for (const trailIntegration of ['legacy', 'adaptive']) for (const dof of [false, true]) {
          const optics = { ...baseOptics, trailIntegration, dof };
          const selected = candidates.filter(item => item.source.kind !== 'smoke' && classifyFireworkKernelViewport(restoreSource(item.source), camera, { ...optics,
            shutterSeconds: item.shutterSeconds, legacyShutterSeconds: item.shutterSeconds, firelightSigmaPixels: item.firelightSigmaPixels }).outside);
          const summary = { trailIntegration, dof, selected: selected.length, oldNearFallback: selected.filter(v => v.fixtureBound.nearPlaneFallback).length,
            productionBudgetEligible: 0, failed: 0, totalNonzeroComponents: 0, totalNonfiniteComponents: 0 };
          check(`${trailIntegration}_dof_${dof}_has_real_excluded_trace_sources`, selected.length > 0, { count: selected.length });
          for (const item of selected) {
            const source = restoreSource(item.source), actualOptics = { ...optics, shutterSeconds: item.shutterSeconds,
              legacyShutterSeconds: item.shutterSeconds, firelightSigmaPixels: item.firelightSigmaPixels };
            const bound = getFireworkSourceBound(source, camera, actualOptics, raw);
            const eligible = eligibility(source, bound, bound.depth > .01, actualOptics); summary.productionBudgetEligible += Number(eligible);
            const id = `${item.fixtureKind}-row${item.rowIndex}-top${item.topIndex}`; allSelection.set(id, item);
            const readback = draw(source, actualOptics, trailIntegration, `${id}-${trailIntegration}-dof${dof}`);
            const passed = readback.nonzeroComponents === 0 && readback.nonfiniteComponents === 0 && readback.errors.length === 0 && readback.instanceCount === 1 && readback.triangles >= 2;
            summary.failed += Number(!passed); summary.totalNonzeroComponents += readback.nonzeroComponents; summary.totalNonfiniteComponents += readback.nonfiniteComponents;
            draws.push({ id, rejection: 'kernel-support-outside', trailIntegration, dof, passed, phase: item.phase, fixtureBound: item.fixtureBound,
              currentBound: bound, productionBudgetEligible: eligible, readback });
          }
          check(`${trailIntegration}_dof_${dof}_all_excluded_sources_strict_RGBA_zero`, summary.failed === 0 && summary.selected > 0, summary);
          combinations.push(summary);
          for (const item of spikeCandidates) {
            const id = `${item.fixtureKind}-row${item.rowIndex}-top${item.topIndex}`, source = restoreSource(item.source);
            allSelection.set(id, item);
            const actualOptics = { ...optics, shutterSeconds: item.shutterSeconds, legacyShutterSeconds: item.shutterSeconds,
              firelightSigmaPixels: item.firelightSigmaPixels };
            const classification = classifyFireworkSourceVisibility(source, camera, actualOptics);
            const kernelClassification = classifyFireworkKernelViewport(source, camera, actualOptics);
            const bound = getFireworkSourceBound(source, camera, actualOptics, raw);
            const eligible = eligibility(source, bound, bound.depth > .01, actualOptics);
            const readback = draw(source, actualOptics, trailIntegration, `${id}-${trailIntegration}-dof${dof}`);
            const passed = classification.clipped && classification.reason === 'complete-quad-outside' && eligible &&
              readback.nonzeroComponents === 0 && readback.nonfiniteComponents === 0 && readback.errors.length === 0 && readback.triangles >= 2;
            draws.push({ id, rejection: 'complete-quad-outside', trailIntegration, dof, passed, phase: item.phase,
              classification, kernelClassification, fixtureBound: item.fixtureBound, currentBound: bound, productionBudgetEligible: eligible, readback });
            check(`${trailIntegration}_dof_${dof}_${id}_quad_rejected_strict_RGBA_zero`, passed,
              { classification, kernelClassification, eligible, readback });
          }
          // Controls use this same real material, Float32 attachment and camera.
          // Camera-local +Z is backward, so this trail crosses z=-near while
          // its centre stays in front; the actual kernel must visibly survive.
          const worldPoint = local => camera.localToWorld(new THREE.Vector3(...local)).toArray();
          const worldVector = local => new THREE.Vector3(...local).applyQuaternion(camera.quaternion).toArray();
          const common = { kind: 'star', velocity: [0, 0, 0], stretch: [0, 0, 0], colour: [1, .7, .3], radius: .02, intensity: 10, unmodulatedIntensity: 10 };
          const controls = [
            { id: 'axis-head', source: { ...common, position: worldPoint([0, 0, -10]) }, crossesNear: false },
            { id: 'near-crossing-lit-trail', source: { ...common, position: worldPoint([0, 0, -.22]),
              velocity: worldVector([.1, 0, 0]), stretch: worldVector([.04, 0, .24]), radius: .0018 }, crossesNear: true },
          ];
          for (const control of controls) {
            const classification = classifyFireworkKernelViewport(control.source, camera, optics), bound = getFireworkSourceBound(control.source, camera, optics, raw);
            const result = draw(control.source, optics, trailIntegration, `${control.id}-${trailIntegration}-dof${dof}`);
            check(`${trailIntegration}_dof_${dof}_${control.id}_retained_and_lit`, !classification.outside && result.litPixels > 0 &&
              result.nonfiniteComponents === 0 && result.errors.length === 0 && (!control.crossesNear || bound.nearPlaneFallback),
            { classification, bound, source: control.source, readback: result });
          }
        }
        // Remaining scalar tails are a different case from the old exact-zero
        // kernel fixtures. Their physical sweep is outside; recentering a
        // projected endpoint difference can create an artificial visible line.
        const sweepSelection = sweepCandidates.filter(item => {
          if (item.requiredRemainingTail) return true;
          const source = restoreSource(item.source), optics = { ...baseOptics, ...item.optics, trailIntegration: 'adaptive', dof: false };
          const bound = getFireworkSourceBound(source, camera, optics, raw);
          return bound.visible && classifyFireworkSourceVisibility(source, camera, optics).reason === 'conservative-retain' &&
            !classifyFireworkKernelViewport(source, camera, optics).outside;
        });
        check('sweep_fixtures_include_five_dense_tails_and_real_natural_spike', sweepSelection.filter(item => item.requiredRemainingTail).length >= 5 &&
          sweepSelection.some(item => item.fixtureKind === 'sweep-natural'),
        { selected: sweepSelection.map(item => ({ fixture: item.fixtureKind, phase: item.phase, index: item.source.index, bodyId: item.source.bodyId })) });
        sweepEffect.update({ time: 1 }); sweepBaseline.update({ time: 1 });
        for (const trailIntegration of ['legacy', 'adaptive']) for (const dof of [false, true]) {
          for (const item of sweepSelection) {
            const id = `${item.fixtureKind}-row${item.rowIndex}-top${item.topIndex}`, source = restoreSource(item.source);
            allSelection.set(id, item);
            const optics = { ...baseOptics, ...item.optics, trailIntegration, dof }, proof = physicalSweepProof(source, optics);
            const classification = classifyFireworkSweepViewport(source, camera, optics);
            const oldVisibility = classifyFireworkSourceVisibility(source, camera, optics), oldKernel = classifyFireworkKernelViewport(source, camera, optics);
            const baseline = readUploaded(sweepBaseline, source, optics, trailIntegration, `${id}-${trailIntegration}-dof${dof}-sweep-off`);
            const enabled = readUploaded(sweepEffect, source, optics, trailIntegration, `${id}-${trailIntegration}-dof${dof}-sweep-on`);
            const cull = enabled.lastRender.sourceVisibility, budget = enabled.budgetOn;
            const budgetExcluded = (budget.quadOutsideBudgetSources || 0) + (budget.kernelOutsideBudgetSources || 0) + (budget.worldSweepOutsideBudgetSources || 0);
            const requiresSweepBudget = oldVisibility.reason === 'conservative-retain' && !oldKernel.outside;
            const passed = proof.outside && classification.outside && baseline.instanceCount === 1 && !baseline.sweptSourceVisibility &&
              enabled.sweptSourceVisibility && enabled.instanceCount === 0 && cull.inputRecords === 1 && cull.worldSweepCulled === 1 &&
              enabled.nonzeroComponents === 0 && enabled.nonfiniteComponents === 0 && enabled.errors.length === 0 && baseline.errors.length === 0 &&
              enabled.budgetOff.visibleSources === 1 && budget.visibleSources === 0 && budgetExcluded === 1 &&
              (!requiresSweepBudget || budget.worldSweepOutsideBudgetSources === 1);
            const result = { id, phase: item.phase, sourceIndex: source.index, trailIntegration, dof, passed,
              proof, classification, oldVisibility, oldKernel, requiresSweepBudget, baseline, enabled };
            sweepDraws.push(result);
            check(`${id}_${trailIntegration}_dof_${dof}_physical_sweep_upload_and_budget_reject`, passed, result);
          }
          const point = local => camera.localToWorld(new THREE.Vector3(...local)).toArray();
          const vector = local => new THREE.Vector3(...local).applyQuaternion(camera.quaternion).toArray();
          const common = { kind: 'star', velocity: [0, 0, 0], stretch: [0, 0, 0], colour: [1, .7, .3], radius: .02, intensity: 10, unmodulatedIntensity: 10, sourceAge: 1 };
          const controls = [
            { id: 'sweep-centre-head', source: { ...common, position: point([0, 0, -10]) } },
            { id: 'sweep-inview-head', source: { ...common, position: point([1, .3, -10]) } },
            { id: 'sweep-real-cross-screen-trail', source: { ...common, position: point([0, 0, -10]), stretch: vector([30, 0, 0]), radius: .0018 } },
          ];
          for (const control of controls) {
            const optics = { ...baseOptics, trailIntegration, dof }, proof = physicalSweepProof(control.source, optics);
            const classification = classifyFireworkSweepViewport(control.source, camera, optics);
            const enabled = readUploaded(sweepEffect, control.source, optics, trailIntegration, `${control.id}-${trailIntegration}-dof${dof}`);
            const passed = !proof.outside && !classification.outside && enabled.instanceCount === 1 && enabled.litPixels > 0 &&
              enabled.nonfiniteComponents === 0 && enabled.errors.length === 0 && !enabled.lastRender.sourceVisibility.worldSweepCulled;
            const result = { id: control.id, trailIntegration, dof, passed, source: control.source, proof, classification, enabled };
            sweepControls.push(result); check(`${control.id}_${trailIntegration}_dof_${dof}_retained_and_lit`, passed, result);
          }
        }
        check('sweep_sources_strict_RGBA_zero_only_after_production_upload_cull', sweepDraws.length > 0 && sweepDraws.every(row => row.passed),
          { draws: sweepDraws.length, baselineLitDraws: sweepDraws.filter(row => row.baseline.litPixels > 0).length,
            scope: 'Baseline false may render artificial projected streaks; enabled true must cull before upload. No claim that the old shader is zero.' });
        // Exercise the actual getRadianceBound gate with ordinary production
        // simulation records. This is separate from the immutable trace draws.
        const launchTime = Number(replay.id.slice(replay.id.lastIndexOf('-') + 1)), seed = Number(replay.id.slice(0, replay.id.lastIndexOf('-')));
        const wind = fixture.rows[0].photometry.frame.windVector;
        aggregateEffect.configure({ type: replay.type, effectProfile: 'legacy', autoLaunch: false, autoDirection: false, azimuth: replay.azimuth,
          elevation: replay.elevation, launchSpreadDegrees: 0, burstTiltDegrees: 0, burstRollDegrees: 0, randomLaunchTilt: false,
          smokeQuality: 'light', persistentSmoke: false, starDragModel: 'bounded-descent', clusterModel: 'moments' });
        aggregateEffect.update({ time: launchTime, windVector: wind });
        const actualLaunch = aggregateEffect.launch({ type: replay.type, seed, launchSpreadDegrees: 0, burstOrientation: replay.burstOrientation });
        const launchDelta = Math.max(Math.abs(actualLaunch.burstTime - replay.burstTime), ...actualLaunch.origin.map((v, i) => Math.abs(v - replay.origin[i])));
        check('production_aggregator_replay_matches_launch_geometry_and_time', actualLaunch.accepted && launchDelta < 1e-7, { actualLaunch, fixtureLaunch: replay, launchDelta });
        const replayRows = [...fixture.rows.filter(row => row.mainBound), ...spikeFixture.rows.filter(row => row.mainBound)]
          .sort((a, b) => a.photometry.frame.time - b.photometry.frame.time);
        for (const row of replayRows) {
          aggregateEffect.update({ time: row.photometry.frame.time, windVector: row.photometry.frame.windVector });
          for (const trailIntegration of ['legacy', 'adaptive']) for (const dof of [false, true]) {
            aggregateEffect.configure({ trailIntegration: trailIntegration === 'legacy' ? 'legacy8' : 'adaptive' });
            const optics = { ...baseOptics, trailIntegration, dof }, trace = [];
            const off = aggregateEffect.getRadianceBound({ camera, optics: { ...optics, kernelBudgetFloat32: false }, rawPerCandela: raw });
            const on = aggregateEffect.getRadianceBound({ camera, optics: { ...optics, kernelBudgetFloat32: true }, rawPerCandela: raw, onSourceBound: source => trace.push(source) });
            const eligible = trace.filter(({ source, bound, projected }) => eligibility(source, bound, projected, optics));
            const expectedQuad = eligible.filter(({ source }) => classifyFireworkSourceVisibility(source, camera, optics).reason === 'complete-quad-outside').length;
            const expectedKernel = eligible.filter(({ source }) => classifyFireworkSourceVisibility(source, camera, optics).reason !== 'complete-quad-outside' && classifyFireworkKernelViewport(source, camera, optics).outside).length;
            const expected = expectedQuad + expectedKernel;
            const passed = on.kernelOutsideBudgetSources === expectedKernel && on.quadOutsideBudgetSources === expectedQuad &&
              off.kernelOutsideBudgetSources === undefined && off.quadOutsideBudgetSources === undefined &&
              off.visibleSources - on.visibleSources === expected && on.maximumRawRadiance <= off.maximumRawRadiance &&
              off.globalFiniteSurfaceCeiling === on.globalFiniteSurfaceCeiling;
            aggregator.push({ phase: row.phase, trailIntegration, dof, passed, expectedExcluded: expected, expectedQuad, expectedKernel, off, on, tracedSources: trace.length });
          }
        }
        check('actual_production_getRadianceBound_Float32_opt_in_matches_classifier', aggregator.every(row => row.passed), { rows: aggregator.length, failures: aggregator.filter(row => !row.passed) });
        for (const mode of ['legacy', 'adaptive']) check(`${mode}_production_aggregator_really_exercises_exclusion`, aggregator.some(row => row.trailIntegration === mode && row.on.kernelOutsideBudgetSources > 0),
          { maximumExcluded: Math.max(0, ...aggregator.filter(row => row.trailIntegration === mode).map(row => row.on.kernelOutsideBudgetSources)) });
        check('production_aggregator_really_exercises_complete_quad_exclusion', aggregator.some(row => row.on.quadOutsideBudgetSources > 0),
          { maximumExcluded: Math.max(0, ...aggregator.map(row => row.on.quadOutsideBudgetSources)) });
        drain('final');
        check('no_GL_context_or_shader_errors', errors.length === 0 && shaderErrors.length === 0 && !gl.isContextLost(), { errors, shaderErrors, contextLost: gl.isContextLost() });
        return { passed: checks.every(row => row.passed), checks, passedCount: checks.filter(row => row.passed).length, total: checks.length,
          camera: { position: camera.position.toArray(), target: [2, 3, 0], filmGauge: camera.filmGauge, focalMm: camera.getFocalLength(),
            verticalFovDegrees: camera.fov, near: camera.near, far: camera.far, sensorHeightMm: camera.getFilmHeight() },
          baseOptics, device, attachment, productionShaders, combinations, draws, aggregator, sweepDraws, sweepControls,
          sourceFixtures: Array.from(allSelection, ([id, item]) => ({ id, ...item })), errors, shaderErrors };
      } finally { sweepEffect.dispose(); sweepBaseline.dispose(); aggregateEffect.dispose(); effect.dispose(); target.dispose(); renderer.dispose(); renderer.forceContextLoss(); }
    }, { candidates, spikeCandidates, sweepCandidates, qaSource, fixture, spikeFixture });
    const finalHashes = await hashes();
    report.sourceStableDuringRun = JSON.stringify(finalHashes) === JSON.stringify(sourceHashes);
    report.passed = report.gpu.passed && report.sourceStableDuringRun && report.issues.length === 0;
    if (!report.sourceStableDuringRun) report.finalSourceHashes = finalHashes;
  } catch (error) { report.error = error.stack || String(error); }
  finally { if (browser) await browser.close(); }
  report.finished = new Date().toISOString();
  await fs.writeFile(outputFile, JSON.stringify(report, null, 2) + '\n');
  console.log(JSON.stringify({ passed: report.passed, file: outputFile, checks: report.gpu ? `${report.gpu.passedCount}/${report.gpu.total}` : null,
    combinations: report.gpu?.combinations, issues: report.issues, error: report.error }));
  if (!report.passed) process.exitCode = 1;
})().catch(error => { console.error(error.stack || error); process.exitCode = 1; });
