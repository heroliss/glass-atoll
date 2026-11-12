// Verification-only accounting model. No renderer, async coordinator or publication API.
import {planSmokeTransmissionLayout} from '../smoke-transmission-layout.js';
import {planSmokeLightTiles} from '../pyro-smoke-light-tiles.js';

const identities=new WeakMap(),completedModels=new WeakMap();
const KINDS=new Set(['main','mirror','resolved']);
const integer=(x,label,max=Number.MAX_SAFE_INTEGER)=>{if(!Number.isSafeInteger(x)||x<0||x>max)throw new RangeError(label+' requires a bounded nonnegative safe integer');return x;};
const positive=(x,label,max)=>{integer(x,label,max);if(!x)throw new RangeError(label+' must be positive');return x;};
const finite=(x,label)=>{if(typeof x!=='number'||!Number.isFinite(x))throw new RangeError(label+' must be finite');return x;};
const text=(x,label)=>{if(typeof x!=='string'||!x.length)throw new TypeError(label+' requires a nonempty string');return x;};
const add=(a,b,label)=>integer(a+b,label);
const mul=(a,b,label)=>integer(a*b,label);
function freeze(x){if(x&&typeof x==='object'){for(const y of Object.values(x))freeze(y);Object.freeze(x);}return x;}
function capacity(kind,c){if(!c||typeof c!=='object')throw new TypeError('Explicit consumer capacities required');return {maxSources:positive(c.maxSources,'maxSources',kind==='resolved'?14000:18000),maxPackets:positive(c.maxPackets,'maxPackets',4096),maxPairs:positive(c.maxPairs,'old per-request maxPairs',1048576)};}
function metadataFor(kind,m){
  if(!m||typeof m!=='object')throw new TypeError('Complete numerical identity metadata required');
  const common=['contextKey','kernelKey','densityKey','profileKey'];
  for(const k of common)text(m[k],k);
  for(const k of ['densityRevision','recordGeneration'])integer(m[k],k);
  for(const k of ['densityTime','sourceTime'])finite(m[k],k);
  if(m.densityTime>m.sourceTime)throw new RangeError('Density identity cannot be from the future');
  const names=[...common,'densityRevision','recordGeneration','densityTime','sourceTime'];
  if(kind==='resolved'){
    text(m.ledgerKey,'ledgerKey');integer(m.ledgerVersion,'ledgerVersion');finite(m.rawPerCandela,'rawPerCandela');
    if(!(m.rawPerCandela>0)||m.anisotropy!==.32||m.bakeMode!=='tiled64')throw new RangeError('Resolved identity requires current raw/SH1 tiled contract');
    names.push('ledgerKey','ledgerVersion','rawPerCandela','anisotropy','bakeMode');
  }else{
    integer(m.sourceVersion,'sourceVersion');finite(m.shutterSeconds,'shutterSeconds');finite(m.planeY,'planeY');
    if(m.shutterSeconds<0||m.reflection!==(kind==='mirror')||!Array.isArray(m.eye)||m.eye.length!==3)throw new RangeError('View identity does not match consumer kind');
    for(const x of m.eye)finite(x,'eye');
    const key=m.eye.map(x=>Object.is(x,-0)?'-0':String(x)).join(',');
    if(m.cameraKey!==key)throw new RangeError('Camera identity does not match original eye');
    names.push('sourceVersion','shutterSeconds','planeY','reflection','cameraKey','eye');
  }
  return names;
}
// UTF16 payload charge (not an engine heap/object-overhead claim).
const stringBytes=s=>mul(s.length,2,'captured string bytes');
function idsBytes(a,n,label){if(!Array.isArray(a)||a.length!==n)throw new TypeError(label+' must cover all ordered entries');let bytes=0;for(const id of a)bytes=add(bytes,stringBytes(text(id,label)),'identity ID bytes');return bytes;}

