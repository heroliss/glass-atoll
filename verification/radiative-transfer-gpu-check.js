import {radiativeTransferGLSL,homogeneousSegment,combineMedia,composeTransfers,applyTransfer,scaleTransferRadiance,hgPhase,hgPhaseMax,rayleighPhase,scatteringCosine,scatteringSource} from '../radiative-transfer.js';

function save(THREE,renderer){
  const gl=renderer.getContext();
  return{target:renderer.getRenderTarget(),face:renderer.getActiveCubeFace(),mip:renderer.getActiveMipmapLevel(),viewport:renderer.getViewport(new THREE.Vector4()),scissor:renderer.getScissor(new THREE.Vector4()),scissorTest:renderer.getScissorTest(),currentViewport:renderer.getCurrentViewport(new THREE.Vector4()),currentScissor:Array.from(gl.getParameter(gl.SCISSOR_BOX)),currentScissorTest:gl.isEnabled(gl.SCISSOR_TEST),readFramebuffer:gl.getParameter(gl.READ_FRAMEBUFFER_BINDING),readBuffer:gl.getParameter(gl.READ_BUFFER),pixelPack:gl.getParameter(gl.PIXEL_PACK_BUFFER_BINDING),autoClear:renderer.autoClear,xr:renderer.xr.enabled,shadowAuto:renderer.shadowMap.autoUpdate,shadowNeeds:renderer.shadowMap.needsUpdate,shaderChecks:renderer.debug.checkShaderErrors,onShaderError:renderer.debug.onShaderError,infoAutoReset:renderer.info.autoReset,renderInfo:{...renderer.info.render}};
}
function restore(renderer,saved){
  const gl=renderer.getContext(),target=saved.target;
  const viewport=target?.viewport.clone(),scissor=target?.scissor.clone(),test=target?.scissorTest;
  try{
    if(target){target.viewport.copy(saved.currentViewport);target.scissor.fromArray(saved.currentScissor);target.scissorTest=saved.currentScissorTest;}
    renderer.setRenderTarget(target,saved.face,saved.mip);
  }finally{if(target){target.viewport.copy(viewport);target.scissor.copy(scissor);target.scissorTest=test;}}
  if(renderer.state?.bindFramebuffer)renderer.state.bindFramebuffer(gl.READ_FRAMEBUFFER,saved.readFramebuffer);
  else gl.bindFramebuffer(gl.READ_FRAMEBUFFER,saved.readFramebuffer);
  gl.readBuffer(saved.readBuffer);gl.bindBuffer(gl.PIXEL_PACK_BUFFER,saved.pixelPack);
  renderer.autoClear=saved.autoClear;renderer.xr.enabled=saved.xr;renderer.shadowMap.autoUpdate=saved.shadowAuto;renderer.shadowMap.needsUpdate=saved.shadowNeeds;
  renderer.debug.checkShaderErrors=saved.shaderChecks;renderer.debug.onShaderError=saved.onShaderError;
  renderer.info.autoReset=saved.infoAutoReset;Object.assign(renderer.info.render,saved.renderInfo);
}
function equalState(THREE,renderer,saved){
  const now=save(THREE,renderer),sameArray=(a,b)=>a.length===b.length&&a.every((v,i)=>v===b[i]);
  return ['target','face','mip','scissorTest','currentScissorTest','readFramebuffer','readBuffer','pixelPack','autoClear','xr','shadowAuto','shadowNeeds','shaderChecks','onShaderError','infoAutoReset'].every(k=>now[k]===saved[k])&&['viewport','scissor','currentViewport'].every(k=>sameArray(now[k].toArray(),saved[k].toArray()))&&sameArray(now.currentScissor,saved.currentScissor)&&JSON.stringify(now.renderInfo)===JSON.stringify(saved.renderInfo);
}

/** Small real-GPU fixture, called by the owner of an idle existing renderer.
 * Reads only 4 RGBA32F pixels per case. No mounted canvas or production mutation.
 * CPU integration/phase normalization oracles live in radiative-transfer-check.mjs.
 * This tests whether the actual shared GLSL agrees with those CPU quantities.
 */
