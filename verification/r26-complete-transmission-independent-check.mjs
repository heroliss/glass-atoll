// Independent verification-only actual-factory routing audit. No GL context.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import crypto from 'node:crypto';
import * as THREE from '../vendor/three.module.js';
import {createSmokeTransmissionGPU} from '../pyro-smoke-transmission-gpu.js';
import {packSmokeTransmissionInputs as incumbentPack,smokeTransmissionWorldSources} from '../pyro-smoke-transmission-pack.js';
import {createCompleteTransmissionCandidate as createCandidate} from './r26-complete-transmission-candidate.js';
import {TransmissionCPURenderer as Renderer} from './r26-transmission-cpu-renderer.js';
import {planSmokeTransmissionLayout as layout} from './r26-transmission-layout-candidate.js';
import {planTransmissionRectangles as rectangles} from './r26-transmission-rectangles.js';
const sha=x=>crypto.createHash('sha256').update(x).digest('hex');
const read=name=>fs.readFileSync(new URL(name,import.meta.url),'utf8');
const words=x=>Array.from(new Uint32Array(x.buffer,x.byteOffset,x.length));
const checks=[];
function check(name,fn){try{checks.push({name,passed:true,evidence:fn()??null});}catch(error){checks.push({name,passed:false,error:String(error.stack??error)});}}
function fixture(n,p,version=1,{reflection=false}={}){
 const eye=reflection?[.125,-3.75,8.5]:[.125,3.75,8.5];
 const profiles=[{id:'low-blue',extinctionPerMassRGB:[.033,.127,.649]},{id:'warm',extinctionPerMassRGB:[1.5,.007,.25]}];
 const snapshot={revision:version+43,time:12.75,profiles,packets:Array.from({length:p},(_,i)=>({id:'physical-'+(p-i)+'-'+version,profileId:profiles[i%2].id,mass:.002+(i%17)*.00013,mean:[Math.sin(i*.7)*3,2+(i%13)*.03,-7-(i%19)*.11],covariance:[1+.01*(i%7),.02,-.01,.02,2+.01*(i%11),.03,-.01,.03,.6+.01*(i%5)]}))};
 const s=smokeTransmissionWorldSources(Array.from({length:n},(_,i)=>({position:[(i%29)*.17-.7,1+(i%5)*.31,-3-(i%37)*.23]})),{eye,reflection});
 if(n>3){s.active[3]=0;s.endpoints64.set([NaN,Infinity,-Infinity],9);}
 if(n>7){s.active[7]=1;s.origins64.set(s.endpoints64.subarray(21,24),21);}
 return{snapshot,...s,sourceVersion:version};
}
function run(c,r,v){const state=r.snapshot(),begin=r.calls.length,result=c.prepare(v);assert.equal(typeof result?.then,'undefined');assert.deepEqual(r.snapshot(),state);return{result,calls:r.calls.slice(begin),pixels:result.texture?r.textureData.get(result.texture):null,d:c.diagnostics()};}
function coverage(calls,width,expected){const ids=[];for(const c of calls){const[x,y,w,h]=c.rect;assert(w>0&&h>0&&x>=0&&x+w<=width);for(let yy=y;yy<y+h;yy++)for(let xx=x;xx<x+w;xx++)ids.push(xx+yy*width);assert.deepEqual(c.writes,ids.slice(ids.length-w*h));}assert.deepEqual(ids,Array.from({length:expected},(_,i)=>i));return ids.length;}

