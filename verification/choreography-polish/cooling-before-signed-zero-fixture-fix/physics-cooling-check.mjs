import fs from 'node:fs';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import * as actual from '../../fireworks-physics.js';
const root=new URL('../../',import.meta.url),here=new URL('./',import.meta.url),read=p=>fs.readFileSync(new URL(p,root),'utf8'),sha=s=>crypto.createHash('sha256').update(s).digest('hex');
const source=read('fireworks-physics.js'),baseline=read('verification/choreography-polish/before-log-cooling/fireworks-physics.js');
const absolute=s=>s.replace(/from (['"])(\.\/[^'"]+)\1/g,(_,q,p)=>`from '${new URL(p.slice(2),root).href}'`);
const old=await import('data:text/javascript;base64,'+Buffer.from(absolute(baseline)).toString('base64'));
const results=[];function check(name,fn){try{results.push({name,passed:true,details:fn()??null});}catch(e){results.push({name,passed:false,error:String(e.stack).replace(/data:text\/javascript;base64,[^\s)]+/g,'[CPU source clone]')});}}
check('Only one cooling-law block changes; full inverse restores archived66cf source and all20 event constructors remain exact',()=>{
 const d=JSON.parse(read('verification/choreography-polish/physics-cooling-source-delta.json'));assert.equal(source.split(d.after).length-1,1);assert.equal(source.replace(d.after,d.before),baseline);
 assert.equal(source.replaceAll('\r\n','').includes('\n'),false);assert.equal(sha(baseline),'66cf244ea9ac4d1b2059a9ca762a6995a1806157729189dee46b48eb9fee73e4');
 let events=0;for(const {id:type}of actual.FIREWORK_TYPES)for(const seed of [42,341070]){const config={type,seed,starDragModel:'bounded-descent'};assert.deepEqual(actual.createFireworkEvent(config),old.createFireworkEvent(config));events++;}
 return{events,baselineSHA256:sha(baseline),sourceSHA256:sha(source),profileLifeAndIntensityUnchanged:true};
});
check('Authored logarithmic cooling is nonnegative, monotone and C1 at onset/extinction, without an exposure input',()=>{
 const factor=q=>Math.exp(-32*q*q)*(1-q)*(1-q)*(1+2*q),derivative=q=>Math.exp(-32*q*q)*(-64*q*(1-3*q*q+2*q*q*q)+6*q*(q-1));
 let previous=1,samples=0;for(let i=0;i<=10000;i++){const q=i/10000,value=factor(q);assert.ok(value>=0&&value<=previous+1e-16);assert.ok(derivative(q)<=1e-15);previous=value;samples++;}
 assert.equal(factor(0),1);assert.equal(factor(1),0);assert.equal(derivative(0),0);assert.equal(derivative(1),0);
 const rows=[];for(const life of [.78,2.8,3.6,6.2,11.8]){
  const body={kind:'star',life};let last=Infinity;for(let i=0;i<=1000;i++){const age=.028+(life-.028)*i/1000,value=actual.starEnvelope(body,age);assert.ok(value>=0&&value<=last+1e-14);last=value;}
  assert.equal(actual.starEnvelope(body,life),0);assert.equal(actual.starEnvelope(body,life+1),0);
  const h=life*1e-5,v=actual.starEnvelope(body,life-h);assert.ok(v/h<1e-14);
  rows.push({life,endpointEnvelope:v,endpointOneSidedSlope:v/h,samples:[.35,.5,.6,.7,.8,.9,.96,.99].map(f=>({lifeFraction:f,previous:old.starEnvelope(body,life*f),current:actual.starEnvelope(body,life*f)}))});
 }
 return{analyticDerivative:'exp(-32q^2)*[-64q(1-3q^2+2q^3)+6q(q-1)] <=0 for0<=q<=1',factorSamples:samples,sourceFadeOnsetFraction:.35,coefficient32:'authored visual extinction; not measured temperature/candela',rows};
});
check('Strobe complete old pulse law and rocket envelope remain Object.is exact',()=>{
 let strobe=0,rocket=0;for(const seed of [1,42,341070]){const e=actual.createFireworkEvent({type:'strobe',seed});for(const body of e.heads)for(let i=0;i<=64;i++){const age=body.life*i/64;assert.ok(Object.is(actual.starEnvelope(body,age),old.starEnvelope(body,age)));strobe++;}for(let i=0;i<=200;i++){const age=e.rocket.life*i/200;assert.ok(Object.is(actual.bodyEmissionEnvelope(e.rocket,age),old.bodyEmissionEnvelope(e.rocket,age)));rocket++;}}
 return{strobeSamples:strobe,rocketSamples:rocket};
});
check('Experimental burnProfile emissions and original peak bounds are unchanged at0x/1x/64x',()=>{
 let samples=0;for(const effectProfile of ['three-heart-v1','two-colour-v1','powered-bees-v1','three-heart-scale120-v1','three-heart-radiant120-v1'])for(const intensityScale of [0,1,64]){
  const e=actual.createFireworkEvent({type:'chrysanthemum',seed:42,effectProfile,intensityScale,starDragModel:'bounded-descent'});for(const body of e.heads)if(body.burnProfile)for(const age of [0,.03,.7,1.7,2.5,body.life]){assert.deepEqual(actual.sampleBodyEmission(body,age),old.sampleBodyEmission(body,age));samples++;}
 }
 const body={kind:'star',life:3.6,intensity:8,colour:actual.EMISSION_PROFILES.yellow};for(const age of [0,.7,1.7,2.5,3.6])assert.deepEqual(actual.sampleBodyEmission(body,age).allPhaseMaximumRGB,old.sampleBodyEmission(body,age).allPhaseMaximumRGB);
 return{profileSamples:samples,scope:'Unprofiled native sustained stars, including powered-bees160native, intentionally inherit logarithmic cooling.'};
});
const report={schema:'glass-atoll.choreography-polish.log-cooling-check.v2',passed:results.every(r=>r.passed),summary:`${results.filter(r=>r.passed).length}/${results.length}`,actualGPU:false,sourceSHA256:sha(source),baselineSHA256:sha(baseline),checks:results};fs.writeFileSync(new URL('physics-cooling-check.json',here),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({passed:report.passed,summary:report.summary,failures:results.filter(r=>!r.passed)},null,2));if(!report.passed)process.exitCode=1;
