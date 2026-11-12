// Pure QA accounting/ownership only. No renderer, asynchronous scheduler or publish API.
import {planSmokeTransmissionLayout as currentT} from '../smoke-transmission-layout.js';
import {planSmokeLightTiles as currentSH} from '../pyro-smoke-light-tiles.js';
import {planTransmissionRectangles,decomposeTransmissionInterval} from '../smoke-transmission-rectangles.js';
import {planSmokeTransmissionLayout as candidateT} from './r39-dense-layout.js';
import {planSmokeLightTiles as candidateSH} from './r39-dense-light-tiles.js';
export const R39_DENSE_JOINT_PLANNER_SCHEMA='glass-atoll.r39.qa-dense-joint-plan.v1';
export const R39_DENSE_JOINT_POLICIES=Object.freeze({'current-4m':Object.freeze({maxRequestPairs:4000000,maxMapPairs:1000000,maxMapDraws:8}),'candidate-12m':Object.freeze({maxRequestPairs:12000000,maxMapPairs:1000000,maxMapDraws:16})});
export const R39_DENSE_JOINT_HARD_CAPS=Object.freeze({maxLogicalPairs:36000000,maxConservativeSlots:40000000,maxDraws:51,maxReductionFetches:2304000,maxRasterTexels:1048576,maxUploadBytes:2768896,maxGpuNumericalBytes:19329024,maxCpuUploadBytes:2768896,maxReadbackBytes:1048576,maxOwnedInputBytes:16777216});
const owned=new WeakMap();let nextId=0;
const freeze=x=>{if(x&&typeof x==='object'){for(const v of Object.values(x))freeze(v);Object.freeze(x);}return x;};
const integer=(v,n,max=Number.MAX_SAFE_INTEGER)=>{if(!Number.isSafeInteger(v)||v<0||v>max)throw new RangeError(n+' requires a bounded nonnegative safe integer');return v;};
const finite=(v,n)=>{if(typeof v!=='number'||!Number.isFinite(v))throw new RangeError(n+' requires finite number');return v;};
const bool=(v,n)=>{if(typeof v!=='boolean')throw new TypeError(n+' requires boolean');return v;};
const demand=(v,n)=>{if(!v)throw new RangeError(n);};
const product=(a,b,n)=>integer(a*b,n),sum=(a,b,n)=>integer(a+b,n);
function texture(n){const width=Math.min(256,2**Math.ceil(Math.log2(Math.max(1,n)))),height=Math.ceil(Math.max(1,n)/width);return{width,height,logicalCapacity:n,texelCapacity:width*height};}
function counts(input){
 if(!input||typeof input!=='object'||Object.keys(input).length!==6||Object.keys(input).some(k=>!['packets','mainCount','reflectionCount','ledgerCount','mainSubmitted','reflectionSubmitted'].includes(k)))throw new TypeError('Complete exact three-job count fields required');
 return{packets:integer(input.packets,'packets',4096),mainCount:integer(input.mainCount,'mainCount',18000),reflectionCount:integer(input.reflectionCount,'reflectionCount',18000),ledgerCount:integer(input.ledgerCount,'ledgerCount',14000),mainSubmitted:bool(input.mainSubmitted,'mainSubmitted'),reflectionSubmitted:bool(input.reflectionSubmitted,'reflectionSubmitted')};
}
function validateBudget(value){
 if(!value||typeof value!=='object'||Object.keys(value).length!==Object.keys(R39_DENSE_JOINT_HARD_CAPS).length||Object.keys(value).some(k=>!Object.hasOwn(R39_DENSE_JOINT_HARD_CAPS,k)))throw new TypeError('Every explicit primitive aggregate budget is required');
 return Object.fromEntries(Object.entries(R39_DENSE_JOINT_HARD_CAPS).map(([key,cap])=>[key,integer(value[key],key,cap)]));
}
function copyMeasure(value,{copy=false}={}){
 let bytes=0,nodes=0;const active=new WeakSet();
 function walk(x,depth){
  if(++nodes>750000||depth>40)throw new RangeError('Captured epoch data node/depth bound exceeded');
  if(x===null)return null;if(typeof x==='number'){finite(x,'Captured number');bytes+=8;return x;}if(typeof x==='boolean'){bytes++;return x;}if(typeof x==='string'){if(x.length>8192)throw new RangeError('Captured string too long');bytes+=x.length*2;return x;}
  if(!x||typeof x!=='object'||active.has(x))throw new TypeError('Captured epoch requires finite acyclic plain data');
  if(ArrayBuffer.isView(x))throw new TypeError('Fixture capture accepts plain original numeric arrays, not borrowed mutable typed arrays');
  if(Array.isArray(x)&&x.length>200000)throw new RangeError('Captured individual array bound exceeded before descriptors/copy');
  if(!Array.isArray(x)&&![Object.prototype,null].includes(Object.getPrototypeOf(x)))throw new TypeError('Captured epoch requires plain objects');
  const d=Object.getOwnPropertyDescriptors(x);if(Reflect.ownKeys(x).some(k=>typeof k==='symbol')||Object.entries(d).some(([key,v])=>v.get||v.set||!v.enumerable&&!(Array.isArray(x)&&key==='length')))throw new TypeError('Captured data cannot use symbols/accessors/hidden fields');
  if(Array.isArray(x)&&(Object.keys(x).length!==x.length||Object.getPrototypeOf(x)!==Array.prototype))throw new TypeError('Captured arrays must be dense own plain entries');
  if(Array.isArray(x))for(let i=0;i<x.length;i++)if(!Object.hasOwn(x,i))throw new TypeError('Captured arrays must have every own entry');
  active.add(x);let result;if(Array.isArray(x)){result=copy?[]:null;for(let i=0;i<x.length;i++){const v=walk(x[i],depth+1);if(copy)result.push(v);}}
  else{result=copy?Object.create(null):null;for(const [key,v]of Object.entries(x)){bytes+=key.length*2;const y=walk(v,depth+1);if(copy)result[key]=y;}}
  active.delete(x);return result;
 }
 const result=walk(value,0);return{value:result,bytes:integer(bytes,'capture numeric/UTF16 payload'),nodes};
}
function keyForEye(eye){if(!Array.isArray(eye)||eye.length!==3)throw new TypeError('View original eye requires three coordinates');return eye.map(v=>{finite(v,'eye');return Object.is(v,-0)?'-0':String(v);}).join(',');}
function normalizeFixture(fixture){
 const snapshot=fixture?.snapshot,ledger=fixture?.ledger,consumers=fixture?.consumers;
 if(!snapshot||!Array.isArray(snapshot.packets)||!Array.isArray(snapshot.profiles)||!ledger||!Array.isArray(consumers)||consumers.length!==2)throw new TypeError('One shared snapshot, one complete ledger and two view consumers required');
 integer(snapshot.revision,'densityRevision');finite(snapshot.time,'committed density time');
 const opticalGeneration=integer(fixture.opticalRecordGeneration,'opticalRecordGeneration'),time=finite(fixture.phase?.time,'phase.time');
 demand(snapshot.requestedTime===time&&fixture.phase.densityTime===snapshot.time&&fixture.phase.densityRevision===snapshot.revision,'Committed/requested density epoch metadata mismatch');
 integer(ledger.count,'ledger.count',14000);integer(ledger.capacity,'ledger.capacity',14000);integer(ledger.version,'ledger.version');integer(ledger.recordGeneration,'ledger.recordGeneration');demand(ledger.count<=ledger.capacity&&ledger.stride===8&&ledger.time===time,'Ledger complete prefix/time/stride mismatch');finite(ledger.rawPerCandela,'ledger.rawPerCandela');demand(ledger.rawPerCandela>0,'Positive raw scale required');
 if(!Array.isArray(ledger.dataWordsU32)||ledger.dataWordsU32.length!==ledger.capacity*8||!Array.isArray(ledger.groups))throw new TypeError('Full padded emission ledger words and groups required');for(const word of ledger.dataWordsU32)integer(word,'ledger word',4294967295);
 const views={};
 for(const consumer of consumers){
  const kind=consumer.kind==='mirror'?'reflection':consumer.kind;demand(kind==='main'||kind==='reflection','Unknown or duplicate consumer kind');demand(!views[kind],'Duplicate consumer kind');
  const input=consumer.input,m=consumer.captureMetadata,t=m?.sourceTransmission;demand(input&&m&&t,'Full current view metadata required');bool(consumer.requested,'consumer.requested');bool(consumer.submitted,'consumer.submitted');
  integer(input.count,kind+'.count',18000);integer(input.sourceVersion,kind+'.sourceVersion');demand(input.densityRevision===snapshot.revision&&m.time===time&&t.recordsGeneration===opticalGeneration,'View density/time/optical generation mismatch');demand(t.sourceVersion===input.sourceVersion&&t.densityRevision===input.densityRevision&&t.cameraKey===input.cameraKey,'View captured source metadata mismatch');demand(input.cameraKey===keyForEye(input.eye),'Camera key must match original eye including signed zero');
  demand(m.reflection===(kind==='reflection')&&t.reflection===(kind==='reflection')&&m.instances===input.count&&t.instances===input.count,'View kind/count association mismatch');demand(t.requested===consumer.requested&&(!consumer.submitted||consumer.requested),'View request/submission association mismatch');
  for(const field of ['endpoints64','origins64'])if(!Array.isArray(input[field])||input[field].length!==input.count*3)throw new TypeError('Complete ordered original-double '+field+' required');
  if(!Array.isArray(input.active)||input.active.length!==input.count||input.active.some(v=>v!==0&&v!==1))throw new TypeError('All-row 0/1 active mask required');
  if(!Array.isArray(consumer.orderedSources)||consumer.orderedSources.length!==input.count)throw new TypeError('Complete ordered source association required');
  if(!consumer.submitted)demand(input.active.every(v=>v===0),'Unsubmitted view cannot hide active rays');
  // Only complete originals and their association metadata belong to this epoch.
  // Optional packed/oracle artifacts are separately verified by numerical gates.
  views[kind]={kind,requested:consumer.requested,submitted:consumer.submitted,input,orderedSources:consumer.orderedSources,captureMetadata:m};
 }
 demand(views.main&&views.reflection,'Both main and reflection identities required');
 return{snapshot,ledger,views,phase:fixture.phase,opticalRecordGeneration:opticalGeneration,provenance:fixture.provenance??null};
}
/** Owns all provided originals before returning a branded CPU identity. No pack,
 * SPD validation, GPU completion, input authentication or texture is implied. */
