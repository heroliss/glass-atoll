import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {waveComponents,waveCascades,waveStatistics,waveGLSL,waveOmega,waveNumber,waveWindFactor,waveComponentGain,evaluateWaveSpectrum,seaStateDefaults,sanitizeSeaState} from '../waves.js';
import {shallowSwellDefaults,shallowSwellModes,shallowSwellWeights,sampleShallowSwell,sanitizeShallowSwell} from '../hydrodynamics.js';

const directory=path.dirname(fileURLToPath(import.meta.url)),root=path.dirname(directory),checks=[];
const add=(id,passed,evidence={})=>checks.push({id,passed:!!passed,...evidence});
const close=(id,actual,expected,tolerance)=>add(id,Math.abs(actual-expected)<=tolerance,{actual,expected,tolerance});
const group=kind=>waveComponents.filter(w=>w.kind===kind);
const variance=modes=>modes.reduce((s,w)=>s+w.amplitude*w.amplitude/2,0);
const slopeVariance=modes=>modes.reduce((s,w)=>s+(w.amplitude*w.k)**2/2,0);
const power=modes=>modes.reduce((s,w)=>s+w.amplitude*w.amplitude,0);
const swell=group('swell'),wind=group('wind');
const weighted=(modes,fn)=>modes.reduce((s,w)=>s+w.amplitude*w.amplitude*fn(w),0)/power(modes);
const direction=modes=>Math.atan2(weighted(modes,w=>Math.sin(w.angle)),weighted(modes,w=>Math.cos(w.angle)));
const spread=modes=>{const d=direction(modes);return Math.sqrt(weighted(modes,w=>Math.atan2(Math.sin(w.angle-d),Math.cos(w.angle-d))**2));};
const summaries=waveCascades.map((band,index)=>{
  const modes=waveComponents.filter(w=>w.cascade===index),s=power(modes);
  return {kind:band.kind,domainMetres:band.domain,count:modes.length,significantHeightMetres:4*Math.sqrt(variance(modes)),rmsSlope:Math.sqrt(slopeVariance(modes)),weightedMeanPeriodSeconds:2*Math.PI/weighted(modes,w=>waveOmega(w.k)),weightedDirectionDegrees:direction(modes)*180/Math.PI,weightedAngularStandardDeviationDegrees:spread(modes)*180/Math.PI,effectiveEnergyModeCount:s*s/modes.reduce((n,w)=>n+w.amplitude**4,0),maximumIntegerMode:Math.max(...modes.map(w=>Math.max(Math.abs(w.modeX),Math.abs(w.modeZ)))),heightVarianceFraction:variance(modes)/variance(waveComponents),slopeVarianceFraction:slopeVariance(modes)/slopeVariance(waveComponents)};
});

