// CPU contracts and counterexample witnesses; no renderer/GPU or audio edits.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import crypto from 'node:crypto';
import {compileFireworkLayerProfile,getFireworkEffectProfileLimits,FIREWORK_LAYER_PROFILE_LIMITS,FIREWORK_POWERED_PROFILE_LIMITS} from '../firework-layer-profile.js';
import {THREE_HEART_TRAIL_PROFILES,POWERED_BEE_TRAIL_PROFILE} from '../firework-trail-profile.js';
import {sampleBurnProfile,sampleMaterialCDF} from '../firework-burn-profile.js';
import {createFireworkEvent,createFireworksSimulation,sampleBody,sampleFireworkEvent} from '../fireworks-physics.js';
import {createTailReleaseFieldNode,sampleTailReleaseFieldNode} from '../firework-tail-field.js';
import {getFireworkShowEnvelope} from '../firework-show-envelope.js';

const started=new Date().toISOString(),checks=[],effectProfile='powered-bees-v1',profileLimits=FIREWORK_POWERED_PROFILE_LIMITS[effectProfile],frame={right:[1,0,0],up:[0,1,0],forward:[0,0,1]},zero=[{time:-Infinity,wind:[0,0,0]}];
const check=(name,fn)=>{try{checks.push({name,passed:true,evidence:fn()??null});}catch(error){checks.push({name,passed:false,error:String(error.stack??error)});}};
const hash=bytes=>crypto.createHash('sha256').update(bytes).digest('hex'),near=(a,b,tolerance=1e-10)=>assert(Math.abs(a-b)<=tolerance*Math.max(1,Math.abs(a),Math.abs(b)),`${a} != ${b}`);
const vectorNear=(a,b,tolerance)=>a.forEach((v,c)=>near(v,b[c],tolerance));
const native=(seed=42,intensityScale=1,extra={})=>createFireworkEvent({type:'chrysanthemum',seed,intensityScale,starDragModel:'bounded-descent',...extra});
const powered=(seed=42,intensityScale=1,extra={})=>native(seed,intensityScale,{...extra,effectProfile});
const compile=(event,extra={})=>compileFireworkLayerProfile({type:'chrysanthemum',effectProfile,heads:event.heads,burstVelocity:event.baselineBurst.velocity,eventSeed:event.seed,burstFrame:frame,...extra});
const inside=(point,envelope,context)=>{if(point[1]<.03)return;for(let c=0;c<3;c++)assert(point[c]>=envelope.min[c]-1e-8&&point[c]<=envelope.max[c]+1e-8,JSON.stringify({point,envelope,context,c}));};
const rebind=async(file)=>{let source=fs.readFileSync(new URL('./baselines/r22-before-powered-profiles/'+file,import.meta.url),'utf8');source=source.replace(/from '(\.\/[^']+)'/g,(_,p)=>`from '${new URL('../'+p.slice(2),import.meta.url).href}'`);return import('data:text/javascript;base64,'+Buffer.from(source).toString('base64'));};
const previousLayer=await rebind('firework-layer-profile.js'),previousEnvelope=await rebind('firework-show-envelope.js');

