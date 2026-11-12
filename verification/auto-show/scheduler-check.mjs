import assert from 'node:assert/strict';
import fs from 'node:fs';
import crypto from 'node:crypto';
import {createFireworksSimulation,sampleBody} from '../../fireworks-physics.js';
import {AUTOMATIC_SHOW_DEFAULTS,validateAutomaticShow,sampleAutomaticInterval,signedTiltAim} from '../../firework-auto-show.js';

const checks=[];
const check=(name,fn)=>{try{checks.push({name,passed:true,evidence:fn()??null});}catch(error){checks.push({name,passed:false,error:String(error?.stack??error)});}};
const close=(actual,expected,tolerance=1e-10)=>assert(Math.abs(actual-expected)<=tolerance,`${actual} != ${expected}`);
const wind=[1.2,0,.4];
const base={autoLaunch:true,randomIntervals:true,intervalMinSeconds:1,intervalMaxSeconds:5,randomLaunchTilt:true,automaticTiltMinDegrees:-40,automaticTiltMaxDegrees:40,autoDirection:false,azimuth:103,launchSpreadDegrees:15,starDragModel:'bounded-descent'};
function configured(patch={},factory={}){
  const sim=createFireworksSimulation({maxActive:32,seed:14271,...factory});
  sim.update({time:0,windVector:wind});sim.configure({...base,...patch});return sim;
}
function eventsAt(sim,times){
  const launches=new Map();
  for(const time of times){
    sim.update({time,windVector:wind});
    for(const event of sim.drainEvents())if(event.kind==='launch'){
      const old=launches.get(event.eventId);
      if(!old||event.time<old.time)launches.set(event.eventId,{id:event.eventId,time:event.time,type:event.type});
    }
  }
  return [...launches.values()].sort((a,b)=>a.time-b.time||a.id.localeCompare(b.id));
}
const bodyPose=(body,sim)=>{if(!body)return null;const sampled=sampleBody(body,sim.time,sim.windTimeline);return sampled?{position:sampled.position,velocity:sampled.velocity}:null;};
const pose=sim=>sim.active.map(event=>({id:event.id,type:event.type,time:event.time,azimuth:event.azimuth,elevation:event.elevation,origin:event.origin,burstOrientation:event.burstOrientation,burstPosition:event.burstPosition,rocket:bodyPose(event.rocket,sim),heads:event.heads.map(b=>bodyPose(b,sim))})).sort((a,b)=>a.id.localeCompare(b.id));

