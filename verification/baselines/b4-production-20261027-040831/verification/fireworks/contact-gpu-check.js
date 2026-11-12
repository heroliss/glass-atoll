// Ten actual production effect renders, not an offline particle illustration.
// The caller owns the browser; this helper creates/disposes only its own
// effects, camera and Float32 target. No runtime settings or sound are touched.
export async function runFireworksContactCheck(THREE,renderer,createFireworks,{size=512,capture=true}={}){
  size=Math.max(256,Math.min(768,Math.round(size)));
  const cameraEV=16.5,rawPerCandela=3.6e-5,seed=14271,trailSegments=8,wind=[0,0,0];
  const stages={peony:1.05,chrysanthemum:1.35,willow:4.8,palm:2.0,ring:1.1,heart:1.1,crossette:1.28,strobe:1.45,fan:1.25,bouquet:.9};
  const reasons={peony:'spherical star expansion; no authored ember tail',chrysanthemum:'expanded sphere with persistent detached-ember tails',willow:'late falling stage, long-lived dense gold embers',palm:'sparse heavy arms, larger physical flame radius',ring:'front-facing planar hollow ring',heart:'front-facing planar lobes and lower point',crossette:'0.78s parent split followed by0.50s child expansion',strobe:'one phase of asynchronous2.3–4.7Hz stars; extra actual time samples supplied',fan:'1.25s after launch; all nine sequential ground comets launched, not an aerial apex',bouquet:'0.90s after ground launch; ascending broad cone, not an aerial apex'};
  const gl=renderer.getContext(),previous=renderer.getRenderTarget(),face=renderer.getActiveCubeFace(),mip=renderer.getActiveMipmapLevel(),clear=renderer.getClearColor(new THREE.Color()).clone(),alpha=renderer.getClearAlpha(),auto=renderer.autoClear,shadowAuto=renderer.shadowMap.autoUpdate,shadowDirty=renderer.shadowMap.needsUpdate;
  const physicalViewport=new THREE.Vector4(...gl.getParameter(gl.VIEWPORT)),physicalScissor=new THREE.Vector4(...gl.getParameter(gl.SCISSOR_BOX)),scissorTest=gl.isEnabled(gl.SCISSOR_TEST);
  const target=new THREE.WebGLRenderTarget(size,size,{type:THREE.FloatType,depthBuffer:false}),camera=new THREE.PerspectiveCamera(42,1,.1,30000),frames=[],results=[],descriptors=[];
  const optics={width:size,height:size,focalMm:48,aperture:8,focusMetres:200,sensorHeightMm:36,dof:false,shutterSeconds:1/120,vignette:false};
  camera.filmGauge=36;camera.setFocalLength(48);
  let effect=null,types=[],shaderSource='';
  function draw(time,P){
    effect.update({time,windVector:wind});renderer.setRenderTarget(target);renderer.setClearColor(0,0);renderer.clear();effect.render({renderer,target,camera,frame:{time,storageEV:P,sceneScale:2**P,rawPerCandela},optics,air:{enabled:false}});
    const pixels=new Float32Array(size*size*4);renderer.readRenderTargetPixels(target,0,0,size,size,pixels);return pixels;
  }
  function uploadedGeometry(){
    const mesh=effect.effectsScene.children[0],g=mesh.geometry,n=g.instanceCount,positions=g.getAttribute('aCentre').array,stretch=g.getAttribute('aStretch').array,shape=g.getAttribute('aShape').array,t0=g.getAttribute('aTemporal0').array,t1=g.getAttribute('aTemporal1').array;
    const min=[Infinity,Infinity,Infinity],max=[-Infinity,-Infinity,-Infinity],headMin=[...min],headMax=[...max];let heads=0,tails=0,smoke=0,emittingHeads=0,emittingTails=0,Ihead=0,Itail=0,sourceHeightSum=0,sourceWeight=0;
    for(let i=0;i<n;i++){
      if(shape[i*4]>.5){smoke++;continue;}const isTail=stretch.subarray(i*3,i*3+3).some(x=>Math.abs(x)>1e-6),intensity=shape[i*4+2],radius=shape[i*4+1];let emission=0;for(let k=0;k<4;k++)emission+=(t0[i*4+k]+t1[i*4+k])/8;
      if(isTail){tails++;if(emission>1e-6)emittingTails++;Itail+=intensity*emission;}else{heads++;if(emission>1e-6)emittingHeads++;Ihead+=intensity*emission;}
      sourceHeightSum+=positions[i*3+1]*intensity*emission;sourceWeight+=intensity*emission;
      // Fit uses all unmodulated stars, so a strobe's camera does not zoom
      // according to which subset happens to be on. Smoke is not a fit guide.
      for(let c=0;c<3;c++){const pad=radius+Math.abs(stretch[i*3+c])*.5;min[c]=Math.min(min[c],positions[i*3+c]-pad);max[c]=Math.max(max[c],positions[i*3+c]+pad);if(!isTail){headMin[c]=Math.min(headMin[c],positions[i*3+c]);headMax[c]=Math.max(headMax[c],positions[i*3+c]);}}
    }
    return{min,max,extent:max.map((v,c)=>v-min[c]),headExtent:headMax.map((v,c)=>v-headMin[c]),headInstances:heads,tailInstances:tails,smokeInstances:smoke,emittingHeads,emittingTails,referenceCandelaAtPhase:{heads:Ihead,tails:Itail},sourceHeightWeightedMetres:sourceHeightSum/Math.max(sourceWeight,1e-20)};
  }
  function analyse(pixels,P){
    const scale=2**P,projection=camera.projectionMatrix.elements,grid=new Float64Array(32*32),physicalRGBIntegral=[0,0,0];let nonfinite=0,negative=0,peak=0,lit=0,edgeLight=0,sum=0,sumX=0,sumY=0,sumXX=0,sumYY=0;
    for(let y=0;y<size;y++)for(let x=0;x<size;x++){
      const i=(y*size+x)*4,r=pixels[i]/scale,g=pixels[i+1]/scale,b=pixels[i+2]/scale;for(let c=0;c<4;c++){if(!Number.isFinite(pixels[i+c]))nonfinite++;else if(pixels[i+c]<-1e-8)negative++;}peak=Math.max(peak,r,g,b);
      const Y=Math.max(0,.2126*r+.7152*g+.0722*b),nx=(x+.5)/size*2-1,ny=(y+.5)/size*2-1,omega=4/(size*size*projection[0]*projection[5])/(1+(nx/projection[0])**2+(ny/projection[5])**2)**1.5;
      physicalRGBIntegral[0]+=r*omega;physicalRGBIntegral[1]+=g*omega;physicalRGBIntegral[2]+=b*omega;sum+=Y;sumX+=Y*x;sumY+=Y*y;sumXX+=Y*x*x;sumYY+=Y*y*y;grid[Math.min(31,Math.floor(y/size*32))*32+Math.min(31,Math.floor(x/size*32))]+=Y;
      if(Y>1e-12){lit++;if(x<2||y<2||x>=size-2||y>=size-2)edgeLight+=Y;}
    }
    if(sum>0)for(let i=0;i<grid.length;i++)grid[i]/=sum;
    const cx=sumX/Math.max(sum,1e-30),cy=sumY/Math.max(sum,1e-30),sdX=Math.sqrt(Math.max(0,sumXX/Math.max(sum,1e-30)-cx*cx)),sdY=Math.sqrt(Math.max(0,sumYY/Math.max(sum,1e-30)-cy*cy));
    return{public:{nonfinite,negative,rawPeakRGB:peak,storedPeakRGB:peak*scale,nonzeroPixels:lit,outer2PixelLuminanceFraction:edgeLight/Math.max(sum,1e-30),physicalRGBSolidAngleIntegral:physicalRGBIntegral,physicalYSolidAngleIntegral:.2126*physicalRGBIntegral[0]+.7152*physicalRGBIntegral[1]+.0722*physicalRGBIntegral[2],imageLuminanceCentroidPixels:[cx,cy],imageLuminanceStdPixels:[sdX,sdY]},grid};
  }
  try{
    renderer.autoClear=false;renderer.shadowMap.autoUpdate=false;renderer.shadowMap.needsUpdate=false;gl.getExtension('EXT_float_blend');
    // All synchronous GPU work finishes before asynchronous PNG conversion:
    // an app RAF cannot interleave while renderer state is borrowed.
    const first=createFireworks(THREE,{terrainHeight:()=>0,origin:[0,0,0],seed});types=first.types.map(t=>({...t}));first.dispose();
    for(const type of types){
      effect=createFireworks(THREE,{terrainHeight:()=>0,origin:[0,0,0],seed});effect.setQuality({trailSegments});effect.configure({type:type.id,autoDirection:false,azimuth:0,elevation:80,autoLaunch:false});effect.update({time:0,windVector:wind});const launch=effect.launch({type:type.id,seed});
      const age=stages[type.id],time=launch.burstTime+age;
      camera.position.set(0,type.height,1000);camera.lookAt(0,type.height,0);camera.updateMatrixWorld();draw(time,0);
      const geometry=uploadedGeometry(),centre=geometry.min.map((v,c)=>(v+geometry.max[c])*.5),radius=Math.hypot(...geometry.extent)*.5,distance=Math.max(60,radius/Math.sin(camera.fov*Math.PI/360)*1.20),direction=new THREE.Vector3(0,.12,1).normalize();
      camera.position.fromArray(centre).addScaledVector(direction,distance);camera.lookAt(...centre);camera.updateMatrixWorld();optics.focusMetres=distance;
      const bound=effect.getRadianceBound({camera,optics,rawPerCandela}),P=Math.max(-24,Math.min(21,Math.floor(Math.log2(4096/Math.max(bound.maximumRawRadiance,1e-20))))),pixels=draw(time,P),analysis=analyse(pixels,P),meta={id:type.id,label:type.label,seed,stage:{time,burstTime:launch.burstTime,secondsAfterBurst:age,reason:reasons[type.id]},definition:{authoredHeightMetres:type.height,nominalBurnSeconds:type.burn,logicalPrimaryCount:type.count},geometry,camera:{position:camera.position.toArray(),target:centre,distanceMetres:distance,fovDegrees:camera.fov,focalMm:48,sensorHeightMm:36,commonViewDirection:direction.toArray(),fit:'unmodulated emitter centre/stretch bbox sphere;1.20 margin; smoke excluded; per-type distance, not same metric scale'},exposure:{cameraEV,storageEV:P,rawPerCandela,storedBudget:bound.maximumRawRadiance*2**P,budgetMethod:bound.method},...analysis.public};
      results.push({name:type.id+'_actual_production_shader_finite_nonzero_unclipped',passed:meta.nonfinite===0&&meta.negative===0&&meta.nonzeroPixels>0&&meta.rawPeakRGB>0&&meta.outer2PixelLuminanceFraction<.001,detail:{nonfinite:meta.nonfinite,negative:meta.negative,nonzeroPixels:meta.nonzeroPixels,outer2PixelLuminanceFraction:meta.outer2PixelLuminanceFraction}});frames.push({id:type.id,pixels,P,meta});descriptors.push({id:type.id,grid:analysis.grid});
      const material=effect.effectsScene.children[0].material;if(!shaderSource)shaderSource=material.vertexShader+'\n'+material.fragmentShader;
      if(type.id==='strobe')for(const delta of [.08,.16]){const t=time+delta,extra=draw(t,P),a=analyse(extra,P);frames.push({id:'strobe_'+delta.toFixed(2),pixels:extra,P,meta:{...meta,id:'strobe_'+delta.toFixed(2),stage:{...meta.stage,time:t,secondsAfterBurst:age+delta},geometry:uploadedGeometry(),...a.public}});}
      effect.dispose();effect=null;
    }
  }finally{
    effect?.dispose();target.dispose();renderer.setRenderTarget(previous,face,mip);renderer.setClearColor(clear,alpha);renderer.autoClear=auto;renderer.shadowMap.autoUpdate=shadowAuto;renderer.shadowMap.needsUpdate=shadowDirty;
    // Restore physical GL viewport/scissor through Three's own state cache;
    // setViewport() would apply DPR again to a render-target viewport.
    renderer.state.viewport(physicalViewport);renderer.state.scissor(physicalScissor);renderer.state.setScissorTest(scissorTest);
  }
  const pairwise=[];for(let i=0;i<descriptors.length;i++)for(let j=i+1;j<descriptors.length;j++){let d=0;for(let k=0;k<1024;k++)d+=Math.abs(descriptors[i].grid[k]-descriptors[j].grid[k]);pairwise.push({a:descriptors[i].id,b:descriptors[j].id,normalizedLuminanceImageL1:d*.5});}
  const mainFrames=frames.filter(f=>!f.id.startsWith('strobe_')),strobeFrames=frames.filter(f=>f.id==='strobe'||f.id.startsWith('strobe_'));
  const strobeDifferences=strobeFrames.slice(1).map(f=>{const base=strobeFrames[0],scaleA=2**base.P,scaleB=2**f.P;let d=0,normalization=0;for(let i=0;i<f.pixels.length;i++)if(i%4!==3){d+=Math.abs(f.pixels[i]/scaleB-base.pixels[i]/scaleA);normalization+=Math.abs(base.pixels[i]/scaleA);}return{secondsAfterMain:f.meta.stage.time-base.meta.stage.time,relativeAbsoluteRGBDifference:d/Math.max(normalization,1e-30),emittingHeads:f.meta.geometry.emittingHeads,energyRatio:f.meta.physicalYSolidAngleIntegral/base.meta.physicalYSolidAngleIntegral};});
  results.push({name:'all_ten_runtime_type_ids_captured_once',passed:mainFrames.length===10&&new Set(mainFrames.map(f=>f.id)).size===10});
  results.push({name:'strobe_same_camera_fixed_C_has_actual_temporal_change',passed:strobeDifferences.every(d=>d.relativeAbsoluteRGBDifference>.01),detail:strobeDifferences});
  // Vendor Three0.180 ACESFilmicToneMapping matrices/RRT fit, then sRGB.
  // This is a fixed-C SDR preview, not the app's extended-HDR monitor bridge.
  function aces(r,g,b){const a=[.59719*r+.35458*g+.04823*b,.076*r+.90834*g+.01566*b,.0284*r+.13383*g+.83777*b].map(v=>(v*(v+.0245786)-.000090537)/(v*(.983729*v+.432951)+.238081));return[1.60475*a[0]-.53108*a[1]-.07367*a[2],-.10208*a[0]+1.10813*a[1]-.00605*a[2],-.00327*a[0]-.07276*a[1]+1.07602*a[2]];}
  function canvasFor(frame){const canvas=new OffscreenCanvas(size,size),ctx=canvas.getContext('2d'),image=ctx.createImageData(size,size),gain=.76*2**(cameraEV-frame.P)/.6;for(let y=0;y<size;y++)for(let x=0;x<size;x++){const src=(y*size+x)*4,dst=((size-1-y)*size+x)*4,c=aces(frame.pixels[src]*gain,frame.pixels[src+1]*gain,frame.pixels[src+2]*gain);for(let k=0;k<3;k++){let v=Math.max(0,Math.min(1,c[k]));v=v<=.0031308?v*12.92:1.055*v**(1/2.4)-.055;image.data[dst+k]=Math.round(v*255);}image.data[dst+3]=255;}ctx.putImageData(image,0,0);return canvas;}
  async function png(canvas){const blob=await canvas.convertToBlob({type:'image/png'});return await new Promise(resolve=>{const reader=new FileReader();reader.onload=()=>resolve(reader.result);reader.readAsDataURL(blob);});}
  const images={};if(capture){
    const canvases=new Map(frames.map(f=>[f.id,canvasFor(f)]));for(const frame of mainFrames)images[frame.id]=await png(canvases.get(frame.id));
    const tile=256,label=54,header=45,contact=new OffscreenCanvas(tile*5,header+(tile+label)*2),ctx=contact.getContext('2d');ctx.fillStyle='#000';ctx.fillRect(0,0,contact.width,contact.height);ctx.fillStyle='#ddd';ctx.font='15px "Microsoft YaHei",sans-serif';ctx.fillText('实际生产GPU效果层 · C16.5 · 同方向/按米制尺寸fit · 非整岛截图/性能',12,27);
    mainFrames.forEach((f,i)=>{const x=i%5*tile,y=header+Math.floor(i/5)*(tile+label);ctx.drawImage(canvases.get(f.id),x,y,tile,tile);ctx.fillStyle='#eee';ctx.font='16px "Microsoft YaHei",sans-serif';ctx.fillText(f.meta.label+' / '+f.id,x+8,y+tile+19);ctx.fillStyle='#aaa';ctx.font='12px sans-serif';ctx.fillText(`+${f.meta.stage.secondsAfterBurst.toFixed(2)}s · span ${f.meta.geometry.extent[0].toFixed(1)}×${f.meta.geometry.extent[1].toFixed(1)}m · d${f.meta.camera.distanceMetres.toFixed(0)}m`,x+8,y+tile+39);});images.contact=await png(contact);
    const strip=new OffscreenCanvas(size*3,size+38),sctx=strip.getContext('2d');sctx.fillStyle='#000';sctx.fillRect(0,0,strip.width,strip.height);strobeFrames.forEach((f,i)=>{sctx.drawImage(canvases.get(f.id),i*size,0);sctx.fillStyle='#ccc';sctx.font='16px sans-serif';sctx.fillText(`strobe +${f.meta.stage.secondsAfterBurst.toFixed(2)}s · ${f.meta.geometry.emittingHeads}/${f.meta.geometry.headInstances} on`,i*size+12,size+25);});images.strobeSequence=await png(strip);
  }
  const hash=async text=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(text))),x=>x.toString(16).padStart(2,'0')).join('');
  return{date:new Date().toISOString(),passed:results.every(r=>r.passed),total:results.length,passedCount:results.filter(r=>r.passed).length,results,conditions:{size,seed,trailSegments,cameraEV,shutterSeconds:1/120,wind,air:false,dof:false,vignette:false,bloom:false,colour:'actual production per-type defaults; no hue replacement',storage:'per-view safe P from actual source budget; divided out before fixed-C display'},shaderSHA256:await hash(shaderSource),types:mainFrames.map(f=>f.meta),strobe:{frames:strobeFrames.map(f=>({time:f.meta.stage.time,emittingHeads:f.meta.geometry.emittingHeads,energy:f.meta.physicalYSolidAngleIntegral})),differences:strobeDifferences},pairwiseImageDifferences:pairwise,images,limits:['isolated production effects scene on black with its own grey smoke; no island/water/sky/cloud occlusion or global bloom','C16.5 fixed; image sizes fit each real emitter bbox so equal image size is not equal world size; all distances and metre bounds recorded','pairwise normalized image L1 includes phase/view-fit sampling; it measures actual images, not a scientific morphology classifier','three stills demonstrate strobe state changes, not subjective continuous video viewing','no sound played or subjective audio acceptance; no full-scene FPS or frame-time claims']};
}
