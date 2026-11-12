// PLAN evidence only. CPU actual ledger + original logical source clocks.
// This does not create a graphics context or invoke a renderer.
import fs from 'node:fs';
import * as THREE from '../vendor/three.module.js';
import {createFireworks} from '../fireworks.js';
import {buildLogicalBurnProfile,logicalBurnCell} from '../pyro-smoke-logical-burn.js';
const fw=createFireworks(THREE,{origin:[29,0,7],terrainHeight:()=>0});
try{
  fw.configure({type:'chrysanthemum',effectProfile:'powered-bees-v1',autoLaunch:false,autoDirection:false,azimuth:110,elevation:78,launchSpreadDegrees:0,burstTiltDegrees:27,burstRollDegrees:20,starDragModel:'bounded-descent'});
  fw.update({time:0,windVector:[0,0,0]});const launch=fw.launch({seed:42}),graph=fw.smokeSourceProvider.describeCombustion(launch.id),profile=buildLogicalBurnProfile(graph),cells=profile.streams.flatMap((s,i)=>Array.from({length:s.count},(_,j)=>logicalBurnCell(profile,i,j).time)).sort((a,b)=>a-b),rows=[];
  for(let n=0;n<=160;n++){
    const age=n/20,time=launch.burstTime+age;fw.update({time,windVector:[1.6848,0,.6336]});const ledger=fw.getEmissionLedger(),committedTime=Math.floor((time+1e-10)*20)/20,densityPackets=cells.filter(t=>t<=committedTime+1e-10).length;
    rows.push({age,time,committedTime,densityPackets,ledgerSources:ledger.count,resolvedPairs:densityPackets*ledger.count});
  }
  const peakResolved=rows.reduce((a,b)=>b.resolvedPairs>a.resolvedPairs?b:a),report={schema:'glass-atoll.r23-one-candidate-pair-envelope-cpu.v1',actualGPU:false,fixture:{seed:42,azimuth:110,elevation:78,tilt:27,roll:20,starDragModel:'bounded-descent',effectProfile:'powered-bees-v1',trailSegments:10,airSurface:false,M:profile.budget.total,totalLogicalCells:cells.length,sourceClock:'20Hz committed physical density; material cells unchanged'},peakResolved,sampledRows:rows,limits:['Factory default N10, no contact surface; NOT reproduction of the root medium N8 native render.','Physical current emission ledger only; not optical S>0 row split/clip count or actual sourceT count.','Counts source cells by exact original logical clocks; no density Gaussian transport or mutation.','One fixture sampled at20Hz; not a bound over arbitrary seeds/settings/events.']};
  fs.writeFileSync(new URL('./r23-one-candidate-pair-envelope-cpu.json',import.meta.url),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({actualGPU:false,totalLogicalCells:cells.length,peakResolved},null,2));
}finally{fw.dispose();}