export function captureJointWorkIdentity(kind,input,{maxCaptureBytes}={}){
  if(!KINDS.has(kind))throw new RangeError('Unknown consumer kind');
  integer(maxCaptureBytes,'explicit maxCaptureBytes');
  const n=integer(input?.sourceCount,'sourceCount',kind==='resolved'?14000:18000),p=integer(input?.packetCount,'packetCount',4096);
  const names=metadataFor(kind,input.metadata),m=input.metadata;
  const roles=[['density64',Float64Array,p*16],['packedPackets',Float32Array,p*(kind==='resolved'?4:16)],
    ...(kind==='resolved'?[['ledger',Float32Array,n*8]]:[['origins64',Float64Array,n*3],['endpoints64',Float64Array,n*3],['active',Uint8Array,n],['packedSources',Float32Array,n*12]])];
  let bytes=idsBytes(input.packetIds,p,'packetIds');bytes=add(bytes,idsBytes(input.profileIds,p,'profileIds'),'identity bytes');bytes=add(bytes,idsBytes(input.rowIds,n,'rowIds'),'identity bytes');
  for(const name of names){const v=m[name];bytes=add(bytes,Array.isArray(v)?v.length*8:typeof v==='string'?stringBytes(v):typeof v==='boolean'?1:8,'metadata bytes');}
  for(const [role,Type,count]of roles){const a=input.arrays?.[role];if(!(a instanceof Type)||a.length<count)throw new TypeError('Missing complete '+role);if(typeof SharedArrayBuffer!=='undefined'&&a.buffer instanceof SharedArrayBuffer)throw new TypeError('Shared mutable capture input is unsupported');bytes=add(bytes,mul(count,Type.BYTES_PER_ELEMENT,'array bytes'),'capture bytes');}
  // This check precedes every input-derived array/buffer copy.
  if(bytes>maxCaptureBytes)throw new RangeError('maxCaptureBytes exceeded before cloning');
  for(const [role,,count]of roles){const a=input.arrays[role];for(let i=0;i<count;i++){finite(a[i],role);if(role==='active'&&a[i]!==0&&a[i]!==1)throw new RangeError('Active mask requires0/1');}}
  const ownedMetadata={};for(const name of names)ownedMetadata[name]=Array.isArray(m[name])?[...m[name]]:m[name];
  const ownedArrays=roles.map(([role,Type,count])=>({role,bytes:new Uint8Array(input.arrays[role].buffer,input.arrays[role].byteOffset,count*Type.BYTES_PER_ELEMENT).slice()}));
  const owned={kind,n,p,metadata:freeze(ownedMetadata),packetIds:freeze([...input.packetIds]),profileIds:freeze([...input.profileIds]),rowIds:freeze([...input.rowIds]),arrays:ownedArrays};
  const receipt=freeze({schema:'glass-atoll.r24.cpu-owned-identity.v1',verificationOnly:true,actualGPU:false,kind,sourceCount:n,packetCount:p,captureBytes:bytes});
  identities.set(receipt,owned);return receipt;
}
function owned(receipt){const value=identities.get(receipt);if(!value)throw new TypeError('A captured full identity receipt is required; untrusted flags/hashes are insufficient');return value;}
function sameValue(a,b){if(Object.is(a,b))return true;if(Array.isArray(a)&&Array.isArray(b))return a.length===b.length&&a.every((x,i)=>sameValue(x,b[i]));if(a&&b&&typeof a==='object'&&typeof b==='object'){const keys=Object.keys(a);return keys.length===Object.keys(b).length&&keys.every(k=>Object.hasOwn(b,k)&&sameValue(a[k],b[k]));}return false;}
export function sameJointWorkIdentity(a,b){
  const x=owned(a),y=owned(b);if(x.kind!==y.kind||x.n!==y.n||x.p!==y.p)return false;
  for(const k of ['metadata','packetIds','profileIds','rowIds'])if(!sameValue(x[k],y[k]))return false;
  for(let r=0;r<x.arrays.length;r++){const u=x.arrays[r],v=y.arrays[r];if(u.role!==v.role||u.bytes.length!==v.bytes.length)return false;for(let i=0;i<u.bytes.length;i++)if(u.bytes[i]!==v.bytes[i])return false;}
  return true;
}
export function modelCompleteJointResult(identity,{resultKey,capacities}={}){
  const x=owned(identity),caps=capacity(x.kind,capacities);text(resultKey,'modeled resultKey');
  const receipt=freeze({schema:'glass-atoll.r24.cpu-modeled-complete-result.v1',verificationOnly:true,actualGPU:false,productionAdmitted:false,resultKey});
  completedModels.set(receipt,{identity,caps});return receipt;
}
function layout(n){const width=Math.min(256,2**Math.ceil(Math.log2(Math.max(1,n)))),height=Math.ceil(Math.max(1,n)/width);return {width,height,texels:width*height};}
function groupsFor(items,terms,limit){
  const full=Math.floor(terms/64),tail=terms%64,groups=[];
  const push=(firstTile,tiles,termsPerTile)=>{if(!tiles)return;const rows=Math.min(items,Math.floor(limit/termsPerTile));if(rows<1)throw new RangeError('Map cap cannot admit one original tile-row');const tileSpan=rows===items?Math.min(tiles,Math.floor(limit/(items*termsPerTile))):1;const rowBlocks=Math.ceil(items/rows),tileBlocks=Math.ceil(tiles/tileSpan);groups.push({firstTile,tiles,termsPerTile,rows,tileSpan,rowBlocks,tileBlocks,draws:rowBlocks*tileBlocks,maxPairsPerDraw:rows*tileSpan*termsPerTile});};
  push(0,full,64);push(full,tail?1:0,tail);return groups;
}
const WORK_KEYS=['pairs','reductionReads','draws','uploadBytes','rasterTexels'];
function zeroWork(){return Object.fromEntries(WORK_KEYS.map(k=>[k,0]));}

