import assert from 'node:assert/strict';
import fs from 'node:fs';
import crypto from 'node:crypto';
import {performance} from 'node:perf_hooks';
import {createPyroSmokeState} from '../pyro-smoke-state.js';
import {createPyroSmokeColumns} from '../pyro-smoke-columns.js';

const checks=[],test=(name,fn)=>{try{checks.push({name,passed:true,detail:fn()??null});}catch(error){checks.push({name,passed:false,error:String(error.stack)});}};
function near(a,b,{absolute=1e-12,relative=2e-11}={}){const error=Math.abs(a-b),limit=absolute+relative*Math.max(Math.abs(a),Math.abs(b));assert(Number.isFinite(a)&&Number.isFinite(b)&&error<=limit,JSON.stringify({a,b,error,limit}));return error;}
const rgbNear=(a,b,tol)=>Math.max(...a.map((v,c)=>near(v,b[c],tol)));
const clone=value=>structuredClone(value),diag=(a,b=a,c=a)=>[a,0,0,0,b,0,0,0,c];
const profile=[{id:'reference',extinctionPerMassRGB:[1,1,1]}];
const snapshot=(packets,profiles=profile)=>({schema:'glass-atoll.pyro-smoke-state.v1',time:0,revision:1,packets,profiles});
const packet=(id,mean=[0,0,0],covariance=diag(1),mass=1,profileId='reference')=>({id,mean,covariance,mass,profileId});
const ray=(origin,direction,end,start=0)=>({origin,direction,end,start});
const unit=v=>{const n=Math.hypot(...v);return v.map(x=>x/n);};
let seed=0x57a91ef;const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};

// Independent adjugate inverse/determinant oracle. Production uses Cholesky
// whitening instead. Moderate condition numbers here keep inverse numerics sound.
function inverse(c){
  const [a,b,d,e,f,g,h,i,j]=c,det=a*(f*j-g*i)-b*(e*j-g*h)+d*(e*i-f*h);
  assert(det>0);return{det,Q:[f*j-g*i,d*i-b*j,b*g-d*f,g*h-e*j,a*j-d*h,d*e-a*g,e*i-f*h,b*h-a*i,a*f-b*e].map(v=>v/det)};
}
const quadratic=(v,Q)=>v[0]*(Q[0]*v[0]+Q[1]*v[1]+Q[2]*v[2])+v[1]*(Q[3]*v[0]+Q[4]*v[1]+Q[5]*v[2])+v[2]*(Q[6]*v[0]+Q[7]*v[1]+Q[8]*v[2]);
function numericDensityOracle(s,r,steps=32768){
  const profiles=new Map(s.profiles.map(p=>[p.id,p.extinctionPerMassRGB])),ps=s.packets.map(p=>{const {Q,det}=inverse(p.covariance);return{...p,Q,norm:p.mass/((2*Math.PI)**1.5*Math.sqrt(det)),beta:profiles.get(p.profileId)};});
  const result=[0,0,0],h=(r.end-r.start)/steps;
  for(let n=0;n<=steps;n++){
    const t=r.start+n*h,x=r.origin.map((v,c)=>v+r.direction[c]*t),weight=n===0||n===steps?1:n%2?4:2;
    for(const p of ps){const delta=x.map((v,c)=>v-p.mean[c]),rho=p.norm*Math.exp(-.5*quadratic(delta,p.Q));for(let c=0;c<3;c++)result[c]+=weight*rho*p.beta[c];}
  }
  return result.map(v=>v*h/3);
}
function rotatedCovariance(variances,axis,angle){
  const [x,y,z]=unit(axis),c=Math.cos(angle),s=Math.sin(angle),t=1-c;
  const R=[t*x*x+c,t*x*y-s*z,t*x*z+s*y,t*x*y+s*z,t*y*y+c,t*y*z-s*x,t*x*z-s*y,t*y*z+s*x,t*z*z+c];
  return Array.from({length:9},(_,n)=>{const i=n/3|0,j=n%3;let sum=0;for(let k=0;k<3;k++)sum+=R[i*3+k]*variances[k]*R[j*3+k];return sum;});
}
function stateFrom(s){const state=createPyroSmokeState({profiles:Object.fromEntries(s.profiles.map(p=>[p.id,{extinctionPerMassRGB:p.extinctionPerMassRGB}]))});s.packets.forEach((p,i)=>state.queueEmission({time:0,emissionId:i,sourceId:'qa',profileId:p.profileId,mass:p.mass,mean:p.mean,covariance:p.covariance}));return state;}
function stateASBound(s,r){
  const profiles=new Map(s.profiles.map(p=>[p.id,p.extinctionPerMassRGB])),result=[0,0,0];
  for(const p of s.packets){const {Q,det}=inverse(p.covariance),A=quadratic(r.direction,Q),prefactor=p.mass/((2*Math.PI)**1.5*Math.sqrt(det))*Math.sqrt(Math.PI/(2*A));for(let c=0;c<3;c++)result[c]+=prefactor*profiles.get(p.profileId)[c]*3e-7;}
  return result;
}
function assertOmission(exact,approx,budget){
  assert(approx.errorBound<=budget);assert(approx.errorBoundIncludesRoundoff===false);
  for(let c=0;c<3;c++){
    const omitted=exact.tauRGB[c]-approx.tauRGB[c];assert(omitted>=-1e-12&&omitted<=approx.errorBoundRGB[c]+2e-12,JSON.stringify({omitted,bound:approx.errorBoundRGB[c]}));
    assert(exact.T[c]<=approx.T[c]+2e-12&&exact.T[c]>=approx.transmissionLowerRGB[c]-2e-12);
  }
}

