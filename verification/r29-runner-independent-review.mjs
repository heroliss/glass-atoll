// Independent CPU-only R29 review. Never requests a browser or WebGL context.
import fs from 'node:fs';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import * as THREE from '../vendor/three.module.js';
import {R29_CALIBRATION_PINS as pins} from './r29-native-calibration-pins.js';
import {runR29NativeCalibration} from './r29-native-calibration-runtime.js';
import {createSmokeTransmissionGPU as createTransmission} from '../pyro-smoke-transmission-gpu.js';
import {packSmokeTransmissionInputs as packT,planSmokeTransmission as policyT} from '../pyro-smoke-transmission-pack.js';
import {planSmokeTransmissionLayout as layoutT} from '../smoke-transmission-layout.js';
import {planTransmissionRectangles as rectangles,decomposeTransmissionInterval as decompose} from '../smoke-transmission-rectangles.js';
import {smokeGaussianColumnGLSL as column} from '../pyro-smoke-renderer.js';
import {createPyroSmokeLightField as createLightField,packSmokeLightPackets as packLight,smokeLightMomentsGLSL as moments} from '../pyro-smoke-light-field.js';
import {planSmokeLightTiles as lightPlan,createSmokeLightTileBaker as tileFactory} from '../pyro-smoke-light-tiles.js';
import {boundSmokeLightField as lightBound} from '../pyro-smoke-light-bound.js';
import {captureLightNativeState as capture,restoreLightNativeState as restore,sameLightNativeState as sameState,withLightNativeState as preserve} from '../pyro-smoke-light-native-state.js';
const read=p=>fs.readFileSync(new URL(p,import.meta.url),'utf8');
const sha=x=>crypto.createHash('sha256').update(x).digest('hex');
const source=read('./r29-native-calibration-runtime.js'),checks=[];
function extract(name){const start=source.indexOf('function '+name+'(');assert(start>=0);const end=source.indexOf('\n}\n',start);assert(end>=0);return source.slice(start,end+2);}
function freeze(v){if(v&&typeof v==='object'){for(const d of Object.values(Object.getOwnPropertyDescriptors(v)))if('value'in d)freeze(d.value);Object.freeze(v);}return v;}
async function check(name,fn){try{checks.push({name,passed:true,evidence:(await fn())??null});}catch(e){checks.push({name,passed:false,error:String(e.stack??e)});}}
const makeGuard=p=>new Function('PINS','SPECS','R29_CALIBRATION_RUNTIME_REVISION','demand','return ('+extract('validatePins')+');')(p,{source:true,joint:true,light:true},'r29-complete-native-lifetime-v1',(v,m)=>assert(v,m));
await check('All mandatory cached paths are enumerable: no skipped mandatory fetch via count-preserving extra key',()=>{
  assert.equal(makeGuard(pins)('source'),pins.jobs.source);
  const p=structuredClone(pins),required='../main.js',descriptor=Object.getOwnPropertyDescriptor(p.sources,required);
  Object.defineProperty(p.sources,required,{...descriptor,enumerable:false});
  p.sources['../index.html']='0'.repeat(64);
  freeze(p);
  assert.equal(Object.keys(p.sources).length,Object.keys(pins.sources).length);
  assert(Object.hasOwn(p.sources,required));
  assert(!Object.entries(p.sources).some(([k])=>k===required));
  assert.throws(()=>makeGuard(p)('source'),/pin|identity/i);
  return {requiredPath:required,requiredFetchWouldBeSkipped:true,extraEnumerablePath:'../index.html',rejectedBeforeCapture:true};
});
await check('Cached pin-map exact data descriptors reject hidden/symbol/prototype/getter omissions without invoking accessors',()=>{
  let accessorCalls=0;
  const mutants=[
    ['symbol-extra',p=>p.functions[Symbol('hidden')]='0'.repeat(64)],
    ['non-enumerable-extra',p=>Object.defineProperty(p.functions,'hidden',{value:'0'.repeat(64),enumerable:false})],
    ['getter',p=>Object.defineProperty(p.functions,'column',{enumerable:true,get(){accessorCalls++;return pins.functions.column;}})],
    ['custom-prototype',p=>Object.setPrototypeOf(p.functions,{extra:true})],
    ['null-prototype',p=>Object.setPrototypeOf(p.jobs,null)],
    ['missing-function',p=>delete p.functions.moments],
    ['phase-extra',p=>p.jobs.light.phase.extra=1],
    ['phase-nonfinite',p=>p.jobs.source.phase.time=Infinity],
    ['schema',p=>p.schema='old']
  ];
  for(const [name,mutate]of mutants){const p=structuredClone(pins);mutate(p);freeze(p);assert.throws(()=>makeGuard(p)('joint'),/pin|identity/i,name);}
  assert.equal(accessorCalls,0);assert.throws(()=>makeGuard(pins)('__proto__'),/pin|identity/i);
  return{rejected:mutants.map(x=>x[0]),accessorCalls,prototypeKindRejected:true};
});
const functions={createTransmission,createLightField,packT,policyT,layoutT,rectangles,decompose,packLight,lightPlan,tileFactory,lightBound,capture,restore,sameState,preserve,column,moments};
await check('Every fixed source, cached imported function/math string and whole artifact identity matches current frozen pins',async()=>{
  assert.deepEqual(Object.keys(pins.functions).sort(),Object.keys(functions).sort());
  for(const [key,fn]of Object.entries(functions))assert.equal(sha(typeof fn==='string'?fn:Function.prototype.toString.call(fn)),pins.functions[key],key);
  for(const [path,hash]of Object.entries(pins.sources))assert.equal(sha(read(path)),hash,path);
  const out=[];
  for(const [kind,pin]of Object.entries(pins.jobs)){
    for(const [path,hash]of Object.entries(pin.sources))assert.equal(sha(read(path)),hash,path);
    const m=await import('./r29-native-phase-'+kind+'-peak.js');
    assert.equal(sha(m.r29CanonicalJSON(m.R29_NATIVE_PHASE_FIXTURE)),pin.artifactDigest);
    assert.equal(m.R29_NATIVE_PHASE_FIXTURE_DIGEST,pin.artifactDigest);
    assert.deepEqual(m.R29_NATIVE_PHASE_FIXTURE.phase,pin.phase);
    assert.equal(sha(Function.prototype.toString.call(m.r29CanonicalJSON)),pin.canonicalFunctionSHA256);
    out.push({kind,digest:pin.artifactDigest});
  }
  return{sharedSources:Object.keys(pins.sources).length,cachedFunctions:Object.keys(functions).length,jobs:out};
});
const prefix=source.slice(0,source.indexOf('let activeCall=false;')).replace(/^import .*;\r?\n/gm,'').replace('export const R29_CALIBRATION_RUNTIME_REVISION','const R29_CALIBRATION_RUNTIME_REVISION');
const bindings={PINS:pins,packT,policyT,layoutT,rectangles,decompose,column,packLight,moments,lightPlan,tileFactory,lightBound,capture,restore,sameState,preserve};
const privateCPU=new Function(...Object.keys(bindings),prefix+'\nreturn {ownPhase,validateT,validateLight,TCTOR,LCTOR,SPECS};')(...Object.values(bindings));
await check('Full native peak copies own references/words before yield; joint shares only its one owned snapshot and ledger',async()=>{
  const out=[];
  for(const kind of ['source','light','joint']){
    const m=await import('./r29-native-phase-'+kind+'-peak.js'),a=m.R29_NATIVE_PHASE_FIXTURE,digest=sha(m.r29CanonicalJSON(a)),o=privateCPU.ownPhase(kind,a,m.r29CanonicalJSON);
    assert.notEqual(o.snapshot,a.snapshot);assert.notEqual(o.snapshot.packets[0],a.snapshot.packets[0]);
    assert.equal(o.jobs.reduce((n,j)=>n+j.stages.length,0),o.spec.draws);
    assert.equal(o.jobs.reduce((n,j)=>n+j.readBytes,0),o.spec.readBytes);
    assert(o.declaredReservation<=100663296);
    if(kind==='joint'){
      assert.equal(o.jobs[0].input.snapshot,o.jobs[1].snapshot);assert.equal(o.jobs[1].ledger,o.ledger);
      assert.equal(o.jobs[0].input.sourceVersion,o.ledger.recordGeneration);
      assert.notEqual(o.jobs[0].input.count,o.ledger.count);
    }
    for(const j of o.jobs){assert.equal(j.samples.length,8);assert.equal(new Set(j.samples).size,8);const n=j.kind==='transmission'?j.map.completeCells:j.plan.partialTexels;assert(j.samples.every(x=>x>=0&&x<n));}
    o.snapshot.packets[0].mean[0]+=1;o.ledger.data[0]+=1;
    for(const j of o.jobs){if(j.kind==='transmission'){j.input.endpoints64[0]+=1;j.physical[0]=123;j.quantized[0]=123;}else{j.references[0][0]=123;j.packetUpload[0]+=1;}}
    assert.equal(sha(m.r29CanonicalJSON(a)),digest);
    out.push({kind,packets:o.spec.packets,T:o.spec.tCount,SH:o.spec.lCount,draws:o.spec.draws,readBytes:o.spec.readBytes,reservation:o.declaredReservation,mirror:o.otherConsumers.find(x=>x.kind==='reflection')});
  }
  return out;
});
await check('Final native numerical validators inspect every row including signed fourth SH channel and reject last-row corruption',async()=>{
  const out=[];
  for(const kind of ['source','light','joint']){
    const m=await import('./r29-native-phase-'+kind+'-peak.js'),o=privateCPU.ownPhase(kind,m.R29_NATIVE_PHASE_FIXTURE,m.r29CanonicalJSON);
    for(const j of o.jobs){
      if(j.kind==='transmission'){
        const pixels=[new Float32Array(j.quantized)],partials=[new Float32Array(32)],v=privateCPU.validateT(j,pixels,partials);
        assert.equal(v.validOutputRows,j.input.count);const bad=[pixels[0].slice()];bad[0][bad[0].length-4]=NaN;assert.throws(()=>privateCPU.validateT(j,bad,partials));
        out.push({kind,kernel:j.kind,rows:v.validOutputRows,physicalError:v.maximumPhysicalTError});
      }else{
        const pixels=j.references.map(x=>new Float32Array(x)),partials=Array.from({length:3},()=>new Float32Array(32)),v=privateCPU.validateLight(j,pixels,partials,j.bound);
        assert.equal(v.validPacketRows,o.spec.packets);const bad=pixels.map(x=>x.slice());bad[2][bad[2].length-1]=NaN;assert.throws(()=>privateCPU.validateLight(j,bad,partials,j.bound));
        assert.throws(()=>privateCPU.validateLight(j,pixels,partials,{maxRGB:0}));
        out.push({kind,kernel:j.kind,rows:v.validPacketRows,negative:v.signedNegativeComponents,negativeFourth:pixels.reduce((n,x)=>n+Array.from(x).filter((v,i)=>i%4===3&&v<0).length,0),C0error:v.maximumC0ErrorOverPeakReferenceC0,C1error:v.maximumC1VectorErrorOverPeakReferenceC0});
      }
    }
  }
  return out;
});
await check('Real exported runner reaches only existing-context boundary after full ownership/pins and rejects stale factory before context',async()=>{
  const m=await import('./r29-native-phase-joint-peak.js'),prior=Object.getOwnPropertyDescriptor(globalThis,'fetch');
  Object.defineProperty(globalThis,'fetch',{configurable:true,writable:true,value:async url=>({ok:true,text:async()=>fs.readFileSync(url,'utf8')})});
  try{
    const out=[];
    for(const stale of [false,true]){let contexts=0;const renderer={render(){},debug:{},getContext(){contexts++;return null;}};
      const r=await runR29NativeCalibration(THREE,renderer,'joint',m.R29_NATIVE_PHASE_FIXTURE,m.R29_NATIVE_PHASE_FIXTURE_DIGEST,m.r29CanonicalJSON,{parentLocked:true,createTransmission:stale?function staleFactory(){throw Error('must not construct');}:createTransmission,createLightField});
      assert.equal(r.actualGPU,false);assert.equal(r.actualDraws,0);assert.equal(contexts,stale?0:1);assert.match(r.failure,stale?/pin mismatch/:/Healthy existing WebGL2 context/);
      assert.equal(r.privateInputAndOfflineOraclesOwnedBeforeFirstAwait,true);assert.equal(r.native.sameGenerationOwned,true);assert.equal(r.caps.maxActualDraws,10);assert.equal(r.caps.maxReadbackBytes,122832);
      out.push({staleFactory:stale,contexts,draws:r.actualDraws,ownedBeforeFirstAwait:r.privateInputAndOfflineOraclesOwnedBeforeFirstAwait});
    }
    return out;
  }finally{if(prior)Object.defineProperty(globalThis,'fetch',prior);else delete globalThis.fetch;}
});
await check('Whole-job render/timer/native-state/resource contract preserves the established bounded numerical-only route',()=>{
  assert(source.indexOf('validatePins(kind)')<source.indexOf('owned=ownPhase('));
  assert(source.indexOf('owned=ownPhase(')<source.indexOf('await sha(owned.canonical)'));
  assert(source.indexOf('report.sourceGuard=')<source.indexOf('gl=renderer.getContext()'));
  assert.equal((source.match(/gl\.beginQuery\(/g)||[]).length,1);
  assert(source.indexOf('report.timedIntervals.push({ready,disjoint')<source.indexOf('gpuMs<=25'));
  assert(source.indexOf('gpuMs<=25')<source.indexOf('partials=readOwned(job.partial'));
  assert(source.includes("key==='drawArrays'&&args[0]===gl.TRIANGLES&&args[1]===0&&args[2]===3"));
  assert(source.includes('currentDraw.actualDraws===0'));assert(source.includes('currentDraw.actualDraws===1'));
  assert(source.includes('m.forceSinglePass===true'));assert(source.includes('job.field.enabled===false&&job.field.textures.length===0'));
  assert(source.includes('job.field.texture===null&&job.field.target===null'));
  assert(source.includes('r.reused===false&&diag.bakes===1'));assert(source.includes('diag.prepares===1&&diag.draws===job.stages.length'));
  assert(source.includes('restore(THREE,renderer,gl,sentinel)'));assert(source.includes('sameState(sentinel,capture(THREE,renderer,gl))'));
  assert(source.includes("['clear','clearBufferfv','clearBufferiv','clearBufferuiv','clearBufferfi']"));
  assert(source.includes('delete p.object[p.key]'));assert(source.includes('for(const f of fields)'));assert(source.includes('for(const t of resources)'));
  assert(!/new THREE\.WebGLRenderer|OffscreenCanvas|createElement|referenceSmokeTransmission|referencePackedField/.test(source));
  assert(source.includes('compute joint, NOT a complete evolving frame/FPS/visual acceptance'));
  return{oneRetrospectiveTimer:true,maxDraws:[5,6,10],noOnlineOracle:true,noSceneDraw:true,allRowsAndEightPartials:true,notNormalFrameAcceptance:true,guardSourceSHA256:sha(read('../pyro-smoke-light-native-state.js'))};
});
const report={schema:'glass-atoll.r29-runner-independent-review.v1',dateUTC:new Date().toISOString(),actualGPU:false,passed:checks.every(x=>x.passed),counts:{passed:checks.filter(x=>x.passed).length,total:checks.length},runtimeSHA256:sha(source),pinsModuleSHA256:sha(read('./r29-native-calibration-pins.js')),pinsManifestSHA256:sha(read('./r29-native-calibration-pins.json')),checks,retainedFailure:'baselines/r29-independent-before-enumerable-guard-repair/r29-runner-independent-review.json',limits:['CPU-only frozen-source/cached pin, native ownership, all-row validator falsification and exported pre-context runner review. No actual GL, browser, GPU timing, or new oracle quadrature.','The fixed joint shares one owned physical generation and computes two complete independent kernels; it is not a normal evolving frame, nonzero mirror or accumulated fireworks performance claim.','The 96MiB reservation describes bounded captured numeric/canonical data, not full JavaScript heap or graphics-driver allocation. Existing R28 native-state guard lineage is retained; this suite does not inject real-context failures.']};
fs.writeFileSync(new URL('./r29-runner-independent-review.json',import.meta.url),JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify(report,null,2));if(!report.passed)process.exitCode=1;
