// Exact layout CPU acceptance. No renderer, graphics context or browser.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import crypto from 'node:crypto';
import {planSmokeTransmissionLayout as plan} from '../smoke-transmission-layout.js';
import {planSmokeTransmission,SMOKE_TRANSMISSION_LIMITS} from '../pyro-smoke-transmission-pack.js';
const checks=[],metrics={},check=(name,fn)=>{try{checks.push({name,passed:true,evidence:fn()});}catch(e){checks.push({name,passed:false,error:e.stack});}},native={maxSources:18000,maxPackets:4096,maxPairs:1048576},hash=data=>crypto.createHash('sha256').update(data).digest('hex');
check('constructor caps and complete request rejection remain the existing planner contract',()=>{
  assert.equal(SMOKE_TRANSMISSION_LIMITS.maxSources,18000);assert.equal(SMOKE_TRANSMISSION_LIMITS.maxPackets,4096);assert.equal(SMOKE_TRANSMISSION_LIMITS.maxPairs,1048576);
  for(const [count,packets]of [[0,0],[1,1],[64,48],[65,48],[18000,58],[18000,59],[18001,1],[1,4097],[256,4096],[257,4096]]){
    const old=planSmokeTransmission(count,packets,native),next=plan(count,packets,native);for(const k of Object.keys(old))assert.deepEqual(next[k],old[k]);if(!old.supported){assert.equal(next.action,'reject');assert.equal(next.allocation,null);assert.equal(next.mapRequired,false);assert.equal(next.reduceRequired,false);assert.equal(next.publishAfter,'never');}
  }
  for(const caps of [{maxSources:18001},{maxPackets:4097},{maxPairs:1048577},{maxPairs:0}])assert.throws(()=>plan(1,1,{...native,...caps}));for(const [c,p]of [[NaN,1],[1,Infinity],[-1,1],[1,.5]])assert.throws(()=>plan(c,p,native));assert.throws(()=>plan(1,1,{...native,layoutMode:'unbounded'}));
});
check('native compact partial allocation uses the proven minimum envelope',()=>{
  const active=plan(1734,604,native),legacy=plan(1734,604,{...native,layoutMode:'legacy-max'});assert(active.supported&&legacy.supported);assert.deepEqual(active.partialCapacityBound,{rectangular:1152000,pairEnvelope:34384,compactCapacity:34384});assert.equal(active.partialCapacityTexels,34384);assert.deepEqual(active.allocation.partial,{width:256,height:135,logicalCapacity:34384,texelCapacity:34560});assert.equal(legacy.partialCapacityTexels,1152000);assert.equal(legacy.allocation.partial.height,4500);assert.equal(active.partialStride,1734);assert.equal(legacy.partialStride,18000);assert.equal(active.activePartialTexels,17340);assert.equal(active.mapDraw.height,68);assert.equal(active.outputDraw.height,7);assert.equal(legacy.mapDraw.height,704);assert.equal(legacy.outputDraw.height,71);metrics.nativeAllocation={activePartialBytes:34560*16,legacyPartialBytes:1152000*16,mapRasterTexels:active.mapDraw.rasterTexels,legacyMapRasterTexels:legacy.mapDraw.rasterTexels};return metrics.nativeAllocation;
});
check('zero row or density uses a fresh full neutral output and never consumes old partials',()=>{
  for(const layoutMode of ['active-count','legacy-max'])for(const [count,packets]of [[0,0],[0,1],[0,4096],[1,0],[63,0],[64,0],[65,0],[18000,0]]){
    const p=plan(count,packets,{...native,layoutMode});assert.equal(p.action,'neutral');assert.equal(p.mapRequired,false);assert.equal(p.mapDraw.height,0);assert.equal(p.reduceRequired,true);assert.equal(p.reduceTileCount,0);assert.equal(p.partialStride,layoutMode==='active-count'?Math.max(1,count):18000);assert.equal(p.outputDraw.rasterTexels,p.allocation.output.texelCapacity);assert(p.fullOutputWrite&&p.freshGenerationRequired);assert.equal(p.publication.allAllocatedOutputsNeutral,true);assert.equal(p.publication.staleGenerationAllowed,false);assert.equal(p.publishAfter,'completed-neutral-output-pass');
  }
});
check('all returned allocation and publication data are deeply immutable',()=>{
  const p=plan(65,64,native);for(const object of [p,p.allocation,p.allocation.partial,p.mapDraw,p.outputDraw,p.partialCapacityBound,p.publication,p.publication.neutralRGB,p.limits])assert(Object.isFrozen(object));assert.throws(()=>{p.partialStride=18000;});assert.throws(()=>{p.publication.neutralRGB[0]=0;});assert.throws(()=>{p.allocation.partial.height=4500;});
});
check('complete 64-packet tile coverage preserves every ordered and inactive row identity',()=>{
  for(const count of [1,63,64,65,255,256,257])for(const packets of [1,63,64,65,127,128,129]){
    const p=plan(count,packets,{maxSources:257,maxPackets:129,maxPairs:33153}),seen=new Uint8Array(count*packets);
    for(let i=0;i<p.mapDraw.rasterTexels;i++){
      if(i>=p.mapDomainTexels)continue;const source=i%p.partialStride,tile=Math.floor(i/p.partialStride);assert(source<count&&tile<p.tileCount);for(let local=0;local<64;local++){const packet=tile*64+local;if(packet>=packets)break;seen[source*packets+packet]++;}
    }
    assert(seen.every(n=>n===1));for(let source=0;source<count;source++)for(let tile=0;tile<p.reduceTileCount;tile++){const index=tile*p.partialStride+source;assert(index<p.activePartialTexels&&index<p.allocation.partial.texelCapacity);}assert.equal(p.validOutputCount,count);assert.equal(p.publication.orderedCount,count);assert.equal(p.publication.inactiveRowsNeutral,true);
  }
});
check('the min allocation envelope bounds all integer cap combinations in an exhaustive small domain',()=>{
  let admitted=0,capsCount=0;
  for(const maxSources of [1,2,3,7,16,31,64,65])for(const maxPackets of [1,2,7,31,63,64,65,127,129])for(const maxPairs of [1,3,31,63,64,65,127,128,129,257,1024,4096]){
    capsCount++;const caps={maxSources,maxPackets,maxPairs},allocation=plan(0,0,caps),capacity=allocation.partialCapacityTexels;
    assert.equal(capacity,Math.min(maxSources*Math.ceil(maxPackets/64),Math.ceil(Math.min(maxPairs,maxSources*maxPackets)/64)+maxSources));
    for(let count=0;count<=maxSources;count++)for(let packets=0;packets<=maxPackets;packets++)if(count*packets<=maxPairs){const needed=count*Math.ceil(packets/64);assert(needed<=capacity);admitted++;}
  }
  metrics.exhaustive={capsCount,admittedIntegerPairs:admitted};return metrics.exhaustive;
});
check('native-cap deterministic samples and threshold extremes fit exact raster/allocation bounds',()=>{
  let seed=42,samples=0;const random=()=>((seed=(Math.imul(seed,1664525)+1013904223)>>>0)/2**32);
  for(let n=0;n<4000;n++){
    const count=Math.floor(random()*18001),maximum=count?Math.min(4096,Math.floor(1048576/count)):4096,packets=Math.floor(random()*(maximum+1)),p=plan(count,packets,native);assert(p.supported);assert(p.activePartialTexels<=p.partialCapacityTexels);assert(p.mapDraw.rasterTexels<=p.allocation.partial.texelCapacity);assert(p.outputDraw.rasterTexels<=p.allocation.output.texelCapacity);assert.equal(p.mapDraw.paddingTexels,p.mapDraw.rasterTexels-(p.mapRequired?p.activePartialTexels:0));assert.equal(p.outputDraw.paddingTexels,p.outputDraw.rasterTexels-count);assert.equal(p.reduceTileCount,p.action==='neutral'?0:Math.ceil(packets/64));samples++;
  }
  for(const count of [1,63,64,65,255,256,257,18000]){const maximum=Math.min(4096,Math.floor(1048576/count));assert(plan(count,maximum,native).supported);if(maximum<4096)assert.equal(plan(count,maximum+1,native).reason,'pair-work-capacity');}return{samples};
});
function emulate(p,{inactive=false}={}){
  const partial=new Float32Array(p.allocation.partial.texelCapacity*3).fill(NaN),output=new Float32Array(p.allocation.output.texelCapacity*3).fill(.375),count=p.count,packets=p.packets;
  if(p.mapRequired)for(let index=0;index<p.mapDraw.rasterTexels;index++){
    let tau=[0,0,0];if(index<p.mapDomainTexels){const source=index%p.partialStride,tile=Math.floor(index/p.partialStride);if(source<count&&!(inactive&&source%3===1))for(let j=0;j<64;j++){const packet=tile*64+j;if(packet>=packets)break;for(let c=0;c<3;c++){const term=Math.fround(((source*17+packet*31+c*13)%127+1)*1e-5);tau[c]=Math.fround(tau[c]+term);}}}partial.set(tau,index*3);
  }
  for(let source=0;source<p.outputDraw.rasterTexels;source++){
    const tau=[0,0,0];if(source<count)for(let tile=0;tile<p.reduceTileCount;tile++)for(let c=0;c<3;c++)tau[c]=Math.fround(tau[c]+partial[(tile*p.partialStride+source)*3+c]);for(let c=0;c<3;c++)output[source*3+c]=Math.fround(Math.exp(-Math.max(0,tau[c])));
  }
  return output;
}
check('active-count and legacy-max layouts produce bit-identical valid T under unchanged FP32 tile order',()=>{
  let cases=0;const caps={maxSources:257,maxPackets:129,maxPairs:33153};
  for(const count of [0,1,63,64,65,255,256,257])for(const packets of [0,1,63,64,65,128,129])for(const inactive of [false,true]){
    const a=plan(count,packets,caps),b=plan(count,packets,{...caps,layoutMode:'legacy-max'}),x=emulate(a,{inactive}),y=emulate(b,{inactive});assert.deepEqual(x.slice(0,count*3),y.slice(0,count*3));assert(x.slice(0,count*3).every(Number.isFinite));if(a.action==='neutral'){assert(x.every(v=>v===1));assert(y.every(v=>v===1));}else{assert(x.slice(count*3,a.outputDraw.rasterTexels*3).every(v=>v===1));if(a.outputDraw.rasterTexels<a.allocation.output.texelCapacity)assert(x.slice(a.outputDraw.rasterTexels*3).every(v=>v===.375));}if(inactive)for(let source=1;source<count;source+=3)assert.deepEqual(Array.from(x.slice(source*3,source*3+3)),[1,1,1]);cases++;
  }
  return{cases,FP32TileArithmeticOrderUnchanged:true,staleOutsideCountDisclosed:true};
});
const files=['smoke-transmission-layout.js','pyro-smoke-transmission-pack.js'],report={schema:'glass-atoll.r23-layout-planner-cpu.v1',dateUTC:new Date().toISOString(),passed:checks.every(c=>c.passed),counts:{checks:checks.length,passed:checks.filter(c=>c.passed).length},checks,metrics,sourceSHA256:Object.fromEntries(files.map(f=>[f,hash(fs.readFileSync(new URL('../'+f,import.meta.url)))])),actualGPU:false,limits:['Pure planning and FP32 arithmetic/layout emulation only; no GPU, renderer state or frame-time admission.','All ordered rows/inactive identity and original64-packet summation retained; no chunking, optical LOD or raised pair cap.','Fresh publication is a required consumer contract; actual GPU factory/generation behavior is verified by separate root/independent tests.','Legacy comparator retains positive allocation/stride/output math; neutral output uses one pass and does not claim old two-pass dispatch identity.']};fs.writeFileSync(new URL('./r23-layout-planner-check.json',import.meta.url),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({passed:report.passed,counts:report.counts,metrics,failed:checks.filter(c=>!c.passed)},null,2));if(!report.passed)process.exitCode=1;
