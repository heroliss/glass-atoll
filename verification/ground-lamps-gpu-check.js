// Small, isolated production-light GPU fixture. It never renders the island.
export function runGroundLampsGPUCheck(THREE,renderer,createLocalLights){
  const gl=renderer.getContext();
  if(!gl.getExtension('EXT_color_buffer_float'))throw new Error('Ground-lamp QA requires renderable Float32 colour.');
  if(typeof createLocalLights!=='function')throw new TypeError('Pass the actual production createLocalLights factory.');
  const previous=renderer.getRenderTarget(),face=renderer.getActiveCubeFace(),mip=renderer.getActiveMipmapLevel();
  const saved={viewport:renderer.getViewport(new THREE.Vector4()),scissor:renderer.getScissor(new THREE.Vector4()),scissorTest:renderer.getScissorTest(),
    actualViewport:new THREE.Vector4().fromArray(gl.getParameter(gl.VIEWPORT)),actualScissor:new THREE.Vector4().fromArray(gl.getParameter(gl.SCISSOR_BOX)),actualScissorTest:gl.isEnabled(gl.SCISSOR_TEST),
    clear:renderer.getClearColor(new THREE.Color()).clone(),alpha:renderer.getClearAlpha(),autoClear:renderer.autoClear,autoClearColor:renderer.autoClearColor,autoClearDepth:renderer.autoClearDepth,autoClearStencil:renderer.autoClearStencil,
    toneMapping:renderer.toneMapping,exposure:renderer.toneMappingExposure,outputColorSpace:renderer.outputColorSpace,xr:renderer.xr.enabled,
    shadows:{enabled:renderer.shadowMap.enabled,autoUpdate:renderer.shadowMap.autoUpdate,needsUpdate:renderer.shadowMap.needsUpdate}};
  const metadata=previous?{viewport:previous.viewport.clone(),scissor:previous.scissor.clone(),scissorTest:previous.scissorTest}:null;
  const checks=[],check=(name,passed,evidence)=>checks.push({name,passed:!!passed,evidence});
  const resources=[],own=x=>(resources.push(x),x),scene=new THREE.Scene();
  let lights,metrics={};
  const relative=(a,b)=>Math.abs(a-b)/Math.max(1e-12,Math.abs(b));
  function attenuationFunction(){
    // Use the installed Three shader function, rather than another authored
    // copy of native attenuation. <common> supplies its pow2/pow4/saturate.
    const source=THREE.ShaderChunk.lights_pars_begin,start=source.indexOf('float getDistanceAttenuation(');
    if(start<0)throw new Error('Installed Three native attenuation function unavailable.');
    let depth=0,opened=false;
    for(let i=source.indexOf('{',start);i<source.length;i++){
      if(source[i]==='{'){depth++;opened=true;}else if(source[i]==='}'&&--depth===0&&opened)return source.slice(start,i+1);
    }
    throw new Error('Could not extract installed Three attenuation function.');
  }
  try{
    renderer.autoClear=renderer.autoClearColor=renderer.autoClearDepth=renderer.autoClearStencil=true;
    renderer.toneMapping=THREE.NoToneMapping;renderer.toneMappingExposure=1;renderer.outputColorSpace=THREE.LinearSRGBColorSpace;
    renderer.xr.enabled=false;renderer.shadowMap.enabled=false;renderer.shadowMap.autoUpdate=false;renderer.shadowMap.needsUpdate=false;
    renderer.setClearColor(0,0);renderer.setScissorTest(false);
    lights=createLocalLights(THREE,{scene,terrainHeight:()=>0});
    lights.configure({mode:'on',linked:false,lamps:[{enabled:true,brightness:1,color:'#ffffff'},{enabled:false,brightness:0},{enabled:false,brightness:0}],flashlight:{enabled:false}});
    lights.root.visible=false; // Fixture geometry must not hide the white card.
    const camera=new THREE.PerspectiveCamera(35,1,.001,100);camera.position.set(0,2,0);camera.lookAt(0,2,-1);camera.updateMatrixWorld();
    lights.update({frame:{time:0,dt:0,storageEV:0,sceneScale:1,rawPerCandela:3.6/100000},camera,sunAltitude:45,clusters:[],burstBounds:[]});
    const lamp=lights.records[0],centre=lamp.position.clone(),range=lamp.range,radius=lamp.radius;
    check('three_ground_points_only_slot0_white_enabled_no_cone',lights.records.slice(0,3).every(r=>r.light.isPointLight&&!r.light.castShadow)&&lamp.candela>0&&lights.records.slice(1).every(r=>r.candela===0)&&lights.uniforms.uLocalDirection.value[0].w===0,
      {types:lights.records.map(r=>r.light.isSpotLight?'spot':'point'),candela:lights.records.map(r=>r.candela),centre:centre.toArray(),radiusMetres:radius,rangeMetres:range});
    const material=own(new THREE.MeshStandardMaterial({color:0xffffff,metalness:0,roughness:1,toneMapped:false}));
    const card=new THREE.Mesh(own(new THREE.PlaneGeometry(.5,.5)),material);scene.add(card);
    const cardTarget=own(new THREE.WebGLRenderTarget(32,32,{type:THREE.FloatType,format:THREE.RGBAFormat,depthBuffer:true}));cardTarget.texture.colorSpace=THREE.NoColorSpace;
    function renderCard(angle){
      const radial=new THREE.Vector3(Math.cos(angle),0,Math.sin(angle));card.position.copy(centre).addScaledVector(radial,2);
      card.quaternion.setFromUnitVectors(new THREE.Vector3(0,0,1),radial.clone().negate());
      camera.position.copy(centre);camera.lookAt(card.position);camera.updateMatrixWorld();
      renderer.setRenderTarget(cardTarget);renderer.render(scene,camera);
      const p=new Float32Array(3*3*4);renderer.readRenderTargetPixels(cardTarget,14,14,3,3,p);
      const rgb=[0,0,0];for(let i=0;i<9;i++)for(let c=0;c<3;c++)rgb[c]+=p[i*4+c]/9;return rgb;
    }
    const cards=Array.from({length:8},(_,i)=>({azimuthDegrees:i*45,rgb:renderCard(i*Math.PI/4)}));
    const values=cards.flatMap(x=>x.rgb),mean=values.reduce((a,b)=>a+b,0)/values.length,spread=(Math.max(...values)-Math.min(...values))/Math.max(1e-12,mean);
    check('native_PBR_cards_receive_finite_positive_light_at_all8_azimuths',values.every(v=>Number.isFinite(v)&&v>1e-6),{cards,mean});
    check('native_equal_distance_white_card_360_isotropy',spread<.005,{relativePeakToPeak:spread,tolerance:.005,distanceMetres:2,cardMetres:.5,probe:'mean centre3x3 raw linear HDR, no sky/environment/fixture geometry'});
    card.visible=false;
    const distances=[0,.065,.1,.2,2],probeUniforms={...lights.uniforms,uDistances:{value:distances}};
    const probeMaterial=own(new THREE.ShaderMaterial({uniforms:probeUniforms,depthTest:false,depthWrite:false,toneMapped:false,
      vertexShader:'void main(){gl_Position=vec4(position.xy,0.,1.);}',
      fragmentShader:`precision highp float;#include <common>
        ${attenuationFunction()}
        ${lights.glsl}
        uniform float uDistances[5];
        void main(){int i=int(gl_FragCoord.x);vec3 p=uLocalPosition[0].xyz+vec3(uDistances[i],0.,0.);vec3 L;vec3 E=localIncident(p,0,L);
          float actualDistance=length(uLocalPosition[0].xyz-p);
          float nativeE=uLocalColour[0].r*getDistanceAttenuation(actualDistance,uLocalCone[0].z,2.);
          gl_FragColor=vec4(E.r,nativeE,length(L),1.);}`.replace('float;#include','float;\n#include')}));
    const probeScene=new THREE.Scene(),probeCamera=new THREE.OrthographicCamera(-1,1,1,-1,0,1);
    probeScene.add(new THREE.Mesh(own(new THREE.PlaneGeometry(2,2)),probeMaterial));
    const probeTarget=own(new THREE.WebGLRenderTarget(5,1,{type:THREE.FloatType,format:THREE.RGBAFormat,depthBuffer:false}));probeTarget.texture.colorSpace=THREE.NoColorSpace;
    function renderProbe(){renderer.setRenderTarget(probeTarget);renderer.render(probeScene,probeCamera);const p=new Float32Array(20);renderer.readRenderTargetPixels(probeTarget,0,0,5,1,p);return distances.map((distance,i)=>({distance,custom:p[4*i],native:p[4*i+1],directionLength:p[4*i+2],alpha:p[4*i+3]}));}
    const samples=renderProbe(),maxNativeError=Math.max(...samples.map(x=>relative(x.custom,x.native)));
    check('actual_localIncident_GPU_is_finite_at_zero_radius_and_near_distances',samples.every(x=>Object.values(x).every(Number.isFinite)&&x.custom>=0&&x.directionLength>=0&&x.directionLength<1.00001)&&samples[0].directionLength===0,{samples});
    check('custom_ground_attenuation_matches_installed_native_Three_function',maxNativeError<2e-5,{maximumRelativeError:maxNativeError,tolerance:2e-5,nativeSource:'THREE.ShaderChunk.lights_pars_begin.getDistanceAttenuation',samples});
    const capSpread=(Math.max(...samples.slice(0,3).map(x=>x.custom))-Math.min(...samples.slice(0,3).map(x=>x.custom)))/samples[0].custom;
    check('ground_near_point_cap_matches_native_without_changing_diffuser_radius',capSpread<1e-4&&radius===.065&&samples[3].custom<samples[2].custom&&samples[4].custom<samples[3].custom,
      {relativeCapSpread:capSpread,radiusMetres:radius,expectedNativeDenominatorFloorSquareMetres:.01,scope:'punctual approximation, not an exact finite-sphere near-field integral'});
    const nativeP0=cards[0].rgb,customP0=samples.map(x=>x.custom);
    lights.setSceneExposure(1);card.visible=true;const nativeP1=renderCard(0);card.visible=false;const customP1=renderProbe().map(x=>x.custom);
    const nativeCompensatedError=Math.max(...nativeP1.map((v,i)=>relative(v*.5,nativeP0[i]))),customCompensatedError=Math.max(...customP1.map((v,i)=>relative(v*.5,customP0[i])));
    check('P_plus1_native_and_custom_double_once_display_compensation_preserves_values',nativeCompensatedError<.001&&customCompensatedError<.001,
      {nativeP0,nativeP1,customP0,customP1,nativeCompensatedRelativeError:nativeCompensatedError,customCompensatedRelativeError:customCompensatedError,scope:'raw HDR factor2 then explicit output factor1/2; not tone-mapped subjective brightness'});
    const emitter=lights.root.children[0]?.children.find(o=>o.geometry?.type==='SphereGeometry');
    const emission=emitter?.material?.emissive?.toArray(),expected=lamp.rawRGB.map(v=>2*v/(Math.PI*radius*radius));
    const emissionError=emission?Math.max(...emission.map((v,i)=>relative(v,expected[i]))):Infinity;
    check('emitting_sphere_keeps_I_over_pi_r_squared_and_single_P_scaling',emissionError<1e-10&&expected.every(v=>Number.isFinite(v)&&v>0),{emission,expected,relativeError:emissionError,radiusMetres:radius,reference:'actual material emissive vs same physical/reference candela divided by projected sphere area'});
    metrics={cards,relativeIsotropySpread:spread,samples,maxNativeAttenuationRelativeError:maxNativeError,nativeCompensatedError,customCompensatedError,emissionError};
  }finally{
    lights?.dispose();for(const resource of resources)resource.dispose();
    renderer.autoClear=saved.autoClear;renderer.autoClearColor=saved.autoClearColor;renderer.autoClearDepth=saved.autoClearDepth;renderer.autoClearStencil=saved.autoClearStencil;
    renderer.toneMapping=saved.toneMapping;renderer.toneMappingExposure=saved.exposure;renderer.outputColorSpace=saved.outputColorSpace;renderer.xr.enabled=saved.xr;Object.assign(renderer.shadowMap,saved.shadows);
    renderer.setClearColor(saved.clear,saved.alpha);renderer.setViewport(saved.viewport);renderer.setScissor(saved.scissor);renderer.setScissorTest(saved.scissorTest);
    if(previous){previous.viewport.copy(saved.actualViewport);previous.scissor.copy(saved.actualScissor);previous.scissorTest=saved.actualScissorTest;}
    try{renderer.setRenderTarget(previous,face,mip);}finally{if(previous){previous.viewport.copy(metadata.viewport);previous.scissor.copy(metadata.scissor);previous.scissorTest=metadata.scissorTest;}}
    renderer.state.viewport(saved.actualViewport);renderer.state.scissor(saved.actualScissor);renderer.state.setScissorTest(saved.actualScissorTest);
  }
  const sameVector=(a,b)=>a.toArray().every((v,i)=>v===b.getComponent(i));
  check('renderer_target_viewports_scissor_clear_colour_tone_XR_and_shadow_state_restored',renderer.getRenderTarget()===previous&&renderer.getActiveCubeFace()===face&&renderer.getActiveMipmapLevel()===mip&&
    sameVector(renderer.getViewport(new THREE.Vector4()),saved.viewport)&&sameVector(renderer.getScissor(new THREE.Vector4()),saved.scissor)&&renderer.getScissorTest()===saved.scissorTest&&
    Array.from(gl.getParameter(gl.VIEWPORT)).every((v,i)=>v===saved.actualViewport.getComponent(i))&&Array.from(gl.getParameter(gl.SCISSOR_BOX)).every((v,i)=>v===saved.actualScissor.getComponent(i))&&gl.isEnabled(gl.SCISSOR_TEST)===saved.actualScissorTest&&
    renderer.getClearColor(new THREE.Color()).equals(saved.clear)&&renderer.getClearAlpha()===saved.alpha&&renderer.autoClear===saved.autoClear&&renderer.autoClearColor===saved.autoClearColor&&renderer.autoClearDepth===saved.autoClearDepth&&renderer.autoClearStencil===saved.autoClearStencil&&
    renderer.toneMapping===saved.toneMapping&&renderer.toneMappingExposure===saved.exposure&&renderer.outputColorSpace===saved.outputColorSpace&&renderer.xr.enabled===saved.xr&&Object.entries(saved.shadows).every(([k,v])=>renderer.shadowMap[k]===v));
  return {date:new Date().toISOString(),passed:checks.every(c=>c.passed),passedCount:checks.filter(c=>c.passed).length,total:checks.length,checks,metrics,
    scope:'isolated actual production local lights, native PBR8azimuth cards and actual localIncident GPU probes; fixture root hidden',
    limits:['Not a whole-island performance benchmark or subjective fixture-design acceptance','Point-light near-field attenuation is a bounded proxy, not a finite-area-light solution','No absolute lux/SPL or calibrated photographic claim','Only ground lamps tested; torch and pyro regressions belong to their existing fixtures']};
}
