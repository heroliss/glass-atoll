// Research only. Mutates owned QA event objects for velocity sensitivity, never
// physics/render source or a live application. No claim of product calibration.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import crypto from 'node:crypto';
import {performance} from 'node:perf_hooks';
import * as THREE from '../../vendor/three.module.js';
import {FIREWORK_TYPES,createFireworkEvent,sampleBody,sampleFireworkEvent,starEnvelope,EMISSION_PROFILES} from '../../fireworks-physics.js';
import {fitPerspectiveBounds} from '../../camera-framing.js';

const started=performance.now(),sha=s=>crypto.createHash('sha256').update(s).digest('hex'),read=p=>fs.readFileSync(new URL(p,import.meta.url),'utf8');
const physicsBefore=read('../../fireworks-physics.js'),windBefore=read('../../wind-response.js'),renderBefore=read('../../fireworks.js');
const seeds=[11,42,14271,2654450032],candidateSeeds=[11,42],scales=[.75,1.25],origin=[29,1.47704875875,7],azimuth=104,elevation=80;
const checks=[],check=(name,fn)=>{try{checks.push({name,passed:true,detail:fn()??null});}catch(error){checks.push({name,passed:false,error:String(error.stack)});}};
function sourceFunction(source,name){const start=source.indexOf(`function ${name}(`);assert(start>=0,name);const begin=source.indexOf('){',start)+1;let depth=0;for(let i=begin;i<source.length;i++){if(source[i]==='{')depth++;else if(source[i]==='}'&&--depth===0)return source.slice(start,i+1);}throw Error(name);}
const recordsClosure=sourceFunction(renderBefore,'updateRecords');
// Execute the actual current production CPU records closure with one owned event.
// No copied tail formula, renderer calls, legacy smoke or live simulation.
const recordsAt=new Function('simulation','sampleBody','starEnvelope','EMISSION_PROFILES','quality',`let records=[],boundCache,clusterCache;${recordsClosure};updateRecords();return records.filter(p=>p.kind==='star'&&p.intensity>0);`);
const columns=['age_s','D_bornGeometry3D_m','D_live3D_m','D_liveXZ_m','D_I01_3D_m','D_I10_3D_m','bornHeads','lifeHeads','sceneLiveHeads','I01Heads','I10Heads','sumSceneAuthoredCd','peakSceneStarAuthoredCd','sumUnclippedModelCd','minLiveY_m','maxLiveY_m','luminousCentroidY_m','minLifeY_m','maxLifeY_m','belowGroundLifeHeads','commonWindShiftX_m','commonWindShiftY_m','commonWindShiftZ_m','centeredWindResidualRMS_m'];
const C=Object.fromEntries(columns.map((name,i)=>[name,i]));
const windVector=speed=>[.936*speed,0,.352*speed],timeline=speed=>[{time:-Infinity,wind:windVector(speed)}];
const dot=(a,b)=>a[0]*b[0]+a[1]*b[1]+a[2]*b[2],dist=(a,b)=>Math.hypot(...a.map((v,c)=>v-b[c]));
function bbox(){return{min:[Infinity,Infinity,Infinity],max:[-Infinity,-Infinity,-Infinity]};}
function include(box,p,radius=0){for(let c=0;c<3;c++){box.min[c]=Math.min(box.min[c],p[c]-radius);box.max[c]=Math.max(box.max[c],p[c]+radius);}}
function mergeBox(a,b){if(b.min.every(Number.isFinite)){include(a,b.min);include(a,b.max);}return a;}
function eventFor(type,seed,scale=1){
  const event=createFireworkEvent({type,seed,origin,elevation,azimuth});if(scale===1)return event;
  const roots=event.heads.filter(body=>!body.parentBody),mean=[0,0,0];for(const body of roots)for(let c=0;c<3;c++)mean[c]+=body.baseVelocity[c]/roots.length;
  // Constant authoring change at birth, not a per-frame position resize. Keep
  // coherent launch/root velocity, gravity, drag, time, life, I, radius and RNG.
  for(const body of roots){body.baseVelocity=body.baseVelocity.map((v,c)=>mean[c]+scale*(v-mean[c]));body.velocity=[...body.baseVelocity];}
  for(const body of event.heads)if(body.parentBody){body.velocityDelta=body.velocityDelta.map(v=>v*scale);const parent=sampleBody(body.parentBody,body.birth);body.position=[...parent.position];body.basePosition=[...parent.position];body.velocity=parent.velocity.map((v,c)=>v+body.velocityDelta[c]);body.baseVelocity=[...body.velocity];}
  return event;
}
function timeGrid(event,dt){
  const end=Math.max(...event.heads.map(body=>body.birth+body.life))-event.burstTime+.9,values=new Set([0,end,.028]);
  for(let i=0;i<=Math.ceil(end/dt);i++)values.add(Math.min(end,i*dt));
  const births=[...new Set(event.heads.map(body=>body.birth-event.burstTime))];for(const birth of births){values.add(birth);values.add(birth+.028);}
  return [...values].filter(t=>t>=0&&t<=end).sort((a,b)=>a-b);
}
function measure(event,age,wind,Iref){
  const time=event.burstTime+age,liveSamples=sampleFireworkEvent(event,time,{windTimeline:wind,smoke:false}),sampleMap=new Map(liveSamples.filter(p=>p.body?.id!==undefined&&p.body?.kind==='star').map(p=>[p.body.id,p]));
  const points=[],members=new Map(),row=Array(columns.length).fill(0);row[0]=age;
  let minLive=Infinity,maxLive=-Infinity,minLife=Infinity,maxLife=-Infinity,weightedY=0,unweightedY=0;
  for(const body of event.heads){
    const a=time-body.birth;if(a<0)continue;const sample=sampleMap.get(body.id)??sampleBody(body,time,wind),p=sample.position,life=a<body.life,live=life&&p[1]>=.03,I=life?body.intensity*starEnvelope(body,a):0;
    const q=live&&I>=.1*Iref?2:live&&I>=.01*Iref?1:0;points.push({p,live,q});row[C.bornHeads]++;
    if(life){row[C.lifeHeads]++;row[C.sumUnclippedModelCd]+=I;minLife=Math.min(minLife,p[1]);maxLife=Math.max(maxLife,p[1]);}
    if(!live){if(life)row[C.belowGroundLifeHeads]++;continue;}
    row[C.sceneLiveHeads]++;row[C.sumSceneAuthoredCd]+=I;row[C.peakSceneStarAuthoredCd]=Math.max(row[C.peakSceneStarAuthoredCd],I);if(q>=1)row[C.I01Heads]++;if(q===2)row[C.I10Heads]++;
    minLive=Math.min(minLive,p[1]);maxLive=Math.max(maxLive,p[1]);weightedY+=p[1]*I;unweightedY+=p[1];members.set(body.id,p);
  }
  let geometry=0,live=0,horizontal=0,light01=0,light10=0;
  for(let i=0;i<points.length;i++)for(let j=0;j<i;j++){
    const a=points[i],b=points[j],dx=a.p[0]-b.p[0],dy=a.p[1]-b.p[1],dz=a.p[2]-b.p[2],h=dx*dx+dz*dz,d=h+dy*dy;geometry=Math.max(geometry,d);
    if(a.live&&b.live){live=Math.max(live,d);horizontal=Math.max(horizontal,h);if(a.q>=1&&b.q>=1)light01=Math.max(light01,d);if(a.q===2&&b.q===2)light10=Math.max(light10,d);}
  }
  row[C.D_bornGeometry3D_m]=Math.sqrt(geometry);row[C.D_live3D_m]=Math.sqrt(live);row[C.D_liveXZ_m]=Math.sqrt(horizontal);row[C.D_I01_3D_m]=Math.sqrt(light01);row[C.D_I10_3D_m]=Math.sqrt(light10);
  row[C.minLiveY_m]=Number.isFinite(minLive)?minLive:null;row[C.maxLiveY_m]=Number.isFinite(maxLive)?maxLive:null;row[C.minLifeY_m]=Number.isFinite(minLife)?minLife:null;row[C.maxLifeY_m]=Number.isFinite(maxLife)?maxLife:null;
  row[C.luminousCentroidY_m]=row[C.sumSceneAuthoredCd]>0?weightedY/row[C.sumSceneAuthoredCd]:row[C.sceneLiveHeads]>0?unweightedY/row[C.sceneLiveHeads]:null;
  return{row,members};
}
function windDifference(zero,five){
  assert.equal(zero.members.size,five.members.size);const shift=[0,0,0],n=zero.members.size;
  for(const [id,p]of zero.members){const other=five.members.get(id);assert(other);for(let c=0;c<3;c++)shift[c]+=(other[c]-p[c])/Math.max(1,n);}
  let sum=0;for(const [id,p]of zero.members){const other=five.members.get(id);for(let c=0;c<3;c++)sum+=(other[c]-p[c]-shift[c])**2;}
  for(let c=0;c<3;c++)five.row[C.commonWindShiftX_m+c]=shift[c];five.row[C.centeredWindResidualRMS_m]=Math.sqrt(sum/Math.max(1,n));
}
function atTime(rows,time){return rows.reduce((best,row)=>Math.abs(row[0]-time)<Math.abs(best[0]-time)?row:best,rows[0]);}
function summarize(event,rows,Iref,scale,windSpeed,dt){
  const peak=Math.max(...rows.map(row=>row[C.sumSceneAuthoredCd])),energy=[0];for(let i=1;i<rows.length;i++)energy[i]=energy[i-1]+(rows[i][0]-rows[i-1][0])*(rows[i][C.sumSceneAuthoredCd]+rows[i-1][C.sumSceneAuthoredCd])*.5;
  const total=energy.at(-1),quantile=q=>{for(let i=1;i<energy.length;i++)if(energy[i]>=q*total){const fraction=(q*total-energy[i-1])/Math.max(Number.MIN_VALUE,energy[i]-energy[i-1]);return rows[i-1][0]+fraction*(rows[i][0]-rows[i-1][0]);}return rows.at(-1)[0];};
  const E10=quantile(.1),E50=quantile(.5),E90=quantile(.9),main=rows.filter(row=>row[0]>=E10&&row[0]<=E90&&row[C.sumSceneAuthoredCd]>=peak*.1),maxRow=key=>rows.reduce((a,b)=>b[C[key]]>a[C[key]]?b:a,rows[0]),best=main.reduce((a,b)=>!a||b[C.D_I10_3D_m]>a[C.D_I10_3D_m]?b:a,null),last=rows.filter(row=>row[C.sumSceneAuthoredCd]>=peak*.01).at(-1);
  const sample=row=>row?{age:row[0],D_live:row[C.D_live3D_m],D_XZ:row[C.D_liveXZ_m],D01:row[C.D_I01_3D_m],D10:row[C.D_I10_3D_m],live:row[C.sceneLiveHeads],N01:row[C.I01Heads],N10:row[C.I10Heads],sumAuthoredCd:row[C.sumSceneAuthoredCd],sumRelativeToPeak:row[C.sumSceneAuthoredCd]/peak,minY:row[C.minLiveY_m],maxY:row[C.maxLiveY_m],centroidY:row[C.luminousCentroidY_m],belowGround:row[C.belowGroundLifeHeads]}:null;
  return{type:event.type,label:event.definition.label,seed:event.seed,windSpeed,velocityDispersionScale:scale,sampleStep:dt,sampledMaximumNotContinuousCertificate:true,calibreMm:event.calibreMm,referenceWidth:event.heightInfo.productReference?.referenceWidthMetres??null,widthCalibrated:false,ground:!!event.definition.ground,burstRise:event.rocket?event.heightInfo.actualBurstRiseMetres:null,burstWorldY:event.burstPosition[1],flightSeconds:event.burstTime-event.time,authoredIref:Iref,sumUnmodulatedAuthoredCd:event.heads.reduce((n,b)=>n+b.intensity,0),peakSumSceneAuthoredCd:peak,peakSingleStarSceneAuthoredCd:Math.max(...rows.map(row=>row[C.peakSceneStarAuthoredCd])),integratedSceneAuthoredCdSeconds:total,mainVisual:{definition:'E10..E90 of scene-visible head authored intensity-time integral, with total I>=.1 sampled peak total I',E10,E50,E90,operationalWidth:sample(best),medianLightPhase:sample(atTime(rows,E50))},maxBornGeometry:sample(maxRow('D_bornGeometry3D_m')),maximumBornGeometryMetres:maxRow('D_bornGeometry3D_m')[C.D_bornGeometry3D_m],maxAlive:sample(maxRow('D_live3D_m')),maxI01:sample(maxRow('D_I01_3D_m')),maxI10:sample(maxRow('D_I10_3D_m')),maximumVisibleHeight:Math.max(...rows.map(row=>row[C.maxLiveY_m]??-Infinity)),finalOnePercentTotalPhase:sample(last),sampledFirstGroundClippingAge:rows.find(row=>row[C.belowGroundLifeHeads]>0)?.[0]??null,maximumCenteredWindResidual:Math.max(...rows.map(row=>row[C.centeredWindResidualRMS_m])),maximumCommonWindShift:Math.max(...rows.map(row=>Math.hypot(row[C.commonWindShiftX_m],row[C.commonWindShiftY_m],row[C.commonWindShiftZ_m])))};
}
function pairedCases(type,seed,scale,overrideDt){
  const zero=eventFor(type,seed,scale),five=eventFor(type,seed,scale),dt=overrideDt??(type==='strobe'?1/120:.05),times=timeGrid(zero,dt),Iref=Math.max(...zero.heads.map(body=>body.intensity)),curves=[[],[]],winds=[timeline(0),timeline(5)];
  for(const age of times){const a=measure(zero,age,winds[0],Iref),b=measure(five,age,winds[1],Iref);windDifference(a,b);curves[0].push(a.row);curves[1].push(b.row);}
  return[zero,five].map((event,i)=>({summary:summarize(event,curves[i],Iref,scale,i*5,dt),samples:curves[i]}));
}
const cases=[];
for(const type of FIREWORK_TYPES){for(const seed of seeds)cases.push(...pairedCases(type.id,seed,1));for(const seed of candidateSeeds)for(const scale of scales)cases.push(...pairedCases(type.id,seed,scale));}

