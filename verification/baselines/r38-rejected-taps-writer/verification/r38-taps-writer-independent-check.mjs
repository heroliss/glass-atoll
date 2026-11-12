// Bounded independent CPU review: actual immutable profiles, original window oracle.
// No renderer/context/browser, source instrumentation, physics advance or timings.
import fs from 'node:fs';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import {createFireworkEvent} from '../fireworks-physics.js';
import {sampleProfileBodyEmissionWindow,writeProfileBodyEmissionBins} from '../firework-layer-profile.js';

const root=new URL('../',import.meta.url),read=p=>fs.readFileSync(new URL(p,root)),sha=b=>crypto.createHash('sha256').update(b).digest('hex');
const baseline=read('verification/baselines/r38-before-taps-writer/firework-layer-profile.js'),current=read('firework-layer-profile.js');
const checks=[],test=(name,fn)=>{try{checks.push({name,passed:true,...fn()});}catch(e){checks.push({name,passed:false,error:String(e.stack??e)});}};
const expectedSHA='411ebd75fec379582e5d94086e40241d9f8c388c3c96a668bbbbb5af5d948715';
const event=createFireworkEvent({type:'chrysanthemum',effectProfile:'three-heart-radiant120-v1',starDragModel:'bounded-descent',seed:341070,time:0,origin:[29,0,7],azimuth:117,elevation:78,intensityScale:1});
const bodies=[event.heads[0],event.heads[1],event.heads[2],event.heads[191]];
function target(Type){const buffer=new ArrayBuffer(16+32*Type.BYTES_PER_ELEMENT+16),bytes=new Uint8Array(buffer);bytes.fill(0xa5);const out=new Type(buffer,16,32);for(let i=0;i<out.length;i++)out[i]=9000.125+i;return{buffer,bytes,out};}
function call(fn,body,options){try{return{value:fn(body,options),error:null};}catch(e){return{value:null,error:{name:e.name,message:e.message}};}}
function pair(body,fromAge,toAge,Type=Float64Array,extra={}){
  const a=target(Type),b=target(Type),before=a.bytes.slice(),old=call(sampleProfileBodyEmissionWindow,body,{fromAge,toAge,outRGB:a.out,...extra}),writer=call(writeProfileBodyEmissionBins,body,{fromAge,toAge,outRGB:b.out,...extra});
  assert.deepEqual(writer.error,old.error);assert.deepEqual(b.bytes,a.bytes,'all output words and surrounding bytes must match');
  assert.deepEqual(b.bytes.slice(0,16),before.slice(0,16));assert.deepEqual(b.bytes.slice(16+24*Type.BYTES_PER_ELEMENT),before.slice(16+24*Type.BYTES_PER_ELEMENT),'suffix sentinel changed');
  if(!writer.error){assert.equal(writer.value,b.out);assert.equal(old.value.rgbTaps,a.out);}
  return{a,b,old,writer,before};
}

