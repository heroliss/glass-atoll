// Call on the actual Three/WebGL renderer. Creates/disposes only owned targets.
// Does not touch the main canvas, current fireworks, camera or scene.
export async function runFireworksGPUCheck(THREE,renderer,createFireworks){
  const results=[],previous=renderer.getRenderTarget(),face=renderer.getActiveCubeFace(),mip=renderer.getActiveMipmapLevel(),clear=renderer.getClearColor(new THREE.Color()).clone(),clearAlpha=renderer.getClearAlpha(),autoClear=renderer.autoClear;
  const effect=createFireworks(THREE,{terrainHeight:()=>0,origin:[0,0,0],seed:616}),size=128;
  const target=new THREE.WebGLRenderTarget(size,size,{type:THREE.FloatType,depthBuffer:false});
  const reflected=new THREE.WebGLRenderTarget(size,size,{type:THREE.FloatType,depthBuffer:true});reflected.depthTexture=new THREE.DepthTexture(size,size);
  const camera=new THREE.PerspectiveCamera(42,1,.2,2000),mirror=new THREE.PerspectiveCamera(42,1,.2,2000),pixels=new Float32Array(size*size*4);
  const check=(name,passed,detail)=>results.push({name,passed,detail});
  const stats=()=>{let finite=0,negative=0,rgb=0,alpha=0,maximum=0,nonzero=0;for(let i=0;i<pixels.length;i+=4){let brightness=0;for(let c=0;c<4;c++){if(!Number.isFinite(pixels[i+c]))finite++;if(pixels[i+c]<-1e-6)negative++;if(c<3){rgb+=pixels[i+c];brightness+=pixels[i+c];maximum=Math.max(maximum,pixels[i+c]);}}alpha+=pixels[i+3];if(brightness>1e-10)nonzero++;}return{nonFinite:finite,negative,sumRGB:rgb,sumAlpha:alpha,maximum,nonzero};};
  function draw(time,{reflection=false,storageEV=0,air={enabled:false}}={}){
    effect.update({time,windVector:[1,0,0]});const rt=reflection?reflected:target,cam=reflection?mirror:camera;
    renderer.setRenderTarget(rt);renderer.setClearColor(0,0);renderer.clear();effect.render({renderer,target:rt,camera:cam,reflection,planeY:0,frame:{storageEV,sceneScale:2**storageEV,rawPerCandela:3.6e-5},optics:{width:size,height:size,focalMm:28,aperture:8,focusMetres:200,sensorHeightMm:24,dof:false,shutterSeconds:1/120},air});renderer.readRenderTargetPixels(rt,0,0,size,size,pixels);return stats();
  }
  try{
    renderer.autoClear=false;renderer.getContext().getExtension('EXT_float_blend');
    camera.position.set(0,123,-155);camera.lookAt(0,124,-12);camera.updateMatrixWorld();mirror.position.set(0,-123,-155);mirror.lookAt(0,124,-12);mirror.updateMatrixWorld();
    effect.configure({type:'peony',autoDirection:false,azimuth:0,elevation:88});effect.update({time:0});effect.launch();
    const rocket=draw(2.2);check('actual_finite_effects_shader_compiles_draws_nonzero',rocket.nonFinite===0&&rocket.sumRGB>0,rocket);
    check('pure_emitter_retains_zero_alpha_and_nonzero_RGB',Math.abs(rocket.sumAlpha)<1e-7&&rocket.sumRGB>0,rocket);
    const a=draw(6,{storageEV:0}),b=draw(6,{storageEV:7});check('scene_storage_scale_applied_once',a.sumRGB>0&&Math.abs(b.sumRGB/(a.sumRGB*128)-1)<.001,{relativeError:b.sumRGB/(a.sumRGB*128)-1,a,b});
    check('grey_smoke_writes_bounded_coverage',a.sumAlpha>0&&a.sumAlpha<size*size,a);
    const r=draw(6,{reflection:true});check('mirror_variant_draws_with_attached_depth_without_sampling_it',r.sumRGB>0&&r.nonFinite===0&&r.negative===0,r);
    const before=renderer.getRenderTarget();effect.render({renderer,target, camera,frame:{sceneScale:1,rawPerCandela:3.6e-5},optics:{width:size,height:size}});check('owned_render_restores_previous_target',renderer.getRenderTarget()===before);
    const source=await fetch(new URL('../../fireworks.js',import.meta.url)).then(r=>r.text());check('reflection_sampler_is_compile_time_excluded',source.includes('#ifndef REFLECTION_PASS\n      uniform highp sampler2D uDepth;')&&source.includes('uniforms.uDepth.value=reflection?dummy:opaqueDepth||dummy'));
    check('same_physical_heads_survive_quality_change',(()=>{const old=effect.diagnostics().active;effect.setQuality({trailSegments:6});return effect.diagnostics().active===old;})());
    return{date:new Date().toISOString(),passed:results.every(t=>t.passed),passedCount:results.filter(t=>t.passed).length,total:results.length,results,scope:'actual isolated GPU renderer fixture, not full-scene visual/performance acceptance',diagnostics:effect.diagnostics()};
  }finally{effect.dispose();target.dispose();reflected.depthTexture.dispose();reflected.dispose();renderer.setRenderTarget(previous,face,mip);renderer.setClearColor(clear,clearAlpha);renderer.autoClear=autoClear;}
}
