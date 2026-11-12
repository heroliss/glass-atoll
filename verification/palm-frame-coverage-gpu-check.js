// Isolated static-rest unlit pinna coverage, not a beauty/performance test.
// Root owns browser execution. Both variants share the same basic material,
// cameras, sample count and clear value; no production shader/history is edited.
export function runPalmFrameCoverageCheck(THREE,renderer,grove,{width=360,height=384,samples=8}={}){
  const actual=grove.children.find(m=>m.name==='Folded coconut pinnae');
  if(!actual||!grove.userData.setPalmFrameMode)throw new Error('Palm B0 geometry/API unavailable');
  const originalMode=grove.userData.palmFrameMode;
  grove.userData.setPalmFrameMode('legacy');const legacy=actual.geometry;
  grove.userData.setPalmFrameMode('transport');const transport=actual.geometry;
  grove.userData.setPalmFrameMode(originalMode);
  grove.updateMatrixWorld(true);
  const gl=renderer.getContext(),maximumSamples=gl.getParameter(gl.MAX_SAMPLES),requestedSamples=Math.min(samples,maximumSamples);
  const target=new THREE.WebGLRenderTarget(width,height,{type:THREE.UnsignedByteType,depthBuffer:true,stencilBuffer:false,samples:requestedSamples,minFilter:THREE.NearestFilter,magFilter:THREE.NearestFilter});
  const material=new THREE.MeshBasicMaterial({color:0xffffff,side:THREE.DoubleSide,toneMapped:false});
  const proxy=new THREE.Mesh(legacy,material);proxy.matrixAutoUpdate=false;proxy.matrix.copy(actual.matrixWorld);proxy.frustumCulled=false;
  const scene=new THREE.Scene();scene.add(proxy);
  const camera=new THREE.PerspectiveCamera(50,width/height,.1,24000);camera.filmGauge=36;camera.setFocalLength(28);
  const saved={target:renderer.getRenderTarget(),face:renderer.getActiveCubeFace(),mip:renderer.getActiveMipmapLevel(),viewport:renderer.getViewport(new THREE.Vector4()),currentViewport:renderer.getCurrentViewport(new THREE.Vector4()),scissor:renderer.getScissor(new THREE.Vector4()),test:renderer.getScissorTest(),autoClear:renderer.autoClear,toneMapping:renderer.toneMapping,outputColorSpace:renderer.outputColorSpace,colour:renderer.getClearColor(new THREE.Color()),alpha:renderer.getClearAlpha(),shadow:renderer.shadowMap?{enabled:renderer.shadowMap.enabled,autoUpdate:renderer.shadowMap.autoUpdate,needsUpdate:renderer.shadowMap.needsUpdate}:null};
  const pixels=new Uint8Array(width*height*4),views=[];
  try{
    renderer.autoClear=true;renderer.toneMapping=THREE.NoToneMapping;renderer.outputColorSpace=THREE.LinearSRGBColorSpace;renderer.setClearColor(0,0);renderer.setScissorTest(false);if(renderer.shadowMap)renderer.shadowMap.enabled=false;
    for(const elevation of [5,25,65])for(const azimuth of [0,90,180,270]){
      const e=elevation*Math.PI/180,a=azimuth*Math.PI/180;camera.position.set(-6+60*Math.cos(e)*Math.sin(a),8+60*Math.sin(e),-4+60*Math.cos(e)*Math.cos(a));camera.lookAt(-6,8,-4);camera.updateMatrixWorld();
      const metrics=[];
      for(const geometry of [legacy,transport]){
        proxy.geometry=geometry;renderer.setRenderTarget(target);renderer.render(scene,camera);renderer.readRenderTargetPixels(target,0,0,width,height,pixels);
        let coverage=0,occupiedPixels=0,opaquePixels=0;const histogram=new Uint32Array(256);
        for(let i=3;i<pixels.length;i+=4){const alpha=pixels[i];coverage+=alpha/255;histogram[alpha]++;if(alpha>0)occupiedPixels++;if(alpha===255)opaquePixels++;}
        metrics.push({coveragePixelSum:coverage,coverageFraction:coverage/(width*height),occupiedPixels,opaquePixels,alphaHistogram:Array.from(histogram)});
      }
      views.push({elevation,azimuth,camera:camera.position.toArray(),target:[-6,8,-4],legacy:metrics[0],transport:metrics[1],coverageRatio:metrics[1].coveragePixelSum/metrics[0].coveragePixelSum});
    }
    return {date:new Date().toISOString(),status:views.every(v=>Number.isFinite(v.coverageRatio)&&v.legacy.coveragePixelSum>0&&v.transport.coveragePixelSum>0)?'measured':'failed',views,actualRT:{width,height,format:'RGBA8',requestedSamples,maximumSamples,supportedRGBA8Samples:Array.from(gl.getInternalformatParameter(gl.RENDERBUFFER,gl.RGBA8,gl.SAMPLES)||[])},focalMm:28,originalModeRestored:grove.userData.palmFrameMode===originalMode,
      limits:['Rest positions only, no wind/SSS/normal maps/GI/sky or temporal AA; full-scene beauty and moving raster require root A/B','Unlit actual MSAA pinna silhouette with depth occlusion; no trunks/shrubs and no FPS claim','RGBA8 resolved alpha quantizes fractional coverage; requested samples may round to hardware support','Coverage change is a diagnostic, not an automatic pass criterion for realism']};
  }finally{
    grove.userData.setPalmFrameMode(originalMode);renderer.autoClear=saved.autoClear;renderer.toneMapping=saved.toneMapping;renderer.outputColorSpace=saved.outputColorSpace;renderer.setClearColor(saved.colour,saved.alpha);if(saved.shadow)Object.assign(renderer.shadowMap,saved.shadow);renderer.setViewport(saved.viewport);renderer.setScissor(saved.scissor);renderer.setScissorTest(saved.test);
    if(saved.target){const viewport=saved.target.viewport.clone();try{saved.target.viewport.copy(saved.currentViewport);renderer.setRenderTarget(saved.target,saved.face,saved.mip);}finally{saved.target.viewport.copy(viewport);}}else renderer.setRenderTarget(null,saved.face,saved.mip);
    scene.remove(proxy);material.dispose();target.dispose();
  }
}
