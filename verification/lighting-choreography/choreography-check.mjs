import fs from 'node:fs';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import {createFireworkEvent,sampleBody,seededRandom,flightSegment} from '../../fireworks-physics.js';
import {COMPLEX_FIREWORK_TYPES,COMPLEX_TYPE_LIMITS} from '../../complex-fireworks.js';
import {sampleComplexEnvelope,createComplexStyle,sampleComplexTailStyle} from '../../complex-fireworks-style.js';
import {sampleDisplayCoast,displayAirborneBurnLimit} from '../../complex-fireworks-motion.js';
import {getFireworkShowEnvelope} from '../../firework-show-envelope.js';
import * as before from './before/complex-fireworks.js';
import * as oldStyle from './before/complex-fireworks-style.js';
import {factory,THREE,read} from '../r38-fw-cpu-fixture.mjs';

const root=new URL('../../',import.meta.url),checks=[],near=(a,b,epsilon=1e-9)=>assert(Math.abs(a-b)<=epsilon,`${a} vs ${b}`),wind=[{time:-Infinity,wind:[5,0,-5]}];
const make=(type,extra={})=>createFireworkEvent({type,seed:619,origin:[0,1,0],azimuth:0,elevation:80,starDragModel:'bounded-descent',...extra});
function previous(type,e){return before.buildComplexFirework(type,{eventId:e.id,origin:e.origin,time:e.time,burstTime:e.burstTime,burstState:e.baselineBurst,basis:{right:[1,0,0],up:[0,1,0],normal:[0,0,-1]},rotateBurst:v=>v,rng:seededRandom(619),seed:619,rocket:{}});}
function test(name,fn){try{checks.push({name,passed:true,evidence:fn()});}catch(error){checks.push({name,passed:false,error:String(error.stack||error)});}}

test('128-shot sweep keeps the same directions and four cycles at a 1.5x faster cadence',()=>{
  const e=make('display-vfan'),old=previous(e.type,e),angles=e.heads.map(b=>Math.atan2(b.velocity[0],b.velocity[1])*180/Math.PI),steps=angles.slice(1).map((v,i)=>v-angles[i]);
  assert.equal(e.heads.length,128);assert.equal(new Set(e.heads.map(b=>b.birth)).size,128);let crossings=0;
  e.heads.forEach((b,i)=>{near(b.birth-e.time,i*.1);near(b.life,4.1);assert.deepEqual(b.velocity,old.heads[i].velocity);near(b.intensity,old.heads[i].intensity);near(b.sourceStyle.tailSeconds,1.05);if(i&&angles[i]*angles[i-1]<0)crossings++;});
  assert.equal(crossings,8);assert(Math.max(...steps.map(Math.abs))<8.5);near(e.heads.at(-1).birth-e.time,12.7);near(old.heads.at(-1).birth-e.time,19.05);
  let active=0,oldActive=0;for(let i=0;i<600;i++){const t=(i+.5)*.05;active=Math.max(active,e.heads.filter(b=>t>=b.birth&&t<b.birth+b.life).length);oldActive=Math.max(oldActive,old.heads.filter(b=>t>=b.birth&&t<b.birth+b.life).length);}assert.equal(active,41);assert.equal(oldActive,24);
  return{shots:128,centreCrossings:crossings,roundTripSeconds:12.7/4,previousRoundTripSeconds:19.05/4,maximumAdjacentDegrees:Math.max(...steps.map(Math.abs)),maximumSimultaneousHeads:active,previousMaximumSimultaneousHeads:oldActive};
});

test('sustained named styles retain useful middle and late emission with monotone finite cooling',()=>{
  const rows=[];for(const profile of ['sustained-comet-v1','waterfall-filament-v1'])for(const life of [2.3,4.1,8.1]){
    const style=createComplexStyle({life,tailProfile:profile,tailSeconds:profile==='waterfall-filament-v1'?2.2:1.2}),body={sourceStyle:style,intensity:4},peak=style.envelopeKnots.find(k=>k.value===1).age;let last=1;
    for(let i=0;i<=4096;i++){const v=sampleComplexEnvelope(body,peak+(life-peak)*i/4096);assert(Number.isFinite(v)&&v>=0&&v<=last+1e-14);last=v;}
    near(sampleComplexEnvelope(body,.74*life),.11);near(sampleComplexEnvelope(body,.84*life),.014);assert.equal(sampleComplexEnvelope(body,life),0);
    for(let i=1;i<style.envelopeKnots.length;i++){const k=style.envelopeKnots[i],span=Math.min(k.age-style.envelopeKnots[i-1].age,(style.envelopeKnots[i+1]?.age??(2*k.age-style.envelopeKnots[i-1].age))-k.age),h=span*1e-6,v=sampleComplexEnvelope(body,k.age);assert(Math.abs(v-sampleComplexEnvelope(body,k.age-h))/h*span<1e-5);assert(Math.abs(sampleComplexEnvelope(body,k.age+h)-v)/h*span<1e-5);}
    rows.push({profile,life,at74Percent:sampleComplexEnvelope(body,.74*life),at84Percent:sampleComplexEnvelope(body,.84*life)});
  }return{rows,peakUnchanged:1,sourceI0Unchanged:true,scope:'Brighter middle/late emission intentionally increases light integral; it is not energy-normalized.'};
});

