/** Browser-side GPU acceptance of the actual hydrodynamics implementation.
 * Deliberately isolated from the displayed ocean's spectrum and tide forcing.
 * Returns evidence; it does not silently turn an unsupported/empty readback into
 * a passing zero-state test. The root can save its return value as JSON.
 */
export async function runHydroCheck(THREE, renderer, createHydrodynamics) {
  const started = performance.now();
  const tests = [];
  const observations = {};
  const simulations = [];
  const add = (id, passed, evidence) => tests.push({id, passed: Boolean(passed), ...evidence});
  const snapshot = () => ({
    target: renderer.getRenderTarget(),
    viewport: renderer.getViewport(new THREE.Vector4()).toArray(),
    scissor: renderer.getScissor(new THREE.Vector4()).toArray(),
    scissorTest: renderer.getScissorTest(), autoClear: renderer.autoClear,
    xr: renderer.xr.enabled, clear: renderer.getClearColor(new THREE.Color()).toArray(),
    alpha: renderer.getClearAlpha(),
  });
  const before = snapshot();
  const pauseForUI = () => new Promise(resolve => requestAnimationFrame(resolve));
  async function advance(sim, seconds, onSample) {
    const dt = sim.diagnostics({readback:false}).fixedTimeStepSeconds;
    const steps = Math.ceil(seconds / dt);
    for (let i = 0; i < steps; i++) {
      sim.update(dt);
      if (onSample && (i % 4 === 0 || i === steps - 1)) onSample(sim.diagnostics({readback:true}));
      if ((i + 1) % 48 === 0) await pauseForUI();
    }
  }
  try {
    const flat = createHydrodynamics(THREE, renderer, {
      terrainHeight: () => -2, extent: 24, resolution: 96,
    });
    simulations.push(flat);
    flat.setSwell(0);
    flat.setCurrent(0);
    const initial = flat.diagnostics({readback:true});
    observations.flatInitial = initial;
    add('gpu_readback_has_actual_9216_wet_cells', initial.state?.wetCells === 96 * 96, {
      observed:initial.state?.wetCells, expected:9216,
      notes:'Catches a failed draw/readback returning an all-zero texture.'});
    add('gpu_depth_channel_matches_two_metre_fixture', initial.state?.maximumRestDepthErrorMetres <= 1e-6, {
      observed:initial.state?.maximumRestDepthErrorMetres, tolerance:1e-6});
    add('gpu_explicit_two_dimensional_cfl_bound', Math.SQRT2 * initial.maximumCombinedCFL < 1, {
      gravityCFL1D:initial.maximumGravityWaveCFL, combinedCFL1D:initial.maximumCombinedCFL,
      conservativeTwoDimensionalBound:Math.SQRT2 * initial.maximumCombinedCFL, limit:1});
    await advance(flat, 1);
    const rest = flat.diagnostics({readback:true});
    observations.flatRestAfter1s = rest;
    add('gpu_unforced_rest_state_is_invariant', rest.state?.nonFiniteCells === 0 &&
      rest.state?.maximumElevationMetres <= 1e-8 &&
      rest.state?.maximumPerturbationSpeedMetresPerSecond <= 1e-8 &&
      rest.state?.maximumRestDepthErrorMetres <= 1e-6 && rest.state?.wetCells === 9216, {
      state:rest.state, requestedSeconds:1,
      notes:'Swell and mean current were explicitly set to zero.'});
    const accepted = flat.disturb(0,0,1);
    add('gpu_center_impulse_accepted',accepted,{});
    const impulse = flat.diagnostics({readback:false}).lastImpact;
    add('gpu_impulse_input_zero_discrete_volume',accepted && Math.abs(impulse?.discreteVolume ?? Infinity) < 1e-12, {
      impact:impulse, toleranceCubicMetres:1e-12});
    const fixedDt = rest.fixedTimeStepSeconds;
    flat.update(fixedDt);
    const first = flat.diagnostics({readback:true});
    observations.flatFirstImpulseStep = first;
    add('gpu_impulse_reaches_state_and_preserves_early_mass', first.state?.maximumElevationMetres > 1e-5 &&
      Math.abs(first.state?.perturbationVolumeCubicMetres ?? Infinity) < 1e-5 &&
      first.state?.depthIntegratedEnergyPerDensity > 0, {
      state:first.state, massToleranceCubicMetres:1e-5,
      notes:'Measured before the outgoing wave can reach the 11 m boundary sponge.'});

    const eventTime = first.simulatedSeconds;
    const energySamples = [{age:0,energy:first.state?.depthIntegratedEnergyPerDensity,
      volume:first.state?.perturbationVolumeCubicMetres}];
    let maxNonFinite=first.state?.nonFiniteCells ?? Infinity;
    await advance(flat,4,report => {
      maxNonFinite=Math.max(maxNonFinite,report.state?.nonFiniteCells ?? Infinity);
      energySamples.push({age:report.simulatedSeconds-eventTime,
        energy:report.state?.depthIntegratedEnergyPerDensity,
        volume:report.state?.perturbationVolumeCubicMetres});
    });
    const final = flat.diagnostics({readback:true});
    const initialPeak=Math.max(...energySamples.filter(s=>s.age<=.5).map(s=>s.energy));
    const laterPeak=Math.max(...energySamples.filter(s=>s.age>.5).map(s=>s.energy));
    add('gpu_unforced_impulse_has_bounded_decaying_energy',maxNonFinite===0 && initialPeak>0 &&
      laterPeak <= initialPeak*1.025 && final.state?.depthIntegratedEnergyPerDensity < initialPeak*.99, {
      initialPeakFirstHalfSecond:initialPeak,laterPeak,finalEnergy:final.state?.depthIntegratedEnergyPerDensity,
      allowedTransientRatio:1.025,notes:'Symplectic energy can oscillate slightly. Drag and sponge should reduce its envelope; forcing stays zero.'});
    add('gpu_four_second_evolution_is_finite',maxNonFinite===0&&final.state?.nonFiniteCells===0&&
      final.state?.maximumRestDepthErrorMetres<=1e-6&&final.state?.wetCells===9216,{
      maxNonFiniteCells:maxNonFinite,finalState:final.state,simulatedSeconds:final.simulatedSeconds});
    observations.flatFinal = final;
    observations.energySamples = energySamples;
    flat.dispose();

    // A second fixture makes the dry-cell test non-vacuous; the flat fixture
    // has no land and therefore cannot demonstrate an impermeable shoreline.
    const obstacle = createHydrodynamics(THREE,renderer,{
      terrainHeight:(x,z)=>Math.hypot(x,z)<4?.6:-2, extent:24,resolution:96,
    });
    simulations.push(obstacle);
    obstacle.setCurrent(0);obstacle.setSwell(0);
    const obstacleInitial=obstacle.diagnostics({readback:true});
    add('gpu_obstacle_fixture_contains_wet_and_dry_cells',obstacleInitial.state?.wetCells>0&&
      obstacleInitial.state?.wetCells<9216&&obstacleInitial.state?.maximumRestDepthErrorMetres<=1e-6,{
      state:obstacleInitial.state});
    obstacle.disturb(6,0,1);
    await advance(obstacle,2);
    const obstacleFinal=obstacle.diagnostics({readback:true});
    add('gpu_wave_reflection_does_not_animate_dry_cells',obstacleFinal.state?.nonFiniteCells===0&&
      obstacleFinal.state?.maximumDryCellMotion<=1e-8&&
      obstacleFinal.state?.maximumRestDepthErrorMetres<=1e-6,{
      state:obstacleFinal.state,tolerance:1e-8,
      notes:'An impulse two metres from the circular island reaches its fixed shoreline.'});
    observations.obstacleInitial=obstacleInitial;observations.obstacleAfter2s=obstacleFinal;
  } catch(error) {
    add('gpu_check_execution',false,{error:String(error?.stack||error)});
  } finally {
    for(const sim of simulations)sim.dispose();
  }
  const after=snapshot();
  const rendererRestored=before.target===after.target&&
    ['viewport','scissor','clear'].every(key=>before[key].every((v,i)=>Math.abs(v-after[key][i])<1e-9))&&
    ['scissorTest','autoClear','xr','alpha'].every(key=>before[key]===after[key]);
  add('gpu_helper_preserves_renderer_state',rendererRestored,{
    before:{...before,target:before.target?.texture?.name??null},
    after:{...after,target:after.target?.texture?.name??null},
  });
  return {
    status:tests.every(t=>t.passed)?'passed':'failed',generatedAt:new Date().toISOString(),
    method:'Actual isolated Float32 GPU render-target simulation and readback; 2 m flat bed plus fixed dry island; forcing/current zero.',
    elapsedWallMs:performance.now()-started,
    summary:{passed:tests.filter(t=>t.passed).length,failed:tests.filter(t=>!t.passed).length,total:tests.length},
    tests,observations,
    limits:['Not a screen-image or main-scene frame-rate test.','Sponge removes volume after waves reach the boundary; late-time global volume is reported, not asserted conserved.'],
  };
}