export function runRadiativeTransferGPUCheck(THREE,renderer){
  const report={kind:'Homogeneous RGB transfer shared GLSL / actual WebGL highp',passed:false,checks:[],errors:[],shaderErrors:[],glErrors:[],preexistingGlErrors:[],limits:['Synthetic homogeneous segments, not production smoke/cloud integration or visual acceptance.','RGBA32F output isolates arithmetic from FP16 storage; production FP16 budgets require separate tests.','Synchronous small readbacks are diagnostic work, not scene frame-rate measurements.']};
  const gl=renderer.getContext(),saved=save(THREE,renderer),resources=[];
  const drain=out=>{for(let i=0;i<32;i++){const e=gl.getError();if(e===gl.NO_ERROR)break;out.push('0x'+e.toString(16));}};
  drain(report.preexistingGlErrors);
  const add=(name,passed,details={})=>report.checks.push({name,passed:!!passed,...details});
  const vec=value=>new THREE.Vector3(...value),f=Math.fround,frgb=v=>v.map(f);
  const base={beta0:[.01,.02,.03],j0:[4,2,.5],length0:24,beta1:[.04,.003,.07],j1:[.1,3,7],length1:13,background:[3,9,.4],sigma:[.003,.007,.004],incident:[20,3,.5],g:.32,mu:.7,scale:256,incoming:[1,2,-3],outgoing:[-3,1,2]};
  let target,geometry,material;
  try{
    if(!renderer.capabilities.isWebGL2||!gl.getExtension('EXT_color_buffer_float'))throw new Error('WebGL2 and EXT_color_buffer_float are required.');
    renderer.xr.enabled=false;renderer.autoClear=false;renderer.shadowMap.autoUpdate=false;renderer.shadowMap.needsUpdate=false;renderer.info.autoReset=false;
    renderer.debug.checkShaderErrors=true;renderer.debug.onShaderError=(context,program,vertex,fragment)=>report.shaderErrors.push({program:context.getProgramInfoLog(program),vertex:context.getShaderInfoLog(vertex),fragment:context.getShaderInfoLog(fragment)});
    target=new THREE.WebGLRenderTarget(4,1,{format:THREE.RGBAFormat,type:THREE.FloatType,depthBuffer:false,stencilBuffer:false,minFilter:THREE.NearestFilter,magFilter:THREE.NearestFilter});target.texture.colorSpace=THREE.NoColorSpace;resources.push(target);
    geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute([-1,-1,0,3,-1,0,-1,3,0],3));resources.push(geometry);
    const uniforms={uBeta0:{value:vec(base.beta0)},uJ0:{value:vec(base.j0)},uLength0:{value:base.length0},uBeta1:{value:vec(base.beta1)},uJ1:{value:vec(base.j1)},uLength1:{value:base.length1},uBackground:{value:vec(base.background)},uSigma:{value:vec(base.sigma)},uIncident:{value:vec(base.incident)},uG:{value:base.g},uMu:{value:base.mu},uScale:{value:base.scale},uIncoming:{value:vec(base.incoming)},uOutgoing:{value:vec(base.outgoing)},uMode:{value:0}};
    material=new THREE.RawShaderMaterial({glslVersion:THREE.GLSL3,uniforms,depthTest:false,depthWrite:false,blending:THREE.NoBlending,toneMapped:false,
      vertexShader:'precision highp float;in vec3 position;void main(){gl_Position=vec4(position,1.);}',
      fragmentShader:`${radiativeTransferGLSL}
      precision highp int;
      uniform vec3 uBeta0,uJ0,uBeta1,uJ1,uBackground,uSigma,uIncident,uIncoming,uOutgoing;
      uniform float uLength0,uLength1,uG,uMu,uScale;uniform int uMode;
      out vec4 colour;
      void main(){
        RTTransfer a=rtSegment(uBeta0,uJ0,uLength0),b=rtSegment(uBeta1,uJ1,uLength1);
        if(uMode==1)a=rtCompose(a,b);
        if(uMode==2){RTMedium m=rtCombineMedia(RTMedium(uBeta0,uJ0),RTMedium(uBeta1,uJ1));a=rtSegment(m.extinctionRGB,m.sourceRGB,uLength0);}
        if(uMode==3)a=rtScaleRadiance(a,uScale);
        int pixel=int(gl_FragCoord.x);
        if(pixel==0)colour=vec4(a.T,1.);
        else if(pixel==1)colour=vec4(a.S,1.);
        else if(pixel==2)colour=vec4(uMode==4?rtScatteringSource(uSigma,uIncident,uMu,uG):rtApply(a,uBackground),1.);
        else colour=vec4(rtHG(uMu,uG),rtHGMax(uG),rtRayleigh(uMu),rtScatteringCosine(uIncoming,uOutgoing));
      }`});resources.push(material);
    const scene=new THREE.Scene(),camera=new THREE.Camera(),quad=new THREE.Mesh(geometry,material);quad.frustumCulled=false;scene.add(quad);
    function run(name,overrides={},mode=0){
      // CPU oracle consumes the actual binary32 uniform inputs, not the original
      // decimal doubles. This is input representation, not a relaxed result bound.
      const p=Object.fromEntries(Object.entries({...base,...overrides}).map(([k,v])=>[k,Array.isArray(v)?frgb(v):f(v)]));
      for(const [key,field] of [['uBeta0','beta0'],['uJ0','j0'],['uBeta1','beta1'],['uJ1','j1'],['uBackground','background'],['uSigma','sigma'],['uIncident','incident'],['uIncoming','incoming'],['uOutgoing','outgoing']])uniforms[key].value.set(...p[field]);
      for(const [key,field] of [['uLength0','length0'],['uLength1','length1'],['uG','g'],['uMu','mu'],['uScale','scale']])uniforms[key].value=p[field];uniforms.uMode.value=mode;
      renderer.setRenderTarget(target);renderer.render(scene,camera);
      const actual=new Float32Array(16);renderer.readRenderTargetPixels(target,0,0,4,1,actual);
      let a=homogeneousSegment({extinctionRGB:p.beta0,sourceRGB:p.j0,length:p.length0});
      const b=homogeneousSegment({extinctionRGB:p.beta1,sourceRGB:p.j1,length:p.length1});
      if(mode===1)a=composeTransfers(a,b);
      if(mode===2)a=homogeneousSegment({...combineMedia({extinctionRGB:p.beta0,sourceRGB:p.j0},{extinctionRGB:p.beta1,sourceRGB:p.j1}),length:p.length0});
      if(mode===3)a=scaleTransferRadiance(a,p.scale);
      const result=mode===4?scatteringSource({scatteringRGB:p.sigma,incidentRGB:p.incident,cosine:p.mu,g:p.g}):applyTransfer(a,p.background);
      const expected=[...a.T,1,...a.S,1,...result,1,hgPhase(p.mu,p.g),hgPhaseMax(p.g),rayleighPhase(p.mu),scatteringCosine(p.incoming,p.outgoing)];
      let maximumAbsoluteError=0,maximumToleranceRatio=0,nonFinite=0,negativeRGB=0;
      for(let i=0;i<16;i++){
        if(!Number.isFinite(actual[i]))nonFinite++;
        if(i<12&&i%4<3&&actual[i]<0)negativeRGB++;
        const error=Math.abs(actual[i]-expected[i]),bound=2e-7+6e-6*Math.abs(expected[i]);
        maximumAbsoluteError=Math.max(maximumAbsoluteError,error);maximumToleranceRatio=Math.max(maximumToleranceRatio,error/bound);
      }
      add(name,nonFinite===0&&negativeRGB===0&&maximumToleranceRatio<=1,{actual:Array.from(actual),expected,maximumAbsoluteError,maximumToleranceRatio,nonFinite,negativeRGB,tolerance:'2e-7 absolute + 6e-6 relative; binary32 uniforms, highp/exp arithmetic, RGBA32F storage'});
    }
    run('RGB absorption/source/apply plus actual g=.32 phase');
    run('zero beta retains j*distance without 0/0',{beta0:[0,0,0],j0:[2,.125,3],length0:8});
    run('zero distance is identity without emitting light',{length0:0});
    run('tiny optical depths do not cancel source integral',{beta0:[1e-12,1e-8,1e-5],j0:[.25,2,16],length0:1});
    run('small-x polynomial boundary is continuous',{beta0:[.2499999,.25,.2500001],length0:1});
    run('optically thick RGB remains finite',{beta0:[1,8,20],j0:[16,32,64],length0:100});
    run('front/back layer composition retains exact spatial order',{},1);
    run('co-spatial air and smoke add beta+j before integration',{},2);
    run('storage scale touches S only and retains >1 HDR',{},3);
    run('actual g=.76 source and phaseMax',{g:.76,mu:1},4);
    run('negative-g phase and opposite propagation remain valid',{g:-.76,mu:-1,incoming:[0,0,1],outgoing:[0,0,-1]},4);
    run('pure black source and background never generate light',{j0:[0,0,0],background:[0,0,0]});
    drain(report.glErrors);add('shared GLSL compiled and fixture has no GL errors',report.shaderErrors.length===0&&report.glErrors.length===0,{shaderErrors:report.shaderErrors,glErrors:report.glErrors});
  }catch(error){report.errors.push(String(error?.stack||error));}
  finally{
    try{restore(renderer,saved);for(const resource of resources.reverse())resource.dispose();const restored=equalState(THREE,renderer,saved);add('caller render target/face/mip/viewport/scissor/debug/statistics restored',restored);report.stateRestored=restored;}
    catch(error){report.errors.push(`cleanup: ${error?.stack||error}`);}
    report.passed=report.errors.length===0&&report.checks.length>0&&report.checks.every(check=>check.passed);report.cleanup='Only own temporary geometry/material/4x1 target disposed; caller context retained.';
  }
  return report;
}