test('legacy unnamed styles and their sampled envelopes remain exact while profile admission stays bounded',()=>{
  let samples=0;for(const life of [.075,1,4.1,8.1])for(const tailSeconds of [0,.35,.88]){
    const args={life,tailSeconds,pulseHz:2.3,pulsePhase:.2},a=oldStyle.createComplexStyle(args),b=createComplexStyle(args);assert.deepEqual(a,b);
    for(let i=0;i<=256;i++){const age=life*i/256;assert(Object.is(oldStyle.sampleComplexEnvelope({sourceStyle:a},age),sampleComplexEnvelope({sourceStyle:b},age)));samples++;}
  }
  for(const args of [{life:4,tailSeconds:.880001},{life:4,tailSeconds:1.200001,tailProfile:'sustained-comet-v1'},{life:8,tailSeconds:2.200001,tailProfile:'waterfall-filament-v1'},{life:8,tailSeconds:1,tailProfile:'unknown'}])assert.throws(()=>createComplexStyle(args));
  return{legacyStyles:12,samples,defaultTailCap:.88,sustainedTailCap:1.2,waterfallTailCap:2.2};
});

test('waterfall high launch has a horizontal carrier, longer fall, full 2.2-second released tails and unchanged source budget',()=>{
  const e=make('display-waterfall'),old=previous(e.type,e),carrier=e.heads[0],children=e.heads.slice(1),start=sampleBody(carrier,carrier.birth),end=sampleBody(carrier,carrier.birth+carrier.life);
  assert.equal(e.heads.length,193);assert.equal(children.length,192);near(Math.hypot(carrier.velocity[0]-e.baselineBurst.velocity[0],carrier.velocity[2]-e.baselineBurst.velocity[2]),75);near(carrier.velocity[1]-e.baselineBurst.velocity[1],14);assert(Math.abs(end.position[1]-start.position[1])<20);
  let minDrop=Infinity,maxDrop=0;for(const b of children){assert.equal(b.parentBody,carrier);assert.equal(b.parentVelocityFraction,.25);assert(b.life>=7.6&&b.life<=8.1);assert.equal(b.drag,.45);assert(b.radius>=.004&&b.radius<=.006&&b.intensity>=3.2&&b.intensity<=5);const born=sampleBody(b,b.birth),late=sampleBody(b,b.birth+.93*b.life);minDrop=Math.min(minDrop,born.position[1]-late.position[1]);maxDrop=Math.max(maxDrop,born.position[1]-late.position[1]);if(b.sourceStyle.tailFraction>0){assert.equal(b.sourceStyle.tailProfile,'waterfall-filament-v1');assert.equal(b.sourceStyle.tailSeconds,2.2);}assert.equal(sampleComplexEnvelope(b,b.life*.74),.11);}
  assert(minDrop>110);assert(maxDrop>130);assert.equal(e.heads.filter(b=>b.sourceStyle.tailFraction>0).length,192);assert(old.heads.slice(1).every(b=>b.life<6.1));
  return{carrierHorizontalMetres:Math.hypot(end.position[0]-start.position[0],end.position[2]-start.position[2]),currentLife:[Math.min(...children.map(b=>b.life)),Math.max(...children.map(b=>b.life))],previousLife:[Math.min(...old.heads.slice(1).map(b=>b.life)),Math.max(...old.heads.slice(1).map(b=>b.life))],dropAt93PercentMetres:[minDrop,maxDrop],tailCarrierCount:192,maxTailSeconds:2.2};
});

