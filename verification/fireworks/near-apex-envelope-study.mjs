// Research-only local event copies. No factory/main/physics source writes.
import fs from 'node:fs';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import {FIREWORK_TYPES,createFireworkEvent,sampleBody,sampleFireworkEvent,starEnvelope,apexLaunch} from '../../fireworks-physics.js';
const source=fs.readFileSync(new URL('../../fireworks-physics.js',import.meta.url)),hash=b=>crypto.createHash('sha256').update(b).digest('hex'),seeds=[1,11,42,73,14271,12345,2654450032,4294967295],origin=[0,1.5,0],floor=.03,visualMargin=10,checks=[],cases=[];
const near=(a,b,t=1e-9)=>assert(Math.abs(a-b)<=t,`${a} vs${b}`),test=(name,fn)=>{try{checks.push({name,passed:true,evidence:fn()});}catch(error){checks.push({name,passed:false,error:String(error.stack||error)});}};
function lightInterval(b,threshold){
  const value=t=>b.intensity*starEnvelope(b,t)-threshold;
  // Find the last actual bright interval; strobe is not a monotonic envelope.
  let last=null;
  if(b.strobe){const dt=.001;for(let age=b.life-dt;age>=0;age-=dt)if(value(age)>=0){last=age;break;}}
  else if(value(Math.min(.028,b.life*.1))>=0)last=Math.min(.028,b.life*.1);
  if(last===null)return null;
  let lo=last,hi=b.strobe?Math.min(b.life,last+.001):b.life;
  for(let i=0;i<45;i++){const mid=(lo+hi)*.5;if(value(mid)>=0)lo=mid;else hi=mid;}
  let firstHi=Math.min(.028,b.life*.1);
  if(b.strobe){firstHi=null;for(let age=.001;age<b.life;age+=.001)if(value(age)>=0){firstHi=age;break;}if(firstHi===null)return null;}
  let firstLo=b.strobe?Math.max(0,firstHi-.001):0;
  for(let i=0;i<45;i++){const mid=(firstLo+firstHi)*.5;if(value(mid)>=0)firstHi=mid;else firstLo=mid;}
  return{first:firstHi,last:lo,lastIntensity:b.intensity*starEnvelope(b,lo),firstIntensity:b.intensity*starEnvelope(b,firstHi)};
}
function horizontalSpread(event,age,timeline){
  const time=event.burstTime+age,points=event.heads.filter(b=>time>=b.birth&&time<b.birth+b.life).map(b=>sampleBody(b,time,timeline).position);
  if(!points.length)return{alive:0,centroidRadiusXZ:0,diameterXZ:0};
  const c=[0,0,0];for(const p of points)for(let k=0;k<3;k++)c[k]+=p[k]/points.length;
  let r=0,d=0;for(let i=0;i<points.length;i++){r=Math.max(r,Math.hypot(points[i][0]-c[0],points[i][2]-c[2]));for(let j=0;j<i;j++)d=Math.max(d,Math.hypot(points[i][0]-points[j][0],points[i][2]-points[j][2]));}
  return{alive:points.length,centroidRadiusXZ:r,diameterXZ:d};
}
function analyse({type,seed=42,elevation=80,wind=0,height,dragOverride,lifeScale=1}={}){
  const e=createFireworkEvent({type,seed,elevation,azimuth:104,origin,...(height!==undefined?{height}:{})}),timeline=[{time:-Infinity,wind:[wind*.936,0,wind*.352]}];
  sampleFireworkEvent(e,e.burstTime,{windTimeline:timeline,smoke:false});
  for(const b of e.heads){if(dragOverride!==undefined)b.drag=dragOverride;if(lifeScale!==1&&!b.split)b.life*=lifeScale;}
  const Iref=Math.max(...e.heads.map(b=>b.intensity)),minima={geometry:{y:Infinity},I01:{y:Infinity},I10:{y:Infinity}},rootLives=e.heads.filter(b=>!b.parentBody).map(b=>b.life),allLives=e.heads.map(b=>b.life);let maxY=-Infinity;
  for(const b of e.heads){
    const start=sampleBody(b,b.birth,timeline),end=sampleBody(b,b.birth+b.life,timeline),k=b.drag??.2,vy=start.velocity[1],g=b.gravity??9.81;
    const stationary=vy>0?(k>1e-8?Math.log1p(k*vy/g)/k:vy/g):0,at=Math.max(0,Math.min(b.life,stationary));maxY=Math.max(maxY,start.position[1],end.position[1],sampleBody(b,b.birth+at,timeline).position[1]);
    const update=(key,t)=>{const p=sampleBody(b,b.birth+t,timeline).position;if(p[1]<minima[key].y)minima[key]={y:p[1],bodyId:b.id,relativeAge:t,eventAge:b.birth+t-e.burstTime,referenceIntensity:b.intensity*starEnvelope(b,t)};};
    update('geometry',0);update('geometry',b.life);
    for(const [name,q]of [['I01',.01],['I10',.1]]){const interval=lightInterval(b,Iref*q);if(interval){update(name,interval.first);update(name,interval.last);}}
  }
  const burstY=e.burstPosition[1],burstVY=e.baselineBurst.velocity[1],rise=burstY-origin[1],required={};for(const [key,value]of Object.entries(minima))required[key]=e.definition.ground?null:{additionalHeightFor10mVisualClearance:Math.max(0,floor+visualMargin-value.y),minimumBurstRiseFor10mVisualClearance:rise+floor+visualMargin-value.y};
  return{type,seed,elevation,wind,parameters:{heightWorldY:height??null,dragOverride:dragOverride??null,lifeScale},ground:!!e.definition.ground,defaultReferenceRise:e.definition.ground?null:e.definition.height,flightSeconds:e.burstTime-e.time,burstY,burstVY,rise,maxY,bodyCount:e.heads.length,rootLifeRange:[Math.min(...rootLives),Math.max(...rootLives)],allLifeRange:[Math.min(...allLives),Math.max(...allLives)],dragRange:[Math.min(...e.heads.map(b=>b.drag)),Math.max(...e.heads.map(b=>b.drag))],minima,required,spread:{at1_1:horizontalSpread(e,1.1,timeline),at2:horizontalSpread(e,2,timeline)},eventEndAge:e.endTime-e.burstTime,Iref};
}
for(const type of FIREWORK_TYPES.map(t=>t.id))for(const seed of seeds)for(const elevation of [80,78,25])cases.push(analyse({type,seed,elevation}));
const summarise=elevation=>FIREWORK_TYPES.map(t=>{const rows=cases.filter(r=>r.type===t.id&&r.elevation===elevation),min=key=>Math.min(...rows.map(r=>r.minima[key].y)),needs=key=>t.ground?null:Math.max(...rows.map(r=>r.required[key].additionalHeightFor10mVisualClearance));return{type:t.id,elevation,ground:!!t.ground,referenceRise:t.ground?null:t.height,actualRise:rows[0].rise,flightSeconds:rows[0].flightSeconds,burstVY:rows[0].burstVY,dragRange:rows[0].dragRange,rootLifeRange:[Math.min(...rows.map(r=>r.rootLifeRange[0])),Math.max(...rows.map(r=>r.rootLifeRange[1]))],minGeometricY:min('geometry'),minI01Y:min('I01'),minI10Y:min('I10'),geometryLiftFor10m:needs('geometry'),I01LiftFor10m:needs('I01'),I10LiftFor10m:needs('I10'),minimumI01YWitnessAge:Math.min(...rows.map(r=>r.minima.I01.eventAge)),maxHeight:Math.max(...rows.map(r=>r.maxY))};});
const summaries=summarise(80),mainDefault78=summarise(78);
const previews=[];
for(const type of ['ring','strobe']){
  const base=analyse({type}),summary=summaries.find(r=>r.type===type),raisedRise=Math.ceil((summary.referenceRise+summary.geometryLiftFor10m)/10)*10;
  previews.push({name:type+'-raised-apex-author-preview',base,candidate:analyse({type,height:origin[1]+raisedRise}),changes:'only QA event explicit height; same near-apex criterion/life/drag/I/seed; reference product height no longer claimed'});
}
previews.push({name:'ring-drag022-author-preview',base:analyse({type:'ring'}),candidate:analyse({type:'ring',dragOverride:.22}),changes:'only QA copied star drag .16→.22; no validated real-material calibration; changes D(t), fall and wind response'});
previews.push({name:'strobe-life085-author-preview',base:analyse({type:'strobe'}),candidate:analyse({type:'strobe',lifeScale:.85}),changes:'only QA copied non-split star life×.85; source matter schedule/endTime would require coordinated contract if ever implemented'});
const longAscent=[8,10,12].map(time=>({apexTime:time,vacuumMinimumRise:.5*9.81*time*time,constantDrag075Rise:9.81/(.075*.075)*(Math.expm1(.075*time)-.075*time)}));
test('default all8aerial types burst at nearzero vertical velocity at80and25 degrees',()=>{const a=cases.filter(r=>!r.ground);for(const r of a)near(r.burstVY,0,1e-10);return{cases:a.length,maximumAbsVY:Math.max(...a.map(r=>Math.abs(r.burstVY)))};});
test('height-only author previews keep nearapex and move entire vertical envelope by burstdelta',()=>{for(const p of previews.filter(p=>p.name.includes('raised-apex'))){const dy=p.candidate.burstY-p.base.burstY;near(p.candidate.burstVY,0,1e-10);for(const key of ['geometry','I01','I10'])near(p.candidate.minima[key].y-p.base.minima[key].y,dy,1e-8);near(p.candidate.spread.at2.diameterXZ,p.base.spread.at2.diameterXZ,1e-8);}return{previews:2};});
test('horizontal5ms wind leaves vertical envelope unchanged while retaining same life clocks',()=>{const d=[];for(const type of ['ring','strobe','willow','crossette']){const a=analyse({type}),b=analyse({type,wind:5});for(const k of ['geometry','I01','I10'])near(a.minima[k].y,b.minima[k].y,1e-9);d.push({type,diameterDelta2s:b.spread.at2.diameterXZ-a.spread.at2.diameterXZ});}return d;});
test('endpoint vertical minima checked against dense independent sample ages',()=>{let worst=0;for(const type of ['ring','willow','crossette','strobe']){const e=createFireworkEvent({type,seed:42,origin}),timeline=[{time:-Infinity,wind:[0,0,0]}];for(const b of e.heads){const endpoint=Math.min(sampleBody(b,b.birth,timeline).position[1],sampleBody(b,b.birth+b.life,timeline).position[1]);for(let i=1;i<40;i++){const y=sampleBody(b,b.birth+b.life*i/40,timeline).position[1];assert(y>=endpoint-1e-10);worst=Math.min(worst,y-endpoint);}}}return{minimumInteriorMinusEndpoint:worst};});
test('lightgate first and last clocks are actually emitting including strobe rather than dark birth',()=>{let windows=0;for(const type of ['ring','strobe','fan','crossette']){const e=createFireworkEvent({type,seed:42,origin}),I=Math.max(...e.heads.map(b=>b.intensity));for(const b of e.heads)for(const q of [.01,.1]){const x=lightInterval(b,I*q);if(!x)continue;assert(x.first>0&&x.last>x.first&&x.last<b.life);assert(x.firstIntensity>=I*q-1e-10&&x.lastIntensity>=I*q-1e-10);windows++;}}return{windows};});
test('long nearapex ascent implies a different height scale than120m',()=>{const launch=apexLaunch(120);assert(launch.time<6);assert(longAscent[1].vacuumMinimumRise>490);return{apex120:launch.time,longAscent};});
test('runtime physics bytes are unchanged by study',()=>{assert.equal(hash(fs.readFileSync(new URL('../../fireworks-physics.js',import.meta.url))),hash(source));return{physicsSHA256:hash(source)};});
const report={schema:'glass-atoll.near-apex-envelope-study.v1',dateUTC:new Date().toISOString(),researchOnly:true,passed:checks.every(c=>c.passed),counts:{total:checks.length,passed:checks.filter(c=>c.passed).length},checks,sourceSHA256:hash(source),helperSHA256:hash(fs.readFileSync(new URL(import.meta.url))),contract:{seeds,origin,angles:[80,78,25],wind:'base0; separate held horizontal5m/s check',floor,visualMargin,thresholds:'I01/I10 are head reference candela*starEnvelope >=.01/.1 of event maximum authored body I; independent of camera and RGB gamut',geometry:'exact birth/end vertical minima with constant horizontal wind; open life endpoint is a limit, not bright at death',radius:'max pair horizontal diameter/centroid radius at two sampled burst ages; not maximum lifetime width or an official product metric',marginMeaning:'author scene-clearance10m only, not legal/real fireworks exclusion distance; inapplicable as burst-height rule for ground effects',variantMeaning:'local event-copy research previews; no runtime/source/model/default modification'},summaries,mainDefault78,longAscent,previews,cases,limits:['Current linear drag/gravity, authored random lifetime/shape/speed/I only; not calibrated physical pyrotechnic ballistics.','Rendering hides points y<.03; study includes them to avoid hiding low tails as a success.','Visible threshold is a source-reference convention; actual HDR/SDR exposure, bloom and human visibility differ.','No volume smoke radius, dynamic gust/vertical wind/terrain collision, mirror image or camera framing guarantee is proved.','Source/matter/audio scheduling impact described separately; no new emission model or source quantity changed.']};
fs.writeFileSync(new URL('near-apex-envelope-study.json',import.meta.url),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({passed:report.passed,counts:report.counts,summaries,previews:previews.map(p=>({name:p.name,base:p.base.minima,candidate:p.candidate.minima,baseD2:p.base.spread.at2.diameterXZ,candidateD2:p.candidate.spread.at2.diameterXZ,flightSeconds:p.candidate.flightSeconds})),longAscent},null,2));if(!report.passed)process.exitCode=1;
