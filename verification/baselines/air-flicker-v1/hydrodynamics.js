/*
 * Island-scale, depth-integrated water dynamics (metres and seconds).
 * 1. A depth-weighted pressure projection supplies a steady tidal current.
 * 2. A staggered linear shallow-water solver propagates surface disturbances.
 * This is a small-amplitude 2-D model, not a 3-D Navier-Stokes simulation.
 */

const GRAVITY = 9.81;
const DRY_DEPTH = 0.08;
const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
const harmonic = (a, b) => a > DRY_DEPTH && b > DRY_DEPTH ? 2 * a * b / (a + b) : 0;

/** Independently testable finite-volume, depth-weighted current projection. */
export function solveSteadyFlow(terrainHeight, { extent = 72, resolution = 128, tolerance = 0.00002, maxIterations = 850 } = {}) {
  const n = Math.max(24, Math.round(resolution));
  const count = n * n, dx = extent * 2 / n, invDx = 1 / dx, invDx2 = invDx * invDx;
  const depth = new Float64Array(count), rightDepth = new Float64Array((n + 1) * n), topDepth = new Float64Array(n * (n + 1));
  const direction = { x: 1 / Math.sqrt(1.0625), z: -0.25 / Math.sqrt(1.0625) };
  for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
    const h = Math.max(0, -terrainHeight(-extent + (i + 0.5) * dx, -extent + (j + 0.5) * dx));
    depth[j * n + i] = Number.isFinite(h) && h > DRY_DEPTH ? h : 0;
  }
  // External pressure is fixed at zero. Boundary face depth equals its wet
  // interior neighbour, so the domain is open to inflow and outflow.
  for (let j = 0; j < n; j++) for (let i = 0; i <= n; i++) {
    rightDepth[j * (n + 1) + i] = i === 0 ? depth[j * n] : i === n ? depth[j * n + n - 1] : harmonic(depth[j * n + i - 1], depth[j * n + i]);
  }
  for (let j = 0; j <= n; j++) for (let i = 0; i < n; i++) {
    topDepth[j * n + i] = j === 0 ? depth[i] : j === n ? depth[(n - 1) * n + i] : harmonic(depth[(j - 1) * n + i], depth[j * n + i]);
  }
  const rhs = new Float64Array(count), diagonal = new Float64Array(count), pressure = new Float64Array(count);
  const residual = new Float64Array(count), preconditioned = new Float64Array(count), search = new Float64Array(count), product = new Float64Array(count);
  let rhsNorm2 = 0, rz = 0, wetCells = 0;
  for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
    const k = j * n + i;
    if (!depth[k]) { diagonal[k] = 1; continue; }
    wetCells++;
    const w = rightDepth[j * (n + 1) + i], e = rightDepth[j * (n + 1) + i + 1];
    const s = topDepth[j * n + i], t = topDepth[(j + 1) * n + i];
    diagonal[k] = Math.max(1e-12, (w + e + s + t) * invDx2);
    rhs[k] = -((e - w) * direction.x + (t - s) * direction.z) * invDx;
    residual[k] = rhs[k]; preconditioned[k] = residual[k] / diagonal[k]; search[k] = preconditioned[k];
    rhsNorm2 += rhs[k] * rhs[k]; rz += residual[k] * preconditioned[k];
  }
  function applyOperator(input, output) {
    for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
      const k = j * n + i;
      if (!depth[k]) { output[k] = input[k]; continue; }
      const w = rightDepth[j * (n + 1) + i], e = rightDepth[j * (n + 1) + i + 1];
      const s = topDepth[j * n + i], t = topDepth[(j + 1) * n + i];
      output[k] = diagonal[k] * input[k] - invDx2 * (
        (i ? w * input[k - 1] : 0) + (i + 1 < n ? e * input[k + 1] : 0) +
        (j ? s * input[k - n] : 0) + (j + 1 < n ? t * input[k + n] : 0));
    }
  }
  let iterations = 0, relativeResidual = rhsNorm2 ? 1 : 0;
  for (; iterations < maxIterations && relativeResidual > tolerance; iterations++) {
    applyOperator(search, product);
    let denominator = 0;
    for (let k = 0; k < count; k++) denominator += search[k] * product[k];
    if (!(denominator > 1e-30) || !(rz > 0)) break;
    const alpha = rz / denominator;
    let residualNorm2 = 0, nextRz = 0;
    for (let k = 0; k < count; k++) {
      pressure[k] += alpha * search[k]; residual[k] -= alpha * product[k];
      preconditioned[k] = residual[k] / diagonal[k];
      residualNorm2 += residual[k] * residual[k]; nextRz += residual[k] * preconditioned[k];
    }
    relativeResidual = Math.sqrt(residualNorm2 / Math.max(rhsNorm2, 1e-30));
    const beta = nextRz / rz;
    for (let k = 0; k < count; k++) search[k] = preconditioned[k] + beta * search[k];
    rz = nextRz;
  }
  const faceX = new Float64Array(rightDepth.length), faceZ = new Float64Array(topDepth.length);
  let maximumSpeed = 1e-12;
  for (let j = 0; j < n; j++) for (let i = 0; i <= n; i++) {
    const k = j * (n + 1) + i;
    if (!rightDepth[k]) continue;
    const left = i ? pressure[j * n + i - 1] : 0, right = i < n ? pressure[j * n + i] : 0;
    faceX[k] = direction.x - (right - left) * invDx;
    maximumSpeed = Math.max(maximumSpeed, Math.abs(faceX[k]));
  }
  for (let j = 0; j <= n; j++) for (let i = 0; i < n; i++) {
    const k = j * n + i;
    if (!topDepth[k]) continue;
    const bottom = j ? pressure[(j - 1) * n + i] : 0, top = j < n ? pressure[j * n + i] : 0;
    faceZ[k] = direction.z - (top - bottom) * invDx;
    maximumSpeed = Math.max(maximumSpeed, Math.abs(faceZ[k]));
  }
  const centerX = new Float64Array(count), centerZ = new Float64Array(count);
  for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
    const k = j * n + i;
    if (!depth[k]) continue;
    centerX[k] = 0.5 * (faceX[j * (n + 1) + i] + faceX[j * (n + 1) + i + 1]);
    centerZ[k] = 0.5 * (faceZ[j * n + i] + faceZ[(j + 1) * n + i]);
    maximumSpeed = Math.max(maximumSpeed, Math.hypot(centerX[k], centerZ[k]));
  }
  // One global scale preserves continuity; local speed clamps would not.
  // Only reduce excessive acceleration. Never amplify a near-zero solution:
  // a sealed basin has no through-current, apart from solver roundoff.
  const scale = 1 / Math.max(1, maximumSpeed);
  for (let k = 0; k < count; k++) { centerX[k] *= scale; centerZ[k] *= scale; }
  for (let k = 0; k < faceX.length; k++) faceX[k] *= scale;
  for (let k = 0; k < faceZ.length; k++) faceZ[k] *= scale;
  let div2 = 0, maxDivergence = 0, boundaryFlux = 0, maxDryNormalFlux = 0;
  for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
    const k = j * n + i;
    if (!depth[k]) continue;
    const l = j * (n + 1) + i, r = l + 1, b = j * n + i, t = b + n;
    const div = (rightDepth[r] * faceX[r] - rightDepth[l] * faceX[l] + topDepth[t] * faceZ[t] - topDepth[b] * faceZ[b]) * invDx;
    div2 += div * div; maxDivergence = Math.max(maxDivergence, Math.abs(div));
    if (!i) boundaryFlux -= rightDepth[l] * faceX[l] * dx;
    if (i === n - 1) boundaryFlux += rightDepth[r] * faceX[r] * dx;
    if (!j) boundaryFlux -= topDepth[b] * faceZ[b] * dx;
    if (j === n - 1) boundaryFlux += topDepth[t] * faceZ[t] * dx;
  }
  for (let k = 0; k < faceX.length; k++) if (!rightDepth[k]) maxDryNormalFlux = Math.max(maxDryNormalFlux, Math.abs(faceX[k]));
  for (let k = 0; k < faceZ.length; k++) if (!topDepth[k]) maxDryNormalFlux = Math.max(maxDryNormalFlux, Math.abs(faceZ[k]));

  function sampleUnitFlow(x, z) {
    if (!Number.isFinite(x + z) || Math.abs(x) >= extent || Math.abs(z) >= extent || terrainHeight(x, z) >= -DRY_DEPTH) return { x: 0, z: 0 };
    const gx = clamp((x + extent) / dx - 0.5, 0, n - 1), gz = clamp((z + extent) / dx - 0.5, 0, n - 1);
    const i = Math.floor(gx), j = Math.floor(gz), i1 = Math.min(n - 1, i + 1), j1 = Math.min(n - 1, j + 1), fx = gx - i, fz = gz - j;
    const a = j * n + i, b = j * n + i1, c = j1 * n + i, d = j1 * n + i1;
    const bilerp = field => ((1 - fx) * field[a] + fx * field[b]) * (1 - fz) + ((1 - fx) * field[c] + fx * field[d]) * fz;
    return { x: bilerp(centerX), z: bilerp(centerZ) };
  }
  return {
    resolution: n, extent, dx, depth, pressure, faceX, faceZ, rightDepth, topDepth, centerX, centerZ, sampleUnitFlow,
    metrics: { iterations, relativeResidual, converged: relativeResidual <= tolerance, tolerance, wetCells,
      rmsDepthFluxDivergence: Math.sqrt(div2 / Math.max(1, wetCells)), maxDepthFluxDivergence: maxDivergence,
      netOpenBoundaryFlux: boundaryFlux, maxDryNormalFlux, unscaledMaximumSpeed: maximumSpeed, globalScale: scale },
  };
}