check('Frozen candidate/dependency identities match the independently reviewed map-cap revision',()=>{
 const expected={'r26-complete-transmission-candidate.js':'a20a08491c738cd96c525e12743b40532a13c2fe8d095984b1541a79a9ffb4b6','r26-transmission-pack-candidate.js':'138f75dd346107023c373e91623c9d2baf8b989b86170e8b89f156aceef280b6','r26-transmission-layout-candidate.js':'61a2e73b960a5d555cef3b6611b5aca48cdb3c6fb125db94102f0dd9a0011b86','r26-transmission-rectangles.js':'70b1a2c95c86847d2f3b1787bf48721a1d4ed32ff599d1eb79c48f37ea2b9d28'};
 for(const[name,pin]of Object.entries(expected))assert.equal(sha(read('./'+name)),pin);
 const factory=sha(createCandidate.toString());assert.equal(factory,'07c46a74471a449a86b1608dd8d67b3026183a4f0eff0891d28cc682749d2a03');
 return{pins:expected,factory};
});
check('Asymmetric physical rows and reflected water-hit origins retain full incumbent packing, shader bytes and ordered output',()=>{
 let cases=0,rows=0,physicalPackets=0,physicalWordComparisons=0;const evidence=[];
 for(const[n,p,reflection,maxMapPairs]of [[1,1,false,64],[17,65,true,1024],[65,129,false,4096],[129,65,true,65536],[257,129,false,65536]]){
  const caps={maxSources:Math.max(1,n),maxPackets:Math.max(1,p),maxRequestPairs:1048576,maxMapPairs,maxMapDraws:64};
  const cr=new Renderer(),pr=new Renderer();cr.trackPairs=pr.trackPairs=false;
  const c=createCandidate(THREE,cr,caps),old=createSmokeTransmissionGPU(THREE,pr,{maxSources:caps.maxSources,maxPackets:caps.maxPackets,maxPairs:1048576});
  try{const input=fixture(n,p,10+cases,{reflection}),before=structuredClone(input),C=run(c,cr,input),P=run(old,pr,input);assert(C.result.effective&&P.result.effective);assert.deepEqual(input,before);assert.deepEqual(words(c.packed.packetData),words(old.packed.packetData));assert.deepEqual(words(c.packed.sourceData),words(old.packed.sourceData));assert.deepEqual(words(C.pixels).slice(0,n*4),words(P.pixels).slice(0,n*4));
   const oldMap=P.calls.find(x=>x.material.name.includes('/64packet')),maps=C.calls.filter(x=>x.material.name.includes('/64packet'));
   for(const m of maps){assert.equal(m.material.fragmentShader,oldMap.material.fragmentShader);assert.equal(m.material.vertexShader,oldMap.material.vertexShader);assert(m.writes.length*64<=maxMapPairs);}
   assert.equal(C.calls.at(-1).material.fragmentShader,P.calls.at(-1).material.fragmentShader);
   assert.equal(coverage(maps,C.d.allocationPlan.allocation.partial.width,n*Math.ceil(p/64)),n*Math.ceil(p/64));
   for(let i=0;i<n;i++){const o=i*12;if(input.active[i]===0||Math.hypot(...input.endpoints64.slice(i*3,i*3+3).map((x,k)=>x-input.origins64[i*3+k]))===0)assert.deepEqual(Array.from(c.packed.sourceData.slice(o,o+12)),new Array(12).fill(0));else assert.equal(c.packed.sourceData[o+1],Math.fround(input.origins64[i*3+1]-input.eye[1]));}
   cases++;rows+=n;physicalPackets+=p;physicalWordComparisons+=c.packed.packetData.length+c.packed.sourceData.length;evidence.push({n,p,reflection,maps:maps.length});
  }finally{c.dispose();old.dispose();}
 }
 return{cases,rows,physicalPackets,physicalWordComparisons,evidence,scope:'Actual factories with shared synthetic tag renderer; no GPU optical computation'};
});
check('Exact rectangles cover all logical tiles once for active-count and every padded legacy stride cell, without slicing original packet intervals',()=>{
 const results=[];
 for(const mode of ['active-count','legacy-max']){
  const n=5,p=65,caps={maxSources:257,maxPackets:129,maxRequestPairs:3072,maxMapPairs:8192,maxMapDraws:16,layoutMode:mode},r=new Renderer(),c=createCandidate(THREE,r,caps);r.trackPairs=false;
  try{const v=fixture(n,p,51),out=run(c,r,v),maps=out.calls.slice(0,-1),stride=mode==='active-count'?n:257;assert(out.result.effective);coverage(maps,out.d.allocationPlan.allocation.partial.width,stride*2);assert.equal(out.d.mapPlan.logicalPairs,n*p);assert.equal(out.d.mapPlan.conservativePairs,stride*2*64);assert(maps.every(x=>x.uniforms.uPacketCount===65&&x.uniforms.uSourceStride===stride&&x.uniforms.uTileCount===2));
   if(mode==='legacy-max')assert(out.pixels.slice(n*4).every(x=>x===1));
   results.push({mode,stride,cells:stride*2,logicalPairs:n*p,conservativeSlots:stride*2*64,maps:maps.length});
  }finally{c.dispose();}
 }
 return{results};
});
check('Default policy and per-map/draw policies reject before context access; explicit larger complete request retains every physical packet and source',()=>{
 const rejected=[];
 for(const[options,n,p]of [[{maxSources:128,maxPackets:65},64,49],[{maxSources:16,maxPackets:65,maxMapPairs:1024,maxMapDraws:1},16,65],[{maxSources:1734,maxPackets:755,maxRequestPairs:1048576},1734,755]]){
  const r=new Renderer(),c=createCandidate(THREE,r,options);try{const v=fixture(n,p),out=c.prepare(v);assert.equal(out.effective,false);assert.equal(c.texture,null);assert.equal(c.target,null);assert.equal(r.contextGets,0);assert.equal(r.calls.length,0);assert.equal(c.diagnostics().allocated,false);rejected.push(out.reason);}finally{c.dispose();}
 }
 const n=1734,p=755,v=fixture(n,p,67),before=structuredClone(v),r=new Renderer(),c=createCandidate(THREE,r,{maxSources:n,maxPackets:p,maxRequestPairs:1400000,maxMapPairs:1000000,maxMapDraws:8});r.trackPairs=false;
 try{const out=run(c,r,v);assert(out.result.effective);assert.deepEqual(v,before);assert.equal(c.packed.count,n);assert.equal(c.packed.packets,p);const old=incumbentPack(v,{maxSources:n,maxPackets:p,maxPairs:1048576});assert.equal(old.supported,false);const maps=out.calls.slice(0,-1),count=coverage(maps,out.d.allocationPlan.allocation.partial.width,n*Math.ceil(p/64));assert.equal(count,20808);assert.equal(out.calls.length,4);assert(maps.every(x=>x.writes.length*64<=1000000));assert.equal(out.d.policy.conservativeMapPairs,1331712);assert.equal(out.d.policy.maxRequestPairs,1400000);assert.equal(out.d.productionAdmitted,false);return{rejected,logicalPairs:n*p,conservativeSlots:count*64,actualFactoryRenders:out.calls.length,productionAdmitted:false};}finally{c.dispose();}
});
check('Prior success cannot remain effective during a new prepare or fault; complete retry replaces source/density generation atomically',()=>{
 const outcomes=[];
 for(const offset of [1,2,3,4,5]){
  const r=new Renderer(),c=createCandidate(THREE,r,{maxSources:65,maxPackets:129,maxRequestPairs:20000,maxMapPairs:4096,maxMapDraws:4});r.trackPairs=false;
  try{const initial=run(c,r,fixture(65,129,100));assert(initial.result.effective);const oldTexture=c.texture,before=r.snapshot(),start=r.calls.length,render=r.render.bind(r);let observed=[];
   r.render=(...args)=>{observed.push({texture:c.texture,target:c.target,effective:c.diagnostics().effective});return render(...args);};r.fault.renderIndex=start+offset;
   assert.throws(()=>c.prepare(fixture(65,129,101)),/injected render fault/);assert.equal(c.texture,null);assert.equal(c.target,null);assert.equal(c.diagnostics().effective,false);assert.deepEqual(r.snapshot(),before);assert.equal(r.calls.length-start,offset);assert(observed.every(x=>x.texture===null&&x.target===null&&x.effective===false));
   r.fault.renderIndex=0;const retry=run(c,r,fixture(65,129,102));assert(retry.result.effective);assert.equal(retry.result.texture,oldTexture);assert.equal(retry.result.sourceVersion,102);assert.equal(retry.result.densityRevision,145);assert.equal(retry.calls.length,5);assert(observed.every(x=>x.texture===null&&x.target===null&&x.effective===false));outcomes.push({failedPass:offset,completeRetryPasses:5});
  }finally{c.dispose();}
 }
 return{outcomes,scope:'Serialized synchronous caller contract; arbitrary reentrant renderer callbacks are outside this audit'};
});
check('Context replacement/loss after success retires publication before any later render and permanently rejects reuse',()=>{
 const outcomes=[];
 for(const mode of ['replace','lose']){const r=new Renderer(),c=createCandidate(THREE,r,{maxSources:4,maxPackets:65,maxMapPairs:1024});r.trackPairs=false;try{assert(run(c,r,fixture(4,65,201)).result.effective);const old=r.gl,calls=r.calls.length;if(mode==='replace')r.getContext=()=>({...old});else r.contextLost=true;const result=c.prepare(fixture(4,65,202));assert.equal(result.effective,false);assert.equal(result.reason,'context-lost-or-replaced');assert.equal(c.texture,null);assert.equal(c.target,null);assert.equal(r.calls.length,calls);r.contextLost=false;r.getContext=()=>old;assert.equal(c.prepare(fixture(4,65,203)).effective,false);assert.equal(r.calls.length,calls);outcomes.push({mode,noNewDraws:true,contextInvalid:c.diagnostics().capabilityCache.contextInvalid});}finally{c.dispose();}}
 return{outcomes};
});
check('Compact higher-cap allocation covers the independent request envelope and bounded geometry for every legal packet count',()=>{
 const caps={maxSources:18000,maxPackets:4096,maxRequestPairs:1400000},alloc=layout(0,0,caps).allocation;let peakCells=0,maxMapCount=0;for(let p=1;p<=4096;p++){
  const n=Math.min(18000,Math.floor(caps.maxRequestPairs/p)),active=n*Math.ceil(p/64);assert(active<=alloc.partial.logicalCapacity);assert(active<=alloc.partial.width*alloc.partial.height);peakCells=Math.max(peakCells,active);
  const plan=rectangles({sourceCount:n,packetCount:p,partialWidth:alloc.partial.width,maxMapPairs:1048576,maxDraws:65});assert(plan.supported);assert.equal(plan.coveredCells,active);assert.equal(plan.logicalPairs,n*p);assert.equal(plan.mapRects.reduce((s,x)=>s+x.texels*64,0),active*64);assert(plan.mapRects.every(x=>x.conservativePairs<=1048576&&x.x+x.width<=alloc.partial.width&&x.y+x.height<=alloc.partial.height));let next=0;for(const x of plan.mapRects){assert.equal(x.begin,next);next=x.end;}assert.equal(next,active);maxMapCount=Math.max(maxMapCount,plan.mapDraws);
 }
 assert.equal(alloc.partial.logicalCapacity,39875);assert.equal(peakCells,36000);return{packetCounts:4096,partialLogicalCapacity:alloc.partial.logicalCapacity,partialTexelCapacity:alloc.partial.texelCapacity,peakActiveCells:peakCells,maxMapCount};
});

const report={schema:'glass-atoll.r26-complete-candidate-independent-cpu.v1',dateUTC:new Date().toISOString(),actualGPU:false,productionEdits:0,browserActions:0,passed:checks.every(x=>x.passed),counts:{passed:checks.filter(x=>x.passed).length,total:checks.length},checks,limits:['Actual verification factories execute against an owner-provided synthetic Float32-tag renderer; this independently checks packing/order/routing/publication and modeled native-state restoration, not hardware or Gaussian optical values.','Immutable original input/IDs and full packed data are retained; no packet aggregation or source slicing.','No native screenshot, larger GPU dispatch, frame-time, total-scene budget, throughput, production integration or UI promotion is admitted.','A returned texture is borrowed for matching ordered-source immediate consumption before any next prepare; previously returned JavaScript texture handles cannot be retroactively revoked.','Fresh complete synchronous publication assumes caller serialization. Arbitrary reentrant renderer callbacks are not an audited supported contract.']};
fs.writeFileSync(new URL('./r26-complete-transmission-independent-check.json',import.meta.url),JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({passed:report.passed,counts:report.counts,failed:checks.filter(x=>!x.passed)},null,2));if(!report.passed)process.exitCode=1;