// Source+tail framing uses the actual production records closure on a smaller
// representative grid. It is separate from physical-head intensity thresholds,
// which must not depend on quality.trailSegments.
const tailStudies=[];
for(const type of FIREWORK_TYPES)for(const windSpeed of [0,5]){
  const event=eventFor(type.id,42),wind=timeline(windSpeed),times=timeGrid(event,.1),box=bbox(),rows=[];
  for(const age of times){sampleFireworkEvent(event,event.burstTime+age,{windTimeline:wind,smoke:false});const records=recordsAt({time:event.burstTime+age,windTimeline:wind,active:[event],particles:()=>[]},sampleBody,starEnvelope,EMISSION_PROFILES,{trailSegments:8});let I=0,peak=0;for(const record of records){I+=record.intensity;peak=Math.max(peak,record.intensity);include(box,record.position,record.radius+Math.hypot(...record.stretch)*.5);}rows.push([age,records.length,I,peak]);}
  if(event.rocket)for(let i=0;i<=50;i++)include(box,sampleBody(event.rocket,event.time+(event.burstTime-event.time)*i/50,wind).position,event.rocket.radius);
  tailStudies.push({type:type.id,seed:42,windSpeed,step:.1,recordColumns:['age_s','positiveHeadTailRecords','sumHeadTailAuthoredCd','peakRecordAuthoredCd'],samples:rows,sampledPositiveHeadTailBounds:box,limits:'Actual records closure,8 tail segments, instantaneous source intensities. Framing bounds sampled then guarded; no PSF/infinite smoke/ghost or rigorous continuous tail bound.'});
}
const framing=[];
for(const type of FIREWORK_TYPES){
  const source=bbox();for(const study of tailStudies.filter(x=>x.type===type.id))mergeBox(source,study.sampledPositiveHeadTailBounds);
  const island=new THREE.Box3(new THREE.Vector3(-39,0,-27),new THREE.Vector3(44,18,30)),direct=island.clone(),mirror=island.clone();
  direct.expandByPoint(new THREE.Vector3(...source.min));direct.expandByPoint(new THREE.Vector3(...source.max));mirror.copy(direct);mirror.expandByPoint(new THREE.Vector3(source.min[0],-source.max[1],source.min[2]));mirror.expandByPoint(new THREE.Vector3(source.max[0],-source.min[1],source.max[2]));mirror.expandByPoint(new THREE.Vector3(-39,-18,-27));mirror.expandByPoint(new THREE.Vector3(44,0,30));
  direct.expandByScalar(12);direct.min.y=0;mirror.expandByScalar(12);
  const camera=new THREE.PerspectiveCamera(60,1209/1292,.15,24000);camera.filmGauge=36;camera.setFocalLength(28);const fit=box=>{
    let radius=0;for(let j=0;j<16;j++){const a=j*Math.PI/8,r=fitPerspectiveBounds(THREE,camera,box,{eyeHeight:16,margin:.84,bearing:new THREE.Vector3(Math.sin(a),0,-Math.cos(a))});radius=Math.max(radius,r.distance);}
    const center=box.getCenter(new THREE.Vector3()),bearing=new THREE.Vector3(-189.977,0,-140.500).normalize(),horizontal=Math.sqrt(radius*radius-(16-center.y)**2);camera.position.copy(center).addScaledVector(bearing,horizontal);camera.position.y=16;camera.lookAt(center);camera.updateMatrixWorld();let minX=Infinity,maxX=-Infinity;
    for(let i=0;i<8;i++){const p=new THREE.Vector3(i&1?island.max.x:island.min.x,i&2?island.max.y:island.min.y,i&4?island.max.z:island.min.z).project(camera);minX=Math.min(minX,p.x);maxX=Math.max(maxX,p.x);}
    return{radiusMetres:radius,target:center.toArray(),position:camera.position.toArray(),islandBoundingBoxFrameWidthFraction:(maxX-minX)/2};
  };
  framing.push({type:type.id,seed:42,windRange:[0,5],focalMm:28,sensorHeightMm:36,aspect:1209/1292,verticalFovDegrees:camera.fov,eyeHeight:16,screenMargin:.84,worldGuardMetres:12,sourceBounds:source,directOnly:fit(direct),directAndFullPlanarMirror:fit(mirror),scope:'Sampled one event plus source tails/island, mean plane y=0;16 orbit bearings. Not a continuous tail/rough-water/finite-PSF proof or automatic camera policy change.'});
}

