import {createOpticalBloom as createCandidate,opticalPSFBudget} from '../optical-bloom.js?c1-candidate=52508e6';
import {createOpticalBloom as createBaseline} from './optical-bloom-c1-baseline.js';
import {referenceOpticalPSF,referenceImage,referenceStats} from './optical-flare-reference.js';

function captureCaller(THREE,renderer){
  const gl=renderer.getContext(),target=renderer.getRenderTarget();
  return{target,face:renderer.getActiveCubeFace(),mip:renderer.getActiveMipmapLevel(),viewport:renderer.getViewport(new THREE.Vector4()),scissor:renderer.getScissor(new THREE.Vector4()),test:renderer.getScissorTest(),currentViewport:renderer.getCurrentViewport(new THREE.Vector4()),currentScissor:Array.from(gl.getParameter(gl.SCISSOR_BOX)),currentTest:gl.isEnabled(gl.SCISSOR_TEST),targetViewport:target?.viewport.clone(),targetScissor:target?.scissor.clone(),targetTest:target?.scissorTest,readFramebuffer:gl.getParameter(gl.READ_FRAMEBUFFER_BINDING),readBuffer:gl.getParameter(gl.READ_BUFFER),pixelPack:gl.getParameter(gl.PIXEL_PACK_BUFFER_BINDING),autoClear:renderer.autoClear,xr:renderer.xr.enabled,shadowAuto:renderer.shadowMap.autoUpdate,shadowNeeds:renderer.shadowMap.needsUpdate,shaderChecks:renderer.debug.checkShaderErrors,onShaderError:renderer.debug.onShaderError,infoAutoReset:renderer.info.autoReset,renderInfo:{...renderer.info.render}};
}
function restoreCaller(renderer,saved){
  const gl=renderer.getContext(),target=saved.target;
  // Restore logical rectangles first, then the current physical target state.
  renderer.setViewport(saved.viewport);renderer.setScissor(saved.scissor);renderer.setScissorTest(saved.test);
  try{
    if(target){target.viewport.copy(saved.currentViewport);target.scissor.fromArray(saved.currentScissor);target.scissorTest=saved.currentTest;}
    renderer.setRenderTarget(target,saved.face,saved.mip);
  }finally{if(target){target.viewport.copy(saved.targetViewport);target.scissor.copy(saved.targetScissor);target.scissorTest=saved.targetTest;}}
  renderer.state.bindFramebuffer(gl.READ_FRAMEBUFFER,saved.readFramebuffer);gl.readBuffer(saved.readBuffer);gl.bindBuffer(gl.PIXEL_PACK_BUFFER,saved.pixelPack);
  renderer.autoClear=saved.autoClear;renderer.xr.enabled=saved.xr;renderer.shadowMap.autoUpdate=saved.shadowAuto;renderer.shadowMap.needsUpdate=saved.shadowNeeds;
  renderer.debug.checkShaderErrors=saved.shaderChecks;renderer.debug.onShaderError=saved.onShaderError;renderer.info.autoReset=saved.infoAutoReset;Object.assign(renderer.info.render,saved.renderInfo);
}
function callerRestored(THREE,renderer,saved){
  const current=captureCaller(THREE,renderer),arraysEqual=(a,b)=>a.length===b.length&&a.every((v,i)=>v===b[i]);
  return['target','face','mip','test','currentTest','targetTest','readFramebuffer','readBuffer','pixelPack','autoClear','xr','shadowAuto','shadowNeeds','shaderChecks','onShaderError','infoAutoReset'].every(k=>current[k]===saved[k])&&['viewport','scissor','currentViewport'].every(k=>arraysEqual(current[k].toArray(),saved[k].toArray()))&&arraysEqual(current.currentScissor,saved.currentScissor)&&(!saved.target||(current.targetViewport.equals(saved.targetViewport)&&current.targetScissor.equals(saved.targetScissor)))&&JSON.stringify(current.renderInfo)===JSON.stringify(saved.renderInfo);
}

