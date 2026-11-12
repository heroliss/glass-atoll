import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {solveSteadyFlow,buildVolumeNeutralImpulse} from '../hydrodynamics.js';

const directory=path.dirname(fileURLToPath(import.meta.url));
const root=path.dirname(directory);
const mainSource=fs.readFileSync(path.join(root,'main.js'),'utf8');
const hydroSource=fs.readFileSync(path.join(root,'hydrodynamics.js'),'utf8');
const terrainBody=mainSource.match(/export function terrainHeight\(x,z\)\{([\s\S]*?)\n\}/)?.[1];
if(!terrainBody)throw new Error('Actual scene terrain function not found.');
const actualTerrain=new Function('x','z',terrainBody);
const tests=[];
const fixtures={};
const add=(id,passed,evidence)=>tests.push({id,passed:Boolean(passed),...evidence});
const hypotMax=(a,b)=>a.reduce((max,x,i)=>Math.max(max,Math.hypot(x,b[i])),0);

// Independently measure the conservative constraint from exported face fields,
// rather than accepting the solver's own reported convergence as proof.
function measure(flow){
  const n=flow.resolution,dx=flow.dx;
  let sum2=0,max=0,wet=0,integral=0,netBoundaryFlux=0,absoluteBoundaryFlux=0,dryFlux=0;
  for(let j=0;j<n;j++)for(let i=0;i<n;i++){
    const k=j*n+i;if(!flow.depth[k])continue;wet++;
    const w=j*(n+1)+i,e=w+1,s=j*n+i,t=s+n;
    const qw=flow.rightDepth[w]*flow.faceX[w],qe=flow.rightDepth[e]*flow.faceX[e];
    const qs=flow.topDepth[s]*flow.faceZ[s],qt=flow.topDepth[t]*flow.faceZ[t];
    const divergence=(qe-qw+qt-qs)/dx;
    sum2+=divergence*divergence;max=Math.max(max,Math.abs(divergence));integral+=divergence*dx*dx;
    const boundaries=[];
    if(i===0)boundaries.push(-qw*dx);if(i===n-1)boundaries.push(qe*dx);
    if(j===0)boundaries.push(-qs*dx);if(j===n-1)boundaries.push(qt*dx);
    for(const flux of boundaries){netBoundaryFlux+=flux;absoluteBoundaryFlux+=Math.abs(flux);}
  }
  for(let k=0;k<flow.faceX.length;k++)if(!flow.rightDepth[k])dryFlux=Math.max(dryFlux,Math.abs(flow.faceX[k]));
  for(let k=0;k<flow.faceZ.length;k++)if(!flow.topDepth[k])dryFlux=Math.max(dryFlux,Math.abs(flow.faceZ[k]));
  return {wetCells:wet,rmsDivergence:Math.sqrt(sum2/Math.max(1,wet)),maxDivergence:max,
    integralDivergence:integral,netBoundaryFlux,absoluteBoundaryFlux,maxDryNormalFlow:dryFlux,
    maximumCenterSpeed:hypotMax(flow.centerX,flow.centerZ)};
}
const definitions=[
  ['flat',()=>-2,24,96],
  ['sloping', (x,z)=>-(2+.025*x+.01*z),24,96],
  ['island',(x,z)=>Math.max(-3,.8-.25*Math.hypot(x,z)),24,96],
  ['sealed_basin',(x,z)=>Math.hypot(x,z)<6?-2:1,24,96],
  ['actual_scene',actualTerrain,72,128],
];
const flows={};
for(const [name,terrainHeight,extent,resolution] of definitions){
  const start=performance.now();
  const flow=solveSteadyFlow(terrainHeight,{extent,resolution});flows[name]=flow;
  const measured=measure(flow);
  fixtures[name]={elapsedMs:performance.now()-start,configuration:{extent,resolution},solver:flow.metrics,independent:measured};
  add(`${name}_projection_converged`,flow.metrics.converged&&flow.metrics.relativeResidual<=2e-5,{relativeResidual:flow.metrics.relativeResidual,iterations:flow.metrics.iterations});
  add(`${name}_depth_flux_continuity`,measured.rmsDivergence<=2e-5&&measured.maxDivergence<=2e-4,{rms:measured.rmsDivergence,max:measured.maxDivergence,notes:'Independent divergence of H times face velocity, in unit-speed flow.'});
  add(`${name}_dry_face_impermeability`,measured.maxDryNormalFlow===0,{maximumDryNormalFlow:measured.maxDryNormalFlow});
  add(`${name}_discrete_divergence_theorem`,Math.abs(measured.integralDivergence-measured.netBoundaryFlux)<1e-9,{integralDivergence:measured.integralDivergence,boundaryFlux:measured.netBoundaryFlux});
  add(`${name}_bounded_global_normalisation`,measured.maximumCenterSpeed<=1+1e-12,{maximumCenterSpeed:measured.maximumCenterSpeed});
}