const convergence=[];for(const type of FIREWORK_TYPES){const coarse=cases.find(c=>c.summary.type===type.id&&c.summary.seed===42&&c.summary.windSpeed===0&&c.summary.velocityDispersionScale===1),fine=pairedCases(type.id,42,1,type.id==='strobe'?1/240:.025)[0],a=coarse.summary.mainVisual.operationalWidth,b=fine.summary.mainVisual.operationalWidth;convergence.push({type:type.id,coarseStep:coarse.summary.sampleStep,fineStep:fine.summary.sampleStep,coarseD10:a?.D10??0,fineD10:b?.D10??0,relativeWidthDifference:Math.abs((a?.D10??0)-(b?.D10??0))/Math.max(1e-12,b?.D10??0),coarsePeakSumEmitterCd:coarse.summary.peakSumSceneAuthoredCd,finePeakSumEmitterCd:fine.summary.peakSumSceneAuthoredCd,relativePeakSumDifference:Math.abs(coarse.summary.peakSumSceneAuthoredCd-fine.summary.peakSumSceneAuthoredCd)/fine.summary.peakSumSceneAuthoredCd,relativeIntegratedSignalDifference:Math.abs(coarse.summary.integratedSceneAuthoredCdSeconds-fine.summary.integratedSceneAuthoredCdSeconds)/fine.summary.integratedSceneAuthoredCdSeconds,E50DifferenceSeconds:coarse.summary.mainVisual.E50-fine.summary.mainVisual.E50,note:'Sampling convergence diagnostic, not proof of continuous maximum.'});}

