import {createOpticalBloom as createCandidate} from '../optical-bloom.js?c1-candidate=52508e6';
import {createOpticalBloom as createBaseline} from './optical-bloom-c1-baseline.js';

const running=new WeakSet();
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
function stats(values){
  if(!values.length)return null;
  const sorted=[...values].sort((a,b)=>a-b),n=sorted.length;
  return{count:n,meanMs:values.reduce((a,b)=>a+b,0)/n,medianMs:(sorted[(n-1)>>1]+sorted[n>>1])/2,p95Ms:sorted[Math.ceil(.95*n)-1],minimumMs:sorted[0],maximumMs:sorted[n-1]};
}
function captureState(THREE,renderer){
  const gl=renderer.getContext(),target=renderer.getRenderTarget();
  return{target,face:renderer.getActiveCubeFace(),mip:renderer.getActiveMipmapLevel(),viewport:renderer.getViewport(new THREE.Vector4()),scissor:renderer.getScissor(new THREE.Vector4()),test:renderer.getScissorTest(),currentViewport:renderer.getCurrentViewport(new THREE.Vector4()),currentScissor:Array.from(gl.getParameter(gl.SCISSOR_BOX)),currentTest:gl.isEnabled(gl.SCISSOR_TEST),targetViewport:target?.viewport.clone(),targetScissor:target?.scissor.clone(),targetTest:target?.scissorTest,readFramebuffer:gl.getParameter(gl.READ_FRAMEBUFFER_BINDING),readBuffer:gl.getParameter(gl.READ_BUFFER),pixelPack:gl.getParameter(gl.PIXEL_PACK_BUFFER_BINDING),autoClear:renderer.autoClear,autoClearColor:renderer.autoClearColor,autoClearDepth:renderer.autoClearDepth,autoClearStencil:renderer.autoClearStencil,xr:renderer.xr.enabled,shadowAuto:renderer.shadowMap.autoUpdate,shadowNeeds:renderer.shadowMap.needsUpdate,shaderChecks:renderer.debug.checkShaderErrors,onShaderError:renderer.debug.onShaderError,infoAutoReset:renderer.info.autoReset,renderInfo:{...renderer.info.render},toneMapping:renderer.toneMapping,exposure:renderer.toneMappingExposure,pixelRatio:renderer.getPixelRatio(),size:renderer.getSize(new THREE.Vector2()),drawingBufferSize:renderer.getDrawingBufferSize(new THREE.Vector2()),clearColour:renderer.getClearColor(new THREE.Color()).clone(),clearAlpha:renderer.getClearAlpha(),memory:{...renderer.info.memory},programCount:renderer.info.programs?.length??null};
}
function restoreState(renderer,saved){
  const gl=renderer.getContext(),target=saved.target;
  renderer.setViewport(saved.viewport);renderer.setScissor(saved.scissor);renderer.setScissorTest(saved.test);
  try{
    if(target){target.viewport.copy(saved.currentViewport);target.scissor.fromArray(saved.currentScissor);target.scissorTest=saved.currentTest;}
    renderer.setRenderTarget(target,saved.face,saved.mip);
  }finally{if(target){target.viewport.copy(saved.targetViewport);target.scissor.copy(saved.targetScissor);target.scissorTest=saved.targetTest;}}
  renderer.state.bindFramebuffer(gl.READ_FRAMEBUFFER,saved.readFramebuffer);gl.readBuffer(saved.readBuffer);gl.bindBuffer(gl.PIXEL_PACK_BUFFER,saved.pixelPack);
  renderer.autoClear=saved.autoClear;renderer.autoClearColor=saved.autoClearColor;renderer.autoClearDepth=saved.autoClearDepth;renderer.autoClearStencil=saved.autoClearStencil;renderer.xr.enabled=saved.xr;renderer.shadowMap.autoUpdate=saved.shadowAuto;renderer.shadowMap.needsUpdate=saved.shadowNeeds;
  renderer.debug.checkShaderErrors=saved.shaderChecks;renderer.debug.onShaderError=saved.onShaderError;renderer.info.autoReset=saved.infoAutoReset;Object.assign(renderer.info.render,saved.renderInfo);
  // This fixture never changes these values. Restore as a safety net, and verify
  // size/DPR (which are deliberately never set) rather than resizing the canvas.
  renderer.toneMapping=saved.toneMapping;renderer.toneMappingExposure=saved.exposure;renderer.setClearColor(saved.clearColour,saved.clearAlpha);
}
function stateRestored(THREE,renderer,saved){
  const now=captureState(THREE,renderer),same=(a,b)=>a.length===b.length&&a.every((v,i)=>v===b[i]);
  return['target','face','mip','test','currentTest','targetTest','readFramebuffer','readBuffer','pixelPack','autoClear','autoClearColor','autoClearDepth','autoClearStencil','xr','shadowAuto','shadowNeeds','shaderChecks','onShaderError','infoAutoReset','toneMapping','exposure','pixelRatio','clearAlpha'].every(k=>now[k]===saved[k])&&['viewport','scissor','currentViewport','size','drawingBufferSize'].every(k=>same(now[k].toArray(),saved[k].toArray()))&&same(now.currentScissor,saved.currentScissor)&&(!saved.target||(now.targetViewport.equals(saved.targetViewport)&&now.targetScissor.equals(saved.targetScissor)))&&now.clearColour.equals(saved.clearColour)&&JSON.stringify(now.renderInfo)===JSON.stringify(saved.renderInfo);
}

