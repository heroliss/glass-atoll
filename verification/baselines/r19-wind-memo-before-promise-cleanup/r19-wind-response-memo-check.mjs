// Pure CPU contract and frozen actual-factory integration; no GL or browser.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import crypto from 'node:crypto';
import * as THREE from '../vendor/three.module.js';
import * as current from '../wind-response.js';
const baselineURL=new URL('./baselines/r19-fw-physics-before-cpu-review/',import.meta.url),root=new URL('../',import.meta.url);
const oldSource=fs.readFileSync(new URL('wind-response.js',baselineURL),'utf8'),source=fs.readFileSync(new URL('../wind-response.js',import.meta.url),'utf8');
const uri=s=>'data:text/javascript;base64,'+Buffer.from(s).toString('base64'),old=await import(uri(oldSource));
const hash=s=>crypto.createHash('sha256').update(s).digest('hex'),checks=[],started=new Date().toISOString();
function check(name,fn){try{checks.push({name,passed:true,details:fn()??null});}catch(error){checks.push({name,passed:false,error:String(error.stack)});}}
function timeline(){return[{time:-Infinity,wind:[1.2,0,-.3]},{time:0,wind:[2,0,.4]},{time:1,wind:[-.4,.1,3]},{time:1,wind:[.2,0,1]},{time:3,wind:[-2,0,.7]}];}
check('Uncached formula body and arithmetic order remain text-exact',()=>{
  const original=oldSource.slice(oldSource.indexOf('  const dt=time-birth;',oldSource.indexOf('export function windResponse')),oldSource.indexOf('\n// Explicit invalidation'));
  const actual=source.slice(source.indexOf('  const dt=time-birth;',source.indexOf('function uncachedWindResponse')),source.indexOf('\n// Explicit invalidation'));
  assert.equal(actual,original);return{oldSHA256:hash(oldSource),scope:'Export wrapper only; unchanged raw body, including recursive initial-wind formula.'};
});
check('No scope retains bit-exact Double values, ordinary mutability and existing diagnostics',()=>{
  const a=timeline(),b=timeline();let seed=17;const rng=()=>((seed=Math.imul(seed,1664525)+1013904223>>>0)/4294967296);
  for(let i=0;i<320;i++){const birth=-2+rng()*7,time=birth+rng()*10,k=[.075,.15,.16,.2,.22,.28,.74,.8,1.35][i%9];const x=current.windResponse(a,k,birth,time),y=old.windResponse(b,k,birth,time);assert.deepEqual(x,y);assert.equal(Object.isFrozen(x),false);}
  assert.deepEqual(current.windResponseDiagnostics(a),old.windResponseDiagnostics(b));return{queries:320};
});
check('Same scope returns exact shared immutable response; tiny Double change and signed zero do not alias',()=>{
  const t=timeline();return current.withWindResponseMemo(t,()=>{
    const a=current.windResponse(t,.22,.3,4),b=current.windResponse(t,.22,.3,4),c=current.windResponse(t,.22,.3,4+Number.EPSILON*4);assert.equal(a,b);assert.notEqual(a,c);assert.deepEqual(a,old.windResponse(t,.22,.3,4));
    for(const value of [a,a.position,a.velocity])assert.ok(Object.isFrozen(value));assert.throws(()=>{a.position[0]=1;},TypeError);assert.throws(()=>{a.travel=100;},TypeError);
    const positive=current.windResponse(t,.22,+0,+0),negative=current.windResponse(t,.22,-0,-0);assert.notEqual(positive,negative);assert.deepEqual(positive,old.windResponse(t,.22,+0,+0));assert.deepEqual(negative,old.windResponse(t,.22,-0,-0));return{reused:true,immutable:true,signedZeroSeparate:true};
  });
});
check('Scope exit, new scope and callback throw discard memo; no global state leaks',()=>{
  const t=timeline();let a;const marker={};assert.equal(current.withWindResponseMemo(t,()=>{a=current.windResponse(t,.3,.2,4);return marker;}),marker);
  assert.notEqual(current.windResponse(t,.3,.2,4),a);current.withWindResponseMemo(t,()=>assert.notEqual(current.windResponse(t,.3,.2,4),a));
  assert.throws(()=>current.withWindResponseMemo(t,()=>{current.windResponse(t,.3,.2,4);throw new Error('intentional');}),/intentional/);assert.equal(Object.isFrozen(current.windResponse(t,.3,.2,4)),false);
});
check('Nested same/different timelines have independent scopes and restore the outer scope',()=>{
  const a=timeline(),b=timeline();current.withWindResponseMemo(a,()=>{const x=current.windResponse(a,.22,.2,4);current.withWindResponseMemo(a,()=>assert.notEqual(current.windResponse(a,.22,.2,4),x));assert.equal(current.windResponse(a,.22,.2,4),x);
    current.withWindResponseMemo(b,()=>{const y=current.windResponse(b,.22,.2,4);assert.equal(current.windResponse(b,.22,.2,4),y);assert.notEqual(current.windResponse(a,.22,.2,4),x);});assert.equal(current.windResponse(a,.22,.2,4),x);});
});
check('Async callbacks rejected before invocation; returned Promise/thenable rejected after finally cleanup',()=>{
  const t=timeline();let invoked=false;assert.throws(()=>current.withWindResponseMemo(t,async()=>{invoked=true;}),/synchronous/);assert.equal(invoked,false);assert.throws(()=>current.withWindResponseMemo(t,async function*(){}),/synchronous/);
  for(const fn of [()=>Promise.resolve(1),()=>({then(){}}),()=>({get then(){throw new Error('getter');}})])assert.throws(()=>current.withWindResponseMemo(t,fn));
  assert.equal(Object.isFrozen(current.windResponse(t,.22,.2,4)),false);assert.throws(()=>current.withWindResponseMemo(null,()=>1),TypeError);assert.throws(()=>current.withWindResponseMemo(t,null),TypeError);
});
check('Explicit historical invalidation disables every matching nested scope and preserves exact edits',()=>{
  const t=timeline();current.withWindResponseMemo(t,()=>{const a=current.windResponse(t,.22,.2,4);current.withWindResponseMemo(t,()=>{t[1].wind[0]=7;current.invalidateWindResponse(t);old.invalidateWindResponse(t);assert.deepEqual(current.windResponse(t,.22,.2,4),old.windResponse(t,.22,.2,4));});const b=current.windResponse(t,.22,.2,4);assert.notDeepEqual(a,b);assert.notEqual(current.windResponse(t,.22,.2,4),b);});
});
check('In-scope append/prune/endpoint replacement safely disables memo without stale hits',()=>{
  for(const mutation of [t=>t.push({time:4,wind:[10,0,2]}),t=>t.shift(),t=>{t[0]={time:-Infinity,wind:[8,0,1]};},t=>{t[t.length-1]={time:3,wind:[9,0,0]};}]){
    const t=timeline();current.withWindResponseMemo(t,()=>{const a=current.windResponse(t,.22,.2,5);mutation(t);const b=current.windResponse(t,.22,.2,5);assert.notEqual(a,b);assert.deepEqual(b,old.windResponse(t,.22,.2,5));assert.notEqual(current.windResponse(t,.22,.2,5),b);});
  }return{mutations:4};
});
check('4096-entry cap stops retaining new keys but retains already cached values',()=>{
  const t=[{time:-Infinity,wind:[1,0,2]}];current.withWindResponseMemo(t,()=>{const first=current.windResponse(t,.22,0,1);for(let i=1;i<4097;i++)current.windResponse(t,.22,i,i+1);assert.equal(current.windResponse(t,.22,0,1),first);const last=current.windResponse(t,.22,5000,5001);assert.notEqual(current.windResponse(t,.22,5000,5001),last);assert.deepEqual(last,old.windResponse(t,.22,5000,5001));});
});
check('Invalid queries retain original exceptions inside and outside scopes',()=>{
  const t=timeline();for(const q of [[0,0,1],[NaN,0,1],[.22,NaN,1],[.22,2,1],[Infinity,0,1]]){assert.throws(()=>old.windResponse(t,...q),RangeError);assert.throws(()=>current.windResponse(t,...q),RangeError);current.withWindResponseMemo(t,()=>assert.throws(()=>current.windResponse(t,...q),RangeError));}
});
function resolveImports(s,special={}){return s.replace(/from (['"])(\.\/[^'"]+)\1/g,(_,q,p)=>`from '${special[p]??new URL(p.slice(2),root).href}'`);}
function swap(s,a,b){assert.equal(s.split(a).length,2,a.slice(0,50));return s.replace(a,b);}
async function makeFactory(scoped){const physics=resolveImports(fs.readFileSync(new URL('fireworks-physics.js',baselineURL),'utf8'),{'./wind-response.js':new URL('../wind-response.js',import.meta.url).href,'./firework-layer-profile.js':new URL('firework-layer-profile.js',baselineURL).href});let f=resolveImports(fs.readFileSync(new URL('fireworks.js',baselineURL),'utf8'),{'./fireworks-physics.js':uri(physics),'./firework-exposure-window.js':new URL('firework-exposure-window.js',baselineURL).href});
  if(scoped){f=`import {withWindResponseMemo} from '${new URL('../wind-response.js',import.meta.url).href}';\n`+f;f=swap(f,'function updateRecords(){','function updateRecords(){return withWindResponseMemo(simulation.windTimeline,updateRecordsRaw);}\n  function updateRecordsRaw(){');f=swap(f,'function fillRecords(camera,air,','function fillRecords(...args){return withWindResponseMemo(simulation.windTimeline,()=>fillRecordsRaw(...args));}\n  function fillRecordsRaw(camera,air,');}
  f=swap(f,'api.configure({});return api;','api.configure({});api.__qa={records:()=>records,active:()=>simulation.active};return api;');return(await import(uri(f))).createFireworks;}
const makePlain=await makeFactory(false),makeScoped=await makeFactory(true);
const renderer=()=>({autoClear:true,shadowMap:{autoUpdate:true,needsUpdate:false},getRenderTarget(){return null;},getActiveCubeFace(){return 0;},getActiveMipmapLevel(){return 0;},setRenderTarget(){},render(){}});
function rows(f){return f.__qa.records().map(p=>({kind:p.kind,eventId:p.eventId,position:p.position,velocity:p.velocity,stretch:p.stretch,colour:p.colour,radius:p.radius,intensity:p.intensity,sourceAge:p.sourceAge,emissionRGBReference:p.emissionRGBReference,maximumReferenceRGB:p.maximumReferenceRGB}));}
function upload(f,mirror){const c=new THREE.PerspectiveCamera(55,1.5,.1,30000);c.position.set(180,mirror?-90:90,500);c.lookAt(60,150,0);c.updateMatrixWorld();f.render({renderer:renderer(),target:{width:1200,height:800},camera:c,reflection:mirror,legacySmoke:false,optics:{width:1200,height:800,shutterSeconds:1/120},frame:{storageEV:0,rawPerCandela:3.6e-5}});const g=f.effectsScene.children[0].geometry;return{count:g.instanceCount,attributes:Object.fromEntries(Object.entries(g.attributes).map(([k,a])=>[k,a.array.slice(0,k==='position'?a.array.length:g.instanceCount*a.itemSize)]))};}
for(const options of [{type:'chrysanthemum',effectProfile:'legacy'},{type:'chrysanthemum',effectProfile:'two-colour-v1'},{type:'crossette',effectProfile:'legacy'}])check(`Actual frozen factory scoped update/upload exact: ${options.type}/${options.effectProfile}`,()=>{
  const a=makePlain(THREE,{sourceVisibility:'none'}),b=makeScoped(THREE,{sourceVisibility:'none'});try{for(const f of [a,b])f.configure({...options,autoDirection:false,launchSpreadDegrees:0,burstTiltDegrees:0,burstRollDegrees:0});const A=a.launch({seed:42}),B=b.launch({seed:42});assert.deepEqual(A,B);
    for(let frame=0;frame<4;frame++){const time=A.burstTime+1.2+frame/60,windVector=frame<2?[1.8,0,.7]:[2.4,0,-.1];for(const f of [a,b]){if(frame===2){f.__qa.active()[0].rocket.position[0]+=.03125;f.__qa.active()[0].rocket.velocity[2]-=.0625;}f.update({time,windVector});}assert.deepEqual(rows(a),rows(b));assert.deepEqual(a.getLightClusters(),b.getLightClusters());const x=a.getEmissionLedger(),y=b.getEmissionLedger();assert.deepEqual(x.data.slice(0,x.count*x.stride),y.data.slice(0,y.count*y.stride));for(const mirror of [false,true])assert.deepEqual(upload(a,mirror),upload(b,mirror));}return{frames:4,scope:'real Three constructors; original factory and physics formulas; mock renderer uploads only'};
  }finally{a.dispose();b.dispose();}
});
const report={schema:'glass-atoll.r19-wind-response-memo-check.v1',started,completed:new Date().toISOString(),passed:checks.every(c=>c.passed),counts:{passed:checks.filter(c=>c.passed).length,total:checks.length},sourceSHA256:hash(source),baselineSHA256:hash(oldSource),checks,limits:['No production FW or physics edits; integration is an in-memory verification transform of frozen source.','No GPU/browser/native FPS or speedup assertion.','Historical in-place timeline edits still require invalidateWindResponse; implicit deep mutation detection is deliberately absent.','Synchronous callback scope only. Promise rejection prevents cache retention, not arbitrary asynchronous side effects already scheduled by a plain callback.']};fs.writeFileSync(new URL('./r19-wind-response-memo-check.json',import.meta.url),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report,null,2));if(!report.passed)process.exitCode=1;