/** Returns a discrete zero-volume impact, including when cut by the shoreline. */
export function buildVolumeNeutralImpulse(depth, resolution, extent, x, z, strength = 1) {
  const dx = 2 * extent / resolution, sigma = Math.max(0.52, dx * 1.35), radius = sigma * Math.sqrt(18);
  const imin = Math.max(0, Math.floor((x - radius + extent) / dx)), imax = Math.min(resolution - 1, Math.ceil((x + radius + extent) / dx));
  const jmin = Math.max(0, Math.floor((z - radius + extent) / dx)), jmax = Math.min(resolution - 1, Math.ceil((z + radius + extent) / dx));
  const cells = []; let positive = 0, negative = 0;
  for (let j = jmin; j <= jmax; j++) for (let i = imin; i <= imax; i++) {
    const k = j * resolution + i;
    if (!(depth[k] > DRY_DEPTH)) continue;
    const rx = -extent + (i + 0.5) * dx - x, rz = -extent + (j + 0.5) * dx - z;
    const q = (rx * rx + rz * rz) / (2 * sigma * sigma);
    if (q > 9) continue;
    const value = (1 - q) * Math.exp(-q);
    cells.push([k, value]); if (value > 0) positive += value; else negative -= value;
  }
  if (!(positive > 1e-12) || !(negative > 1e-12)) return { cells: [], volume: 0, amplitude: 0, radius };
  const correction = positive / negative, amplitude = 0.028 * clamp(strength, -1, 1);
  let sum = 0, maximum = 0;
  for (const cell of cells) { cell[1] *= amplitude * (cell[1] < 0 ? correction : 1); sum += cell[1]; maximum = Math.max(maximum, Math.abs(cell[1])); }
  // Floating point rounding alone can leave a minute residual. Remove it from
  // one wet cell, retaining the positive/negative shape and exact grid volume.
  if (cells.length) cells[0][1] -= sum;
  return { cells, volume: cells.reduce((s, c) => s + c[1], 0) * dx * dx, amplitude: maximum, radius };
}

