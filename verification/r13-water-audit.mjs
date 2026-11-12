// Read-only physical-scale/source audit. No renderer or production mutation.
import fs from 'node:fs';import crypto from 'node:crypto';import assert from 'node:assert/strict';
import {waveComponents,waveCascades,waveStatistics,waveOmega,waveNumber,WAVE_REFERENCE_DEPTH,seaStateDefaults} from '../waves.js';
import {shallowSwellDefaults,shallowSwellModes,shallowSwellWeights,solveSteadyFlow} from '../hydrodynamics.js';
import {QUALITY_PRESETS} from '../quality-presets.js';
const root=new URL('../',import.meta.url),read=p=>fs.readFileSync(new URL(p,root),'utf8'),sha=s=>crypto.createHash('sha256').update(s).digest('hex');
const paths=['waves.js','spectral-waves.js','hydrodynamics.js','water.js','caustics.js','sand.js','floating-leaves.js','main.js'],hashes=Object.fromEntries(paths.map(p=>[p,sha(read(p))]));
const main=read('main.js'),terrainBody=main.match(/export function terrainHeight\(x,z\)\{([\s\S]*?)\n\}/)?.[1];assert(terrainBody);
const terrain=new Function('x','z',terrainBody),g=9.81,sigma=.000070244;
const groupVelocity=(k,h=3)=>{const kh=k*h,t=Math.tanh(Math.min(kh,4)),omega=waveOmega(k,h);return((g+3*sigma*k*k)*t+(kh<4?(g*k+sigma*k**3)*h*(1-t*t):0))/(2*omega);};
const weighted=(m,fn)=>m.reduce((s,w)=>s+w.amplitude**2*fn(w),0)/m.reduce((s,w)=>s+w.amplitude**2,0);
const bands=waveCascades.map((band,index)=>{
  const m=waveComponents.filter(w=>w.cascade===index),variance=m.reduce((s,w)=>s+w.amplitude**2/2,0),direction=Math.atan2(weighted(m,w=>Math.sin(w.angle)),weighted(m,w=>Math.cos(w.angle)));
  return{kind:band.kind,count:m.length,domainMetres:band.domain,significantHeightMetres:4*Math.sqrt(variance),slopeRMS:Math.sqrt(m.reduce((s,w)=>s+(w.amplitude*w.k)**2/2,0)),
    minMaxPeriodSeconds:[Math.min(...m.map(w=>2*Math.PI/waveOmega(w.k))),Math.max(...m.map(w=>2*Math.PI/waveOmega(w.k)))],energyWeightedMeanPeriodSeconds:weighted(m,w=>2*Math.PI/waveOmega(w.k)),
    energyWeightedMeanWavelengthMetres:weighted(m,w=>2*Math.PI/w.k),energyWeightedMeanPhaseSpeedMps:weighted(m,w=>waveOmega(w.k)/w.k),energyWeightedMeanGroupSpeedMps:weighted(m,w=>groupVelocity(w.k)),
    propagationDirectionDegreesFromPositiveXToPositiveZ:direction*180/Math.PI,heightVarianceFraction:variance/(waveStatistics.rmsHeight**2)};
});
const depthComparison=[.05,.08,.1,.3,.5,1,1.5,3,10,32].map(depth=>{const T=7.5,omega=2*Math.PI/T,k=waveNumber(omega,depth);return{depthMetres:depth,periodSeconds:T,kRadPerM:k,wavelengthMetres:2*Math.PI/k,phaseSpeedMps:omega/k,groupSpeedMps:groupVelocity(k,depth),kh:k*depth,defaultSwellHsOverDepth:.16/depth};});
const shore=[];
for(let index=0;index<64;index++){
  const angle=2*Math.PI*index/64,dx=Math.cos(angle),dz=Math.sin(angle),pointAt=r=>[-1.5+r*dx,-1+r*dz];
  const find=height=>{let lo=0,hi=90;for(let k=0;k<58;k++){const mid=(lo+hi)/2,p=pointAt(mid);if(terrain(...p)>height)lo=mid;else hi=mid;}return(lo+hi)/2;};
  const r0=find(0),rDry=find(-.08),p=pointAt(r0),eps=.025,gx=(terrain(p[0]+eps,p[1])-terrain(p[0]-eps,p[1]))/(2*eps),gz=(terrain(p[0],p[1]+eps)-terrain(p[0],p[1]-eps))/(2*eps),slope=Math.hypot(gx,gz);
  const inward=[gx/slope,gz/slope],swell=waveComponents.filter(w=>w.kind==='swell'),incidentFluxFraction=weighted(swell,w=>Math.max(0,Math.cos(w.angle)*inward[0]+Math.sin(w.angle)*inward[1]));
  shore.push({index,angleDegrees:angle*180/Math.PI,pointXZ:p,localSlope:slope,radialGapToFixedHydroDryBoundaryMetres:rDry-r0,inwardNormalXZ:inward,incidentSwellProjection:incidentFluxFraction,
    authoredFoamPhaseOffshoreSpeedMps:.07222222222222222/slope});
}
const sortedSlope=shore.map(s=>s.localSlope).sort((a,b)=>a-b),sortedGap=shore.map(s=>s.radialGapToFixedHydroDryBoundaryMetres).sort((a,b)=>a-b);
let maxDepth=0,wetCells=0;const n=384,extent=72,dx=2*extent/n;for(let j=0;j<n;j++)for(let i=0;i<n;i++){const h=Math.max(0,-terrain(-extent+(i+.5)*dx,-extent+(j+.5)*dx));if(h>.08){wetCells++;maxDepth=Math.max(maxDepth,h);}}
const fixedDt=Math.min(1/120,.28*dx/(Math.sqrt(g*Math.max(maxDepth,.1))+.5));
const actualHostDeltaCap=Number(main.match(/let delta=Math\.min\(clock\.getDelta\(\),([.\d]+)\)/)?.[1]);assert(Number.isFinite(actualHostDeltaCap));
const replayClock=(hz,hostCap)=>{let accumulated=0,simulationTime=0,dropped=0,totalSteps=0,sceneSeconds=0;const duration=120;for(let i=0;i<hz*duration;i++){
  const delta=Math.min(1/hz,hostCap),incoming=Math.min(delta,.25);sceneSeconds+=delta;dropped+=Math.max(0,delta-incoming);accumulated+=incoming;const steps=Math.min(12,Math.floor((accumulated+1e-12)/fixedDt));if(!steps)continue;totalSteps+=steps;simulationTime+=steps*fixedDt;accumulated-=steps*fixedDt;if(accumulated>fixedDt*24){dropped+=accumulated-fixedDt*24;accumulated=fixedDt*24;}
}return{renderHz:hz,wallSeconds:duration,sceneSeconds,hydroSimulatedSeconds:simulationTime,discardedSeconds:dropped,pendingSeconds:accumulated,totalSteps,averageFullscreenPassesPerFrame:2*totalSteps/(hz*duration),maximumSecondsAdvancedPerRender:12*fixedDt};};
const clocks=[120,60,30,20,15,10,5].map(hz=>replayClock(hz,Infinity)),hostClocks=[120,60,30,20,15,10,5].map(hz=>replayClock(hz,actualHostDeltaCap));
const flow=solveSteadyFlow(terrain,{extent:72,resolution:128}),refFlow=flow.sampleUnitFlow(60,60),currentUI=.16;
const caustics=Object.entries(QUALITY_PRESETS).map(([id,p])=>({quality:id,grid:p.request.causticsGrid,targetSize:p.request.causticsSize,maxHz:p.request.causticsHz,
  gridCellMetres:128/p.request.causticsGrid,trianglesPerUpdate:2*p.request.causticsGrid**2,requestedTriangleRate:2*p.request.causticsGrid**2*p.request.causticsHz,
  maximumNominalTimeStalenessSeconds:1/p.request.causticsHz,phaseStalenessAtOneSecondWaveDegrees:360/p.request.causticsHz}));