export function jointWorkChunkAt(consumerPlan,index){
  integer(index,'chunk index');if(index>=consumerPlan.mapDraws)throw new RangeError('Chunk index is outside complete map schedule');
  if(consumerPlan.neutral&&consumerPlan.kind==='resolved'){const width=consumerPlan.partialWidth,height=Math.max(1,Math.ceil(consumerPlan.items/width));return freeze({index,neutral:true,tileBegin:0,tileEnd:1,rowBegin:0,rowEnd:consumerPlan.items,begin:0,end:consumerPlan.items,pairs:0,rect:{x:0,y:0,width,height},writes:width*height,guard:'Fresh neutral map writes zero throughout this rectangle, including padding'});}
  let local=index;for(const g of consumerPlan.groups){if(local>=g.draws){local-=g.draws;continue;}const tileBlock=Math.floor(local/g.rowBlocks),rowBlock=local%g.rowBlocks,tileBegin=g.firstTile+tileBlock*g.tileSpan,tileEnd=Math.min(g.firstTile+g.tiles,tileBegin+g.tileSpan),rowBegin=rowBlock*g.rows,rowEnd=Math.min(consumerPlan.items,rowBegin+g.rows),begin=tileBegin*consumerPlan.items+rowBegin,end=(tileEnd-1)*consumerPlan.items+rowEnd,width=consumerPlan.partialWidth,y=Math.floor(begin/width),lastY=Math.ceil(end/width);return freeze({index,tileBegin,tileEnd,rowBegin,rowEnd,begin,end,pairs:(tileEnd-tileBegin)*(rowEnd-rowBegin)*g.termsPerTile,rect:{x:0,y,width,height:lastY-y},guard:'discard unless begin <= linearIndex < end',writes:end-begin});}
  throw new Error('Chunk schedule coverage mismatch');
}