export function createHydrodynamics(THREE, renderer, { terrainHeight, extent = 72, resolution = 384 } = {}) {
  if (typeof terrainHeight !== 'function') throw new TypeError('Hydrodynamics requires terrainHeight(x,z) in metres.');
  const start = performance.now();
  const n = Math.round(clamp(resolution, 96, 512)), count = n * n, dx = 2 * extent / n;
  const projection = solveSteadyFlow(terrainHeight, { extent, resolution: Math.min(128, n) });
  const initial = new Float32Array(count * 4), flowData = new Float32Array(count * 4), depth = new Float32Array(count), impulses = new Float32Array(count);
  let maxDepth = 0, wetCells = 0;
  for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
    const k = j * n + i, x = -extent + (i + 0.5) * dx, z = -extent + (j + 0.5) * dx;
    const h = Math.max(0, -terrainHeight(x, z));
    depth[k] = h > DRY_DEPTH && Number.isFinite(h) ? h : 0;
    initial[k * 4 + 3] = depth[k]; maxDepth = Math.max(maxDepth, depth[k]); if (depth[k]) wetCells++;
    const r = projection.sampleUnitFlow(x + dx * 0.5, z), t = projection.sampleUnitFlow(x, z + dx * 0.5);
    flowData[k * 4] = r.x; flowData[k * 4 + 1] = t.z;
    const edgeDistance = Math.min(extent - Math.abs(x), extent - Math.abs(z));
    const sponge = Math.pow(clamp(1 - edgeDistance / 11, 0, 1), 2) * 3.8;
    flowData[k * 4 + 2] = sponge;
    flowData[k * 4 + 3] = depth[k];
  }
  const texture = (data, format = THREE.RGBAFormat) => {
    const tex = new THREE.DataTexture(data, n, n, format, THREE.FloatType);
    tex.minFilter = tex.magFilter = THREE.NearestFilter;
    tex.wrapS = tex.wrapT = THREE.ClampToEdgeWrapping; tex.generateMipmaps = false; tex.needsUpdate = true;
    return tex;
  };
  const initialTexture = texture(initial), flowTexture = texture(flowData), impulseTexture = texture(impulses, THREE.RedFormat);
  const makeTarget = () => new THREE.WebGLRenderTarget(n, n, { type: THREE.FloatType, format: THREE.RGBAFormat,
    minFilter: THREE.NearestFilter, magFilter: THREE.NearestFilter, depthBuffer: false, stencilBuffer: false, generateMipmaps: false });
  let front = makeTarget(), back = makeTarget();
  front.texture.name = 'Shallow-water eta/u-face/v-face/depth'; back.texture.name = front.texture.name;
  let currentSpeed = 0.22, swellAmplitude = 0.01, accumulated = 0, simulationTime = 0, substeps = 0, droppedSeconds = 0, pendingImpulse = false, disposed = false;
  let impactCount = 0, lastImpact = null, lastUpdateMs = 0, lastSubsteps = 0;
  // A fixed 2-D gravity-wave CFL, also allowing the maximum user current.
  const fixedDt = Math.min(1 / 120, 0.28 * dx / (Math.sqrt(GRAVITY * Math.max(maxDepth, 0.1)) + 0.5));
  const passUniforms = {
    uInput: { value: initialTexture }, uFlow: { value: flowTexture }, uImpulse: { value: impulseTexture },
    uTexel: { value: 1 / n }, uDx: { value: dx }, uDt: { value: fixedDt },
    uCurrent: { value: currentSpeed }, uMode: { value: 2 }, uInject: { value: 0 },
    uSimTime: { value: 0 }, uSwellAmplitude: { value: swellAmplitude }, uExtent: { value: extent },
  };
  const material = new THREE.ShaderMaterial({
    uniforms: passUniforms, depthTest: false, depthWrite: false, blending: THREE.NoBlending, toneMapped: false,
    vertexShader: `varying vec2 vUv; void main(){vUv=uv;gl_Position=vec4(position.xy,0.0,1.0);}`,
    fragmentShader: /* glsl */`
      precision highp float;
      varying vec2 vUv;
      uniform sampler2D uInput,uFlow,uImpulse;
      uniform float uTexel,uDx,uDt,uCurrent,uInject,uSimTime,uSwellAmplitude,uExtent;
      uniform int uMode;
      const float g=9.81;
      const float dry=0.08;
      vec4 state(vec2 p){
        if(p.x<0.0||p.y<0.0||p.x>1.0||p.y>1.0)return vec4(0.0);
        vec4 s=texture2D(uInput,p);
        if(s.a>dry)s.r+=texture2D(uImpulse,p).r*uInject;
        return s;
      }
      float hf(float a,float b){return a>dry&&b>dry?2.0*a*b/(a+b):0.0;}
      float upwind(float left,float right,float speed){return speed>=0.0?left:right;}
      void main(){
        if(uMode==2){gl_FragColor=texture2D(uInput,vUv);return;}
        vec2 ex=vec2(uTexel,0.0),ez=vec2(0.0,uTexel);
        vec4 c=state(vUv),l=state(vUv-ex),r=state(vUv+ex),b=state(vUv-ez),t=state(vUv+ez);
        if(c.a<=dry){gl_FragColor=vec4(0.0);return;}
        vec4 fc=texture2D(uFlow,vUv),fl=texture2D(uFlow,vUv-ex),fb=texture2D(uFlow,vUv-ez);
        float ur=fc.r*uCurrent*step(dry,r.a),ul=fl.r*uCurrent*step(dry,l.a);
        float vt=fc.g*uCurrent*step(dry,t.a),vb=fb.g*uCurrent*step(dry,b.a);
        float meanU=0.5*(ur+ul),meanV=0.5*(vt+vb);
        float damping=exp(-(0.045+fc.b)*uDt);
        // A gentle incoming 20-second long swell is imposed only in the western
        // open-boundary strip. Propagation, shoaling and island reflection
        // inside the domain are then solved, rather than drawn as rings.
        vec2 positionMetres=(vUv*2.0-1.0)*uExtent;
        vec2 swellDirection=normalize(vec2(1.0,-0.25));
        float omega=0.314159265359;
        float waveNumber=omega/sqrt(g*max(c.a,0.1));
        float phase=waveNumber*dot(positionMetres,swellDirection)-omega*uSimTime;
        float incoming=uSwellAmplitude*smoothstep(0.0,6.0,uSimTime);
        float drive=4.0*pow(clamp(1.0-(positionMetres.x+uExtent)/10.0,0.0,1.0),2.0);
        if(uMode==0){
          // G/B hold velocities at the right/top face, a MAC grid. Pressure
          // gradients use adjacent cell heights, so no checkerboard mode.
          float duX=meanU>=0.0?c.g-l.g:r.g-c.g;
          float duZ=meanV>=0.0?c.g-b.g:t.g-c.g;
          float dvX=meanU>=0.0?c.b-l.b:r.b-c.b;
          float dvZ=meanV>=0.0?c.b-b.b:t.b-c.b;
          float u=(c.g-g*uDt*(r.r-c.r)/uDx-uDt*(meanU*duX+meanV*duZ)/uDx)*damping;
          float v=(c.b-g*uDt*(t.r-c.r)/uDx-uDt*(meanU*dvX+meanV*dvZ)/uDx)*damping;
          float targetU=incoming*sqrt(g/max(hf(c.a,r.a),0.1))*swellDirection.x*cos(phase+waveNumber*swellDirection.x*uDx*0.5);
          float targetV=incoming*sqrt(g/max(hf(c.a,t.a),0.1))*swellDirection.y*cos(phase+waveNumber*swellDirection.y*uDx*0.5);
          u+=(targetU-u)*drive*uDt;v+=(targetV-v)*drive*uDt;
          if(r.a<=dry)u=0.0;if(t.a<=dry)v=0.0;
          gl_FragColor=vec4(c.r,u,v,c.a);
        }else{
          // The same face flux appears with opposite signs in neighbouring
          // cells: conservation of surface volume except in the outer sponge.
          float fluxR=hf(c.a,r.a)*c.g+ur*upwind(c.r,r.r,ur);
          float fluxL=hf(l.a,c.a)*l.g+ul*upwind(l.r,c.r,ul);
          float fluxT=hf(c.a,t.a)*c.b+vt*upwind(c.r,t.r,vt);
          float fluxB=hf(b.a,c.a)*b.b+vb*upwind(b.r,c.r,vb);
          float eta=(c.r-uDt*(fluxR-fluxL+fluxT-fluxB)/uDx)*exp(-fc.b*uDt);
          eta+=(incoming*cos(phase)-eta)*drive*uDt;
          // The linear model has no wetting/drying. This final positivity guard
          // is normally inactive for the 2.8 cm impact; it bounds shallow cells.
          eta=clamp(eta,-min(0.25,c.a*0.42),min(0.25,c.a*0.42));
          gl_FragColor=vec4(eta,c.g,c.b,c.a);
        }
      }
    `,
  });
  const geometry = new THREE.PlaneGeometry(2, 2), quad = new THREE.Mesh(geometry, material), simScene = new THREE.Scene();
  const simCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  quad.frustumCulled = false; simScene.add(quad);
  function preserveRenderer(callback) {
    const previousTarget = renderer.getRenderTarget(), cubeFace = renderer.getActiveCubeFace?.() ?? 0, mip = renderer.getActiveMipmapLevel?.() ?? 0;
    const currentViewport = previousTarget ? renderer.getCurrentViewport(new THREE.Vector4()) : null;
    const gl = previousTarget ? renderer.getContext() : null;
    const currentScissor = gl ? gl.getParameter(gl.SCISSOR_BOX) : null;
    const actualScissorTest = gl ? gl.isEnabled(gl.SCISSOR_TEST) : false;
    const scissorTest = renderer.getScissorTest(), autoClear = renderer.autoClear, xr = renderer.xr.enabled;
    try { renderer.autoClear = false; renderer.xr.enabled = false; renderer.setScissorTest(false); callback(); }
    finally {
      renderer.setScissorTest(scissorTest);
      if (previousTarget) {
        // Preserve a caller's explicit viewport even if it differs from the
        // target's default. Do not call setViewport: Three scales that API by
        // devicePixelRatio, including while a floating-point target is bound.
        const viewport = previousTarget.viewport.clone(), scissor = previousTarget.scissor.clone(), test = previousTarget.scissorTest;
        previousTarget.viewport.copy(currentViewport);
        previousTarget.scissor.set(currentScissor[0], currentScissor[1], currentScissor[2], currentScissor[3]);
        previousTarget.scissorTest = actualScissorTest;
        renderer.setRenderTarget(previousTarget, cubeFace, mip);
        previousTarget.viewport.copy(viewport); previousTarget.scissor.copy(scissor); previousTarget.scissorTest = test;
      } else renderer.setRenderTarget(null, cubeFace, mip);
      renderer.autoClear = autoClear; renderer.xr.enabled = xr;
    }
  }
  // Render targets already own a physical-pixel viewport of n by n. Their
  // viewport is independent of the display's devicePixelRatio.
  function renderPass(target) { renderer.setRenderTarget(target); renderer.render(simScene, simCamera); }
  preserveRenderer(() => { renderPass(front); renderPass(back); });
  initialTexture.dispose();
  const uniforms = { uHydroState: { value: front.texture }, uHydroExtent: { value: extent }, uHydroResolution: { value: n } };
  const initializationMs = performance.now() - start;

  function update(delta) {
    if (disposed || !Number.isFinite(delta) || delta <= 0) return;
    const tick = performance.now();
    const incoming = Math.min(delta, 0.25); droppedSeconds += Math.max(0, delta - incoming);
    accumulated += incoming;
    const countSteps = Math.min(12, Math.floor((accumulated + 1e-12) / fixedDt));
    lastSubsteps = countSteps;
    if (!countSteps) return;
    preserveRenderer(() => {
      for (let s = 0; s < countSteps; s++) {
        passUniforms.uSimTime.value = simulationTime;
        passUniforms.uInput.value = front.texture; passUniforms.uMode.value = 0; passUniforms.uInject.value = pendingImpulse ? 1 : 0;
        renderPass(back); [front, back] = [back, front];
        passUniforms.uInput.value = front.texture; passUniforms.uMode.value = 1; passUniforms.uInject.value = 0;
        renderPass(back); [front, back] = [back, front];
        pendingImpulse = false; simulationTime += fixedDt; substeps++;
      }
    });
    accumulated -= countSteps * fixedDt;
    if (accumulated > fixedDt * 24) { droppedSeconds += accumulated - fixedDt * 24; accumulated = fixedDt * 24; }
    uniforms.uHydroState.value = front.texture;
    lastUpdateMs = performance.now() - tick;
  }
  function disturb(x, z, strength = 1) {
    if (disposed || !Number.isFinite(x + z + strength)) return false;
    if (Math.abs(x) >= extent - dx || Math.abs(z) >= extent - dx || terrainHeight(x, z) >= -DRY_DEPTH) return false;
    const impact = buildVolumeNeutralImpulse(depth, n, extent, x, z, strength);
    if (!impact.cells.length) return false;
    if (!pendingImpulse) impulses.fill(0);
    for (const [index, value] of impact.cells) impulses[index] += value;
    impulseTexture.needsUpdate = true; pendingImpulse = true; impactCount++;
    lastImpact = { x, z, strength, cells: impact.cells.length, discreteVolume: impact.volume, amplitude: impact.amplitude, radius: impact.radius };
    return true;
  }
  function sampleFlow(x, z) { const f = projection.sampleUnitFlow(x, z); return { x: f.x * currentSpeed, z: f.z * currentSpeed }; }
  function setCurrent(speedMetresPerSecond) {
    if (!Number.isFinite(speedMetresPerSecond)) return;
    currentSpeed = clamp(speedMetresPerSecond, -0.5, 0.5); passUniforms.uCurrent.value = currentSpeed;
  }
  function setSwell(amplitudeMetres) {
    if (!Number.isFinite(amplitudeMetres)) return;
    swellAmplitude = clamp(amplitudeMetres, 0, 0.02); passUniforms.uSwellAmplitude.value = swellAmplitude;
  }
  function diagnostics({ readback = true } = {}) {
    const report = { model: 'depth-weighted steady potential flow + linear staggered shallow-water perturbations',
      resolution: n, extentMetres: extent, cellSizeMetres: dx, fixedTimeStepSeconds: fixedDt,
      gravityMetresPerSecondSquared: GRAVITY, maxRestDepthMetres: maxDepth, wetCells, dryDepthMetres: DRY_DEPTH,
      maximumGravityWaveCFL: fixedDt * Math.sqrt(GRAVITY * maxDepth) / dx,
      twoDimensionalGravityCFL: fixedDt * Math.sqrt(2 * GRAVITY * maxDepth) / dx,
      maximumCombinedCFL: fixedDt * (Math.sqrt(GRAVITY * maxDepth) + 0.5) / dx,
      maximumCurrentMetresPerSecond: currentSpeed, simulatedSeconds: simulationTime, substeps,
      incomingSwell: { boundaryAmplitudeMetres: swellAmplitude, periodSeconds: 20, rampSeconds: 6, boundaryWidthMetres: 10 },
      discardedSeconds: droppedSeconds, pendingSeconds: accumulated, initializationMs, lastUpdateCpuSubmitMs: lastUpdateMs,
      lastUpdateSubsteps: lastSubsteps, lastUpdateFullscreenPasses: lastSubsteps * 2,
      impactCount, lastImpact, steadyProjection: { resolution: projection.resolution, ...projection.metrics },
      limitations: ['fixed shoreline; no inundation or breaking', 'small-amplitude depth-averaged waves',
        'steady potential tide; no 3-D vortices or vertical circulation', 'mean-flow advection omits background shear coupling',
        'upwind advection adds numerical diffusion',
        'open boundary swell adds energy; sponge and positivity guard can remove volume/energy'],
    };
    if (readback && !disposed) {
      const values = new Float32Array(count * 4);
      renderer.readRenderTargetPixels(front, 0, 0, n, n, values);
      let volume = 0, energy = 0, maxEta = 0, maxPerturbationSpeed = 0, nonFinite = 0, dryMotion = 0, gpuWetCells = 0, depthError = 0;
      for (let k = 0; k < count; k++) {
        const eta = values[k * 4], u = values[k * 4 + 1], v = values[k * 4 + 2], h = values[k * 4 + 3];
        if (!Number.isFinite(eta + u + v + h)) { nonFinite++; continue; }
        if (h > DRY_DEPTH) gpuWetCells++;
        depthError = Math.max(depthError, Math.abs(h - depth[k]));
        const i = k % n, j = Math.floor(k / n);
        const hr = i + 1 < n ? values[(k + 1) * 4 + 3] : 0, ht = j + 1 < n ? values[(k + n) * 4 + 3] : 0;
        volume += eta * dx * dx;
        energy += 0.5 * (GRAVITY * eta * eta + harmonic(h, hr) * u * u + harmonic(h, ht) * v * v) * dx * dx;
        maxEta = Math.max(maxEta, Math.abs(eta)); maxPerturbationSpeed = Math.max(maxPerturbationSpeed, Math.hypot(u, v));
        if (h <= DRY_DEPTH) dryMotion = Math.max(dryMotion, Math.abs(eta), Math.abs(u), Math.abs(v));
      }
      report.state = { perturbationVolumeCubicMetres: volume, depthIntegratedEnergyPerDensity: energy,
        maximumElevationMetres: maxEta, maximumPerturbationSpeedMetresPerSecond: maxPerturbationSpeed,
        nonFiniteCells: nonFinite, maximumDryCellMotion: dryMotion, wetCells: gpuWetCells, maximumRestDepthErrorMetres: depthError };
    }
    return report;
  }
  function dispose() {
    if (disposed) return; disposed = true;
    front.dispose(); back.dispose(); flowTexture.dispose(); impulseTexture.dispose(); geometry.dispose(); material.dispose();
  }
  return { uniforms, update, disturb, sampleFlow, setCurrent, setSwell, diagnostics, dispose };
}
