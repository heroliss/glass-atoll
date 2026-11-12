// Actual physics/tail consumers; no browser, renderer, GPU or audio changes.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import crypto from 'node:crypto';
import {createFireworkEvent,createFireworksSimulation,sampleBody,bodyMotorAcceleration,bodyMotorMotionBound,FIREWORK_TYPES} from '../fireworks-physics.js';
import {createFiniteThrustProfile} from '../firework-thrust-profile.js';
import {createTailReleaseFieldNode,sampleTailReleaseFieldNode} from '../firework-tail-field.js';
const source=fs.readFileSync(new URL('../fireworks-physics.js',import.meta.url),'utf8'),baselineSource=fs.readFileSync(new URL('./baselines/r22-before-powered-motion/fireworks-physics.js',import.meta.url),'utf8'),oldFieldSource=fs.readFileSync(new URL('./baselines/r22-before-powered-motion/firework-tail-field.js',import.meta.url),'utf8');
const resolve=text=>text.replace(/from (['"])(\.\/[^'"]+)\1/g,(_,q,path)=>`from '${new URL('../'+path.slice(2),import.meta.url).href}'`),baseline=await import('data:text/javascript;base64,'+Buffer.from(resolve(baselineSource)).toString('base64')),oldField=await import('data:text/javascript;base64,'+Buffer.from(resolve(oldFieldSource)).toString('base64'));
const checks=[],check=(name,fn)=>{try{checks.push({name,passed:true,evidence:fn()??null});}catch(error){checks.push({name,passed:false,error:String(error.stack)});}},hash=s=>crypto.createHash('sha256').update(s).digest('hex'),maxError=(a,b)=>Math.max(...a.map((v,c)=>Math.abs(v-b[c]))),near=(a,b,tol=2e-9)=>assert(maxError(a,b)<=tol,JSON.stringify({a,b,tol,error:maxError(a,b)}));
const timeline=[{time:-Infinity,wind:[0,0,0]},{time:2.13,wind:[2,-.4,1]},{time:2.67,wind:[-1,.8,-2]},{time:3.1,wind:[.2,0,0]}];
const profile=createFiniteThrustProfile({id:'r22 independent finite world-force fixture',cells:[{fromAge:0,toAge:.2,acceleration:[3,9,0]},{fromAge:.2,toAge:.55,acceleration:[-5,-2,4]},{fromAge:.55,toAge:1,acceleration:[2,4,-3]}]});
function heldWind(t,history){let result=[0,0,0];for(const knot of history){if(knot.time<=t)result=knot.wind;else break;}return result;}
function heldForce(body,age){if(!body.thrustProfile||age<0)return[0,0,0];for(const cell of body.thrustProfile.cells)if(age>=cell.fromAge&&age<cell.toAge)return cell.acceleration;return[0,0,0];}
function nextUp(value){const bytes=new ArrayBuffer(8),view=new DataView(bytes);view.setFloat64(0,value);const bits=view.getBigUint64(0);view.setBigUint64(0,value>=0?bits+1n:bits-1n);return view.getFloat64(0);}
// Independent RK4 full-state differential equation. Split at every wind/force
// knot, then keep that interval's declared forcing for all four RK stages.
function ode(body,time,history){
  if(time<body.birth)return null;
  const k=(body.drag??.2)<1e-8?0:body.drag??.2,g=body.gravity??9.81,cuts=[body.birth,...history.map(n=>n.time).filter(t=>t>body.birth&&t<time),...(body.thrustProfile?.cells.map(c=>body.birth+c.toAge)??[]).filter(t=>t>body.birth&&t<time),time].sort((a,b)=>a-b),p=[...body.position],v=[...body.velocity];
  for(let j=1;j<cuts.length;j++){
    const from=cuts[j-1],to=cuts[j];if(!(to>from))continue;const middle=from+(to-from)*.5,w=heldWind(middle,history),f=heldForce(body,middle-body.birth),steps=Math.ceil((to-from)/Math.min(.0002,.2/Math.max(k,1))),h=(to-from)/steps;
    for(let n=0;n<steps;n++)for(let c=0;c<3;c++){
      const a=x=>k*(w[c]-x)+f[c]-(c===1?g:0),v1=v[c],a1=a(v1),v2=v1+a1*h*.5,a2=a(v2),v3=v1+a2*h*.5,a3=a(v3),v4=v1+a3*h,a4=a(v4);
      p[c]+=(v1+2*v2+2*v3+v4)*h/6;v[c]+=(a1+2*a2+2*a3+a4)*h/6;
    }
  }
  return{position:p,velocity:v};
}
check('All old event/profile outputs and ordinary sampler arithmetic remain exactly equal to frozen physics',()=>{
  let events=0,poses=0,tailPoses=0;for(const type of FIREWORK_TYPES.map(t=>t.id))for(const starDragModel of ['legacy','bounded-descent'])for(const effectProfile of type==='chrysanthemum'?['legacy','three-heart-v1','two-colour-v1']:['legacy']){
    const options={type,starDragModel,effectProfile,seed:42,time:2,azimuth:119,elevation:78,burstOrientation:{yawDegrees:11,tiltDegrees:17,rollDegrees:-3}},A=createFireworkEvent(options),B=baseline.createFireworkEvent(options);assert.deepEqual(A,B);events++;
    for(const id of [0,Math.floor(A.heads.length/2),A.heads.length-1])for(const dt of [-.01,0,.17,.9,2.3,7]){const a=A.heads[id],b=B.heads[id],time=a.birth+dt;assert.deepEqual(sampleBody(a,time,timeline),baseline.sampleBody(b,time,timeline));poses++;}
    if(type==='chrysanthemum')for(const lag of [0,.00625,.2,.35]){const a=createTailReleaseFieldNode(A.heads[0],lag),b=oldField.createTailReleaseFieldNode(B.heads[0],lag),t=a.birth+.9;assert.deepEqual(sampleTailReleaseFieldNode(a,t,timeline),oldField.sampleTailReleaseFieldNode(b,t,timeline));tailPoses++;}
  }
  for(const drag of [0,1e-12,1e-8,.2,.613125,3])for(const gravity of [0,9.81,-1])for(const t of [1.99,2,2.7,4]){const body={birth:2,position:[-0,4,-2],velocity:[-0,2,0],drag,gravity};assert.deepEqual(sampleBody(body,t,timeline),baseline.sampleBody(body,t,timeline));poses++;}
  return{events,poses,tailPoses,comparison:'deepStrictEqual complete return objects, including signed zero and unchanged old event metadata'};
});
check('Historical queue-expectation failure reproduces unchanged on frozen and current physics',()=>{
  const current=createFireworksSimulation(),prior=baseline.createFireworksSimulation(),outcomes=[];for(let i=0;i<5;i++){const a=current.launch({type:'peony'}),b=prior.launch({type:'peony'});assert.deepEqual(a,b);outcomes.push(a.accepted);}assert.deepEqual(current.state,prior.state);assert(outcomes.some(value=>!value));return{fiveLaunchAccepted:outcomes,state:current.state,scope:'Regression equality only; the old physics-check suite still fails its obsolete assertion that all five launches are accepted and queued'};
});
check('Powered actual sampler matches independent full ODE through force/wind knots, cutoff and tiny-drag branch',()=>{
  let cases=0,maxPositionError=0,maxVelocityError=0;for(const drag of [0,1e-12,1e-8,.613125,3])for(const gravity of [0,9.81])for(const dt of [0,.03,.2,.499,.55,.9,1,1.4,2.8]){
    const body={birth:2,position:[3,40,-7],velocity:[-2,3,4],drag,gravity,thrustProfile:profile},time=body.birth+dt,a=sampleBody(body,time,timeline),b=ode(body,time,timeline);near(a.position,b.position,4e-8);near(a.velocity,b.velocity,4e-8);maxPositionError=Math.max(maxPositionError,maxError(a.position,b.position));maxVelocityError=Math.max(maxVelocityError,maxError(a.velocity,b.velocity));assert.deepEqual(a.motorAcceleration,heldForce(body,time-body.birth));assert.deepEqual(bodyMotorAcceleration(body,time),heldForce(body,time-body.birth));cases++;
  }
  return{cases,maxPositionError,maxVelocityError,reference:'RK4 full p/v ODE; force/wind breakpoints aligned, no production response formula reuse'};
});
check('Motor response bounds include numerical margins and enclose actual extra position/velocity',()=>{
  let cases=0;for(const drag of [0,1e-12,1e-8,.613125,3])for(const dt of [0,.03,.2,.499,.55,.9,1,1.4,2.8,10]){
    const body={birth:2,position:[3,40,-7],velocity:[-2,3,4],drag,gravity:9.81,thrustProfile:profile},plain={...body};delete plain.thrustProfile;const t=body.birth+dt,a=sampleBody(body,t,timeline),b=sampleBody(plain,t,timeline),bound=bodyMotorMotionBound(body,t),dP=Math.hypot(...a.position.map((v,c)=>v-b.position[c])),dV=Math.hypot(...a.velocity.map((v,c)=>v-b.velocity[c]));assert(dP<=bound.maximumPositionDeltaMetres+1e-12);assert(dV<=bound.maximumVelocityDeltaMetresPerSecond+1e-12);assert(bound.numericPadding.speedMetresPerSecond>0);assert(bound.maximumMotorAccelerationMetresPerSecondSquared>=Math.hypot(...bodyMotorAcceleration(body,t)));cases++;
  }
  const before={birth:2,position:[0,0,0],velocity:[0,0,0],thrustProfile:profile};assert.equal(sampleBody(before,1),null);assert.equal(bodyMotorAcceleration(before,1),null);assert.equal(bodyMotorMotionBound(before,1),null);return{cases,beforeBirth:'null',bound:'Causal integrated absolute acceleration plus explicit numeric margins; passive base is separate'};
});
const options={type:'chrysanthemum',effectProfile:'powered-bees-v1',starDragModel:'bounded-descent',time:2,seed:42,elevation:78,azimuth:119,burstOrientation:{yawDegrees:11,tiltDegrees:17,rollDegrees:-3}};
check('Actual powered event patches exactly32 roots while160 native radial bodies and native RNG remain unchanged',()=>{
  const e=createFireworkEvent(options),old=baseline.createFireworkEvent({...options,effectProfile:'legacy'}),motors=e.heads.filter(b=>b.thrustProfile),ids=motors.map(b=>b.id);assert.equal(e.heads.length,192);assert.equal(motors.length,32);assert.deepEqual(e.layerProfile.motorBodyIds,ids);assert.deepEqual(e.events,old.events);assert.deepEqual(e.rocket,old.rocket);
  for(const b of e.heads)if(!b.thrustProfile)assert.deepEqual(b,old.heads[b.id]);else{const prior=old.heads[b.id];assert.equal(b.id,prior.id);assert.equal(b.birth,prior.birth);assert.equal(b.seed,prior.seed);assert.equal(b.intensity,prior.intensity);assert.equal(b.radius,prior.radius);assert.equal(b.drag,prior.drag);assert.deepEqual(b.position,prior.position);near(b.velocity,prior.velocity.map((v,c)=>old.baselineBurst.velocity[c]+.45*(v-old.baselineBurst.velocity[c])),1e-13);assert(Object.isFrozen(b.thrustProfile));assert(b.thrustProfile.motorEndAge<=1.06);assert(b.life<=1.908+1e-12);}
  return{motorCount:motors.length,radialCount:160,ids,nativeAudioEventsExact:true};
});
check('Every compiled motor root agrees with full-state ODE under changing wind through powered/cutoff/coast phases',()=>{
  let cases=0,maxPositionError=0,maxVelocityError=0;for(const seed of [42,9999]){
    const event=createFireworkEvent({...options,seed}),motors=event.heads.filter(b=>b.thrustProfile),birth=motors[0].birth,history=[{time:-Infinity,wind:[0,0,0]},{time:birth+.17,wind:[2,.1,-1]},{time:birth+.66,wind:[-1,.2,2]}];
    for(const b of motors)for(const age of [.03,.43,b.thrustProfile.motorEndAge,1.6]){const time=b.birth+age,a=sampleBody(b,time,history),expected=ode(b,time,history);near(a.position,expected.position,4e-8);near(a.velocity,expected.velocity,4e-8);maxPositionError=Math.max(maxPositionError,maxError(a.position,expected.position));maxVelocityError=Math.max(maxVelocityError,maxError(a.velocity,expected.velocity));cases++;}
  }return{cases,motorBodies:64,seeds:[42,9999],maxPositionError,maxVelocityError,reference:'Same independent RK4 full-state ODE, actual compiled world force schedules and body drag'};
});
check('Direct/configure/launch admission rejects unsupported motor profiles atomically before state/seed changes',()=>{
  assert.throws(()=>createFireworkEvent({...options,starDragModel:'legacy'}),/bounded-descent/);assert.throws(()=>createFireworkEvent({...options,type:'peony'}));const s=createFireworksSimulation({seed:42}),control=createFireworksSimulation({seed:42}),before=s.state;assert.throws(()=>s.configure({type:'chrysanthemum',effectProfile:'powered-bees-v1',starDragModel:'legacy'}),/bounded-descent/);assert.deepEqual(s.state,before);assert.throws(()=>s.launch({type:'chrysanthemum',effectProfile:'powered-bees-v1',starDragModel:'legacy'}),/bounded-descent/);assert.deepEqual(s.state,before);assert.deepEqual(s.launch(),control.launch());
  const parent={birth:0,position:[0,20,0],velocity:[0,0,0],thrustProfile:profile},child={birth:1,position:[0,20,0],velocity:[0,0,0],parentBody:parent,velocityDelta:[1,1,1]};assert.throws(()=>sampleBody(child,2),/parent\/child/);assert.throws(()=>sampleBody({...parent,parentBody:{birth:0,position:[0,20,0],velocity:[0,0,0]}},2),/parent\/child/);return{rejections:5,stateAndNextSeedExact:true};
});
check('Powered flight admission rejects explicit/inherited height and non-apex timing before configure/launch mutation',()=>{
  let rejections=0;const snapshot=s=>structuredClone({state:s.state,active:s.active,timeline:s.windTimeline}),reject=(fn,pattern)=>{assert.throws(fn,pattern);rejections++;};
  for(const height of [20,160,0,null,NaN])reject(()=>createFireworkEvent({...options,height}),/definition-rise apex/);
  for(const flightModel of ['timed-reference','unknown',null])reject(()=>createFireworkEvent({...options,flightModel}),/definition-rise apex/);
  reject(()=>createFireworkEvent({...options,burstDelaySeconds:3}),/definition-rise apex/);assert.deepEqual(createFireworkEvent(options),createFireworkEvent({...options,flightModel:'apex',height:undefined}));
  const s=createFireworksSimulation({seed:42}),control=createFireworksSimulation({seed:42});for(const sim of [s,control])sim.configure({type:'chrysanthemum',height:20});const before=snapshot(s);
  reject(()=>s.configure({effectProfile:'powered-bees-v1'}),/definition-rise apex/);assert.deepEqual(snapshot(s),before);
  reject(()=>s.launch({effectProfile:'powered-bees-v1'}),/definition-rise apex/);assert.deepEqual(snapshot(s),before);
  for(const sim of [s,control])sim.configure({height:undefined,effectProfile:'powered-bees-v1'});assert.deepEqual(s.launch(),control.launch());
  // Deliberately leave an expired event pending, proving invalid requests do
  // not even run the launch-time pruning step or increment capacity counters.
  for(const sim of [s,control])sim.active[0].endTime=-1;const pending=snapshot(s);
  for(const patch of [{height:20},{height:null},{flightModel:'timed-reference'},{burstDelaySeconds:3}]){reject(()=>s.launch(patch));assert.deepEqual(snapshot(s),pending);}
  reject(()=>s.configure({height:20}),/definition-rise apex/);assert.deepEqual(snapshot(s),pending);assert.deepEqual(s.launch({flightModel:'apex'}),control.launch({flightModel:'apex'}));assert.deepEqual(s.drainEvents(),control.drainEvents());
  const ordinary={type:'chrysanthemum',height:20,seed:42,flightModel:'apex'};assert.deepEqual(createFireworkEvent(ordinary),baseline.createFireworkEvent(ordinary));const timed={type:'ring',flightModel:'timed-reference',burstDelaySeconds:3,seed:42};assert.deepEqual(createFireworkEvent(timed),baseline.createFireworkEvent(timed));return{rejections,defaultAndExplicitApexExact:true,ordinaryHeightAndTimedFlightExact:true,settingsActivePendingAndNextSeedExact:true};
});
check('Optical0x preserves every motor schedule, lifetime and physical trajectory',()=>{
  const a=createFireworkEvent({...options,intensityScale:1}),b=createFireworkEvent({...options,intensityScale:0});let poses=0;for(let i=0;i<a.heads.length;i++){const A=a.heads[i],B=b.heads[i];assert.equal(A.life,B.life);assert.deepEqual(A.thrustProfile,B.thrustProfile);for(const dt of [0,.07,.4,.99,1.1,2.2]){assert.deepEqual(sampleBody(A,A.birth+dt,timeline),sampleBody(B,B.birth+dt,timeline));poses++;}}return{poses,motorScheduleAndLifeExact:true};
});
check('Committed carrier wind updates inherited burst state without rotating or resampling motor schedules',()=>{
  const s=createFireworksSimulation({seed:42});s.configure({type:'chrysanthemum',effectProfile:'powered-bees-v1',starDragModel:'bounded-descent',autoDirection:false,azimuth:119,elevation:78,launchSpreadDegrees:0,burstTiltDegrees:0,burstRollDegrees:0});s.launch({seed:42});const e=s.active[0],schedules=e.heads.filter(b=>b.thrustProfile).map(b=>b.thrustProfile),base=e.baselineBurst;s.update({time:1,windVector:[3,.4,-2]});s.update({time:e.burstTime+.5,windVector:[-1,.2,1]});const actual=sampleBody(e.rocket,e.burstTime,s.windTimeline);let moved=0;for(const b of e.heads){assert.deepEqual(b.position,b.basePosition.map((v,c)=>v+actual.position[c]-base.position[c]));assert.deepEqual(b.velocity,b.baseVelocity.map((v,c)=>v+actual.velocity[c]-base.velocity[c]));assert.deepEqual(sampleBody(b,b.birth,s.windTimeline).position,b.position);if(maxError(b.position,b.basePosition)>.01)moved++;}assert(moved>0);assert.deepEqual(e.heads.filter(b=>b.thrustProfile).map(b=>b.thrustProfile),schedules);return{bodies:moved,scheduleIdentityPreserved:true};
});
check('Physical30/60/120 replay and arbitrary past query order return exactly identical powered poses',()=>{
  const make=()=>{const s=createFireworksSimulation({seed:42});s.configure({type:'chrysanthemum',effectProfile:'powered-bees-v1',starDragModel:'bounded-descent',autoDirection:false,azimuth:119,elevation:78,launchSpreadDegrees:0,burstTiltDegrees:0,burstRollDegrees:0});s.launch({seed:42});return s;},first=make(),end=first.active[0].burstTime+2.1,wind=[{time:1,wind:[2,0,-1]},{time:2.5,wind:[-1,.2,3]},{time:first.active[0].burstTime+.3,wind:[.7,0,-.3]}],outputs=[];
  for(const rate of [30,60,120]){const s=make(),times=[...wind.map(k=>k.time),...Array.from({length:Math.floor(end*rate)},(_,i)=>(i+1)/rate),end].filter(t=>t<=end).sort((a,b)=>a-b);for(const t of times)s.update({time:t,windVector:heldWind(t,wind)});const e=s.active[0],b=e.heads.find(b=>b.thrustProfile),queries=[b.birth+.11,b.birth+.7,b.birth+1.1,b.birth+2],forward=queries.map(t=>sampleBody(b,t,s.windTimeline));for(const t of queries.slice().reverse())sampleBody(b,t,s.windTimeline);assert.deepEqual(queries.map(t=>sampleBody(b,t,s.windTimeline)),forward);outputs.push({heads:e.heads.map(b=>sampleBody(b,end,s.windTimeline)),forward,timeline:s.windTimeline});}assert.deepEqual(outputs[0],outputs[1]);assert.deepEqual(outputs[0],outputs[2]);return{rates:[30,60,120],worldPoses:192*3,pastQueries:4};
});
check('Eulerian tail qdot uses current prescribed motor acceleration including represented sides of knots and cutoff',()=>{
  const e=createFireworkEvent(options),b=e.heads.find(b=>b.thrustProfile),history=[{time:-Infinity,wind:[0,0,0]},{time:b.birth+.17,wind:[2,0,-1]},{time:b.birth+.66,wind:[-1,.2,2]}],cases=[];let maxDerivativeError=0,maxPositionError=0;
  function path(time,lag){const u=time-lag,source=sampleBody(b,u,history),ember={birth:u,position:source.position,velocity:source.velocity.map(v=>v*.25),drag:1.35,gravity:9.81};return sampleBody(ember,time,history).position;}
  for(const lag of [.00625,.1,.31]){const node=createTailReleaseFieldNode(b,lag);for(const age of [.11,.43,1.22]){const t=b.birth+lag+age,a=sampleTailReleaseFieldNode(node,t,history),h=1e-4,p=[path(t-2*h,lag),path(t-h,lag),path(t+h,lag),path(t+2*h,lag)],d=[0,1,2].map(c=>(p[0][c]-8*p[1][c]+8*p[2][c]-p[3][c])/(12*h));near(a.position,path(t,lag),1e-12);near(a.velocity,d,3e-6);maxDerivativeError=Math.max(maxDerivativeError,maxError(a.velocity,d));maxPositionError=Math.max(maxPositionError,maxError(a.position,path(t,lag)));cases.push({lag,age});}
    for(const knot of b.thrustProfile.cells.map(c=>c.toAge)){
      const nominal=b.birth+lag+knot,h=1e-4,at=sampleTailReleaseFieldNode(node,nominal,history),side=at.releaseTime-b.birth<knot?-1:1;
      // Addition/subtraction of a body epoch and lag need not recover an exact
      // relative force knot. Validate the side actually represented, then
      // separately move by the minimum number of ulps into the right cell.
      const derivative=(t,direction)=>{const p=Array.from({length:5},(_,j)=>path(t+direction*j*h,lag));return[0,1,2].map(c=>direction*(-25*p[0][c]+48*p[1][c]-36*p[2][c]+16*p[3][c]-3*p[4][c])/(12*h));};
      assert.deepEqual(bodyMotorAcceleration(b,at.releaseTime),heldForce(b,at.releaseTime-b.birth));const d=derivative(nominal,side);near(at.velocity,d,2e-6);maxDerivativeError=Math.max(maxDerivativeError,maxError(at.velocity,d));
      let right=nominal,ulps=0;while((right-lag)-b.birth<knot&&ulps<16){right=nextUp(right);ulps++;}assert((right-lag)-b.birth>=knot);const a=sampleTailReleaseFieldNode(node,right,history),rd=derivative(right,1);near(a.velocity,rd,2e-6);near(a.position,at.position,1e-10);maxDerivativeError=Math.max(maxDerivativeError,maxError(a.velocity,rd));cases.push({lag,knot,nominalSide:side<0?'left':'right',rightSideUlps:ulps,nominalRepresentedAge:at.releaseTime-b.birth});
    }
  }
  const t=b.birth+b.thrustProfile.motorEndAge+.2;assert.deepEqual(bodyMotorAcceleration(b,t),[0,0,0]);assert(Math.hypot(...sampleBody(b,t,history).velocity)>0);return{cases:cases.length,maxDerivativeError,maxPositionError,roundedLeftKnots:cases.filter(c=>c.nominalSide==='left'),oracle:'Five-point one-sided differences on the represented force-cell side, plus minimum-ulp right samples; independently constructed fixed-lag paths via the separately ODE-validated actual body sampler; no qdot formula reuse'};
});
check('Event retirement covers actual motor/material/luminous ends, detached tail support and maximum source shutter history',()=>{
  let events=0,minimumMargin=Infinity;for(const seed of [0,1,42,9999])for(const elevation of [25,78,90]){const e=createFireworkEvent({...options,seed,elevation});assert.equal(e.layerProfile.propulsionKind,'finite-held-author-acceleration-v1');for(const b of e.heads){const end=b.birth+Math.max(b.life,b.burnProfile?.material.endAge??0,b.thrustProfile?.motorEndAge??0)+(b.trailProfile?.durationSeconds??(b.trail?.35:0))+1;assert(e.endTime>=end);minimumMargin=Math.min(minimumMargin,e.endTime-end);}events++;}return{events,minimumMargin,scope:'Source lifetimes/tails/source exposure and original event smoke envelope; scheduler/material-transfer admission is separate'};
});
const report={schema:'glass-atoll.r22-motion-integration.v1',dateUTC:new Date().toISOString(),passed:checks.every(c=>c.passed),counts:{passed:checks.filter(c=>c.passed).length,total:checks.length},sourceSHA256:{physics:hash(source),tail:hash(fs.readFileSync(new URL('../firework-tail-field.js',import.meta.url))),layer:hash(fs.readFileSync(new URL('../firework-layer-profile.js',import.meta.url))),thrust:hash(fs.readFileSync(new URL('../firework-thrust-profile.js',import.meta.url)))},baselinePhysicsSHA256:hash(baselineSource),checks,limits:['Actual physics/tail CPU consumers only; no GPU, native visual, smoke mass integration, full optical shutter curvature or performance acceptance.','Motion uses authored acceleration/effective linear drag with stepped directions; no measured mass/nozzle/fuel/attitude/chemical calibration.','Numerical bounds use explicit practical margins; no universal arbitrary-epoch interval-arithmetic claim.']};const out=JSON.stringify(report,null,2)+'\n';if(!report.passed&&!fs.existsSync(new URL('./r22-motion-integration-first-failure.json',import.meta.url)))fs.writeFileSync(new URL('./r22-motion-integration-first-failure.json',import.meta.url),out);fs.writeFileSync(new URL('./r22-motion-integration-check.json',import.meta.url),out);console.log(out);if(!report.passed)process.exitCode=1;