export function planJointSmokeWork({consumers,budget,maxMapPairs}={}){
  if(!Array.isArray(consumers)||!consumers.length||consumers.length>3)throw new TypeError('One to three complete consumers required by this verification model');
  positive(maxMapPairs,'explicit maxMapPairs',1048576);
  const budgetNames={pairs:'maxPairs',reductionReads:'maxReductionReads',draws:'maxDraws',uploadBytes:'maxUploadBytes',rasterTexels:'maxRasterTexels'};
  const allowedBudget=[...Object.values(budgetNames),'maxOwnedBytes'];
  if(!budget||Object.keys(budget).some(k=>!allowedBudget.includes(k)))throw new TypeError('Only explicit primitive budget fields are accepted');
  const ownedBudget={};for(const key of allowedBudget)ownedBudget[key]=integer(budget[key],'explicit '+key);
  const work=zeroWork(),plans=[],seenIds=new Set(),captureSet=new Set();let ownedBytes=0;const rejects=[];
  const chargeCapture=receipt=>{owned(receipt);if(!captureSet.has(receipt)){captureSet.add(receipt);ownedBytes=add(ownedBytes,receipt.captureBytes,'owned captured bytes');}};
  for(const c of consumers){
    text(c.id,'consumer id');if(seenIds.has(c.id))throw new RangeError('Duplicate consumer id');seenIds.add(c.id);
    if(!KINDS.has(c.kind))throw new RangeError('Unknown consumer kind');
    const caps=capacity(c.kind,c.capacities),n=integer(c.sourceCount,'sourceCount',caps.maxSources),p=integer(c.packetCount,'packetCount',caps.maxPackets),identity=owned(c.identity);
    if(identity.kind!==c.kind||identity.n!==n||identity.p!==p)throw new RangeError('Complete identity does not match requested consumer counts/kind');
    chargeCapture(c.identity);
    const overhead=integer(c.overheadReserveBytes,'explicit overheadReserveBytes');ownedBytes=add(ownedBytes,overhead,'owned memory plus caller overhead');
    const pairCount=mul(n,p,'request pairs');if(pairCount>caps.maxPairs)rejects.push({consumer:c.id,reason:'old-per-request-pair-work-capacity',required:pairCount,cap:caps.maxPairs});
    let output,partial,packetInput,sourceInput,reduceReads,neutral,mapNeeded,items,terms,tileCount;
    if(c.kind==='resolved'){
      const options={maxPackets:caps.maxPackets,maxSources:caps.maxSources,maxBakePairs:caps.maxPairs},tiles=planSmokeLightTiles(p,n,options),allocation=planSmokeLightTiles(0,0,options);
      output=layout(caps.maxPackets);partial=layout(allocation.partialCapacityTexels);packetInput=layout(caps.maxPackets);sourceInput=layout(caps.maxSources*2);
      items=p;terms=n;tileCount=Math.max(1,Math.ceil(n/64));reduceReads=p*tileCount*3;neutral=n===0||p===0;mapNeeded=true;
      if(tiles.supported&&tiles.partialTexels>partial.texels)throw new Error('Light partial allocation violated');
    }else{
      const l=planSmokeTransmissionLayout(n,p,caps),a=l.allocation??planSmokeTransmissionLayout(0,0,caps).allocation;
      output={...a.output,texels:a.output.width*a.output.height};partial={...a.partial,texels:a.partial.width*a.partial.height};packetInput={...a.packet,texels:a.packet.width*a.packet.height};sourceInput={...a.source,texels:a.source.width*a.source.height};
      items=n;terms=p;tileCount=Math.ceil(p/64);reduceReads=l.supported?l.reduceTileCount*n:tileCount*n;neutral=n===0||p===0;mapNeeded=!neutral;
    }
    const attachments=c.kind==='resolved'?3:1,gpuBytes=add((packetInput.texels+sourceInput.texels)*16,(partial.texels+output.texels)*16*attachments,'GPU allocation bytes'),uploadBufferBytes=(packetInput.texels+sourceInput.texels)*16;
    ownedBytes=add(ownedBytes,add(gpuBytes,uploadBufferBytes,'field owned numerical buffers'),'aggregate owned numerical bytes');
    let reuse=false;
    if(c.reuseReceipt!==undefined){const modeled=completedModels.get(c.reuseReceipt);if(!modeled)throw new TypeError('Reuse requires a branded verification-only modeled completion receipt');chargeCapture(modeled.identity);if(JSON.stringify(modeled.caps)!==JSON.stringify(caps)||!sameJointWorkIdentity(modeled.identity,c.identity))throw new RangeError('Reuse identity/camera/profile/arrays/capacities mismatch');reuse=true;}
    let groups=[],mapDraws=0;
    if(!reuse&&mapNeeded&&items>0&&terms>0){groups=groupsFor(items,terms,maxMapPairs);mapDraws=groups.reduce((a,g)=>add(a,g.draws,'map draws'),0);}
    else if(!reuse&&c.kind==='resolved')mapDraws=1; // Fresh zero bake keeps incumbent two-pass semantics.
    const reduceDraws=reuse?0:1,requestWork=zeroWork();
    if(!reuse){requestWork.pairs=pairCount;requestWork.reductionReads=reduceReads;requestWork.draws=mapDraws+reduceDraws;requestWork.uploadBytes=uploadBufferBytes;const maxMapCells=groups.reduce((a,g)=>add(a,g.draws*(g.rows*g.tileSpan+2*(partial.width-1)),'map raster upper bound'),0),neutralMapCells=partial.width*Math.max(1,Math.ceil(items*tileCount/partial.width));requestWork.rasterTexels=add(mapNeeded?Math.max(neutral?neutralMapCells:partial.width,maxMapCells):0,neutral||c.kind==='resolved'?output.texels:output.width*Math.ceil(n/output.width),'raster upper bound');}
    for(const key of WORK_KEYS)work[key]=add(work[key],requestWork[key],'aggregate '+key);
    plans.push({id:c.id,kind:c.kind,verificationOnly:true,effective:false,productionAdmitted:false,sourceCount:n,packetCount:p,capacity:caps,completeOrderedCells:items*tileCount,items,terms,tileCount,partialWidth:partial.width,partialCapacity:partial.texels,neutral,reusedModeledResult:reuse,groups,mapDraws,reduceDraws,work:requestWork,ownedFieldBytes:gpuBytes+uploadBufferBytes,publication:'never by this CPU planner; requires complete external epoch transaction',guardedPadding:true});
  }
  for(const[key,name]of Object.entries(budgetNames))if(work[key]>ownedBudget[name])rejects.push({reason:'aggregate-'+key+'-capacity',required:work[key],cap:ownedBudget[name]});
  if(ownedBytes>ownedBudget.maxOwnedBytes)rejects.push({reason:'aggregate-owned-bytes-capacity',required:ownedBytes,cap:ownedBudget.maxOwnedBytes});
  const supported=rejects.length===0;
  return freeze({schema:'glass-atoll.r24.cpu-joint-work-plan.v1',verificationOnly:true,actualGPU:false,productionAdmitted:false,effective:false,readyToPublish:false,supported,reasons:rejects,maxMapPairs,budget:ownedBudget,work,ownedBytes,distinctCapturedIdentities:captureSet.size,capturedIdentityBytes:[...captureSet].reduce((a,r)=>add(a,r.captureBytes,'capture charge'),0),consumers:plans,reservationAtomic:true,reservedWork:supported?{...work,ownedBytes}:{...zeroWork(),ownedBytes:0},publication:'No texture publication API; partial or modeled CPU completion never becomes production-effective',byteScope:'Owned numerical buffers plus captured numeric/UTF16 payload and explicit caller overhead reserves; not a JS engine heap/driver VRAM measurement',reductionReadScope:'Physical partial-texture fetch upper bound: one RGB texture for SourceT, three RGBA coefficient textures for resolved lighting'});
}
