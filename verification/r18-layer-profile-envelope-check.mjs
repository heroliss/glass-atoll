// Bounded, pure CPU envelope witnesses. No renderer, context or GPU.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import crypto from 'node:crypto';
import {getFireworkShowEnvelope} from '../firework-show-envelope.js';
import {FIREWORK_TYPES,createFireworkEvent,createFireworksSimulation,sampleBody,sampleFireworkEvent} from '../fireworks-physics.js';
import {FIREWORK_LAYER_PROFILE_LIMITS} from '../firework-layer-profile.js';

const oldSource=fs.readFileSync(new URL('./baselines/r18-envelope-before-layer-profile/firework-show-envelope.js',import.meta.url),'utf8');
assert.equal(crypto.createHash('sha256').update(oldSource).digest('hex'),'d89bb457d79eb9540798dca97565bb6b712fe4be2f6842ad38ecdb3806e9f050');
const reboundOld=oldSource.replace("from './fireworks-physics.js'","from '"+new URL('../fireworks-physics.js',import.meta.url).href+"'");
const {getFireworkShowEnvelope:legacyEnvelope}=await import('data:text/javascript;base64,'+Buffer.from(reboundOld).toString('base64'));
const checks=[];
const check=(name,fn)=>{try{checks.push({name,passed:true,evidence:fn()??null});}catch(error){checks.push({name,passed:false,error:String(error.stack??error)});}};
const axis=(az,el)=>{const a=az*Math.PI/180,e=el*Math.PI/180;return[Math.sin(a)*Math.cos(e),Math.sin(e),-Math.cos(a)*Math.cos(e)];};
const inside=(point,bound,context)=>{if(point[1]<.03)return;for(let c=0;c<3;c++)assert(point[c]>=bound.min[c]-1e-8&&point[c]<=bound.max[c]+1e-8,JSON.stringify({point,min:bound.min,max:bound.max,c,context}));};
const candidates=Object.keys(FIREWORK_LAYER_PROFILE_LIMITS);

check('all ten legacy type envelopes retain exact values keys and strings',()=>{
  let compared=0;
  for(const type of FIREWORK_TYPES)for(const starDragModel of ['legacy','bounded-descent'])for(const elevation of [25,78,90])for(const spread of [0,15]){
    const options={type:type.id,origin:[29,.21,7],muzzleOffsetMetres:.66,settings:{azimuth:110,elevation,launchSpreadDegrees:spread,starDragModel}};
    const before=legacyEnvelope(options),after=getFireworkShowEnvelope(options);assert.deepEqual(after,before);assert.deepEqual(getFireworkShowEnvelope({...options,effectProfile:'legacy'}),before);assert.equal(Object.hasOwn(after,'effectProfile'),false);compared++;
  }
  return{compared,scope:'Original envelope source rebound only to the current same legacy generator; exact binary64 output and object contract comparison'};
});
check('candidate hard contracts select extended life with unchanged carrier limits',()=>{
  const result=[];
  for(const effectProfile of candidates){const limits=FIREWORK_LAYER_PROFILE_LIMITS[effectProfile],base=getFireworkShowEnvelope({type:'chrysanthemum'}),candidate=getFireworkShowEnvelope({type:'chrysanthemum',effectProfile});
    assert(Object.isFrozen(limits));assert.equal(candidate.effectProfile,effectProfile);assert.equal(candidate.limits.bodySeconds,limits.maximumBodySeconds);assert.equal(candidate.limits.intrinsicSpeedMetresPerSecond,19);assert.equal(candidate.limits.birthDelaySeconds,0);assert.equal(candidate.limits.tailSeconds,.35);assert.equal(candidate.limits.rocketTailSeconds,.5);
    for(const field of ['carrierSeconds','muzzleSpeedMetresPerSecond','minimumBodyDragPerSecond','maximumBodyDragPerSecond'])assert.deepEqual(candidate.limits[field],base.limits[field]);
    for(const field of ['launchDirectionRanges','launchElevationRangeDegrees','launchPositionRanges','burstPositionRanges','burstVelocityRanges'])assert.deepEqual(candidate[field],base[field]);
    assert.equal(limits.propulsionKind,'none');assert.equal(limits.bodyCount,192);result.push({effectProfile,bodySeconds:candidate.limits.bodySeconds,tailSeconds:candidate.limits.tailSeconds,carrierSeconds:candidate.limits.carrierSeconds});
  }return result;
});
check('settings interface options override and unsupported combinations fail closed',()=>{
  const candidate=getFireworkShowEnvelope({type:'chrysanthemum',settings:{effectProfile:'three-heart-v1'}});assert.equal(candidate.effectProfile,'three-heart-v1');
  assert.deepEqual(getFireworkShowEnvelope({type:'chrysanthemum',settings:{effectProfile:'three-heart-v1'},effectProfile:'legacy'}),legacyEnvelope({type:'chrysanthemum'}));
  for(const effectProfile of [...candidates,'powered-bees','unknown',null,0])for(const type of effectProfile===null||effectProfile===0||!candidates.includes(effectProfile)?['chrysanthemum']:FIREWORK_TYPES.filter(t=>t.id!=='chrysanthemum').map(t=>t.id))assert.throws(()=>getFireworkShowEnvelope({type,effectProfile}));
});
check('finite seeded moving-wind witnesses enclose every body and detached tail centre',()=>{
  let cases=0,bodyPoints=0,tailPoints=0;const maximumLife={};
  const winds=[{min:[0,0,0],max:[4.68,0,1.76],timeline:[{time:-Infinity,wind:[0,0,0]},{time:.1,wind:[4.68,0,1.76]},{time:1.3,wind:[.6552,0,.2464]},{time:3.9,wind:[1.9656,0,.7392]},{time:6.6,wind:[0,0,0]}]},
    {min:[-5,-1,-3],max:[4,1,6],timeline:[{time:-Infinity,wind:[-5,-1,6]},{time:.1,wind:[4,1,-3]},{time:1.7,wind:[-2,.5,2]},{time:4.4,wind:[0,-.3,1]},{time:8,wind:[4,1,-3]}]}];
  for(const effectProfile of candidates)for(const starDragModel of ['legacy','bounded-descent'])for(const elevation of [25,90])for(const spread of [0,15])for(const seed of [0,42])for(const wind of winds){
    const pivot=[29,.21,7],direction=axis(110,elevation),settings={type:'chrysanthemum',effectProfile,autoDirection:false,azimuth:110,elevation,launchSpreadDegrees:spread,burstTiltDegrees:45,burstRollDegrees:30,starDragModel};
    const envelope=getFireworkShowEnvelope({origin:pivot,muzzleOffsetMetres:.66,settings,wind:{min:wind.min,max:wind.max}}),sim=createFireworksSimulation({origin:pivot.map((v,c)=>v+.66*direction[c]),muzzleOffsetMetres:.66});sim.configure(settings);
    sim.launch({seed,burstOrientation:{yawDegrees:137,tiltDegrees:-61,rollDegrees:29}});const event=sim.active[0];assert.equal(event.effectProfile,effectProfile);assert.equal(event.heads.length,192);
    sampleFireworkEvent(event,event.burstTime,{windTimeline:wind.timeline,smoke:false});
    for(const body of [event.rocket,...event.heads]){
      if(body.kind!=='rocket'){assert.equal(body.ignitionDelay,0);assert(body.life<=FIREWORK_LAYER_PROFILE_LIMITS[effectProfile].maximumBodySeconds);maximumLife[effectProfile]=Math.max(maximumLife[effectProfile]??0,body.life);}
      const tailSeconds=body.kind==='rocket'?.50:.35;
      for(const fraction of [0,.25,.5,.75,1]){
        const born=body.birth+body.life*fraction,state=sampleBody(body,born,wind.timeline);inside(state.position,envelope,{effectProfile,starDragModel,elevation,spread,seed,body:body.id??'rocket',fraction});bodyPoints++;
        for(const lagFraction of [.5,1]){const ember={birth:born,position:state.position,velocity:state.velocity.map(v=>v*.25),drag:1.35,gravity:9.81};inside(sampleBody(ember,born+tailSeconds*lagFraction,wind.timeline).position,envelope,{effectProfile,seed,body:body.id??'rocket',lagFraction});tailPoints++;}
      }
    }cases++;
  }return{cases,bodyPoints,tailPoints,maximumLife,scope:'Bounded counterexample witnesses; the generator hard-contract and analytic interval argument provide coverage, not seed enumeration'};
});

