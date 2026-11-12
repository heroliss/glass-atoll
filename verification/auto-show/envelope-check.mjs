import assert from 'node:assert/strict';
import fs from 'node:fs';
import crypto from 'node:crypto';
import {FIREWORK_TYPES,createFireworkEvent,sampleBody} from '../../fireworks-physics.js';
import {fireworkAutomaticTiltBounds,getFireworkShowEnvelope} from '../../firework-show-envelope.js';

const oldSource=fs.readFileSync(new URL('./before/firework-show-envelope.js',import.meta.url),'utf8');
const oldModule=oldSource.replace(/from '(\.\/[^']+)'/g,(_,specifier)=>`from '${new URL(specifier,new URL('../../firework-show-envelope.js',import.meta.url)).href}'`);
const {getFireworkShowEnvelope:oldEnvelope}=await import('data:text/javascript;base64,'+Buffer.from(oldModule).toString('base64'));
const hash=s=>crypto.createHash('sha256').update(s).digest('hex');
const checks=[];
const settings={elevation:78,launchSpreadDegrees:3,burstTiltDegrees:12,burstRollDegrees:8,starDragModel:'bounded-descent'};
for(const azimuth of [0,103,180,270])for(const interval of [[-40,40],[-65,65],[-40,-10],[0,0],[10,40]]){
  const c=fireworkAutomaticTiltBounds(azimuth,...interval);
  for(let i=0;i<=1000;i++){
    const theta=(interval[0]+(interval[1]-interval[0])*i/1000)*Math.PI/180,a=azimuth*Math.PI/180,d=[Math.sin(a)*Math.sin(theta),Math.cos(theta),-Math.cos(a)*Math.sin(theta)];
    d.forEach((v,k)=>assert(v>=c.components[k][0]-1e-14&&v<=c.components[k][1]+1e-14));
  }
  checks.push({name:'continuous signed axis interval',azimuth,interval,passed:true});
}
let sampledPositions=0;
const windTimeline=[{time:-Infinity,wind:[4.68,0,1.76]}];
for(const type of FIREWORK_TYPES.map(t=>t.id)){
  const options={type,settings,origin:[29,.47,7],muzzleOffsetMetres:.66,azimuth:103};
  // Disabled automatic mode must retain every incumbent field/value exactly.
  assert.deepEqual(getFireworkShowEnvelope(options),oldEnvelope(options));
  assert.deepEqual(getFireworkShowEnvelope({...options,settings:{...settings,autoLaunch:false,randomLaunchTilt:true,automaticTiltMinDegrees:-65,automaticTiltMaxDegrees:65}}),oldEnvelope(options));
  const envelope=getFireworkShowEnvelope({...options,settings:{...settings,autoLaunch:true,randomLaunchTilt:true,automaticTiltMinDegrees:-65,automaticTiltMaxDegrees:65}});
  for(const theta of [-65,-40,0,40,65])for(const seed of [1,14271]){
    const azimuth=103+(theta<0?180:0),elevation=90-Math.abs(theta),a=azimuth*Math.PI/180,e=elevation*Math.PI/180;
    const axis=[Math.sin(a)*Math.cos(e),Math.sin(e),-Math.cos(a)*Math.cos(e)],origin=options.origin.map((v,k)=>v+axis[k]*.66);
    const event=createFireworkEvent({type,origin,azimuth,elevation,seed,starDragModel:'bounded-descent'});
    for(const body of [...(event.rocket?[event.rocket]:[]),...event.heads])for(let j=0;j<=8;j++){
      const p=sampleBody(body,body.birth+body.life*j/8,windTimeline).position;
      if(p[1]<.03)continue;
      for(let c=0;c<3;c++)assert(p[c]>=envelope.min[c]-1e-8&&p[c]<=envelope.max[c]+1e-8,`${type} theta${theta} axis${c}: ${p[c]} outside ${envelope.min[c]}..${envelope.max[c]}`);
      sampledPositions++;
    }
  }
  checks.push({name:'manual exact compatibility + signed real trajectories enclosed',type,passed:true});
}
assert.throws(()=>fireworkAutomaticTiltBounds(0,-66,0));
assert.throws(()=>fireworkAutomaticTiltBounds(0,40,-40));
const report={passed:true,total:checks.length,sampledPositions,checks,scope:'Analytic continuous axis interval plus independent real-body edge/sample checks; no GPU, camera occlusion, dense capacity or performance claim',sourceSHA256:hash(fs.readFileSync(new URL('../../firework-show-envelope.js',import.meta.url),'utf8')),baselineSHA256:hash(oldSource)};
fs.writeFileSync(new URL('./envelope-check.json',import.meta.url),JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({passed:true,total:checks.length,sampledPositions}));
