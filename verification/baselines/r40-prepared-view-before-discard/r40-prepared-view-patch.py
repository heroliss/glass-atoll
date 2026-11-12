from pathlib import Path
import hashlib
p=Path('fireworks.js');s=p.read_bytes().decode();nl='\r\n'
assert hashlib.sha256(s.encode()).hexdigest()=='03fdb7038bffbfc769924ffff6ee57a51b5e9f8b2d3c72169d06e72b9d45c735'
def replace(a,b):
 global s
 a=a.replace('\n',nl);b=b.replace('\n',nl)
 assert s.count(a)==1,a[:100]
 s=s.replace(a,b)
helpers='''
  // A prepared view owns only its CPU row/ray handoff. It never prepares GPU T.
  const preparedSourceViews=new WeakMap(),livePreparedSourceViews=new Set();let nextPreparedSourceView=0;
  function releasePreparedSourceView(state,reason){state.invalid=reason;state.ordered=null;state.rays=null;state.snapshot=null;state.args=null;livePreparedSourceViews.delete(state);}
  function invalidatePreparedSourceViews(reason){for(const state of livePreparedSourceViews)releasePreparedSourceView(state,reason);}
  function sourceViewArguments({camera,target=null,reflection=false,planeY=0,frame={},optics={},medium=null,legacySmoke=true}={}){
    if(!camera)throw new TypeError('Prepared source view requires a camera');
    const width=target?.width||optics.width||1,height=target?.height||optics.height||1,shutter=optics.shutterSeconds??1/120;
    return{camera,reflection,planeY,medium,legacySmoke,frameTime:frame.time??simulation.time,rawPerCandela:frame.rawPerCandela??3.6e-5,shutter,width,height,viewOptics:{...optics,width,height,dof:!reflection&&optics.dof,legacyShutterSeconds:reflection?0:shutter}};
  }
  function sourceViewKey(a){
    const c=a.camera,o=a.viewOptics;c.updateMatrixWorld();
    return[recordsGeneration,simulation.time,sourceVisibility,clusterModel,trailIntegration,quality.trailSegments,c,a.medium,a.legacySmoke,a.reflection,a.planeY,a.frameTime,a.rawPerCandela,a.shutter,a.width,a.height,o.focalMm??28,o.aperture??8,o.focusMetres??60,o.sensorHeightMm??24,o.dof,o.legacyShutterSeconds,c.near,c.position.x,c.position.y,c.position.z,...c.matrixWorld.elements,...c.matrixWorldInverse.elements,...c.projectionMatrix.elements];
  }
  function densityViewKey(snapshot){
    if(!snapshot||!Array.isArray(snapshot.packets)||!Number.isSafeInteger(snapshot.revision)||snapshot.revision<0)throw new TypeError('Prepared view requires a revisioned committed medium snapshot');
    return[snapshot.schema,snapshot.revision,snapshot.time,snapshot.requestedTime,snapshot.tick,snapshot.pendingEmissions,snapshot.pendingWindEvents,...(snapshot.currentWind||[]),snapshot.profiles?.length,...(snapshot.profiles||[]).flatMap(p=>[p.id,...p.extinctionPerMassRGB,...p.singleScatteringAlbedoRGB]),snapshot.packets.length,...snapshot.packets.flatMap(p=>[p.id,p.profileId])];
  }
  const sameSourceViewKey=(a,b)=>a.length===b.length&&a.every((x,i)=>Object.is(x,b[i]));
  function requirePreparedSourceView(handle,args){
    const state=preparedSourceViews.get(handle);
    if(!state||state.invalid||state.used||disposed)throw new RangeError('Unknown, stale, consumed or disposed prepared source view');
    if(!sameSourceViewKey(state.key,sourceViewKey(args)))throw new RangeError('Prepared source view camera/optics/source generation changed');
    if(args.medium){if(typeof args.medium.snapshot!=='function')throw new TypeError('Prepared source view medium requires snapshot');if(!sameSourceViewKey(state.densityKey,densityViewKey(args.medium.snapshot())))throw new RangeError('Prepared source view committed density changed');}
    return state;
  }
  function prepareSourceView(options){
    if(disposed)throw new Error('Cannot prepare disposed fireworks');if(livePreparedSourceViews.size>=4)throw new RangeError('At most four current unconsumed source views');
    const args=sourceViewArguments(options),key=sourceViewKey(args),batchRequested=!!args.medium;
    validatePoweredOpticalShutter(args.shutter,simulation.active.some(e=>e.effectProfile==='powered-bees-v1'));
    const rows=prepareSourceRows(args.camera,args.rawPerCandela,args.shutter,args.legacySmoke,args.reflection,args.planeY,args.viewOptics,batchRequested,true),snapshot=batchRequested?args.medium.snapshot():null,densityKey=batchRequested?densityViewKey(snapshot):null;
    const id=++nextPreparedSourceView,info=Object.freeze({schema:'glass-atoll.prepared-source-view.v1',id,count:rows.ordered.length,activeRayCount:rows.activeRayCount,recordsGeneration,time:simulation.time,frameTime:args.frameTime,densityRevision:snapshot?.revision??null,densityTime:snapshot?.time??null,densityRequestedTime:snapshot?.requestedTime??null,packetCount:snapshot?.packets.length??0,cameraKey:rows.eye.map(v=>Object.is(v,-0)?'-0':String(v)).join(','),reflection:args.reflection,planeY:args.planeY,width:args.width,height:args.height,rawPerCandela:args.rawPerCandela,shutterSeconds:args.shutter,legacyShutterSeconds:args.viewOptics.legacyShutterSeconds,sourceVisibility,legacySmoke:args.legacySmoke,transmissionRequested:batchRequested,sourceVersion:null,requestVersionAllocated:false,bufferPolicy:'Private original-double rays and original ordered optical rows; one real render consumes this view exactly once; no GPU prepare'});
    const handle=Object.freeze(Object.create(null)),state={...rows,id,args,key,snapshot,densityKey,info,invalid:null,used:false};preparedSourceViews.set(handle,state);livePreparedSourceViews.add(state);return handle;
  }
  function getPreparedSourceViewInfo(handle){const state=preparedSourceViews.get(handle);if(!state)throw new RangeError('Unknown prepared source view');return requirePreparedSourceView(handle,state.args).info;}
'''
needle="  const sourceTransmissionScratch=new Float64Array(3);\n  let lastSourceVisibility=null,lastSourceTransmission={backend:'none',reason:'awaiting-render'},sourceTransmissionRequest=0,sourceRayBuffers=null;"
replace(needle,needle+helpers)
start=s.index('  function fillRecords(');end=s.index('    for(let i=0;i<ordered.length;i++){'+nl+"      const p=ordered[i].p,smoke=p.kind==='smoke'",start)
old=s[start:end];body=old[old.index(nl)+len(nl):]
body=body.replace('    let activeRayCount=0;','    let activeRayCount=0,rays=null;')
allocation='sourceRayBuffers??={endpoints64:new Float64Array(opticalCapacity*3),origins64:new Float64Array(opticalCapacity*3),active:new Uint8Array(opticalCapacity)};'
assert body.count(allocation)==1
body=body.replace(allocation,'rays=privateBuffers?{endpoints64:new Float64Array(opticalCapacity*3),origins64:new Float64Array(opticalCapacity*3),active:new Uint8Array(opticalCapacity)}:(sourceRayBuffers??={endpoints64:new Float64Array(opticalCapacity*3),origins64:new Float64Array(opticalCapacity*3),active:new Uint8Array(opticalCapacity)});')
body=body.replace('sourceRayBuffers.endpoints64','rays.endpoints64').replace('sourceRayBuffers.origins64','rays.origins64').replace('sourceRayBuffers.active','rays.active')
body=body.replace('    const batchRequested=!!transmissionBatch&&!!medium;'+nl,'').replace('    uniforms.uSourceTransmissionEnabled.value=0;uniforms.uSourceTransmission.value=dummy;uniforms.uSourceTransmissionSize.value.set(1,1);'+nl,'')
new='  function prepareSourceRows(camera,rawPerCandela,shutter,legacySmoke,reflection,planeY,optics,batchRequested,privateBuffers=false){'+nl+body+'    return{ordered,stats,eye,clusters,vectorSources,activeRayCount,rays};'+nl+'  }'+nl+'  function fillRecords(camera,air,rawPerCandela,shutter,medium=null,legacySmoke=true,reflection=false,planeY=0,optics={},transmissionBatch=null,target=null,prepared=null){'+nl+'    const batchRequested=!!transmissionBatch&&!!medium;'+nl+'    const {ordered,stats,eye,clusters,vectorSources,activeRayCount,rays}=prepared??prepareSourceRows(camera,rawPerCandela,shutter,legacySmoke,reflection,planeY,optics,batchRequested);'+nl+'    uniforms.uSourceTransmissionEnabled.value=0;uniforms.uSourceTransmission.value=dummy;uniforms.uSourceTransmissionSize.value.set(1,1);'+nl
s=s[:start]+new+s[end:]
replace('        snapshot=medium.snapshot();','        snapshot=prepared?prepared.snapshot:medium.snapshot();')
replace('batchResult=transmissionBatch.prepare({snapshot,count:ordered.length,...sourceRayBuffers,eye,sourceVersion:requestVersion});','batchResult=transmissionBatch.prepare({snapshot,count:ordered.length,...rays,eye,sourceVersion:requestVersion});')
replace('    if(batchRequested&&!gpuEffective){',"    if(prepared&&batchRequested&&activeRayCount>0&&!gpuEffective)throw new Error('Prepared source view requires complete matching GPU transmission: '+(batchFailure||batchResult?.reason||'unavailable'));\n    if(batchRequested&&!gpuEffective&&!prepared){")
replace("backend:gpuEffective?'gpu':medium?'cpu':'none',requested:batchRequested", "backend:gpuEffective?'gpu':prepared&&batchRequested&&activeRayCount===0?'none':medium?'cpu':'none',requested:batchRequested")
replace('  function updateRecords(){contactSupport?.begin(',"  function updateRecords(){invalidatePreparedSourceViews('physical-record-update');contactSupport?.begin(")
replace('    get sourceVisibility(){return sourceVisibility;},','    prepareSourceView,getPreparedSourceViewInfo,\n    get sourceVisibility(){return sourceVisibility;},')
replace('setSourceVisibility(value){sourceVisibility=validateSourceVisibility(value);return sourceVisibility;}',"setSourceVisibility(value){const next=validateSourceVisibility(value);if(next!==sourceVisibility)invalidatePreparedSourceViews('source-visibility-change');sourceVisibility=next;return sourceVisibility;}")
replace('const state=simulation.configure(physicsPatch);if(patch.tailColourMode',"const state=simulation.configure(physicsPatch);invalidatePreparedSourceViews('configure');if(patch.tailColourMode")
replace('render({renderer,target,camera,opaqueDepth=null,reflection=false,planeY=0,frame={},optics={},air={},medium=null,legacySmoke=true,transmissionBatch=null}={}){', '''render({renderer,target,camera,opaqueDepth=null,reflection=false,planeY=0,frame={},optics={},air={},medium=null,legacySmoke=true,transmissionBatch=null,preparedView=null}={}){
      let prepared=null;
      if(preparedView!==null){const args=sourceViewArguments({camera,target,reflection,planeY,frame,optics,medium,legacySmoke});prepared=requirePreparedSourceView(preparedView,args);if(!!transmissionBatch!==!!medium)throw new RangeError('Prepared medium view requires its actual transmission batch');prepared.used=true;livePreparedSourceViews.delete(prepared);}
      try{''')
replace('const count=fillRecords(camera,air,rawPerCandela,requestedShutter,medium,legacySmoke,reflection,planeY,viewOptics,transmissionBatch,target);', 'const count=fillRecords(camera,air,rawPerCandela,requestedShutter,medium,legacySmoke,reflection,planeY,viewOptics,transmissionBatch,target,prepared);')
replace('    setQuality(patch={}){quality.trailSegments=', "      }finally{if(prepared)releasePreparedSourceView(prepared,'consumed');}\n    },\n    setQuality(patch={}){quality.trailSegments=")
# The preceding insertion replaces the old method separator as well.
s=s.replace("    },"+nl+"      }finally{if(prepared)releasePreparedSourceView(prepared,'consumed');}","      }finally{if(prepared)releasePreparedSourceView(prepared,'consumed');}",1)
replace('dispose(){disposed=true;geometry.dispose();',"dispose(){invalidatePreparedSourceViews('disposed');disposed=true;geometry.dispose();")
p.write_bytes(s.encode())
print(hashlib.sha256(s.encode()).hexdigest())
