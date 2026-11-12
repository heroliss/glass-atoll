import {createWaveSpectrum} from '../spectral-waves.js';
import {createHydrodynamics} from '../hydrodynamics.js';
import {waveGLSL} from '../waves.js';

// Actual shared waterField GPU check. The active ocean/clock/fields are never
// modified: every target, wave factory and SWE fixture here is independently
// owned, synchronously exercised, then disposed. This is not an FPS benchmark.
export async function runSeaStateCheck(THREE,renderer,{withHydro=true}={}){
  const checks=[],report={kind:'Actual shared wave GLSL gain/moment invariants + isolated grouped-boundary SWE',status:'running',checks,observations:{},limits:['Physical gain identities test shader integration, not the accuracy of every Fourier sample; use spectral-gpu-check.js for the separate CPU Fourier/mip oracle.','Prescribed linear spectrum, reference depth3m; no breaking, overturning or bathymetric refraction of the analytic7.5s swell.','SWE forcing test is a small flat-depth fixture, not a long-time island wave-energy budget.','Synchronous QA readback/compilation time is not scene GPU time or FPS.']};
  const add=(id,passed,evidence={})=>checks.push({id,passed:!!passed,...evidence});
  const gl=renderer.getContext(),previous=renderer.getRenderTarget(),face=renderer.getActiveCubeFace(),mip=renderer.getActiveMipmapLevel();
  const viewport=renderer.getViewport(new THREE.Vector4()),scissor=renderer.getScissor(new THREE.Vector4()),scissorTest=renderer.getScissorTest(),autoClear=renderer.autoClear,xr=renderer.xr.enabled;
  const currentViewport=previous?renderer.getCurrentViewport(new THREE.Vector4()):null,actualScissor=gl.getParameter(gl.SCISSOR_BOX),actualScissorTest=gl.isEnabled(gl.SCISSOR_TEST);
  let spectrum,target,geometry,material,zero,hydro;
  try{
    if(!renderer.extensions.has('EXT_color_buffer_float'))throw new Error('RGBA32F readback fixture needs EXT_color_buffer_float; unsupported is not a passing zero result.');
    renderer.xr.enabled=false;renderer.autoClear=false;renderer.setScissorTest(false);
    spectrum=createWaveSpectrum(THREE,renderer);spectrum.update(3.125,true);
    const n=32;target=new THREE.WebGLRenderTarget(n,n,{type:THREE.FloatType,format:THREE.RGBAFormat,minFilter:THREE.NearestFilter,magFilter:THREE.NearestFilter,depthBuffer:false,stencilBuffer:false,generateMipmaps:false});
    target.texture.colorSpace=THREE.NoColorSpace;
    zero=new THREE.DataTexture(new Uint8Array(4),1,1,THREE.RGBAFormat);zero.needsUpdate=true;
    const uniforms={...spectrum.uniforms,uTime:{value:3.125},uWind:{value:0},uRipples:{value:Array.from({length:8},()=>new THREE.Vector4(0,0,-100,0))},uMeanCurrent:{value:new THREE.Vector2()},uCurrentOffset:{value:new THREE.Vector2(.37,-.16)},uRippleOffsets:{value:Array.from({length:8},()=>new THREE.Vector2())},uHydroState:{value:zero},uHydroExtent:{value:72},uHydroResolution:{value:384},uHydroEnabled:{value:0}};
    material=new THREE.ShaderMaterial({uniforms,defines:{BAKED_WAVE_TEXTURES:1,OPTICAL_PASS:1},depthTest:false,depthWrite:false,toneMapped:false,blending:THREE.NoBlending,
      vertexShader:'varying vec2 vUv;void main(){vUv=uv;gl_Position=vec4(position.xy,0.,1.);}',
      fragmentShader:`precision highp float;varying vec2 vUv;${waveGLSL}\nvoid main(){opticalFootprint=.75;vec3 f=waterField((vUv*2.-1.)*80.);gl_FragColor=vec4(f,unresolvedSlopeVariance);}`});
    geometry=new THREE.PlaneGeometry(2,2);const quad=new THREE.Mesh(geometry,material),scene=new THREE.Scene(),camera=new THREE.OrthographicCamera(-1,1,1,-1,0,2);quad.frustumCulled=false;scene.add(quad);
    const capture=(wind,swellHeight,windSea)=>{
      uniforms.uWind.value=wind;spectrum.setSeaState({swellHeight,windSea});renderer.setRenderTarget(target);renderer.render(scene,camera);
      const values=new Float32Array(n*n*4);renderer.readRenderTargetPixels(target,0,0,n,n,values);return values;
    };
    const calm=capture(0,.16,1),calmOtherWindSea=capture(0,.16,1.5),doubleSwell=capture(0,.32,1),flat=capture(0,0,1),windOnly=capture(1,0,1),windOnePointFive=capture(1,0,1.5),combined=capture(1,.16,1);
    const arrays={calm,calmOtherWindSea,doubleSwell,flat,windOnly,windOnePointFive,combined};
    let nonFinite=0,negativeVariance=0,maximumCalmHeight=0,maximumWindSlope=0;
    for(const values of Object.values(arrays))for(let i=0;i<values.length;i++){if(!Number.isFinite(values[i]))nonFinite++;if(i%4===3&&values[i]<-1e-12)negativeVariance++;}
    for(let i=0;i<calm.length;i+=4){maximumCalmHeight=Math.max(maximumCalmHeight,Math.abs(calm[i]));maximumWindSlope=Math.max(maximumWindSlope,Math.hypot(windOnly[i+1],windOnly[i+2]));}
    add('actual_GPU_readback_contains_nonzero_swell_and_wind',maximumCalmHeight>1e-4&&maximumWindSlope>1e-4,{maximumCalmHeightMetres:maximumCalmHeight,maximumWindSlope,sampledPixels:n*n,worldExtentMetres:80,footprintMetres:.75});
    add('all_shared_field_outputs_are_finite',nonFinite===0,{nonFiniteChannels:nonFinite,totalChannels:Object.keys(arrays).length*n*n*4});
    add('unresolved_variance_remains_nonnegative',negativeVariance===0,{negativeVariancePixels:negativeVariance});
    const compare=(actual,expected)=>{let maximumError=0,maximumBoundRatio=0;for(let i=0;i<actual.length;i++){const error=Math.abs(actual[i]-expected(i)),bound=1e-7+1e-5*Math.abs(expected(i));maximumError=Math.max(maximumError,error);maximumBoundRatio=Math.max(maximumBoundRatio,error/bound);}return{maximumAbsoluteError:maximumError,maximumBoundRatio};};
    const identity=(id,actual,expected)=>{const evidence=compare(actual,expected);add(id,evidence.maximumBoundRatio<=1,evidence);};
    identity('zero_wind_keeps_swell_independent_of_windSea_gain',calmOtherWindSea,i=>calm[i]);
    identity('doubling_swell_height_doubles_height_and_slopes',doubleSwell,i=>calm[i]*(i%4===3?4:2));
    identity('zero_wind_zero_swell_is_exactly_flat',flat,()=>0);
    identity('windSea_gain_scales_field_linearly_and_variance_quadratically',windOnePointFive,i=>windOnly[i]*(i%4===3?2.25:1.5));
    identity('swell_plus_wind_preserves_linear_field_and_additive_independent_variance',combined,i=>calm[i]+windOnly[i]);
    report.observations.spectrum=spectrum.state;

    if(withHydro){
      // The production solver deliberately clamps resolution to at least96.
      // Request that actual fixture explicitly instead of expecting64² cells.
      hydro=createHydrodynamics(THREE,renderer,{terrainHeight:()=>-2,extent:24,resolution:96});hydro.setCurrent(0);hydro.setSwell(0);
      const initial=hydro.diagnostics({readback:true}),dt=initial.fixedTimeStepSeconds;
      for(let i=0;i<12;i++)hydro.update(dt);
      const rest=hydro.diagnostics({readback:true});
      add('new_SWE_boundary_shader_keeps_unforced_rest_invariant',rest.resolution===96&&rest.state?.wetCells===96*96&&rest.state?.maximumRestDepthErrorMetres<1e-6&&rest.state?.maximumElevationMetres===0&&rest.state?.maximumPerturbationSpeedMetresPerSecond===0&&rest.state?.nonFiniteCells===0,{requestedResolution:96,expectedWetCells:9216,actualResolution:rest.resolution,state:rest.state});
      const phaseBefore=hydro.diagnostics({readback:false}).incomingSwell.integratedPhases;
      hydro.setSwellState({amplitude:.015,period:14,groupiness:.35});
      const phaseAfter=hydro.diagnostics({readback:false}).incomingSwell.integratedPhases;
      add('changing_SWE_period_retains_integrated_component_phases',phaseBefore.every((v,i)=>v===phaseAfter[i]),{before:phaseBefore,after:phaseAfter});
      hydro.setSwellState({period:20});
      for(let i=0;i<Math.ceil(1.25/dt);i++)hydro.update(dt);
      const forced=hydro.diagnostics({readback:true});
      add('grouped_boundary_reaches_actual_GPU_state_without_nonfinite_or_dry_motion',forced.state?.maximumElevationMetres>1e-6&&forced.state?.nonFiniteCells===0&&forced.state?.maximumDryCellMotion===0&&forced.twoDimensionalGravityCFL<1,{state:forced.state,incomingSwell:forced.incomingSwell,twoDimensionalGravityCFL:forced.twoDimensionalGravityCFL});
      report.observations.hydro={initial,rest,forced};
    }
  }catch(error){report.error=String(error?.stack||error);add('check_completed_without_exception',false,{error:String(error)});}
  finally{
    hydro?.dispose();spectrum?.dispose();target?.dispose();material?.dispose();geometry?.dispose();zero?.dispose();
    renderer.setScissorTest(scissorTest);
    if(previous){const targetViewport=previous.viewport.clone(),targetScissor=previous.scissor.clone(),targetTest=previous.scissorTest;previous.viewport.copy(currentViewport);previous.scissor.set(...actualScissor);previous.scissorTest=actualScissorTest;renderer.setRenderTarget(previous,face,mip);previous.viewport.copy(targetViewport);previous.scissor.copy(targetScissor);previous.scissorTest=targetTest;}else renderer.setRenderTarget(null,face,mip);
    renderer.autoClear=autoClear;renderer.xr.enabled=xr;
    const restored=renderer.getRenderTarget()===previous&&renderer.getActiveCubeFace()===face&&renderer.getActiveMipmapLevel()===mip&&renderer.getViewport(new THREE.Vector4()).equals(viewport)&&renderer.getScissor(new THREE.Vector4()).equals(scissor)&&renderer.getScissorTest()===scissorTest&&renderer.autoClear===autoClear&&renderer.xr.enabled===xr;
    add('renderer_target_viewport_scissor_and_render_flags_restored',restored,{ownedResourcesDisposed:true});
  }
  report.status=checks.every(c=>c.passed)?'passed':'failed';report.summary={passed:checks.filter(c=>c.passed).length,failed:checks.filter(c=>!c.passed).length,total:checks.length};
  return report;
}