test('empty snapshot and zero-length actual endpoint rays give tau0/T1',()=>{
  const b=createPyroSmokeColumns(snapshot([]));assert.deepEqual(b.between([1,2,3],[1,2,3]).tauRGB,[0,0,0]);assert.deepEqual(b.between([1,2,3],[1,2,3]).T,[1,1,1]);
  const c=createPyroSmokeColumns(snapshot([packet(0)])),zero=c.query(ray([0,0,0],[0,0,0],0));assert.deepEqual(zero.T,[1,1,1]);assert.equal(zero.kernelsEvaluated,0);
});
test('isotropic central column matches the independent full-line analytic value',()=>{
  const b=createPyroSmokeColumns(snapshot([packet(0,[0,0,0],diag(4),7)])),value=b.between([-50,0,0],[50,0,0],{errorBudget:0}),expected=7/(2*Math.PI*4);
  rgbNear(value.tauRGB,[expected,expected,expected],{relative:3e-15,absolute:1e-15});return{tau:value.tauRGB,expected};
});
test('RGB profiles sum physical optical depths and preserve zero channels',()=>{
  const s=snapshot([packet(0,[0,0,0],diag(1),1,'red'),packet(1,[0,0,0],diag(1),2,'blue')],[{id:'red',extinctionPerMassRGB:[2,0,0]},{id:'blue',extinctionPerMassRGB:[0,0,3]}]),b=createPyroSmokeColumns(s),v=b.between([-20,0,0],[20,0,0],{errorBudget:0});
  rgbNear(v.tauRGB,[2/(2*Math.PI),0,6/(2*Math.PI)]);assert.equal(v.T[1],1);
});
test('transparent profile skips computation without deleting physical packets',()=>{
  const s=snapshot([packet(0)], [{id:'reference',extinctionPerMassRGB:[0,0,0]}]),before=clone(s),b=createPyroSmokeColumns(s),v=b.between([-5,0,0],[5,0,0]);assert.deepEqual(v.T,[1,1,1]);assert.equal(v.zeroExtinctionPackets,1);assert.equal(b.diagnostics().packetCount,1);assert.deepEqual(s,before);
});
test('full rotated SPD finite columns agree with independent numerical density integration',()=>{
  const ps=Array.from({length:6},(_,i)=>packet(i,[random()*6-3,random()*6-3,random()*6-3],rotatedCovariance([.4+random()*2,.5+random()*3,.6+random()*4],[random(),random(),random()],random()*4),.2+random()));
  const s=snapshot(ps,[{id:'reference',extinctionPerMassRGB:[.3,.7,1.2]}]),b=createPyroSmokeColumns(s),results=[];
  for(let i=0;i<6;i++){
    const direction=unit([random()-.5,random()-.5,random()-.5]),r=ray(direction.map(v=>-12*v),direction,24),actual=b.query({...r,errorBudget:0}),expected=numericDensityOracle(s,r);
    const error=rgbNear(actual.tauRGB,expected,{relative:2e-8,absolute:1e-10});results.push({ray:r,maximumAbsoluteError:error});
  }
  return results;
});
test('finite segment start/end and inside origins agree with density quadrature',()=>{
  const s=snapshot([packet(0,[.2,.3,.4],[2,.5,.1,.5,1,.2,.1,.2,3],2)]),b=createPyroSmokeColumns(s),results=[];
  for(const r of [ray([0,0,0],unit([1,.2,.5]),3),ray([-9,0,0],[1,0,0],12,7),ray([0,0,0],[1,0,0],1,.3)]){
    const actual=b.query({...r,errorBudget:0}),expected=numericDensityOracle(s,r);results.push({maximumError:rgbNear(actual.tauRGB,expected,{relative:2e-9,absolute:1e-11})});
  }
  return results;
});
test('same-sign 6-sigma tails and close endpoints retain positive small columns',()=>{
  const s=snapshot([packet(0)]),b=createPyroSmokeColumns(s),r=ray([0,0,0],[1,0,0],7,6),actual=b.query({...r,errorBudget:0}),expected=numericDensityOracle(s,r);
  rgbNear(actual.tauRGB,expected,{relative:2e-10,absolute:1e-22});assert(actual.tauRGB[0]>0);
  const end=7+1e-8,small=b.query(ray([0,0,0],[1,0,0],end,7)),reference=Math.exp(-.5*((7+end)/2)**2)/(2*Math.PI)**1.5*(end-7),exact=b.query({...ray([0,0,0],[1,0,0],end,7),errorBudget:0});
  near(exact.tauRGB[0],reference,{relative:2e-8,absolute:1e-28});assert(exact.tauRGB[0]>0);return{tailTau:actual.tauRGB[0],shortTau:exact.tauRGB[0],defaultBudgetMayOmit:small.omittedPackets===1};
});
test('48 random rays match state brute columns within its published AS erf error',()=>{
  const s=snapshot(Array.from({length:24},(_,i)=>packet(i,[random()*30-15,random()*12-6,random()*30-15],rotatedCovariance([.5+random()*6,.5+random()*6,.5+random()*6],[random(),random(),random()],random()*6),random()+.02)),[{id:'reference',extinctionPerMassRGB:[.4,.7,1.1]}]);
  const state=stateFrom(s),b=createPyroSmokeColumns(state.snapshot());let maximumError=0,maximumBoundRatio=0;
  for(let i=0;i<48;i++){
    const origin=[random()*30-15,random()*15-7.5,random()*30-15],direction=unit([random()-.5,random()-.5,random()-.5]),r=ray(origin,direction,20+random()*30),actual=b.query({...r,errorBudget:0}),expected=state.columnOpticalDepth(r),bound=stateASBound(s,r);
    for(let c=0;c<3;c++){const error=Math.abs(actual.tauRGB[c]-expected.opticalDepthRGB[c]);maximumError=Math.max(maximumError,error);maximumBoundRatio=Math.max(maximumBoundRatio,error/(bound[c]+2e-12));assert(error<=bound[c]+2e-12);}
  }
  return{rays:48,maximumAbsoluteError:maximumError,maximumASBoundRatio:maximumBoundRatio,oracleLimit:'state uses ~1.5e-7 absolute erf approximation; endpoint difference bound 3e-7 times per-ray prefactor, not a loosened BVH omission budget'};
});
test('reversed endpoint ray and nonuniform subdivisions preserve the same column',()=>{
  const b=createPyroSmokeColumns(snapshot([packet(0,[1,2,3],[4,.6,.2,.6,2,.3,.2,.3,3],2)])),from=[-10,-2,1],to=[12,7,8],forward=b.between(from,to,{errorBudget:0}),back=b.between(to,from,{errorBudget:0});rgbNear(forward.tauRGB,back.tauRGB);
  const direction=unit(to.map((v,c)=>v-from[c])),length=Math.hypot(...to.map((v,c)=>v-from[c])),split=[0,.2,.7,3,length],sum=[0,0,0];
  for(let i=1;i<split.length;i++){const part=b.query({...ray(from,direction,split[i],split[i-1]),errorBudget:0});for(let c=0;c<3;c++)sum[c]+=part.tauRGB[c];}rgbNear(sum,forward.tauRGB);
});
test('large common translation is stable within binary64 coordinate accuracy',()=>{
  const s=snapshot([packet(0,[.2,.3,.4],[2,.5,.1,.5,1,.2,.1,.2,3],2)]),r=ray([-8,1,0],unit([1,.1,.05]),20),base=createPyroSmokeColumns(s).query({...r,errorBudget:0}),offset=[1e6,-2e6,3e6];
  const shifted=clone(s);shifted.packets[0].mean=shifted.packets[0].mean.map((v,c)=>v+offset[c]);const actual=createPyroSmokeColumns(shifted).query({...r,origin:r.origin.map((v,c)=>v+offset[c]),errorBudget:0});
  return{maximumError:rgbNear(actual.tauRGB,base.tauRGB,{relative:2e-8,absolute:1e-10})};
});
test('missed 5sigma boxes never mean automatic deletion: large-tail puff must be evaluated',()=>{
  const b=createPyroSmokeColumns(snapshot([packet(0,[0,0,0],diag(1),1e6)])),r=ray([-10,5.01,0],[1,0,0],20),actual=b.query(r),exact=b.query({...r,errorBudget:0});assert.equal(actual.kernelsEvaluated,1);assert.equal(actual.omittedPackets,0);assert(actual.tauRGB[0]>.5);rgbNear(actual.tauRGB,exact.tauRGB);return actual;
});
test('node sum over remaining budget descends and leaf never drops remaining smoke',()=>{
  const b=createPyroSmokeColumns(snapshot(Array.from({length:8},(_,i)=>packet(i))),{leafSize:1}),r=ray([-10,5.01,0],[1,0,0],20),approx=b.query(r),exact=b.query({...r,errorBudget:0});
  assertOmission(exact,approx,1e-5);assert(approx.kernelsEvaluated>0&&approx.omittedPackets>0);assert.equal(approx.kernelsEvaluated+approx.omittedPackets,8);return{kernels:approx.kernelsEvaluated,omitted:approx.omittedPackets,errorBound:approx.errorBound,actualError:exact.tauRGB[0]-approx.tauRGB[0]};
});
test('finite segment missing box but supporting line through centre obeys tail bound',()=>{
  const b=createPyroSmokeColumns(snapshot([packet(0)])),r=ray([0,0,0],[1,0,0],7,6),approx=b.query(r),exact=b.query({...r,errorBudget:0});assertOmission(exact,approx,1e-5);assert.equal(approx.omittedPackets,1);assert(exact.tauRGB[0]>0);return{actualTail:exact.tauRGB[0],bound:approx.errorBound};
});
test('256 adversarial rotated/anisotropic missed-ray trials satisfy analytic omitted bounds',()=>{
  let largestRatio=0,totalOmitted=0;
  for(let i=0;i<256;i++){
    const covariance=rotatedCovariance([.05+random(),.5+random()*4,1+random()*20],[random(),random(),random()],random()*6),p=packet(0,[0,0,0],covariance,.01+random()*2),s=snapshot([p],[{id:'reference',extinctionPerMassRGB:[.3,1,.7]}]),b=createPyroSmokeColumns(s),axis=i%3;
    const origin=[random()*8-4,random()*8-4,random()*8-4];origin[axis]=5.001*Math.sqrt(covariance[axis*3+axis]);const direction=[0,0,0];direction[(axis+1)%3]=1;origin[(axis+1)%3]=-20;
    const r=ray(origin,direction,40),exact=b.query({...r,errorBudget:0}),approx=b.query({...r,errorBudget:1});assertOmission(exact,approx,1);totalOmitted+=approx.omittedPackets;
    if(approx.errorBound>0)largestRatio=Math.max(largestRatio,...exact.tauRGB.map(v=>v/approx.errorBound));
  }
  return{trials:256,totalOmitted,maximumActualToBoundRatio:largestRatio};
});
test('budget0 evaluates every nontransparent packet, even when arbitrarily far',()=>{
  const b=createPyroSmokeColumns(snapshot(Array.from({length:32},(_,i)=>packet(i,[i*40,0,0])))),v=b.query({...ray([0,100,0],[1,0,0],1500),errorBudget:0});assert.equal(v.kernelsEvaluated,32);assert.equal(v.omittedPackets,0);assert.equal(v.errorBound,0);
});
test('source snapshot/profiles stay immutable and invalid update is atomic',()=>{
  const s=snapshot([packet(0)]),before=clone(s),b=createPyroSmokeColumns(s),r=ray([-8,0,0],[1,0,0],16),original=b.query({...r,errorBudget:0});assert.deepEqual(s,before);
  s.packets[0].mean[0]=999;s.packets[0].mass=0;s.profiles[0].extinctionPerMassRGB[0]=99;rgbNear(b.query({...r,errorBudget:0}).tauRGB,original.tauRGB);
  assert.throws(()=>b.update(s));assert.equal(b.diagnostics().packetCount,1);rgbNear(b.query({...r,errorBudget:0}).tauRGB,original.tauRGB);
});
test('fresh snapshot update changes the query without old-state retention or stale revision use',()=>{
  const b=createPyroSmokeColumns(snapshot([packet(0)])),r=ray([-8,0,0],[1,0,0],16),a=b.query({...r,errorBudget:0}),next=snapshot([packet(0,[0,4,0])]);b.update(next);const changed=b.query({...r,errorBudget:0});assert(changed.tauRGB[0]<a.tauRGB[0]/100);b.update(snapshot([]));assert.equal(b.diagnostics().packetCount,0);assert.deepEqual(b.query(r).T,[1,1,1]);
});
test('invalid nonfinite/negative/profile/SPD/ray inputs fail instead of clipping data',()=>{
  const b=createPyroSmokeColumns(snapshot([packet(0)]));let count=0;
  const bad=[()=>b.query(ray([0,0,0],[2,0,0],5)),()=>b.query(ray([0,0,0],[0,0,0],1)),()=>b.query(ray([0,0,0],[1,0,0],-1)),()=>b.query(ray([0,0,0],[1,0,0],2,3)),()=>b.query({...ray([0,0,0],[1,0,0],5),errorBudget:-1}),()=>b.query(ray([NaN,0,0],[1,0,0],5)),()=>b.between([0,0,0],[1,0,0],{direction:[0,1,0]}),()=>createPyroSmokeColumns(snapshot([packet(0,[0,0,0],diag(1),-1)])),()=>createPyroSmokeColumns(snapshot([packet(0,[0,0,0],[1,1,0,1,1,0,0,0,1])])),()=>createPyroSmokeColumns(snapshot([packet(0)],[{id:'reference',extinctionPerMassRGB:[1,-1,1]}])),()=>createPyroSmokeColumns(snapshot([packet(0)],[{id:'other',extinctionPerMassRGB:[1,1,1]}]))];
  for(const fn of bad){assert.throws(fn);count++;}return{invalidCases:count};
});
test('diagnostics record rays/nodes/kernels/cost without entering physics or renderer state',()=>{
  const b=createPyroSmokeColumns(snapshot([packet(0)]));b.between([-10,0,0],[10,0,0]);b.between([0,0,0],[0,0,0]);const d=b.diagnostics();assert.equal(d.rays,2);assert.equal(d.zeroLengthRays,1);assert(d.kernelsEvaluated>0&&d.visitedNodes>0&&d.totalQueryMs>=0);assert(d.mediumDomain.includes('unbounded'));b.resetDiagnostics();assert.equal(b.diagnostics().rays,0);assert.equal(b.diagnostics().packetCount,1);
  const source=fs.readFileSync(new URL('../pyro-smoke-columns.js',import.meta.url),'utf8');for(const forbidden of ['document.','window.','Math.random','renderer.','uSceneScale','halfspaceClamp'])assert(!source.includes(forbidden));
});