add('four_64_mode_systems_with_distinct_periodic_lattice',waveCascades.length===4&&summaries.every(s=>s.count===64)&&waveComponents.length===256,{summaries});
add('every_mode_finite_unique_in_band_and_below_256_grid_nyquist',waveCascades.every((band,index)=>{
  const modes=waveComponents.filter(w=>w.cascade===index);
  return new Set(modes.map(w=>w.modeX+','+w.modeZ)).size===modes.length&&modes.every(w=>[w.k,w.amplitude,w.angle,w.phase].every(Number.isFinite)&&w.k>=band.lo&&w.k<=band.hi&&Math.abs(w.modeX)<128&&Math.abs(w.modeZ)<128&&Math.abs(w.k-2*Math.PI*Math.hypot(w.modeX,w.modeZ)/band.domain)<1e-12);
}),{maximumIntegerModes:summaries.map(s=>s.maximumIntegerMode),nyquistIntegerMode:128,notes:'Necessary base-field Nyquist check, not a proof that all nonlinear moment frequencies are fully resolved.'});
close('swell_significant_height_from_parseval',4*Math.sqrt(variance(swell)),.16,1e-14);
close('short_wind_slope_targets_preserved',Math.max(...waveCascades.slice(1).map((b,i)=>Math.abs(Math.sqrt(slopeVariance(waveComponents.filter(w=>w.cascade===i+1)))-b.slopeRMS))),0,1e-14);
add('swell_is_narrower_and_separate_from_wind_sea',spread(swell)<.2&&spread(waveComponents.filter(w=>w.cascade===1))>.3&&Math.abs(direction(swell)-direction(wind))>.6,{swellStdRadians:spread(swell),windSeaStdRadians:spread(waveComponents.filter(w=>w.cascade===1)),directionSeparationRadians:Math.abs(direction(swell)-direction(wind))});
add('swell_power_center_near_authored_7_5_second_peak',Math.abs(summaries[0].weightedMeanPeriodSeconds-7.5)<.6,{actualWeightedMeanSeconds:summaries[0].weightedMeanPeriodSeconds,authoredPeakSeconds:7.5,notes:'A finite seeded Gaussian sample need not have its mean or a binned maximum exactly at the input peak.'});
const windSea=waveComponents.filter(w=>w.cascade===1),windSeaPeakFraction=weighted(windSea,w=>{const period=2*Math.PI/waveOmega(w.k);return period>=1.8&&period<=2.5?1:0;});
add('wind_sea_energy_has_separate_shorter_period_peak',windSeaPeakFraction>.65,{fractionBetween1_8And2_5Seconds:windSeaPeakFraction});
add('swell_not_degenerate_to_a_few_coherent_lines',summaries[0].effectiveEnergyModeCount>24,{effectiveEnergyModeCount:summaries[0].effectiveEnergyModeCount});
const calmHs=4*Math.sqrt(waveComponents.reduce((s,w)=>s+(w.amplitude*waveComponentGain(w,waveWindFactor(0)))**2/2,0));
close('zero_wind_retains_independent_swell',calmHs,.16,1e-14);
close('zero_swell_zero_wind_is_flat_spectrum',Math.max(...evaluateWaveSpectrum(13,-8,4,{windFactor:0,seaState:{swellHeight:0,windSea:1}}).map(Math.abs)),0,0);
let maximumGradientError=0,maximumDoublingError=0;
for(let i=0;i<64;i++){
  const x=i*1.731-40,z=Math.sin(i*2.399)*36,time=i*.173,eps=1e-5,options={windFactor:1.37,currentOffset:[.91,-.34],seaState:{swellHeight:.23,windSea:.63}};
  const f=evaluateWaveSpectrum(x,z,time,options),dx=(evaluateWaveSpectrum(x+eps,z,time,options)[0]-evaluateWaveSpectrum(x-eps,z,time,options)[0])/(2*eps),dz=(evaluateWaveSpectrum(x,z+eps,time,options)[0]-evaluateWaveSpectrum(x,z-eps,time,options)[0])/(2*eps);
  maximumGradientError=Math.max(maximumGradientError,Math.abs(dx-f[1]),Math.abs(dz-f[2]));
  const a=evaluateWaveSpectrum(x,z,time,{windFactor:0}),b=evaluateWaveSpectrum(x,z,time,{windFactor:0,seaState:{swellHeight:.32,windSea:1}});
  maximumDoublingError=Math.max(maximumDoublingError,...a.map((v,j)=>Math.abs(b[j]-2*v)));
}
close('nonunit_independent_gains_preserve_height_gradient',maximumGradientError,0,1e-6);
close('doubling_swell_scales_height_and_slopes_linearly',maximumDoublingError,0,1e-14);
close('independent_moment_variance_scales_quadratically',variance(swell)*4,variance(swell.map(w=>({...w,amplitude:w.amplitude*2}))),1e-15);

// Run the actual shader's scalar variance expression against an independently
// assembled mixture of means and nonnegative within-cascade variances.
const momentBody=waveGLSL.match(/float windGain=uWind\*uWindSea;([\s\S]*?)return a\.xyz/)[1];
const expression=momentBody.match(/unresolvedSlopeVariance=([^;]+);/)[1]
  .replace(/dot\(([abcd])\.yz,\1\.yz\)/g,'($1[1]*$1[1]+$1[2]*$1[2])').replace(/([abcd])\.w/g,'$1[3]');
