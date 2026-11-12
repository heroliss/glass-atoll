import {createResolvedDepthCopy} from '../depth-copy.js?guard=3';

// Caller pauses its production loop. Only owned fixture resources are disposed.
export async function runDepthCopyGPUCheck(THREE,renderer){
  const gl=renderer.getContext(),checks=[],owned=[],cases=[],skipped=[],W=32,H=24;
  const entryErrors=[],operationErrors=[],operationCounts={},wrapped=[],instrumentationFailures=[];let phase='entry';
  function drain(){const out=[];for(let i=0,e;i<32&&(e=gl.getError())!==gl.NO_ERROR;i++)out.push(e);return out;}
  entryErrors.push(...drain());
  const argSummary=x=>x===null||['number','string','boolean','undefined'].includes(typeof x)?x:(ArrayBuffer.isView(x)?`${x.constructor.name}(${x.length})`:x?.constructor?.name??typeof x);
  // Isolated QA only: attribute errors to the actual native GL operation instead
  // of aggregating stale errors from the caller or from a later readback.
  for(const name of ['bindFramebuffer','blitFramebuffer','framebufferTexture2D','framebufferRenderbuffer','renderbufferStorageMultisample','readPixels','drawElements','drawArrays','drawElementsInstanced','drawArraysInstanced','clear','readBuffer','drawBuffers','texImage2D','texStorage2D','texSubImage2D','texParameteri','viewport','scissor','checkFramebufferStatus','getParameter']){
    const original=gl[name],descriptor=Object.getOwnPropertyDescriptor(gl,name);if(typeof original!=='function')continue;
    try{
      gl[name]=function(...args){const result=original.apply(gl,args);operationCounts[name]=(operationCounts[name]??0)+1;const errors=drain();if(errors.length)operationErrors.push({phase,operation:name,args:args.map(argSummary),errors});return result;};
      if(gl[name]===original)throw new Error('method is not writable');wrapped.push({name,descriptor,original});
    }catch(error){instrumentationFailures.push({name,error:String(error)});}
  }
  const check=(name,passed,detail={})=>checks.push({name,passed:!!passed,...detail});
  const saved={target:renderer.getRenderTarget(),face:renderer.getActiveCubeFace(),mip:renderer.getActiveMipmapLevel(),
    viewport:renderer.getViewport(new THREE.Vector4()),scissor:renderer.getScissor(new THREE.Vector4()),test:renderer.getScissorTest(),
    actualViewport:renderer.getCurrentViewport(new THREE.Vector4()),actualScissor:Array.from(gl.getParameter(gl.SCISSOR_BOX)),actualTest:gl.isEnabled(gl.SCISSOR_TEST),
    draw:gl.getParameter(gl.DRAW_FRAMEBUFFER_BINDING),read:gl.getParameter(gl.READ_FRAMEBUFFER_BINDING),readBuffer:gl.getParameter(gl.READ_BUFFER),
    clear:renderer.getClearColor(new THREE.Color()).clone(),alpha:renderer.getClearAlpha(),auto:renderer.autoClear,
    shadowAuto:renderer.shadowMap.autoUpdate,shadowNeeds:renderer.shadowMap.needsUpdate,xr:renderer.xr.enabled};
  const copy=createResolvedDepthCopy(THREE,renderer);
  const target=(w,h,type=THREE.HalfFloatType,depth=true,samples=0,ordinary=false)=>{
    const t=new THREE.WebGLRenderTarget(w,h,{type,depthBuffer:depth,...(depth?{depthTexture:new THREE.DepthTexture(w,h,THREE.UnsignedIntType)}:{})});
    t.samples=samples;t.texture.generateMipmaps=false;t.texture.minFilter=t.texture.magFilter=THREE.NearestFilter;
    if(ordinary)renderer.properties.get(t).__useRenderToTexture=false;
    owned.push(t);return t;
  };
  const sampleTarget=target(W,H,THREE.FloatType,false),sentinel=target(W,H),world=new THREE.Scene(),sampleScene=new THREE.Scene(),effects=new THREE.Scene();
  const camera=new THREE.PerspectiveCamera(60,W/H,.1,20),quadCamera=new THREE.Camera();camera.position.set(0,0,2);camera.lookAt(0,0,0);camera.updateMatrixWorld();
  const geometry=new THREE.PlaneGeometry(1.3,2.6),material=new THREE.MeshBasicMaterial({color:0x4573b1,toneMapped:false}),plane=new THREE.Mesh(geometry,material);plane.position.x=-.65;world.add(plane);owned.push(geometry,material);
  const quad=new THREE.PlaneGeometry(2,2),sampleUniforms={uTexture:{value:null}},sampleMaterial=new THREE.ShaderMaterial({uniforms:sampleUniforms,depthTest:false,depthWrite:false,toneMapped:false,
    vertexShader:'varying vec2 vUv;void main(){vUv=uv;gl_Position=vec4(position.xy,0.,1.);}',
    fragmentShader:'precision highp float;uniform highp sampler2D uTexture;varying vec2 vUv;void main(){gl_FragColor=texture2D(uTexture,vUv);}'});
  sampleScene.add(new THREE.Mesh(quad,sampleMaterial));owned.push(quad,sampleMaterial);
  const effectGeometry=new THREE.PlaneGeometry(4,3),effectUniforms={uDepth:{value:null},uSize:{value:new THREE.Vector2(W,H)}},effectMaterial=new THREE.ShaderMaterial({uniforms:effectUniforms,transparent:true,depthTest:true,depthWrite:false,toneMapped:false,
    blending:THREE.CustomBlending,blendSrc:THREE.OneFactor,blendDst:THREE.OneFactor,blendSrcAlpha:THREE.ZeroFactor,blendDstAlpha:THREE.OneFactor,
    vertexShader:'void main(){gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
    fragmentShader:'precision highp float;uniform highp sampler2D uDepth;uniform vec2 uSize;void main(){float d=texture2D(uDepth,gl_FragCoord.xy/uSize).r;if(gl_FragCoord.z>d+1e-6)discard;gl_FragColor=vec4(.25,.03125,.015625,0.);}'});
  const effect=new THREE.Mesh(effectGeometry,effectMaterial);effect.position.z=-.15;effects.add(effect);owned.push(effectGeometry,effectMaterial);
  function readRGBA(texture){const previousPhase=phase;phase=`${phase}:readRGBA(${texture.isDepthTexture?'depth':'color'})`;try{sampleUniforms.uTexture.value=texture;renderer.setRenderTarget(sampleTarget);renderer.render(sampleScene,quadCamera);const out=new Float32Array(W*H*4);renderer.readRenderTargetPixels(sampleTarget,0,0,W,H,out);return out;}finally{phase=previousPhase;}}
  const depthValues=texture=>Array.from(readRGBA(texture)).filter((_,i)=>i%4===0);
  const maxError=(a,b)=>{let e=0;for(let i=0;i<a.length;i++)e=Math.max(e,Math.abs(a[i]-b[i]));return e;};
  const rectangles=()=>({viewport:renderer.getViewport(new THREE.Vector4()).toArray(),scissor:renderer.getScissor(new THREE.Vector4()).toArray(),test:renderer.getScissorTest(),actualViewport:Array.from(gl.getParameter(gl.VIEWPORT)),actualScissor:Array.from(gl.getParameter(gl.SCISSOR_BOX)),actualTest:gl.isEnabled(gl.SCISSOR_TEST)});
  function oracle(depth){
    let error=0,intervalViolation=0,maximumPixelDepthSpan=0,interior=0,sky=0,skyError=0;const a=new THREE.Vector3(),b=new THREE.Vector3(),p=new THREE.Vector3(),clip=new THREE.Vector3();
    function at(windowX,windowY){a.set(2*windowX/W-1,2*windowY/H-1,-1).unproject(camera);b.set(2*windowX/W-1,2*windowY/H-1,1).unproject(camera);const t=-a.z/(b.z-a.z);p.copy(b).sub(a).multiplyScalar(t).add(a);clip.copy(p).project(camera);return{x:p.x,y:p.y,depth:clip.z*.5+.5};}
    for(let y=0;y<H;y++)for(let x=0;x<W;x++){
      const center=at(x+.5,y+.5),corners=[at(x,y),at(x+1,y),at(x,y+1),at(x+1,y+1)];
      if(center.x>-1.22&&center.x<-.08&&Math.abs(center.y)<1.22&&corners.every(c=>c.x>-1.3&&c.x<0&&Math.abs(c.y)<1.3)){
        const lo=Math.min(...corners.map(c=>c.depth)),hi=Math.max(...corners.map(c=>c.depth)),observed=depth[y*W+x];
        error=Math.max(error,Math.abs(observed-center.depth));intervalViolation=Math.max(intervalViolation,lo-observed,observed-hi,0);maximumPixelDepthSpan=Math.max(maximumPixelDepthSpan,hi-lo);interior++;
      }
      if(center.x>.15&&Math.abs(center.y)<1.15){skyError=Math.max(skyError,Math.abs(depth[y*W+x]-1));sky++;}
    }return{maximumCenterResidual:error,maximumPixelCornerIntervalViolation:intervalViolation,maximumPixelDepthSpan,interiorPixels:interior,skyPixels:sky,maximumSkyError:skyError,
      oracle:'Depth of the projected plane is affine over screen XY. All pixel-corner intersections lie inside the opaque plane, hence any sample location in that pixel has depth in [min(corners),max(corners)]. The original2e-6 numerical tolerance applies to interval violations, not to an invalid MSAA pixel-center equality.'};
  }
  const maxSamples=Math.min(renderer.capabilities.maxSamples??gl.getParameter(gl.MAX_SAMPLES),gl.getParameter(gl.MAX_SAMPLES)),automaticRTT=renderer.extensions.has('WEBGL_multisampled_render_to_texture');
  try{
    phase='fixture setup';
    renderer.xr.enabled=false;renderer.shadowMap.autoUpdate=false;renderer.shadowMap.needsUpdate=false;renderer.autoClear=true;renderer.setClearColor(0x000000,0);
    renderer.setRenderTarget(sentinel);renderer.clear();const sentinelFramebuffer=gl.getParameter(gl.DRAW_FRAMEBUFFER_BINDING);
    const configurations=[{samples:0,ordinary:false},{samples:2,ordinary:false},{samples:4,ordinary:false}];
    if(automaticRTT)configurations.push({samples:2,ordinary:true},{samples:4,ordinary:true});
    for(const config of configurations){
      if(config.samples>maxSamples){skipped.push({...config,reason:`requested count exceeds MAX_SAMPLES ${maxSamples}`});continue;}
      const source=target(W,H,THREE.HalfFloatType,true,config.samples,config.ordinary);
      for(const oblique of [false,true]){
        const label=`samples${config.samples}/${config.ordinary?'explicit-renderbuffer':'renderer-native'}/${oblique?'oblique':'perspective'}`;
        try{
          phase=`${label}:source render`;
          renderer.autoClear=true;camera.updateProjectionMatrix();if(oblique){const e=camera.projectionMatrix.elements;e[2]=.07;e[6]=-.11;e[10]*=.9;e[14]*=1.2;camera.projectionMatrixInverse.copy(camera.projectionMatrix).invert();}
          renderer.setRenderTarget(source);renderer.render(world,camera);renderer.setRenderTarget(source);
          const sourceFramebuffer=gl.getParameter(gl.DRAW_FRAMEBUFFER_BINDING),actualSamples=gl.getParameter(gl.SAMPLES),status=gl.checkFramebufferStatus(gl.DRAW_FRAMEBUFFER),path=renderer.properties.get(source).__webglMultisampledFramebuffer===sourceFramebuffer?'explicit-multisample-renderbuffer':(actualSamples?'extension-managed-multisample':'single-sample');
          check(`${label}: actual complete source and sample count`,status===gl.FRAMEBUFFER_COMPLETE&&(config.samples?actualSamples>=config.samples:actualSamples===0),{requested:config.samples,actualSamples,status,path});
          const originalDepth=depthValues(source.depthTexture),originalColor=readRGBA(source.texture),expected=oracle(originalDepth);
          check(`${label}: real opaque and sky geometry lies in analytic pixel-corner depth range`,expected.interiorPixels>20&&expected.skyPixels>20&&expected.maximumPixelCornerIntervalViolation<2e-6&&expected.maximumSkyError===0,{...expected});
          // Prime allocation, then clear COLOR ONLY. The tested second copy may
          // change depth but must leave this unrelated destination color intact.
          phase=`${label}:prime depth copy`;copy.copy(source);phase=`${label}:destination color witness`;renderer.setRenderTarget(copy.target);renderer.setClearColor(new THREE.Color(.125,.25,.375),.625);renderer.clear(true,false,false);renderer.setClearColor(0x000000,0);const destinationColorBefore=readRGBA(copy.target.texture);
          phase=`${label}:caller sentinel state`;
          renderer.setRenderTarget(source);renderer.state.bindFramebuffer(gl.READ_FRAMEBUFFER,sentinelFramebuffer);gl.bindFramebuffer(gl.READ_FRAMEBUFFER,sentinelFramebuffer);renderer.setViewport(1,2,W-3,H-5);renderer.setScissor(2,1,W-6,H-4);renderer.setScissorTest(true);
          const before=rectangles(),beforeDraw=gl.getParameter(gl.DRAW_FRAMEBUFFER_BINDING),beforeRead=gl.getParameter(gl.READ_FRAMEBUFFER_BINDING);phase=`${label}:tested depth copy`;const copied=copy.copy(source),after=rectangles();
          check(`${label}: restores raw READ/DRAW plus public/physical rectangles`,renderer.getRenderTarget()===source&&gl.getParameter(gl.DRAW_FRAMEBUFFER_BINDING)===beforeDraw&&gl.getParameter(gl.READ_FRAMEBUFFER_BINDING)===beforeRead&&beforeRead===sentinelFramebuffer&&JSON.stringify(before)===JSON.stringify(after),{before,after,readWasSentinel:beforeRead===sentinelFramebuffer});
          const snapshot=depthValues(copied),depthError=maxError(originalDepth,snapshot),sourceDepthAfter=depthValues(source.depthTexture),sourceColorAfter=readRGBA(source.texture),destinationColorAfter=readRGBA(copy.target.texture);
          check(`${label}: depth resolves to independent matching storage`,depthError<1e-7&&copied!==source.depthTexture&&copy.target!==source&&copy.target.samples===0&&copied.type===source.depthTexture.type&&copied.format===source.depthTexture.format,{maximumError:depthError,copyState:copy.state});
          const sourceColorError=maxError(originalColor,sourceColorAfter),sourceDepthError=maxError(originalDepth,sourceDepthAfter),destinationColorError=maxError(destinationColorBefore,destinationColorAfter);
          check(`${label}: copy changes neither source color/depth nor destination color`,sourceColorError===0&&sourceDepthError===0&&destinationColorError===0,{sourceColorError,sourceDepthError,destinationColorError});
          // Continue drawing into the ORIGINAL multisample target, sampling
          // only the independent depth snapshot: no attached-image feedback.
          phase=`${label}:continue finite effect`;effectUniforms.uDepth.value=copied;renderer.setRenderTarget(source);renderer.setScissorTest(false);renderer.autoClear=false;renderer.render(effects,camera);renderer.autoClear=true;
          const continuedColor=readRGBA(source.texture),continuedDepth=depthValues(source.depthTexture);let occludedError=0,skyGain=0,occluded=0,open=0;
          for(let i=0;i<W*H;i++){if(originalDepth[i]<.99&&i%W>2&&i%W<11){occludedError=Math.max(occludedError,Math.abs(continuedColor[i*4]-originalColor[i*4]));occluded++;}if(originalDepth[i]===1&&i%W>20&&i%W<29){skyGain=Math.max(skyGain,continuedColor[i*4]-originalColor[i*4]);open++;}}
          const continuedDepthError=maxError(originalDepth,continuedDepth),finite=continuedColor.every(Number.isFinite);
          check(`${label}: original MSAA target still draws depthWrite=false finite effect`,finite&&occluded>0&&open>0&&occludedError<1e-6&&skyGain>.1&&continuedDepthError<1e-7,{finite,occludedPixels:occluded,openPixels:open,occludedError,skyGain,continuedDepthError});
          cases.push({label,requestedSamples:config.samples,actualSamples,path,oblique,depthError});
        }catch(error){check(`${label}: completes without exception`,false,{error:String(error),stack:error?.stack});renderer.autoClear=true;renderer.setScissorTest(false);}
      }
    }
    phase='resize source setup';const resized=target(16,10);renderer.setRenderTarget(resized);renderer.clear();phase='resize depth copy';const texture=copy.copy(resized);check('resizing retains matching depth type and dimensions',texture.image.width===16&&texture.image.height===10&&texture.type===resized.depthTexture.type);
    let rejected=false;try{copy.copy(sampleTarget);}catch{rejected=true;}check('missing depth input is explicitly rejected',rejected);
    const remainder=drain();if(remainder.length)operationErrors.push({phase,operation:'unwrapped remainder',errors:remainder});
  }finally{
    phase='fixture cleanup and outer state restore';
    copy.dispose();for(const x of owned)x.dispose();renderer.setClearColor(saved.clear,saved.alpha);renderer.autoClear=saved.auto;renderer.xr.enabled=saved.xr;renderer.shadowMap.autoUpdate=saved.shadowAuto;renderer.shadowMap.needsUpdate=saved.shadowNeeds;
    renderer.setViewport(saved.viewport);renderer.setScissor(saved.scissor);renderer.setScissorTest(saved.test);
    const t=saved.target,v=t?.viewport.clone(),c=t?.scissor.clone(),test=t?.scissorTest;
    try{if(t){t.viewport.copy(saved.actualViewport);t.scissor.fromArray(saved.actualScissor);t.scissorTest=saved.actualTest;}renderer.setRenderTarget(t,saved.face,saved.mip);}finally{if(t){t.viewport.copy(v);t.scissor.copy(c);t.scissorTest=test;}}
    renderer.state.bindFramebuffer(gl.DRAW_FRAMEBUFFER,saved.draw);gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER,saved.draw);renderer.state.bindFramebuffer(gl.READ_FRAMEBUFFER,saved.read);gl.bindFramebuffer(gl.READ_FRAMEBUFFER,saved.read);gl.readBuffer(saved.readBuffer);
    for(const {name,descriptor,original} of wrapped){if(descriptor)Object.defineProperty(gl,name,descriptor);else{delete gl[name];if(gl[name]!==original)gl[name]=original;}}
  }
  check('no WebGL errors from individually instrumented copy, render and readback operations',!operationErrors.length,{entryErrors,operationErrors,instrumentationFailures,operationCounts});
  check('outer renderer target, raw framebuffer bindings and flags restored',renderer.getRenderTarget()===saved.target&&renderer.autoClear===saved.auto&&renderer.xr.enabled===saved.xr&&renderer.getScissorTest()===saved.test&&gl.getParameter(gl.READ_FRAMEBUFFER_BINDING)===saved.read&&gl.getParameter(gl.DRAW_FRAMEBUFFER_BINDING)===saved.draw);
  return{schema:'glass-atoll.depth-copy-gpu-check.v4',date:new Date().toISOString(),passed:checks.every(c=>c.passed)&&cases.length>=6,passedCount:checks.filter(c=>c.passed).length,total:checks.length,checks,cases,errorAttribution:{entryErrors,operationErrors,instrumentationFailures,operationCounts},coverage:{automaticRTT,maxSamples,requested:[0,2,4],skipped,pixelRatio:renderer.getPixelRatio()},limits:['Actual isolated GPU resolve and original-target continuation, not production smoke composition or FPS.','Samples2 may allocate a higher supported count; actual gl.SAMPLES is recorded. Extension-managed and explicit paths both run when the extension exists.','MSAA sample choice is implementation-defined. Copied-vs-source tolerance remains1e-7; the analytic oracle uses exact pixel-corner depth bounds with the original2e-6 interval tolerance.','Entry GL errors are separately retained, never attributed to the fixture. Native GL methods are temporarily instrumented only inside this isolated QA and restored in finally.']};
}
