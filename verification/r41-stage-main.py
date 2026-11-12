from pathlib import Path
import hashlib,json
root=Path(__file__).resolve().parent.parent
path=root/'main.js'
old=path.read_bytes()
assert hashlib.sha256(old).hexdigest()=='388afa4fd4d6a4d479860d476ce2c2424b8c70c22439b7f3d3304fe40216674f'
backup=root/'verification/baselines/r41-before-joint-main'
backup.mkdir(parents=True,exist_ok=False)
(backup/'main.js').write_bytes(old)
s=old.decode('utf-8')
def replace(a,b):
 global s
 assert s.count(a)==1,(a[:100],s.count(a))
 s=s.replace(a,b)
replace("import { createSmokeTransmissionGPU } from './pyro-smoke-transmission-gpu.js';", "import { createSmokeTransmissionGPU } from './pyro-smoke-transmission-gpu.js';\nimport { planJointSmokeWork } from './smoke-joint-work.js';")
replace("let smokeGPURequested=true,smokeGPUSupport=null;", "let smokeGPURequested=true,smokeGPUSupport=null;\n// Opt-in integration pilot. No default capacity or presentation change.\nlet jointSmokePilot=false,jointSmokePending=null,jointSmokeActive=null,jointSmokeFault=null,jointSmokeLast=null,qaSmokeReviewProfile='production';\nconst smokeWorkPolicy=()=>jointSmokePilot?{maxRequestPairs:12000000,maxMapPairs:1000000,maxMapDraws:16}:{maxRequestPairs:4000000,maxMapPairs:1000000,maxMapDraws:8};")
# The selected host is recreated only by the existing explicit empty-scene QA setter.
replace("...profiles[name],projectionMode:rendering.projectionMode,lightFieldBakeMode:rendering.lightFieldBakeMode,lightFieldMaxRequestPairs:4000000,lightFieldMaxMapPairs:1000000,lightFieldMaxMapDraws:8", "...profiles[name],projectionMode:rendering.projectionMode,lightFieldBakeMode:rendering.lightFieldBakeMode,lightFieldMaxRequestPairs:smokeWorkPolicy().maxRequestPairs,lightFieldMaxMapPairs:1000000,lightFieldMaxMapDraws:smokeWorkPolicy().maxMapDraws")
replace("const previous=pyroSmoke;pyroSmoke=next;previous.dispose();updateScenePhotometry(0,true);lens.resetTemporalHistory('QA smoke source profile');", "discardJointSmokePlan();const previous=pyroSmoke;pyroSmoke=next;qaSmokeReviewProfile=name;previous.dispose();updateScenePhotometry(0,true);lens.resetTemporalHistory('QA smoke source profile');")
replace("    clearSmoke,\n", """    setJointSmokePilot(enabled=false){
      if(typeof enabled!=='boolean'||qaRenderLock||qaFrozenWorkload||graphicsContextInterrupted||!parameters.paused||qaSmokeVariants)throw new Error('Joint pilot requires a healthy, paused, exclusive scene');
      const f=fireworks.diagnostics(),d=pyroSmoke.diagnostics();
      if(f.active||f.queued||pyroSmoke.packetCount||d.state.ledger.pendingMass)throw new Error('Retire fireworks and explicitly clear smoke before changing the joint pilot');
      if(enabled&&(!smokeGPURequested||!smokeGPUSupport?.passed||qaSmokeTransmissionMode!=='fast'))throw new Error('Joint pilot requires the admitted GPU transmission route');
      discardJointSmokePlan();jointSmokeFault=null;jointSmokePilot=enabled;
      configureSmokeGPUField(smokeGPURequested&&!!smokeGPUSupport?.passed,{maxSources:18000,maxPackets:4096,maxPairs:1048576,...smokeWorkPolicy()});
      this.setSmokeReviewProfile(qaSmokeReviewProfile);lastPausedRenderKey=null;
      return this.smokeJointFrame();
    },
    smokeJointFrame(){return {requested:jointSmokePilot,pending:!!jointSmokePending,active:!!jointSmokeActive,fault:jointSmokeFault,last:jointSmokeLast,policy:smokeWorkPolicy(),scope:'Opt-in synchronous joint frame integration; no full-frame performance admission'};},
    clearSmoke,
""")
for marker in ["    async benchmarkFrozenSmoke({seconds=3,projectionMode='ellipsoid',bakeMode='tiled64'}={}){", "    async replayFlicker({regions,frames=48,startTime=10,step=1/60,mode=0,kind='water'}={}){", "    async runPalmFrameCostCheck(){"]:
 replace(marker,marker+"if(jointSmokePilot)throw new Error('Disable the joint pilot before an incumbent isolated QA measurement');")
