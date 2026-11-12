import fs from 'node:fs';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import {createFireworkEvent,sampleBody,bodyMotorAcceleration,bodyMotorMotionBound} from '../../fireworks-physics.js';
import {createTailReleaseFieldNode,sampleTailReleaseFieldNode} from '../../firework-tail-field.js';
import {createFireworkContactSupport} from '../../firework-contact-support.js';
import {resolveFireworkExposure} from '../../firework-exposure-window.js';
const root=new URL('../../',import.meta.url),read=file=>fs.readFileSync(new URL(file,root),'utf8'),sha=data=>crypto.createHash('sha256').update(data).digest('hex'),results=[];
function check(name,fn){try{results.push({name,passed:true,details:fn()??null});}catch(error){results.push({name,passed:false,error:String(error.stack).replace(/data:text\/javascript;base64,[^\s)]+/g,'[actual source QA clone]')});}}
const contactSource=read('firework-contact-support.js'),tailSource=read('firework-tail-field.js');
const absolute=source=>source.replace(/from (['"])(\.\/[^'"]+)\1/g,(_,quote,path)=>`from '${new URL(path.slice(2),root).href}'`);
const load=source=>import('data:text/javascript;base64,'+Buffer.from(absolute(source)).toString('base64'));
const baselineContact=await load(read('verification/complex-fireworks/motor-contact-before/firework-contact-support.js'));
const baselineTail=await load(read('verification/complex-fireworks/motor-contact-before/firework-tail-field.js'));
const helpers=contactSource.replace("import {resolveBoundedAirSupport,resolvePlaneAirSupport} from './firework-air-support.js';",`import {resolveBoundedAirSupport as rawBounded,resolvePlaneAirSupport as rawPlane} from './firework-air-support.js';\nexport const capturedPartitions=[];const resolveBoundedAirSupport=options=>{capturedPartitions.push([...options.partitionTimes]);return rawBounded(options);},resolvePlaneAirSupport=options=>rawPlane(options);`).replace('return Object.freeze({begin,isAboveSurface,resolve,sampleAt,','return Object.freeze({__qaSourceSpeed:sourceSpeed,__qaNodeSpeed:nodeSpeed,begin,isAboveSurface,resolve,sampleAt,');
assert.notEqual(helpers,contactSource);const traced=await load(helpers);
const windAt=(timeline,t)=>{let value=[0,0,0];for(const knot of timeline)if(knot.time<=t)value=knot.wind;return value;};
const timelineFor=(body,now)=>[{time:-Infinity,wind:[1.7,.15,-.8]},...([{time:body.birth+.13,wind:[-2.4,.3,1.1]},{time:body.birth+.42,wind:[3,-.1,-.9]}].filter(knot=>knot.time<=now))];
const plane=height=>Object.freeze({schema:'qa.declared-static-plane',minimumHeight:height,maximumHeight:height,maximumSpatialSlope:0,maximumTimeRate:0,clearanceMetres:.03,heightAt:()=>height,boundAtHorizontalRegion:()=>({minimumHeight:height,maximumHeight:height,maximumSpatialSlope:0,maximumTimeRate:0,heightErrorMetres:0,certifiedSeaOnly:true,planeHeight:height})});
const exposure=(now,S)=>resolveFireworkExposure({physicalNow:now,shutterSeconds:S});
const events=['display-helix','display-vortex'].flatMap(type=>[42,341070].map(seed=>createFireworkEvent({type,seed,elevation:78,starDragModel:'bounded-descent'})));
const motors=events.flatMap(event=>[event.rocket,...event.heads].filter(body=>body.displayMotor));assert.ok(motors.length);
check('Only declared display-motor paths changed; old metadata and operation branches remain in the source',()=>{
 let old=read('verification/complex-fireworks/motor-contact-before/firework-contact-support.js');
 old=old.replace('    if(body.thrustProfile){const motor=','    if(body.thrustProfile||body.displayMotor){const motor=').replace('const motorA=body.thrustProfile?bodyMotorMotionBound','const motorA=body.thrustProfile||body.displayMotor?bodyMotorMotionBound').replace('if(!field(node)&&!node.thrustProfile&&region.certifiedSeaOnly','if(!field(node)&&!node.thrustProfile&&!node.displayMotor&&region.certifiedSeaOnly').replace('}knots.sort((a,b)=>a-b);','}if(source.displayMotor)for(const cell of source.displayMotor.cells)for(const age of [cell.from,cell.to]){const t=source.birth+age+(field(node)?node.lagSeconds:0);if(t>from&&t<to)knots.push(t);}knots.sort((a,b)=>a-b);');
 assert.equal(old,contactSource);
 old=read('verification/complex-fireworks/motor-contact-before/firework-tail-field.js');old=old.replace("import {sampleBody} from './fireworks-physics.js';","import {sampleBody} from './fireworks-physics.js';\r\nimport {bodyMotorAcceleration} from './fireworks-physics.js';").replace('  const velocity=source.velocity.map((v,c)=>{','  const motorAcceleration=body.displayMotor?bodyMotorAcceleration(body,releaseTime):source.motorAcceleration;\r\n  const velocity=source.velocity.map((v,c)=>{').replace('acceleration=source.motorAcceleration?passiveAcceleration+source.motorAcceleration[c]:passiveAcceleration;','acceleration=motorAcceleration?passiveAcceleration+motorAcceleration[c]:passiveAcceleration;').replace("limits:body.thrustProfile?'linear-drag/gravity plus admitted prescribed motor acceleration;","limits:body.displayMotor?'linear-drag/gravity plus finite authored display-motor acceleration; held-wind/force one-sided derivative; no ground termination interval':body.thrustProfile?'linear-drag/gravity plus admitted prescribed motor acceleration;");assert.equal(old,tailSource);
 assert.equal(contactSource.includes('\r\n'),false);assert.equal(tailSource.replaceAll('\r\n','').includes('\n'),false);
 return {strictFullSourceTransforms:2,unchangedUnknownMotorRejection:contactSource.includes("if(body.motorProfile)throw new RangeError('Unknown motor profile")};
});
check('Actual helix/vortex motor body speed and displacement samples are enclosed by the analytical adapter bounds',()=>{
 let samples=0,maxSpeedRatio=0,maxPositionRatio=0;
 for(const body of motors)for(const age of [.001,.2,body.displayMotor.endAge*.5,body.displayMotor.endAge,body.displayMotor.endAge+.2,Math.max(body.life??0,body.displayMotor.endAge)+.88]){
  const now=body.birth+age,timeline=timelineFor(body,now),adapter=traced.createFireworkContactSupport(plane(0));adapter.begin({physicalNow:now,windTimeline:timeline});const M=adapter.__qaSourceSpeed(body),bound=bodyMotorMotionBound(body,now),passive={...body};delete passive.displayMotor;
  for(let i=0;i<=12;i++){const t=body.birth+age*i/12,actual=sampleBody(body,t,timeline),base=sampleBody(passive,t,timeline),delta=Math.hypot(...actual.position.map((v,c)=>v-base.position[c]));
   assert.ok(delta<=bound.maximumPositionDeltaMetres+1e-8);maxPositionRatio=Math.max(maxPositionRatio,delta/bound.maximumPositionDeltaMetres);
   for(let c=0;c<3;c++){assert.ok(Math.abs(actual.velocity[c])<=M[c]);maxSpeedRatio=Math.max(maxSpeedRatio,Math.abs(actual.velocity[c])/M[c]);}samples++;
  }
 }
 return {motorBodies:motors.length,samples,maxSpeedRatio,maxPositionRatio,scope:'Finite sampled witness supplements closed positive-convolution + integrated-acceleration bounds; no sampled-grid certification claim.'};
});
check('Fixed-lag display field uses the current prescribed acceleration and differs from detached ember velocity',()=>{
 let cases=0,maxDerivativeError=0,maxSpeedRatio=0,minVelocityDifference=Infinity;
 const selected=motors.filter((body,index)=>index%13===0);
 for(const body of selected)for(const lag of [.00625,.31,.88])for(const age of [.271,1.137,body.displayMotor.endAge+.173]){
  const time=body.birth+lag+age,timeline=timelineFor(body,time),node=createTailReleaseFieldNode(body,lag),actual=sampleTailReleaseFieldNode(node,time,timeline),release=sampleBody(body,time-lag,timeline),A=bodyMotorAcceleration(body,time-lag),wind=windAt(timeline,time-lag),k=body.drag??.2,g=body.gravity??9.81;
  const ember=sampleBody({birth:time-lag,position:release.position,velocity:release.velocity.map(v=>v*.25),drag:1.35,gravity:9.81},time,timeline);
  for(let c=0;c<3;c++){const a=(k<1e-8?0:k*(wind[c]-release.velocity[c]))-(c===1?g:0)+A[c],windV=ember.velocity[c]-.25*release.velocity[c]*node.decay+(c===1?9.81*node.travel:0),expected=release.velocity[c]+.25*a*node.travel+windV-(1-node.decay)*wind[c];assert.equal(actual.velocity[c],expected);assert.equal(actual.position[c],ember.position[c]);}
  const nearestForce=Math.min(...body.displayMotor.cells.flatMap(cell=>[Math.abs(age-cell.from),Math.abs(age-cell.to)])),nearestWind=Math.min(...timeline.filter(knot=>Number.isFinite(knot.time)).flatMap(knot=>[Math.abs(time-knot.time),Math.abs(time-lag-knot.time)]));
  if(nearestForce>1e-3&&nearestWind>1e-3){const h=1e-4,p=[-2,-1,1,2].map(offset=>sampleTailReleaseFieldNode(node,time+offset*h,timeline).position);for(let c=0;c<3;c++){const numerical=(p[0][c]-8*p[1][c]+8*p[2][c]-p[3][c])/(12*h),error=Math.abs(actual.velocity[c]-numerical);maxDerivativeError=Math.max(maxDerivativeError,error);assert.ok(error<2e-5);}}
  const adapter=traced.createFireworkContactSupport(plane(0));adapter.begin({physicalNow:time,windTimeline:timeline});const M=adapter.__qaNodeSpeed(node);for(let i=0;i<=10;i++){const t=node.birth+(time-node.birth)*i/10,q=sampleTailReleaseFieldNode(node,t,timeline);for(let c=0;c<3;c++){assert.ok(Math.abs(q.velocity[c])<=M[c]);maxSpeedRatio=Math.max(maxSpeedRatio,Math.abs(q.velocity[c])/M[c]);}}
  minVelocityDifference=Math.min(minVelocityDifference,Math.hypot(...actual.velocity.map((v,c)=>v-ember.velocity[c])));assert.match(actual.limits,/display-motor acceleration/);assert.equal(actual.releaseTime<=time,true);cases++;
 }
 assert.ok(minVelocityDifference>0);return{selectedBodies:selected.length,cases,maxDerivativeError,maxSpeedRatio,minVelocityDifference};
});
check('Motor cell endpoints and cutoff use right-hand force; tail derivative shifts exactly by its fixed lag',()=>{
 const body=motors[1],lag=.31,node=createTailReleaseFieldNode(body,lag),times=[body.displayMotor.cells[3].to,body.displayMotor.endAge];let cases=0;
 for(const age of times){const time=body.birth+lag+age,timeline=[{time:-Infinity,wind:[1,.2,-.5]}],q=sampleTailReleaseFieldNode(node,time,timeline),A=bodyMotorAcceleration(body,time-lag),source=sampleBody(body,time-lag,timeline),ember=sampleBody({birth:time-lag,position:source.position,velocity:source.velocity.map(v=>v*.25),drag:1.35,gravity:9.81},time,timeline),wind=timeline[0].wind;
  for(let c=0;c<3;c++){const a=(body.drag??.2)*(wind[c]-source.velocity[c])-(c===1?(body.gravity??9.81):0)+A[c],w=ember.velocity[c]-.25*source.velocity[c]*node.decay+(c===1?9.81*node.travel:0);assert.equal(q.velocity[c],source.velocity[c]+.25*a*node.travel+w-(1-node.decay)*wind[c]);}cases++;
 }
 assert.deepEqual(bodyMotorAcceleration(body,body.birth+body.displayMotor.endAge),[0,0,0]);return{cases,scope:'Represented absolute clocks determine the right-hand source-age lookup; no epsilon snapping to force cells.'};
});
check('Actual display heads/tails use bounded contact solves with complete causal force partitions',()=>{
 let cases=0,cuts=0,maxUnresolved=0;
 for(const body of [motors[1],motors.at(-1)])for(const lag of [null,.31]){
  const node=lag===null?body:createTailReleaseFieldNode(body,lag),sample=t=>lag===null?sampleBody(body,t,[{time:-Infinity,wind:[0,0,0]}]):sampleTailReleaseFieldNode(node,t,[{time:-Infinity,wind:[0,0,0]}]);
  const mid=body.birth+(lag??0)+.73,now=mid+.06,S=.2,height=sample(mid).position[1]-.03,adapter=traced.createFireworkContactSupport(plane(height)),timeline=[{time:-Infinity,wind:[0,0,0]}];adapter.begin({physicalNow:now,windTimeline:timeline});
  const prior=traced.capturedPartitions.length,p={sourceBody:body,position:sample(now).position,...(lag===null?{}:{tailFieldNode:node})},result=adapter.resolve(p,exposure(now,S));assert.ok(result);assert.equal(adapter.diagnostics().planeSolves,0);assert.equal(adapter.diagnostics().boundedSolves,1);assert.equal(traced.capturedPartitions.length,prior+1);
  const actual=traced.capturedPartitions.at(-1),expected=body.displayMotor.cells.flatMap(cell=>[cell.from,cell.to]).map(age=>body.birth+age+(lag??0)).filter(t=>t>now-S&&t<now);assert.ok(expected.length>0);for(const t of expected)assert.ok(actual.includes(t));assert.ok(actual.every(t=>t>now-S&&t<now&&t<=now));
  for(const interval of result.intervals)assert.ok(sample(interval.anchorTime).position[1]-height-.03>0);assert.ok(result.totalUnresolvedSeconds<=1e-7);assert.notEqual(result.status,'uncertain');cuts+=new Set(actual).size;maxUnresolved=Math.max(maxUnresolved,result.totalUnresolvedSeconds);cases++;
 }
 return{cases,distinctForceCuts:cuts,maxUnresolved,scope:'Artificial declared planes through actual source trajectories test crossing algebra; not a new terrain/water model.'};
});
check('Ordinary and older finite-thrust body/tail outputs and contact solves stay exact against the archived adapters',()=>{
 let tails=0,contacts=0;
 for(const [type,effectProfile]of [['peony','legacy'],['chrysanthemum','three-heart-v1'],['chrysanthemum','powered-bees-v1']]){
  const event=createFireworkEvent({type,effectProfile,seed:42,elevation:25,starDragModel:'bounded-descent'}),body=event.heads.find(body=>body.thrustProfile)||event.heads[0];
  for(const lag of [0,.1,.31,.88]){const old=baselineTail.createTailReleaseFieldNode(body,lag),node=createTailReleaseFieldNode(body,lag);for(const age of [.37,1.31,2.6]){const now=body.birth+lag+age,timeline=timelineFor(body,now);assert.deepEqual(sampleTailReleaseFieldNode(node,now,timeline),baselineTail.sampleTailReleaseFieldNode(old,now,timeline));tails++;}}
  for(const lag of [null,.31])for(const S of [0,1/120,.2]){const now=body.birth+2.1,timeline=timelineFor(body,now),node=lag===null?null:createTailReleaseFieldNode(body,lag),pose=lag===null?sampleBody(body,now,timeline):sampleTailReleaseFieldNode(node,now,timeline),height=pose.position[1]-.04,p={sourceBody:body,position:pose.position,...(node?{tailFieldNode:node}:{})};
   const old=baselineContact.createFireworkContactSupport(plane(height)),current=createFireworkContactSupport(plane(height));old.begin({physicalNow:now,windTimeline:timeline});current.begin({physicalNow:now,windTimeline:timeline});const a=current.resolve(p,exposure(now,S)),b=old.resolve(p,exposure(now,S));assert.deepEqual(a,b);assert.deepEqual(current.diagnostics(),old.diagnostics());contacts++;
  }
 }
 return{exactTailCases:tails,exactContactCases:contacts,oldProfiles:['legacy','three-heart-v1','powered-bees-v1']};
});
const report={schema:'glass-atoll.complex-display-motor-contact-cpu-check.v1',passed:results.every(result=>result.passed),counts:{passed:results.filter(result=>result.passed).length,total:results.length},actualGPU:false,browserUsed:false,scope:'Actual production event factories, motor samplers and two adapters; QA source clone only exposes closure bounds/captured partitions. Finite sampled checks supplement analytical contracts, not a proof by trajectory sampling. No rendered/pixel/FPS claim.',sourcePins:Object.fromEntries(['firework-contact-support.js','firework-tail-field.js','fireworks-physics.js','complex-fireworks-motion.js','complex-fireworks.js'].map(file=>[file,sha(fs.readFileSync(new URL(file,root)))])),results};
fs.writeFileSync(new URL('motor-contact-check.json',import.meta.url),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({passed:report.passed,counts:report.counts,failed:results.filter(result=>!result.passed)},null,2));if(!report.passed)process.exitCode=1;