const report={schema:'glass-atoll.r13-water-audit.v1',dateUTC:new Date().toISOString(),actualGPU:false,runtimeMutated:false,sourceSHA256:hashes,
  definitions:{Hs:'4*sqrt(sum(amplitude^2/2)), independent phase ensemble, not individual crest-to-trough height',phaseSpeed:'omega/k relative to water; current adds Doppler advection',groupSpeed:'domega/dk of the actual capped-kh gravity-capillary dispersion',direction:'propagation vector (cos angle,sin angle), from+x toward+z; no geographic north mapping'},
  defaultState:{...seaStateDefaults,windSpeedUI:1.8,currentSpeedUI:currentUI,analyticDepthMetres:WAVE_REFERENCE_DEPTH,statistics:waveStatistics},bands,depthComparison,
  shallowBoundary:{...shallowSwellDefaults,weights:shallowSwellWeights(),periodsSeconds:shallowSwellModes.map(m=>shallowSwellDefaults.period/m.ratio),directionDegrees:Math.atan2(-.25,1)*180/Math.PI,
    rmsElevationMetres:shallowSwellDefaults.amplitude/Math.sqrt(2),equivalentSpectralHsMetres:4*shallowSwellDefaults.amplitude/Math.sqrt(2),regularEquivalentWaveHeightMetres:2*shallowSwellDefaults.amplitude,
    warning:'A distinct lower-frequency authored system, not an exact duplicate of the7.5s spectrum and not its depth-aware continuation.'},
  shoreline:{count:shore.length,slopeMinimum:sortedSlope[0],slopeMedian:sortedSlope[32],slopeMaximum:sortedSlope.at(-1),fixedDryBoundaryRadialGapMinMetres:sortedGap[0],fixedDryBoundaryRadialGapMedianMetres:sortedGap[32],fixedDryBoundaryRadialGapMaxMetres:sortedGap.at(-1),points:shore},
  nativeHydro:{extent,resolution:n,cells:n*n,dx,maxDepth,wetCells,fixedDt,defaultCurrentMps:currentUI,globalAnalyticCurrentOffsetMps:[refFlow.x*currentUI,refFlow.z*currentUI],fixedMaskDryDepth:.08,standaloneClockCounterfactual:clocks,actualHostDeltaCap,actualHostClocks:hostClocks,
    returnedFlow:'sampleFlow returns only steady potential-flow current; GPU perturbation u/v is not returned',clockWarning:'Standalone API can drop excess lag, but actual main caps delta0.055s below12*dt. Current host therefore retains analytic/SWE phase to one fixed tick and instead slows the whole scene at low renderHz. Do not claim standalone10Hz lag is an observed host defect.'},
  materialCoupling:{foam:{source:'sin(verticalDepth*18-time*1.3+noiseXZ*5)',fixedDepthPeriodSeconds:2*Math.PI/1.3,depthPhaseSpeedMps:1.3/18,foamDepthWindowMetres:[.018,.16],drivenBySolvedFlux:false},wetSand:{timeDependent:false,staticAlwaysWetHeightBelow:.008,staticAlwaysDryHeightAbove:.1935,solverContactHistory:false},
    caustics:{sameWaveUniforms:true,sharedHydroTexture:true,filters:'geometry footprint0.40m; caustics0.12m or0.32m; optical per-pixel footprint. Shared phases but different deliberate LOD, not identical per-pass shapes.',presets:caustics},
    sandDirectLighting:'shared solar/key caustic concentration multiplies the entire standard-material reflectedLight.directDiffuse including local lights; water custom bedLocal does not have this multiplication.'},
  invariants:{sourceHashesUnchanged:paths.every(p=>sha(read(p))===hashes[p]),currentHydroHasWettingDrying:false,currentHydroHasBreaking:false,currentWetSandHasHistory:false},
  limits:['Numerical/source audit only; no fresh GPU capture, no measuredFPS or subjective visual acceptance.','The physical dispersion table is a small-amplitude diagnostic; rows with Hs/depth near1 are outside the validity of that linear waveform.','Steady projection velocity is an authored tide flow, not solved wave runup/backwash.','The dry boundary gap uses radial coast probes and actual scene terrain; it is not a surveyed real island slope.']};
assert(report.invariants.sourceHashesUnchanged);assert(Math.abs(bands[0].significantHeightMetres-.16)<1e-12);
fs.writeFileSync(new URL('r13-water-audit.json',import.meta.url),JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({bands,depthComparison,shoreline:{slopeMedian:report.shoreline.slopeMedian,dryGapMedian:report.shoreline.fixedDryBoundaryRadialGapMedianMetres},nativeHydro:{fixedDt,clocks},runtimeMutated:false},null,2));