const shaderVariance=new Function('a','b','c','d','uSwell','uWind','uWindSea','max',`const windGain=uWind*uWindSea;return ${expression};`);
let mixtureError=0;
for(let i=0;i<256;i++){
  const fields=Array.from({length:4},(_,j)=>{const sx=Math.sin(i+j)*.1,sz=Math.cos(i*1.31+j)*.1,v=(i+j+1)*.000003;return [0,sx,sz,sx*sx+sz*sz+v];});
  const swellGain=(i%9)/4,windGain=(i%13)/7,windSeaGain=(i%7)/4;
  const expected=fields.reduce((s,f,j)=>s+(f[3]-f[1]**2-f[2]**2)*(j===0?swellGain**2:(windGain*windSeaGain)**2),0);
  mixtureError=Math.max(mixtureError,Math.abs(shaderVariance(...fields,swellGain,windGain,windSeaGain,Math.max)-expected));
}
close('actual_GLSL_mip_variance_uses_each_system_gain_squared',mixtureError,0,1e-14);
add('sea_state_bounds_reject_NaN_and_retain_previous_values',JSON.stringify(sanitizeSeaState({swellHeight:NaN,windSea:Infinity}))===JSON.stringify(seaStateDefaults)&&sanitizeSeaState({swellHeight:3,windSea:-1}).swellHeight===.32&&sanitizeSeaState({swellHeight:3,windSea:-1}).windSea===0);

// Narrow-band complex envelopes expose deterministic beat groups without
// confusing the carrier's rapid oscillation with independent random flicker.
const envelopes=[];
for(let i=0;i<1800;i++){
  const time=i*.25;let real=0,imaginary=0;
  for(const w of swell){const phase=waveOmega(w.k)*time-w.phase;real+=w.amplitude*Math.cos(phase);imaginary+=w.amplitude*Math.sin(phase);}
  envelopes.push(Math.hypot(real,imaginary));
}
const envelopeMean=envelopes.reduce((s,v)=>s+v,0)/envelopes.length,envelopeStd=Math.sqrt(envelopes.reduce((s,v)=>s+(v-envelopeMean)**2,0)/envelopes.length);
add('fixed_phases_form_natural_nonconstant_wave_groups',envelopeStd/envelopeMean>.25,{envelopeCoefficientOfVariation:envelopeStd/envelopeMean,durationSeconds:450,sampleStepSeconds:.25,notes:'Deterministic interference of the fixed narrow-band modes, not a separately multiplied noise envelope.'});
const repeatCoherence=weighted(swell,w=>Math.cos(waveOmega(w.k)*7.5));
add('peak_period_is_not_a_forced_whole_surface_loop',repeatCoherence<.9,{phaseCoherenceAfter7_5Seconds:repeatCoherence});
let inverseDispersionError=0;
for(const period of [.2,.5,2.2,7.5,20])for(const depth of [1,3,32]){
  const omega=2*Math.PI/period,k=waveNumber(omega,depth);inverseDispersionError=Math.max(inverseDispersionError,Math.abs(waveOmega(k,depth)/omega-1));
}
close('frequency_to_wavenumber_respects_gravity_capillary_dispersion',inverseDispersionError,0,1e-12);

let weightError=0;
for(const g of [0,.1,.35,.8])weightError=Math.max(weightError,Math.abs(shallowSwellWeights(g).reduce((s,w)=>s+w*w,0)-1));
close('SWE_groupiness_preserves_sum_of_component_amplitude_squared',weightError,0,1e-14);
const amplitude=shallowSwellDefaults.amplitude,depth=2,directionLength=Math.sqrt(1.0625);
let boundaryFluxError=0;
for(let i=0;i<128;i++){
  const f=sampleShallowSwell(-21,i*.3,depth,i*.31);
  boundaryFluxError=Math.max(boundaryFluxError,Math.abs(f.u*1/directionLength+f.v*(-.25/directionLength)-f.eta*Math.sqrt(9.81/depth)));
}
close('SWE_incident_velocity_matches_linear_long_wave_impedance',boundaryFluxError,0,1e-14);
let sampledEnergy=0;const samples=65536,step=.0625;
for(let i=0;i<samples;i++){const f=sampleShallowSwell(0,0,depth,i*step);sampledEnergy+=f.eta*f.eta/samples;}
add('grouped_boundary_has_correct_long_time_RMS_input',Math.abs(sampledEnergy/(amplitude*amplitude/2)-1)<.01,{measuredVariance:sampledEnergy,expectedAsymptoticVariance:amplitude*amplitude/2,relativeError:sampledEnergy/(amplitude*amplitude/2)-1,durationSeconds:samples*step});
const noGroups=sampleShallowSwell(3,-1,depth,2,{...shallowSwellDefaults,groupiness:0});
const expectedSingle=amplitude*Math.cos(2*Math.PI/20/Math.sqrt(9.81*depth)*(3-.25*-1)/directionLength-2*Math.PI/20*2);
close('zero_groupiness_reduces_to_single_physical_carrier',noGroups.eta,expectedSingle,1e-14);
const off=sampleShallowSwell(2,3,depth,4,{...shallowSwellDefaults,amplitude:0});
close('zero_SWE_amplitude_disables_all_boundary_components',Math.max(Math.abs(off.eta),Math.abs(off.u),Math.abs(off.v)),0,0);
add('SWE_configuration_remains_in_small_amplitude_range',sanitizeShallowSwell({amplitude:100,period:1,groupiness:4}).amplitude===.02&&sanitizeShallowSwell({period:1}).period===14&&sanitizeShallowSwell({period:100}).period===28&&sanitizeShallowSwell({groupiness:4}).groupiness===.8);

