// Exact inverse of only the approved optional final-output wiring. No algorithm stripping.
import fs from 'node:fs';
import crypto from 'node:crypto';
import {normalizePresentationObserver} from './hdr-presentation-observer-normalize.mjs';
const read=file=>fs.readFileSync(new URL(file,import.meta.url),'utf8'),sha=s=>crypto.createHash('sha256').update(s).digest('hex');
export const DISPLAY_WIRING_BASELINES=Object.freeze({
 'lens.js':{file:'./baselines/aces2-display-wiring-v0/lens.js',sha256:'23432072ea53e6db8139d279fd69e5372962a8371f12515fd3a07d8d995582eb'},
 'hdr-output.js':{file:'./baselines/aces2-display-wiring-v0/hdr-output.js',sha256:'4ce6ba6f2ed991e885aba586efd5ec9c08b6146c9d73664e611e00e477e6b6f9'}
});
const HELPER=`/** Synchronous final-output protocol only; no resource preparation or exposure policy. */
export function validateDisplayTransformAdapter(value){
  if(value!==null&&(!value||typeof value.render!=='function'||value.render.constructor?.name==='AsyncFunction'))throw new TypeError('Display transform must be null or a synchronous render adapter');
  return value;
}
export function renderDisplayTransformAdapter(value,options,{fallbackReason=null}={}){
  const status={kind:options.kind,requested:!!value,effective:'legacy',reason:value?'render-declined':'disabled',error:null};
  if(!value)return status;
  if(fallbackReason)status.reason=fallbackReason;
  else try{const result=value.render(options);if(result===true)return{...status,effective:'candidate',reason:'rendered'};if(result===false)return status;status.reason='non-boolean-render-result';}
  catch(error){status.reason='adapter-error';status.error=errorText(error);}
  try{value.noteFallback?.({kind:options.kind,reason:status.reason,...(status.error?{error:status.error}:{})});}catch(error){status.notificationError=errorText(error);}
  return status;
}
export function displayTransformDiagnostic(value,status){
  let adapterState=null;try{adapterState=value?.state??null;}catch(error){adapterState={reason:'adapter-state-error',error:errorText(error)};}
  return{...status,requested:!!value,adapter:adapterState};
}

`;
function build(file){const spec=DISPLAY_WIRING_BASELINES[file];if(!spec)throw Error('Unknown display-wiring source '+file);const baseline=read(spec.file);if(sha(baseline)!==spec.sha256)throw Error('Display-wiring baseline SHA mismatch');const eol=baseline.includes('\r\n')?'\r\n':'\n',n=s=>s.replace(/\r?\n/g,eol),edits=[];const add=(name,from,to)=>edits.push({name,from:n(from),to:n(to)});
 if(file==='lens.js'){
  add('shared-synchronous-output-protocol-import',"import { createOpticalBloom } from './optical-bloom.js';","import { createOpticalBloom } from './optical-bloom.js';\nimport {validateDisplayTransformAdapter,renderDisplayTransformAdapter,displayTransformDiagnostic} from './hdr-output.js';");
  add('optional-SDR-adapter-state','  let hdrOutput=null;','  let hdrOutput=null;\n  let displayTransform=null,displayTransformStatus={kind:\'sdr\',requested:false,effective:\'legacy\',reason:\'disabled\',error:null};');
  add('optional-SDR-setter','    setHDROutput(value){hdrOutput=value;},',`    setHDROutput(value){hdrOutput=value;},
    setDisplayTransform(value=null){validateDisplayTransformAdapter(value);if(value===displayTransform)return;displayTransform=value;displayTransformStatus={kind:'sdr',requested:!!value,effective:'legacy',reason:value?'awaiting-render':'disabled',error:null};},`);
  add('report-actual-HDR-delegation',`      if(!sdr&&hdrOutput?.state.enabled&&hdrOutput.present(result,performance.now()))return;`,`      if(!sdr&&hdrOutput?.state.enabled&&hdrOutput.present(result,performance.now())){
        if(displayTransform){const active=hdrOutput.state.displayTransform;displayTransformStatus={kind:'hdr',requested:true,effective:active?.effective??'legacy',reason:active?.reason??'legacy-hdr',error:active?.error??null};}
        return;
      }`);
  add('optional-SDR-final-output-with-existing-FSR',`      const enlarge=width<outputWidth||height<outputHeight;
      if(enlarge&&upscalerReady){output.renderToScreen=false;output.render(renderer,encodedTarget,result);upscaler.render(encodedTarget);}
      else{output.renderToScreen=true;output.render(renderer,null,result);}`,`      const enlarge=width<outputWidth||height<outputHeight;
      let transformed=false;
      if(displayTransform){
        try{
          const candidateTarget=enlarge&&upscalerReady?encodedTarget:null;
          if(candidateTarget){candidateTarget.texture.colorSpace=THREE.NoColorSpace;candidateTarget.samples=0;renderer.initRenderTarget(candidateTarget);}
          displayTransformStatus=renderDisplayTransformAdapter(displayTransform,{kind:'sdr',input:result.texture,exposure:renderer.toneMappingExposure,target:candidateTarget,peakNits:100});
          transformed=displayTransformStatus.effective==='candidate';
        }catch(error){displayTransformStatus=renderDisplayTransformAdapter(displayTransform,{kind:'sdr'},{fallbackReason:'sdr-target-initialization-failed'});displayTransformStatus.error=String(error?.message||error);}
      }
      if(enlarge&&upscalerReady){if(!transformed){output.renderToScreen=false;output.render(renderer,encodedTarget,result);}upscaler.render(encodedTarget);}
      else if(!transformed){output.renderToScreen=true;output.render(renderer,null,result);}`);
  add('SDR-display-status','    get state(){return {storageEV,historyEV,dynamicLighting,','    get state(){return {displayTransform:displayTransformDiagnostic(displayTransform,displayTransformStatus),storageEV,historyEV,dynamicLighting,');
 }else{
  add('shared-synchronous-output-protocol','const HDR_FRAGMENT=/* glsl */`',HELPER+'const HDR_FRAGMENT=/* glsl */`');
  add('optional-native-adapter-state','  let uploadWidth=0,uploadHeight=0,outputWidth=renderer.domElement.width,outputHeight=renderer.domElement.height,nativeFloatActive=false,pendingFrame=0;',`  let uploadWidth=0,uploadHeight=0,outputWidth=renderer.domElement.width,outputHeight=renderer.domElement.height,nativeFloatActive=false,pendingFrame=0;
  let displayTransform=null,displayTransformStatus={kind:'hdr',requested:false,effective:'legacy',reason:'disabled',error:null};`);
  const oldNative=`      output.material.uniforms.tLinear.value=target.texture;output.material.uniforms.uExposure.value=exposure;output.material.uniforms.uHeadroom.value=settings.headroom;output.material.uniforms.uWhiteScale.value=settings.whiteScale;
      renderer.autoClear=false;renderer.setRenderTarget(null);renderer.setScissorTest(false);
      const ratio=renderer.getPixelRatio();renderer.setViewport(0,0,renderer.domElement.width/ratio,renderer.domElement.height/ratio);
      renderer.render(output.scene,output.camera);`;
  add('optional-native-mapping-before-same-task-copy',oldNative,`      let transformed=false;
      if(displayTransform){displayTransformStatus=renderDisplayTransformAdapter(displayTransform,{kind:'hdr',input:target.texture,exposure,target:null,viewport:[0,0,renderer.domElement.width,renderer.domElement.height],peakNits:settings.peakNits,sdrWhiteNits:settings.sdrWhiteNits});transformed=displayTransformStatus.effective==='candidate';}
      if(!transformed){
${oldNative}
      }`);
  add('optional-HDR-setter',`    setSize(w,h){resizeCanvas(Math.max(1,Math.round(w)),Math.max(1,Math.round(h)));if(enabled&&mode==='float-canvas-external-copy')ensureNativeFloat();lastSubmitted=nextSubmission=-Infinity;statistics.requiresRedraw=true;},`,`    setDisplayTransform(value=null){validateDisplayTransformAdapter(value);if(value===displayTransform)return;displayTransform=value;displayTransformStatus={kind:'hdr',requested:!!value,effective:'legacy',reason:value?'awaiting-render':'disabled',error:null};lastSubmitted=nextSubmission=-Infinity;statistics.requiresRedraw=true;notify();},
    setSize(w,h){resizeCanvas(Math.max(1,Math.round(w)),Math.max(1,Math.round(h)));if(enabled&&mode==='float-canvas-external-copy')ensureNativeFloat();lastSubmitted=nextSubmission=-Infinity;statistics.requiresRedraw=true;},`);
  add('PBO-explicit-legacy-only',`        if(mode==='async-pbo-upload'){
          const frame=readback.poll(now);`,`        if(mode==='async-pbo-upload'){
          if(displayTransform)displayTransformStatus=renderDisplayTransformAdapter(displayTransform,{kind:'hdr'},{fallbackReason:'pbo-legacy-only'});
          const frame=readback.poll(now);`);
  add('HDR-display-status',`      source:'pre-OutputPass, scene-linear sRGB floating-point target',output:'sRGB-encoded rgba16float, extended, opaque',`,`      displayTransform:displayTransformDiagnostic(displayTransform,enabled?displayTransformStatus:{...displayTransformStatus,effective:'legacy',reason:disposed?'disposed':'hdr-disabled'}),
      source:'pre-OutputPass, scene-linear sRGB floating-point target',output:'sRGB-encoded rgba16float, extended, opaque',`);
  add('HDR-shoulder-describes-active-path',"shoulder:'same fitted SDR ACES anchor through exposed peak 1; C1 bounded highlight extension; nit scale divided by browser/Windows SDR white',","shoulder:enabled&&displayTransformStatus.effective==='candidate'?'optional display-transform adapter; numerical provenance in displayTransform.adapter':'same fitted SDR ACES anchor through exposed peak 1; C1 bounded highlight extension; nit scale divided by browser/Windows SDR white',");
  add('HDR-explicit-redraw-without-notification',"    setDisplayTransform(value=null){validateDisplayTransformAdapter(value);if(value===displayTransform)return;","    requestRedraw(){lastSubmitted=nextSubmission=-Infinity;statistics.requiresRedraw=true;},\n    setDisplayTransform(value=null){validateDisplayTransformAdapter(value);if(value===displayTransform)return;");
 }
 return{baseline,edits};
}
export function displayWiringEdits(file){return build(file).edits;}
export function applyDisplayWiring(file,source){const {baseline,edits}=build(file);if(source!==baseline)throw Error('Cannot apply display wiring to a nonbaseline source');for(const e of edits){if(source.split(e.from).length-1!==1)throw Error('Nonunique wiring apply anchor '+e.name);source=source.replace(e.from,e.to);}return source;}
export function normalizeDisplayWiring(file,source){if(file==='hdr-output.js'&&source.includes('setPresentationObserver(value=null)'))source=normalizePresentationObserver(source);const {baseline,edits}=build(file);for(const e of [...edits].reverse()){if(source.split(e.to).length-1!==1)throw Error('Nonunique or altered approved display wiring '+e.name);source=source.replace(e.to,e.from);}if(source!==baseline)throw Error('Unapproved source difference outside display wiring');return source;}