const unitDirection={x:1/Math.sqrt(1.0625),z:-.25/Math.sqrt(1.0625)};
const flat=flows.flat;
const actualFlatFlow=flat.sampleUnitFlow(0,0);
add('flat_current_matches_analytic_constant_solution',Math.hypot(actualFlatFlow.x-unitDirection.x,actualFlatFlow.z-unitDirection.z)<1e-12,{observed:actualFlatFlow,expected:unitDirection});
// A real velocity sample must transport a marker. Integrate the actual sampler
// with midpoint RK2 and compare with the exact constant-current trajectory.
let x=-4,z=1;
for(let i=0;i<240;i++){
  const dt=1/60,speed=.22,a=flat.sampleUnitFlow(x,z);
  const mid=flat.sampleUnitFlow(x+a.x*speed*dt*.5,z+a.z*speed*dt*.5);
  x+=mid.x*speed*dt;z+=mid.z*speed*dt;
}
const expectedPosition=[-4+unitDirection.x*.22*4,1+unitDirection.z*.22*4];
add('rk2_marker_actual_sampler_transports_at_metres_per_second',Math.hypot(x-expectedPosition[0],z-expectedPosition[1])<1e-10,{observed:[x,z],expected:expectedPosition,seconds:4,speed:.22});
add('sealed_basin_has_no_forced_circulation',hypotMax(flows.sealed_basin.centerX,flows.sealed_basin.centerZ)<2e-4,{maximumSpeed:hypotMax(flows.sealed_basin.centerX,flows.sealed_basin.centerZ),notes:'A blocked uniform potential drive should be cancelled, not amplified by normalising tiny residuals.'});
add('island_sampler_stops_on_land',flows.island.sampleUnitFlow(0,0).x===0&&flows.island.sampleUnitFlow(0,0).z===0,{observed:flows.island.sampleUnitFlow(0,0)});

const impactCases=[['flat_center',flows.flat,0,0],['flat_edge',flows.flat,23.7,2],['island_shore',flows.island,3.7,0],['actual_nearshore',flows.actual_scene,24,17]];
const impacts={};
for(const [name,flow,ix,iz] of impactCases){
  const impact=buildVolumeNeutralImpulse(flow.depth,flow.resolution,flow.extent,ix,iz,1);
  const dx=flow.dx;
  const volume=impact.cells.reduce((sum,[,h])=>sum+h,0)*dx*dx;
  const dryTouched=impact.cells.filter(([k])=>flow.depth[k]<=.08).length;
  const float32Volume=impact.cells.reduce((sum,[,h])=>sum+Math.fround(h),0)*dx*dx;
  impacts[name]={cells:impact.cells.length,volume,float32Volume,maximumAmplitude:impact.amplitude,dryTouched};
  add(`${name}_impulse_zero_net_volume`,impact.cells.length>0&&Math.abs(volume)<1e-12&&Math.abs(float32Volume)<1e-6,{...impacts[name],doubleTolerance:1e-12,float32Tolerance:1e-6});
  add(`${name}_impulse_only_touches_wet_cells`,dryTouched===0,{dryTouched});
}
const empty=solveSteadyFlow(()=>1,{extent:24,resolution:24});
add('all_dry_domain_is_finite_and_still',empty.metrics.wetCells===0&&empty.metrics.converged&&hypotMax(empty.centerX,empty.centerZ)===0,{metrics:empty.metrics});

const report={status:tests.every(t=>t.passed)?'passed':'failed',generatedAt:new Date().toISOString(),
  method:'Independent CPU measurements of the actual exported finite-volume projection and impact functions, plus analytic constant-current transport.',
  sourceSHA256:{'hydrodynamics.js':crypto.createHash('sha256').update(hydroSource).digest('hex'),'main.js':crypto.createHash('sha256').update(mainSource).digest('hex')},
  summary:{passed:tests.filter(t=>t.passed).length,failed:tests.filter(t=>!t.passed).length,total:tests.length},tests,fixtures,impacts,
  limits:['CPU convergence refers to its coarse projection grid; resampling the field to the higher-resolution GPU grid is an approximation, not a second exact projection.',
    'The separate GPU report is required to verify actual render-target evolution and readback.',
    'The flat analytic RK2 fixture verifies speed and transport, not complete wave-orbital or shallow-water-velocity coupling of the displayed leaf.'],
};
fs.writeFileSync(path.join(directory,'hydro-math-check.json'),JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({status:report.status,...report.summary,failures:tests.filter(t=>!t.passed)},null,2));
process.exitCode=report.status==='passed'?0:1;
