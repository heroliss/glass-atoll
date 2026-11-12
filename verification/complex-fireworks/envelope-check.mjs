import assert from 'node:assert/strict';
import fs from 'node:fs';
import crypto from 'node:crypto';
import {FIREWORK_TYPES,createFireworkEvent,sampleBody,sampleFireworkEvent} from '../../fireworks-physics.js';
import {COMPLEX_FIREWORK_TYPES} from '../../complex-fireworks.js';
import {getFireworkShowEnvelope} from '../../firework-show-envelope.js';
const root=new URL('../../',import.meta.url),load=async(name)=>{const source=fs.readFileSync(new URL('./before/'+name,import.meta.url),'utf8').replace(/from '(\.\/[^']+)'/g,(_,s)=>`from '${new URL(s,new URL(name,root)).href}'`);return import('data:text/javascript;base64,'+Buffer.from(source).toString('base64'));};
const old=await load('firework-show-envelope.js'),checks=[],failures=[];let sampledPositions=0;
function check(name,fn){try{checks.push({name,passed:true,evidence:fn()});}catch(e){checks.push({name,passed:false,error:String(e.stack||e)});failures.push(name);}}
const settings={elevation:78,launchSpreadDegrees:3,burstTiltDegrees:12,burstRollDegrees:8,starDragModel:'bounded-descent'};
for(const d of FIREWORK_TYPES.filter(t=>!t.id.startsWith('display-')))check('legacy forecast exact '+d.id,()=>{const o={type:d.id,settings,origin:[29,.47,7],muzzleOffsetMetres:.66,azimuth:103};assert.deepEqual(getFireworkShowEnvelope(o),old.getFireworkShowEnvelope(o));return{schemaAndNumbersExact:true};});
for(const d of COMPLEX_FIREWORK_TYPES)check('new physical forecast '+d.id,()=>{
 const rows=[];
 for(const auto of [false,true]){
  const wind={min:[-5,0,-5],max:[5,0,5]},envelope=getFireworkShowEnvelope({type:d.id,settings:{...settings,autoLaunch:auto,randomLaunchTilt:auto,automaticTiltMinDegrees:-65,automaticTiltMaxDegrees:65},origin:[29,.47,7],muzzleOffsetMetres:.66,azimuth:103,wind});
  assert(envelope.limits.display);assert.equal(envelope.limits.tailSeconds,.88);
  for(const theta of auto?[-65,-40,0,40,65]:[9,12,15])for(const seed of [0,1,14271])for(const w of [[0,0,0],[5,0,-5],[-5,0,5]]){
   const azimuth=103+(auto&&theta<0?180:0),elevation=90-Math.abs(theta),a=azimuth*Math.PI/180,e=elevation*Math.PI/180,axis=[Math.sin(a)*Math.cos(e),Math.sin(e),-Math.cos(a)*Math.cos(e)],origin=[29,.47,7].map((v,c)=>v+axis[c]*.66);
   const event=createFireworkEvent({type:d.id,seed,origin,azimuth,elevation,starDragModel:'bounded-descent',burstOrientation:{tiltDegrees:45,rollDegrees:30}}),timeline=[{time:-Infinity,wind:w}];
   sampleFireworkEvent(event,event.burstTime,{windTimeline:timeline,smoke:false,stars:false});
   for(const b of [...(event.rocket?[event.rocket]:[]),...event.heads])for(let i=0;i<=12;i++){
    const p=sampleBody(b,b.birth+b.life*i/12,timeline).position;
    if(p[1]<.03)continue;
    for(let c=0;c<3;c++)assert(p[c]>=envelope.min[c]-1e-8&&p[c]<=envelope.max[c]+1e-8,`${d.id} auto${auto} theta${theta} seed${seed} b${b.id} c${c} ${p[c]} outside${envelope.min[c]}..${envelope.max[c]}`);
    sampledPositions++;
   }
  }
  rows.push({automaticFan:auto,width:envelope.max.map((v,c)=>v-envelope.min[c]),carrierInheritedMotorSpeedBound:envelope.limits.display.carrierInheritedMotorSpeedBoundMetresPerSecond});
 }
 return rows;
});
const report={passed:!failures.length,total:checks.length,failed:failures,sampledPositions,scope:'CPU counterexample search at independent seeds, signed-tilt extremes, wind corners and real parents/children/motors; complements declared analytic generator limits. No GPU/image/performance claim.',sourceSHA256:crypto.createHash('sha256').update(fs.readFileSync(new URL('../../firework-show-envelope.js',import.meta.url))).digest('hex'),checks};
fs.writeFileSync(new URL('./envelope-check.json',import.meta.url),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({passed:report.passed,total:checks.length,sampledPositions,failed:failures}));if(failures.length)process.exitCode=1;
