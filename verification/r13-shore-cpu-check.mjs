import assert from 'node:assert/strict';import fs from 'node:fs';import crypto from 'node:crypto';
import {createShorelineCPU,shorelineStep,SHORELINE_LIMITS} from '../shoreline-dynamics.js';
import {createShorelineBoundary,SHORELINE_SWELL_MODES} from '../shoreline-boundary.js';
import {evaluateWaveSpectrum} from '../waves.js';
const root=new URL('../',import.meta.url),read=p=>fs.readFileSync(new URL(p,root),'utf8'),hash=s=>crypto.createHash('sha256').update(s).digest('hex'),checks=[],cases=[];
const check=async(name,fn)=>{const t=performance.now();try{const evidence=await fn();checks.push({name,passed:true,elapsedCpuMs:performance.now()-t,evidence});}catch(e){checks.push({name,passed:false,error:String(e.stack||e),elapsedCpuMs:performance.now()-t});}};
const near=(a,b,t=1e-10)=>assert(Math.abs(a-b)<=t*Math.max(1,Math.abs(a),Math.abs(b)),`${a} vs ${b}`);
const protectedPaths=['hydrodynamics.js','waves.js','spectral-waves.js','sand.js','fireworks.js','fireworks-audio.js'],protectedHashes=Object.fromEntries(protectedPaths.map(p=>[p,hash(read(p))]));
const fieldHash=s=>{const v=s.snapshot();return hash(JSON.stringify([v.time,v.tick,v.revision,v.h,v.qx,v.qz,v.wetness]));};
const advance=(s,time)=>{let r;do{r=s.advanceFence(time);}while(!r.completed);return r;};
const main=read('main.js'),terrainBody=main.match(/export function terrainHeight\(x,z\)\{([\s\S]*?)\n\}/)?.[1];assert(terrainBody);const actualTerrain=new Function('x','z',terrainBody);
await check('native64 swell phase and amplitude exactly match the spectrum low band at origin0/4000',()=>{
  const boundary=createShorelineBoundary({rampSeconds:0});let error=0;for(const time of [0,.1,10,4000,4007.25])for(const p of [[-46,-1],[-32,10],[5,17]]){
    const actual=boundary.sample(...p,1.5,time),expected=evaluateWaveSpectrum(...p,time,{windFactor:0})[0];error=Math.max(error,Math.abs(actual.eta-expected));near(actual.eta,expected,2e-13);
  }assert.equal(SHORELINE_SWELL_MODES.length,64);const phases=boundary.phases(1e8);assert(phases.every(p=>p>=0&&p<2*Math.PI));return{modes:64,maximumEtaError:error};
});
await check('lake at rest includes slope steps dry island and nonzero water level',()=>{
  let maxHeightError=0,maxSpeed=0;for(const seaLevel of [0,.2]){
    const terrain=(x,z)=>Math.max(-1.4+.025*x+.01*z,x>1?.35:-2,Math.hypot(x+2,z)<1.5?.6:-2),s=createShorelineCPU({resolution:32,center:[0,0],size:[12,12],terrainHeight:terrain,seaLevel,boundary:'closed',maxTicksPerAdvance:120,time:4000});
    const initial=s.snapshot();advance(s,4001);const after=s.snapshot();for(let i=0;i<after.h.length;i++){maxHeightError=Math.max(maxHeightError,Math.abs(after.h[i]-initial.h[i]));maxSpeed=Math.max(maxSpeed,after.h[i]>0?Math.hypot(after.qx[i]/after.h[i],after.qz[i]/after.h[i]):0);}near(s.diagnostics().ledger.residual,0);s.dispose();
  }assert(maxHeightError<1e-12&&maxSpeed<1e-10);return{maxHeightError,maxSpeed};
});
await check('closed2D disturbance preserves volume positivity and detached snapshots',()=>{
  const n=40,size=[12,12],h=[],qx=[],qz=[];for(let j=0;j<n;j++)for(let i=0;i<n;i++){const x=(i+.5)*size[0]/n-6,z=(j+.5)*size[1]/n-6;h.push(1+.025*Math.exp(-(x*x+z*z)));qx.push(.01*Math.sin(x)*Math.cos(z));qz.push(-.01*Math.cos(x)*Math.sin(z));}
  const initialState={h,qx,qz},s=createShorelineCPU({resolution:n,size,center:[0,0],terrainHeight:()=>-1,boundary:'closed',initialState,maxTicksPerAdvance:120});advance(s,1);const snap=s.snapshot(),before=fieldHash(s);assert(snap.h.every(v=>v>=0));near(s.diagnostics().ledger.residual,0,1e-11);h[0]=100;qx[0]=100;snap.h[0]=100;snap.grid.center[0]=100;const d=s.diagnostics();d.allocation.velocityBudgetMps=999;assert.equal(fieldHash(s),before);const out=s.handoffData();out.data[0]=999;assert.equal(fieldHash(s),before);return s.diagnostics().ledger;
});
await check('diagonal isolated wet cell rejects unsafe2D CFL without input mutation, stable dt remains positive',()=>{
  const n=16,count=n*n,h=Array(count).fill(0),qx=Array(count).fill(0),qz=Array(count).fill(0),k=8*n+8;h[k]=1;qx[k]=8;qz[k]=8;const input={h,qx,qz},before=JSON.stringify(input),base={terrainHeight:()=>0,grid:{resolution:n,center:[0,0],size:[16,16]},physicalState:input,boundary:'closed',manning:0};
  assert(.025*(8+Math.sqrt(9.81))<.42);assert.throws(()=>shorelineStep({...base,dt:.025}),/CFL/);assert.equal(JSON.stringify(input),before);const out=shorelineStep({...base,dt:.001});assert([...out.h,...out.qx,...out.qz].every(Number.isFinite));assert(out.h.every(v=>v>=0));near(out.h.reduce((s,v)=>s+v,0),1);return{oneDimensionalCflAtRejectedStep:.025*(8+Math.sqrt(9.81)),stableTwoDimensionalStep:out.stats};
});
await check('x/z transpose preserves the2D operator with tangential flux and bed correction',()=>{
  const n=16,size=[8,12],transpose=a=>Array.from({length:n*n},(_,k)=>a[(k%n)*n+Math.floor(k/n)]),terrain=(x,z)=>-.8+.02*x-.01*z,h=[],qx=[],qz=[];
  for(let j=0;j<n;j++)for(let i=0;i<n;i++){const x=(i+.5)*size[0]/n-size[0]/2,z=(j+.5)*size[1]/n-size[1]/2;h.push(-terrain(x,z)+.003*Math.sin(x)*Math.cos(z));qx.push(.02*Math.cos(x));qz.push(.015*Math.sin(z));}
  const a=shorelineStep({terrainHeight:terrain,grid:{resolution:n,center:[0,0],size},physicalState:{h,qx,qz},dt:.001,boundary:'closed'}),b=shorelineStep({terrainHeight:(x,z)=>terrain(z,x),grid:{resolution:n,center:[0,0],size:[12,8]},physicalState:{h:transpose(h),qx:transpose(qz),qz:transpose(qx)},dt:.001,boundary:'closed'});
  let error=0;for(const [x,y]of [[a.h,b.h],[a.qx,b.qz],[a.qz,b.qx]]){const expected=transpose(x);for(let k=0;k<n*n;k++)error=Math.max(error,Math.abs(expected[k]-y[k]));}assert(error<2e-14);return{maximumTransposeError:error};
});
await check('fixed-clock30/60/120Hz fences and bounded catchup produce identical complete state',()=>{
  const results=[];for(const hz of [30,60,120]){
    const s=createShorelineCPU({resolution:24,terrainHeight:actualTerrain,maxTicksPerAdvance:8});for(let i=1;i<=hz*2;i++)s.advanceFence(i/hz);advance(s,2);results.push({hz,hash:fieldHash(s),ledger:s.diagnostics().ledger});s.dispose();
  }assert(results.every(r=>r.hash===results[0].hash));const a=createShorelineCPU({resolution:24,terrainHeight:actualTerrain,maxTicksPerAdvance:1}),b=createShorelineCPU({resolution:24,terrainHeight:actualTerrain,maxTicksPerAdvance:120});const first=a.advanceFence(.2);assert(!first.completed&&first.steps===1);advance(a,.2);advance(b,.2);assert.equal(fieldHash(a),fieldHash(b));return results;
});
await check('actual-CFL failure keeps committed C requested target and retry counters honest',()=>{
  const n=16,h=Array(n*n).fill(1),qx=Array(n*n).fill(100),qz=Array(n*n).fill(100),s=createShorelineCPU({resolution:n,size:[4,4],terrainHeight:()=>-1,boundary:'closed',substepsPerTick:1,initialState:{h,qx,qz}}),before=s.snapshot();
  assert.throws(()=>s.advanceFence(.1),/CFL/);const after=s.snapshot();after.requestedTime=before.requestedTime;assert.deepEqual(after,before);assert.deepEqual(s.diagnostics().lastFailure,{requestedTime:.1,committedTime:0,failedCommitEndTime:1/60,completedTicks:0,message:'Shoreline step exceeds actual two-dimensional CFL; reduce the allocated microstep'});const failure=s.diagnostics();assert.throws(()=>s.advanceFence(NaN));assert.deepEqual(s.diagnostics(),failure);assert.throws(()=>s.advanceFence(.1),/CFL/);assert.equal(s.diagnostics().revision,0);return{failedTime:1/60,publicTime:0,requestedTime:.1};
});
await check('a verifier-injected second-commit failure retains the successful prefix and retries without corruption',async()=>{
  const token='__r13ShoreVerifierReject',needle='const old=committed;committed=input;const i=buffers.indexOf(input);';
  const source=read('shoreline-dynamics.js').replace("from './shoreline-boundary.js'",`from '${new URL('shoreline-boundary.js',root).href}'`);
  assert.equal(source.split(needle).length,2);
  const instrumented=source.replace(needle,`if(globalThis.${token}&&tick===1)throw new Error('verifier second commit');${needle}`),module=await import('data:text/javascript;base64,'+Buffer.from(instrumented).toString('base64'));
  const config={resolution:24,terrainHeight:actualTerrain,boundaryRampSeconds:1,maxTicksPerAdvance:120},s=module.createShorelineCPU(config),control=createShorelineCPU(config);
  try{globalThis[token]=true;assert.throws(()=>s.advanceFence(.05),/verifier second commit/);advance(control,1/60);assert.equal(fieldHash(s),fieldHash(control));const d=s.diagnostics();assert.equal(d.revision,1);assert.equal(d.lastFailure.completedTicks,1);assert.equal(d.lastFailure.failedCommitEndTime,2/60);assert.equal(d.requestedTime,.05);assert.equal(d.busy,false);
    globalThis[token]=false;advance(s,.05);advance(control,.05);assert.equal(fieldHash(s),fieldHash(control));assert.equal(s.diagnostics().lastFailure,null);return{failureAfterTicks:1,retryFinalTicks:s.diagnostics().tick,allPhysicalFieldsIdentical:true,instrumentation:'verification-only source copy, before publication'};
  }finally{delete globalThis[token];s.dispose();control.dispose();}
});
await check('wet-contact memory has declared growth and dry decay without changing mass',()=>{
  const n=8,count=n*n,h=Array(count).fill(.01),qx=Array(count).fill(0),qz=Array(count).fill(0),wetness=Array(count).fill(.25),base={terrainHeight:()=>0,grid:{resolution:n,center:[0,0],size:[8,8]},boundary:'closed',manning:0,wettingRate:8,dryingSeconds:35},wet=shorelineStep({...base,physicalState:{h,qx,qz,wetness},dt:.01}),dry=shorelineStep({...base,physicalState:{h:Array(count).fill(0),qx,qz,wetness},dt:.01});
  near(wet.wetness[0],1-.75*Math.exp(-.08));near(dry.wetness[0],.25*Math.exp(-.01/35));assert(wet.h.every(x=>x===.01)&&dry.h.every(x=>x===0));return{wetAfter10ms:wet.wetness[0],dryAfter10ms:dry.wetness[0],massChanged:false};
});
await check('small plane wave packet moves at shallow-water speed with grid refinement',()=>{
  const results=[];for(const n of [32,64,96]){
    const size=[24,24],h=[],qx=[],qz=[],depth=1,c=Math.sqrt(9.81);for(let j=0;j<n;j++)for(let i=0;i<n;i++){const x=(i+.5)*24/n-12,eta=.002*Math.exp(-(((x+4)/1.4)**2));h.push(depth+eta);qx.push(c*eta);qz.push(0);}
    const centroid=p=>{let mass=0,moment=0;for(let j=0;j<n;j++)for(let i=0;i<n;i++){const eta=p.h[j*n+i]-depth;mass+=eta;moment+=eta*((i+.5)*24/n-12);}return moment/mass;};
    const s=createShorelineCPU({resolution:n,center:[0,0],size,terrainHeight:()=>-depth,boundary:'closed',manning:0,initialState:{h,qx,qz},maxTicksPerAdvance:120}),x0=centroid(s.snapshot());advance(s,1);const speed=centroid(s.snapshot())-x0;assert(Math.abs(speed/c-1)<.025);results.push({n,dx:24/n,measuredSpeed:speed,expectedSpeed:c,relativeSpeedError:speed/c-1});s.dispose();
  }return results;
});
await check('the same packet at quarter depth has half celerity and zero native swell injects no forcing',()=>{
  const speeds=[];for(const depth of[.25,1]){const n=48,size=[24,24],h=[],qx=[],qz=[],expected=Math.sqrt(9.81*depth);for(let j=0;j<n;j++)for(let i=0;i<n;i++){const x=(i+.5)*24/n-12,eta=.0005*Math.exp(-(((x+4)/1.4)**2));h.push(depth+eta);qx.push(expected*eta);qz.push(0);}
    const centroid=p=>{let mass=0,moment=0;for(let j=0;j<n;j++)for(let i=0;i<n;i++){const eta=p.h[j*n+i]-depth;mass+=eta;moment+=eta*((i+.5)*24/n-12);}return moment/mass;},s=createShorelineCPU({resolution:n,center:[0,0],size,terrainHeight:()=>-depth,boundary:'closed',manning:0,initialState:{h,qx,qz},maxTicksPerAdvance:120}),origin=centroid(s.snapshot());advance(s,1);const measured=centroid(s.snapshot())-origin;assert(Math.abs(measured/expected-1)<.005);speeds.push({depth,measured,expected});s.dispose();
  }assert(Math.abs(speeds[1].measured/speeds[0].measured-2)<.01);const zero=createShorelineBoundary({swellHeight:0,rampSeconds:0});assert.deepEqual(zero.sample(-46,-1,1,4000),{eta:0,u:0,v:0});return{speeds,ratio:speeds[1].measured/speeds[0].measured,zeroSwellNoForcing:true};
});
await check('actualROI192/256/384 options allocate bounded three-state grids with stable origin and no old-host import',()=>{
  const results=[];for(const n of SHORELINE_LIMITS.qualityResolutions){const s=createShorelineCPU({resolution:n,terrainHeight:actualTerrain});const d=s.diagnostics();assert.equal(d.publicCells,n*n);assert.equal(d.maximumPrivateStateCells,3*n*n);assert(d.substepsPerTick<=256);assert(d.microStepSeconds>0);results.push({n,microSteps:d.substepsPerTick,microDt:d.microStepSeconds,volume:d.ledger.volume});s.dispose();}
  assert(!read('main.js').includes("from './shoreline-dynamics.js'"));assert(!read('hydrodynamics.js').includes('shoreline-dynamics'));return results;
});
await check('new default terrain ROI evolves finite under the same64-mode source',()=>{
  const s=createShorelineCPU({resolution:32,terrainHeight:actualTerrain,maxTicksPerAdvance:120,boundaryRampSeconds:1});for(let t=.5;t<=6;t+=.5)advance(s,t);const p=s.snapshot(),d=s.diagnostics();assert(p.h.every(v=>v>=0&&Number.isFinite(v)));near(d.ledger.residual,0,1e-10);assert(d.state.maxCFL<=.4*(1+1e-10));return{time:p.time,volume:d.ledger.volume,maximumCfl:d.state.maxCFL,maximumVelocity:d.state.maxSpeed};
});
await check('production incumbent files remain byte-identical and accepted audio is unchanged',()=>{for(const p of protectedPaths)assert.equal(hash(read(p)),protectedHashes[p]);assert.equal(protectedHashes['fireworks-audio.js'],'4e5ede41813249f062e50b212553e5e1821c27feaead8416b68ab51ba1b8ec31');return protectedHashes;});
const report={schema:'glass-atoll.r13-shore-cpu-check.v1',dateUTC:new Date().toISOString(),actualGPU:false,defaultHostImported:false,counts:{passed:checks.filter(c=>c.passed).length,total:checks.length},passed:checks.every(c=>c.passed),checks,
  sourceSHA256:{state:hash(read('shoreline-dynamics.js')),boundary:hash(read('shoreline-boundary.js'))},incumbentSHA256:protectedHashes,
  limits:['CPU numerical gates only; WebGL2 shaders and renderer-state preservation are not yet executed.','192/256/384 grids are allocated here, not run as full-cost CPU/GPU surfing benchmarks.','Separate r13-shore-runup-check provides a bounded coarse2D wet-front fixture; final full-quality convergence remains open.','No water/foam/sand/caustic runtime handoff or scene visual acceptance.']};
fs.writeFileSync(new URL('r13-shore-cpu-check.json',import.meta.url),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report,null,2));if(!report.passed)process.exitCode=1;