let pressure=null;
test('4096-packet CPU pressure: bounded omission agrees with exact columns and retains every packet',()=>{
  const s=snapshot(Array.from({length:4096},(_,i)=>packet(i,[random()*360-180,random()*120+5,random()*360-180],rotatedCovariance([1+random()*5,1+random()*4,1+random()*6],[random(),random(),random()],random()*6),.001+random()*.002)),[{id:'reference',extinctionPerMassRGB:[.4,.7,1]}]);
  const state=stateFrom(s),committed=state.snapshot(),start=performance.now(),b=createPyroSmokeColumns(committed),buildMs=performance.now()-start;
  const rays=Array.from({length:64},(_,i)=>{const from=i%2?[random()*150-75,random()*80+20,random()*150-75]:[-220,random()*100+10,random()*300-150],to=i%2?[30,2,65]:[220,random()*100+10,random()*300-150],delta=to.map((v,c)=>v-from[c]);return ray(from,unit(delta),Math.hypot(...delta));});
  for(let i=0;i<8;i++)b.query(rays[i]);const accelerated=[],brute=[],kernelCounts=[],nodeCounts=[];let maximumDifference=0,maximumOmittedBound=0,maximumStateBoundRatio=0;
  for(const r of rays){
    const t0=performance.now(),approx=b.query(r);accelerated.push(performance.now()-t0);kernelCounts.push(approx.kernelsEvaluated);nodeCounts.push(approx.visitedNodes);
    const t1=performance.now(),reference=state.columnOpticalDepth(r);brute.push(performance.now()-t1);
    const exact=b.query({...r,errorBudget:0});assertOmission(exact,approx,1e-5);
    const AS=stateASBound(s,r);
    for(let c=0;c<3;c++){const difference=Math.abs(reference.opticalDepthRGB[c]-approx.tauRGB[c]),bound=approx.errorBoundRGB[c]+AS[c]+1e-12;assert(difference<=bound);maximumStateBoundRatio=Math.max(maximumStateBoundRatio,difference/bound);maximumDifference=Math.max(maximumDifference,difference);}
    maximumOmittedBound=Math.max(maximumOmittedBound,approx.errorBound);
  }
  const summary=values=>{const a=[...values].sort((x,y)=>x-y);return{count:a.length,meanMs:values.reduce((a,b)=>a+b,0)/a.length,medianMs:(a[31]+a[32])/2,p95Ms:a[Math.ceil(.95*a.length)-1],maximumMs:a.at(-1),minimumMs:a[0]};};
  pressure={packetCount:4096,rays:64,buildMs,acceleratedCPU:summary(accelerated),stateBruteCPU:summary(brute),kernels:{mean:kernelCounts.reduce((a,b)=>a+b,0)/64,maximum:Math.max(...kernelCounts)},visitedNodes:{mean:nodeCounts.reduce((a,b)=>a+b,0)/64,maximum:Math.max(...nodeCounts)},maximumStateAbsoluteDifference:maximumDifference,maximumOmittedBound,maximumStateBoundRatio,retainedPacketCount:b.diagnostics().packetCount,scope:'Node CPU execution including allocations/GC; same snapshot/rays, default controlled omission versus state AS brute oracle. Not scene FPS, GPU cost or exact-zero approximation.'};
  assert.equal(b.diagnostics().packetCount,4096);assert.deepEqual(state.snapshot(),committed);return pressure;
});

const sha=file=>crypto.createHash('sha256').update(fs.readFileSync(new URL(file,import.meta.url))).digest('hex');
const report={date:new Date().toISOString(),sourceSHA256:sha('../pyro-smoke-columns.js'),stateSourceSHA256:sha('../pyro-smoke-state.js'),passed:checks.every(c=>c.passed),passedCount:checks.filter(c=>c.passed).length,total:checks.length,runtimeIntegrated:false,pressure,limits:['CPU source-path query only; not per-fragment 4096-packet rendering.','Unbounded Gaussians. No halfspace, deposition, ground absorption or shoreline boundary policy.','Analytic omission bound excludes binary64 kernel rounding; independent numerical integration/state-AS comparison test the latter separately.','Source/centre/tail anchor choices remain a host approximation, not exact extended-source integration.','Relative reference mass and authored extinction, not calibrated kg/PM or measured pyrotechnic photometry.'],checks};
fs.writeFileSync(new URL('pyro-smoke-columns-check.json',import.meta.url),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({passed:report.passed,passedCount:report.passedCount,total:report.total,sourceSHA256:report.sourceSHA256,pressure,failed:checks.filter(c=>!c.passed)},null,2));if(!report.passed)process.exitCode=1;
