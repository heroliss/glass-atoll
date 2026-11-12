// Exact inverse of the explicitly installed, default-null one-frame QA observer.
import fs from 'node:fs';
import crypto from 'node:crypto';
const baseline=fs.readFileSync(new URL('./baselines/hdr-before-presentation-observer/hdr-output.js',import.meta.url),'utf8'),HASH='fff420ee4c2c120ccee5f5d25b17b4a7d3df6fb89006cbe8e769652fcdf1201a',sha=s=>crypto.createHash('sha256').update(s).digest('hex');
if(sha(baseline)!==HASH)throw Error('Pre-observer HDR baseline changed');
const eol=baseline.includes('\r\n')?'\r\n':'\n',n=s=>s.replace(/\r?\n/g,eol),edits=[],add=(name,from,to)=>edits.push({name,from:n(from),to:n(to)});
add('default-null-observer-storage',"  let displayTransform=null,displayTransformStatus={kind:'hdr',requested:false,effective:'legacy',reason:'disabled',error:null};","  let displayTransform=null,displayTransformStatus={kind:'hdr',requested:false,effective:'legacy',reason:'disabled',error:null};\n  let presentationObserver=null,presentationObserverError=null;");
add('stop-detaches-QA-observer',"  function stop(reason){activationEpoch++;enabled=false;","  function stop(reason){presentationObserver=null;activationEpoch++;enabled=false;");
add('same-destination-sync-after-copy-observation',"      device.queue.copyExternalImageToTexture({source:renderer.domElement},{texture:context.getCurrentTexture(),colorSpace:'srgb',premultipliedAlpha:false},[outputWidth,outputHeight]);",`      const destination=context.getCurrentTexture();
      device.queue.copyExternalImageToTexture({source:renderer.domElement},{texture:destination,colorSpace:'srgb',premultipliedAlpha:false},[outputWidth,outputHeight]);
      if(presentationObserver){
        try{
          const diagnostic=displayTransformDiagnostic(displayTransform,displayTransformStatus);
          presentationObserver({gl,device,texture:destination,width:outputWidth,height:outputHeight,mode:'float-canvas-external-copy',settings:{exposure,peakNits:settings.peakNits,sdrWhiteNits:settings.sdrWhiteNits},displayTransform:{kind:'hdr',requested:!!displayTransform,effective:displayTransformStatus.effective,reason:displayTransformStatus.reason,variant:diagnostic.adapter?.variant??null,requestedMode:diagnostic.adapter?.requested??null,surface:diagnostic.adapter?.hdr?{...diagnostic.adapter.hdr}:null}});
        }catch(error){presentationObserverError=errorText(error);}
      }`);
add('QA-observer-exchange-setter',"    requestRedraw(){lastSubmitted=nextSubmission=-Infinity;statistics.requiresRedraw=true;},",`    setPresentationObserver(value=null){if(value!==null&&(typeof value!=='function'||value.constructor?.name==='AsyncFunction'))throw new TypeError('Presentation observer must be null or synchronous');if(disposed&&value!==null)throw new Error('HDR output is disposed');const previous=presentationObserver;presentationObserver=value;if(value!==null)presentationObserverError=null;return previous;},
    requestRedraw(){lastSubmitted=nextSubmission=-Infinity;statistics.requiresRedraw=true;},`);
add('observer-scalar-diagnostics',"      width:outputWidth,height:outputHeight,...settings,...statistics,errors:[...statistics.errors],readback:readback?.state||null,","      width:outputWidth,height:outputHeight,...settings,...statistics,errors:[...statistics.errors],readback:readback?.state||null,presentationObserverActive:!!presentationObserver,presentationObserverError,");
export const HDR_PRESENTATION_OBSERVER_BASELINE_SHA256=HASH;
export function presentationObserverEdits(){return edits.map(e=>({...e}));}
export function applyPresentationObserver(source){if(source!==baseline)throw Error('Observer patch requires the exact frozen pre-observer HDR');for(const e of edits){if(source.split(e.from).length-1!==1)throw Error('Nonunique observer apply anchor '+e.name);source=source.replace(e.from,e.to);}return source;}
export function normalizePresentationObserver(source){for(const e of [...edits].reverse()){if(source.split(e.to).length-1!==1)throw Error('Altered/nonunique presentation observer '+e.name);source=source.replace(e.to,e.from);}if(source!==baseline)throw Error('Unapproved HDR difference outside presentation observer');return source;}