check('library defaults remain manual/random-off with four complete slots',()=>{
  const sim=createFireworksSimulation();
  assert.equal(sim.state.maxActive,4);assert.equal(sim.state.nextAutomaticTime,null);
  assert.equal(sim.settings.autoLaunch,false);assert.equal(sim.settings.randomIntervals,false);assert.equal(sim.settings.randomLaunchTilt,false);
  assert.deepEqual(validateAutomaticShow(),AUTOMATIC_SHOW_DEFAULTS);
  return{maxActive:sim.state.maxActive,automatic:sim.settings.autoLaunch};
});
check('uniform interval helper handles edges and degenerate range',()=>{
  const s={...validateAutomaticShow({randomIntervals:true}),intervalSeconds:7.5};
  close(sampleAutomaticInterval(s,0),1);close(sampleAutomaticInterval(s,.5),3);assert(sampleAutomaticInterval(s,1-Number.EPSILON)<5);
  for(const unit of [0,.5,1-Number.EPSILON])assert.equal(sampleAutomaticInterval({...s,intervalMinSeconds:2,intervalMaxSeconds:2},unit),2);
  assert.equal(sampleAutomaticInterval({...s,randomIntervals:false},.7),7.5);
  assert.throws(()=>sampleAutomaticInterval(s,1));assert.throws(()=>sampleAutomaticInterval(s,NaN));
});
check('automatic one-to-five-second gaps vary and stay in configured interval',()=>{
  const sim=configured(),events=eventsAt(sim,Array.from({length:601},(_,i)=>i*.1)),gaps=events.slice(1).map((e,i)=>e.time-events[i].time);
  assert(events.length>12);assert.equal(events[0].time,0);
  assert(gaps.every(x=>x>=1-1e-12&&x<=5+1e-12));assert(new Set(gaps.map(x=>x.toFixed(6))).size>8);
  assert(new Set(events.map(e=>e.type)).size>=5);
  assert.equal(sim.state.queued,0);return{launches:events.length,minimumGap:Math.min(...gaps),maximumGap:Math.max(...gaps),distinctTypes:new Set(events.map(e=>e.type)).size,firstGaps:gaps.slice(0,8)};
});
check('equal random endpoints collapse to fixed schedule without changing event choices',()=>{
  const times=Array.from({length:161},(_,i)=>i*.1);
  const a=configured({intervalMinSeconds:2,intervalMaxSeconds:2}),b=configured({randomIntervals:false,intervalSeconds:2});
  assert.deepEqual(eventsAt(a,times),eventsAt(b,times));assert.deepEqual(pose(a),pose(b));
  assert.equal(a.state.launches,9);return{launches:a.state.launches,next:a.state.nextAutomaticTime};
});
check('frame partitions preserve launch schedule, random aim, types and actual poses',()=>{
  const fine=configured(),coarse=configured();
  const a=eventsAt(fine,Array.from({length:401},(_,i)=>i*.05)),b=eventsAt(coarse,Array.from({length:21},(_,i)=>i));
  assert.deepEqual(a,b);assert.deepEqual(pose(fine),pose(coarse));
  assert.equal(fine.state.nextAutomaticTime,coarse.state.nextAutomaticTime);
  return{launches:a.length,active:fine.state.active,finalTime:fine.time};
});
check('signed aim maps negative/zero/positive and sixty-five-degree boundaries geometrically',()=>{
  for(const theta of [-65,-40,0,40,65]){
    const aim=signedTiltAim(103,theta),az=aim.azimuth*Math.PI/180,el=aim.elevation*Math.PI/180;
    assert.equal(aim.elevation,90-Math.abs(theta));assert.equal(aim.azimuth,103+(theta<0?180:0));
    [Math.sin(az)*Math.cos(el),Math.sin(el),-Math.cos(az)*Math.cos(el)].forEach((v,c)=>close(v,aim.direction[c],1e-14));
    close(Math.hypot(...aim.direction),1,1e-14);
  }
  assert.throws(()=>signedTiltAim(0,66));assert.throws(()=>signedTiltAim(NaN,0));
});
check('automatic closed tilt intervals ignore manual cone and retain moved muzzle origin',()=>{
  for(const theta of [-65,-40,0,40,65]){
    const origin=[29,.87,7],muzzle=.66,baseElevation=37,az=103*Math.PI/180,el=baseElevation*Math.PI/180;
    const beforeAxis=[Math.sin(az)*Math.cos(el),Math.sin(el),-Math.cos(az)*Math.cos(el)];
    const sim=configured({automaticTiltMinDegrees:theta,automaticTiltMaxDegrees:theta,elevation:baseElevation,launchSpreadDegrees:15},{origin,muzzleOffsetMetres:muzzle});
    sim.update({time:0,windVector:wind});const launch=sim.lastLaunch,aim=signedTiltAim(103,theta);
    assert.equal(launch.automatic,true);assert.equal(launch.signedTiltDegrees,theta);
    close(launch.elevation,aim.elevation);close(launch.azimuth,aim.azimuth);
    launch.origin.forEach((v,c)=>close(v,origin[c]+(aim.direction[c]-beforeAxis[c])*muzzle));
  }
});
check('asymmetric automatic tilt stays inside range with varied draws',()=>{
  for(const [minimum,maximum] of [[-50,-15],[10,45],[-20,40]]){
    const sim=configured({automaticTiltMinDegrees:minimum,automaticTiltMaxDegrees:maximum,intervalMinSeconds:.35,intervalMaxSeconds:.35});
    const values=[];let old=0;
    for(let i=0;i<=100;i++){sim.update({time:i*.1,windVector:wind});if(sim.state.launches!==old){values.push(sim.lastLaunch.signedTiltDegrees);old=sim.state.launches;}}
    assert(values.length>15);assert(values.every(t=>t>=minimum&&t<=maximum));assert(new Set(values.map(x=>x.toFixed(5))).size>12);
  }
});
check('manual launches retain ordinary cone independently of automatic tilt settings',()=>{
  const a=configured({autoLaunch:false,elevation:37,launchSpreadDegrees:3,automaticTiltMinDegrees:0,automaticTiltMaxDegrees:0}),b=configured({autoLaunch:false,randomLaunchTilt:false,elevation:37,launchSpreadDegrees:3});
  const la=a.launch({seed:9182}),lb=b.launch({seed:9182});assert.deepEqual(la,lb);
  assert.notEqual(a.lastLaunch.automatic,true);assert.equal(a.lastLaunch.signedTiltDegrees,undefined);
  assert(Math.abs(la.elevation-37)<=3.000001);assert(Math.abs(la.elevation-90)>40);
});
check('thirty-two complete events are admitted and thirty-third immediately rejects without queue',()=>{
  const sim=createFireworksSimulation({maxActive:32});
  for(let i=0;i<32;i++){const result=sim.launch({seed:i});assert.equal(result.accepted,true);assert.equal(result.queued,false);}
  const last=sim.lastLaunch,rejected=sim.launch({seed:100});
  assert.equal(rejected.accepted,false);assert.equal(rejected.queued,false);assert.equal(rejected.reason,'active capacity');
  assert.equal(sim.state.active,32);assert.equal(sim.state.launches,32);assert.equal(sim.state.queued,0);assert.deepEqual(sim.lastLaunch,last);
  assert.throws(()=>createFireworksSimulation({maxActive:33}));return{active:sim.state.active,rejected:sim.state.rejected,queued:sim.state.queued};
});
check('automatic one-second show can exceed four concurrent complete events',()=>{
  const sim=configured({intervalMinSeconds:1,intervalMaxSeconds:1});let maximum=0;
  for(let i=0;i<=100;i++){sim.update({time:i*.1,windVector:wind});maximum=Math.max(maximum,sim.state.active);}
  assert(maximum>4&&maximum<=32);assert.equal(sim.state.queued,0);return{maximumConcurrent:maximum,launches:sim.state.launches};
});
check('repeated true/UI echo does not reset scheduled launch or add a current-time launch',()=>{
  const sim=configured({randomIntervals:false,intervalSeconds:2});sim.update({time:0,windVector:wind});sim.drainEvents();
  assert.equal(sim.state.nextAutomaticTime,2);
  for(const time of [.2,.4,.8,1.2,1.9]){sim.update({time,windVector:wind});sim.configure({autoLaunch:true,...sim.settings});assert.equal(sim.state.launches,1);assert.equal(sim.state.nextAutomaticTime,2);}
  sim.update({time:2,windVector:wind});assert.equal(sim.state.launches,2);assert.equal(sim.lastLaunch.time,2);
});
check('interval reconfigure schedules future slot while stop retains airborne event',()=>{
  const sim=configured({randomIntervals:false,intervalSeconds:2});sim.update({time:0,windVector:wind});sim.update({time:.5,windVector:wind});
  sim.configure({intervalSeconds:3});assert.equal(sim.state.nextAutomaticTime,3.5);
  sim.update({time:3.4,windVector:wind});assert.equal(sim.state.launches,1);const active=sim.state.active;
  sim.stop();assert.equal(sim.state.nextAutomaticTime,null);assert.equal(sim.state.active,active);assert.equal(sim.state.queued,0);
  sim.update({time:3.5,windVector:wind});assert.equal(sim.state.launches,1);
  sim.configure({autoLaunch:true});assert.equal(sim.state.nextAutomaticTime,3.5);
  sim.update({time:3.5,windVector:wind});assert.equal(sim.state.launches,2);assert.equal(sim.lastLaunch.time,3.5);
});
check('invalid range edits are atomic including schedule and subsequent random sequence',()=>{
  const a=configured(),b=configured();a.update({time:0,windVector:wind});b.update({time:0,windVector:wind});a.drainEvents();b.drainEvents();
  const before=a.state;
  for(const patch of [{intervalMinSeconds:6},{intervalMaxSeconds:0},{randomIntervals:1},{automaticTiltMinDegrees:50,automaticTiltMaxDegrees:40},{automaticTiltMinDegrees:-66},{automaticTiltMaxDegrees:NaN}]){
    assert.throws(()=>a.configure(patch));assert.deepEqual(a.state,before);
  }
  const times=Array.from({length:101},(_,i)=>i*.1);assert.deepEqual(eventsAt(a,times),eventsAt(b,times));assert.deepEqual(pose(a),pose(b));
});
check('very large clock catch-up is bounded and leaves no deferred backlog',()=>{
  for(const randomIntervals of [true,false]){
    const sim=configured({randomIntervals,intervalMinSeconds:1,intervalMaxSeconds:5,intervalSeconds:1});
    sim.update({time:1e9,windVector:wind});const state=sim.state;
    assert(state.launches<=64);assert(state.active<=32);assert.equal(state.queued,0);assert(state.skippedAutomatic>0);
    assert(state.nextAutomaticTime>1e9&&state.nextAutomaticTime<=1e9+(randomIntervals?5:1));
    sim.update({time:1e9,windVector:wind});assert.equal(sim.state.launches,state.launches);
  }
});

const sourceSHA256={};for(const name of ['fireworks-physics.js','firework-auto-show.js'])sourceSHA256[name]=crypto.createHash('sha256').update(fs.readFileSync(new URL('../../'+name,import.meta.url))).digest('hex');
const report={passed:checks.every(c=>c.passed),counts:{passed:checks.filter(c=>c.passed).length,total:checks.length},scope:'Actual CPU scheduler/helper and real sampled trajectories; no browser, GPU, optical-capacity, audio, performance or rendered-visibility acceptance',sourceSHA256,checks};
fs.writeFileSync(new URL('./scheduler-check.json',import.meta.url),JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({passed:report.passed,counts:report.counts,failed:checks.filter(c=>!c.passed)},null,2));
if(!report.passed)process.exitCode=1;
