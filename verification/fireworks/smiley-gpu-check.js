// Caller must pause the application before invoking this isolated fixture.
// All borrowed-renderer GPU work is synchronous, with finally restoration;
// PNG encoding starts only after restoration. Black-background effects only:
// these are not whole-island screenshots, performance or audio acceptance.
// `smileyLayout` selects the physical event for the original18 checks. Every
// invocation also renders all four single-colour front views at fixed C/P,
// time, position and distance, with no energy/size normalization between them.
export async function runSmileyGPUCheck(THREE,renderer,createFireworks,{size=640,capture=true,smileyLayout='reference'}={}){
  const layouts=['dense','spaced-mouth','compact-eyes','reference'];
  if(!layouts.includes(smileyLayout))throw new Error('Unknown QA smileyLayout: '+smileyLayout);
  const expectedStars=layout=>layout==='spaced-mouth'||layout==='reference'?120:144;
  size=Math.max(320,Math.min(768,Math.round(size)));
  const gl=renderer.getContext(),extensions={floatColour:!!gl.getExtension('EXT_color_buffer_float'),floatBlend:!!gl.getExtension('EXT_float_blend')};
  if(!extensions.floatColour||!extensions.floatBlend)throw new Error('Smiley QA requires EXT_color_buffer_float and EXT_float_blend; no silent nonblended substitute.');
  const previous=renderer.getRenderTarget(),face=renderer.getActiveCubeFace(),mip=renderer.getActiveMipmapLevel();
  const saved={viewport:renderer.getViewport(new THREE.Vector4()),scissor:renderer.getScissor(new THREE.Vector4()),scissorTest:renderer.getScissorTest(),actualViewport:new THREE.Vector4().fromArray(gl.getParameter(gl.VIEWPORT)),actualScissor:new THREE.Vector4().fromArray(gl.getParameter(gl.SCISSOR_BOX)),actualScissorTest:gl.isEnabled(gl.SCISSOR_TEST),
    clear:renderer.getClearColor(new THREE.Color()).clone(),alpha:renderer.getClearAlpha(),autoClear:renderer.autoClear,autoClearColor:renderer.autoClearColor,autoClearDepth:renderer.autoClearDepth,autoClearStencil:renderer.autoClearStencil,toneMapping:renderer.toneMapping,exposure:renderer.toneMappingExposure,outputColorSpace:renderer.outputColorSpace,xr:renderer.xr.enabled,
    shadow:{enabled:renderer.shadowMap.enabled,autoUpdate:renderer.shadowMap.autoUpdate,needsUpdate:renderer.shadowMap.needsUpdate}};
  const metadata=previous?{viewport:previous.viewport.clone(),scissor:previous.scissor.clone(),scissorTest:previous.scissorTest}:null;
  const target=new THREE.WebGLRenderTarget(size,size,{type:THREE.FloatType,format:THREE.RGBAFormat,depthBuffer:true});target.texture.colorSpace=THREE.NoColorSpace;
  const camera=new THREE.PerspectiveCamera(42,1,.1,30000);camera.filmGauge=36;camera.setFocalLength(48);
  const checks=[],check=(name,passed,evidence)=>checks.push({name,passed:!!passed,evidence}),frames=[],seed=14271,origin=[0,.7,0],wind=[0,0,0],cameraEV=16.5,storageEV=0,rawPerCandela=3.6e-5;
  const optics={width:size,height:size,focalMm:48,aperture:8,focusMetres:260,sensorHeightMm:36,dof:false,vignette:false,shutterSeconds:1/120};
  let effect=null,twoTone=null,layoutEffect=null,time=null,launch=null,centre=null,basePhysical=null,baseCount=null,shaderMain='',shaderMirror='',blockerGeometry=null,blockerMaterial=null;
  const hashText=text=>{let h=2166136261;for(let i=0;i<text.length;i++)h=Math.imul(h^text.charCodeAt(i),16777619);return(h>>>0).toString(16).padStart(8,'0');};
  function create(palette,layout=smileyLayout){
    const e=createFireworks(THREE,{origin,terrainHeight:()=>0,seed});e.setQuality({trailSegments:8});e.configure({type:'ring',autoDirection:false,azimuth:0,elevation:80,autoLaunch:false,smileyLayout:layout});e.update({time:0,windVector:wind});
    const event=e.launch({type:'ring',seed,smileyLayout:layout,...(palette?{palette}:{})});e.update({time:event.burstTime+1.1,windVector:wind});return{effect:e,event,time:event.burstTime+1.1};
  }
  function geometryState(e){
    const mesh=e.effectsScene.children.find(x=>x.isMesh),g=mesh.geometry,n=g.instanceCount,attrs=Object.fromEntries(['aCentre','aVelocity','aStretch','aShape','aColour'].map(k=>[k,g.getAttribute(k)])),rows=[],starPoints=[];
    let stars=0,smoke=0,sumUploadedUnmodulatedCandela=0;const min=[Infinity,Infinity,Infinity],max=[-Infinity,-Infinity,-Infinity];
    for(let i=0;i<n;i++){
      const row=[];for(const name of ['aCentre','aVelocity','aStretch','aShape']){const a=attrs[name];for(let c=0;c<a.itemSize;c++)row.push(a.array[i*a.itemSize+c]);}rows.push(row.join(','));
      const p=Array.from(attrs.aCentre.array.subarray(i*3,i*3+3));
      if(attrs.aShape.array[i*4]>.5){smoke++;continue;}stars++;sumUploadedUnmodulatedCandela+=attrs.aShape.array[i*4+2];starPoints.push(p);for(let c=0;c<3;c++){min[c]=Math.min(min[c],p[c]);max[c]=Math.max(max[c],p[c]);}
    }
    // Sorting differs by camera; exact sorted row strings compare actual
    // uploaded Float32 positions/velocities/physical shapes, not order hashes.
    const canonical=rows.sort().join(';');return{canonical,public:{instances:n,stars,smoke,sumUploadedUnmodulatedCandela,physicalFNV32:hashText(canonical),minimumMetres:min,maximumMetres:max,spanMetres:max.map((x,c)=>x-min[c]),planeZSpanMetres:max[2]-min[2]},starPoints,mesh};
  }
  function analyse(pixels,P){
    let nonfinite=0,negative=0,peak=0,totalY=0,edgeY=0,nonzero=0,minX=size,maxX=-1;
    for(let y=0;y<size;y++)for(let x=0;x<size;x++){
      const i=(y*size+x)*4;for(let c=0;c<4;c++){const v=pixels[i+c];if(!Number.isFinite(v))nonfinite++;if(v<0)negative++;}
      const r=pixels[i],g=pixels[i+1],b=pixels[i+2],Y=r*.2126+g*.7152+b*.0722;peak=Math.max(peak,r,g,b);totalY+=Y;
      if(Y>1e-9){nonzero++;minX=Math.min(minX,x);maxX=Math.max(maxX,x);}if(x<2||y<2||x>=size-2||y>=size-2)edgeY+=Y;
    }
    return{nonfinite,negative,storedPeakRGB:peak,rawPeakRGB:peak/2**P,totalStoredPixelY:totalY,totalRawPixelY:totalY/2**P,nonzeroPixels:nonzero,outer2PixelLuminanceFraction:edgeY/Math.max(totalY,1e-30),visibleWidthPixels:maxX<0?0:maxX-minX+1};
  }
  function draw(e,cam,{P=storageEV,reflection=false,id,keep=true,clear=true}={}){
    renderer.setRenderTarget(target);if(clear)renderer.clear();e.render({renderer,target,camera:cam,reflection,planeY:0,frame:{time,dt:0,storageEV:P,sceneScale:2**P,rawPerCandela},optics:{...optics,shutterSeconds:reflection?0:optics.shutterSeconds},air:{enabled:false}});
    const pixels=new Float32Array(size*size*4);renderer.readRenderTargetPixels(target,0,0,size,size,pixels);const geometry=geometryState(e),stats=analyse(pixels,P),diag=e.diagnostics();
    const meta={id,eventId:diag.activeEvents?.[0]?.id,type:diag.activeEvents?.[0]?.type,pattern:diag.activeEvents?.[0]?.pattern,smileyLayout:diag.activeEvents?.[0]?.smileyLayout,actualStarCount:diag.activeEvents?.[0]?.actualStarCount,time,secondsAfterActualBurst:1.1,storageEV:P,cameraEV,camera:cam.position.toArray(),target:centre,distanceMetres:centre?cam.position.distanceTo(new THREE.Vector3(...centre)):null,focalMm:48,reflection,shutterSeconds:reflection?0:1/120,geometry:geometry.public,stats};
    if(keep)frames.push({id,pixels,P,meta});return{pixels,geometry,stats,meta,diag};
  }
  try{
    renderer.autoClear=false;renderer.autoClearColor=renderer.autoClearDepth=renderer.autoClearStencil=true;renderer.toneMapping=THREE.NoToneMapping;renderer.toneMappingExposure=1;renderer.outputColorSpace=THREE.LinearSRGBColorSpace;renderer.xr.enabled=false;renderer.shadowMap.enabled=false;renderer.shadowMap.autoUpdate=false;renderer.shadowMap.needsUpdate=false;renderer.setClearColor(0,0);renderer.setScissorTest(false);
    const made=create('yellow');effect=made.effect;launch=made.event;time=made.time;
    camera.position.set(0,120,1000);camera.lookAt(0,120,0);camera.updateMatrixWorld();const prime=draw(effect,camera,{id:'prime',keep:false});
    centre=prime.geometry.public.minimumMetres.map((x,c)=>(x+prime.geometry.public.maximumMetres[c])*.5);basePhysical=prime.geometry.canonical;baseCount=prime.geometry.public.instances;
    check('actual_factory_ring_event_matches_selected_layout_at_actual_burst_plus1_1s',prime.geometry.public.stars===expectedStars(smileyLayout)&&prime.diag.activeEvents?.[0]?.actualStarCount===expectedStars(smileyLayout)&&prime.diag.activeEvents?.[0]?.smileyLayout===smileyLayout&&prime.diag.activeEvents?.[0]?.pattern==='smiley'&&launch.id===prime.diag.activeEvents?.[0]?.id,{launch,smileyLayout,expectedStars:expectedStars(smileyLayout),phaseSeconds:time,diagnostic:prime.diag.activeEvents?.[0],geometry:prime.geometry.public});
    const eventSnapshot=JSON.stringify(prime.diag.activeEvents),conditions=[];
    for(const angle of [0,30,60,85,180]){
      const a=angle*Math.PI/180;camera.up.set(0,1,0);camera.position.fromArray(centre).add(new THREE.Vector3(260*Math.sin(a),0,260*Math.cos(a)));camera.lookAt(...centre);camera.updateMatrixWorld();
      const result=draw(effect,camera,{id:'mono_'+angle});shaderMain=result.geometry.mesh.material.vertexShader+'\n'+result.geometry.mesh.material.fragmentShader;
      const projected=result.geometry.starPoints.map(p=>new THREE.Vector3(...p).project(camera)),width=(Math.max(...projected.map(p=>p.x))-Math.min(...projected.map(p=>p.x)))*size*.5;
      result.meta.viewAngleDegrees=angle;result.meta.projectedStarCentreWidthPixels=width;conditions.push(result.meta);
      check(`view_${angle}_actual_GPU_finite_nonzero_inside_frame`,result.stats.nonfinite===0&&result.stats.negative===0&&result.stats.nonzeroPixels>0&&result.stats.outer2PixelLuminanceFraction<.001,{...result.stats});
      check(`view_${angle}_same_uploaded_world_positions_velocities_orientation_and_records`,result.geometry.canonical===basePhysical&&result.geometry.public.instances===baseCount&&result.geometry.public.planeZSpanMetres===0&&JSON.stringify(result.diag.activeEvents)===eventSnapshot,{eventId:result.meta.eventId,geometry:result.geometry.public});
    }
    const front=frames.find(f=>f.id==='mono_0'),side=frames.find(f=>f.id==='mono_85');
    check('edge_view_is_physically_thinner_no_billboard_readability_requirement',side.meta.projectedStarCentreWidthPixels/front.meta.projectedStarCentreWidthPixels<.15,{centreWidthRatio85to0:side.meta.projectedStarCentreWidthPixels/front.meta.projectedStarCentreWidthPixels,expectedOrthographicCosine:Math.cos(85*Math.PI/180),perspectiveAndPSF:'real perspective and raster PSF need not equal orthographic cosine exactly'});
    // Same event and physical time: a new view and storage scale never update
    // or regenerate body state. Re-render front with only P changed.
    camera.up.set(0,1,0);camera.position.fromArray(centre).add(new THREE.Vector3(0,0,260));camera.lookAt(...centre);camera.updateMatrixWorld();
    const higher=draw(effect,camera,{P:storageEV+1,id:'mono_0_Pplus1',keep:false});let error=0,normalization=0;
    for(let i=0;i<front.pixels.length;i++)if(i%4!==3){error+=Math.abs(higher.pixels[i]*.5-front.pixels[i]);normalization+=Math.abs(front.pixels[i]);}
    check('P_plus1_compensated_actual_pixels_are_finite_and_unchanged',higher.stats.nonfinite===0&&higher.stats.negative===0&&error/Math.max(normalization,1e-30)<1e-5&&higher.geometry.canonical===basePhysical,{relativeAbsoluteLinearRGBError:error/Math.max(normalization,1e-30),basePeak:front.meta.stats.storedPeakRGB,higherPeak:higher.stats.storedPeakRGB,compensation:.5});
    const mirror=new THREE.PerspectiveCamera(camera.fov,1,.1,30000);mirror.filmGauge=36;mirror.setFocalLength(48);mirror.position.set(centre[0],-3.5,centre[2]+260);mirror.up.set(0,-1,0);mirror.lookAt(...centre);mirror.updateMatrixWorld();
    const reflected=draw(effect,mirror,{id:'mirror_same_event',reflection:true});shaderMirror=reflected.geometry.mesh.material.vertexShader+'\n'+reflected.geometry.mesh.material.fragmentShader;
    const reflectionVariant={materialDefines:{...reflected.geometry.mesh.material.defines},hasReflectionPassDefine:Object.hasOwn(reflected.geometry.mesh.material.defines||{},'REFLECTION_PASS'),materialDepthTest:reflected.geometry.mesh.material.depthTest,lastRenderReflection:reflected.diag.lastRender.reflection};
    check('reflection_variant_uses_same_event_world_records_and_is_finite',reflected.meta.eventId===launch.id&&reflected.geometry.canonical===basePhysical&&reflected.geometry.public.instances===baseCount&&reflected.stats.nonfinite===0&&reflected.stats.negative===0&&reflected.stats.nonzeroPixels>0&&reflectionVariant.hasReflectionPassDefine&&reflectionVariant.materialDepthTest===true&&reflectionVariant.lastRenderReflection===true,
      {eventId:reflected.meta.eventId,geometry:reflected.geometry.public,stats:reflected.stats,actualVariant:reflectionVariant,observer:'mirror of an above-water3.5m observer aiming at the virtual burst; air disabled, reflection shutter0 is production behavior'});
    // Its own depth attachment is only used for hardware testing: production
    // reflection variant must not sample the attached depth texture.
    blockerGeometry=new THREE.PlaneGeometry(4,4);blockerMaterial=new THREE.MeshBasicMaterial({colorWrite:false,depthWrite:true,toneMapped:false});const blocker=new THREE.Mesh(blockerGeometry,blockerMaterial),blockerScene=new THREE.Scene();
    blocker.position.copy(mirror.position).addScaledVector(mirror.getWorldDirection(new THREE.Vector3()),1);blocker.quaternion.copy(mirror.quaternion);blockerScene.add(blocker);renderer.setRenderTarget(target);renderer.clear();renderer.render(blockerScene,mirror);
    const blocked=draw(effect,mirror,{id:'mirror_blocked',reflection:true,keep:false,clear:false});
    const blockedVariant={materialDefines:{...blocked.geometry.mesh.material.defines},hasReflectionPassDefine:Object.hasOwn(blocked.geometry.mesh.material.defines||{},'REFLECTION_PASS'),materialDepthTest:blocked.geometry.mesh.material.depthTest,lastRenderReflection:blocked.diag.lastRender.reflection};
    check('production_reflection_respects_owned_hardware_depth_blocker',blocked.stats.nonfinite===0&&blocked.stats.totalStoredPixelY<1e-12&&blockedVariant.hasReflectionPassDefine&&blockedVariant.materialDepthTest===true&&blockedVariant.lastRenderReflection===true,{totalStoredPixelY:blocked.stats.totalStoredPixelY,actualVariant:blockedVariant,scope:'opaque depth plane1m ahead; no attached depth sampler bound to reflection variant'});
    const madeTwo=create();twoTone=madeTwo.effect;const two=draw(twoTone,camera,{id:'two_tone_front'});
    check('two_tone_default_has_same_physical_event_as_mono',madeTwo.event.id===launch.id&&madeTwo.time===time&&two.geometry.canonical===basePhysical&&two.stats.nonfinite===0&&two.stats.negative===0&&two.stats.nonzeroPixels>0,{eventId:madeTwo.event.id,paletteMode:two.diag.activeEvents?.[0]?.paletteMode,geometry:two.geometry.public,stats:two.stats});
    twoTone.dispose();twoTone=null;
    // Fixed front camera from the selected layout's outline bbox: every layout
    // retains the same outer72 stars, so no per-image fitting/zoom is applied.
    for(const layout of layouts){
      const madeLayout=create('yellow',layout);layoutEffect=madeLayout.effect;
      const result=draw(layoutEffect,camera,{id:'layout_'+layout});result.meta.layoutComparison=true;
      const event=result.diag.activeEvents?.[0];
      check(`layout_${layout}_front_same_conditions_correct_actual_count_and_finite_GPU`,madeLayout.time===time&&madeLayout.event.id===launch.id&&event?.smileyLayout===layout&&event?.actualStarCount===expectedStars(layout)&&result.geometry.public.stars===expectedStars(layout)&&result.geometry.public.planeZSpanMetres===0&&JSON.stringify(result.meta.camera)===JSON.stringify(front.meta.camera)&&result.stats.nonfinite===0&&result.stats.negative===0&&result.stats.nonzeroPixels>0&&result.stats.outer2PixelLuminanceFraction<.001,{diagnostic:event,geometry:result.geometry.public,stats:result.stats,camera:result.meta.camera,phaseSeconds:madeLayout.time,energyNormalization:false});
      layoutEffect.dispose();layoutEffect=null;
    }
    check('same_P_all_pictured_views_fit_finite_FP16_numeric_range',frames.every(f=>f.meta.stats.storedPeakRGB<65504&&f.meta.stats.nonfinite===0),{storageEV,maximumStoredPeak:Math.max(...frames.map(f=>f.meta.stats.storedPeakRGB)),scope:'Float32 blending/readback proves numeric range only; not a HalfFloat quantization test'});
  }finally{
    effect?.dispose();twoTone?.dispose();layoutEffect?.dispose();blockerGeometry?.dispose();blockerMaterial?.dispose();target.dispose();
    renderer.autoClear=saved.autoClear;renderer.autoClearColor=saved.autoClearColor;renderer.autoClearDepth=saved.autoClearDepth;renderer.autoClearStencil=saved.autoClearStencil;renderer.toneMapping=saved.toneMapping;renderer.toneMappingExposure=saved.exposure;renderer.outputColorSpace=saved.outputColorSpace;renderer.xr.enabled=saved.xr;Object.assign(renderer.shadowMap,saved.shadow);
    renderer.setClearColor(saved.clear,saved.alpha);renderer.setViewport(saved.viewport);renderer.setScissor(saved.scissor);renderer.setScissorTest(saved.scissorTest);
    if(previous){previous.viewport.copy(saved.actualViewport);previous.scissor.copy(saved.actualScissor);previous.scissorTest=saved.actualScissorTest;}
    try{renderer.setRenderTarget(previous,face,mip);}finally{if(previous){previous.viewport.copy(metadata.viewport);previous.scissor.copy(metadata.scissor);previous.scissorTest=metadata.scissorTest;}}
    renderer.state.viewport(saved.actualViewport);renderer.state.scissor(saved.actualScissor);renderer.state.setScissorTest(saved.actualScissorTest);
  }
  const vectorEqual=(a,b)=>a.toArray().every((v,i)=>v===b.getComponent(i));
  check('borrowed_renderer_state_restored',renderer.getRenderTarget()===previous&&renderer.getActiveCubeFace()===face&&renderer.getActiveMipmapLevel()===mip&&vectorEqual(renderer.getViewport(new THREE.Vector4()),saved.viewport)&&vectorEqual(renderer.getScissor(new THREE.Vector4()),saved.scissor)&&renderer.getScissorTest()===saved.scissorTest&&
    Array.from(gl.getParameter(gl.VIEWPORT)).every((v,i)=>v===saved.actualViewport.getComponent(i))&&Array.from(gl.getParameter(gl.SCISSOR_BOX)).every((v,i)=>v===saved.actualScissor.getComponent(i))&&gl.isEnabled(gl.SCISSOR_TEST)===saved.actualScissorTest&&
    renderer.getClearColor(new THREE.Color()).equals(saved.clear)&&renderer.getClearAlpha()===saved.alpha&&renderer.toneMapping===saved.toneMapping&&renderer.toneMappingExposure===saved.exposure&&renderer.outputColorSpace===saved.outputColorSpace&&renderer.xr.enabled===saved.xr&&renderer.autoClear===saved.autoClear&&renderer.autoClearColor===saved.autoClearColor&&renderer.autoClearDepth===saved.autoClearDepth&&renderer.autoClearStencil===saved.autoClearStencil&&Object.entries(saved.shadow).every(([k,v])=>renderer.shadowMap[k]===v));
  // Exact project's vendor Three r180 ACES matrices/fit followed by sRGB.
  // This display transform does not change the raw linear comparisons above.
  function aces(r,g,b){const a=[.59719*r+.35458*g+.04823*b,.076*r+.90834*g+.01566*b,.0284*r+.13383*g+.83777*b].map(v=>(v*(v+.0245786)-.000090537)/(v*(.983729*v+.432951)+.238081));return[1.60475*a[0]-.53108*a[1]-.07367*a[2],-.10208*a[0]+1.10813*a[1]-.00605*a[2],-.00327*a[0]-.07276*a[1]+1.07602*a[2]];}
  function canvasFor(f){const canvas=new OffscreenCanvas(size,size),ctx=canvas.getContext('2d'),img=ctx.createImageData(size,size),gain=.76*2**(cameraEV-f.P)/.6;
    for(let y=0;y<size;y++)for(let x=0;x<size;x++){const i=(y*size+x)*4,j=((size-1-y)*size+x)*4,c=aces(f.pixels[i]*gain,f.pixels[i+1]*gain,f.pixels[i+2]*gain);for(let k=0;k<3;k++){const v=Math.max(0,Math.min(1,c[k]));img.data[j+k]=Math.round(255*(v<=.0031308?12.92*v:1.055*v**(1/2.4)-.055));}img.data[j+3]=255;}ctx.putImageData(img,0,0);return canvas;
  }
  async function png(canvas){const blob=await canvas.convertToBlob({type:'image/png'});return new Promise((resolve,reject)=>{const r=new FileReader();r.onload=()=>resolve(r.result);r.onerror=()=>reject(r.error);r.readAsDataURL(blob);});}
  const images={};if(capture){
    const canvases=new Map(frames.map(f=>[f.id,canvasFor(f)]));for(const f of frames)images[f.id]=await png(canvases.get(f.id));
    async function contactFor(selected,title){const tile=256,label=43,header=40,contact=new OffscreenCanvas(tile*4,header+(tile+label)*Math.ceil(selected.length/4)),ctx=contact.getContext('2d');ctx.fillStyle='#000';ctx.fillRect(0,0,contact.width,contact.height);ctx.fillStyle='#ddd';ctx.font='14px sans-serif';ctx.fillText(title,10,25);selected.forEach((f,i)=>{const x=i%4*tile,y=header+Math.floor(i/4)*(tile+label);ctx.drawImage(canvases.get(f.id),x,y,tile,tile);ctx.fillStyle='#ddd';ctx.font='13px sans-serif';ctx.fillText(f.id+' / '+f.meta.geometry.stars+' stars',x+8,y+tile+18);ctx.fillText('d'+f.meta.distanceMetres.toFixed(1)+'m / C16.5 P0',x+8,y+tile+35);});return png(contact);}
    images.contact=await contactFor(frames,'Production effects only / '+smileyLayout+' core + four layouts / same C/P / no island, bloom or FPS claim');
    images.layouts=await contactFor(frames.filter(f=>f.meta.layoutComparison),'Four production layouts / fixed seed, phase, camera, C16.5 P0 / yellow / no gain or size normalization');
  }
  const layoutFrames=frames.filter(f=>f.meta.layoutComparison),layoutComparisons=[];
  for(const [a,b]of [['dense','spaced-mouth'],['dense','compact-eyes'],['spaced-mouth','reference'],['compact-eyes','reference']]){
    const A=layoutFrames.find(f=>f.meta.smileyLayout===a),B=layoutFrames.find(f=>f.meta.smileyLayout===b);if(!A||!B)continue;let difference=0,normalization=0;
    for(let i=0;i<A.pixels.length;i++)if(i%4!==3){difference+=Math.abs(B.pixels[i]-A.pixels[i]);normalization+=Math.abs(A.pixels[i]);}
    layoutComparisons.push({from:a,to:b,relativeAbsoluteRawRGBDifference:difference/Math.max(normalization,1e-30),totalRawPixelYRatio:B.meta.stats.totalRawPixelY/Math.max(A.meta.stats.totalRawPixelY,1e-30),uploadedUnmodulatedCandelaRatio:B.meta.geometry.sumUploadedUnmodulatedCandela/A.meta.geometry.sumUploadedUnmodulatedCandela,note:'RGB pixel integral includes PSF, shutter and smoke; not a proof of physical energy conservation. Fewer mouth stars intentionally lower source candela.'});
  }
  const sha=async text=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(text))),x=>x.toString(16).padStart(2,'0')).join('');
  return{date:new Date().toISOString(),passed:checks.every(c=>c.passed),passedCount:checks.filter(c=>c.passed).length,total:checks.length,core:{passedCount:checks.filter(c=>!c.name.startsWith('layout_')&&c.passed).length,total:checks.filter(c=>!c.name.startsWith('layout_')).length},checks,conditions:{size,seed,launch,time,secondsAfterActualBurst:1.1,cameraEV,storageEV,rawPerCandela,origin,wind,smileyLayout,layoutFrontViews:layouts,air:false,dof:false,vignette:false,bloom:false,monochrome:'explicit yellow; physical star hue is not altered in the renderer',floatExtensions:extensions},layoutComparisons,frames:frames.map(f=>f.meta),shaderSHA256:{main:await sha(shaderMain),reflection:await sha(shaderMirror)},images,
    limits:['Isolated actual production renderer on black; no full-island/cloud/water/air/scene-performance acceptance','Canonical comparisons cover actual uploaded Float32 positions, velocities, stretches and shapes; camera-dependent smoke lighting and shutter weights are intentionally not called body motion','All five angles use the same260m radius,48mm focal, C/P and physical event; side-view thinning is expected','Mirror uses the same physical event with the production reflection variant, inverted camera up and zero shutter; its image need not match the direct view','Float32 target requires actual float blending; finite FP16 numeric range is checked but FP16 quantization and whole-chain budget remain separate root QA','PNG is vendor ACES+sRGB at fixed C; no absolute camera or pyrotechnic photometry calibration','No sound played; locked audio remains unchanged']};
}
