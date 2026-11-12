import {getFireworkSourceBound} from '../../fireworks.js';

// Real production material/attributes, independent Float32 target readback.
// Known sources replace only an owned effect's instance buffer; no app state.
export function runFireworksBoundGPUCheck(THREE,renderer,createFireworks){
  const previous=renderer.getRenderTarget(),face=renderer.getActiveCubeFace(),mip=renderer.getActiveMipmapLevel(),clear=renderer.getClearColor(new THREE.Color()).clone(),alpha=renderer.getClearAlpha(),auto=renderer.autoClear,shadowAuto=renderer.shadowMap.autoUpdate,shadowDirty=renderer.shadowMap.needsUpdate;
  const effect=createFireworks(THREE,{origin:[0,0,0],terrainHeight:()=>0,seed:17}),width=384,height=288,target=new THREE.WebGLRenderTarget(width,height,{type:THREE.FloatType,depthBuffer:false}),camera=new THREE.PerspectiveCamera(140,width/height,.1,10000),results=[];
  const raw=3.6e-5,optics={width,height,dof:false,focalMm:28,aperture:8,focusMetres:100,sensorHeightMm:24,shutterSeconds:1/120,vignette:false};
  const check=(name,passed,detail)=>results.push({name,passed,detail});
  const source=(patch={})=>({position:[0,0,-.15],velocity:[0,0,0],stretch:[0,0,0],colour:[.48469855,0,12.42317296],radius:.03,intensity:10,unmodulatedIntensity:10,...patch});
  function drawSources(sources){
    camera.updateMatrixWorld();effect.render({renderer,target,camera,frame:{storageEV:0,rawPerCandela:raw},optics,air:{enabled:false}});
    const mesh=effect.effectsScene.children[0],geometry=mesh.geometry;
    sources.forEach((s,k)=>{for(const [name,data]of Object.entries({aCentre:s.position,aVelocity:s.velocity,aStretch:s.stretch,aColour:s.colour,aShape:[0,s.radius,s.unmodulatedIntensity,0],aSmokeLight:[0,0,0],aTemporal0:[1,1,1,1],aTemporal1:[1,1,1,1]})){const a=geometry.getAttribute(name);a.array.set(data,k*a.itemSize);a.needsUpdate=true;}});
    geometry.instanceCount=sources.length;renderer.setRenderTarget(target);renderer.setClearColor(0,0);renderer.clear();renderer.render(effect.effectsScene,camera);
    const data=new Float32Array(width*height*4);renderer.readRenderTargetPixels(target,0,0,width,height,data);
    const bounds=sources.map(s=>getFireworkSourceBound(s,camera,optics,raw)),budget=bounds.reduce((sum,b)=>sum+b.peak,0)*1.2;
    let peak=0,nonfinite=0,litPixels=0,escapedPixels=0;
    for(let y=0;y<height;y++)for(let x=0;x<width;x++){const i=(y*width+x)*4;let p=0;for(let c=0;c<3;c++){if(!Number.isFinite(data[i+c]))nonfinite++;else p=Math.max(p,data[i+c]);}peak=Math.max(peak,p);if(p>1e-12){litPixels++;if(!bounds.some(b=>x+.5>=b.rect[0]&&x+.5<=b.rect[2]&&y+.5>=b.rect[1]&&y+.5<=b.rect[3]))escapedPixels++;}}
    const oldBound=sources.reduce((sum,s)=>{const v=new THREE.Vector3(...s.position).project(camera),P=camera.projectionMatrix.elements,d=Math.max(s.radius,new THREE.Vector3(...s.position).distanceTo(camera.position)),omega=4/(width*height*Math.abs(P[0]*P[5]))/(1+(v.x/P[0])**2+(v.y/P[5])**2)**1.5,I=s.unmodulatedIntensity*Math.max(...s.colour);return sum+Math.min(I/(Math.PI*s.radius*s.radius)*1.02,I/(d*d*omega))*raw;},0)*1.2;
    return{peak,budget,ratio:peak/Math.max(budget,1e-30),nonfinite,litPixels,escapedPixels,bounds,legacySphericalBudget:oldBound,legacyFailureRatio:peak/Math.max(oldBound,1e-30)};
  }
  try{
    renderer.autoClear=false;renderer.shadowMap.autoUpdate=false;renderer.shadowMap.needsUpdate=false;renderer.getContext().getExtension('EXT_float_blend');camera.position.set(0,0,0);camera.lookAt(0,0,-1);camera.updateMatrixWorld();effect.update({time:0});effect.launch();effect.update({time:.2});
    const centred=drawSources([source()]);check('actual_resolved_on_axis_pixel_peak_fits_budget',centred.litPixels>0&&centred.nonfinite===0&&centred.peak<=centred.budget&&centred.escapedPixels===0,centred);
    const offAxis=drawSources([source({position:[.45,0,-.15]})]);check('actual_resolved_off_axis_blue_peak_fits_budget',offAxis.litPixels>0&&offAxis.nonfinite===0&&offAxis.peak<=offAxis.budget&&offAxis.escapedPixels===0,offAxis);
    check('fixture_reproduces_old_spherical_ceiling_failure',offAxis.legacyFailureRatio>1.05,{oldBudget:offAxis.legacySphericalBudget,actual:offAxis.peak,newBudget:offAxis.budget,oldFailureRatio:offAxis.legacyFailureRatio,scope:'same real shader, deliberately resolved off-axis blue source; not synthetic-only formula agreement'});
    const nearHead=drawSources([source({position:[.08,.015,-.15],velocity:[6,0,24],radius:.003})]);check('near_crossing_head_uses_full_viewport_and_contains_actual_pixels',nearHead.litPixels>0&&nearHead.nonfinite===0&&nearHead.peak<=nearHead.budget&&nearHead.escapedPixels===0&&nearHead.bounds[0].nearPlaneFallback&&nearHead.bounds[0].rect.join(',')===[0,0,width,height].join(','),nearHead);
    const nearTail=drawSources([source({position:[.08,.015,-.15],velocity:[-3,1,6],stretch:[.12,0,.18],radius:.0018})]);check('independent_stretch_and_shutter_near_crossing_fits_budget',nearTail.litPixels>0&&nearTail.nonfinite===0&&nearTail.peak<=nearTail.budget&&nearTail.escapedPixels===0&&nearTail.bounds[0].nearPlaneFallback,nearTail);
    const overlap=drawSources([source({position:[.45,0,-.15]}),source({position:[.451,0,-.15]}),source({position:[.45,.001,-.15]})]);check('additive_overlapping_RGB_sources_fit_summed_budget',overlap.litPixels>0&&overlap.nonfinite===0&&overlap.peak<=overlap.budget&&overlap.escapedPixels===0,overlap);
    // Exercise the production record -> overlap-bin aggregator too, rather
    // than checking only its shared single-source component.
    camera.fov=70;camera.near=.1;camera.updateProjectionMatrix();camera.position.set(-176,155,-119);camera.lookAt(0,120,0);camera.updateMatrixWorld();effect.configure({elevation:80});effect.update({time:7.2,windVector:[5,0,1]});
    const aggregated=effect.getRadianceBound({camera,optics,rawPerCandela:raw});renderer.setRenderTarget(target);renderer.setClearColor(0,0);renderer.clear();effect.render({renderer,target,camera,frame:{storageEV:0,rawPerCandela:raw},optics,air:{enabled:false}});
    const actual=new Float32Array(width*height*4);renderer.readRenderTargetPixels(target,0,0,width,height,actual);let peak=0,nonfinite=0;for(let i=0;i<actual.length;i++){if(!Number.isFinite(actual[i]))nonfinite++;else if(i%4!==3)peak=Math.max(peak,actual[i]);}check('production_records_and_overlap_bins_fit_actual_GPU_frame',peak>0&&nonfinite===0&&peak<=aggregated.maximumRawRadiance,{actualPeak:peak,budget:aggregated,nonfinite});
    return{date:new Date().toISOString(),passed:results.every(t=>t.passed),passedCount:results.filter(t=>t.passed).length,total:results.length,results,conditions:{width,height,storageEV:0,rawPerCandela:raw,float32:true},scope:'real runtime GPU peak/footprint compared with CPU storage budget; no display exposure, no scene FPS; ambient/air/receiver additions remain root budgets'};
  }finally{effect.dispose();target.dispose();renderer.setRenderTarget(previous,face,mip);renderer.setClearColor(clear,alpha);renderer.autoClear=auto;renderer.shadowMap.autoUpdate=shadowAuto;renderer.shadowMap.needsUpdate=shadowDirty;}
}