replace("  const field=pyroSmoke?.prepareLighting?.({ledger:fieldVisible?fireworks.getEmissionLedger({rawPerCandela:RAW_PER_CANDELA}):null,enabled:fieldVisible})||{effective:false,supported:false,reason:'not-integrated'};", """  let joint=null;
  if(jointSmokeEligible())try{joint=beginJointSmokePlan(baseFrame,fieldVisible);}catch(error){failJointSmokePlan(error);}
  else discardJointSmokePlan();
  const field=pyroSmoke?.prepareLighting?.({ledger:fieldVisible?(joint?joint.ledger:jointSmokeFault?null:fireworks.getEmissionLedger({rawPerCandela:RAW_PER_CANDELA})):null,enabled:fieldVisible&&!jointSmokeFault})||{effective:false,supported:false,reason:'not-integrated'};
  if(joint&&fieldVisible&&!field.effective)failJointSmokePlan(new Error('Joint SH field was not completed: '+field.reason));
  if(joint)joint.fieldVersion=field.version??null;""")
replace("const pyro=fireworks?.getRadianceBound({camera,optics:currentOptics(),rawPerCandela:RAW_PER_CANDELA})", "const pyro=fireworks?.getRadianceBound({camera,optics:joint?.main.optics??currentOptics(),rawPerCandela:RAW_PER_CANDELA})")
replace("optics:{...currentOptics(),width:water.reflection.width,height:water.reflection.height,dof:false,legacyShutterSeconds:0},rawPerCandela:RAW_PER_CANDELA}):{};", "optics:joint?.reflection.optics??{...currentOptics(),width:water.reflection.width,height:water.reflection.height,dof:false,legacyShutterSeconds:0},rawPerCandela:RAW_PER_CANDELA}):{};")
replace("  if(reflection)atmosphere.renderTransientClouds({renderer,target,camera,reflection,planeY,frame:frameSnapshot});", "  const jointView=jointSmokeActive?validateJointSmokeConsumer({camera,target,reflection,planeY,optics:cameraOptics}):null;\n  if(reflection)atmosphere.renderTransientClouds({renderer,target,camera,reflection,planeY,frame:frameSnapshot});")
replace("  let emitterMedium=medium;", "  let emitterMedium=jointView?jointSmokeActive.medium:medium;")
replace("fireworks.render({renderer,target,camera,opaqueDepth,reflection,planeY,frame:frameSnapshot,optics:cameraOptics,air,medium:emitterMedium,legacySmoke:false,transmissionBatch:qaSmokeTransmissionField});", "fireworks.render({renderer,target,camera,opaqueDepth,reflection,planeY,frame:frameSnapshot,optics:cameraOptics,air,medium:emitterMedium,legacySmoke:false,transmissionBatch:jointView?(emitterMedium?jointSmokeActive.transmission:null):qaSmokeTransmissionField,preparedView:jointView?.handle??null});\n  if(jointView){jointView.consumed=true;jointSmokeActive.consumed.push(reflection?'reflection':'main');const t=fireworks.diagnostics().sourceTransmission;if(t?.mediumQueries)throw new Error('Joint source view used CPU transmission');}")
replace("function configureSmokeGPUField(enabled,caps={maxSources:18000,maxPackets:4096,maxPairs:1048576,maxRequestPairs:4000000,maxMapPairs:1000000,maxMapDraws:8}){", "function configureSmokeGPUField(enabled,caps={maxSources:18000,maxPackets:4096,maxPairs:1048576,...smokeWorkPolicy()}){\n  discardJointSmokePlan();")
replace("  if(document.hidden||qaRenderLock||graphicsContextInterrupted){", "  if(document.hidden||qaRenderLock||graphicsContextInterrupted||jointSmokeFault){discardJointSmokePlan();")
replace("if(!pausedRenderCached){atmosphere.prepareStarView(renderer,camera,{width:lens.state.width,height:lens.state.height,storageEV:frameSnapshot.storageEV,frame:frameSnapshot,optics:currentOptics()});water.render(time);mark('water-captures');lens.render(scene,camera.position.distanceTo(controls.target));mark('main-lens-display');}", "if(!pausedRenderCached&&!jointSmokeFault){atmosphere.prepareStarView(renderer,camera,{width:lens.state.width,height:lens.state.height,storageEV:frameSnapshot.storageEV,frame:frameSnapshot,optics:currentOptics()});try{renderSceneFrame({mark});}catch(error){if(!jointSmokePilot)throw error;failJointSmokePlan(error);}}else discardJointSmokePlan();")
replace("screenshot(){lens.render(scene,camera.position.distanceTo(controls.target),{sdr:true});", "screenshot(){renderSceneFrame({includeWater:false,sdr:true});")
replace("function savePhoto(){\n  lens.render(scene,camera.position.distanceTo(controls.target),{sdr:true});", "function savePhoto(){\n  renderSceneFrame({includeWater:false,sdr:true});")
helpers='''
function jointSmokeEligible(){return jointSmokePilot&&!qaRenderLock&&!qaFrozenWorkload&&!graphicsContextInterrupted&&!jointSmokeFault;}
function discardJointSmokePlan(){
  const plan=jointSmokePending;jointSmokePending=null;
  if(plan)for(const view of [plan.main,plan.reflection])if(view?.handle)plan.owner.discardPreparedSourceView(view.handle);
}
function failJointSmokePlan(error){
  discardJointSmokePlan();qaSmokeTransmissionInput=null;
  pyroSmoke?.prepareLighting({enabled:false});
  if(!jointSmokeFault){jointSmokeFault={message:String(error?.message??error),time};parameters.paused=true;ui?.setPaused(true);console.error('Joint smoke pilot stopped:',jointSmokeFault.message);}
}
function jointOpticsKey(optics,reflection=false){
  return [optics.width,optics.height,optics.focalMm??28,optics.aperture??8,optics.focusMetres??60,optics.sensorHeightMm??24,!reflection&&optics.dof,optics.shutterSeconds??1/120,reflection?0:optics.shutterSeconds??1/120];
}
function beginJointSmokePlan(frame,lightingEnabled){
  discardJointSmokePlan();
  const mediumHost=fireworksSettings.persistentSmoke?pyroSmoke:null;
  if(mediumHost&&(!qaSmokeTransmissionField||qaSmokeTransmissionMode!=='fast'))throw new Error('Joint GPU transmission route is unavailable');
  const snapshot=mediumHost?.snapshot()??null;
  // The synchronous draw owns one public snapshot. Row preparation/validation
  // share it; physical state is neither modified nor substituted in the host.
  const medium=mediumHost?Object.create(mediumHost,{snapshot:{value:()=>snapshot}}):null;
  const base=currentOptics(),focus=parameters.lens.focusMode==='manual'?THREE.MathUtils.clamp(parameters.lens.focusDistance,.3,24000):Math.max(.3,camera.position.distanceTo(controls.target));
  const mainOptics={...base,focusMetres:focus,sensorHeightMm:camera.getFilmHeight()},reflectionOptics={...base,width:water.reflection.width,height:water.reflection.height,dof:false,legacyShutterSeconds:0};
  const plan={owner:fireworks,mediumHost,medium,snapshot,time,transmission:qaSmokeTransmissionField,ledger:lightingEnabled?fireworks.getEmissionLedger({rawPerCandela:RAW_PER_CANDELA}):null,consumed:[],main:null,reflection:null};
  jointSmokePending=plan;
  const prepare=(viewCamera,optics,reflection)=>{const handle=fireworks.prepareSourceView({camera:viewCamera,reflection,planeY:0,frame,optics,medium,legacySmoke:false});return {handle,camera:viewCamera,optics,key:jointOpticsKey(optics,reflection),info:fireworks.getPreparedSourceViewInfo(handle),consumed:false};};
  plan.main=prepare(camera,mainOptics,false);plan.reflection=prepare(water.prepareReflectionCamera(),reflectionOptics,true);
  if(plan.ledger&&(plan.ledger.time!==time||plan.ledger.rawPerCandela!==RAW_PER_CANDELA))throw new Error('Joint emission ledger epoch/units mismatch');
  plan.work=planJointSmokeWork({packetCount:snapshot?.packets.length??0,mainCount:plan.main.info.count,mainActiveRayCount:plan.main.info.activeRayCount,reflectionCount:plan.reflection.info.count,reflectionActiveRayCount:plan.reflection.info.activeRayCount,ledgerCount:plan.ledger?.count??0,lightingEnabled},smokeWorkPolicy());
  jointSmokeLast={time,counts:plan.work.counts,work:plan.work.work,supported:plan.work.supported,reasons:plan.work.reasons,consumed:[],complete:false};
  if(!plan.work.supported)throw new Error('Joint numeric budget refused before dispatch: '+JSON.stringify(plan.work.reasons));
  return plan;
}
function validateJointSmokeConsumer({camera:consumerCamera,target,reflection,planeY,optics}){
  const plan=jointSmokeActive,view=reflection?plan.reflection:plan.main;
  if(!view||view.consumed||plan.owner!==fireworks||plan.time!==time||plan.mediumHost!==(fireworksSettings.persistentSmoke?pyroSmoke:null)||plan.transmission!==qaSmokeTransmissionField||consumerCamera!==view.camera||planeY!==0)throw new Error('Joint source view epoch/consumer changed');
  const key=jointOpticsKey({...optics,width:target.width,height:target.height},reflection);
  if(key.length!==view.key.length||key.some((x,i)=>!Object.is(x,view.key[i])))throw new Error('Joint source view actual optics changed');
  fireworks.getPreparedSourceViewInfo(view.handle); // before clouds/volume GPU
  return view;
}
function renderSceneFrame({includeWater=true,sdr=false,mark=()=>{}}={}){
  if(!jointSmokeEligible()){if(jointSmokeFault)throw new Error(jointSmokeFault.message);if(includeWater){water.render(time);mark('water-captures');}lens.render(scene,camera.position.distanceTo(controls.target),{sdr});mark('main-lens-display');return;}
  try{
    if(!jointSmokePending)updateScenePhotometry(0,true);
    if(jointSmokeFault||!jointSmokePending)throw new Error(jointSmokeFault?.message??'Joint source plan missing');
    jointSmokeActive=jointSmokePending;
    if(includeWater){water.render(time);mark('water-captures');}
    lens.render(scene,camera.position.distanceTo(controls.target),{sdr});mark('main-lens-display');
    const plan=jointSmokeActive;
    if(!plan.main.consumed||includeWater&&!plan.reflection.consumed)throw new Error('Joint frame did not consume every requested source view');
    jointSmokeLast={...jointSmokeLast,consumed:[...plan.consumed],complete:true,fieldVersion:plan.fieldVersion};
  }catch(error){failJointSmokePlan(error);throw error;}
  finally{jointSmokeActive=null;discardJointSmokePlan();}
}
'''
replace('function smokeLightingPayload(air=finiteAirPayload())',helpers+'\nfunction smokeLightingPayload(air=finiteAirPayload())')
new=s.encode('utf-8');path.write_bytes(new)
receipt={'beforeSHA256':hashlib.sha256(old).hexdigest(),'afterSHA256':hashlib.sha256(new).hexdigest(),'backup':'verification/baselines/r41-before-joint-main/main.js','pilotDefault':False,'actualGPU':False}
(root/'verification/r41-main-stage-receipt.json').write_text(json.dumps(receipt,indent=2)+'\n',encoding='utf-8')
print(json.dumps(receipt))