test('Only the declared writer is appended; all old layer bytes and public window remain exact',()=>{
  assert.equal(sha(current),expectedSHA);assert.equal(sha(baseline),'411242962dc8681e2eb487acc7f03937ebe32331ec06414f9e78a5674778c537');
  assert(current.subarray(0,baseline.length).equals(baseline));const tail=current.subarray(baseline.length).toString('utf8');assert.equal((tail.match(/export function /g)||[]).length,1);assert(tail.includes('export function writeProfileBodyEmissionBins('));
  return{baselineBytes:baseline.length,appendedBytes:tail.length,oldPublicWindowByteExact:true};
});
test('Four actual bodies across three layers, knot edges, zero/outside windows and output types match every output byte',()=>{
  let cases=0,rejections=0;for(const original of bodies)for(const delay of[original.ignitionDelay??0,.017,2**60]){
    const body={...original,ignitionDelay:delay},knots=body.burnProfile.emission.knots.map(k=>k.age),windows=[[-.25,-.1],[0,0],[0,2**-100],[0,1/120],[.7-1/120,.7],[2.5-1/120,2.5],[body.life,body.life],[body.life,body.life+1/120],[body.life+1,body.life+2],...knots.flatMap(k=>[[k,k],[k-1/240,k+1/240]])];
    for(const [from,to]of windows)for(const Type of[Float64Array,Float32Array]){const result=pair(body,from,to,Type);cases++;if(result.old.error)rejections++;}
  }return{bodies:bodies.map(b=>({id:b.id,layerId:b.layerId})),cases,expectedLegacyRejections:rejections,allFullBuffersByteExact:true,delayQualification:'Modified descriptor delay exercises accepted old API arithmetic only; not a new physical event model.'};
});
test('Later-bin representability failure retains exact partial borrowed-buffer mutation',()=>{
  const age=2**42,to=age+5*2**-10,results=[];for(const Type of[Float64Array,Float32Array]){const r=pair(bodies[0],age,to,Type);assert.equal(r.writer.error?.name,'RangeError');assert.match(r.writer.error.message,/not representable/);assert.deepEqual(Array.from(r.b.out.slice(0,3)),[0,0,0]);assert.deepEqual(Array.from(r.b.out.slice(3)),Array.from(new Type(r.before.buffer,16,32).slice(3)));results.push({type:Type.name,fromAge:age,toAge:to,modifiedEntries:3,error:r.writer.error});}return{results};
});
test('Shared validation order/errors are unchanged; required-output difference is explicit and old allocation remains',()=>{
  const fixtures=[['missing profile',{},0,1,{}],['unregistered profile',{...bodies[0],burnProfile:{}},0,1,{}],['nonfinite start',bodies[0],NaN,1,{}],['reversed',bodies[0],1,0,{}],['overflow width',bodies[0],-Number.MAX_VALUE,Number.MAX_VALUE,{}],['wrong bins',bodies[0],0,1,{bins:16}],['string bins',bodies[0],0,1,{bins:'8'}]];
  for(const[name,body,from,to,extra]of fixtures){const p=pair(body,from,to,Float64Array,extra);assert(p.writer.error,name);assert.deepEqual(p.a.bytes,p.before,name+' rejected before any write');}
  for(const outRGB of[new Float64Array(23),new Uint32Array(24),Array(24).fill(1),null]){const old=call(sampleProfileBodyEmissionWindow,bodies[0],{fromAge:0,toAge:1,outRGB}),writer=call(writeProfileBodyEmissionBins,bodies[0],{fromAge:0,toAge:1,outRGB});assert.deepEqual(writer.error,old.error);}
  const old=sampleProfileBodyEmissionWindow(bodies[0],{fromAge:0,toAge:1/120});assert(old.rgbTaps instanceof Float64Array);assert.equal(old.rgbTaps.length,24);assert.throws(()=>writeProfileBodyEmissionBins(bodies[0],{fromAge:0,toAge:1/120}),/outRGB requires24/);
  return{sharedInvalidFixtures:fixtures.length+4,requiredOutputIsNewAPIOnly:true,oldOwnedOutputAllocationPreserved:true};
});
test('Each caller buffer stays owned and later writes cannot replace another row data',()=>{
  const one=target(Float64Array),two=target(Float64Array);writeProfileBodyEmissionBins(bodies[0],{fromAge:.65,toAge:.7,outRGB:one.out});const saved=one.bytes.slice();writeProfileBodyEmissionBins(bodies[1],{fromAge:1.65,toAge:1.7,outRGB:two.out});assert.deepEqual(one.bytes,saved);assert.notEqual(one.out.buffer,two.out.buffer);return{independentCallerBuffers:true,noWriterInternalOutputBuffer:true};
});

const report={schema:'glass-atoll.r38-taps-writer-independent-cpu-check.v1',passed:checks.every(c=>c.passed),counts:{passed:checks.filter(c=>c.passed).length,total:checks.length},checks,layerSHA256:sha(current),physicsSHA256:sha(read('fireworks-physics.js')),baselineLayerSHA256:sha(baseline),scope:'Only CPU writer arithmetic/validation/borrowed-buffer edgecases and source inverse. FW all-row upload/ledger/contact routing are owned by the separate integration reviewer.',comparison:'Byte equality for entire typed output buffer, including prefix/suffix and partial-error writes; no epsilon.',actualGPU:false,browserActions:0,rendererCalls:0,nativeContextCalls:0,performanceMeasured:false};
fs.writeFileSync(new URL('verification/r38-taps-writer-independent-check.json',root),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({passed:report.passed,counts:report.counts,failed:checks.filter(c=>!c.passed)},null,2));if(!report.passed)process.exitCode=1;