/** Real GPU C1 gate: reuses supplied renderer, actual shared candidate shaders.
 * An unmounted own context is created only when no renderer is supplied.
 * This is not a scene FPS test, an optical calibration, or a source-visibility
 * oracle. If an occluded/behind/offscreen source contributes no input, the
 * image-space operator must not invent one; it cannot infer those states itself.
 */
export async function runOpticalFlareCheck(THREE,suppliedRenderer=null){
  const report={kind:'C1 single-pass finite-energy ghost/veil actual GPU',startedAt:new Date().toISOString(),passed:false,checks:[],errors:[],shaderErrors:[],glErrors:[],fixtureSize:[128,96],candidateSourceSHA256:'52508e641fda1aec9594444c583f2523f9285e7dfec67ca7a25fa0157a2b9601',baselineSourceSHA256:'4bf96b00252cf79403a865b3d35b902c2aa8dcb9732c4dab4169ac96c1aaca63',limits:[
    'Image-space input only: missing input from behind/blocked/offscreen sources is zero, but this module does not solve their visibility or offscreen lens entrance paths.',
    'The point tests explicitly include finite-sensor crop; discarded energy is not re-normalized into view.',
    'A positive operator bound is not measured lens behavior. Ghost scale/coating/1.8% budget are authored parameters, not a ray-traced or calibrated lens.',
    'RGBA16F intermediates and hardware filtering are compared to a separate double raster reference; diagnostic readback wall time is not GPU time or full-scene FPS.',
  ]};
  const W=128,H=96,resources=[],start=performance.now(),add=(name,passed,details={})=>report.checks.push({name,passed:!!passed,...details});
  let renderer=suppliedRenderer,candidate,baseline,source,readTarget,geometry,copyMaterial,inputTexture,cube,callerState;
  const ownsRenderer=!suppliedRenderer;report.context=ownsRenderer?'own unmounted context':'supplied caller context (retained)';
  try{
    if(ownsRenderer){renderer=new THREE.WebGLRenderer({alpha:true,antialias:false,preserveDrawingBuffer:false});renderer.setPixelRatio(2);renderer.setSize(W/2,H/2,false);renderer.toneMapping=THREE.NoToneMapping;}
    callerState=captureCaller(THREE,renderer);
    const gl=renderer.getContext();if(!gl.getExtension('EXT_color_buffer_float'))throw new Error('EXT_color_buffer_float is required.');
    renderer.xr.enabled=false;renderer.shadowMap.autoUpdate=false;renderer.shadowMap.needsUpdate=false;renderer.info.autoReset=false;gl.bindBuffer(gl.PIXEL_PACK_BUFFER,null);
    renderer.debug.checkShaderErrors=true;renderer.debug.onShaderError=(context,program,vertex,fragment)=>report.shaderErrors.push({program:context.getProgramInfoLog(program),vertex:context.getShaderInfoLog(vertex),fragment:context.getShaderInfoLog(fragment)});
    source=new THREE.WebGLRenderTarget(W,H,{type:THREE.HalfFloatType,depthBuffer:false});readTarget=new THREE.WebGLRenderTarget(W,H,{type:THREE.FloatType,depthBuffer:false});resources.push(source,readTarget);
    source.texture.colorSpace=readTarget.texture.colorSpace=THREE.NoColorSpace;
    const uploadData=new Float32Array(W*H*4);inputTexture=new THREE.DataTexture(uploadData,W,H,THREE.RGBAFormat,THREE.FloatType);inputTexture.minFilter=inputTexture.magFilter=THREE.LinearFilter;inputTexture.colorSpace=THREE.NoColorSpace;inputTexture.generateMipmaps=false;resources.push(inputTexture);
    geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute([-1,-1,0,3,-1,0,-1,3,0],3));resources.push(geometry);
    copyMaterial=new THREE.RawShaderMaterial({glslVersion:THREE.GLSL3,uniforms:{uInput:{value:null}},depthTest:false,depthWrite:false,blending:THREE.NoBlending,toneMapped:false,
      vertexShader:'precision highp float;in vec3 position;out vec2 vUv;void main(){vUv=position.xy*.5+.5;gl_Position=vec4(position,1.);}',
      fragmentShader:'precision highp float;uniform highp sampler2D uInput;in vec2 vUv;out vec4 colour;void main(){colour=vec4(texture(uInput,vUv).rgb,1.);}'});resources.push(copyMaterial);
    const scene=new THREE.Scene(),camera=new THREE.Camera(),quad=new THREE.Mesh(geometry,copyMaterial);quad.frustumCulled=false;scene.add(quad);
    candidate=createCandidate(THREE,renderer);baseline=createBaseline(THREE,renderer);candidate.setSize(W,H);baseline.setSize(W,H);
    function draw(image){
      for(let p=0;p<W*H;p++){uploadData[p*4]=image.data[p*3];uploadData[p*4+1]=image.data[p*3+1];uploadData[p*4+2]=image.data[p*3+2];uploadData[p*4+3]=1;}
      inputTexture.needsUpdate=true;copyMaterial.uniforms.uInput.value=inputTexture;renderer.setRenderTarget(source);renderer.render(scene,camera);
      return read(source.texture);
    }
    function read(texture){
      copyMaterial.uniforms.uInput.value=texture;renderer.setRenderTarget(readTarget);renderer.render(scene,camera);
      const rgba=new Float32Array(W*H*4);renderer.readRenderTargetPixels(readTarget,0,0,W,H,rgba);const data=new Float64Array(W*H*3);
      for(let p=0;p<W*H;p++)for(let c=0;c<3;c++)data[p*3+c]=rgba[p*4+c];return{width:W,height:H,data,opaque:rgba.every((v,i)=>i%4!==3||v===1)};
    }
    function checkRGB(actual,expected,{relative=.002,absolute=2e-6}={}){
      let maximumAbsoluteError=0,maximumToleranceRatio=0,nonFinite=0,negative=0;
      for(let i=0;i<actual.data.length;i++){
        const value=actual.data[i],error=Math.abs(value-expected.data[i]),limit=absolute+relative*Math.abs(expected.data[i]);
        if(!Number.isFinite(value))nonFinite++;if(value<0)negative++;
        maximumAbsoluteError=Math.max(maximumAbsoluteError,error);maximumToleranceRatio=Math.max(maximumToleranceRatio,error/limit);
      }
      return{passed:nonFinite===0&&negative===0&&maximumToleranceRatio<=1,maximumAbsoluteError,maximumToleranceRatio,nonFinite,negative,tolerance:{relative,absolute}};
    }
    function render(config){candidate.configure(config);return read(candidate.render(source.texture));}
    function snapshot(){
      return{target:renderer.getRenderTarget(),face:renderer.getActiveCubeFace(),mip:renderer.getActiveMipmapLevel(),viewport:renderer.getViewport(new THREE.Vector4()).toArray(),currentViewport:renderer.getCurrentViewport(new THREE.Vector4()).toArray(),scissor:renderer.getScissor(new THREE.Vector4()).toArray(),scissorTest:renderer.getScissorTest(),actualScissor:Array.from(gl.getParameter(gl.SCISSOR_BOX)),actualScissorTest:gl.isEnabled(gl.SCISSOR_TEST),readFramebuffer:gl.getParameter(gl.READ_FRAMEBUFFER_BINDING),readBuffer:gl.getParameter(gl.READ_BUFFER),autoClear:renderer.autoClear,xr:renderer.xr.enabled,targetViewport:renderer.getRenderTarget()?.viewport.toArray(),targetScissor:renderer.getRenderTarget()?.scissor.toArray(),targetScissorTest:renderer.getRenderTarget()?.scissorTest};
    }
    function sameState(a,b){
      return a.target===b.target&&a.readFramebuffer===b.readFramebuffer&&JSON.stringify({...a,target:null,readFramebuffer:null})===JSON.stringify({...b,target:null,readFramebuffer:null});
    }
    const pointImage=(point,colour=[64,16,4])=>referenceImage(W,H,(x,y)=>x===point[0]&&y===point[1]?colour:[0,0,0]);

    // The old implementation is preserved as a real compiled A oracle, not a
    // string-only claim that the default branch stayed equivalent.
    const pattern=referenceImage(W,H,(x,y)=>{
      const peak=(x===85&&y===63)?64:(x===30&&y===26)?16:0;
      return[peak+(x%13)*.03125,(y%11)*.0625+peak*.25,((x*7+y*11)%19)*.015625+peak*.125];
    });
    draw(pattern);const originalResult=read(baseline.render(source.texture)),candidateDefault=render(true),defaultComparison=checkRGB(candidateDefault,originalResult,{relative:.0015,absolute:2e-6});
    add('flare-off legacy PSF matches original actual GPU A oracle',defaultComparison.passed,{...defaultComparison,defaultState:candidate.state});

    const flat=[2048,128,4];draw(referenceImage(W,H,()=>flat));
    for(const bloom of [false,true]){
      const actual=render({bloom,flare:true}),stats=referenceStats(actual),bound=candidate.state.operatorPeakBoundRGB,expected=referenceImage(W,H,()=>flat.map((v,c)=>v*bound[c])),comparison=checkRGB(actual,expected,{relative:.001,absolute:2e-5});
      add(`uniform HDR never grows and agrees with Jacobian row bound (${bloom?'bloom+flare':'flare only'})`,comparison.passed&&stats.maximum.every((v,c)=>v<=flat[c])&&actual.opaque,{comparison,minimum:stats.minimum,maximum:stats.maximum,input:flat,operatorPeakBoundRGB:bound,minimumHDRRetention:stats.minimum[0]/flat[0]});
    }

    draw(referenceImage(W,H,()=>[0,0,0]));for(const bloom of [false,true]){
      const stats=referenceStats(render({bloom,flare:true}));add(`black/missing-source input produces exactly zero (${bloom?'bloom+flare':'flare only'})`,stats.nonFinite===0&&stats.sum.every(v=>v===0)&&stats.maximum.every(v=>v===0),{stats,visibilityLimit:'This is an input-zero test, not an occlusion/offscreen geometry simulation.'});
    }

    const pointResults=[];
    for(const point of [[64,48],[90,65],[0,48],[0,0]])for(const bloom of [false,true]){
      const actualInput=draw(pointImage(point)),actualInputStats=referenceStats(actualInput),actual=render({bloom,flare:true}),actualStats=referenceStats(actual),expected=referenceOpticalPSF(actualInput,{bloom,flare:true}),expectedStats=referenceStats(expected);
      const fluxRatio=actualStats.sum.map((v,c)=>v/actualInputStats.sum[c]),referenceRatio=expectedStats.sum.map((v,c)=>v/actualInputStats.sum[c]),fluxDifference=actualStats.sum.map((v,c)=>(v-expectedStats.sum[c])/actualInputStats.sum[c]);
      const peakRatio=actualStats.maximum.map((v,c)=>v/actualInputStats.maximum[c]),minimum=opticalPSFBudget({bloom,flare:true}).direct;
      const passed=actualStats.nonFinite===0&&actualStats.minimum.every(v=>v>=0)&&fluxRatio.every(v=>v<=1.001&&v>=minimum-.001)&&fluxDifference.every(v=>Math.abs(v)<=.0015)&&peakRatio.every(v=>v<=1)&&actual.opaque;
      const detail={point,bloom,fluxRatio,referenceRatio,relativeFluxDifference:fluxDifference,peakRatio,nonFinite:actualStats.nonFinite,tolerance:'Flux <= input +0.1%; double-reference difference <=0.15% input flux for FP16 storage/filter rounding; finite sensor crop is retained.'};pointResults.push(detail);
      add(`point flux/crop and peak bound at ${point.join(',')} (${bloom?'bloom+flare':'flare only'})`,passed,detail);
    }
    report.pointResults=pointResults;

    // Isolate the redistributed light away from the direct point; do not subtract
    // a rounded FP16 direct pixel and mistake its quantization residual for flare.
    const offAxis=[85,60],input=draw(pointImage(offAxis)),flareOnly=render({bloom:false,flare:true});
    const expected=referenceOpticalPSF(input,{bloom:false,flare:true}),comparison=checkRGB(flareOnly,expected,{relative:.012,absolute:2e-6});
    const ghostLocations=[-.72,-.48,.86].map(s=>({scale:s,pixel:[(.5+((offAxis[0]+.5)/W-.5)/s)*W-.5,(.5+((offAxis[1]+.5)/H-.5)/s)*H-.5]}));
    let offPointFlux=0,ghostRegionPeak=0;
    for(let y=0;y<H;y++)for(let x=0;x<W;x++)if(x!==offAxis[0]||y!==offAxis[1]){
      const value=flareOnly.data[(y*W+x)*3];offPointFlux+=value;
      if(ghostLocations.some(({pixel:[px,py]})=>Math.hypot(x-px,y-py)<6))ghostRegionPeak=Math.max(ghostRegionPeak,value);
    }
    add('off-axis visible input actually creates bounded diffuse ghosts rather than a no-op',comparison.passed&&offPointFlux>1e-4&&offPointFlux<=64*.0051&&ghostRegionPeak>1e-6,{comparison,offPointFlux,ghostRegionPeak,predictedGhostCentres:ghostLocations});

    const stress=referenceImage(W,H,(x,y)=>[(x===20&&y===30)?4096:((x*13+y*17)%23)*.125,((x*11+y*3)%17)*.0625,(x===88&&y===68)?256:((x+y)%9)*.03125]);
    const stressInput=draw(stress),stressInputStats=referenceStats(stressInput),stressResult=render({bloom:true,flare:true}),stressStats=referenceStats(stressResult);
    add('mixed HDR field remains finite/nonnegative and each RGB peak <= input peak',stressStats.nonFinite===0&&stressStats.minimum.every(v=>v>=0)&&stressStats.maximum.every((v,c)=>v<=stressInputStats.maximum[c]),{inputMaximum:stressInputStats.maximum,outputMaximum:stressStats.maximum,outputMinimum:stressStats.minimum,nonFinite:stressStats.nonFinite});

    const preExposedImage=pointImage([83,58],[32,8,2]);draw(preExposedImage);const baseResult=render({bloom:true,flare:true}),PResults=[];
    for(const P of [-4,8]){
      const scale=2**P;draw({...preExposedImage,data:preExposedImage.data.map(v=>v*scale)});const actual=render({bloom:true,flare:true});for(let i=0;i<actual.data.length;i++)actual.data[i]/=scale;
      const compensated=checkRGB(actual,baseResult,{relative:.002,absolute:2e-6});PResults.push({P,...compensated});
    }
    add('P power-of-two compensation is preserved without a second display/exposure gain',PResults.every(p=>p.passed),{results:PResults});

    // Current framebuffer, rectangle and metadata may differ from their defaults.
    draw(pointImage([64,48]));candidate.configure({bloom:true,flare:true});renderer.setRenderTarget(source);renderer.setViewport(2,3,31,29);renderer.setScissor(1,2,17,19);renderer.setScissorTest(true);renderer.autoClear=false;
    const saved=snapshot();candidate.render(source.texture);const restored=snapshot();add('enabled path restores current target/rectangles/read-FBO and logical metadata',sameState(saved,restored),{currentViewport:saved.currentViewport,actualScissor:saved.actualScissor});

    const originalRender=renderer.render;let internalDraws=0,thrown=false;
    renderer.render=function(...args){if(++internalDraws===2)throw new Error('intentional PSF fixture draw failure');return originalRender.apply(this,args);};
    const beforeFailure=snapshot();try{candidate.render(source.texture);}catch(error){thrown=String(error).includes('intentional PSF fixture');}finally{renderer.render=originalRender;}
    add('try/finally also restores caller state after an injected draw failure',thrown&&sameState(beforeFailure,snapshot()),{intentionalFailureCaught:thrown});

    renderer.setScissorTest(false);renderer.setViewport(0,0,W/2,H/2);renderer.autoClear=true;
    cube=new THREE.WebGLCubeRenderTarget(16,{type:THREE.HalfFloatType,depthBuffer:false,generateMipmaps:true,minFilter:THREE.LinearMipmapLinearFilter});resources.push(cube);
    cube.texture.generateMipmaps=true;copyMaterial.uniforms.uInput.value=source.texture;
    for(let face=0;face<6;face++){renderer.setRenderTarget(cube,face,0);renderer.render(scene,camera);}
    renderer.setRenderTarget(cube,4,1);renderer.setViewport(1,1,3,3);renderer.setScissor(1,1,2,2);renderer.setScissorTest(true);
    const cubeBefore=snapshot(),cubeComplete=gl.checkFramebufferStatus(gl.FRAMEBUFFER)===gl.FRAMEBUFFER_COMPLETE;candidate.render(source.texture);
    add('cube face and allocated nonzero mip target restore without metadata mutation',cubeComplete&&sameState(cubeBefore,snapshot()),{face:cubeBefore.face,mip:cubeBefore.mip,framebufferComplete:cubeComplete});

    candidate.configure({bloom:false,flare:false});const beforeBypass=snapshot(),calls=renderer.info.render.calls,token=candidate.render(source.texture);
    add('both off is exact input identity with zero draws and no state change',token===source.texture&&candidate.resultTarget===null&&calls===renderer.info.render.calls&&sameState(beforeBypass,snapshot()));
    candidate.configure(true);add('legacy bool turns flare off and restores original A budget',candidate.state.bloom===true&&candidate.state.flare===false&&candidate.state.strength===.018&&candidate.state.passes===5,{state:candidate.state});

    renderer.setRenderTarget(null);for(let i=0;i<32;i++){const error=gl.getError();if(error===gl.NO_ERROR)break;report.glErrors.push('0x'+error.toString(16));}
    add('all actual shaders compile without WebGL errors',report.shaderErrors.length===0&&report.glErrors.length===0,{shaderErrors:report.shaderErrors,glErrors:report.glErrors});report.lastState=candidate.state;
  }catch(error){report.errors.push(String(error?.stack||error));}
  finally{
    try{
      if(callerState)restoreCaller(renderer,callerState);else renderer?.setRenderTarget(null);
      candidate?.dispose();baseline?.dispose();for(const resource of resources.reverse())resource.dispose();
      report.outerStateRestored=!!callerState&&callerRestored(THREE,renderer,callerState);
      if(ownsRenderer){renderer?.dispose();renderer?.forceContextLoss();}
    }
    catch(error){report.errors.push(`cleanup: ${error?.stack||error}`);}
    report.wallTimeMs=performance.now()-start;report.cleanup=ownsRenderer?'Own unmounted renderer/context and temporary resources disposed.':'Only own temporary resources disposed; supplied context retained and caller state restored.';
    report.passed=report.outerStateRestored&&report.errors.length===0&&report.shaderErrors.length===0&&report.glErrors.length===0&&report.checks.length>0&&report.checks.every(check=>check.passed);
  }
  return report;
}
