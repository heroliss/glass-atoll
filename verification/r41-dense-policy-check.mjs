// Explicit-capability delta only. Pure CPU packing/planning; no renderer/GL.
import fs from'node:fs';import crypto from'node:crypto';import assert from'node:assert/strict';
import*as T from'../pyro-smoke-transmission-pack.js';import*as Q from'./r39-dense-pack.js';
import{planSmokeTransmissionLayout as layout}from'../smoke-transmission-layout.js';import{planSmokeTransmissionLayout as qaLayout}from'./r39-dense-layout.js';
import{planSmokeLightTiles as SH}from'../pyro-smoke-light-tiles.js';import{planSmokeLightTiles as qaSH}from'./r39-dense-light-tiles.js';
const root=new URL('../',import.meta.url),here=new URL('./',import.meta.url),read=p=>fs.readFileSync(new URL(p,root),'utf8'),sha=x=>crypto.createHash('sha256').update(x).digest('hex'),base='verification/baselines/r41-before-dense-policy/';
const oldTText=read(base+'pyro-smoke-transmission-pack.js'),oldSHText=read(base+'pyro-smoke-light-tiles.js');
const oldT=await import('data:text/javascript;base64,'+Buffer.from(oldTText).toString('base64')),oldSH=await import('data:text/javascript;base64,'+Buffer.from(oldSHText.replace("from './smoke-transmission-rectangles.js'","from '"+new URL('smoke-transmission-rectangles.js',root).href+"'")).toString('base64'));
const checks=[],test=(name,fn)=>{try{checks.push({name,passed:true,detail:fn()});}catch(e){checks.push({name,passed:false,error:String(e.stack??e).slice(0,4000)});}};
const caps={maxSources:18000,maxPackets:4096,maxPairs:1048576},shCaps={maxPackets:4096,maxSources:14000,maxBakePairs:1048576,maxMapPairs:1000000,maxMapDraws:16};
test('Only the three authorized literals differ; proven R39 candidate bodies and shader identical',()=>{
 assert.equal(sha(oldTText),'8b52f7db7293d41cb977b2235fa95900d494425089211054422151408a10d3a2');assert.equal(sha(oldSHText),'3840487aef7d42ea11be02efc7b2f06defbf5275bccf57e131c893bf9bace663');
 assert.equal((oldTText.match(/4000000/g)||[]).length,2);assert.equal((oldSHText.match(/4000000/g)||[]).length,1);
 assert.equal(read('pyro-smoke-transmission-pack.js'),oldTText.replaceAll('4000000','12000000'));assert.equal(read('pyro-smoke-light-tiles.js'),oldSHText.replace('4000000','12000000'));
 assert.equal(read('pyro-smoke-transmission-pack.js'),read('verification/r39-dense-pack.js'));
 assert.equal(read('pyro-smoke-light-tiles.js'),read('verification/r39-dense-light-tiles.js').replace("from '../smoke-transmission-rectangles.js'","from './smoke-transmission-rectangles.js'"));
 const shader=s=>s.slice(s.indexOf('  function ensure(gl){'));assert(shader(oldSHText).length>5000);assert.equal(shader(oldSHText),shader(read('pyro-smoke-light-tiles.js')));
 return{changedLiterals:{SourceT:2,SH:1},R39BodiesExactAfterImportRelocation:true,SHShaderAndDispatchSuffixExact:true};
});
test('Old defaults and legacy named maxPairs/maxBakePairs remain unchanged',()=>{
 assert(T.planSmokeTransmission(64,48).supported);assert.equal(T.planSmokeTransmission(64,48).maxPairs,3072);
 for(const [n,p]of[[0,0],[1,1],[64,48],[65,48],[1024,1024],[1025,1024]])assert.deepEqual(T.planSmokeTransmission(n,p,n>65?caps:{}),oldT.planSmokeTransmission(n,p,n>65?caps:{}));
 assert.equal(T.planSmokeTransmission(1025,1024,caps).reason,'pair-work-capacity');assert.throws(()=>T.planSmokeTransmission(1,1,{...caps,maxPairs:1048577,maxRequestPairs:12000000}));
 assert(SH(1024,1024).supported);assert.equal(SH(1024,1025).reason,'pair-work-capacity');assert.deepEqual(SH(0,0),oldSH.planSmokeLightTiles(0,0));
 const full={maxBakePairs:60000000};assert(SH(4096,14000,full).supported);assert.deepEqual(SH(4096,14000,full),oldSH.planSmokeLightTiles(4096,14000,full));
 return{TDefault:3072,SHDefault:1048576,legacySHPositiveSafeIntegerOverridePreserved:true};
});
test('Explicit 4m behavior is exact old-domain behavior, including neutral/tile/limit boundaries',()=>{
 const points=[[0,0],[0,4096],[1,1],[63,64],[64,65],[65,63],[255,256],[256,257],[257,255],[1734,755],[2418,1663],[2000,2000],[2001,2000],[2291,3678],[18000,4096]];
 for(const[n,p]of points){const opts={...caps,maxRequestPairs:4000000};assert.deepEqual(T.planSmokeTransmission(n,p,opts),oldT.planSmokeTransmission(n,p,opts));if(n<=14000)assert.deepEqual(SH(p,n,{...shCaps,maxRequestPairs:4000000}),oldSH.planSmokeLightTiles(p,n,{...shCaps,maxRequestPairs:4000000}));}
 return{countPairs:points.length,exact4m:T.planSmokeTransmission(2000,2000,{...caps,maxRequestPairs:4000000}).supported,above4m:T.planSmokeTransmission(2001,2000,{...caps,maxRequestPairs:4000000}).reason};
});
test('Explicit 12m plans/layouts equal reviewed R39, all original-row counts retained',()=>{
 const points=[[0,0],[0,4096],[1,1],[63,64],[64,65],[65,63],[255,256],[256,257],[257,255],[2418,1663],[2291,3678],[2271,3710],[3000,4000],[3001,4000],[18000,4096]];
 for(const[n,p]of points){const opts={...caps,maxRequestPairs:12000000};assert.deepEqual(T.planSmokeTransmission(n,p,opts),Q.planSmokeTransmission(n,p,opts));assert.deepEqual(layout(n,p,opts),qaLayout(n,p,opts));if(n<=14000)assert.deepEqual(SH(p,n,{...shCaps,maxRequestPairs:12000000}),qaSH(p,n,{...shCaps,maxRequestPairs:12000000}));}
 assert(T.planSmokeTransmission(3000,4000,{...caps,maxRequestPairs:12000000}).supported);assert(SH(4000,3000,{...shCaps,maxRequestPairs:12000000}).supported);
 assert.equal(T.planSmokeTransmission(3001,4000,{...caps,maxRequestPairs:12000000}).reason,'pair-work-capacity');assert.equal(SH(4000,3001,{...shCaps,maxRequestPairs:12000000}).reason,'pair-work-capacity');
 for(const x of [12000001,0,-1,1.5,NaN,Infinity]){assert.throws(()=>T.planSmokeTransmission(0,0,{...caps,maxRequestPairs:x}));assert.throws(()=>SH(0,0,{...shCaps,maxRequestPairs:x}));}
 return{countPairs:points.length,exactRequestCeiling:12000000,aboveCeilingPairsRejected:true,aboveCeilingOptionRejected:true};
});
test('Actual immutable R39 main/mirror full original-double packing remains exact R39 U32',()=>{
 const d=JSON.parse(read('verification/r39-dense-native-fixture.json'));let words=0;
 for(const c of d.consumers){const q={...c.input,snapshot:d.snapshot,endpoints64:new Float64Array(c.input.endpoints64),origins64:new Float64Array(c.input.origins64),active:new Uint8Array(c.input.active)},opts={...caps,maxRequestPairs:12000000,packetData:new Float32Array(c.packing.packetDataLength),sourceData:new Float32Array(c.packing.sourceDataLength)},a=T.packSmokeTransmissionInputs(q,opts),b=Q.packSmokeTransmissionInputs(q,{...opts,packetData:new Float32Array(opts.packetData.length),sourceData:new Float32Array(opts.sourceData.length)});assert(a.supported);assert.deepEqual(a,b);assert.deepEqual(Array.from(new Uint32Array(a.packetData.buffer)),c.packing.packetWordsU32);assert.deepEqual(Array.from(new Uint32Array(a.sourceData.buffer)),c.packing.sourceWordsU32);words+=a.packetData.length+a.sourceData.length;const rejected=T.packSmokeTransmissionInputs(q,{...caps,maxRequestPairs:4000000});assert.equal(rejected.reason,'pair-work-capacity');assert.deepEqual(rejected,oldT.packSmokeTransmissionInputs(q,{...caps,maxRequestPairs:4000000}));}
 return{views:2,originalRowsPerView:2418,completePackedU32Words:words,noNumericKernelOrGPUInvoked:true};
});
const paths=['pyro-smoke-transmission-pack.js','pyro-smoke-light-tiles.js','pyro-smoke-transmission-gpu.js','pyro-smoke-light-field.js','smoke-transmission-layout.js','smoke-transmission-rectangles.js','verification/r39-dense-pack.js','verification/r39-dense-light-tiles.js'],hashes=Object.fromEntries(paths.map(p=>[p,sha(read(p))]));
const out={schema:'glass-atoll.r41-explicit-dense-policy-check.v1',passed:checks.every(c=>c.passed),passedChecks:checks.filter(c=>c.passed).length,totalChecks:checks.length,actualGPU:false,rendererContextCalls:0,productionEdits:['pyro-smoke-transmission-pack.js: two explicit ceiling literals','pyro-smoke-light-tiles.js: one explicit ceiling literal'],mainOrFWRoutingChanged:false,normalCallerBudgetChanged:false,hashes,scriptSHA256:sha(fs.readFileSync(new URL(import.meta.url))),checks,scope:'Optional explicit12m request capability only; old default and explicit4m unchanged. Not live joint/prepared integration, numerical re-admission or frame/FPS proof.'};fs.writeFileSync(new URL('r41-dense-policy-check.json',here),JSON.stringify(out,null,2)+'\n');console.log(JSON.stringify(out,null,2));if(!out.passed)process.exitCode=1;
