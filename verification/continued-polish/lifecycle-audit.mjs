// CPU-only full-lifecycle audit of actual production event construction.
// Run: node verification/continued-polish/lifecycle-audit.mjs
import fs from 'node:fs';
import crypto from 'node:crypto';
import {FIREWORK_TYPES,createFireworkEvent,createFireworksSimulation,sampleBody,bodyEmissionEnvelope} from '../../fireworks-physics.js';
const root=new URL('../../',import.meta.url),read=p=>fs.readFileSync(new URL(p,root),'utf8');
const sha=b=>crypto.createHash('sha256').update(b).digest('hex');
const sourceNames=['fireworks-physics.js','complex-fireworks.js','complex-fireworks-style.js','complex-fireworks-motion.js','fireworks.js'];
const sourcePins=()=>Object.fromEntries(sourceNames.map(p=>[p,sha(read(p))]));
const initialPins=sourcePins(),EPS=1e-6,DT=1/30;
const scenarios=[
  {id:'nominal',seed:619,azimuth:104,elevation:80,wind:[0,0,0]},
  {id:'low-tilted-windy',seed:620,azimuth:19,elevation:25,burstOrientation:{yawDegrees:19,tiltDegrees:40,rollDegrees:25},wind:[9,0,-6]},
  {id:'vertical-opposite-wind',seed:0,azimuth:284,elevation:90,wind:[-9,0,6]},
];
let samples=0,boundarySamples=0,nonfinite=0,invalidEnvelopes=0,unexpectedEmissionBeforeBirth=0;
const rows=[],issues=[];
function include(box,p){for(let c=0;c<3;c++){box.min[c]=Math.min(box.min[c],p[c]);box.max[c]=Math.max(box.max[c],p[c]);}}
function emptyBox(){return{min:[Infinity,Infinity,Infinity],max:[-Infinity,-Infinity,-Infinity]};}
function finiteState(s){return s&&s.position.every(Number.isFinite)&&s.velocity.every(Number.isFinite);}
for(const definition of FIREWORK_TYPES){
  const observations=[];
  for(const scenario of scenarios){
    const options={type:definition.id,origin:[29,.5,7],time:0,seed:scenario.seed,azimuth:scenario.azimuth,elevation:scenario.elevation,starDragModel:'bounded-descent',...(scenario.burstOrientation?{burstOrientation:scenario.burstOrientation}:{})};
    const e=createFireworkEvent(options),timeline=[{time:-Infinity,wind:scenario.wind}],all=[...(e.rocket?[e.rocket]:[]),...e.heads,...(e.opticalFlashes??[])];
    const box=emptyBox(),visibleBox=emptyBox(),parts={},critical=new Set([e.time,e.burstTime,e.endTime]),seenParts=new Set();
    let maximumEndRemainder=0,parentPositionError=0,parentVelocityError=0,maximumMotorKnotPositionJump=0,maximumMotorKnotVelocityJump=0,pruneSlack=Infinity;
    for(const b of all){
      const duration=b.sourceStyle?.tailSeconds??(b.trailProfile?.durationSeconds??(b.kind==='rocket'?.5:b.trail?.88:0));
      pruneSlack=Math.min(pruneSlack,e.endTime-(b.birth+b.life+duration));
      critical.add(b.birth);critical.add(b.birth+b.life);
      for(const k of b.sourceStyle?.envelopeKnots??[])critical.add(b.birth+k.age);
      for(const k of b.sourceStyle?.colourKnots??[])critical.add(b.birth+k.age);
      for(const c of b.displayMotor?.cells??[]){
        critical.add(b.birth+c.from);critical.add(b.birth+c.to);
        const a=sampleBody(b,b.birth+c.to-EPS,timeline),z=sampleBody(b,b.birth+c.to+EPS,timeline);
        maximumMotorKnotPositionJump=Math.max(maximumMotorKnotPositionJump,Math.hypot(...a.position.map((v,i)=>z.position[i]-v)));
        maximumMotorKnotVelocityJump=Math.max(maximumMotorKnotVelocityJump,Math.hypot(...a.velocity.map((v,i)=>z.velocity[i]-v)));
      }
      if(b.parentBody){const parent=sampleBody(b.parentBody,b.birth,timeline),child=sampleBody(b,b.birth,timeline);parentPositionError=Math.max(parentPositionError,Math.hypot(...parent.position.map((v,c)=>child.position[c]-v)));const expected=parent.velocity.map((v,c)=>v*(b.parentVelocityFraction??1)+b.velocityDelta[c]);parentVelocityError=Math.max(parentVelocityError,Math.hypot(...expected.map((v,c)=>child.velocity[c]-v)));}
      const part=b.patternPart??b.kind;if(!parts[part])parts[part]={count:0,birthRange:[Infinity,-Infinity],endRange:[Infinity,-Infinity],firstPositive:null,lastAbove1e4:null,thresholdMeaning:'envelope > 1e-4 is a CPU diagnostic only, not display visibility'};
      const p=parts[part];p.count++;p.birthRange=[Math.min(p.birthRange[0],b.birth),Math.max(p.birthRange[1],b.birth)];p.endRange=[Math.min(p.endRange[0],b.birth+b.life),Math.max(p.endRange[1],b.birth+b.life)];
      for(let i=0;i<=Math.ceil(b.life/DT);i++){
        const age=Math.min(b.life,i*DT),time=b.birth+age,s=sampleBody(b,time,timeline),v=bodyEmissionEnvelope(b,age);samples++;
        if(!finiteState(s))nonfinite++;if(!Number.isFinite(v)||v<0||v>1+1e-12)invalidEnvelopes++;
        include(box,s.position);if(v>1e-4&&s.position[1]>=.03){include(visibleBox,s.position);seenParts.add(part);p.firstPositive=p.firstPositive===null?time:Math.min(p.firstPositive,time);p.lastAbove1e4=p.lastAbove1e4===null?time:Math.max(p.lastAbove1e4,time);}
      }
      const nearEnd=bodyEmissionEnvelope(b,b.life-EPS);maximumEndRemainder=Math.max(maximumEndRemainder,nearEnd);
      if(bodyEmissionEnvelope(b,-EPS)!==0)unexpectedEmissionBeforeBirth++;
    }
    const criticalRows=[];
    for(const clock of [...critical].sort((a,b)=>a-b)){
      for(const time of [clock-EPS,clock,clock+EPS]){
        let positive=0,airbornePositive=0;
        for(const b of all){const age=time-b.birth;if(age<0||age>b.life)continue;const s=sampleBody(b,time,timeline),v=bodyEmissionEnvelope(b,age);boundarySamples++;if(!finiteState(s))nonfinite++;if(!Number.isFinite(v)||v<0||v>1+1e-12)invalidEnvelopes++;if(v>0){positive++;if(s.position[1]>=.03)airbornePositive++;}}
        criticalRows.push({time,positive,airbornePositive});
      }
    }
    const audio=e.events.concat(e.audioEvents??[]);for(const a of audio)if(a.time>e.endTime)issues.push({type:e.type,scenario:scenario.id,kind:'audio-after-prune',time:a.time});
    if(parentPositionError>1e-8||parentVelocityError>1e-8)issues.push({type:e.type,scenario:scenario.id,kind:'parent-child-discontinuity',parentPositionError,parentVelocityError});
    if(pruneSlack<-.000001)issues.push({type:e.type,scenario:scenario.id,kind:'declared-tail-past-event-prune',pruneSlack});
    observations.push({scenario:scenario.id,seed:scenario.seed,azimuth:scenario.azimuth,elevation:scenario.elevation,wind:scenario.wind,heads:e.heads.length,flashes:e.opticalFlashes?.length??0,burstTime:e.burstTime,endTime:e.endTime,latestPhysicalEnd:Math.max(...all.map(b=>b.birth+b.life)),conservativeTailPruneSlack:pruneSlack,parentPositionError,parentVelocityError,maximumMotorKnotPositionJump,maximumMotorKnotVelocityJump,maximumEndEnvelopeBeforeEpsilon:maximumEndRemainder,parts,partsEverAboveDiagnosticThreshold:[...seenParts],bodyCentreBounds:box,aboveSurfaceDiagnosticBounds:visibleBox,criticalClockCount:critical.size,boundaryRows:criticalRows});
  }
  // Exercise actual scheduler, all deferred clocks, and exactly-once delivery.
  const scheduler=[];
  for(const fps of [30,60,120]){
    const sim=createFireworksSimulation();sim.configure({type:definition.id,autoLaunch:false,autoDirection:false,azimuth:104,elevation:80,launchSpreadDegrees:0,burstTiltDegrees:0,burstRollDegrees:0});
    sim.launch({seed:619});const e=sim.active[0],expected=e.events.length+(e.audioEvents?.length??0),end=e.endTime;let delivered=sim.drainEvents().length;
    for(let i=0;i<=Math.ceil((end+.1)*fps);i++){sim.update({time:i/fps,windVector:[1.8,0,.3]});delivered+=sim.drainEvents().length;}
    scheduler.push({fps,expected,delivered,activeAfterEnd:sim.active.length});if(expected!==delivered||sim.active.length!==0)issues.push({type:definition.id,kind:'scheduler-delivery-or-prune',fps,expected,delivered,activeAfterEnd:sim.active.length});
  }
  rows.push({type:definition.id,label:definition.label,complex:definition.collection==='large-choreographed',observations,scheduler});
}
const archived=[];
for(const path of ['verification/complex-fireworks/physics-check.json','verification/complex-fireworks/all-styles-gpu-result.json','verification/choreography-polish/all-styles-gpu-result.json','verification/choreography-polish/verification-summary.json']){
  const p=JSON.parse(read(path)),pins=p.sourcePins??p.sourceHashes??{};
  const comparisons=Object.entries(pins).filter(([name])=>sourceNames.includes(name)).map(([name,recorded])=>({name,recorded,current:initialPins[name],matches:recorded.toLowerCase()===initialPins[name]}));
  const counts=(p.rows??[]).filter(r=>r.type).map(r=>({type:r.type,recorded:r.physicalHeads,current:rows.find(x=>x.type===r.type)?.observations[0].heads}));
  archived.push({path,recordedPassed:p.passed??null,actualGPU:p.actualGPU??false,hasProductionSourcePins:comparisons.length>0,comparisons,physicalHeadCounts:counts,scope:p.scope??null,currentStatus:'historical evidence only; source pin absence or drift prevents treating the saved pass as a current runtime pass'});
}
const finalPins=sourcePins(),stable=JSON.stringify(initialPins)===JSON.stringify(finalPins);
const report={schema:'glass-atoll.full-lifecycle-cpu-audit.v1',createdDate:'2026-10-31',passed:stable&&nonfinite===0&&invalidEnvelopes===0&&unexpectedEmissionBeforeBirth===0&&issues.length===0,counts:{types:rows.length,complexTypes:rows.filter(r=>r.complex).length,scenarios:scenarios.length,physicalSamples:samples,boundarySamples,nonfinite,invalidEnvelopes,unexpectedEmissionBeforeBirth,issues:issues.length},sourceStableDuringRun:stable,sourcePins:initialPins,finalSourcePins:finalPins,scenarios,rows,issues,archivedEvidence:archived,limits:['CPU production event constructor, body sampler, envelope sampler and scheduler only; no browser or GPU started.','Every body is sampled at30Hz plus all declared birth, end, colour, envelope and motor-force clock boundaries +/-1 microsecond. This is finite sampling, not a continuous interval proof.','Wind is a held uniform field in each of three representative scenarios; no claim of every seed or possible wind history.','Physical centre bounds exclude render footprints, shutter, bloom, camera framing and actual visibility.','A zero/positive envelope test cannot establish subjective extinction, colour, motion quality, sound quality, HDR mapping or frame rate.','Historical GPU JSON is preserved. Saved success is not reused as current evidence when pins are absent or changed.']};
fs.writeFileSync(new URL('./lifecycle-audit.json',import.meta.url),JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({passed:report.passed,counts:report.counts,sourceStableDuringRun:stable,issues:report.issues},null,2));
if(!report.passed)process.exitCode=1;
