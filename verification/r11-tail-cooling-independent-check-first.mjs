import assert from 'node:assert/strict';
import {readFileSync,writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import * as THREE from '../vendor/three.module.js';
import {EMISSION_PROFILES,FIREWORK_TYPES} from '../fireworks-physics.js';
import {THERMAL_TAIL_COLOUR_PROFILE,thermalTailColour} from '../fireworks-thermal-tail.js';

const root=new URL('../',import.meta.url),read=p=>readFileSync(new URL(p,root),'utf8'),hash=s=>createHash('sha256').update(s).digest('hex'),checks=[];
const expected=process.argv[2];assert.match(expected??'',/^[a-f0-9]{64}$/,'pass the owner-confirmed frozenFW SHA256, not an inferred or moving version');
const source=read('fireworks.js'),before=read('verification/baselines/r10-sealed-runtime/fireworks.js'),sourceHash=hash(source);assert.equal(sourceHash,expected);assert.equal(hash(before),'b37ea388471b6f50a307327fab95ccc10d7f9aaa1dc46ed921fc1abd9c890e43');
const protectedNames=['fireworks-physics.js','fireworks-audio.js','scene-radiometry.js','display-transform.js','pyro-smoke.js','pyro-smoke-state.js','pyro-smoke-logical-events.js','pyro-smoke-logical-burn.js'],protectedStart=Object.fromEntries(protectedNames.map(p=>[p,hash(read(p))]));
assert.equal(protectedStart['fireworks-audio.js'],'4e5ede41813249f062e50b212553e5e1821c27feaead8416b68ab51ba1b8ec31');
const Y=rgb=>rgb[0]*.2126+rgb[1]*.7152+rgb[2]*.0722,near=(a,b,tolerance=1e-12)=>assert(Math.abs(a-b)<=tolerance,`${a} vs ${b}; tolerance ${tolerance}`);
const check=(name,fn)=>{try{checks.push({name,passed:true,evidence:fn()});}catch(e){checks.push({name,passed:false,error:String(e.stack||e).replace(/data:text\/javascript;base64,[A-Za-z0-9+/=]+/g,'[in-memory QA module]')});}};
async function compile(s,style='generic'){
 const suffix='api.configure({});return api;';assert.equal(s.split(suffix).length,2);
 const inject="api.configure({});Object.defineProperties(api,{__records:{get:()=>records},__simulation:{value:simulation},__arrays:{get:()=>arrays}});return api;";
 const code=(style==='single'?s.replace("from './fireworks-physics.js'",'from '+JSON.stringify(new URL('fireworks-physics.js',root).href)):s.replaceAll(/from '\.\/([^']+)'/g,(_,p)=>'from '+JSON.stringify(new URL(p,root).href))).replace(suffix,inject);
 return(await import('data:text/javascript;base64,'+Buffer.from(code+'\n// independent '+style).toString('base64'))).createFireworks;
}
const create=await compile(source),oldCreate=await compile(before),singleCreate=await compile(source,'single');
const renderer=()=>({autoClear:true,shadowMap:{autoUpdate:true,needsUpdate:false},getRenderTarget:()=>null,getActiveCubeFace:()=>0,getActiveMipmapLevel:()=>0,setRenderTarget(){},render(){}});
const camera=()=>{const c=new THREE.PerspectiveCamera(48,16/9,.15,24000);c.position.set(-55,100,-130);c.lookAt(29,125,7);c.updateMatrixWorld();return c;};
const withoutColour=r=>{const {colour,...rest}=r;return rest;},copyLedger=f=>{const x=f.getEmissionLedger();return{...x,data:Array.from(x.data.slice(0,x.count*x.stride))};};
function make(factory,type,options={}){const f=factory(THREE,{clusterModel:'moments',trailIntegration:'adaptive',...options});f.configure({autoLaunch:false,autoDirection:false,elevation:80,azimuth:104});f.update({time:0,windVector:[.7,0,-.3]});const launch=f.launch({type,seed:71});return{f,launch};}
function rawExpectedLedger(f,rawPerCandela=3.6e-5){return f.__records.filter(p=>p.kind!=='smoke'&&p.intensity>0&&Math.max(...p.colour)>0).flatMap(p=>[...p.position.map(Math.fround),Math.fround(p.radius*p.radius/5),...p.colour.map(c=>Math.fround(p.intensity*c*rawPerCandela)),0]);}

check('pure entry endpoint identity finite output fixedY and caller isolation',()=>{
 assert(Object.isFrozen(THERMAL_TAIL_COLOUR_PROFILE));assert.equal(THERMAL_TAIL_COLOUR_PROFILE.hotKelvin,2850);assert.equal(THERMAL_TAIL_COLOUR_PROFILE.coldKelvin,1900);assert.equal(thermalTailColour(0,.5),EMISSION_PROFILES.thermal);assert(Object.isFrozen(thermalTailColour(0,.5)));
 let points=0,maximumYError=0;for(const duration of [Number.MIN_VALUE,.05,.5,3,1e40,Number.MAX_VALUE])for(const fraction of [0,.0001,.01,.125,.37,.5,.73,.9999,1]){const lag=duration*fraction;if(lag<0||lag>duration)continue;const rgb=thermalTailColour(lag,duration);assert(rgb.length===3&&rgb.every(v=>Number.isFinite(v)&&v>=0));maximumYError=Math.max(maximumYError,Math.abs(Y(rgb)-1));near(Y(rgb),1,2e-15);points++;}
 const x=thermalTailColour(.2,.5),safe=[...x];x[0]=999;assert.deepEqual(thermalTailColour(.2,.5),safe);const warm=thermalTailColour(0,1),cold=thermalTailColour(1,1);assert(cold[0]>warm[0]&&cold[1]<warm[1]&&cold[2]<warm[2]);return{points,maximumYError,exactLegacyHotIdentity:true,outputMutationDoesNotPolluteLUT:true};
});
function finePlanck(temperature){
 // Independently integrate full Planck radiance at1nm with exact SI constants.
 // The analytic CIE fit is shared scientific input, not independent colour calibration.
 const h=6.62607015e-34,c=299792458,k=1.380649e-23,xyz=[0,0,0];
 for(let w=380;w<=780;w++){
  const wavelength=w*1e-9,radiance=2*h*c*c/(wavelength**5*(Math.exp(h*c/(wavelength*k*temperature))-1));
  const G=(mean,left,right)=>{const width=w<mean?left:right;return Math.exp(-((w-mean)*width)**2/2);};
  const x=.362*G(442,.0624,.0374)+1.056*G(599.8,.0264,.0323)-.065*G(501.1,.049,.0382),y=.821*G(568.8,.0213,.0247)+.286*G(530.9,.0613,.0322),z=1.217*G(437,.0845,.0278)+.681*G(459,.0385,.0725);
  xyz[0]+=radiance*x;xyz[1]+=radiance*y;xyz[2]+=radiance*z;
 }
 const rgb=[3.24096994*xyz[0]-1.53738318*xyz[1]-.49861076*xyz[2],-.96924364*xyz[0]+1.8759675*xyz[1]+.04155506*xyz[2],.05563008*xyz[0]-.20397696*xyz[1]+1.05697151*xyz[2]],offset=Math.max(0,-Math.min(...rgb)),nonnegative=rgb.map(v=>v+offset),luma=Y(nonnegative);return nonnegative.map(v=>v/luma);
}
check('5nm LUT and RGB interpolation agree with independent1nm Planck integration',()=>{
 let maximumAbsoluteChannelError=0;const rows=[];for(const fraction of [0,.031,.149,.25,.371,.5,.719,.875,.999,1]){const rgb=thermalTailColour(fraction,1),oracle=finePlanck(2850-950*fraction),error=Math.max(...rgb.map((v,i)=>Math.abs(v-oracle[i])));assert(error<=5e-4);maximumAbsoluteChannelError=Math.max(maximumAbsoluteChannelError,error);rows.push({fraction,temperatureKelvin:2850-950*fraction,rgb,oracle,error});}return{points:rows.length,maximumAbsoluteChannelError,absoluteChannelTolerance:5e-4,rows,scope:'quadrature and LUT interpolation for authored Planck/CIE-fit model; not measured ember spectral calibration'};
});
check('invalid pure inputs reject and do not mutate subsequent valid results',()=>{
 const expected=thermalTailColour(.6,1);let cases=0;for(const args of [[NaN,1],[Infinity,1],[-.1,1],[1.1,1],[0,0],[0,-1],[0,NaN],[0,Infinity],['.1',1],[.1,'1'],[undefined,1],[.1,null]]){assert.throws(()=>thermalTailColour(...args),RangeError);cases++;}assert.deepEqual(thermalTailColour(.6,1),expected);return{cases};
});
check('default constant allten full source records events ledger clusters bounds retain R10 behavior',()=>{
 let frames=0;for(const type of FIREWORK_TYPES.map(t=>t.id)){const a=make(create,type),b=make(oldCreate,type),cam=camera();try{
  assert.deepEqual(a.launch,b.launch);assert.equal(a.f.tailColourMode,'constant');
  const phases=[0,.25,a.launch.burstTime+.06,a.launch.burstTime+.8,a.launch.burstTime+2.3,a.launch.burstTime+5.2];
  for(const t of [...new Set(phases)].sort((a,b)=>a-b)){for(const z of [a,b])z.f.update({time:t,windVector:[t<3?.7:-.4,0,-.3]});assert.deepEqual(a.f.__records,b.f.__records);assert.deepEqual(a.f.drainEvents(),b.f.drainEvents());assert.deepEqual(a.f.getEmissionLedger(),b.f.getEmissionLedger());assert.deepEqual(a.f.getLightClusters(),b.f.getLightClusters());assert.deepEqual(a.f.getBounds(),b.f.getBounds());assert.deepEqual(a.f.getRadianceBound({camera:cam}),b.f.getRadianceBound({camera:cam}));assert.deepEqual(a.f.diagnostics(),b.f.diagnostics());if(a.f.__simulation.active.some(e=>e.id===a.launch.id))assert.deepEqual(a.f.smokeSourceProvider.describe(a.launch.id),b.f.smokeSourceProvider.describe(b.launch.id));else{assert.throws(()=>a.f.smokeSourceProvider.describe(a.launch.id));assert.throws(()=>b.f.smokeSourceProvider.describe(b.launch.id));}frames++;}
 }finally{a.f.dispose();b.f.dispose();}}return{types:10,frames,recordTolerance:0,defaultPromoted:false};
});
check('cooling changes only detached RGB while source candela motion envelopes and audio events stay exact',()=>{
 let frames=0,records=0,changed=0,maximumYDifference=0;const affectedTypes=new Set();
 for(const type of FIREWORK_TYPES.map(t=>t.id)){const a=make(create,type),b=make(create,type,{tailColourMode:'cooling'});try{
  assert.deepEqual(a.launch,b.launch);for(const t of [...new Set([.2,a.launch.burstTime+.1,a.launch.burstTime+.9,a.launch.burstTime+2.7,a.launch.burstTime+6])].sort((a,b)=>a-b)){
   for(const z of [a,b])z.f.update({time:t,windVector:[1.4,0,.3]});const old=a.f.__records,next=b.f.__records;assert.equal(old.length,next.length);assert.deepEqual(old.map(withoutColour),next.map(withoutColour));assert.deepEqual(a.f.drainEvents(),b.f.drainEvents());assert.deepEqual(a.f.__simulation.state,b.f.__simulation.state);assert.deepEqual(a.f.getBounds(),b.f.getBounds());
   for(let i=0;i<old.length;i++){const p=old[i],q=next[i];if(p.kind==='smoke'||p.radius!==.0018)assert.deepEqual(q.colour,p.colour);else{near(Y(q.colour),Y(p.colour),2e-15);maximumYDifference=Math.max(maximumYDifference,Math.abs(Y(q.colour)-Y(p.colour)));if(q.colour.some((v,k)=>v!==p.colour[k])){changed++;affectedTypes.add(type);}}records++;}
   const ledger=b.f.getEmissionLedger();assert.deepEqual(Array.from(ledger.data.slice(0,ledger.count*8)),rawExpectedLedger(b.f));frames++;
  }
 }finally{a.f.dispose();b.f.dispose();}}
 assert(changed>0&&affectedTypes.has('willow')&&affectedTypes.has('palm'));return{types:10,frames,records,changedDetachedRecords:changed,affectedTypes:[...affectedTypes],maximumYDifference,perRecordCandelaUnchanged:true,noPhysicsOrSoundEventChanges:true};
});
check('paused mode switch invalidates ledger and light cache while preserving total candela',()=>{
 const {f,launch}=make(create,'willow'),cam=camera();try{
  f.update({time:launch.burstTime+1.3,windVector:[1.5,0,-.4]});const settings=structuredClone(f.__simulation.state),records=structuredClone(f.__records),constant=copyLedger(f),constantClusters=structuredClone(f.getLightClusters()),constantBound=f.getRadianceBound({camera:cam}),spatial=structuredClone(f.getBounds()),events=f.drainEvents();
  const coolConfig=f.configure({tailColourMode:'cooling'});assert.equal(coolConfig.tailColourMode,'cooling');assert.equal(f.tailColourMode,'cooling');assert.deepEqual(f.__simulation.state,settings);assert.deepEqual(f.__records.map(withoutColour),records.map(withoutColour));assert.deepEqual(f.getBounds(),spatial);assert.deepEqual(f.drainEvents(),[]);
  const cooled=copyLedger(f),coolClusters=f.getLightClusters(),coolBound=f.getRadianceBound({camera:cam});assert(cooled.version>constant.version&&cooled.recordGeneration>constant.recordGeneration);assert.equal(cooled.time,constant.time);assert.equal(cooled.count,constant.count);assert.notDeepEqual(cooled.data,constant.data);assert.deepEqual(cooled.data,rawExpectedLedger(f));
  assert.equal(coolClusters.length,constantClusters.length);for(let i=0;i<coolClusters.length;i++){const {color,colour,...spatialLight}=coolClusters[i],{color:oldColor,colour:oldColour,...oldSpatialLight}=constantClusters[i];assert.deepEqual(spatialLight,oldSpatialLight);near(Y(color),Y(oldColor),2e-15);assert.notDeepEqual(color,oldColor);}
  assert.equal(coolBound.maximumEmissionRGBChannel,Math.max(...f.__records.filter(p=>p.kind!=='smoke').flatMap(p=>p.colour)));assert.notEqual(coolBound.globalFiniteSurfaceCeiling,constantBound.globalFiniteSurfaceCeiling);
  f.configure({tailColourMode:'constant'});assert.equal(f.tailColourMode,'constant');assert.deepEqual(f.__records,records);const roundtrip=copyLedger(f);assert.deepEqual(roundtrip.data,constant.data);assert.deepEqual(f.getLightClusters(),constantClusters);assert.deepEqual(f.getRadianceBound({camera:cam}),constantBound);assert.deepEqual(f.__simulation.state,settings);return{pausedTime:cooled.time,count:cooled.count,ledgerGenerationAdvanced:true,roundtripRGBBitExact:true,perChannelHDRBoundRecomputed:true,eventsWereDrainedBeforeSwitch:events.length};
 }finally{f.dispose();}
});
check('new invalid modes reject before mixed physics patches or mode cache changes',()=>{
 const {f,launch}=make(create,'palm');try{f.update({time:launch.burstTime+.7,windVector:[0,0,0]});const before={records:structuredClone(f.__records),settings:structuredClone(f.__simulation.state),ledger:f.getEmissionLedger(),clusters:f.getLightClusters(),mode:f.tailColourMode};let cases=0;
  for(const value of [null,'bad','Cooling',1,{},false]){assert.throws(()=>f.configure({tailColourMode:value,autoLaunch:true,elevation:25}),RangeError);assert.equal(f.tailColourMode,before.mode);assert.deepEqual(f.__records,before.records);assert.deepEqual(f.__simulation.state,before.settings);assert.equal(f.getEmissionLedger(),before.ledger);assert.equal(f.getLightClusters(),before.clusters);cases++;assert.throws(()=>create({}, {tailColourMode:value}),RangeError);}
  assert.throws(()=>f.configure({tailColourMode:'cooling',flightModel:'bad'}),RangeError);assert.equal(f.tailColourMode,before.mode);assert.deepEqual(f.__simulation.state,before.settings);assert.equal(f.getEmissionLedger(),before.ledger);return{invalidModes:cases,constructorRejectedBeforeTHREEAllocation:true,mixedPhysicsRejectionDidNotCommitMode:true};
 }finally{f.dispose();}
});
check('singlephysics import rewrite and generic dataURL factory styles remain executable',()=>{
 const a=make(create,'palm',{tailColourMode:'cooling'}),b=make(singleCreate,'palm',{tailColourMode:'cooling'});try{for(const t of [.1,a.launch.burstTime+.9]){a.f.update({time:t,windVector:[.8,0,-.6]});b.f.update({time:t,windVector:[.8,0,-.6]});assert.deepEqual(a.f.__records,b.f.__records);assert.deepEqual(a.f.getEmissionLedger(),b.f.getEmissionLedger());}return{existingRewriteIdioms:2,newRelativeFactoryImportRequired:false,pureEntryNeedsNoTHREESceneConstruction:true};}finally{a.f.dispose();b.f.dispose();}
});
check('main and mirrored render uploads use the same new physical RGB and independent transmission once',()=>{
 const {f,launch}=make(create,'palm',{tailColourMode:'cooling'}),cam=camera(),render=renderer();try{
  f.update({time:launch.burstTime+1.1,windVector:[.8,0,.4]});let passes=0,uploaded=0;for(const reflection of [false,true]){
   const T=reflection?[.75,.45,.9]:[.8,.65,.5],medium={writeTransmission(from,to,out,options){assert.equal(options.reflection,reflection);for(let i=0;i<3;i++)out[i]=T[i];return out;}};
   f.render({renderer:render,target:{width:1280,height:720},camera:cam,reflection,planeY:0,frame:{storageEV:12,rawPerCandela:3.6e-5},optics:{width:1280,height:720},medium,legacySmoke:false});
   const m=new THREE.Vector3(),ordered=f.__records.filter(p=>p.kind!=='smoke').map(p=>({p,z:m.fromArray(p.position).applyMatrix4(cam.matrixWorldInverse).z})).sort((a,b)=>a.z-b.z);
   for(let i=0;i<ordered.length;i++)for(let c=0;c<3;c++){assert.equal(f.__arrays.colour[i*3+c],Math.fround(Math.fround(ordered[i].p.colour[c])*T[c]));uploaded++;}passes++;
  }return{passes,uploadedComponents:uploaded,actualGPU:false,scope:'real CPU render submission using existing shader source, not GPU image validation'};
 }finally{f.dispose();}
});
check('unrelated runtime audio photometry and reviewedFW source bytes stayed frozen',()=>{
 assert.equal(hash(read('fireworks.js')),sourceHash);assert.deepEqual(Object.fromEntries(protectedNames.map(p=>[p,hash(read(p))])),protectedStart);return protectedStart;
});
const report={schema:'glass-atoll.r11-tail-cooling-independent.v1',dateUTC:new Date().toISOString(),actualGPU:false,sourceSHA256:{fireworks:sourceHash,baselineFireworks:hash(before),pureEntry:hash(read('fireworks-thermal-tail.js')),helper:hash(read('verification/r11-tail-cooling-independent-check.mjs'))},checks,counts:{passed:checks.filter(c=>c.passed).length,total:checks.length},limits:['Colour-only authored2850to1900K detached-tail proxy normalized to photopicY1. Existing brightness weights/envelope remain, so this is not blackbody radiant-power decay, heat transfer, fuel burn, measured temperature or pyrochemistry.','Independent1nm integration uses the same analytic CIE-fit scientific input; it checks quadrature/LUT mechanics, not measured real-firework colour calibration.','Valid finite API paths, CPU records/ledger/clusters/bounds and submit arrays only. No actualGPU, HDR display, visual improvement, image acceptance, FPS or scene exposure calibration claim.','Default remains constant. Current camera/P may change under legitimate per-channel bound changes when optin is enabled; equal photopic candela does not imply equal maximumRGB channel.']};report.passed=checks.every(c=>c.passed);
writeFileSync(new URL('./r11-tail-cooling-independent-check.json',import.meta.url),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({passed:report.passed,counts:report.counts,failures:checks.filter(c=>!c.passed)},null,2));if(!report.passed)process.exitCode=1;
