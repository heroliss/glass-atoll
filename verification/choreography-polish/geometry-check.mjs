import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createFireworkEvent,sampleBody,seededRandom} from '../../fireworks-physics.js';
import {COMPLEX_TYPE_LIMITS} from '../../complex-fireworks.js';
const baseline=fs.readFileSync(new URL('./before/complex-fireworks.js',import.meta.url),'utf8').replace(/from '(\.\/[^']+)'/g,(_,p)=>`from '${new URL(p,new URL('../../complex-fireworks.js',import.meta.url)).href}'`);
const old=await import('data:text/javascript;base64,'+Buffer.from(baseline).toString('base64'));
const checks=[];const test=(name,fn)=>{try{checks.push({name,passed:true,evidence:fn()});}catch(error){checks.push({name,passed:false,error:String(error),stack:error.stack});}};
const origin=[0,1,0],basis={right:[1,0,0],up:[0,1,0],normal:[0,0,-1]},make=type=>createFireworkEvent({type,origin,azimuth:0,elevation:80,seed:619,starDragModel:'bounded-descent'});
const before=(type,e)=>old.buildComplexFirework(type,{eventId:e.id,origin,time:0,burstTime:e.burstTime,burstState:e.baselineBurst,basis,rotateBurst:v=>v,rng:seededRandom(619),seed:619,rocket:e.rocket??{}});
const maxAbs=v=>Math.max(...v.map(Math.abs));
test('one continuous ground sector crosses its centre and reverses smoothly for19 seconds',()=>{
  const e=make('display-vfan'),angles=e.heads.map(b=>Math.atan2(b.velocity[0],b.velocity[1])*180/Math.PI),steps=angles.slice(1).map((x,i)=>x-angles[i]);
  assert.equal(e.heads.length,128);assert.equal(new Set(e.heads.map(b=>b.birth)).size,128);assert(Math.abs(e.heads.at(-1).birth-19.05)<1e-10);
  assert(Math.min(...angles)<-37&&Math.max(...angles)>37);assert(maxAbs(angles)<38.5);assert(maxAbs(steps)<8.5);
  const centreCrossings=angles.slice(1).filter((x,i)=>x*angles[i]<0).length;assert.equal(centreCrossings,8);
  let reversals=0;for(let i=1;i<steps.length;i++)if(steps[i]*steps[i-1]<0)reversals++;assert(reversals>=7&&reversals<=9);
  assert(e.heads.every(b=>Math.abs(Math.hypot(...b.velocity)-42)<1e-10));assert.deepEqual(e,make('display-vfan'));
  const oldAngles=before('display-vfan',e).heads.map(b=>Math.atan2(b.velocity[0],b.velocity[1])*180/Math.PI),oldStep=maxAbs(oldAngles.slice(1).map((x,i)=>x-oldAngles[i]));assert(oldStep>40);
  return{shots:e.heads.length,duration:19.05,centreCrossings,reversals,maximumAdjacentDegrees:maxAbs(steps),previousMaximumAdjacentDegrees:oldStep};
});
test('longer ground show does not increase simultaneous burning heads per event',()=>{
  const e=make('display-vfan'),oldBodies=before('display-vfan',e).heads;let now=0,previous=0;for(let t=0;t<26;t+=.01){now=Math.max(now,e.heads.filter(b=>t>=b.birth&&t<b.birth+b.life).length);previous=Math.max(previous,oldBodies.filter(b=>t>=b.birth&&t<b.birth+b.life).length);}assert(now<=25&&now<previous);return{currentMaximum:now,previousMaximum:previous};
});
test('waterfall actually releases from a nearly horizontal moving parent and falls much farther',()=>{
  const e=make('display-waterfall'),carrier=e.heads[0],children=e.heads.slice(1),oldBodies=before('display-waterfall',e).heads,wind=[{time:-Infinity,wind:[0,0,0]}];
  assert.equal(children.length,192);const start=sampleBody(carrier,carrier.birth,wind),end=sampleBody(carrier,carrier.birth+carrier.life,wind);const horizontal=Math.hypot(end.position[0]-start.position[0],end.position[2]-start.position[2]);assert(horizontal>120);assert(Math.abs(end.position[1]-start.position[1])<20);
  let minimumDrop=Infinity,maximumDrop=0,minimumEndY=Infinity;for(const b of children){assert(b.parentBody===carrier&&b.parentVelocityFraction===.25);assert(b.birth>carrier.birth&&b.birth<carrier.birth+carrier.life);assert(b.life>=5.6&&b.life<=6.1);assert(b.radius>=.004&&b.radius<=.006&&b.intensity>=3.2&&b.intensity<=5);const s=sampleBody(b,b.birth,wind),p=sampleBody(carrier,b.birth,wind);assert(s.position.every((v,c)=>Math.abs(v-p.position[c])<1e-9));const late=sampleBody(b,b.birth+b.life*.93,wind);minimumDrop=Math.min(minimumDrop,s.position[1]-late.position[1]);maximumDrop=Math.max(maximumDrop,s.position[1]-late.position[1]);minimumEndY=Math.min(minimumEndY,late.position[1]);}
  assert(minimumDrop>70);assert(minimumEndY>20);assert(children[0].life>oldBodies[1].life*1.6);assert(COMPLEX_TYPE_LIMITS['display-waterfall'].maximumBodySeconds>=Math.max(...children.map(b=>b.birth-e.burstTime+b.life)));
  return{horizontalCarrierMetres:horizontal,minimumLateDropMetres:minimumDrop,maximumLateDropMetres:maximumDrop,minimumLateWorldY:minimumEndY,oldChildLife:oldBodies[1].life,currentChildLifeRange:[Math.min(...children.map(b=>b.life)),Math.max(...children.map(b=>b.life))],tailCarrierCount:e.heads.filter(b=>b.sourceStyle.tailFraction>0).length};
});
test('reference planar patterns use fewer irregular seeded points and independent burn durations',()=>{
  const result=[];for(const type of ['display-saturn','display-heart','display-flower']){
    const e=make(type),plane=e.heads.filter(b=>b.patternPart.endsWith('-plane'));assert.equal(e.heads.length,256);assert.equal(plane.length,48);assert.deepEqual(e,make(type));assert(new Set(plane.map(b=>b.life)).size>40);assert(plane.every(b=>b.life===b.sourceStyle.life&&b.life>4.6&&b.life<5.1));assert(new Set(plane.map(b=>b.intensity)).size>40);assert(plane.every(b=>b.sourceStyle.tailFraction<=.1));assert(plane.some(b=>Math.abs(b.velocity[2]-e.baselineBurst.velocity[2])>.1));
    const other=createFireworkEvent({type,origin,azimuth:0,elevation:80,seed:620,starDragModel:'bounded-descent'});assert.notDeepEqual(e.heads.map(b=>b.velocity),other.heads.map(b=>b.velocity));result.push({type,planeCount:48,formerPlaneCount:64,minimumLife:Math.min(...plane.map(b=>b.life)),maximumLife:Math.max(...plane.map(b=>b.life))});
  }return result;
});
const report={schema:'glass-atoll.choreography-polish.geometry.v1',passed:checks.every(c=>c.passed),counts:{passed:checks.filter(c=>c.passed).length,total:checks.length},checks,scope:'Actual production events. Before builder shares current curve code only to isolate geometry; no raster, visual or FPS claim.'};
fs.writeFileSync(new URL('./geometry-check.json',import.meta.url),JSON.stringify(report,null,2));console.log(JSON.stringify({passed:report.passed,counts:report.counts,failed:checks.filter(c=>!c.passed).map(c=>({name:c.name,error:c.error}))}));if(!report.passed)process.exitCode=1;
