// Read-only directional counterfactual. Never imports or writes a runtime variant.
import fs from 'node:fs';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
const root=new URL('../',import.meta.url),read=p=>fs.readFileSync(new URL(p,root),'utf8');
const sha=s=>crypto.createHash('sha256').update(s).digest('hex');
const protectedPaths=['fireworks.js','fireworks-physics.js','fireworks-thermal-photometry.js','fireworks-audio.js'];
const protectedHashes=Object.fromEntries(protectedPaths.map(p=>[p,sha(read(p))]));
const source=read('fireworks-physics.js'),oldSite='y=-.05+rng()*.8',newSite='y=-1+rng()*2';
assert.equal(source.split(oldSite).length,2);
const candidate=source.replace(oldSite,newSite);
assert.equal(candidate.replace(newSite,oldSite),source);
async function load(s){return import('data:text/javascript;base64,'+Buffer.from(s.replaceAll(/from '\.\/([^']+)'/g,(_,p)=>'from '+JSON.stringify(new URL(p,root).href))).toString('base64'));}
const native=await load(source),full=await load(candidate);
const seeds=[1,2,3,4,5,42,71,77,14271,4294967295],elevations=[25,45,65,78,80,90],cadences=[30,60,120];
const thresholds=[.1,.01,.001],phases=[.2,.65,1.1,2.2,5,8,10,11.5];
const yAt=(b,t)=>native.sampleBody(b,b.birth+t).position[1];
const endAgeAtEnvelope=(b,value)=>{let lo=.028,hi=b.life;for(let i=0;i<55;i++){const t=(lo+hi)/2;if(native.starEnvelope(b,t)>=value)lo=t;else hi=t;}return(lo+hi)/2;};
const crossing=(b,height)=>{if(yAt(b,b.life)>height)return null;let lo=0,hi=b.life;for(let i=0;i<55;i++){const t=(lo+hi)/2;if(yAt(b,t)>height)lo=t;else hi=t;}const age=(lo+hi)/2;return{age,envelope:native.starEnvelope(b,age),intensity:b.intensity*native.starEnvelope(b,age),bodyId:b.id};};
function trajectorySummary(event){
  const heads=event.heads,base=event.baselineBurst.velocity;
  const initialY=heads.map(b=>(b.velocity[1]-base[1])/28),impacts=heads.map(b=>crossing(b,.03)).filter(Boolean);
  const exactThresholdClearances=thresholds.map(envelope=>({envelope,
    minimumWorldY:Math.min(...heads.map(b=>Math.min(b.position[1],yAt(b,endAgeAtEnvelope(b,envelope))))),
    bodiesClippedBeforeThresholdEnds:heads.filter(b=>{const p=crossing(b,.03);return p&&p.envelope>=envelope;}).length}));
  const shape=phases.map(phase=>{
    const states=heads.filter(b=>phase<b.life).map(b=>({position:native.sampleBody(b,b.birth+phase).position,I:b.intensity*native.starEnvelope(b,phase)}));
    const ranges=[0,1,2].map(axis=>{const values=states.map(p=>p.position[axis]);return[Math.min(...values),Math.max(...values)];});
    const spans=ranges.map(([lo,hi])=>hi-lo),I=states.reduce((s,p)=>s+p.I,0),centre=Array.from({length:3},(_,a)=>states.reduce((s,p)=>s+p.position[a]*p.I,0)/I);
    return{phase,spansMetres:spans,verticalToMeanHorizontalSpan:spans[1]/((spans[0]+spans[2])/2),intensityWeightedCentreWorld:centre,totalUnclippedReferenceCandela:I,heads:states.length,
      points:event.seed===71&&event.elevation===80?states.map(p=>({position:p.position,I:p.I})):undefined};
  });
  const cadence=cadences.map(hz=>{
    let emitted=0,clipped=0,near1=0,near5=0,near10=0,minVisibleY=Infinity;
    const end=Math.max(...heads.map(b=>b.life));
    // Midpoint integration includes the real continuous envelope and native
    // sea clipping rule. This is emitted-candela*time, not radiant joules.
    for(let frame=0;(frame+.5)/hz<end;frame++){
      const age=(frame+.5)/hz;
      for(const b of heads){if(age>=b.life)continue;const I=b.intensity*native.starEnvelope(b,age),weight=I/hz,y=yAt(b,age);emitted+=weight;
        if(y<.03){clipped+=weight;continue;}minVisibleY=Math.min(minVisibleY,y);
        if(y<1)near1+=weight;if(y<5)near5+=weight;if(y<10)near10+=weight;
      }
    }
    return{hz,totalPotentialCandelaSeconds:emitted,nativeClippedFraction:clipped/emitted,
      visibleBelow1mFraction:near1/emitted,visibleBelow5mFraction:near5/emitted,visibleBelow10mFraction:near10/emitted,minimumVisibleSampleWorldY:minVisibleY};
  });
  return{seed:event.seed,elevation:event.elevation,burstWorldY:event.burstPosition[1],burstTime:event.burstTime,
    initialDirectionY:{minimum:Math.min(...initialY),maximum:Math.max(...initialY),mean:initialY.reduce((a,b)=>a+b,0)/initialY.length,upwardCount:initialY.filter(y=>y>0).length,downwardCount:initialY.filter(y=>y<0).length},
    minimumUnclippedWorldYAtBurnEnd:Math.min(...heads.map(b=>yAt(b,b.life))),exactThresholdClearances,
    nativeSeaClip:{impactedBodies:impacts.length,firstImpactAge:impacts.length?Math.min(...impacts.map(p=>p.age)):null,maximumImpactEnvelope:impacts.length?Math.max(...impacts.map(p=>p.envelope)):0,maximumImpactReferenceCandela:impacts.length?Math.max(...impacts.map(p=>p.intensity)):0},shape,cadence};
}
const cases=[],held=[];
for(const elevation of elevations)for(const seed of seeds){
  const a=native.createFireworkEvent({type:'willow',seed,elevation}),b=full.createFireworkEvent({type:'willow',seed,elevation});
  assert.equal(a.heads.length,160);assert.equal(b.heads.length,160);
  for(const key of ['rocket','events','heightInfo','burstTime','burstPosition','endTime','baselineBurst'])assert.deepEqual(a[key],b[key]);
  for(let i=0;i<a.heads.length;i++){
    const x=a.heads[i],z=b.heads[i],strip=({velocity,baseVelocity,...rest})=>rest;
    assert.deepEqual(strip(x),strip(z));
    const v=(p)=>p.velocity.map((c,k)=>c-a.baselineBurst.velocity[k]);
    assert(Math.abs(Math.hypot(...v(x))-28)<2e-13);assert(Math.abs(Math.hypot(...v(z))-28)<2e-13);
    // Existing RNG u is recovered without an extra random call. It maps y,
    // not polar angle, linearly to the full sphere's equal-area measure.
    const oldY=v(x)[1]/28,expectedY=((oldY+.05)/.8)*2-1;
    assert(Math.abs(v(z)[1]/28-expectedY)<3e-15);
  }
  held.push({seed,elevation,held:true});
  cases.push({variant:'native-upward-bias',...trajectorySummary(a)},{variant:'in-memory-full-sphere',...trajectorySummary(b)});
}
const aggregates=[];
for(const elevation of elevations)for(const variant of ['native-upward-bias','in-memory-full-sphere']){
  const set=cases.filter(c=>c.elevation===elevation&&c.variant===variant),mean=fn=>set.reduce((s,c)=>s+fn(c),0)/set.length;
  aggregates.push({elevation,variant,seeds:set.length,burstWorldY:set[0].burstWorldY,
    upwardFraction:mean(c=>c.initialDirectionY.upwardCount/160),meanDirectionY:mean(c=>c.initialDirectionY.mean),
    minimumBurnEndWorldY:Math.min(...set.map(c=>c.minimumUnclippedWorldYAtBurnEnd)),
    minimumWorldYWhileEnvelopeAtLeast:Object.fromEntries(thresholds.map((t,i)=>[t,Math.min(...set.map(c=>c.exactThresholdClearances[i].minimumWorldY))])),
    impactedBodies:set.reduce((s,c)=>s+c.nativeSeaClip.impactedBodies,0),maximumImpactEnvelope:Math.max(...set.map(c=>c.nativeSeaClip.maximumImpactEnvelope)),
    meanNativeClippedEmissionFraction120Hz:mean(c=>c.cadence[2].nativeClippedFraction),
    maximumBelow10mEmissionFraction120Hz:Math.max(...set.map(c=>c.cadence[2].visibleBelow10mFraction)),
    maximumCadenceAbsoluteClippedFractionDifference:Math.max(...set.map(c=>Math.abs(c.cadence[0].nativeClippedFraction-c.cadence[2].nativeClippedFraction))),
    meanVerticalToHorizontalSpanAt1p1:mean(c=>c.shape[2].verticalToMeanHorizontalSpan)});
}
const analyticAllRandomBound80={burstWorldY:190.5,minimumInitialVerticalVelocity:-28,maximumLife:12.7,drag:.74,
  explanation:'Worst possible native RNG support: y=-1, life=12.7s, zero vertical carrier velocity at apex, zero vertical wind. Longer life reaches the envelope thresholds later. Head centres only; not safety certification.',
  thresholds:[...thresholds,0].map(envelope=>{const body={life:12.7},age=envelope===0?12.7:endAgeAtEnvelope(body,envelope);
    return{envelope,age,minimumWorldY:native.flightSegment([0,190.5,0],[0,-28,0],age,.74).position[1]};})};
assert(analyticAllRandomBound80.thresholds.every(t=>t.minimumWorldY>.03));
const uiDefaultBurstY=native.createFireworkEvent({type:'willow',elevation:78}).burstPosition[1];
const analyticAllRandomBoundUi78={...analyticAllRandomBound80,burstWorldY:uiDefaultBurstY,
  thresholds:analyticAllRandomBound80.thresholds.map(t=>({...t,minimumWorldY:t.minimumWorldY+uiDefaultBurstY-190.5})),
  note:'ui.js/index.html default78deg differs from physics default80deg. At the all-RNG support endpoint the native water cutoff can remove an already effectively extinguished final star; this is not a zero-collision proof.'};
for(const p of protectedPaths)assert.equal(sha(read(p)),protectedHashes[p],p+' was changed during read-only audit');
const report={schema:'glass-atoll.r12-willow-shape-audit.v1',dateUTC:new Date().toISOString(),passed:true,actualGPU:false,runtimeMutated:false,
  protectedHashes,sourceSite:{from:oldSite,to:newSite,count:1,sourceSHA256:sha(source),inMemoryCandidateSHA256:sha(candidate),inverseByteExact:true},
  scope:{seeds,elevations,cadences,physicalEventsCompared:held.length,cases:cases.length,headPairsCompared:held.length*160,
    held:'160 heads; RNG consumption/order; speed28m/s; drag0.74/s; each native I, radius, seed, life10.2..12.7s; colour; all rocket/event/height/envelope values; reference scale. Only the native initial direction vector changes.',
    integration:'Midpoint emitted reference candela seconds, all heads before water clipping; fractions cancel any single common thermal-greybody area multiplier. Not radiant energy or burn safety.',
    clearance:'World-space head centres against native water cutoff y=0.03m. No terrain, flame radius, fragments, people, buildings or actual pyrotechnic safety modelling. Threshold endpoints solved on continuous envelope; no cadence dependence.',
    direction:'Uniform y in[-1,1] is equal-area spherical polar sampling with the same deterministic golden-angle azimuth. The finite realization is not a perfect shell or a measured real willow.'},
  analyticAllRandomBound80,analyticAllRandomBoundUi78,aggregates,cases,limits:['One photograph or an un-timestamped video screenshot cannot identify an exact shell family, physical size, velocity or camera exposure.','A spherical long-tail candidate is defensible, but willow is an effect family, not a universal sphere constraint.','This audit neither admits the candidate to runtime nor proves its GPU appearance, performance, smoke mass, collisions or user acceptance.']};
fs.writeFileSync(new URL('r12-willow-shape-audit.json',import.meta.url),JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({passed:report.passed,runtimeMutated:report.runtimeMutated,scope:report.scope,aggregates},null,2));
