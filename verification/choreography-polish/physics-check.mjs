import fs from 'node:fs';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import {performance} from 'node:perf_hooks';
import * as actual from '../../fireworks-physics.js';
const root=new URL('../../',import.meta.url),here=new URL('./',import.meta.url),sha=data=>crypto.createHash('sha256').update(data).digest('hex');
const read=name=>fs.readFileSync(new URL(name,root),'utf8'),bytes=name=>fs.readFileSync(new URL(name,root));
const absolute=source=>source.replace(/from (['"])(\.\/[^'"]+)\1/g,(_,q,path)=>`from '${new URL(path.slice(2),root).href}'`);
const load=source=>import('data:text/javascript;base64,'+Buffer.from(absolute(source)).toString('base64'));
const oldSource=read('verification/choreography-polish/before/fireworks-physics.js'),source=read('fireworks-physics.js');
const old=await load(oldSource),internal=await load(source+'\nexport {polishedPatternPoints,heartPointAtFraction,heartContour};\n');
const started=performance.now(),checks=[];
function check(name,fn){try{checks.push({name,passed:true,details:fn()??null});}catch(error){checks.push({name,passed:false,error:String(error.stack).replace(/data:text\/javascript;base64,[^\s)]+/g,'[source QA clone]')});}}
const timeline=[{time:-Infinity,wind:[1.8,0,-.7]},{time:6.1,wind:[-.3,.1,2.1]}];
const dot=(a,b)=>a.reduce((s,v,c)=>s+v*b[c],0),sumI=e=>e.heads.reduce((sum,b)=>sum+b.intensity,0);
const nativeIds=['peony','chrysanthemum','willow','palm','ring','heart','crossette','strobe','fan','bouquet'];
const otherIds=nativeIds.filter(id=>!['ring','heart'].includes(id));
check('Strict inverse recovers the complete CRLF physics source and only the eight declared edits',()=>{
 const changes=JSON.parse(read('verification/choreography-polish/physics-source-delta.json'));let restored=source.replaceAll('\r\n','\n');
 for(const {before,after} of [...changes].reverse()){assert.equal(restored.split(after).length-1,1);restored=restored.replace(after,before);}
 assert.equal(restored.replaceAll('\n','\r\n'),oldSource);assert.equal(source.replaceAll('\r\n','').includes('\n'),false);
 assert.deepEqual(actual.FIREWORK_TYPES.map(t=>t.id),old.FIREWORK_TYPES.map(t=>t.id));
 return{edits:changes.length,baselineSHA256:sha(Buffer.from(oldSource)),currentSHA256:sha(Buffer.from(source)),registryIds:actual.FIREWORK_TYPES.length};
});
check('Other eight native trajectories, bodies, rocket, schedules and event metadata remain exact',()=>{
 let events=0,poses=0;
 for(const type of otherIds)for(const seed of [1,42,341070])for(const starDragModel of ['legacy','bounded-descent']){
  const config={type,seed,starDragModel,time:2.25,elevation:67,azimuth:129,burstOrientation:{yawDegrees:7,tiltDegrees:19,rollDegrees:-12}};
  const a=actual.createFireworkEvent(config),b=old.createFireworkEvent(config);assert.deepEqual(a,b);
  for(const body of a.heads.filter((_,i)=>i%17===0))for(const age of [0,.17,body.life*.7,body.life]){assert.deepEqual(actual.sampleBody(body,body.birth+age,timeline),old.sampleBody(b.heads[body.id],body.birth+age,timeline));poses++;}
  events++;
 }
 return{events,poses,scope:'Scalar sustained emission is intentionally changed separately; these assertions cover trajectories and event construction.'};
});
check('Three diagnostic smiley layouts retain every original body, rocket and pose',()=>{
 let bodies=0;
 for(const smileyLayout of ['dense','spaced-mouth','compact-eyes'])for(const seed of [1,42,341070]){
  const config={type:'ring',smileyLayout,seed,starDragModel:'bounded-descent'},a=actual.createFireworkEvent(config),b=old.createFireworkEvent(config);
  assert.deepEqual(a.heads,b.heads);assert.deepEqual(a.rocket,b.rocket);assert.equal(a.actualStarCount,b.actualStarCount);
  for(const body of a.heads){assert.deepEqual(actual.sampleBody(body,body.birth+1.2,timeline),old.sampleBody(b.heads[body.id],body.birth+1.2,timeline));bodies++;}
 }
 return{bodies,registryCountMetadata:'ring definition.count intentionally now72; explicit diagnostic actualStarCount remains its old120/144'};
});
check('New contours are stratified, arclength sampled, seeded and within the unchanged speed/lifetime/intensity domains',()=>{
 let bodyCases=0,maxSpeed=0,minGap=Infinity,maxGap=0,maxDepth=0,minLife=Infinity,maxLife=0;const budgets=[];
 for(const type of ['ring','heart'])for(const seed of [0,1,42,341070,4294967295]){
  const expected=type==='ring'?72:64,event=actual.createFireworkEvent({type,seed,starDragModel:'bounded-descent'}),points=internal.polishedPatternPoints(type,seed);
  assert.equal(event.heads.length,expected);assert.equal(event.definition.count,expected);assert.equal(points.length,expected);
  assert.deepEqual(event,actual.createFireworkEvent({type,seed,starDragModel:'bounded-descent'}));
  assert.notDeepEqual(points,internal.polishedPatternPoints(type,(seed+1)>>>0));
  if(type==='ring')assert.deepEqual(Object.fromEntries(['outline','left-eye','right-eye','mouth'].map(part=>[part,points.filter(p=>p.part===part).length])),{outline:46,'left-eye':6,'right-eye':6,mouth:14});
  const contour=type==='ring'?points.filter(p=>p.part==='outline'):points,n=contour.length;
  for(let i=0;i<n;i++){
   const f=contour[i].fraction;assert.ok(f>(i+.31)/n&&f<(i+.69)/n);
   const gap=((contour[(i+1)%n].fraction+(i===n-1?1:0))-f)*n;assert.ok(gap>=.64&&gap<=1.36);minGap=Math.min(minGap,gap);maxGap=Math.max(maxGap,gap);
   if(type==='heart'){const p=internal.heartPointAtFraction(f),radial=contour[i].x/p.x;assert.ok(radial>=.99&&radial<=1.01);assert.ok(Math.abs(contour[i].y-p.y*radial)<1e-14);}
  }
  for(const body of event.heads){const relative=body.baseVelocity.map((v,c)=>v-event.baselineBurst.velocity[c]),speed=Math.hypot(...relative),depth=Math.abs(dot(relative,event.patternFrame.normal));
   maxSpeed=Math.max(maxSpeed,speed);maxDepth=Math.max(maxDepth,depth);assert.ok(speed<=(type==='ring'?21:33));assert.ok(depth<=.210000000001);
   assert.ok(body.life>=event.definition.burn*.88&&body.life<=event.definition.burn*1.11);assert.ok(body.intensity>=5&&body.intensity<10);
   minLife=Math.min(minLife,body.life/event.definition.burn);maxLife=Math.max(maxLife,body.life/event.definition.burn);bodyCases++;
  }
  budgets.push({type,seed,oldHeadCount:old.createFireworkEvent({type,seed}).heads.length,newHeadCount:event.heads.length,oldPeakReferenceSum:sumI(old.createFireworkEvent({type,seed})),newPeakReferenceSum:sumI(event)});
 }
 return{bodyCases,maxSpeed,maxDepth,minLifeFraction:minLife,maxLifeFraction:maxLife,minStratumGap:minGap,maxStratumGap:maxGap,polylineEdges:internal.heartContour.points.length-1,budgets,scope:'Authored finite-polyline arclength; heart radial jitter±1%; ring .985..999 keeps sqrt(.999^2+.01^2)*21<21; local depth±.01 contour units. No brightness compensation for fewer points.'};
});
check('Per-frame queries and user optical gain cannot regenerate or reorder contour randomness',()=>{
 let comparisons=0;
 for(const type of ['ring','heart']){
  const config={type,seed:341070,starDragModel:'bounded-descent',burstOrientation:{yawDegrees:18,tiltDegrees:23,rollDegrees:-11}},a=actual.createFireworkEvent(config),b=actual.createFireworkEvent(config);
  const original=structuredClone(a.heads),ages=[0,.03,.7,1.7,2.5,4];
  const expected=ages.map(age=>actual.sampleFireworkEvent(a,a.burstTime+age,{windTimeline:timeline,smoke:false}));
  for(const age of [...ages].reverse())actual.sampleFireworkEvent(b,b.burstTime+age,{windTimeline:timeline,smoke:false});
  ages.forEach((age,i)=>{assert.deepEqual(actual.sampleFireworkEvent(b,b.burstTime+age,{windTimeline:timeline,smoke:false}),expected[i]);comparisons++;});
  const final=actual.createFireworkEvent(config);assert.deepEqual(final.heads,original);
  for(const intensityScale of [0,1,64]){const scaled=actual.createFireworkEvent({...config,intensityScale});
   for(let i=0;i<a.heads.length;i++){const x=scaled.heads[i],y=original[i];for(const key of ['velocity','position','life','seed','radius','baseVelocity','basePosition'])assert.deepEqual(x[key],y[key]);assert.equal(x.intensity,y.intensity*intensityScale);}
  }
 }
 return{queryComparisons:comparisons,opticalScales:[0,1,64],perFrameRandomCalls:0};
});
check('Sustained scalar fade starts earlier, stays bounded and has a zero-slope extinction without extending life',()=>{
 const report=[];let sampleCount=0;
 for(const life of [.78,2.8,3.6,6.2,11.8]){
  const body={kind:'star',life,colour:actual.EMISSION_PROFILES.red,intensity:8};let previous=Infinity;
  for(let i=0;i<=1000;i++){const age=.028+(life-.028)*i/1000,value=actual.starEnvelope(body,age);assert.ok(value>=0&&value<=1);assert.ok(value<=previous+1e-15);previous=value;sampleCount++;}
  assert.equal(actual.starEnvelope(body,-1),0);assert.equal(actual.starEnvelope(body,life),0);assert.equal(actual.starEnvelope(body,life+1),0);
  assert.ok(actual.starEnvelope(body,.7*life)<old.starEnvelope(body,.7*life));
  const h=life*1e-5,v1=actual.starEnvelope(body,life-h),v2=actual.starEnvelope(body,life-h*.5),slope=v1/h;
  assert.ok(v2/v1<.251);assert.ok(slope<.0001);
  report.push({life,at70PercentOld:old.starEnvelope(body,.7*life),at70PercentNew:actual.starEnvelope(body,.7*life),lastStepEnvelope:v1,oneSidedSlopeEstimate:slope});
 }
 return{sampleCount,report,fadeStartsAtLifeFraction:.45,fadeShape:'cubic smoothstep times unchanged positive exponential decay; C1 terminal zero, unnormalized'};
});
check('Strobe complete pulse envelope, rocket envelope and experimental burn profiles remain exact',()=>{
 let strobeSamples=0,rocketSamples=0,profileSamples=0;
 for(const seed of [1,42]){
  const event=actual.createFireworkEvent({type:'strobe',seed}),baseline=old.createFireworkEvent({type:'strobe',seed});
  for(let j=0;j<event.heads.length;j++)for(let i=0;i<=30;i++){const age=event.heads[j].life*i/30;assert.ok(Object.is(actual.starEnvelope(event.heads[j],age),old.starEnvelope(baseline.heads[j],age)));strobeSamples++;}
  for(let i=0;i<=200;i++){const age=event.rocket.life*i/200;assert.ok(Object.is(actual.bodyEmissionEnvelope(event.rocket,age),old.bodyEmissionEnvelope(baseline.rocket,age)));rocketSamples++;}
 }
 for(const effectProfile of ['three-heart-v1','two-colour-v1','powered-bees-v1','three-heart-scale120-v1','three-heart-radiant120-v1'])for(const intensityScale of [0,1,64]){
  const config={type:'chrysanthemum',seed:42,effectProfile,starDragModel:'bounded-descent',intensityScale},a=actual.createFireworkEvent(config),b=old.createFireworkEvent(config);assert.deepEqual(a,b);
  for(const body of a.heads)if(body.burnProfile)for(const age of [0,.03,.7,1.7,2.5,body.life]){assert.deepEqual(actual.sampleBodyEmission(body,age),old.sampleBodyEmission(b.heads[body.id],age));profileSamples++;}
 }
 return{strobeSamples,rocketSamples,profileSamples,poweredNative160:'Their unprofiled sustained scalar fade is intentionally covered by the new ordinary fade; all compiled body/profile metadata remains exact.'};
});
const report={schema:'glass-atoll.choreography-polish.physics-check.v1',passed:checks.every(c=>c.passed),summary:`${checks.filter(c=>c.passed).length}/${checks.length}`,actualGPU:false,sourceSHA256:sha(bytes('fireworks-physics.js')),baselineSHA256:sha(bytes('verification/choreography-polish/before/fireworks-physics.js')),elapsedMilliseconds:performance.now()-started,checks};
fs.writeFileSync(new URL('physics-check.json',here),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({passed:report.passed,summary:report.summary,elapsedMilliseconds:report.elapsedMilliseconds,failures:checks.filter(c=>!c.passed)},null,2));if(!report.passed)process.exitCode=1;
