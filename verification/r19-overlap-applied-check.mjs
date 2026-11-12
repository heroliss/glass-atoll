// Verify the applied production loop against the sealed pre-hoist source.
// Prior detached benchmark/factory reports remain unchanged.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import crypto from 'node:crypto';
import {createFireworkEvent} from '../fireworks-physics.js';
import {sampleProfileBodyEmissionWindow as applied} from '../firework-layer-profile.js';
const root=new URL('../',import.meta.url),read=p=>fs.readFileSync(new URL(p,root),'utf8'),hash=s=>crypto.createHash('sha256').update(s).digest('hex'),uri=s=>'data:text/javascript;base64,'+Buffer.from(s).toString('base64');
const before=read('verification/baselines/r19-before-overlap-hoist/firework-layer-profile.js'),after=read('firework-layer-profile.js'),scratch=read('verification/r19-optical-sampling-microbench.mjs'),reports=['r19-optical-sampling-microbench.json','r19-optical-sampling-factory-candidate.json'];
assert.equal(hash(before),'40e3ad97b42601fdfe7588a95a9d907002f6dbd57aa714ee69bda3e35ecd9c82');
const old=(await import(uri(before.replace(/from (['"])(\.\/[^'"]+)\1/g,(_,q,p)=>`from '${new URL(p,root).href}'`)))).sampleProfileBodyEmissionWindow;
const loopStart='  else for(let bin=0;bin<8;bin++){',tail='  const averageRGBReference=';
assert.equal(after.slice(0,after.indexOf(loopStart)),before.slice(0,before.indexOf(loopStart)));
assert.equal(after.slice(after.indexOf(tail)),before.slice(before.indexOf(tail)));
const clean=s=>s.replace(/\/\/[^\n]*/g,'').replace(/\s/g,''),expected=scratch.slice(scratch.indexOf('  for(let bin=0;bin<8;bin++){'),scratch.indexOf(tail)).replace('  for','  else for');
assert.equal(clean(after.slice(after.indexOf(loopStart),after.indexOf(tail))),clean(expected));
let comparisons=0,errorCases=0;
for(const effectProfile of ['three-heart-v1','two-colour-v1']){
  const event=createFireworkEvent({type:'chrysanthemum',effectProfile,seed:43,starDragModel:'bounded-descent'});
  for(const body of event.heads)for(const delay of [0,.123])for(const S of [0,1/120,.1,.5,1])for(const phase of [-.02,0,.03,.4,.65,.95,1,1.02])for(const kind of ['owned','f64','f32']){
    const b=delay?{...body,ignitionDelay:delay}:body,age=body.life*phase,options={fromAge:age-S,toAge:age};
    if(kind!=='owned')options.outRGB=kind==='f64'?new Float64Array(32):new Float32Array(32);
    const a=applied(b,options),o=old(b,{...options,...(options.outRGB?{outRGB:options.outRGB.slice()}: {})});assert.deepEqual(a,o);comparisons++;
  }
  const body=event.heads[0],bad=[{fromAge:NaN,toAge:1},{fromAge:-Infinity,toAge:1},{fromAge:0,toAge:Infinity},{fromAge:2,toAge:1},{fromAge:0,toAge:1,bins:2},{fromAge:0,toAge:1,outRGB:new Float64Array(23)},{fromAge:0,toAge:1,outRGB:new Float32Array(0)},{fromAge:0,toAge:1,outRGB:[]},{fromAge:1e20,toAge:1e20+16384}];
  for(const options of bad){let a,o;try{applied(body,options);}catch(e){a=[e.constructor.name,e.message];}try{old(body,options);}catch(e){o=[e.constructor.name,e.message];}assert.deepEqual(a,o);assert(a);errorCases++;}
}
const sealedReports=Object.fromEntries(reports.map(name=>{const s=read('verification/'+name),p=JSON.parse(s);assert(p.passed);return[name,{sha256:hash(s),baselineLayerSHA256:p.productionLayerSHA256??p.sourceSHA256.layer}];}));
for(const report of Object.values(sealedReports))assert.equal(report.baselineLayerSHA256,hash(before));
const report={schema:'glass-atoll.r19-overlap-applied-seal.v1',dateUTC:new Date().toISOString(),passed:true,checks:{onlyPositiveLoopChanged:true,candidateLoopArithmeticTextExactIgnoringCommentsWhitespace:true,fullReturnDeepEqualWindows:comparisons,matchingErrorCases:errorCases,detachedBaselineReportsPreserved:true},sourceSHA256:{before:hash(before),applied:hash(after)},sealedReports,limits:['CPU source/module equivalence only; no native GPU/FPS claim.','Original width0 and public validation/output contract are byte-exact before/after.']};
fs.writeFileSync(new URL('./r19-overlap-applied-check.json',import.meta.url),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report,null,2));