test('analytic coast matches production motion and its airborne cap encloses all source and full-lag tail ages',()=>{
  let trajectories=0,poses=0,minimumBodyY=Infinity,minimumTailY=Infinity,cappedBodies=0;const observed=[];
  for(const elevation of [25,40,60,80,90])for(const tiltDegrees of [-45,0,45])for(const rollDegrees of [-30,0,30])for(const seed of [0,619]){
    const e=make('display-waterfall',{elevation,seed,burstOrientation:{tiltDegrees,rollDegrees}});let minimumLife=Infinity;
    for(const b of e.heads.slice(1)){
      const born=sampleBody(b,b.birth,wind),parent=sampleBody(e.heads[0],b.birth,wind);assert(born.position.every((v,c)=>Math.abs(v-parent.position[c])<1e-8));minimumLife=Math.min(minimumLife,b.life);if(b.life<7.6)cappedBodies++;
      const initialVelocity=parent.velocity.map((v,c)=>v*.25+b.velocityDelta[c]);
      const coast=sampleDisplayCoast(born.position,initialVelocity,b.life,b.drag),direct=sampleBody(b,b.birth+b.life,wind);near(coast.position[1],direct.position[1],1e-8);
      for(const fraction of [0,.5,.74,.93,1]){const p=sampleBody(b,b.birth+b.life*fraction,wind);minimumBodyY=Math.min(minimumBodyY,p.position[1]);assert(p.position[1]>=1.03-1e-8);
        for(const q of [0,.25,.5,.75,1]){const lag=b.sourceStyle.tailSeconds*q,tail=flightSegment(p.position,p.velocity.map(v=>v*.25),lag,1.35,[5,0,-5],9.81);minimumTailY=Math.min(minimumTailY,tail.position[1]);assert(tail.position[1]>=1.03-1e-8);poses++;}
      }trajectories++;
    }
    if(seed===619&&tiltDegrees===0&&rollDegrees===0)observed.push({elevation,minimumLife});
  }
  assert(cappedBodies>0);assert(minimumTailY<1.04);assert.throws(()=>displayAirborneBurnLimit({position:[0,0,0],velocity:[0,-1,0],requestedLife:8,tailSeconds:2.2}));
  return{events:90,trajectories,poses,minimumBodyY,minimumTailY,cappedBodies,observed,proof:'Vertical velocity is bounded below by min(initialVy,-g/k). Each source y has at most one interior maximum; reserve worst detached-tail drop for the full lag. Covers zero vertical wind, including arbitrary horizontal wind.'};
});

test('published physical envelopes contain current bodies and released tails at launch-angle and wind extremes',()=>{
  let positions=0;const summaries=[];
  for(const def of COMPLEX_FIREWORK_TYPES){const type=def.id,tailExpected=type==='display-waterfall'?2.2:1.2;let maxBodyHorizon=0,maxTail=0;
    for(const elevation of [25,80,90])for(const seed of [0,619]){
      const e=make(type,{elevation,seed,azimuth:104,burstOrientation:{tiltDegrees:45,rollDegrees:30}}),bound=getFireworkShowEnvelope({type,elevation,azimuth:104,origin:e.origin,launchSpreadDegrees:0,wind:{min:[-5,0,-5],max:[5,0,5]}});
      assert.equal(bound.limits.tailSeconds,tailExpected);assert.equal(COMPLEX_TYPE_LIMITS[type].tailDurationSeconds,tailExpected);
      for(const b of e.heads){maxBodyHorizon=Math.max(maxBodyHorizon,b.birth-e.burstTime+b.life);maxTail=Math.max(maxTail,b.sourceStyle.tailSeconds);assert(b.birth-e.burstTime+b.life<=COMPLEX_TYPE_LIMITS[type].maximumBodySeconds+COMPLEX_TYPE_LIMITS[type].maximumBirthDelaySeconds+1e-9);
        for(const f of [0,.25,.5,.75,1]){const state=sampleBody(b,b.birth+b.life*f,wind);for(const lag of [0,b.sourceStyle.tailSeconds]){const p=lag?flightSegment(state.position,state.velocity.map(v=>v*.25),lag,1.35,[5,0,-5],9.81).position:state.position;if(p[1]<.03)continue;for(let c=0;c<3;c++)assert(p[c]>=bound.min[c]-1e-8&&p[c]<=bound.max[c]+1e-8,`${type} axis${c} escaped envelope`);positions++;}}
      }
    }assert(maxTail<=tailExpected);summaries.push({type,maximumObservedBodyHorizon:maxBodyHorizon,maximumActualTailSeconds:maxTail,declaredTailSeconds:tailExpected});
  }return{positions,summaries,scope:'Finite independent counterexample search supplements unchanged analytic envelope formulas and updated generator limits.'};
});

test('all complex event lifetimes retain complete actual tail support and smoke horizons',()=>{
  const rows=[];for(const def of COMPLEX_FIREWORK_TYPES){const e=make(def.id),maximumTailEnd=Math.max(...e.heads.map(b=>b.birth+b.life+b.sourceStyle.tailSeconds));assert(e.endTime>=maximumTailEnd+.1-1e-9);assert(e.heads.length<=COMPLEX_TYPE_LIMITS[e.type].maximumHeads);assert(e.heads.filter(b=>b.sourceStyle.tailFraction>0).length<=192);rows.push({type:e.type,bodyCount:e.heads.length,eventEndAfterBurst:e.endTime-e.burstTime,tailEndAfterBurst:maximumTailEnd-e.burstTime,retentionMargin:e.endTime-maximumTailEnd});}return rows;
});

