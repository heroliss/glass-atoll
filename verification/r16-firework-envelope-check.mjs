import assert from 'node:assert/strict';import fs from 'node:fs';import crypto from 'node:crypto';
import {getFireworkShowEnvelope,fireworkLaunchConeBounds,FIREWORK_ENVELOPE_LIMITS} from '../firework-show-envelope.js';
import {FIREWORK_TYPES,createFireworkEvent,createFireworksSimulation,sampleBody,sampleFireworkEvent,flightSegment} from '../fireworks-physics.js';
const tests=[],check=(name,fn)=>{try{tests.push({name,passed:true,evidence:fn()??null});}catch(e){tests.push({name,passed:false,error:String(e.stack)});}};
const inside=(p,b,context)=>{if(p[1]<.03)return;for(let c=0;c<3;c++)assert.ok(p[c]>=b.min[c]-1e-8&&p[c]<=b.max[c]+1e-8,JSON.stringify({context,c,p,min:b.min,max:b.max}));};
const axis=(az,el)=>{const a=az*Math.PI/180,e=el*Math.PI/180;return[Math.sin(a)*Math.cos(e),Math.sin(e),-Math.cos(a)*Math.cos(e)];};
let randomState=7223;const random=()=>((randomState=Math.imul(randomState,1664525)+1013904223>>>0)/2**32);
check('analytical cap component extrema enclose actual clamp/jitter directions across30000seededlaunches',()=>{
  let count=0;
  for(const elevation of [25,26,40,78,89,90])for(const spread of [0,3,15])for(let i=0;i<1667;i++){
    const azimuth=random()*360,b=fireworkLaunchConeBounds(azimuth,elevation,spread),sim=createFireworksSimulation();sim.configure({autoDirection:false,azimuth,elevation,launchSpreadDegrees:spread});const a=sim.launch({type:'palm',seed:(random()*4294967296)>>>0});const d=axis(a.azimuth,a.elevation);
    for(let c=0;c<3;c++)assert.ok(d[c]>=b.components[c][0]-2e-14&&d[c]<=b.components[c][1]+2e-14);count++;
  }return{launches:count};
});
check('one explicit maximum-angle witness missing from oldforecast is enclosed',()=>{
  const pivot=[29,.21,7],d=axis(110,78),sim=createFireworksSimulation({origin:pivot.map((v,c)=>v+.66*d[c]),muzzleOffsetMetres:.66});sim.configure({autoDirection:false,azimuth:110,elevation:78,launchSpreadDegrees:15,burstTiltDegrees:45,burstRollDegrees:30});const a=sim.launch({type:'peony',seed:8});
  const envelope=getFireworkShowEnvelope({type:'peony',origin:pivot,muzzleOffsetMetres:.66,settings:{azimuth:110,elevation:78,launchSpreadDegrees:15,burstTiltDegrees:45,burstRollDegrees:30}});inside(sim.active[0].burstPosition,envelope,'oldmissingseed8');return{launch:a,envelope};
});
check('all allowed type/drag/cone ranges, arbitrary burst rotations and bounded piecewise winds enclose body/tailcentres',()=>{
  let cases=0,bodyPoints=0,tailPoints=0,maximumSpan=0;
  const byType=[];
  for(const type of FIREWORK_TYPES){let local=0;
    for(const starDragModel of ['legacy','bounded-descent'])for(const elevation of [25,78,90])for(const spread of [0,3,15]){
      const azimuth=(cases%3)*110,pivot=[29,.21,7],a=axis(azimuth,elevation),settings={type:type.id,autoDirection:false,azimuth,elevation,launchSpreadDegrees:spread,burstTiltDegrees:45,burstRollDegrees:30,starDragModel};
      const envelope=getFireworkShowEnvelope({origin:pivot,muzzleOffsetMetres:.66,settings});maximumSpan=Math.max(maximumSpan,...envelope.max.map((v,c)=>v-envelope.min[c]));
      for(const seed of [0,1,42,4294967295]){
        const sim=createFireworksSimulation({origin:pivot.map((v,c)=>v+.66*a[c]),muzzleOffsetMetres:.66});sim.configure(settings);const launch=sim.launch({seed,burstOrientation:{yawDegrees:random()*720-360,tiltDegrees:random()*720-360,rollDegrees:random()*720-360}}),event=sim.active[0];
        const windTimeline=[{time:-Infinity,wind:[0,0,0]},{time:.1,wind:[4.68,0,1.76]},{time:1.1,wind:[.6552,0,.2464]},{time:3.7,wind:[1.9656,0,.7392]},{time:6.6,wind:[0,0,0]}];
        sampleFireworkEvent(event,event.burstTime,{windTimeline,smoke:false});
        for(const body of [...(event.rocket?[event.rocket]:[]),...event.heads]){
          const lag=body.kind==='rocket'?.50:type.id==='willow'?.88:type.id==='palm'?.62:body.trail?.35:0;
          for(let j=0;j<=8;j++){
            const at=body.birth+body.life*j/8,state=sampleBody(body,at,windTimeline);inside(state.position,envelope,{type:type.id,seed,elevation,spread,starDragModel,j,body:body.id??'rocket'});bodyPoints++;
            if(lag)for(const fraction of [1/32,.5,31/32]){
              const ember={birth:at,position:state.position,velocity:state.velocity.map(v=>v*.25),drag:1.35,gravity:9.81};inside(sampleBody(ember,at+lag*fraction,windTimeline).position,envelope,{type:type.id,seed,body:body.id??'rocket',lag:lag*fraction});tailPoints++;
            }
          }
        }cases++;local++;
      }
    }byType.push({type:type.id,cases:local});
  }return{cases,bodyPoints,tailPoints,maximumWorldSpanMetres:maximumSpan,byType,scope:'Large deterministic CPU counterexample search supports the analytic argument; finite samples do not prove all random inputs.'};
});
check('all RNG lifetime upperlimits are generatorexpressions ratherthan observed seedmaxima',()=>{
  assert.equal(FIREWORK_ENVELOPE_LIMITS.crossette.maximumBodySeconds,.78+2.5+.7);assert.equal(FIREWORK_ENVELOPE_LIMITS.fan.maximumBodySeconds,3.2+.6);
  for(const t of FIREWORK_TYPES){const b=getFireworkShowEnvelope({type:t.id});assert.ok(b.limits.bodySeconds>0);assert.ok(b.min.every(Number.isFinite)&&b.max.every(Number.isFinite));}
});
check('windbounds allow signchanging3D histories while preserving conservation of one source model',()=>{
  const wind={min:[-5,-1,-3],max:[4,1,6]},envelope=getFireworkShowEnvelope({type:'crossette',origin:[10,5,-8],wind,settings:{azimuth:360,elevation:55,launchSpreadDegrees:15}});
  const e=createFireworkEvent({type:'crossette',origin:[10,5,-8],azimuth:360,elevation:55,starDragModel:'bounded-descent',seed:99,burstOrientation:{yawDegrees:170,tiltDegrees:75,rollDegrees:-20}}),timeline=[{time:-Infinity,wind:[-5,-1,6]},{time:2,wind:[4,1,-3]},{time:5,wind:[0,0,0]}];sampleFireworkEvent(e,e.burstTime,{windTimeline:timeline,smoke:false});
  for(const b of [e.rocket,...e.heads])for(let i=0;i<=24;i++)inside(sampleBody(b,b.birth+b.life*i/24,timeline).position,envelope,'signed3Dwind');return{min:envelope.min,max:envelope.max};
});
check('visiblefloor, compositionpadding and inputdomain explicit; unsupported timedflights failclosed',()=>{
  const a=getFireworkShowEnvelope({type:'willow'}),b=getFireworkShowEnvelope({type:'willow',paddingMetres:12});assert.equal(a.min[1],.03);for(const c of [0,2]){assert.ok(Math.abs(a.min[c]-b.min[c]-12)<1e-10);assert.ok(Math.abs(b.max[c]-a.max[c]-12)<1e-10);}
  for(const options of [{type:'fake'},{elevation:24},{launchSpreadDegrees:16},{origin:[0,NaN,0]},{muzzleOffsetMetres:3},{wind:{min:[5,0,0],max:[-5,0,0]}},{wind:{direction:[1,1,1]}},{flightModel:'timed-reference'},{height:100}])assert.throws(()=>getFireworkShowEnvelope(options));
});
const source=fs.readFileSync(new URL('../firework-show-envelope.js',import.meta.url)),report={schema:'glass-atoll.r16-firework-show-envelope.v1',dateUTC:new Date().toISOString(),passed:tests.every(t=>t.passed),passedCount:tests.filter(t=>t.passed).length,total:tests.length,tests,sourceSHA256:crypto.createHash('sha256').update(source).digest('hex'),limits:['Pure CPU tests and analytic model; no browser/GPU/FPS acceptance.','Large finite seed/time tests seek counterexamples but are not a universal proof. The derivation and hardgeneratorcontracts are the primary basis.','Physical body/detached-tail centres; not lens Gaussian/shutter/DOF support or all persistent smoke.']};
if(!report.passed&&!fs.existsSync(new URL('./r16-firework-envelope-first-failure.json',import.meta.url)))fs.writeFileSync(new URL('./r16-firework-envelope-first-failure.json',import.meta.url),JSON.stringify(report,null,2)+'\n');
fs.writeFileSync(new URL('./r16-firework-envelope-check.json',import.meta.url),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report,null,2));if(!report.passed)process.exitCode=1;
