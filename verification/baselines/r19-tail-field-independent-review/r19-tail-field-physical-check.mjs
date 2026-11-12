// Independent CPU tests of the actual frozen tail-field implementation.
// Position oracle integrates held wind sequentially, without sampleBody or
// windResponse; finite differences independently verify Eulerian derivatives.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import crypto from 'node:crypto';
import * as THREE from '../vendor/three.module.js';
const base=new URL('./baselines/r19-tail-field-independent-review/',import.meta.url),root=new URL('../',import.meta.url);
const field=await import(new URL('firework-tail-field.js',base)),physics=await import(new URL('fireworks-physics.js',base)),exposure=await import(new URL('firework-exposure-window.js',base));
const windModule=await import(new URL('wind-response.js',base));
const source=fs.readFileSync(new URL('firework-tail-field.js',base),'utf8'),fwSource=fs.readFileSync(new URL('fireworks.js',base),'utf8'),checks=[],started=new Date().toISOString();
const hash=s=>crypto.createHash('sha256').update(s).digest('hex'),uri=s=>'data:text/javascript;base64,'+Buffer.from(s).toString('base64');
function check(name,fn){try{checks.push({name,passed:true,details:fn()??null});}catch(error){checks.push({name,passed:false,error:String(error.stack)});}}
function close(a,b,t=1e-8){assert.ok(Math.abs(a-b)<=t,`${a} != ${b}; error ${Math.abs(a-b)}`);}
function vector(a,b,t=1e-8){a.forEach((v,c)=>close(v,b[c],t));}
const held=[{time:-Infinity,wind:[3,.1,-2]}],changing=[{time:-Infinity,wind:[0,0,0]},{time:2.4,wind:[3,.4,-1]},{time:3.2,wind:[-2,-.2,4]},{time:4.9,wind:[1,0,-3]}];
function windAt(timeline,time){let out=timeline[0]?.wind??[0,0,0];for(const s of timeline){if(s.time>time)break;out=s.wind;}return out;}
function segment(position,velocity,seconds,k,wind,g){
  // Integrate dv/dt=k(W-v)-gY in local coordinates. Keep an independent
  // sequential timeline walk instead of the production affine prefix cache.
  const p=[...position],v=[...velocity];if(k<1e-8){for(let c=0;c<3;c++){const a=c===1?-g:0;p[c]+=v[c]*seconds+.5*a*seconds*seconds;v[c]+=a*seconds;}return{position:p,velocity:v};}
  const E=Math.exp(-k*seconds),T=-Math.expm1(-k*seconds)/k;
  for(let c=0;c<3;c++){const terminal=wind[c]-(c===1?g/k:0),offset=v[c]-terminal;p[c]+=terminal*seconds+offset*T;v[c]=terminal+offset*E;}return{position:p,velocity:v};
}
function physical(body,time,timeline){if(time<body.birth)return null;const parent=body.parentBody?physical(body.parentBody,body.birth,timeline):null;let state={position:[...(parent?.position??body.position)],velocity:parent?parent.velocity.map((v,c)=>v+body.velocityDelta[c]):[...body.velocity]},at=body.birth;
  const cuts=timeline.map(s=>s.time).filter(t=>t>at&&t<time);cuts.push(time);
  for(const end of cuts){state=segment(state.position,state.velocity,end-at,body.drag??.2,windAt(timeline,at),body.gravity??9.81);at=end;}return state;
}
function q(body,time,lag,timeline){const release=Math.max(body.birth,time-lag),s=physical(body,release,timeline);return physical({birth:release,position:s.position,velocity:s.velocity.map(v=>v*.25),drag:1.35,gravity:9.81},time,timeline);}
const core={birth:2,position:[1,100,-3],velocity:[20,5,-3],drag:.4,gravity:9.81},child={birth:3.1,parentBody:core,velocityDelta:[2,3,-1],drag:.7,gravity:9.81};
check('Factory validates lag/identity and creates immutable finite coefficients',()=>{
  for(const lag of [-.001,.881,NaN,Infinity])assert.throws(()=>field.createTailReleaseFieldNode(core,lag),RangeError);
  const n=field.createTailReleaseFieldNode(core,.25);assert.ok(Object.isFrozen(n));assert.equal(n.body,core);assert.equal(n.birth,2.25);assert.equal(n.decay,Math.exp(-1.35*.25));assert.equal(n.travel,-Math.expm1(-1.35*.25)/1.35);
  assert.throws(()=>field.sampleTailReleaseFieldNode({...n},3,held),TypeError);assert.throws(()=>field.sampleTailReleaseFieldNode(n,NaN,held),RangeError);assert.throws(()=>field.sampleTailReleaseFieldNode(n,3,null),TypeError);assert.equal(field.sampleTailReleaseFieldNode(n,2.249,held),null);
});
check('Actual q equals independent sequential ODE; dq matches five-point differences away from wind knots',()=>{
  let cases=0,maxPositionError=0,maxDerivativeError=0,minEmberVelocityDifference=Infinity;
  for(const body of [core,{...core,drag:0},{...core,drag:1e-9},{...core,drag:1.5},{...core,gravity:0},child])for(const timeline of [held,changing,[]])for(const lag of [0,.00625,.1,.31,.88])for(const time of [4.2,6.3]){
    const n=field.createTailReleaseFieldNode(body,lag),actual=field.sampleTailReleaseFieldNode(n,time,timeline),expected=q(body,time,lag,timeline),h=2e-4;
    const p=[-2,-1,1,2].map(offset=>q(body,time+offset*h,lag,timeline).position);
    for(let c=0;c<3;c++){const fd=(p[0][c]-8*p[1][c]+8*p[2][c]-p[3][c])/(12*h);maxPositionError=Math.max(maxPositionError,Math.abs(actual.position[c]-expected.position[c]));maxDerivativeError=Math.max(maxDerivativeError,Math.abs(actual.velocity[c]-fd));close(actual.position[c],expected.position[c],3e-9);close(actual.velocity[c],fd,2e-6);}
    if(lag>.01)minEmberVelocityDifference=Math.min(minEmberVelocityDifference,Math.hypot(...actual.velocity.map((v,c)=>v-expected.velocity[c])));assert.ok(actual.releaseTime<=time);cases++;
  }return{cases,maxPositionError,maxDerivativeError,minEmberVelocityDifference,oracle:'Sequential piecewise-held ODE positions, independent 5-point derivative; does not call sampleBody/windResponse.'};
});
check('Release wind knot uses right-hand derivative, including duplicate knots',()=>{
  const timeline=[{time:-Infinity,wind:[0,0,0]},{time:3,wind:[9,.4,-1]},{time:3,wind:[3,.2,4]}],body={...core},lag=.25,time=3.25,h=1e-4,n=field.createTailReleaseFieldNode(body,lag),actual=field.sampleTailReleaseFieldNode(n,time,timeline),p0=q(body,time,lag,timeline).position,pm=q(body,time-h,lag,timeline).position,pp=q(body,time+h,lag,timeline).position,p2=q(body,time+2*h,lag,timeline).position;
  const left=pm.map((v,c)=>(p0[c]-v)/h),right=p0.map((v,c)=>(-3*v+4*pp[c]-p2[c])/(2*h));vector(actual.velocity,right,2e-6);assert.ok(Math.hypot(...left.map((v,c)=>v-right[c]))>.1);return{leftApprox:left,rightApprox:right,actual:actual.velocity};
});
check('A knot at observation time keeps q derivative continuous; release and observation wind are not interchanged',()=>{
  const timeline=[{time:-Infinity,wind:[-1,.1,2]},{time:3,wind:[12,-2,-8]}],lag=.25,time=3,h=1e-4,n=field.createTailReleaseFieldNode(core,lag),a=field.sampleTailReleaseFieldNode(n,time,timeline),p=[-2,-1,1,2].map(i=>q(core,time+i*h,lag,timeline).position),fd=p[0].map((v,c)=>(v-8*p[1][c]+8*p[2][c]-p[3][c])/(12*h));vector(a.velocity,fd,.002);return{maximumDerivativeError:Math.max(...a.velocity.map((v,c)=>Math.abs(v-fd[c]))),scope:'q is C1 at upper convolution endpoint, C2 can jump; central finite-difference error near knot is explicitly bounded here.'};
});
check('Changing source/root parent poses are read live, while static lag coefficients stay unchanged',()=>{
  const parent={...core,position:[...core.position],velocity:[...core.velocity]},body={...child,parentBody:parent},n=field.createTailReleaseFieldNode(body,.25),before=field.sampleTailReleaseFieldNode(n,5,changing),E=n.decay,T=n.travel;
  parent.position[0]+=4;parent.velocity[2]-=3;body.velocityDelta[1]+=.7;const after=field.sampleTailReleaseFieldNode(n,5,changing);assert.notDeepEqual(after.position,before.position);vector(after.position,q(body,5,.25,changing).position,1e-9);assert.equal(n.decay,E);assert.equal(n.travel,T);
});
check('Causal exposure anchor queries only past/current field states; prebirth raster anchor is explicitly virtual',()=>{
  let samples=0,virtual=0;for(const lag of [.00625,.1,.31])for(const S of [0,1/120,.25,1])for(const since of [0,.002,.5]){
    const n=field.createTailReleaseFieldNode(core,lag),physicalNow=n.birth+since,calls=[],a=exposure.sampleCausalOpticalAnchor({birth:n.birth,physicalNow,shutterSeconds:S,sampleAt:t=>{calls.push(t);assert.ok(t>=n.birth&&t<=physicalNow);const value=field.sampleTailReleaseFieldNode(n,t,changing);assert.ok(value.releaseTime>=core.birth&&value.releaseTime<=t);return value;}});assert.ok(a);assert.equal(calls.length,1);if(a.virtualBirthAnchor){virtual++;assert.equal(calls[0],n.birth);}samples++;
  }const n=field.createTailReleaseFieldNode(core,.1);assert.equal(exposure.sampleCausalOpticalAnchor({birth:n.birth,physicalNow:n.birth-.001,shutterSeconds:1,sampleAt:()=>{throw new Error('future queried');}}),null);return{samples,virtualBirthAnchors:virtual};
});
check('Production node sampler makes only release and observation sampleBody calls; no future source query',()=>{
  const instrumented=source.replace("import {sampleBody} from './fireworks-physics.js';",`import {sampleBody as rawSampleBody} from '${new URL('fireworks-physics.js',base).href}';\nexport const traced=[];const sampleBody=(body,time,timeline)=>{traced.push({body,time});return rawSampleBody(body,time,timeline);};`);
  assert.notEqual(instrumented,source);return{instrumentedSource:uri(instrumented)};
});
// Execute the tracing case separately so its promise never enters a sync memo.
{
  const instrumented=source.replace("import {sampleBody} from './fireworks-physics.js';",`import {sampleBody as rawSampleBody} from '${new URL('fireworks-physics.js',base).href}';\nexport const traced=[];const sampleBody=(body,time,timeline)=>{traced.push({body,time});return rawSampleBody(body,time,timeline);};`),m=await import(uri(instrumented));
  check('Actual traced sampler uses exactly causal source release plus actual aged ember query',()=>{
    const node=m.createTailReleaseFieldNode(core,.1),time=4;m.sampleTailReleaseFieldNode(node,time,changing);assert.equal(m.traced.length,2);assert.equal(m.traced[0].body,core);assert.equal(m.traced[0].time,time-.1);assert.equal(m.traced[1].time,time);assert.equal(m.traced[1].body.birth,time-.1);assert.ok(m.traced.every(x=>x.time<=time));return{queries:m.traced.map(x=>x.time)};
  });
}
check('Long finite clocks preserve finite states; expose requested lag versus represented age rounding',()=>{
  const errors=[];for(const epoch of [0,30000,172800,1e9]){const body={...core,birth:epoch+2,position:[...core.position],velocity:[...core.velocity]},timeline=[{time:-Infinity,wind:[2,.1,-3]}],lag=.00625,time=epoch+4.2,n=field.createTailReleaseFieldNode(body,lag),a=field.sampleTailReleaseFieldNode(n,time,timeline);assert.ok([...a.position,...a.velocity].every(Number.isFinite));vector(a.position,q(body,time,lag,timeline).position,1e-9);errors.push({epoch,requestedLag:lag,representedAge:time-a.releaseTime,ageRounding:time-a.releaseTime-lag});}return{errors,scope:'Finite values and actual represented ember age, not arbitrary-epoch exact differential guarantees.'};
});
function imports(s){return s.replace(/\r\n/g,'\n').replace(/from (['"])(\.\/[^'"]+)\1/g,(_,q,p)=>`from '${new URL(p.slice(2),base).href}'`);}
function replaceOnce(s,a,b){assert.equal(s.split(a).length,2,a.slice(0,50));return s.replace(a,b);}
async function factory(scope=true){let text=imports(fwSource);if(!scope){text=replaceOnce(text,'getRadianceBound({camera,optics={},rawPerCandela=3.6e-5,onSourceBound=null}={}){return withWindResponseMemo(simulation.windTimeline,()=>{','getRadianceBound({camera,optics={},rawPerCandela=3.6e-5,onSourceBound=null}={}){');text=replaceOnce(text,'    });},\n    render({renderer,target,camera,','    },\n    render({renderer,target,camera,');}text=replaceOnce(text,'api.configure({});return api;','api.configure({});api.__qa={records:()=>records,active:()=>simulation.active,view:(p,S)=>opticalViewRecord(p,S),node:(b,l)=>tailFieldNode(b,l),nodeCacheSize:b=>tailFieldNodes.get(b)?.size??0,anchorCacheSize:b=>opticalAnchorCache.get(b)?.values.size??0,viewCacheSize:p=>opticalViewCache.get(p)?.size??0};return api;');return(await import(uri(text))).createFireworks;}
const createScoped=await factory(),createPlainBound=await factory(false);
function make(create){const f=create(THREE,{sourceVisibility:'none'});f.configure({type:'chrysanthemum',effectProfile:'two-colour-v1',autoDirection:false,launchSpreadDegrees:0,burstTiltDegrees:0,burstRollDegrees:0});const launch=f.launch({seed:42});return{f,launch};}
check('Actual factory bound scoped/ordinary bulk is exactly equal; no await/GL and trace throws clean the scope',()=>{
  const a=make(createScoped),b=make(createPlainBound);try{const time=a.launch.burstTime+.7;for(const x of [a,b])x.f.update({time,windVector:[2,0,.7]});const camera=new THREE.PerspectiveCamera(55,1.5,.1,30000);camera.position.set(180,90,500);camera.lookAt(60,150,0);camera.updateMatrixWorld();for(const S of [0,1/120,.25]){const A=[],B=[],opts={camera,optics:{width:1200,height:800,shutterSeconds:S}};assert.deepEqual(a.f.getRadianceBound({...opts,onSourceBound:r=>A.push(r)}),b.f.getRadianceBound({...opts,onSourceBound:r=>B.push(r)}));assert.deepEqual(A,B);}assert.throws(()=>a.f.getRadianceBound({camera,onSourceBound:()=>{throw new Error('trace interrupted');}}),/trace interrupted/);const wind=awaitlessWind();assert.equal(Object.isFrozen(wind),false);return{shutters:3,sourceTracesExact:true};}finally{a.f.dispose();b.f.dispose();}
});
// Import the exact snapshot wind module used by frozen physics/factory.
function awaitlessWind(){return windModule.windResponse(held,.22,0,1);}
check('Actual node and optical shutter caches stay bounded; current ledger retains physical ember velocities',()=>{
  const {f,launch}=make(createScoped);try{f.update({time:launch.burstTime+.7,windVector:[2,0,.7]});const p=f.__qa.records().find(p=>p.tailFieldNode),body=p.sourceBody;assert.ok(p);vector(p.velocity,physics.sampleBody(p.emberBody,launch.burstTime+.7,[{time:-Infinity,wind:[0,0,0]},{time:launch.burstTime+.7,wind:[2,0,.7]}]).velocity,1e-8);
    for(let i=0;i<10;i++)f.__qa.view(p,.01+i*.005);assert.ok(f.__qa.viewCacheSize(p)<=4);assert.ok(f.__qa.anchorCacheSize(p.tailFieldNode)<=4);for(let i=0;i<80;i++)f.__qa.node(body,(i+.5)/80*.3);assert.ok(f.__qa.nodeCacheSize(body)<=64);return{viewCacheSize:f.__qa.viewCacheSize(p),anchorCacheSize:f.__qa.anchorCacheSize(p.tailFieldNode),nodeCacheSize:f.__qa.nodeCacheSize(body)};
  }finally{f.dispose();}
});
const report={schema:'glass-atoll.r19-tail-field-physical-check.v1',started,completed:new Date().toISOString(),passed:checks.every(c=>c.passed),counts:{passed:checks.filter(c=>c.passed).length,total:checks.length},sources:{tailField:hash(source),fireworks:hash(fwSource)},checks,limits:['Actual frozen runtime helper and real Three constructors; no GPU/context/browser/native timing.','Ground visibility interval, nonlinear spatial-path shutter error, anchor-only T, receiver/depth/camera histories remain explicit unresolved limits.','Immutable source birth and no motor-force model are current factory assumptions; static lag coefficients are not a motor acceleration solver.','Independent ODE/finite-difference evidence covers the listed finite ranges, not all IEEE754 clocks or arbitrary forcing.']};
// Do not retain base64 verification modules in the report.
for(const c of report.checks)if(c.details?.instrumentedSource)c.details={instrumentation:'Source import replaced only in memory; actual factory/sample code unchanged.'};
fs.writeFileSync(new URL('./r19-tail-field-physical-check.json',import.meta.url),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report,null,2));if(!report.passed)process.exitCode=1;