test('primary and child flash source lifetimes are brief while peak intensity and anchored identity remain',()=>{
  const rows=[];for(const type of ['display-flower','display-double','display-brocade']){const e=make(type),old=previous(type,e);assert.equal(e.opticalFlashes.length,old.opticalFlashes.length);for(let i=0;i<e.opticalFlashes.length;i++){const b=e.opticalFlashes[i],p=old.opticalFlashes[i];near(b.life,.075);near(b.radius,.04);near(b.intensity,p.intensity);assert.equal(b.birth,p.birth);assert.equal(b.matter,false);assert.equal(b.sourceStyle.tailSeconds,0);assert.equal(b.sourceStyle.envelopeInterpolation,'linear');near(sampleComplexEnvelope(b,.004),1);near(sampleComplexEnvelope(b,.016),.42);near(sampleComplexEnvelope(b,.04),.08);assert.equal(sampleComplexEnvelope(b,.075),0);}rows.push({type,count:e.opticalFlashes.length,lifeSeconds:.075,radiusMetres:.04,peakReferenceIntensity:e.opticalFlashes.map(b=>b.intensity)});}return{rows,scope:'Source contract only; tiny direct display share and environment-light routing are verified by the root optical work.'};
});

const create=await factory(read('fireworks.js'));
test('actual CPU factory keeps the silver curtain after the former prune time and emits extended vertical tails',()=>{
  const fw=create(THREE,{sourceVisibility:'none'});fw.setQuality({trailSegments:8});fw.configure({type:'display-waterfall',autoLaunch:false,autoDirection:false,elevation:80,launchSpreadDegrees:0,burstTiltDegrees:0,burstRollDegrees:0});
  try{const launch=fw.launch({type:'display-waterfall',seed:619}),event=fw.r38State().active.find(e=>e.id===launch.id);assert(event);const oldPrune=Math.max(...event.heads.map(b=>b.birth+b.life))+.95;
    fw.update({time:event.burstTime+8.5,windVector:[0,0,0]});const rows=fw.r38Rows(0).filter(r=>r.sourceRole==='complex-tail'&&r.sourceBody.patternPart==='waterfall-ember');assert(rows.length>0);const visible=rows.filter(r=>r.intensity>r.sourceBody.intensity*.001);assert(visible.length>100);const byBody=new Map();for(const r of visible){const ys=byBody.get(r.sourceBody.id)??[];ys.push(r.position[1]);byBody.set(r.sourceBody.id,ys);}const spans=[...byBody.values()].filter(a=>a.length>1).map(a=>Math.max(...a)-Math.min(...a));assert(Math.max(...spans)>15);
    fw.update({time:oldPrune+.2,windVector:[0,0,0]});assert(fw.r38State().active.some(e=>e.id===launch.id));const lateRows=fw.r38Rows(0).filter(r=>r.sourceRole==='complex-tail'&&r.sourceBody.patternPart==='waterfall-ember'&&r.intensity>0);assert(lateRows.length>0);
    return{actualTailRecords:rows.length,recordsAboveOneThousandthSourceI0:visible.length,maximumVisibleBodyTailSpanMetres:Math.max(...spans),oldPruneAfterBurst:oldPrune-event.burstTime,lateQueryAfterBurst:oldPrune+.2-event.burstTime,latePositiveTailRecords:lateRows.length,contextCalls:0};
  }finally{fw.dispose();}
});

const paths=['complex-fireworks.js','complex-fireworks-style.js','complex-fireworks-motion.js','fireworks-physics.js','firework-show-envelope.js','fireworks.js'];
const sha=p=>crypto.createHash('sha256').update(fs.readFileSync(new URL(p,root))).digest('hex');
const report={schema:'glass-atoll.lighting-choreography.choreography-check.v1',passed:checks.every(c=>c.passed),summary:{passed:checks.filter(c=>c.passed).length,total:checks.length},sourceSHA256:Object.fromEntries(paths.map(p=>[p,sha(p)])),beforeSHA256:Object.fromEntries(paths.slice(0,3).map(p=>[p,sha('verification/lighting-choreography/before/'+p)])),checks,scope:'CPU construction, analytic vertical clearance, declared physical bounds, source envelopes, and actual renderer records. No browser, GPU, frame-rate or subjective final appearance claim.'};
fs.writeFileSync(new URL('./choreography-check.json',import.meta.url),JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({passed:report.passed,summary:report.summary,failed:checks.filter(c=>!c.passed).map(({name,error})=>({name,error}))}));if(!report.passed)process.exitCode=1;