check('Frozen pre-R22 source fingerprints and unchanged legacy/layered output contracts',()=>{
  const expected={'firework-layer-profile.js':'fa076d1197f80182d84c82bd841615754417512533e092c31f6cb92764200646','firework-show-envelope.js':'3df220694c02a641cdcaf320f70ff06475049e2ad751750f8ff391106e88dfd5','firework-trail-profile.js':'916aeba9c4647bf85d668a85e659ff5ec50bd2207dc784658dc9bf73015cb0ce'};
  for(const [file,sha]of Object.entries(expected))assert.equal(hash(fs.readFileSync(new URL('./baselines/r22-before-powered-profiles/'+file,import.meta.url))),sha);
  assert.deepEqual(FIREWORK_LAYER_PROFILE_LIMITS,previousLayer.FIREWORK_LAYER_PROFILE_LIMITS);
  let comparisons=0;for(const profile of ['legacy','three-heart-v1','two-colour-v1'])for(const seed of [0,42,4294967295]){
    const event=native(seed),options={type:'chrysanthemum',effectProfile:profile,heads:event.heads,burstVelocity:event.baselineBurst.velocity,eventSeed:seed};
    assert.deepEqual(compileFireworkLayerProfile(options),previousLayer.compileFireworkLayerProfile(options));comparisons++;
    for(const elevation of [25,78,90])for(const spread of [0,15]){const q={type:'chrysanthemum',effectProfile:profile,elevation,launchSpreadDegrees:spread,wind:{min:[-5,-1,-3],max:[4,1,6]}};assert.deepEqual(getFireworkShowEnvelope(q),previousEnvelope.getFireworkShowEnvelope(q));comparisons++;}
  }return{comparisons,baselineSHA256:expected};
});
check('32 seeded motor strata,192 original roots and160 byte-equivalent native bodies without native RNG consumption',()=>{
  let compared=0;const ids=[];for(const seed of [0,1,42,123,901,4294967295]){
    const base=native(seed),before=structuredClone(base.heads),result=compile(base),event=powered(seed),selected=new Set(result.motorBodyIds);
    assert.deepEqual(base.heads,before);assert.equal(result.patches.length,32);assert.deepEqual(result.motorBodyIds,result.patches.map(p=>p.id));assert.equal(new Set(result.motorBodyIds).size,32);
    result.motorBodyIds.forEach((id,j)=>assert.equal(Math.floor(id/6),j));assert.deepEqual(result.layerCounts,{radial:160,motor:32});assert.deepEqual(event.rocket,base.rocket);assert.deepEqual(event.events,base.events);assert.deepEqual(event.baselineBurst,base.baselineBurst);
    assert.equal(event.heads.length,192);for(let id=0;id<192;id++){
      const a=base.heads[id],b=event.heads[id];for(const key of ['id','event','birth','radius','intensity','seed','colour','trail','drag','position','basePosition'])assert.deepEqual(b[key],a[key]);
      if(!selected.has(id)){assert.deepEqual(b,a);assert.equal(Object.hasOwn(b,'burnProfile'),false);compared++;}
      else{vectorNear(b.baseVelocity,a.baseVelocity.map((v,c)=>base.baselineBurst.velocity[c]+.45*(v-base.baselineBurst.velocity[c])));assert(b.thrustProfile);}
    }
    let sum=0;for(const b of base.heads)sum+=b.intensity;assert.equal(result.referencePeakBudget,sum);assert.deepEqual(compile(base,{heads:[...base.heads].reverse()}).patches,result.patches);
    const oldRandom=Math.random;try{Math.random=()=>{throw new Error('Global RNG forbidden');};assert.deepEqual(compile(base).motorBodyIds,result.motorBodyIds);}finally{Math.random=oldRandom;}
    ids.push(result.motorBodyIds);
  }assert.notDeepEqual(ids[0],ids[1]);return{nativeBodiesCompared:compared,seeds:ids.length,firstTwoMotorSelections:ids.slice(0,2),selection:'one independent keyed choice per6 native IDs; unchanged original RNG draw sequence inferred by160 deep-equal native bodies plus carrier/events'};
});
check('Shared instantiated burn/motor clock, one gain application and optical zero keeps material and motion',()=>{
  const events=[0,1,2,64].map(g=>powered(42,g)),reference=events[1];let samples=0;
  for(const event of events)for(const b of event.heads.filter(b=>b.thrustProfile)){
    const ref=reference.heads[b.id],scale=b.burnProfile.metadata.instance.timeScale;
    assert.equal(scale,b.thrustProfile.authoring.timeScale);near(b.life,1.8*scale);assert.equal(b.thrustProfile.motorEndAge,scale);assert.equal(b.burnProfile.propulsion.endAge,scale);assert(b.life<=1.908);assert(scale>=.94&&scale<=1.06);
    assert.deepEqual(b.thrustProfile,ref.thrustProfile);assert.deepEqual(b.baseVelocity,ref.baseVelocity);assert.deepEqual(b.burnProfile.material,ref.burnProfile.material);assert.equal(b.life,ref.life);
    const peak=Math.max(...b.burnProfile.emission.knots.map(k=>k.rgb[0]*.2126+k.rgb[1]*.7152+k.rgb[2]*.0722));near(peak,b.intensity);assert.equal(b.emissionReferenceI0,b.intensity);
    for(const f of [0,.1,.5,.9,1]){const age=b.life*f,r=sampleBurnProfile(b.burnProfile,age),unit=sampleBurnProfile(ref.burnProfile,age);vectorNear(r.emissionRGBReference,unit.emissionRGBReference.map(v=>v*event.intensityScale));assert.equal(sampleMaterialCDF(b.burnProfile,age),sampleMaterialCDF(ref.burnProfile,age));assert.deepEqual(sampleBody(b,b.birth+age,zero),sampleBody(ref,ref.birth+age,zero));samples++;}
  }return{gains:[0,1,2,64],samples,calibration:'native authored I0 peak normalization only; no measured cd/kg/fuel'};
});
check('Powered trail recipe is distinct within old D cap and no160 native optical recipes are added',()=>{
  assert.equal(POWERED_BEE_TRAIL_PROFILE.referenceIntensityFraction,.10);assert.equal(POWERED_BEE_TRAIL_PROFILE.durationSeconds,.18);assert.equal(POWERED_BEE_TRAIL_PROFILE.headIntensityFraction,.9);assert(Object.isFrozen(POWERED_BEE_TRAIL_PROFILE));assert(Object.isFrozen(POWERED_BEE_TRAIL_PROFILE.colourKnotsRGB));assert.notDeepEqual(POWERED_BEE_TRAIL_PROFILE,THREE_HEART_TRAIL_PROFILES.outer);
  const event=powered();assert.equal(event.heads.filter(b=>b.trailProfile).length,32);for(const b of event.heads.filter(b=>b.thrustProfile))assert.strictEqual(b.trailProfile,POWERED_BEE_TRAIL_PROFILE);return{recipeId:POWERED_BEE_TRAIL_PROFILE.recipeId,f:.10,D:.18};
});
check('Unsupported type, drag, frame and long shutter fail explicitly; pure compiler input remains unchanged',()=>{
  const event=native(),before=structuredClone(event.heads);for(const bad of [{burstFrame:undefined},{burstFrame:{right:[1,0,0],up:[0,1,0],forward:[0,0,-1]}},{eventSeed:-1},{heads:event.heads.slice(1)},{heads:event.heads.map(b=>b.id===0?{...b,drag:.22}:b)}])assert.throws(()=>compile(event,bad));
  assert.throws(()=>createFireworkEvent({type:'peony',effectProfile,starDragModel:'bounded-descent'}));assert.throws(()=>createFireworkEvent({type:'chrysanthemum',effectProfile,starDragModel:'legacy'}));
  for(const unknown of ['legacy','unknown','__proto__','constructor',null,undefined,0,{}])assert.equal(getFireworkEffectProfileLimits(unknown),null);
  for(const shutterSeconds of [-1,NaN,Infinity,1/60+Number.EPSILON,.1,1])assert.throws(()=>getFireworkShowEnvelope({type:'chrysanthemum',effectProfile,shutterSeconds}));assert.throws(()=>getFireworkShowEnvelope({type:'chrysanthemum',effectProfile,starDragModel:'legacy'}));assert.deepEqual(event.heads,before);
});
check('Power schedule and retirement cover light, material, finite motor, tail and maximum admitted shutter',()=>{
  let latest=0;for(const seed of [0,42,123,901]){const event=powered(seed);for(const b of event.heads){const due=b.birth+Math.max(b.life,b.burnProfile?.material.endAge??0,b.thrustProfile?.motorEndAge??0)+(b.trailProfile?.durationSeconds??.35)+1/60;assert(event.endTime>=due);latest=Math.max(latest,due);if(b.thrustProfile){assert(b.thrustProfile.motorEndAge<=1.06);assert(b.thrustProfile.integratedAccelerationMagnitudeMetresPerSecond<=12.72);assert(b.thrustProfile.maximumAccelerationMetresPerSecondSquared<=12);}}assert.equal(event.layerProfile.motionProfile.vectorBodyCount,32);assert.equal(event.layerProfile.motionProfile.legacyBodyCount,160);}
  return{latestDueAbsoluteSeconds:latest,padding:'existing event lifetime dominates all admitted source/tail/shutter due times'};
});
check('Analytic envelope publishes force response and optical world pads independent of sampled seed maxima',()=>{
  const max=getFireworkShowEnvelope({type:'chrysanthemum',effectProfile}),off=getFireworkShowEnvelope({type:'chrysanthemum',effectProfile,shutterSeconds:0}),p=max.limits.powered;
  assert.equal(getFireworkEffectProfileLimits(effectProfile),profileLimits);assert.equal(p.motorIntegratedAccelerationMetresPerSecond,12.72);assert.equal(p.combinedIntrinsicAllowanceMetresPerSecond,31.72);assert.equal(p.motorSeconds,1.06);assert.equal(p.motorBodySeconds,1.908);assert.equal(p.opticalShutterSeconds,1/60);assert.equal(off.limits.powered.motorOpticalShutterPaddingMetres,0);
  near(p.motorDisplacementPaddingMetres,12.72*(-Math.expm1(-max.limits.minimumBodyDragPerSecond*p.motorResponseHistorySeconds))/max.limits.minimumBodyDragPerSecond);assert(p.motorOpticalStretchPaddingMetres>0);assert.match(max.method,/positive-kernel/);assert.match(max.limitations[1],/does not prove curved-path/);
  for(let c=0;c<3;c++){assert(max.min[c]<=off.min[c]);assert(max.max[c]>=off.max[c]);}return{limits:p,extent:max.max.map((v,c)=>v-max.min[c])};
});
check('Adversarial moving-wind cone/rotation/source/tail and powered linear-shutter/stretch endpoints remain inside forecast',()=>{
  const winds=[{min:[0,0,0],max:[4.68,0,1.76],timeline:[{time:-Infinity,wind:[0,0,0]},{time:.1,wind:[4.68,0,1.76]},{time:1.3,wind:[.6552,0,.2464]},{time:3.9,wind:[1.9656,0,.7392]},{time:6.6,wind:[0,0,0]}]},
    {min:[-5,-1,-3],max:[4,1,6],timeline:[{time:-Infinity,wind:[-5,-1,6]},{time:.1,wind:[4,1,-3]},{time:1.7,wind:[-2,.5,2]},{time:4.4,wind:[0,-.3,1]},{time:8,wind:[4,1,-3]}]}];
  let cases=0,bodyPoints=0,tailPoints=0,opticalEndpoints=0;
  for(const elevation of [25,90])for(const spread of [0,15])for(const seed of [0,42])for(const wind of winds){
    const settings={type:'chrysanthemum',effectProfile,autoDirection:false,azimuth:110,elevation,launchSpreadDegrees:spread,burstTiltDegrees:45,burstRollDegrees:30,starDragModel:'bounded-descent'},envelope=getFireworkShowEnvelope({settings,wind:{min:wind.min,max:wind.max}}),sim=createFireworksSimulation({origin:[29,.87,7]});sim.configure(settings);sim.launch({seed,burstOrientation:{yawDegrees:137,tiltDegrees:-61,rollDegrees:29}});const event=sim.active[0];sampleFireworkEvent(event,event.burstTime,{windTimeline:wind.timeline,smoke:false});
    for(const b of [event.rocket,...event.heads])for(const f of [0,.1,.3,.6,.9,1]){
      const born=b.birth+b.life*f,state=sampleBody(b,born,wind.timeline),D=b.kind==='rocket'?.5:b.trailProfile?.durationSeconds??.35;inside(state.position,envelope,{elevation,spread,seed,id:b.id,f});bodyPoints++;
      for(const fraction of [.25,.5,1]){const ember={birth:born,position:state.position,velocity:state.velocity.map(v=>.25*v),drag:1.35,gravity:9.81};inside(sampleBody(ember,born+D*fraction,wind.timeline).position,envelope,{tail:true,id:b.id,f,fraction});tailPoints++;}
    }
    for(const b of event.heads.filter(x=>x.thrustProfile))for(const f of [.1,.5,.95,1]){
      const D=b.trailProfile.durationSeconds,time=b.birth+Math.max(D,b.life*f),nodes=[0,D*.25,D*.5,D*.75,D].map(lag=>createTailReleaseFieldNode(b,lag)),states=nodes.map(n=>sampleTailReleaseFieldNode(n,time,wind.timeline));
      for(let j=0;j<states.length;j++){
        const current=states[j],a=states[Math.max(0,j-1)],z=states[Math.min(states.length-1,j+1)],stretch=z.position.map((v,c)=>v-a.position[c]);
        for(const sign of [-1,1]){inside(current.position.map((v,c)=>v+sign*current.velocity[c]/120),envelope,{shutter:true,id:b.id,f,j});inside(current.position.map((v,c)=>v+sign*stretch[c]*.5),envelope,{stretch:true,id:b.id,f,j});opticalEndpoints+=2;}
      }
    }cases++;
  }return{cases,bodyPoints,tailPoints,opticalEndpoints,scope:'Counterexample witnesses only. Positive-kernel/derivative hard-contract proof provides seed-independent coverage; Gaussian/DOF/bloom/native scalar footprint still separately framed.'};
});
check('32-stratum coverage and native angular distribution are measured without uniformity overclaim',()=>{
  const base=native(42),selected=new Set(powered(42).layerProfile.motorBodyIds),unit=v=>{const n=Math.hypot(...v);return v.map(x=>x/n);},vectors=base.heads.filter(b=>selected.has(b.id)).map(b=>unit(b.baseVelocity.map((v,c)=>v-base.baselineBurst.velocity[c]))),octants=Array(8).fill(0);
  for(const v of vectors)octants[(v[0]>=0?1:0)|(v[1]>=0?2:0)|(v[2]>=0?4:0)]++;return{seed:42,octants,count:vectors.length,minimumWorldY:Math.min(...vectors.map(v=>v[1])),maximumWorldY:Math.max(...vectors.map(v=>v[1])),caveat:'One per six native IDs is latitude stratification, not an equal-solid-angle covering theorem or guaranteed octant population for every seed.'};
});
check('Approved launch/burst audio remains byte-identical and no measured physical calibration is claimed',()=>{
  const audio=hash(fs.readFileSync(new URL('../fireworks-audio.js',import.meta.url)));assert.equal(audio,'4e5ede41813249f062e50b212553e5e1821c27feaead8416b68ab51ba1b8ec31');const result=compile(native());assert.match(result.photometry,/no measured/);assert.match(result.material,/not the production smoke scheduler/);return{audioSHA256:audio};
});

const report={schema:'glass-atoll.r22-powered-layer-envelope-cpu.v1',started,completed:new Date().toISOString(),actualGPU:false,passed:checks.every(c=>c.passed),counts:{passed:checks.filter(c=>c.passed).length,total:checks.length},checks,sourceSHA256:Object.fromEntries(['firework-layer-profile.js','firework-show-envelope.js','firework-trail-profile.js'].map(f=>[f,hash(fs.readFileSync(new URL('../'+f,import.meta.url)))])),limits:['CPU source/compiler and analytic forecast only; no native image, GPU performance, full shutter optics or smoke scheduler acceptance.','The authored 1s held-force reference is not measured bee dynamics or a continuous angular-rate simulation.','Existing R19 source-pin check expects metadata-only physics edits; its behavioral tests pass but that pin does not admit R22 changes.']};
fs.writeFileSync(new URL('./r22-powered-layer-envelope-check.json',import.meta.url),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report,null,2));if(!report.passed)process.exitCode=1;
