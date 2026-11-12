// One actual main-rAF diagnosis. No renderer lock, canvas, device, shader or GL
// resource creation. Probing changes error timing/cost and is NOT acceptance.
const active=new WeakSet();
const errorText=e=>String(e?.message||e);
const requireThat=(value,message)=>{if(!value)throw Error(message);};

export async function runHDRGLFrameTrace({renderer,hdrOutput,requestFrame,timeoutMs=12000,contextBefore=24,contextAfter=24,maxErrors=128,maxCalls=200000,signal}={}){
  requireThat(renderer&&typeof renderer.getContext==='function','Actual renderer required');
  requireThat(hdrOutput&&typeof hdrOutput.setPresentationObserver==='function'&&typeof hdrOutput.requestRedraw==='function','Native HDR presentation observer required');
  requireThat(requestFrame===undefined||typeof requestFrame==='function','requestFrame must notify the main loop synchronously');
  requireThat(Number.isFinite(timeoutMs)&&timeoutMs>=100&&timeoutMs<=15000,'timeoutMs must be100..15000');
  requireThat([contextBefore,contextAfter].every(n=>Number.isInteger(n)&&n>=1&&n<=64),'context limits must be1..64');
  requireThat(Number.isInteger(maxErrors)&&maxErrors>=1&&maxErrors<=256&&Number.isInteger(maxCalls)&&maxCalls>=1&&maxCalls<=1000000,'invalid bounded trace limits');
  const gl=renderer.getContext();requireThat(gl&&typeof gl.getError==='function','WebGL context required');
  requireThat(!active.has(gl),'This context already has a one-frame GL trace');
  const before=hdrOutput.state,started=performance.now(),report={schema:'glass-atoll.HDR-one-main-frame-GL-trace.v1',dateUTC:new Date().toISOString(),
    status:'starting',actualPresentedFrame:false,diagnosticOnly:true,notAnErrorFreeAcceptance:true,timeoutMs,
    errorPolicy:'Original operations run once. Original getError probes consume and record flags after each call; unique pending flags replay to application getError while wrapped. Remaining virtual flags are all reported at cleanup; native flags cannot be restored without generating new errors.',
    limits:['Changes GL error observation timing, branches that inspect errors, and CPU/GPU synchronization/cost; never use as normal performance or no-error acceptance.',
      'Only methods reached through this context properties are wrapped; previously captured native function references and extension-object methods can bypass instrumentation.',
      'A flag first observed after an operation is an attribution candidate; asynchronous driver reporting and preexisting flags are distinguished, not assumed to prove the operation is the sole cause.',
      'No existing observer may be displaced. No application draw is requested directly; requestFrame only invalidates main-loop presentation cache.'],
    entryErrors:[],nativeErrorEvents:[],callerGetErrorSamples:[],incidents:{},headContext:[],tailContext:[],counts:{calls:0,byMethod:{},nativeGetErrorCalls:0,nativeZeroReads:0,nativeErrorsByCode:{},callerGetErrorCalls:0,callerReturnsByCode:{},virtualReplayReturns:0,callerSamplesOmitted:0},
    stateBefore:{enabled:before?.enabled,mode:before?.mode,presentationObserverActive:before?.presentationObserverActive},cleanup:{methodDescriptorsRestored:false,observerRestored:false}};
  if(signal?.aborted){report.status='aborted-before-start';return report;}
  if(before?.presentationObserverActive){report.status='refused-existing-observer';return report;}
  if(!before?.enabled||before.mode!=='float-canvas-external-copy'){report.status='refused-native-HDR-inactive';return report;}
  active.add(gl);
  return await new Promise(resolve=>{
    const nativeGetError=gl.getError,patches=[],ring=[],pendingFlags=[],pendingSet=new Set(),ids=new WeakMap(),enums=new Map();
    let objectSequence=0,callSequence=0,finished=false,installedObserver=false,previousObserver=null,timer=null,poll=null,phase='entry',captured=false,stopping=false;
    const errorNames={0:'NO_ERROR',1280:'INVALID_ENUM',1281:'INVALID_VALUE',1282:'INVALID_OPERATION',1285:'OUT_OF_MEMORY',1286:'INVALID_FRAMEBUFFER_OPERATION',37442:'CONTEXT_LOST_WEBGL'};
    const methods=new Map();
    for(let proto=gl;proto&&proto!==Object.prototype;proto=Object.getPrototypeOf(proto))for(const name of Object.getOwnPropertyNames(proto)){
      const d=Object.getOwnPropertyDescriptor(proto,name);
      if(name!=='constructor'&&typeof d?.value==='function'&&!methods.has(name))methods.set(name,gl[name]);
      if(/^[A-Z][A-Z0-9_]+$/.test(name)&&typeof d?.value==='number'){
        const list=enums.get(d.value)||[];if(list.length<3&&!list.includes(name))list.push(name);enums.set(d.value,list);
      }
    }
    methods.set('getError',nativeGetError);
    function concise(value){
      if(value===null||value===undefined||typeof value==='boolean')return value??null;
      if(typeof value==='number'){const names=enums.get(value);return names?{value,names}:Number.isFinite(value)?value:String(value);}
      if(typeof value==='string')return value.length>90?value.slice(0,87)+'...':value;
      if(ArrayBuffer.isView(value))return{type:value.constructor?.name,length:value.length??value.byteLength,bytes:value.byteLength,first:typeof value.length==='number'?Array.from(value.subarray?value.subarray(0,6):[]):undefined};
      if(value instanceof ArrayBuffer)return{type:'ArrayBuffer',bytes:value.byteLength};
      if(Array.isArray(value))return{type:'Array',length:value.length,first:value.slice(0,6).map(v=>typeof v==='number'||typeof v==='boolean'?v:String(v).slice(0,40))};
      if(typeof value==='object'||typeof value==='function'){
        if(!ids.has(value))ids.set(value,++objectSequence);
        return{object:ids.get(value),type:Object.prototype.toString.call(value).slice(8,-1)};
      }return String(value).slice(0,60);
    }
    function remember(entry){
      for(const incident of Object.values(report.incidents))if(entry.seq>incident.trigger.seq&&incident.after.length<contextAfter)incident.after.push(entry);
      ring.push(entry);if(ring.length>contextBefore+1)ring.shift();
      if(report.headContext.length<contextBefore)report.headContext.push(entry);
    }
    function incident(name,entry){
      if(report.incidents[name])return;
      report.incidents[name]={trigger:entry,before:ring.filter(row=>row.seq<entry.seq).slice(-contextBefore),after:[]};
    }
    function flag(code,source,entry){
      report.counts.nativeGetErrorCalls++;
      if(code===gl.NO_ERROR){report.counts.nativeZeroReads++;return;}
      report.counts.nativeErrorsByCode[code]=(report.counts.nativeErrorsByCode[code]||0)+1;
      const event={ordinal:report.nativeErrorEvents.length+1,code,name:errorNames[code]||'UNKNOWN_GL_ERROR',source,callSeq:entry.seq,method:entry.method,phase:entry.phase};
      report.nativeErrorEvents.push(event);entry.nativeErrors??=[];entry.nativeErrors.push(code);
      if(source==='entry')report.entryErrors.push(code);
      if(!pendingSet.has(code)){pendingSet.add(code);pendingFlags.push(code);}
      incident('firstNativeError',entry);if(code===1282){incident('first1282',entry);if(source!=='entry')incident('firstPostEntry1282',entry);}
      if(!entry.stack&&report.nativeErrorEvents.length<=8)entry.stack=new Error('GL error observation').stack?.split('\n').slice(1,9).join('\n');
      if(report.nativeErrorEvents.length>=maxErrors&&!stopping){stopping=true;queueMicrotask(()=>finish('error-limit-reached'));}
    }
    function readError(source,entry){const code=Reflect.apply(nativeGetError,gl,[]);flag(code,source,entry);return code;}
    function probe(source,entry,terminal=false){
      for(let i=0;i<16;i++){if(readError(source,entry)===gl.NO_ERROR)return;if(stopping&&!terminal)return;}
      report.probeDrainLimitReached=true;if(!stopping){stopping=true;queueMicrotask(()=>finish('error-drain-limit-reached'));}
    }
    function entry(name,args){
      const e={seq:++callSequence,method:name,phase,args:Array.from(args).slice(0,8).map(concise)};
      report.counts.calls++;report.counts.byMethod[name]=(report.counts.byMethod[name]||0)+1;remember(e);return e;
    }
    function wrapper(name,original){return function(...args){
      if(finished||stopping)return Reflect.apply(original,this,args);
      const e=entry(name,args);let result,completed=false;
      try{result=Reflect.apply(original,this,args);completed=true;e.result=concise(result);}
      catch(error){e.threw=errorText(error);throw error;}
      finally{
        if(this===gl){
          if(name==='getError'&&completed){
            report.counts.callerGetErrorCalls++;flag(result,'caller-getError',e);
          }else if(name!=='getError')probe('post-call',e);
        }else e.foreignReceiver=true;
        if((callSequence>=maxCalls||((callSequence&127)===0&&performance.now()-started>=timeoutMs))&&!stopping){stopping=true;queueMicrotask(()=>finish(callSequence>=maxCalls?'call-limit-reached':'timed-out'));}
      }
      if(name==='getError'&&this===gl){
        const returned=pendingFlags.length?pendingFlags.shift():result;pendingSet.delete(returned);
        report.counts.callerReturnsByCode[returned]=(report.counts.callerReturnsByCode[returned]||0)+1;
        if(returned!==result)report.counts.virtualReplayReturns++;
        e.nativeReturn=result;e.returned=returned;
        if(report.callerGetErrorSamples.length<128)report.callerGetErrorSamples.push({seq:e.seq,native:result,returned});else report.counts.callerSamplesOmitted++;
        return returned;
      }return result;
    };}
    function descriptorEqual(a,b){if(a===undefined||b===undefined)return a===b;return ['value','get','set','writable','enumerable','configurable'].every(k=>a[k]===b[k]);}
    function finish(status,error){
      if(finished)return;finished=true;phase='cleanup';if(timer!==null)clearTimeout(timer);if(poll!==null)clearInterval(poll);signal?.removeEventListener('abort',aborted);
      report.status=status;if(error)report.error=errorText(error);
      try{probe('tail',{seq:++callSequence,method:'native-tail-flags',phase:'cleanup'},true);}catch(e){report.tailProbeError=errorText(e);}
      report.remainingVirtualFlags=pendingFlags.map(code=>({code,name:errorNames[code]||'UNKNOWN_GL_ERROR'}));
      const restoreErrors=[];
      for(const patch of patches.reverse())try{if(patch.previous)Object.defineProperty(gl,patch.name,patch.previous);else delete gl[patch.name];if(!descriptorEqual(Object.getOwnPropertyDescriptor(gl,patch.name),patch.previous))restoreErrors.push(patch.name+': descriptor mismatch');}catch(e){restoreErrors.push(patch.name+': '+errorText(e));}
      report.cleanup.methodDescriptorsRestored=restoreErrors.length===0;report.cleanup.methodRestoreErrors=restoreErrors;
      if(installedObserver)try{
        const current=hdrOutput.setPresentationObserver(null);
        if(current===observer){if(previousObserver)hdrOutput.setPresentationObserver(previousObserver);report.cleanup.observerRestored=true;}
        else{if(current)hdrOutput.setPresentationObserver(current);report.cleanup.otherObserverPreserved=true;report.cleanup.observerRestored=current===previousObserver;}
      }catch(e){report.cleanup.observerRestoreError=errorText(e);}
      report.tailContext=ring.slice(-contextBefore);report.elapsedMs=performance.now()-started;report.patchedMethods=patches.map(p=>p.name).sort();
      report.counts.originalOperationsCalled=report.counts.calls;report.cleanup.activeTraceReleased=true;active.delete(gl);resolve(report);
    }
    function aborted(){finish('aborted');}
    function observer(payload){
      if(finished||captured)return;captured=true;phase='observer';
      report.actualPresentedFrame=true;report.frame={width:payload.width,height:payload.height,mode:payload.mode,copyCompleted:true,settings:{...payload.settings},displayTransform:payload.displayTransform};
      report.observerGap={lastGLCall:ring.at(-1)??null,unwrappedNativeStage:'getCurrentTexture / copyExternalImageToTexture / diagnostic payload are not GL context methods; an observer-entry flag can originate in this gap'};
      const marker={seq:++callSequence,method:'native-presentation-observer',phase,copyCompleted:true,args:[]};remember(marker);probe('observer-entry',marker);
      phase='post-observer-finally';queueMicrotask(()=>finish('captured'));
    }
    try{
      previousObserver=hdrOutput.setPresentationObserver(observer);installedObserver=true;
      if(previousObserver){hdrOutput.setPresentationObserver(previousObserver);installedObserver=false;finish('refused-existing-observer');return;}
      const initial={seq:0,method:'preexisting-native-flags',phase:'entry',args:[]};probe('entry',initial);
      if(stopping)return;
      for(const [name,original] of methods){
        const previous=Object.getOwnPropertyDescriptor(gl,name),wrapped=wrapper(name,original);
        Object.defineProperty(gl,name,{value:wrapped,writable:true,configurable:true,enumerable:previous?.enumerable??false});patches.push({name,previous});
      }
      phase='main-frame';timer=setTimeout(()=>finish('timed-out'),timeoutMs);
      poll=setInterval(()=>{if(finished)return;try{const state=hdrOutput.state;if(!state.enabled||state.mode!=='float-canvas-external-copy')finish('HDR-stopped-before-frame');}catch(e){finish('HDR-state-unavailable',e);}},100);
      signal?.addEventListener('abort',aborted,{once:true});hdrOutput.requestRedraw();const requested=requestFrame?.();
      if(requested&&typeof requested.then==='function')report.requestFrameReturnedPromise=true;
    }catch(error){finish('installation-or-request-failed',error);}
  });
}

export function traceHDRGLFrame(renderer,hdrOutput,options={}){return runHDRGLFrameTrace({renderer,hdrOutput,...options});}
