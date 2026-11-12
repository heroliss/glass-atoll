// Actual resolve shader, synthetic linear-HDR/depth/type fixtures. No runtime
// shader is copied or changed, and no result here claims real-scene ghost-free AA.
export function runTemporalWaterCheck(THREE,renderer,fragmentShader){
  const n=32,near=.1,far=1000,z=10,resources=[],checks=[];
  const report={kind:'Actual short-history water-radiance GPU resolve',passed:false,checks,glErrors:[],shaderErrors:[],preexistingGlErrors:[],sequences:{}};
  const gl=renderer.getContext();
  const errors=out=>{for(let i=0;i<32;i++){const e=gl.getError();if(e===gl.NO_ERROR)break;out.push('0x'+e.toString(16));}};errors(report.preexistingGlErrors);
  const camera=new THREE.PerspectiveCamera(60,1,near,far);camera.updateMatrixWorld();const vp=new THREE.Matrix4().multiplyMatrices(camera.projectionMatrix,camera.matrixWorldInverse);
  const encode=d=>(far-near*far/d)/(far-near);
  const currentData=new Float32Array(n*n*4),historyData=new Float32Array(n*n*4),depthData=new Float32Array(n*n).fill(encode(z)),ageData=new Float32Array(n*n);
  function texture(data,format=THREE.RGBAFormat,filter=THREE.NearestFilter){const t=new THREE.DataTexture(data,n,n,format,THREE.FloatType);t.minFilter=t.magFilter=filter;t.generateMipmaps=false;t.colorSpace=THREE.NoColorSpace;t.needsUpdate=true;resources.push(t);return t;}
  const current=texture(currentData),history=texture(historyData,THREE.RGBAFormat,THREE.LinearFilter),depth=texture(depthData,THREE.RedFormat),metadata=texture(ageData,THREE.RedFormat);
  const target=new THREE.WebGLRenderTarget(n,n,{type:THREE.FloatType,count:2,depthBuffer:false});resources.push(target);
  target.textures[1].type=THREE.UnsignedByteType;target.textures[1].format=THREE.RedFormat;target.textures[1].internalFormat='R8';target.textures[1].minFilter=target.textures[1].magFilter=THREE.NearestFilter;
  const uniforms={tCurrent:{value:current},tCurrentDepth:{value:depth},tHistory:{value:history},tHistoryMetadata:{value:metadata},uSize:{value:new THREE.Vector2(n,n)},uInverseCurrentVP:{value:vp.clone().invert()},uPreviousVP:{value:vp.clone()},uPreviousView:{value:camera.matrixWorldInverse.clone()},uNear:{value:near},uFar:{value:far},uHistoryValid:{value:0},uHistoryWeight:{value:.84},uWind:{value:0},uMotionDelta:{value:1/60},uProjectionScale:{value:100},uVegetationEnabled:{value:0},uWaterEnabled:{value:1}};
  const vertex='varying vec2 vUv;void main(){vUv=uv;gl_Position=vec4(position.xy,0.,1.);}';
  const material=new THREE.ShaderMaterial({uniforms,depthTest:false,depthWrite:false,toneMapped:false,vertexShader:vertex,fragmentShader});resources.push(material);
  const geometry=new THREE.PlaneGeometry(2,2);resources.push(geometry);const scene=new THREE.Scene(),quad=new THREE.Mesh(geometry,material);quad.frustumCulled=false;scene.add(quad);
  const readCamera=new THREE.OrthographicCamera(-1,1,1,-1,0,1),output=new Float32Array(n*n*4),ages=new Uint8Array(n*n),metadataPixels=new Float32Array(n*n*4);
  const copyTarget=new THREE.WebGLRenderTarget(n,n,{type:THREE.FloatType,depthBuffer:false});resources.push(copyTarget);
  const copyMaterial=new THREE.ShaderMaterial({uniforms:{tMetadata:{value:target.textures[1]}},depthTest:false,depthWrite:false,toneMapped:false,vertexShader:vertex,fragmentShader:'varying vec2 vUv;uniform sampler2D tMetadata;void main(){gl_FragColor=vec4(textureLod(tMetadata,vUv,0.).r,0.,0.,1.);}'});resources.push(copyMaterial);
  const saved={target:renderer.getRenderTarget(),face:renderer.getActiveCubeFace(),mip:renderer.getActiveMipmapLevel(),viewport:renderer.getViewport(new THREE.Vector4()),currentViewport:renderer.getCurrentViewport(new THREE.Vector4()),scissor:renderer.getScissor(new THREE.Vector4()),scissorBox:Array.from(gl.getParameter(gl.SCISSOR_BOX)),test:renderer.getScissorTest(),actualTest:gl.isEnabled(gl.SCISSOR_TEST),autoClear:renderer.autoClear,xr:renderer.xr.enabled,shadowAuto:renderer.shadowMap.autoUpdate,shadowNeeds:renderer.shadowMap.needsUpdate,checkErrors:renderer.debug.checkShaderErrors,onShaderError:renderer.debug.onShaderError};
  const add=(id,passed,details={})=>checks.push({id,passed:!!passed,...details});
  const fill=(data,fn)=>{for(let y=0;y<n;y++)for(let x=0;x<n;x++)data.set(fn(x,y),(y*n+x)*4);};
  function draw(){
    current.needsUpdate=history.needsUpdate=depth.needsUpdate=metadata.needsUpdate=true;quad.material=material;renderer.setRenderTarget(target);renderer.render(scene,readCamera);renderer.readRenderTargetPixels(target,0,0,n,n,output);
    quad.material=copyMaterial;renderer.setRenderTarget(copyTarget);renderer.render(scene,readCamera);renderer.readRenderTargetPixels(copyTarget,0,0,n,n,metadataPixels);
    for(let i=0;i<ages.length;i++)ages[i]=Math.round(metadataPixels[i*4]*255);quad.material=material;return output;
  }
  function rgbError(expected){let maximum=0,nonFinite=0;for(let i=0;i<output.length;i+=4)for(let c=0;c<3;c++){if(!Number.isFinite(output[i+c]))nonFinite++;maximum=Math.max(maximum,Math.abs(output[i+c]-expected(i/4,c)));}return{maximumError:maximum,nonFinite};}
  function carry(){historyData.set(output);for(let i=0;i<ages.length;i++)ageData[i]=ages[i]/255;uniforms.uHistoryValid.value=1;}
  function reset(){uniforms.uPreviousVP.value.copy(vp);uniforms.uPreviousView.value.copy(camera.matrixWorldInverse);uniforms.uVegetationEnabled.value=0;uniforms.uWaterEnabled.value=1;uniforms.uHistoryValid.value=1;depthData.fill(encode(z));ageData.fill(16/255);}
  const std=a=>{const m=a.reduce((s,v)=>s+v,0)/a.length;return Math.sqrt(a.reduce((s,v)=>s+(v-m)**2,0)/a.length);};
  const mean=a=>a.reduce((s,v)=>s+v,0)/a.length;
  try{
    renderer.xr.enabled=false;renderer.autoClear=false;renderer.shadowMap.autoUpdate=false;renderer.shadowMap.needsUpdate=false;renderer.debug.checkShaderErrors=true;
    renderer.debug.onShaderError=(context,program,vertex,fragment)=>{report.shaderErrors.push({program:context.getProgramInfoLog(program),vertex:context.getShaderInfoLog(vertex),fragment:context.getShaderInfoLog(fragment)});saved.onShaderError?.(context,program,vertex,fragment);};
    fill(currentData,()=>[2,4,1,.70]);fill(historyData,()=>[100,0,0,z]);ageData.fill(0);draw();
    const init=rgbError((_,c)=>[2,4,1][c]);let initialDepthError=0;for(let i=3;i<output.length;i+=4)initialDepthError=Math.max(initialDepthError,Math.abs(output[i]-z));
    add('fresh_water_initializes_R8_type16_and_physical_depth',init.nonFinite===0&&init.maximumError<2e-5&&ages.every(a=>a===16)&&initialDepthError<.002,{...init,maximumDepthError:initialDepthError,metadataFirst:ages[0]});

    reset();fill(currentData,x=>{const v=2+x*.02;return[v,v*.9,v*.8,.70];});fill(historyData,x=>{const v=2+x*.02+.01;return[v,v*.9,v*.8,z];});draw();
    const probe=(16*n+16)*4,w=Math.exp(-(1/60)/.025),expected=currentData[probe]*(1-w)+historyData[probe]*w;
    add('only_water_uses_its_short_history_with_vegetation_disabled',Math.abs(output[probe]-expected)<3e-5&&Math.abs(output[probe]-currentData[probe])>1e-4&&ages[16*n+16]===16,{actual:output[probe],expected,current:currentData[probe],expectedHistoryWeight:w});

    fill(currentData,()=>[2,4,1,.70]);fill(historyData,()=>[8,1,6,z]);draw();
    const hdrCurrent=[2,4,1],hdrHistory=[8,1,6],hdrExpected=hdrCurrent.map((v,c)=>v*(1-w)+hdrHistory[c]*w),hdrActual=Array.from(output.slice(probe,probe+3));
    let nonFiniteHDR=0,outsideConvexHull=0;
    for(let i=0;i<output.length;i+=4)for(let c=0;c<3;c++){
      const v=output[i+c];if(!Number.isFinite(v))nonFiniteHDR++;
      if(v<Math.min(hdrCurrent[c],hdrHistory[c])-2e-5||v>Math.max(hdrCurrent[c],hdrHistory[c])+2e-5)outsideConvexHull++;
    }
    const hdrError=Math.max(...hdrActual.map((v,c)=>Math.abs(v-hdrExpected[c])));
    add('valid_HDR_history_is_a_convex_mix_without_spatial_peak_clipping',nonFiniteHDR===0&&outsideConvexHull===0&&hdrError<5e-5&&hdrActual[0]>4,{current:hdrCurrent,history:hdrHistory,actual:hdrActual,expected:hdrExpected,maximumProbeError:hdrError,nonFinite:nonFiniteHDR,outsideConvexHull});

    reset();fill(currentData,(x,y)=>[.2+x*.01,.3+y*.01,.4,x%2?1:.25]);fill(historyData,()=>[50,0,0,z]);draw();const bypass=rgbError((pixel,c)=>currentData[pixel*4+c]);
    add('non_water_sand_sky_and_leaf_bypass_when_only_water_is_enabled',bypass.maximumError<2e-5&&ages.every(a=>a===0),bypass);

    reset();uniforms.uWaterEnabled.value=0;uniforms.uVegetationEnabled.value=1;ageData.fill(1/255);
    fill(currentData,x=>{const v=.3+x*.03;return[v,v*.9,v*.8,.70];});fill(historyData,x=>{const v=.3+x*.03+.02;return[v,v*.9,v*.8,z];});draw();const disabled=rgbError((pixel,c)=>currentData[pixel*4+c]);
    add('water_off_does_not_fall_into_the_vegetation_coverage_path',disabled.maximumError<2e-5&&ages.every(a=>a===0),disabled);

    const invalid=[];
    for(const kind of ['depth','metadata_type','offscreen_camera']){
      reset();fill(currentData,x=>{const v=.3+x*.03;return[v,v*.9,v*.8,.70];});fill(historyData,x=>{const v=.3+x*.03+.02;return[v,v*.9,v*.8,kind==='depth'?50:z];});
      if(kind==='metadata_type')ageData.fill(1/255);if(kind==='offscreen_camera')uniforms.uPreviousVP.value.elements[12]+=100;
      draw();const result=rgbError((pixel,c)=>currentData[pixel*4+c]);invalid.push({kind,...result,freshType16:ages.every(a=>a===16)});
    }
    add('depth_camera_and_type_invalidation_reject_stale_history',invalid.every(r=>r.maximumError<2e-5&&r.nonFinite===0&&r.freshType16),{cases:invalid});

    const leakage=[];
    for(const kind of ['adjacent_leaf','adjacent_wrong_depth'])for(const shift of [.25,.75]){
      reset();fill(currentData,x=>x<16?[.4,.5,.6,.70]:[1,.1,.1,.25]);
      fill(historyData,x=>x<16?[.4,.5,.6,z]:[1,.1,.1,kind==='adjacent_wrong_depth'?50:z]);
      for(let y=0;y<n;y++)for(let x=0;x<n;x++)ageData[y*n+x]=x<16||kind==='adjacent_wrong_depth'?16/255:1/255;
      uniforms.uPreviousVP.value.elements[12]+=2*z*shift/n;draw();const p=(16*n+15)*4,actual=Array.from(output.slice(p,p+3));
      const e=Math.max(...actual.map((v,c)=>Math.abs(v-[.4,.5,.6][c])));leakage.push({kind,reprojectionPixels:shift,actual,maximumError:e});
    }
    add('bilinear_history_rejects_same_depth_leaf_and_wrong_depth_neighbours',leakage.every(r=>r.maximumError<3e-5),{cases:leakage});

    reset();uniforms.uHistoryValid.value=0;historyData.fill(0);ageData.fill(0);const raw=[],resolved=[],spatialMeans=[];
    for(let frame=0;frame<64;frame++){
      fill(currentData,(x,y)=>{const v=2+((x+y+frame)%2?1:-1);return[v,v*.9,v*.7,.70];});draw();
      if(frame>=16){raw.push(currentData[probe]);resolved.push(output[probe]);let m=0;for(let i=0;i<n*n;i++)m+=output[i*4];spatialMeans.push(m/(n*n));}
      carry();
    }
    const frequency={frames:64,warmup:16,rawStd:std(raw),resolvedStd:std(resolved),stdRatio:std(resolved)/std(raw),rawMean:mean(raw),resolvedMean:mean(resolved),maximumSpatialMeanError:Math.max(...spatialMeans.map(v=>Math.abs(v-2))),raw,resolved};report.sequences.alternatingGlints=frequency;
    add('alternating_spatial_glint_fixture_reduces_frequency_preserving_mean',frequency.stdRatio<.75&&Math.abs(frequency.resolvedMean-frequency.rawMean)<.01&&frequency.maximumSpatialMeanError<.01,{rawStd:frequency.rawStd,resolvedStd:frequency.resolvedStd,stdRatio:frequency.stdRatio,meanError:frequency.resolvedMean-frequency.rawMean,maximumSpatialMeanError:frequency.maximumSpatialMeanError});

    for(let frame=0;frame<3;frame++){fill(currentData,()=>[2,1.8,1.4,.70]);draw();carry();}
    const step=[];for(let frame=0;frame<7;frame++){
      fill(currentData,x=>{const v=x>=16?4:2;return[v,v*.9,v*.7,.70];});draw();step.push({frame:frame+1,seconds:(frame+1)/60,value:output[probe],errorFraction:Math.abs(output[probe]-4)/2});carry();
    }
    report.sequences.realStep=step;
    add('real_spatial_step_settles_within_five_frames_without_long_trail',step.every(v=>v.value>=2-2e-5&&v.value<=4+2e-5)&&step[4].errorFraction<.05&&step[6].errorFraction<.02,{frames:step,note:'Synthetic 60Hz sequence; no water velocity or reflection motion vectors are supplied.'});
    // An isolated highlight must retain its temporal energy even after it has
    // disappeared from the next spatial neighbourhood. Whole eight-frame
    // periods are measured after 32 warmup frames to remove initialization.
    reset();uniforms.uHistoryValid.value=0;historyData.fill(0);ageData.fill(0);const spikeRaw=[],spikeResolved=[];
    for(let frame=0;frame<96;frame++){
      fill(currentData,(x,y)=>{const v=frame%8===0&&x===16&&y===16?3:.2;return[v,v*.9,v*.7,.70];});draw();
      if(frame>=32){spikeRaw.push(currentData[probe]);spikeResolved.push(output[probe]);}carry();
    }
    const spikeBias=(mean(spikeResolved)-mean(spikeRaw))/mean(spikeRaw);
    report.sequences.isolatedHighlight={gate:true,frames:96,warmup:32,measuredFrames:64,wholePulsePeriods:8,expectedHistoryWeight:w,initialStateAttenuationBound:w**32,rawMean:mean(spikeRaw),resolvedMean:mean(spikeResolved),relativeMeanBias:spikeBias,relativeMeanTolerance:.001,raw:spikeRaw,resolved:spikeResolved,note:'Stationary-camera, fixed-weight sparse-highlight gate. Variable weights, moving projections and disocclusion require scene acceptance; this is not universal radiance conservation.'};
    add('isolated_highlight_preserves_period_mean_after_warmup',Number.isFinite(spikeBias)&&Math.abs(spikeBias)<.001&&spikeResolved.every(v=>Number.isFinite(v)&&v>=.2-2e-5&&v<=3+2e-5),{rawMean:mean(spikeRaw),resolvedMean:mean(spikeResolved),relativeMeanBias:spikeBias,tolerance:.001,warmup:32,measuredFrames:64,wholePeriods:8,initialStateAttenuationBound:w**32});
    errors(report.glErrors);
  }catch(error){report.error=String(error?.stack||error);}
  finally{
    for(const resource of resources)try{resource.dispose();}catch{}
    const viewport=saved.target?.viewport.clone(),scissor=saved.target?.scissor.clone(),test=saved.target?.scissorTest;
    if(saved.target){saved.target.viewport.copy(saved.currentViewport);saved.target.scissor.fromArray(saved.scissorBox);saved.target.scissorTest=saved.actualTest;}
    try{renderer.setRenderTarget(saved.target,saved.face,saved.mip);}finally{if(saved.target){saved.target.viewport.copy(viewport);saved.target.scissor.copy(scissor);saved.target.scissorTest=test;}}
    renderer.autoClear=saved.autoClear;renderer.xr.enabled=saved.xr;renderer.shadowMap.autoUpdate=saved.shadowAuto;renderer.shadowMap.needsUpdate=saved.shadowNeeds;renderer.debug.checkShaderErrors=saved.checkErrors;renderer.debug.onShaderError=saved.onShaderError;
    const restored=renderer.getRenderTarget()===saved.target&&renderer.getActiveCubeFace()===saved.face&&renderer.getActiveMipmapLevel()===saved.mip&&renderer.getViewport(new THREE.Vector4()).equals(saved.viewport)&&renderer.getCurrentViewport(new THREE.Vector4()).equals(saved.currentViewport)&&renderer.getScissor(new THREE.Vector4()).equals(saved.scissor)&&renderer.getScissorTest()===saved.test;
    add('renderer_state_and_physical_viewport_restored',restored);errors(report.glErrors);
  }
  report.passed=!report.error&&checks.every(c=>c.passed)&&report.glErrors.length===0&&report.shaderErrors.length===0;report.passedCount=checks.filter(c=>c.passed).length;report.total=checks.length;
  report.fixture={dimensions:[n,n],depthMetres:z,currentWaterAlpha:.70,historyMetadata:'actual normalized R8 type 16',motionDeltaSeconds:1/60};
  report.limits=['Synthetic GPU functionality and radiance sequences, not a perceptual or scene-FPS verdict','Camera-depth reprojection has no wave/reflection/caustic motion vectors; valid geometry does not guarantee correct radiance correspondence','The mean gates use a stationary camera and fixed weights; varying validity and motion weights need separate acceptance','A 25ms-style short history can soften moving glints; real camera/wind footage remains necessary','Partial MSAA pixels at water/vegetation boundaries may have mixed tags outside the exact-water class'];return report;
}