const hydroSource=fs.readFileSync(path.join(root,'hydrodynamics.js'),'utf8');
add('SWE_period_change_retains_existing_integrated_phase',/function setSwellState\(next=\{\}\)\{([\s\S]*?)return \{\.\.\.swellState\};/.test(hydroSource)&&!hydroSource.match(/function setSwellState\(next=\{\}\)\{([\s\S]*?)return \{\.\.\.swellState\};/)[1].includes('swellPhases['),{notes:'Source wiring only. Actual GPU state and renderer restoration require the browser-side check.'});
const longWaveApproximation=[3,32].map(h=>{
  const maximumOmega=Math.max(...shallowSwellModes.map(m=>2*Math.PI/20*m.ratio)),k=waveNumber(maximumOmega,h),truePhaseSpeed=maximumOmega/k,shallowSpeed=Math.sqrt(9.81*h);
  return {depthMetres:h,shortestDefaultPeriodSeconds:2*Math.PI/maximumOmega,kTimesDepth:k*h,SWEPhaseSpeed:shallowSpeed,finiteDepthPhaseSpeed:truePhaseSpeed,relativeSpeedOverestimate:shallowSpeed/truePhaseSpeed-1};
});
add('SWE_default_long_wave_approximation_is_explicitly_bounded',longWaveApproximation[0].relativeSpeedOverestimate<.01&&longWaveApproximation[1].relativeSpeedOverestimate<.08,{bounds:longWaveApproximation,notes:'The nondispersive SWE approximation is better near the shore than at the deepest outer edge. It is not exact finite-depth dispersion.'});

const report={kind:'Independent physical invariants of the separated swell/wind spectrum and grouped SWE boundary',generatedAt:new Date().toISOString(),status:checks.every(c=>c.passed)?'passed':'failed',summary:{passed:checks.filter(c=>c.passed).length,failed:checks.filter(c=>!c.passed).length,total:checks.length},sourceSHA256:Object.fromEntries(['waves.js','spectral-waves.js','hydrodynamics.js'].map(name=>[name,crypto.createHash('sha256').update(fs.readFileSync(path.join(root,name))).digest('hex')])),before:{sourceSHA256:{'waves.js':'73b4104422c3cc90cbb38fec097727328886ec20e25eae4e5433c27b712e9d7c','spectral-waves.js':'7fc4063b42fc826995d57a76d68140ed43d043cae3e33bc566fe85b7282e8364','hydrodynamics.js':'b232abcfa5873e5109402b2946078495d3af5d3c2b6e15b54beed0062aa21962'},rmsSlope:.10856334556377673,rmsHeightMetres:.03600642384703511,significantHeightMetres:.14402569538814045,longestBandHeightVarianceFraction:.5232801883962608,longestBandSlopeVarianceFraction:.0030544714067537756,shortestBandSlopeVarianceFraction:.6872560665195995},after:waveStatistics,cascades:summaries,checks,limits:['CPU physical/algebraic and source-expression tests; no GPU compilation or visual/performance acceptance is implied.','The sampled Fourier spectrum is linear, prescribed at3m reference depth, and has no overturning/breaking or full nonlinear interactions.','Swell peak period and directions are authored constants in this bounded revision; runtime sea-state controls only swell height and wind-sea amplitude.','The separate20s SWE boundary propagates over actual depth but is nondispersive and is not a complete continuation of the7.5s swell.','Moment mips preserve independent-system unresolved slope variance in expectation; cross-cascade covariance and exact anisotropic footprint integration are approximated.']};
fs.writeFileSync(path.join(directory,'sea-state-math-check.json'),JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({status:report.status,...report.summary,failures:checks.filter(c=>!c.passed),spectrum:waveStatistics,longWaveApproximation},null,2));
process.exitCode=report.status==='passed'?0:1;