/** Fixed-input PSF-only cost comparison, using the existing production context.
 * Owner invokes outside a frame/query, preferably with normal rendering paused.
 * Never calls renderer.setSize/setPixelRatio/dispose/forceContextLoss. No DOM.
 * GPU query encloses one synchronous PSF render; no await/readback enclosed.
 * CPU is performance.now wall time around that render call only: JS + GL submit
 * (possibly driver stalls), not an isolated CPU compute measurement or FPS.
 */
export async function runOpticalFlareBenchmark(THREE,renderer,{samplesPerVariant=32,warmupPairs=8,batchPairs=4,maxWallMs=15000,pollTimeoutMs=4000}={}){
  if(!renderer?.isWebGLRenderer)throw new TypeError('Pass the existing WebGLRenderer.');
  for(const [name,value,min,max] of [['samplesPerVariant',samplesPerVariant,30,128],['warmupPairs',warmupPairs,4,32],['batchPairs',batchPairs,1,16],['maxWallMs',maxWallMs,1000,30000],['pollTimeoutMs',pollTimeoutMs,100,10000]])if(!Number.isInteger(value)||value<min||value>max)throw new RangeError(`${name} must be an integer in [${min}, ${max}].`);
  if(samplesPerVariant%2)throw new RangeError('samplesPerVariant must be even so A/B and B/A first-position counts match.');
  if(running.has(renderer))throw new Error('Optical flare benchmark already running on this renderer.');
  const gl=renderer.getContext(),ext=gl.getExtension('EXT_disjoint_timer_query_webgl2');
  const unavailable=reason=>({date:new Date().toISOString(),status:'unavailable',passed:false,reason,scope:'PSF-only cost; no CPU-to-GPU fallback or FPS inference.'});
  if(!ext)return unavailable('EXT_disjoint_timer_query_webgl2 unavailable.');
  if(gl.getQuery(ext.TIME_ELAPSED_EXT,gl.CURRENT_QUERY))return unavailable('A TIME_ELAPSED query is active; no nested query submitted.');
  if(gl.getParameter(ext.GPU_DISJOINT_EXT))return unavailable('GPU is disjoint before benchmark; no samples accepted.');
  if(gl.isContextLost())return unavailable('Context is lost.');
  if(!gl.getExtension('EXT_color_buffer_float'))return unavailable('EXT_color_buffer_float unavailable.');
  const saved=captureState(THREE,renderer),width=saved.drawingBufferSize.x,height=saved.drawingBufferSize.y;
  if(width<1||height<1)return unavailable('Drawing buffer is empty.');
  const checks=[],resources=[],queries=new Set(),syncs=new Set(),started=performance.now(),deadline=started+maxWallMs;
  const report={date:new Date().toISOString(),status:'inconclusive',passed:false,scope:'Existing-context fixed-input PSF only: original bloom-only versus candidate bloom+flare. Excludes main scene, water/reflection captures, HDR bridge, AA and normal frame scheduling. Not full-scene FPS.',dimensions:[width,height],samplesPerVariant,warmupPairs,batchPairs,timer:'EXT_disjoint_timer_query_webgl2 elapsed nanoseconds / 1e6; CPU submit wall measured separately around render()',candidateSourceSHA256:'52508e641fda1aec9594444c583f2523f9285e7dfec67ca7a25fa0157a2b9601',baselineSourceSHA256:'4bf96b00252cf79403a865b3d35b902c2aa8dcb9732c4dab4169ac96c1aaca63',checks,errors:[],shaderErrors:[],glErrors:[],samples:[],limits:[
    'Both variants consume the same immutable nonuniform RGBA16F source at the actual drawing-buffer dimensions. Source generation/probe/warmup are outside measured queries.',
    'A/B and B/A orders alternate pair by pair. This reduces ordering bias; device clock, cache and thermal variation remain.',
    'CPU values are synchronous render-call wall time (JavaScript/GL submission/possible driver stalls), excluding query begin/end and polling. They are not GPU duration.',
    'Each actual GPU query encloses five PSF draws, including its state restoration. No readback, await or scene draw is enclosed.',
    'Owner must avoid concurrent source/canvas changes or other open timer queries. Normal paused presentation may still happen during bounded polling, outside measured intervals.',
    'No fixed FPS target or perceptual quality acceptance follows from this isolated cost measurement.',
  ]};
  const add=(name,passed,details={})=>checks.push({name,passed:!!passed,...details});
  let baseline,candidate,source,geometry,fillMaterial,probeMaterial,probeTarget,activeOwnQuery=null;
  function checkDeadline(){
    if(performance.now()>deadline)throw new Error(`Bounded ${maxWallMs}ms benchmark expired.`);
    if(gl.isContextLost())throw new Error('Context lost during benchmark.');
    if(!renderer.getDrawingBufferSize(new THREE.Vector2()).equals(saved.drawingBufferSize))throw new Error('Drawing-buffer size changed during fixed-input benchmark.');
  }
  function assertIdle(){checkDeadline();if(gl.getQuery(ext.TIME_ELAPSED_EXT,gl.CURRENT_QUERY))throw new Error('External TIME_ELAPSED query active; no nested query submitted.');}
  function checkDisjoint(){if(gl.getParameter(ext.GPU_DISJOINT_EXT))throw new Error('GPU disjoint: all timing samples invalid.');}
  async function waitFence(){
    const fence=gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE,0);if(!fence)throw new Error('Unable to create warmup fence.');syncs.add(fence);gl.flush();const until=Math.min(deadline,performance.now()+pollTimeoutMs);
    while(true){
      checkDeadline();checkDisjoint();const status=gl.clientWaitSync(fence,0,0);
      if(status===gl.ALREADY_SIGNALED||status===gl.CONDITION_SATISFIED)break;
      if(status===gl.WAIT_FAILED)throw new Error('Warmup fence wait failed.');
      if(performance.now()>until)throw new Error('Warmup fence poll timeout; no timing accepted.');await sleep(1);
    }
    gl.deleteSync(fence);syncs.delete(fence);
  }
  async function collect(batch){
    gl.flush();const until=Math.min(deadline,performance.now()+pollTimeoutMs);
    while(batch.some(row=>!gl.getQueryParameter(row.query,gl.QUERY_RESULT_AVAILABLE))){
      checkDeadline();checkDisjoint();if(performance.now()>until)throw new Error('GPU query poll timeout; no CPU elapsed fallback.');await sleep(1);
    }
    checkDisjoint();
    for(const row of batch){
      const gpuMs=Number(gl.getQueryParameter(row.query,gl.QUERY_RESULT))/1e6;
      gl.deleteQuery(row.query);queries.delete(row.query);
      if(!Number.isFinite(gpuMs)||gpuMs<=0)throw new Error('Invalid/zero GPU timer result; sample not replaced by CPU duration.');
      report.samples.push({pair:row.pair,order:row.order,positionInPair:row.positionInPair,variant:row.variant,cpuSubmitMs:row.cpuSubmitMs,gpuMs});
    }
  }
  running.add(renderer);
  try{
    renderer.xr.enabled=false;renderer.autoClear=false;renderer.shadowMap.autoUpdate=false;renderer.shadowMap.needsUpdate=false;renderer.info.autoReset=false;gl.bindBuffer(gl.PIXEL_PACK_BUFFER,null);
    renderer.debug.checkShaderErrors=true;renderer.debug.onShaderError=(context,program,vertex,fragment)=>report.shaderErrors.push({program:context.getProgramInfoLog(program),vertex:context.getShaderInfoLog(vertex),fragment:context.getShaderInfoLog(fragment)});
    source=new THREE.WebGLRenderTarget(width,height,{type:THREE.HalfFloatType,depthBuffer:false,stencilBuffer:false,minFilter:THREE.LinearFilter,magFilter:THREE.LinearFilter});source.texture.colorSpace=THREE.NoColorSpace;source.texture.generateMipmaps=false;resources.push(source);
    geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute([-1,-1,0,3,-1,0,-1,3,0],3));resources.push(geometry);
    const vertexShader='precision highp float;in vec3 position;out vec2 vUv;void main(){vUv=position.xy*.5+.5;gl_Position=vec4(position,1.);}';
    fillMaterial=new THREE.RawShaderMaterial({name:'Static nonuniform linear HDR PSF benchmark source',glslVersion:THREE.GLSL3,depthTest:false,depthWrite:false,blending:THREE.NoBlending,toneMapped:false,vertexShader,
      fragmentShader:`precision highp float;in vec2 vUv;out vec4 colour;void main(){
        vec2 a=(vUv-vec2(.19,.28))/vec2(.012,.009),b=(vUv-vec2(.73,.63))/vec2(.018,.014);
        float field=.5+.5*sin(vUv.x*47.+vUv.y*83.);
        vec3 c=vec3(.012,.02,.033)+vec3(vUv.x*.5,vUv.y*.3,field*.2);
        c+=vec3(2048.,512.,128.)*exp(-dot(a,a)*.5)+vec3(256.,1024.,2048.)*exp(-dot(b,b)*.5);
        colour=vec4(c,1.);
      }`});resources.push(fillMaterial);
    probeTarget=new THREE.WebGLRenderTarget(4,1,{type:THREE.FloatType,depthBuffer:false});probeTarget.texture.colorSpace=THREE.NoColorSpace;resources.push(probeTarget);
    probeMaterial=new THREE.RawShaderMaterial({glslVersion:THREE.GLSL3,uniforms:{uSource:{value:source.texture}},depthTest:false,depthWrite:false,blending:THREE.NoBlending,toneMapped:false,vertexShader,
      fragmentShader:'precision highp float;precision highp int;uniform highp sampler2D uSource;out vec4 colour;void main(){int i=int(gl_FragCoord.x);vec2 uv=i==0?vec2(.19,.28):i==1?vec2(.73,.63):i==2?vec2(.5,.5):vec2(.08,.88);colour=vec4(texture(uSource,uv).rgb,1.);}'});resources.push(probeMaterial);
    const scene=new THREE.Scene(),camera=new THREE.Camera(),quad=new THREE.Mesh(geometry,fillMaterial);quad.frustumCulled=false;scene.add(quad);
    renderer.setRenderTarget(source);renderer.render(scene,camera);quad.material=probeMaterial;renderer.setRenderTarget(probeTarget);renderer.render(scene,camera);
    const probe=new Float32Array(16);renderer.readRenderTargetPixels(probeTarget,0,0,4,1,probe);const probeRGB=Array.from({length:4},(_,i)=>Array.from(probe.slice(i*4,i*4+3)));
    add('same static nonuniform Float16 source is HDR and finite at independent probes',probeRGB.flat().every(v=>Number.isFinite(v)&&v>=0)&&Math.max(...probeRGB.flat())>100&&Math.max(...probeRGB.flat())-Math.min(...probeRGB.flat())>100,{probeUV:[[.19,.28],[.73,.63],[.5,.5],[.08,.88]],RGB:probeRGB});
    report.input={type:'RGBA16F',colourSpace:'linear/no encoding',textureUUID:source.texture.uuid,immutable:true,dimensions:[width,height],probeRGB};
    baseline=createBaseline(THREE,renderer);candidate=createCandidate(THREE,renderer);baseline.setSize(width,height);candidate.setSize(width,height);baseline.configure(true);candidate.configure({bloom:true,flare:true});
    const variants={oldPSF:baseline,newBloomFlare:candidate};report.variants={oldPSF:baseline.state,newBloomFlare:candidate.state};
    add('original and candidate both measure five-pass PSF at the same full size',baseline.state.passes===5&&candidate.state.passes===5&&candidate.state.bloom&&candidate.state.flare);
    for(let pair=0;pair<warmupPairs;pair++)for(const variant of (pair%2?['newBloomFlare','oldPSF']:['oldPSF','newBloomFlare'])){assertIdle();variants[variant].render(source.texture);}
    await waitFence();report.setupAndWarmupWallMs=performance.now()-started;
    if(report.shaderErrors.length)throw new Error('Shader compilation failed during warmup.');
    let batch=[];
    for(let pair=0;pair<samplesPerVariant;pair++){
      const order=pair%2?['newBloomFlare','oldPSF']:['oldPSF','newBloomFlare'];
      for(let positionInPair=0;positionInPair<2;positionInPair++){
        const variant=order[positionInPair];assertIdle();checkDisjoint();const query=gl.createQuery();if(!query)throw new Error('Unable to allocate timer query.');queries.add(query);
        let cpuSubmitMs;gl.beginQuery(ext.TIME_ELAPSED_EXT,query);activeOwnQuery=query;
        try{const cpuStarted=performance.now();variants[variant].render(source.texture);cpuSubmitMs=performance.now()-cpuStarted;}
        finally{gl.endQuery(ext.TIME_ELAPSED_EXT);activeOwnQuery=null;}
        if(!Number.isFinite(cpuSubmitMs)||cpuSubmitMs<0)throw new Error('Nonfinite CPU render-call wall duration.');
        batch.push({query,pair,order:order.join(' -> '),positionInPair,variant,cpuSubmitMs});
      }
      if(batch.length>=batchPairs*2||pair===samplesPerVariant-1){await collect(batch);batch=[];}
    }
    const rows={};
    for(const variant of ['oldPSF','newBloomFlare']){
      const samples=report.samples.filter(row=>row.variant===variant);rows[variant]={gpu:stats(samples.map(row=>row.gpuMs)),cpuSubmitWall:stats(samples.map(row=>row.cpuSubmitMs)),firstPosition:samples.filter(row=>row.positionInPair===0).length,secondPosition:samples.filter(row=>row.positionInPair===1).length};
    }
    report.results=rows;const delta=(oldValue,newValue)=>({meanDeltaMs:newValue.meanMs-oldValue.meanMs,medianDeltaMs:newValue.medianMs-oldValue.medianMs,p95DeltaMs:newValue.p95Ms-oldValue.p95Ms,meanRatio:newValue.meanMs/oldValue.meanMs,medianRatio:newValue.medianMs/oldValue.medianMs});
    report.comparison={gpu:delta(rows.oldPSF.gpu,rows.newBloomFlare.gpu),cpuSubmitWall:delta(rows.oldPSF.cpuSubmitWall,rows.newBloomFlare.cpuSubmitWall)};
    add('>=30 real valid GPU queries per variant with balanced AB/BA order',Object.values(rows).every(row=>row.gpu.count===samplesPerVariant&&row.gpu.count>=30&&row.firstPosition===row.secondPosition),{counts:Object.fromEntries(Object.entries(rows).map(([k,v])=>[k,{valid:v.gpu.count,first:v.firstPosition,second:v.secondPosition}]))});
    add('drawing-buffer size and DPR stayed unchanged',renderer.getDrawingBufferSize(new THREE.Vector2()).equals(saved.drawingBufferSize)&&renderer.getPixelRatio()===saved.pixelRatio);
    for(let i=0;i<32;i++){const error=gl.getError();if(error===gl.NO_ERROR)break;report.glErrors.push('0x'+error.toString(16));}
    add('no shader compilation/WebGL errors in timing fixture',report.shaderErrors.length===0&&report.glErrors.length===0,{shaderErrors:report.shaderErrors,glErrors:report.glErrors});
    checkDisjoint();report.status='measured';
  }catch(error){
    report.errors.push(String(error?.stack||error));report.status='inconclusive';
    if(/disjoint/i.test(String(error))){report.allTimingInvalid=true;report.limits.push('A GPU disjoint event invalidates all earlier samples as well; retained samples are diagnostic only.');}
  }finally{
    try{
      if(activeOwnQuery){gl.endQuery(ext.TIME_ELAPSED_EXT);activeOwnQuery=null;}
      for(const query of queries)gl.deleteQuery(query);for(const sync of syncs)gl.deleteSync(sync);queries.clear();syncs.clear();
      restoreState(renderer,saved);baseline?.dispose();candidate?.dispose();for(const resource of resources.reverse())resource.dispose();
      report.outerStateRestored=stateRestored(THREE,renderer,saved);add('caller target/face/mip/rectangles/read-FBO/flags/statistics/size restored',report.outerStateRestored);
      const memory={...renderer.info.memory},programCount=renderer.info.programs?.length??null;
      add('temporary textures/geometries/programs released; caller context retained',JSON.stringify(memory)===JSON.stringify(saved.memory)&&programCount===saved.programCount,{before:saved.memory,after:memory,beforePrograms:saved.programCount,afterPrograms:programCount});
    }catch(error){report.errors.push(`cleanup: ${error?.stack||error}`);}
    finally{running.delete(renderer);}
    report.wallMs=performance.now()-started;report.passed=report.status==='measured'&&report.errors.length===0&&checks.every(check=>check.passed);report.cleanup='Own temporary resources/queries/syncs disposed; caller renderer/context retained. No canvas resize or new context.';report.interpretation='Passed means a complete, state-checked isolated cost collection, not full-scene FPS, visual acceptance or a universal hardware cost.';
  }
  return report;
}
