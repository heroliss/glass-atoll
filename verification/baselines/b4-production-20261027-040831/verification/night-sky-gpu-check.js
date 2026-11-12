import {nightEphemeris,nightDefaults,recommendedNightExposure,NIGHT_STAR_SCALE} from '../night-sky.js';

// Synchronous, isolated real-sky shader/FP16 readback. Reuses uploaded immutable
// atlas/noise textures, but copies every mutable uniform. No main-scene state,
// time, light, asset or history is changed. Readback cost is QA, not FPS.
export function runNightSkyCheck(THREE,renderer,atmosphere){
  const checks=[],add=(id,passed,evidence={})=>checks.push({id,passed:!!passed,...evidence});
  const fingerprint=source=>{let h=2166136261;for(let i=0;i<source.length;i++)h=Math.imul(h^source.charCodeAt(i),16777619);return(h>>>0).toString(16).padStart(8,'0');};
  const report={kind:'Actual full night-sky shader finite scan and FP16 pre-exposure storage check',date:new Date().toISOString(),source:{model:atmosphere.mesh.userData.model,cloudShapeBlend:atmosphere.uniforms.uCloudShapeBlend?.value,cloudSupportEnabled:atmosphere.uniforms.uCloudSupportEnabled?.value,fragmentShaderFNV1a32:fingerprint(atmosphere.mesh.material.fragmentShader),vertexShaderFNV1a32:fingerprint(atmosphere.mesh.material.vertexShader)},checks,observations:{},limits:['Small33x33 angular fixtures, not full-resolution image acceptance or performance.','CPU astronomical data feed an actual copy of the runtime sky shader; this is not an independent lunar orbit validation.','No main ocean/terrain/leaf draw is exercised here.']};
  const gl=renderer.getContext(),previous=renderer.getRenderTarget(),face=renderer.getActiveCubeFace(),mip=renderer.getActiveMipmapLevel(),saved={autoClear:renderer.autoClear,xr:renderer.xr.enabled,scissorTest:renderer.getScissorTest(),viewport:renderer.getViewport(new THREE.Vector4()).toArray(),scissor:renderer.getScissor(new THREE.Vector4()).toArray(),physicalViewport:Array.from(gl.getParameter(gl.VIEWPORT)),physicalScissor:Array.from(gl.getParameter(gl.SCISSOR_BOX)),actualScissorTest:gl.isEnabled(gl.SCISSOR_TEST),clear:renderer.getClearColor(new THREE.Color()),alpha:renderer.getClearAlpha()};
  let material,half,float,copyMaterial,copyGeometry;
  try{
    if(!renderer.extensions.has('EXT_color_buffer_float'))throw new Error('Actual float readback unsupported.');
    const atlas=atmosphere.uniforms.uNightStarMap.value;
    if(!atlas?.image||atlas.image.width!==4096)throw new Error('Await atmosphere.ready before checking the real4096px catalog atlas.');
    const uniforms=Object.fromEntries(Object.entries(atmosphere.uniforms).map(([k,u])=>[k,{value:u.value?.isTexture?u.value:u.value?.clone?u.value.clone():u.value}]));
    material=new THREE.ShaderMaterial({uniforms,defines:{...atmosphere.mesh.material.defines},vertexShader:atmosphere.mesh.material.vertexShader,fragmentShader:atmosphere.mesh.material.fragmentShader,side:THREE.BackSide,depthTest:false,depthWrite:false,toneMapped:false});
    const scene=new THREE.Scene(),sky=new THREE.Mesh(atmosphere.mesh.geometry,material),camera=new THREE.PerspectiveCamera(90,1,.1,24000);sky.frustumCulled=false;scene.add(sky);camera.position.set(0,2,0);
    const n=33,make=type=>new THREE.WebGLRenderTarget(n,n,{type,format:THREE.RGBAFormat,depthBuffer:false,stencilBuffer:false,minFilter:THREE.NearestFilter,magFilter:THREE.NearestFilter,generateMipmaps:false});
    half=make(THREE.HalfFloatType);float=make(THREE.FloatType);half.texture.colorSpace=float.texture.colorSpace=THREE.NoColorSpace;
    copyMaterial=new THREE.ShaderMaterial({uniforms:{uInput:{value:half.texture}},depthTest:false,depthWrite:false,toneMapped:false,vertexShader:'varying vec2 vUv;void main(){vUv=uv;gl_Position=vec4(position.xy,0.,1.);}',fragmentShader:'uniform sampler2D uInput;varying vec2 vUv;void main(){gl_FragColor=textureLod(uInput,vUv,0.);}'});
    copyGeometry=new THREE.PlaneGeometry(2,2);const copyScene=new THREE.Scene(),copyCamera=new THREE.OrthographicCamera(-1,1,1,-1,0,2);copyScene.add(new THREE.Mesh(copyGeometry,copyMaterial));
    renderer.xr.enabled=false;renderer.autoClear=false;renderer.setScissorTest(false);renderer.setClearColor(0,0);
    const look=direction=>{camera.up.set(...(Math.abs(direction[1])>.9?[0,0,-1]:[0,1,0]));camera.lookAt(new THREE.Vector3(...direction).add(camera.position));camera.updateMatrixWorld();};
    const render=target=>{renderer.setRenderTarget(target);renderer.clear(true,false,false);renderer.render(scene,camera);};
    const read=(target,isHalf)=>{if(isHalf){renderer.setRenderTarget(float);renderer.render(copyScene,copyCamera);}const values=new Float32Array(n*n*4);renderer.readRenderTargetPixels(isHalf?float:target,0,0,n,n,values);return values;};
    const setup=(date,preExposure=true,coverage=0)=>{
      const e=nightEphemeris({...nightDefaults,date}),columns=e.worldToEquatorialColumns;
      uniforms.uEquatorialRotation.value.set(columns[0][0],columns[1][0],columns[2][0],columns[0][1],columns[1][1],columns[2][1],columns[0][2],columns[1][2],columns[2][2]);
      uniforms.sunPosition.value.set(0,Math.sin(-25*Math.PI/180),Math.cos(-25*Math.PI/180));uniforms.uSkyIntensity.value=1;uniforms.uSolarDisk.value=1;uniforms.uCloudTime.value=0;uniforms.uCloudCoverage.value=coverage;
      uniforms.uMoonDirection.value.fromArray(e.moonDirection);const north=new THREE.Vector3().fromArray(e.moonNorth),moon=uniforms.uMoonDirection.value;north.addScaledVector(moon,-north.dot(moon)).normalize();uniforms.uMoonNorth.value.copy(north);uniforms.uMoonRight.value.crossVectors(moon,north).normalize();uniforms.uMoonSunDirection.value.fromArray(e.astronomicalSunDirection);uniforms.uMoonLibration.value.fromArray(e.moonLibrationRadians);uniforms.uMoonRadius.value=e.moonAngularRadius;
      uniforms.uMoonSourceRatio.value=e.moonSourceRatio;uniforms.uMoonSourceColor.value.set(1,.96,.9);const a=e.moonPhaseAngleRadians,lambert=Math.max(.0001,(Math.sin(a)+(Math.PI-a)*Math.cos(a))/Math.PI);uniforms.uMoonRadiance.value=32000*e.moonSourceRatio/lambert;
      uniforms.uCloudLightDirection.value.copy(e.moonAltitudeDegrees>0?moon:uniforms.sunPosition.value);uniforms.uCloudLightStrength.value=e.moonAltitudeDegrees>0?e.moonSourceRatio:1;uniforms.uCloudLightColor.value.set(1,.96,.9);uniforms.uCloudAmbientColor.value.set(1e-7,1.3e-7,1.8e-7);uniforms.uNightStarScale.value=NIGHT_STAR_SCALE;
      const ev=preExposure?recommendedNightExposure(-25,e.moonSourceRatio,e.moonAltitudeDegrees):0;uniforms.uSkyPreExposure.value=2**ev;return {ephemeris:e,ev};
    };
    const finite=values=>{let bad=0,max=0,negative=0;for(let i=0;i<values.length;i++)if(i%4!==3){bad+=!Number.isFinite(values[i]);negative+=values[i]<0;max=Math.max(max,values[i]);}return{nonFiniteChannels:bad,negativeChannels:negative,maximumLinearValue:max};};
    setup('2026-08-13T14:00:00Z',false);look([0,1,0]);render(float);const physical=read(float,false);render(half);const unexposedHalf=read(half,true);
    const cfg=setup('2026-08-13T14:00:00Z',true);render(half);const exposed=read(half,true),scale=2**cfg.ev;
    let maximumRatio=0,referenceEnergy=0,actualEnergy=0,lostEnergy=0,referencePositive=0,exposedPositive=0;
    for(let i=0;i<physical.length;i++)if(i%4!==3){const expected=physical[i]*scale,error=Math.abs(exposed[i]-expected),bound=Math.max(2**-23,Math.abs(expected)*.0015);maximumRatio=Math.max(maximumRatio,error/bound);referenceEnergy+=physical[i];actualEnergy+=exposed[i]/scale;lostEnergy+=unexposedHalf[i];referencePositive+=physical[i]>1e-14;exposedPositive+=exposed[i]>0;}
    add('real_catalog_atlas_and_physical_float32_sky_are_nonzero',referenceEnergy>1e-9&&referencePositive>n*n,{atlasDimensions:[atlas.image.width,atlas.image.height],referencePositiveChannels:referencePositive,physicalEnergySum:referenceEnergy});
    add('preexposure_before_FP16_preserves_physical_star_radiance',maximumRatio<=1&&Math.abs(actualEnergy/referenceEnergy-1)<.002,{preExposureEV:cfg.ev,maximumQuantizationBoundRatio:maximumRatio,energyRelativeError:actualEnergy/referenceEnergy-1,referencePositiveChannels:referencePositive,exposedPositiveChannels:exposedPositive});
    report.observations.noPreExposure={physicalFloat32Energy:referenceEnergy,unexposedFP16Energy:lostEnergy,relativeLoss:1-lostEnergy/referenceEnergy,notes:'Diagnostic of the failure avoided by pre-exposure, not a remaining presented-frame claim.'};
    let totalBad=0,totalNegative=0,maximumHDR=0;const scans=[];
    for(const [date,coverage]of [['2026-10-26T14:00:00Z',.35],['2026-08-13T14:00:00Z',.35]]){
      const c=setup(date,true,coverage);
      for(const direction of [[1,0,0],[-1,0,0],[0,1,0],[0,-1,0],[0,0,1],[0,0,-1],c.ephemeris.moonDirection]){look(direction);render(half);const stats=finite(read(half,true));totalBad+=stats.nonFiniteChannels;totalNegative+=stats.negativeChannels;maximumHDR=Math.max(maximumHDR,stats.maximumLinearValue);scans.push({date,coverage,direction,...stats});}
    }
    add('full_night_shader_all_directions_moon_and_clouds_have_no_NaN_or_Inf',totalBad===0,{testedViews:scans.length,pixelsPerView:n*n,nonFiniteChannels:totalBad,maximumHDR});
    add('night_scattering_stars_and_cloud_radiance_nonnegative',totalNegative===0,{negativeChannels:totalNegative});
    report.observations.scans=scans;
  }catch(error){add('check_completed_without_exception',false,{error:String(error?.stack||error)});}
  finally{
    material?.dispose();half?.dispose();float?.dispose();copyMaterial?.dispose();copyGeometry?.dispose();
    renderer.setScissorTest(saved.scissorTest);
    if(previous){const vp=previous.viewport.clone(),sc=previous.scissor.clone(),st=previous.scissorTest;previous.viewport.fromArray(saved.physicalViewport);previous.scissor.fromArray(saved.physicalScissor);previous.scissorTest=saved.actualScissorTest;renderer.setRenderTarget(previous,face,mip);previous.viewport.copy(vp);previous.scissor.copy(sc);previous.scissorTest=st;}else renderer.setRenderTarget(null,face,mip);
    renderer.setClearColor(saved.clear,saved.alpha);renderer.autoClear=saved.autoClear;renderer.xr.enabled=saved.xr;
    const physicalRestored=Array.from(gl.getParameter(gl.VIEWPORT)).every((v,i)=>v===saved.physicalViewport[i])&&Array.from(gl.getParameter(gl.SCISSOR_BOX)).every((v,i)=>v===saved.physicalScissor[i])&&gl.isEnabled(gl.SCISSOR_TEST)===saved.actualScissorTest;
    add('renderer_target_viewport_scissor_clear_and_flags_restored',physicalRestored&&renderer.getRenderTarget()===previous&&renderer.getViewport(new THREE.Vector4()).toArray().every((v,i)=>v===saved.viewport[i])&&renderer.getScissor(new THREE.Vector4()).toArray().every((v,i)=>v===saved.scissor[i])&&renderer.getScissorTest()===saved.scissorTest&&renderer.autoClear===saved.autoClear&&renderer.xr.enabled===saved.xr,{physicalRestored,ownedShaderTargetsDisposed:true,sharedGeometryAndTexturesNeverDisposed:true});
  }
  report.status=checks.every(c=>c.passed)?'passed':'failed';report.summary={passed:checks.filter(c=>c.passed).length,total:checks.length,failed:checks.filter(c=>!c.passed).length};return report;
}