export function captureR39DenseJointEpoch(fixture,{maxOwnedInputBytes}={}){
 integer(maxOwnedInputBytes,'explicit maxOwnedInputBytes',R39_DENSE_JOINT_HARD_CAPS.maxOwnedInputBytes);
 const selected=normalizeFixture(fixture),n=counts({packets:selected.snapshot.packets.length,mainCount:selected.views.main.input.count,reflectionCount:selected.views.reflection.input.count,ledgerCount:selected.ledger.count,mainSubmitted:selected.views.main.submitted,reflectionSubmitted:selected.views.reflection.submitted});
 const size=copyMeasure(selected);if(size.bytes>maxOwnedInputBytes)throw new RangeError('Owned epoch input cap exceeded before clone');const copy=copyMeasure(selected,{copy:true});demand(copy.bytes===size.bytes,'Captured epoch payload changed during clone');
 const receipt=freeze({schema:'glass-atoll.r39.qa-owned-dense-epoch.v1',id:++nextId,verificationOnly:true,actualGPU:false,productionAdmitted:false,captureBytes:size.bytes,counts:n,identity:{densityRevision:selected.snapshot.revision,densityTime:selected.snapshot.time,physicalTime:selected.phase.time,opticalRecordGeneration:selected.opticalRecordGeneration,ledgerRecordGeneration:selected.ledger.recordGeneration,ledgerVersion:selected.ledger.version,mainSourceVersion:selected.views.main.input.sourceVersion,reflectionSourceVersion:selected.views.reflection.input.sourceVersion,mainCameraKey:selected.views.main.input.cameraKey,reflectionCameraKey:selected.views.reflection.input.cameraKey}});
 owned.set(receipt,copy.value);return receipt;
}
function same(a,b){if(Object.is(a,b))return true;if(!a||!b||typeof a!=='object'||typeof b!=='object'||Array.isArray(a)!==Array.isArray(b))return false;const ka=Object.keys(a),kb=Object.keys(b);return ka.length===kb.length&&ka.every(k=>Object.hasOwn(b,k)&&same(a[k],b[k]));}
export function sameR39DenseJointEpoch(a,b){const x=owned.get(a),y=owned.get(b);if(!x||!y)throw new TypeError('Private captured identities required');return same(x,y);}
function jobT(name,n,p,submitted,policy,planner){
 const caps={maxSources:18000,maxPackets:4096,maxPairs:1048576,maxRequestPairs:policy.maxRequestPairs},l=planner(n,p,caps),allocation=planner(0,0,caps).allocation;
 // Compute complete original geometry independently of the selected dispatch
 // cap, so a rejected4m request still discloses its actual required maps/slots.
 const schedule=planTransmissionRectangles({sourceCount:n,packetCount:p,partialWidth:allocation.partial.width,maxMapPairs:policy.maxMapPairs,maxDraws:65});
 const inputBytes=(allocation.packet.texelCapacity+allocation.source.texelCapacity)*16,gpu=inputBytes+(allocation.partial.texelCapacity+allocation.output.texelCapacity)*16;
 const neutral=n===0||p===0,mapCapacityExceeded=(schedule.mapDraws??65)>policy.maxMapDraws,active=l.supported&&schedule.supported&&!mapCapacityExceeded&&submitted,draws=submitted?(neutral?1:schedule.totalDraws??0):0,mapRects=submitted&&!neutral?schedule.mapRects:[];
 return{name,kind:'SourceT',sourceCount:n,packetCount:p,submitted,requiredPairs:n*p,chargedLogicalPairs:submitted?n*p:0,supported:!submitted||l.supported&&schedule.supported&&!mapCapacityExceeded,reason:!submitted?'not-submitted':!l.supported?l.reason:mapCapacityExceeded?'map-draw-capacity':schedule.reason,allocation,mapRects,mapDraws:mapRects.length,draws,conservativeSlots:submitted?schedule.conservativePairs:0,reductionFetches:submitted&&!neutral?n*Math.ceil(p/64):0,uploadBytes:submitted?inputBytes:0,gpuNumericalBytes:gpu,cpuUploadBytes:inputBytes,readbackBytes:submitted?n*16+Math.min(8,schedule.completeCells)*16:0,partialCells:schedule.completeCells,mapCapacityExceeded,completeScheduleSupported:schedule.supported,outputRasterTexels:submitted?(neutral?allocation.output.texelCapacity:allocation.output.width*Math.ceil(n/allocation.output.width)):0,eligibleToExecute:active,publication:'No partial T; complete this exact view/version before consumption; borrowed output must not be replaced first'};
}
function jobSH(p,n,policy,planner){
 const opts={maxPackets:4096,maxSources:14000,maxBakePairs:1048576,maxRequestPairs:policy.maxRequestPairs,maxMapPairs:policy.maxMapPairs,maxMapDraws:policy.maxMapDraws},s=planner(p,n,opts),cap=planner(0,0,opts),allocation={packet:texture(4096),source:texture(28000),partial:texture(cap.partialCapacityTexels),output:texture(4096)};
 const inputBytes=(allocation.packet.texelCapacity+allocation.source.texelCapacity)*16,gpu=inputBytes+(allocation.partial.texelCapacity+allocation.output.texelCapacity)*48,tileCount=Math.max(1,Math.ceil(n/64)),cells=p*tileCount;
 const neutral=p===0||n===0,complete=neutral?{supported:true,rects:[{x:0,y:0,width:allocation.partial.width,height:Math.max(1,Math.ceil(cells/allocation.partial.width)),begin:0,end:Math.max(allocation.partial.width,Math.ceil(cells/allocation.partial.width)*allocation.partial.width),texels:Math.max(allocation.partial.width,Math.ceil(cells/allocation.partial.width)*allocation.partial.width)}]}:decomposeTransmissionInterval({begin:0,end:cells,partialWidth:allocation.partial.width,maxCellsPerRect:Math.floor(policy.maxMapPairs/64),maxRects:64});
 const mapRects=complete.rects.map((r,index)=>({...r,index,conservativePairs:neutral?0:r.texels*64})),mapCapacityExceeded=mapRects.length>policy.maxMapDraws;
 if(s.supported&&JSON.stringify(s.mapRects)!==JSON.stringify(mapRects))throw new Error('SH duplicate original-geometry crosscheck failed');
 return{name:'SH',kind:'SH1',sourceCount:n,packetCount:p,submitted:true,requiredPairs:n*p,chargedLogicalPairs:n*p,supported:s.supported&&complete.supported&&!mapCapacityExceeded,reason:!s.supported?s.reason:mapCapacityExceeded?'map-draw-capacity':'ready',allocation,mapRects,mapDraws:mapRects.length,draws:complete.supported?mapRects.length+1:0,conservativeSlots:neutral?0:cells*64,reductionFetches:p*tileCount*3,uploadBytes:inputBytes,gpuNumericalBytes:gpu,cpuUploadBytes:inputBytes,readbackBytes:p*48+Math.min(8,cells)*48,partialCells:cells,mapCapacityExceeded,completeScheduleSupported:complete.supported,outputRasterTexels:allocation.output.texelCapacity,eligibleToExecute:s.supported&&complete.supported&&!mapCapacityExceeded,publication:'One complete fresh shared density/ledger SH field for both eyes, including all three signed-coefficient textures'};
}
function plan(n,options,identity=null){
 if(!options||Object.keys(options).length!==3||Object.keys(options).some(k=>!['policy','transmissionStorage','budget'].includes(k)))throw new TypeError('Only explicit policy/storage/aggregate budget fields accepted');
 const {policy:policyName,transmissionStorage,budget}=options;
 if(!Object.hasOwn(R39_DENSE_JOINT_POLICIES,policyName))throw new RangeError('Choose explicit current-4m or candidate-12m QA policy');if(!['single-borrowed','two-retained'].includes(transmissionStorage))throw new RangeError('Explicit transmission storage contract required');
 const policy=R39_DENSE_JOINT_POLICIES[policyName],b=validateBudget(budget),T=policyName==='current-4m'?currentT:candidateT,SH=policyName==='current-4m'?currentSH:candidateSH;
 const jobs=[jobT('Tmain',n.mainCount,n.packets,n.mainSubmitted,policy,T),jobT('Tmirror',n.reflectionCount,n.packets,n.reflectionSubmitted,policy,T),jobSH(n.packets,n.ledgerCount,policy,SH)];
 for(const job of jobs){job.mapRasterTexels=job.mapRects.reduce((n,r)=>sum(n,r.texels,'map raster texels'),0);job.rasterTexels=sum(job.mapRasterTexels,job.outputRasterTexels,'total raster texels');job.numericTargetWriteBytes=job.rasterTexels*(job.kind==='SH1'?48:16);}
 const work={logicalPairs:0,conservativeSlots:0,draws:0,reductionFetches:0,rasterTexels:0,uploadBytes:0,gpuNumericalBytes:jobs[2].gpuNumericalBytes,cpuUploadBytes:jobs[2].cpuUploadBytes,readbackBytes:0,ownedInputBytes:identity?.captureBytes??0};
 for(const job of jobs)for(const [key,field]of Object.entries({logicalPairs:'chargedLogicalPairs',conservativeSlots:'conservativeSlots',draws:'draws',reductionFetches:'reductionFetches',rasterTexels:'rasterTexels',uploadBytes:'uploadBytes',readbackBytes:'readbackBytes'}))work[key]=sum(work[key],job[field],key);
 const Tfields=transmissionStorage==='two-retained'?2:1;work.gpuNumericalBytes+=jobs[0].gpuNumericalBytes*Tfields;work.cpuUploadBytes+=jobs[0].cpuUploadBytes*Tfields;
 const reasons=jobs.filter(j=>!j.supported).map(j=>({job:j.name,reason:j.reason,requiredPairs:j.requiredPairs,cap:policy.maxRequestPairs}));
 const budgetMap={logicalPairs:'maxLogicalPairs',conservativeSlots:'maxConservativeSlots',draws:'maxDraws',reductionFetches:'maxReductionFetches',rasterTexels:'maxRasterTexels',uploadBytes:'maxUploadBytes',gpuNumericalBytes:'maxGpuNumericalBytes',cpuUploadBytes:'maxCpuUploadBytes',readbackBytes:'maxReadbackBytes',ownedInputBytes:'maxOwnedInputBytes'};
 for(const [key,cap]of Object.entries(budgetMap))if(work[key]>b[cap])reasons.push({reason:'aggregate-'+key+'-capacity',required:work[key],cap:b[cap]});
 const supported=reasons.length===0,ownershipValidated=!!identity,zero=Object.fromEntries(Object.keys(work).map(k=>[k,0]));
 return freeze({schema:R39_DENSE_JOINT_PLANNER_SCHEMA,verificationOnly:true,actualGPU:false,productionAdmitted:false,effective:false,readyToPublish:false,supported,ownershipValidated,policyName,policy,transmissionStorage,counts:n,jobs,work,budget:b,reasons,reservationAtomic:true,reservedWork:supported&&ownershipValidated?{...work}:zero,identity,fieldStorage:{SourceTFields:Tfields,SHFields:1,sharedSHChargedOnce:true},publication:{mode:'none; CPU model only',allThreeJobsMustCompleteSameEpoch:true,halfPublicationAllowed:false,oldTextureAllowed:false,cpuFallbackAllowed:false,mainAndMirrorTInterchangeable:false,borrowLifetime:transmissionStorage==='single-borrowed'?'Consume each matching view immediately before the next prepare; cannot retain both T outputs for end-of-joint readback':'Two distinct T fields retained until both matching outputs are checked/consumed'},byteScope:'Fixed-capacity numerical textures plus CPU upload buffers and owned original numeric/UTF16 payload, separately charged; not measured driver VRAM or JS heap',limits:['Counts include every ordered SourceT row and packet, including inactive/zero-length rows when prepare is submitted; no per-pair pruning.','Unsubmitted views retain potential requiredPairs but charge no dispatched work; owned capture verifies they contain no active rays.','Always models one fresh tiled64 SH job, including fresh zero-map/final-write semantics; does not claim live zeroTarget reuse.','Only current-4m uses production planners. candidate-12m uses separately reviewed QA pure planner copies; this never changes production constructors or admits GPU work.','No SPD/packing/shader/oracle/numeric conditioning or full-frame raster/CPU/performance admission is performed.']});
}
export function planR39DenseJointCounts(input,options){return plan(counts(input),options);}
export function planR39DenseJointWork(receipt,options){if(!owned.has(receipt))throw new TypeError('A privately captured complete epoch receipt is required');return plan(receipt.counts,options,receipt);}
