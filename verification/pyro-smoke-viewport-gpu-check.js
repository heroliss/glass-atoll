import {createPyroSmokeRenderer} from '../pyro-smoke-renderer.js';
import {createPyroSmokeState} from '../pyro-smoke-state.js';
import {runSmokeGaussianGPUCheck} from './pyro-smoke-renderer-gpu-check.js';
import {runSmokeAirGPUCheck} from './pyro-smoke-air-gpu-check.js';
import {runSmokeLocalGPUCheck} from './pyro-smoke-local-gpu-check.js';

// Parent must exclusively lock production rendering for this function. Changing
// DPR rebuilds the canvas drawing buffer; its dimensions, not its old presented
// pixels, are restored. Parent must invalidate its paused presentation cache.
export function runSmokeViewportGPUCheck(THREE,renderer,{parentLocked=false,runRegressions=true}={}){
  if(!parentLocked)throw new Error('Smoke viewport QA requires an exclusive parent renderer lock');
  const gl=renderer.getContext(),checks=[],check=(id,passed,evidence={})=>checks.push({id,passed,...evidence}),owned=[],shared={};
  const snapshot=()=>({publicViewport:renderer.getViewport(new THREE.Vector4()).toArray(),publicScissor:renderer.getScissor(new THREE.Vector4()).toArray(),publicTest:renderer.getScissorTest(),actualViewport:renderer.getCurrentViewport(new THREE.Vector4()).toArray(),glViewport:Array.from(gl.getParameter(gl.VIEWPORT)),actualScissor:Array.from(gl.getParameter(gl.SCISSOR_BOX)),actualTest:gl.isEnabled(gl.SCISSOR_TEST),target:renderer.getRenderTarget(),face:renderer.getActiveCubeFace(),mip:renderer.getActiveMipmapLevel(),read:gl.getParameter(gl.READ_FRAMEBUFFER_BINDING),draw:gl.getParameter(gl.DRAW_FRAMEBUFFER_BINDING),autoClear:renderer.autoClear,shadowAuto:renderer.shadowMap.autoUpdate,shadowDirty:renderer.shadowMap.needsUpdate});
  const saved=snapshot(),savedRatio=renderer.getPixelRatio(),savedSize=renderer.getSize(new THREE.Vector2()),savedDrawing=renderer.getDrawingBufferSize(new THREE.Vector2()),savedClear=renderer.getClearColor(new THREE.Color()).clone(),savedAlpha=renderer.getClearAlpha(),savedXR=renderer.xr.enabled;
  const equalState=(a,b)=>['target','face','mip','read','draw','publicTest','actualTest','autoClear','shadowAuto','shadowDirty'].every(k=>a[k]===b[k])&&['publicViewport','publicScissor','actualViewport','glViewport','actualScissor'].every(k=>JSON.stringify(a[k])===JSON.stringify(b[k]));
  function restore(){
    renderer.setRenderTarget(null);renderer.setPixelRatio(savedRatio);renderer.setSize(savedSize.x,savedSize.y,false);renderer.setClearColor(savedClear,savedAlpha);renderer.autoClear=saved.autoClear;renderer.shadowMap.autoUpdate=saved.shadowAuto;renderer.shadowMap.needsUpdate=saved.shadowDirty;renderer.xr.enabled=savedXR;
    renderer.setViewport(new THREE.Vector4(...saved.publicViewport));renderer.setScissor(new THREE.Vector4(...saved.publicScissor));renderer.setScissorTest(saved.publicTest);
    const t=saved.target,v=t?.viewport.clone(),s=t?.scissor.clone(),test=t?.scissorTest;
    try{if(t){t.viewport.fromArray(saved.actualViewport);t.scissor.fromArray(saved.actualScissor);t.scissorTest=saved.actualTest;}renderer.setRenderTarget(t,saved.face,saved.mip);}finally{if(t){t.viewport.copy(v);t.scissor.copy(s);t.scissorTest=test;}}
    renderer.state.bindFramebuffer(gl.DRAW_FRAMEBUFFER,saved.draw);gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER,saved.draw);renderer.state.bindFramebuffer(gl.READ_FRAMEBUFFER,saved.read);gl.bindFramebuffer(gl.READ_FRAMEBUFFER,saved.read);
  }
  let smoke=null,cases=[];
  try{
    renderer.setRenderTarget(null);renderer.xr.enabled=false;renderer.setPixelRatio(1);renderer.setSize(savedSize.x,savedSize.y,false);
    if(runRegressions){shared.gaussian=runSmokeGaussianGPUCheck(THREE,renderer);shared.air=runSmokeAirGPUCheck(THREE,renderer);shared.local=runSmokeLocalGPUCheck(THREE,renderer);check('DPR1_shared_gaussian18_air14_local18_regressions',shared.gaussian.passed&&shared.gaussian.counts.checks===18&&shared.air.passed&&shared.air.counts.checks===14&&shared.local.passed&&shared.local.counts.checks===18,{counts:Object.fromEntries(Object.entries(shared).map(([k,r])=>[k,r.counts]))});}
    const W=17,H=13,target=new THREE.WebGLRenderTarget(W,H,{type:THREE.FloatType,format:THREE.RGBAFormat,depthBuffer:false}),sentinel=new THREE.WebGLRenderTarget(7,5,{depthBuffer:false});target.texture.colorSpace=THREE.NoColorSpace;target.texture.minFilter=target.texture.magFilter=THREE.NearestFilter;owned.push(target,sentinel);
    target.viewport.set(2,1,9,8);target.scissor.set(3,2,7,6);target.scissorTest=true;sentinel.viewport.set(1,1,5,3);sentinel.scissor.set(2,1,4,3);sentinel.scissorTest=false;
    const depth=new THREE.DataTexture(new Float32Array([1]),1,1,THREE.RedFormat,THREE.FloatType);depth.needsUpdate=true;depth.minFilter=depth.magFilter=THREE.NearestFilter;owned.push(depth);
    const state=createPyroSmokeState({profiles:{reference:{extinctionPerMassRGB:[1,1,1],singleScatteringAlbedo:1}}});state.queueEmission({time:0,emissionId:0,mass:1,mean:[.3,.1,-5],covariance:[.8,.05,.02,.05,.6,.03,.02,.03,.7]});smoke=createPyroSmokeRenderer(THREE,renderer);smoke.setState(state.snapshot());
    const camera=new THREE.PerspectiveCamera(50,W/H,.1,100);camera.lookAt(0,0,-1);camera.updateMatrixWorld();const lighting={ambientRGB:[4*Math.PI,2*Math.PI,Math.PI]};
    const metadata=t=>({viewport:t.viewport.toArray(),scissor:t.scissor.toArray(),scissorTest:t.scissorTest});
    function runCase(ratio,sameTarget=false){
      renderer.setRenderTarget(null);renderer.setPixelRatio(ratio);renderer.setSize(savedSize.x,savedSize.y,false);
      // clear is viewport-independent when scissor is disabled, and has alpha0.
      renderer.setRenderTarget(target);renderer.setScissorTest(false);renderer.setClearColor(new THREE.Color(0,0,0),0);renderer.clear();
      renderer.setViewport(3,4,8,6);renderer.setScissor(2,3,5,4);renderer.setScissorTest(true);renderer.setRenderTarget(sameTarget?target:sentinel);
      const before=snapshot(),beforeMetadata={target:metadata(target),sentinel:metadata(sentinel)},meta=smoke.render({target,camera,opaqueDepth:depth,lighting}),after=snapshot(),afterMetadata={target:metadata(target),sentinel:metadata(sentinel)};
      const stateMatches=equalState(before,after),metadataMatches=JSON.stringify(beforeMetadata)===JSON.stringify(afterMetadata),pixel=new Float32Array(W*H*4);renderer.readRenderTargetPixels(target,0,0,W,H,pixel);let covered=0;for(let i=0;i<W*H;i++)if(pixel[i*4+3]>0)covered++;
      const result={ratio,sameTarget,stateMatches,metadataMatches,covered,expectedPixels:W*H,finiteNonnegative:pixel.every(v=>Number.isFinite(v)&&v>=0),meta,publicViewport:after.publicViewport,actualViewport:after.actualViewport,beforeMetadata,afterMetadata,pixel};cases.push(result);return result;
    }
    const a=runCase(1),b=runCase(2),c=runCase(2,true);let maximumError=0,mismatches=0;for(let i=0;i<a.pixel.length;i++){maximumError=Math.max(maximumError,Math.abs(a.pixel[i]-b.pixel[i]));if(a.pixel[i]!==b.pixel[i])mismatches++;}
    check('DPR1_and_DPR2_same_physical_RT_are_bit_identical',mismatches===0,{maximumError,mismatchedChannels:mismatches,width:W,height:H});
    check('full_RT_coverage_is_not_cropped_by_custom_target_metadata_or_DPR',cases.every(c=>c.covered===W*H&&c.finiteNonnegative),{cases:cases.map(({pixel,...r})=>r)});
    check('caller_public_and_actual_physical_RT_rectangles_restore',cases.every(c=>c.stateMatches),{cases:cases.map(c=>({ratio:c.ratio,sameTarget:c.sameTarget,stateMatches:c.stateMatches,publicViewport:c.publicViewport,actualViewport:c.actualViewport}))});
    check('target_and_caller_RT_metadata_restore_including_same_target_case',cases.every(c=>c.metadataMatches));
    check('drawing_into_current_caller_RT_does_not_change_pixels',c.pixel.every((v,i)=>v===a.pixel[i]));
    check('physical_light_and_column_state_are_independent_of_DPR',a.meta.packets===b.meta.packets&&a.meta.instances===b.meta.instances&&a.meta.stateRevision===b.meta.stateRevision&&JSON.stringify(state.snapshot().packets[0].mean)==='[0.3,0.1,-5]');
  }finally{smoke?.dispose();for(const resource of owned)resource.dispose();restore();}
  const finalState=snapshot(),finalSize=renderer.getSize(new THREE.Vector2()),finalDrawing=renderer.getDrawingBufferSize(new THREE.Vector2());
  check('original_DPR_logical_and_drawing_buffer_dimensions_restore',renderer.getPixelRatio()===savedRatio&&finalSize.equals(savedSize)&&finalDrawing.equals(savedDrawing),{before:{ratio:savedRatio,logical:savedSize.toArray(),drawingBuffer:savedDrawing.toArray()},after:{ratio:renderer.getPixelRatio(),logical:finalSize.toArray(),drawingBuffer:finalDrawing.toArray()}});
  check('outer_renderer_flags_target_bindings_and_rectangles_restore',equalState(saved,finalState)&&renderer.xr.enabled===savedXR&&renderer.getClearAlpha()===savedAlpha&&renderer.getClearColor(new THREE.Color()).equals(savedClear));
  return{schema:'glass-atoll.smoke-physical-viewport-GPU.v1',passed:checks.every(c=>c.passed),counts:{checks:checks.length,passed:checks.filter(c=>c.passed).length},checks,sharedRegressions:shared,actualPixelRatios:[1,2],parentLockDeclared:parentLocked,physicalTarget:[17,13],backbufferDimensionsRestored:finalDrawing.equals(savedDrawing),limits:['parent must exclusively lock production renderer; flag is caller declaration, not an internal scheduler','temporary DPR change rebuilds canvas buffer; parent must redraw/invalidate paused presentation cache afterwards','small RT pixel/coverage/state proof, not a performance or arbitrary browser proof','shared18/14/18 regressions execute atDPR1; dedicated physical RT cases execute at1and2','does not change light/column/sort/S/T formula or production main/water integration']};
}