check('160 research cases cover ten current production types,4 baseline seeds and two scales on2 seeds',()=>{assert.equal(cases.length,160);for(const type of FIREWORK_TYPES)assert.equal(cases.filter(c=>c.summary.type===type.id).length,16);});
check('diameter/threshold nesting and finite nonnegative source metrics',()=>{for(const item of cases)for(const row of item.samples){assert(row[C.D_I10_3D_m]<=row[C.D_I01_3D_m]+1e-9);assert(row[C.D_I01_3D_m]<=row[C.D_live3D_m]+1e-9);assert(row[C.D_live3D_m]<=row[C.D_bornGeometry3D_m]+1e-9);assert(row[C.I10Heads]<=row[C.I01Heads]&&row[C.I01Heads]<=row[C.sceneLiveHeads]);for(const value of row)assert(value===null||Number.isFinite(value));assert(row[C.sumSceneAuthoredCd]>=0&&row[C.sumSceneAuthoredCd]<=row[C.sumUnclippedModelCd]+1e-9);}});
check('s1 is exact factory identity and candidates preserve physical source/timing/random fields',()=>{for(const type of FIREWORK_TYPES)for(const seed of candidateSeeds){const base=eventFor(type.id,seed,1);assert.deepEqual(base,createFireworkEvent({type:type.id,seed,origin,elevation,azimuth}));for(const scale of scales){const other=eventFor(type.id,seed,scale);assert.deepEqual(other.rocket,base.rocket);for(let i=0;i<base.heads.length;i++)for(const key of ['birth','life','intensity','radius','drag','seed','gravity','strobe','frequency','phase','duty','colour'])assert.deepEqual(other.heads[i][key],base.heads[i][key],key);}}});
check('authoring scale preserves root mean velocity and scales common-age early geometry, not gravity',()=>{
  for(const type of FIREWORK_TYPES)for(const scale of scales){const a=eventFor(type.id,42),b=eventFor(type.id,42,scale),roots=e=>e.heads.filter(p=>!p.parentBody),mean=e=>roots(e).reduce((s,p)=>s.map((v,c)=>v+p.velocity[c]/roots(e).length),[0,0,0]);assert(dist(mean(a),mean(b))<2e-11);
    if(type.id!=='fan'){const Iref=Math.max(...a.heads.map(p=>p.intensity)),x=measure(a,.6,timeline(0),Iref).row,y=measure(b,.6,timeline(0),Iref).row;assert(Math.abs(y[C.D_live3D_m]-scale*x[C.D_live3D_m])<1e-8);}
  }
});
check('80degree air rise stays at reference under all seeds/scales/horizontal winds',()=>{for(const item of cases)if(!item.summary.ground)assert(Math.abs(item.summary.burstRise-FIREWORK_TYPES.find(t=>t.id===item.summary.type).height)<1e-8);});
check('wind is not removed by faking world positions or intensity',()=>{for(let i=0;i<cases.length;i+=2){const a=cases[i],b=cases[i+1];assert.equal(a.samples.length,b.samples.length);for(let j=0;j<a.samples.length;j++){const x=a.samples[j],y=b.samples[j];assert(Math.abs(x[C.sumSceneAuthoredCd]-y[C.sumSceneAuthoredCd])<1e-8);assert.equal(x[C.sceneLiveHeads],y[C.sceneLiveHeads]);assert.equal(x[C.minLiveY_m],y[C.minLiveY_m]);}}});
check('uniform smiley cohort retains width under5m/s wind after common translation',()=>{for(const item of cases.filter(c=>c.summary.type==='ring'&&c.summary.windSpeed===5))assert(item.summary.maximumCenteredWindResidual<1e-9);});
check('production sources unchanged and tail closure identical during study',()=>{assert.equal(sha(read('../../fireworks-physics.js')),sha(physicsBefore));assert.equal(sha(read('../../wind-response.js')),sha(windBefore));assert.equal(sha(sourceFunction(read('../../fireworks.js'),'updateRecords')),sha(recordsClosure));});
check('main+full mirror needs no smaller fit than direct/island and no larger island on screen',()=>{for(const item of framing){assert(item.directAndFullPlanarMirror.radiusMetres>=item.directOnly.radiusMetres);assert(item.directAndFullPlanarMirror.islandBoundingBoxFrameWidthFraction<=item.directOnly.islandBoundingBoxFrameWidthFraction+1e-10);}});