check('modulo-three layer selection covers the globe with a measured uniformity caveat',()=>{
  const event=createFireworkEvent({type:'chrysanthemum',seed:42,burstOrientation:{yawDegrees:0,tiltDegrees:0,rollDegrees:0}}),base=event.baselineBurst.velocity;
  const unit=v=>{const n=Math.hypot(...v);return v.map(x=>x/n);},dot=(a,b)=>a[0]*b[0]+a[1]*b[1]+a[2]*b[2],angle=d=>Math.acos(Math.max(-1,Math.min(1,d)))*180/Math.PI;
  const sphere=(i,n)=>{const y=1-2*(i+.5)/n,a=i*2.399963229728653,r=Math.sqrt(1-y*y);return[r*Math.cos(a),y,r*Math.sin(a)];},probes=Array.from({length:4096},(_,i)=>sphere(i,4096));
  function quality(vectors){const octants=Array(8).fill(0);let minimumNearest=180,maximumGap=0;for(let i=0;i<vectors.length;i++){const v=vectors[i];octants[(v[0]>=0?1:0)|(v[1]>=0?2:0)|(v[2]>=0?4:0)]++;for(let j=0;j<i;j++)minimumNearest=Math.min(minimumNearest,angle(dot(v,vectors[j])));}for(const p of probes){let closest=-1;for(const v of vectors)closest=Math.max(closest,dot(p,v));maximumGap=Math.max(maximumGap,angle(closest));}return{count:vectors.length,octants,minimumNearestDegrees:minimumNearest,maximum4096ProbeGapDegrees:maximumGap};}
  const layers=[0,1,2].map(id=>quality(event.heads.filter(b=>b.id%3===id).map(b=>unit(b.baseVelocity.map((v,c)=>v-base[c]))))),reference=quality(Array.from({length:64},(_,i)=>sphere(i,64)));
  for(const layer of layers){assert.equal(layer.count,64);assert(layer.octants.every(n=>n>0));}
  return{seed:42,originalModuloLayers:layers,independent64FibonacciReference:reference,caveat:'Each modulo layer spans all octants, but stride3 changes azimuth step to52.523deg and worsens uniformity; this is a visual candidate review, not an envelope escape or a universal covering proof. No FW/physics directions changed by this task.'};
});

const source=fs.readFileSync(new URL('../firework-show-envelope.js',import.meta.url)),report={schema:'glass-atoll.r18-layer-profile-envelope-cpu.v1',actualGPU:false,passed:checks.every(c=>c.passed),passedCount:checks.filter(c=>c.passed).length,total:checks.length,checks,sourceSHA256:crypto.createHash('sha256').update(source).digest('hex'),legacySourceSHA256:crypto.createHash('sha256').update(oldSource).digest('hex')};
fs.writeFileSync(new URL('./r18-layer-profile-envelope-check.json',import.meta.url),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report,null,2));if(!report.passed)process.exitCode=1;
