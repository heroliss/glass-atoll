import fs from 'node:fs';
import crypto from 'node:crypto';
import {createFireworkEvent,sampleBody,sampleBodyEmission} from '../fireworks-physics.js';
const summaries=[];
for(const elevation of [25,45,60,78,90]){
 let liveGround=0,nearGround=0,minLiveY=Infinity,maxMissingI=0,bursts=[];
 for(let seed=1;seed<=8;seed++){
  const e=createFireworkEvent({type:'chrysanthemum',effectProfile:'three-heart-v1',seed,elevation,starDragModel:'bounded-descent'});bursts.push(e.burstPosition[1]);
  for(const b of e.heads)for(let j=0;j<=80;j++){
   const age=b.life*j/80,I=sampleBodyEmission(b,age).intensityCdReference;
   if(I<=0)continue;const p=sampleBody(b,b.birth+age).position;
   minLiveY=Math.min(minLiveY,p[1]);if(p[1]<.03){liveGround++;maxMissingI=Math.max(maxMissingI,I);}if(p[1]<1)nearGround++;
  }
 }
 summaries.push({elevation,minBurstY:Math.min(...bursts),maxBurstY:Math.max(...bursts),minLiveY,liveGround,nearGround,maxMissingI});
}
const hash=p=>crypto.createHash('sha256').update(fs.readFileSync(new URL('../'+p,import.meta.url))).digest('hex');
const report={schema:'glass-atoll.r19-ground-support-audit.v1',date:new Date().toISOString(),status:'known-reachable-ground-cutoff-defect-reproduced',productionCompleteness:false,sources:{fireworks:hash('fireworks.js'),physics:hash('fireworks-physics.js')},scope:{effects:['three-heart-v1'],drag:'bounded-descent',seeds:[1,2,3,4,5,6,7,8],agesPerBody:81,rootCount:192,defaultCreateEventOrigin:[29,.5,7],wind:'zero',gpu:false,productionEdited:false},summaries,interpretation:['These are finite CPU samples, not continuous minima or a complete seed/parameter proof.','At the default 78 degree direction all sampled live heads remain high above water; this particular limitation does not invalidate that native visual case.','The supported 25 degree direction yields live sources below the current Y cutoff, so the acknowledged ground/history issue is reachable with exposed controls.','fireworks.js lines517 and525 filter using current Y before optical history construction; this audit does not implement or validate physical ground/water collision or interval clipping.','Intensity values are authored reference photopic head cd before the profile head fraction; not measured fireworks photometry.']};
fs.writeFileSync(new URL('./r19-ground-support-audit.json',import.meta.url),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report,null,2));