const summaries=cases.map(c=>({...c.summary,maximumVisibleRiseAboveLaunch:c.summary.maximumVisibleHeight-origin[1]})),report={date:new Date().toISOString(),researchOnly:true,productionChanged:false,calibrated:false,passed:checks.every(c=>c.passed),passedCount:checks.filter(c=>c.passed).length,total:checks.length,sourceSHA256:{physics:sha(physicsBefore),wind:sha(windBefore),productionRecordsClosure:sha(recordsClosure)},contract:{origin,elevation,azimuth,seeds,candidateSeeds,scales,windSpeeds:[0,5],windDirection:windVector(1),thresholds:'fixed Iref=max authored star I per event; per-star authored envelope I>=.01/.1 Iref; not per-frame maximum, not display threshold',mainPhase:'E10..E90 of eligible physical-head emitter I-time integral before head/tail partition; operational width=max D_I10 inside this interval while total I>=.1 sampled total peak',lightUnits:'authored reference cd and sum cd; physical-emitter proxy before head/tail partition, not rendered head-core-only intensity, total lumens, absolute calibrated radiometry or unknown-exposure-photo estimate',scale:'constant initial velocity deviations around root mean scaled; child velocityDelta scaled; rocket/common velocity/gravity/lifetime/I/RNG retained; no position scaling',diameters:'head centres: exact pairwise3D diameter and XZ diameter at stated sample times; all-born includes expired/underground diagnostic trajectories',timeSampling:'nonstrobe .05s,strobe1/120s plus event birth/ignition milestones; separate finer-grid diagnostic, not certified continuous maxima'},summaries,convergence,framing,checks,wallMs:performance.now()-started,limits:['Unbounded persistent smoke/cloud delta excluded; they are being integrated separately.','No runtime candidate selected or GPU/photographic acceptance implied.','Ground effects phase0 means launch, not an aerial burst; no fake calibre width assigned.','Source-head emitter signals and actual head+tail CPU record ledger are separate; per-record threshold would depend on tail segmentation. Neither is a shutter-integrated GPU pixel brightness measurement.','D3D is not camera projected diameter; pixel contract must use fixed world orientation/view/focal/time and actual reflection.','Velocity dispersion changes kinetic energy/vertical extrema; preserved mean velocity is not a claim of measured star masses/momentum.','Finite sampling and source support bounds remain explicit; supplier product width does not specify this operational time/threshold convention.']};
fs.writeFileSync(new URL('diameter-time-study.json',import.meta.url),JSON.stringify({...report,curveColumns:columns,cases:cases.map(({summary,samples})=>({type:summary.type,seed:summary.seed,windSpeed:summary.windSpeed,scale:summary.velocityDispersionScale,samples})),tailStudies})+'\n');
fs.writeFileSync(new URL('diameter-time-summary.json',import.meta.url),JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({researchOnly:true,calibrated:false,passed:report.passed,passedCount:report.passedCount,total:report.total,cases:cases.length,wallMs:report.wallMs,failed:checks.filter(c=>!c.passed)},null,2));if(!report.passed)process.exitCode=1;
