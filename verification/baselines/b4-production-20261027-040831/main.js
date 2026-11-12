import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { createWater } from './water.js';
import { createVegetation } from './vegetation.js';
import { initUI } from './ui.js';
import { waveGLSL, waveComponents,waveWindFactor,sanitizeSeaState } from './waves.js';
import { createWaveSpectrum } from './spectral-waves.js';
import { createCaustics } from './caustics.js';
import { createHydrodynamics } from './hydrodynamics.js';
import { createFloatingLeaves } from './floating-leaves.js';
import { createSand } from './sand.js';
import { createCameraNavigation } from './camera-navigation.js';
import { createStoneThrow } from './stone-throw.js';
import { estimateLeafSurface } from './floating-leaves.js';
import { createLens } from './lens.js';
import { createQualityGovernor } from './quality-governor.js';
import { createRenderBenchmark } from './render-benchmark.js';
import { createAtmosphere } from './sky.js';
import { applyCloudLighting,createCloudShadowCache } from './cloud-lighting.js';
import { createIndirectLighting } from './indirect-lighting.js';
import { createShadowQuality } from './shadow-quality.js';
import { createHDROutput,fetchDisplayHDR,resolveHDRCalibration } from './hdr-output.js';
import { createSoundscape } from './audio.js';
import { createSplash } from './splash.js';
import { createAerialPerspective,marineAirCoefficients } from './aerial-perspective.js';
import { createCelestialController,exactCelestialEphemeris } from './celestial-controller.js';
import { createSceneRadiometry,RAW_PER_CANDELA } from './scene-radiometry.js';
import { createLocalLights } from './local-lights.js';
import { createEnvironmentCapture } from './environment-capture.js';
import { createFireworks } from './fireworks.js';
import { createFireworksAudio } from './fireworks-audio.js';
import { DEFAULT_QUALITY,getQualityPreset,resolveQualityPreset } from './quality-presets.js';
import { fitPerspectiveBounds } from './camera-framing.js';

const parameters={sun:{azimuth:100,elevation:48,intensity:1},quality:'high',paused:false,sound:false,wind:1.8,current:.16,lens:{focal:28,aperture:8,exposure:0,dof:false,vignette:true,antialias:'smaa',automatic:false}};
parameters.lens.temporal=true;
parameters.lens.glintAA=true;
parameters.weather={humidity:.68,temperature:29,cloudBase:'auto',thickness:950,coverage:.35,shear:1.1};
parameters.air={enabled:true,aerosolScale:8,shadows:true};
parameters.graphics={indirect:'low',shadows:'recommended',targetFps:60,hdr:false,hdrMode:'auto',displayName:'auto',systemCalibration:true,peakNits:1000,paperWhiteNits:203};
parameters.sea={swellHeight:.16,windSea:1};
parameters.lens.opticalBloom=true;parameters.lens.focusMode='target';parameters.lens.focusDistance=60;
parameters.graphics.waveResolution=512;
parameters.qualityPreset=DEFAULT_QUALITY;parameters.renderSampling=getQualityPreset(DEFAULT_QUALITY).request;parameters.qualityCustom=false;
let renderer,scene,camera,controls,water,grove,sky,sunLight,hemi,pmrem,environmentTarget,skyCubeTarget,cubeCamera,caustics,hydrodynamics,floatingLeaves,sand;
let time=0,frames=0,lastFPS=performance.now(),fps=0,transition=null,environmentTimer;
const sunDirection=new THREE.Vector3(),keyDirection=new THREE.Vector3();
const clock=new THREE.Clock();
const size=new THREE.Vector2();
const raycaster=new THREE.Raycaster(),seaPlane=new THREE.Plane(new THREE.Vector3(0,1,0),0);
const pointer=new THREE.Vector2(),hit=new THREE.Vector3();
const fish=[];
let splashes,stoneThrow,pendingThrow,focusPicking=false,navigation,impactLocator=null,leafLocatorUntil=0;
let soundscape,atmosphere,environmentScene;
let cloudShadowCache,indirectLighting,shadowQuality,hdrOutput,displayReport=null,hdrCalibration=null,lastDisplaySignature=null,refreshingDisplay=null;
let nightSettings={date:'2026-10-26T22:00',autoExposure:true},lastSolarExposure=null;
let celestialController,celestialFrame,localLights,environmentCapture,fireworks,fireworksAudio,frameSnapshot=null,qualityApplying=false,throwGesture=null;
const radiometry=createSceneRadiometry();let adaptedCameraEV=null,lastUIUpdate=-1,lastFramedLaunches=0;
const fireworksSettings={type:'peony',autoLaunch:false,autoDirection:true,azimuth:110,elevation:78,autoFrame:false};
let waveSpectrum;
let causticQuality='high';
let lastCubeTime=-1,lastPmremTime=-1,cubeFace=0;
const audioForward=new THREE.Vector3();
let shoreline=[];
const acousticWaves=waveComponents.filter(w=>w.k<12).map(w=>({...w,dx:Math.cos(w.angle),dz:Math.sin(w.angle),omega:Math.sqrt((9.81*w.k+.000070244*w.k**3)*Math.tanh(Math.min(w.k*3,4)))}));
let inspection;
let gpuTimer,gpuMs=null,frameIndex=0;
let lastShadowTime=-1;
let effectiveWind=1.8;
let lens,governor,aerialPerspective,renderScale=1,lastAirMieScale=null;
let renderBenchmark,nextGpuFrame=0,frameProbe=null;
let activeFrameProfile=null;
let lastPausedRenderKey=null,pausedSteadyFrames=0,pausedRenderCached=false;
const gpuQueries=[];
const views={
  shore:{position:[-48,12,-40],target:[0,2.5,0]},
  lagoon:{position:[41,4,39],target:[-3,2.6,-3]},
  aerial:{position:[84,84,92],target:[2,-.5,0]},
  stars:{position:[38,2.5,-46],target:[5,26,4]},
  moon:{position:[-48,2.5,26],target:[4,36,-2]}
};
Object.assign(views,{sandbar:{position:[42,2.8,-7],target:[10,2,0]},palm:{position:[-18,2.2,14],target:[-4,8,-5]},reef:{position:[72,9,4],target:[10,.5,0]},waterline:{position:[-33,1.25,-23],target:[-8,3,-2]},island:{position:[-65,30,54],target:[2,3,0]}});
const ui=initUI({
  onTimeChange(value){return setTime(value);},
  onTimePreset(name){return setNightPreset(name);},
  onLocationChange(value){return setTime(value);},
  onWeatherPreset(name){return setWeatherPreset(name);},
  onQualityPreset(id){return applyQualityPreset(id);},
  onLampChange(value){localLights?.configure(value);refreshLocalSettings();},
  onLampMode(mode){localLights?.configure({mode});refreshLocalSettings();},
  onFlashlightChange(value){localLights?.configure({flashlight:value});refreshLocalSettings();},
  onFireworksChange(value){Object.assign(fireworksSettings,value);fireworks?.configure(value);lastPausedRenderKey=null;},
  onLaunchFirework(){return launchFirework();},
  onStopFireworks(){fireworksSettings.autoLaunch=false;fireworks?.stop();ui.syncFireworks(fireworksSettings);},
  onFocusPick(){focusPicking=true;renderer.domElement.focus({preventScroll:true});renderer.domElement.style.cursor='crosshair';ui.notify('点选希望清晰的物体；Esc 取消');},
  onRestorePivot(){navigation?.restorePivot();},
  onHome(){navigation?.stop();moveTo('shore');},
  onNightPreset(name){return setNightPreset(name);},
  onNightChange(value){return setNightScene(value);},
  onRefreshDisplay(){return refreshDisplay();},
  onGraphicsChange(value){return setGraphics(value);},
  onSeaChange(value){setSea(value);},
  onSunChange(value){Object.assign(parameters.sun,value);if(celestialController)celestialFrame=celestialController.configure({mode:'artistic'});setSun();syncTimeUI();},
  onView(name){moveTo(name);},
  async onReset(){nightSettings.autoExposure=true;await setNightPreset('day');moveTo('shore');},
  onQuality(value){return applyQualityPreset(value==='balanced'?'balanced':'high');},
  onLensChange(value){const changed=['antialias','temporal','glintAA','opticalBloom'].some(k=>k in value&&value[k]!==parameters.lens[k]);Object.assign(parameters.lens,value);if(changed)markCustomQuality();setLens();},
  onPause(value){parameters.paused=value;},
  async onSound(value){try{await setSound(value);parameters.sound=value;}catch(error){parameters.sound=false;await setSound(false);throw error;}},
  onDrop(){throwFromCamera(null,.45);},
  onWind(value){parameters.wind=value;},
  onCurrent(value){parameters.current=value;setCurrent();},
  onFloat(){return floatAtVisibleWater();},
  onFindLeaf(){return focusLeaf();},
  onWeatherChange(value){setWeather(value);},
  onAirChange(value){Object.assign(parameters.air,value);lens?.resetTemporalHistory('air parameters');setAir();},
  onScreenshot(){savePhoto();}
});

// A rounded coral cay with a long, asymmetric sand tongue and submerged shelf.
// The exact same function is used by planting, ray picking and the mesh.
export function terrainHeight(x,z){
  const xx=x+1.5, zz=z+1;
  const a=Math.atan2(zz/19,xx/30);
  let r=Math.hypot(xx/30,zz/19);
  r*=1.+.045*Math.sin(a*3.+.8)+.028*Math.cos(a*5.-1.2)+.017*Math.sin(a*9.);
  let h;
  if(r<1.25) h=1.30-1.30*Math.pow(r,2.25);
  else h=-.85-(r-1.25)*3.7;
  // Keep a broad pale lagoon shelf, before the reef falls away to deeper blue.
  h-=Math.max(0.,r-2.7)*5.;
  const spit=.65-((x-26.)*(x-26.)/330.+(z-7.)*(z-7.)/72.);
  h=Math.max(h,spit);
  h+=.027*Math.sin(x*1.1+z*.27)*Math.sin(z*.82-x*.21)*Math.exp(-Math.max(0.,r-1.)*.8);
  return Math.max(-32,h);
}

const noiseGLSL=/* glsl */`
  float h2(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
  float n2(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(h2(i),h2(i+vec2(1,0)),f.x),mix(h2(i+vec2(0,1)),h2(i+1.),f.x),f.y);}
  float fb(vec2 p){float f=0.;float a=.5;for(int i=0;i<5;i++){f+=a*n2(p);p=mat2(1.6,-1.2,1.2,1.6)*p;a*=.5;}return f;}
`;

async function init(){
  // Geometry MSAA is on the HDR scene target. The final full-screen quad does
  // not need a second multisampled canvas or a preserved swap-chain buffer.
  renderer=new THREE.WebGLRenderer({antialias:false,alpha:true,preserveDrawingBuffer:false,powerPreference:'high-performance'});
  renderer.setPixelRatio(Math.min(devicePixelRatio,1.65));
  renderer.outputColorSpace=THREE.SRGBColorSpace;
  renderer.toneMapping=THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure=.76;
  renderer.shadowMap.enabled=true;
  renderer.shadowMap.type=THREE.PCFSoftShadowMap;
  renderer.shadowMap.autoUpdate=false;
  renderer.shadowMap.needsUpdate=true;
  gpuTimer=renderer.getContext().getExtension('EXT_disjoint_timer_query_webgl2');
  renderer.domElement.setAttribute('aria-label','热带玻璃海。WASD或方向键平移，QE旋转，RF俯仰，Shift加速。右拖自由看，左拖环绕，Alt点击移动中心，Home还原。点击海面投石。');
  renderer.domElement.tabIndex=0;
  document.querySelector('#scene').appendChild(renderer.domElement);
  scene=new THREE.Scene();
  // Finite camera-to-surface atmospheric transport is applied once after the
  // HDR scene, for land, foliage and water alike. No fixed-colour fog layer.
  camera=new THREE.PerspectiveCamera(40,innerWidth/innerHeight,.15,24000);
  camera.filmGauge=36;camera.setFocalLength(parameters.lens.focal);
  camera.position.fromArray(views.shore.position);
  controls=new OrbitControls(camera,renderer.domElement);
  controls.target.fromArray(views.shore.target);
  controls.enableDamping=true;controls.dampingFactor=.065;
  controls.minDistance=.75;controls.maxDistance=230;
  controls.minPolarAngle=.03;controls.maxPolarAngle=Math.PI-.06;
  controls.maxTargetRadius=1500;
  controls.panSpeed=.45;controls.rotateSpeed=.46;controls.zoomSpeed=.7;
  controls.screenSpacePanning=true;
  controls.addEventListener('start',()=>{transition=null;pendingThrow=null;if(fireworksSettings.autoFrame){fireworksSettings.autoFrame=false;ui.syncFireworks(fireworksSettings);}});
  navigation=createCameraNavigation(THREE,{camera,controls,canvas:renderer.domElement,onActivity(){transition=null;pendingThrow=null;if(fireworksSettings.autoFrame){fireworksSettings.autoFrame=false;ui.syncFireworks(fireworksSettings);}}});
  lens=createLens(renderer,camera);
  await lens.ready;
  hdrOutput=await createHDROutput(THREE,renderer,{maxHz:120,onStateChange(info){parameters.graphics.hdr=info.enabled;ui.setHDRSupport(info);lastPausedRenderKey=null;}});
  lens.setHDROutput(hdrOutput);ui.setHDRSupport(hdrOutput.state);
  displayReport=await fetchDisplayHDR();await applyDisplaySettings();
  governor=createQualityGovernor({onScale(value){renderScale=value;resize();}});
  renderBenchmark=createRenderBenchmark(()=>({viewport:[innerWidth,innerHeight],dpr:devicePixelRatio,renderScale,lens:lens.state,water:water?.diagnostics?.(),spectrum:waveSpectrum?.state,performance:governor.state,parameters:structuredClone(parameters),atmosphere:atmosphere?.diagnostics(),audio:soundscape?.state,camera:camera.position.toArray(),target:controls.target.toArray()}));
  setLens();
  ui.setStats({loading:'展开真实晴空…'});
  atmosphere=createAtmosphere(THREE,{sunDirection,cloudSteps:64,cloudCoverage:.35,weather:parameters.weather});
  atmosphere.setCloudBaseContinuity(1);
  // A clear initial location in the same 3-D weather field. This is set once;
  // subsequent advection/evolution can bring these clouds over the island.
  atmosphere.uniforms.uCloudWeatherOrigin.value.set(.421875,.734375);
  await atmosphere.ready;
  celestialController=createCelestialController({utcMs:Math.floor(Date.now()/86400000)*86400000+(12-118.6/15)*3600000,latitude:4.5,longitude:118.6,rate:1,running:true,mode:'astronomical'});
  celestialFrame=celestialController.state;atmosphere.setCelestial(celestialFrame);atmosphere.setStorageExposureEV(0);
  sky=atmosphere.mesh;scene.add(sky);
  // Its vertex shader writes far depth (z=w). Draw after opaque geometry so
  // early depth rejection avoids marching atmosphere hidden by sea and sand.
  sky.renderOrder=10000;
  hemi=new THREE.HemisphereLight('#c8e9ff','#b6a78a',.65);hemi.layers.enable(1);scene.add(hemi);
  sunLight=new THREE.DirectionalLight('#fff5df',3.65);
  sunLight.castShadow=true;
  sunLight.shadow.autoUpdate=false;sunLight.shadow.needsUpdate=true;
  sunLight.layers.enable(1);
  sunLight.shadow.mapSize.set(4096,4096);
  Object.assign(sunLight.shadow.camera,{left:-50,right:50,top:45,bottom:-40,near:1,far:260});
  sunLight.shadow.normalBias=.035;sunLight.shadow.bias=-.00012;
  sunLight.shadow.radius=2;
  scene.add(sunLight);
  scene.add(sunLight.target);
  localLights=createLocalLights(THREE,{scene,terrainHeight});
  environmentCapture=createEnvironmentCapture(THREE,renderer,{atmosphere,onPublish(info){skyCubeTarget=info.cubeTarget;environmentTarget=info.environmentTarget;scene.environment=info.environmentTexture;if(water)water.uniforms.uSkyCube.value=info.cubeTexture;}});
  applySolarLighting();environmentCapture.initialize({time,utcMs:celestialFrame.utcMs,storageEV:0,physicalRevision:celestialFrame.physicalSkyRevision,sunDirection:celestialFrame.sunDirection});
  skyCubeTarget=environmentCapture.cubeTarget;environmentTarget=environmentCapture.environmentTarget;
  ui.setStats({loading:'让阳光穿过浅海…'});
  const loader=new THREE.TextureLoader();
  const textures=await Promise.all(['clean-sand/sand_02_diff_2k.jpg'].map(name=>loader.loadAsync(`./assets/${name}`)));
  textures.forEach(t=>{t.wrapS=t.wrapT=THREE.RepeatWrapping;t.anisotropy=Math.min(renderer.capabilities.getMaxAnisotropy(),12);});
  textures[0].colorSpace=THREE.SRGBColorSpace;
  grove=createVegetation(THREE,{terrainHeight,seed:40219});
  // Select the transported rest geometry before fitting shadows or sampling
  // GI emitters. Diagnostic switching later requires GI off explicitly.
  grove.userData.setPalmFrameMode('transport');scene.add(grove);
  grove.userData.sunDirection.value.copy(keyDirection);
  grove.userData.sunColor?.value.copy(sunLight.color);
  if(grove.userData.windStrength)grove.userData.windStrength.value=parameters.wind;
  shadowQuality=createShadowQuality(THREE,renderer,sunLight,grove);
  indirectLighting=createIndirectLighting(THREE,{terrainHeight,grove,sunLight,atmosphere,quality:parameters.graphics.indirect});
  makeCoralAndShells();
  updateEnvironment();
  cloudShadowCache=createCloudShadowCache(renderer,atmosphere);cloudShadowCache.update(time,true);
  aerialPerspective=createAerialPerspective(THREE,renderer,{camera,atmosphere,sunLight,localLights});
  lens.setAerialPerspective(aerialPerspective);setAir();
  ui.setStats({loading:'让潮流绕过沙洲…'});
  hydrodynamics=createHydrodynamics(THREE,renderer,{terrainHeight,extent:72,resolution:384});
  waveSpectrum=createWaveSpectrum(THREE,renderer,{resolution:parameters.graphics.waveResolution});waveSpectrum.update(0,true);
  water=createWater(renderer,scene,camera,keyDirection,{terrainHeight,skyCube:skyCubeTarget.texture,sandTexture:textures[0],atmosphere,waveSpectrum,sunLight,indirectLighting,localLights});
  Object.assign(water.uniforms,hydrodynamics.uniforms);
  water.uniforms.uHydroEnabled.value=1;
  setCurrent();setSea(parameters.sea);
  water.uniforms.uIntensity.value=1;
  water.uniforms.uSunIrradiance.value=sunLight.intensity;
  water.uniforms.uSunColor.value.copy(sunLight.color);
  caustics=createCaustics(THREE,renderer,{waveGLSL,uniforms:water.uniforms,terrainHeight,sunDirection:keyDirection,extent:64,gridSegments:1536,textureSize:2048,heightmapSize:1024,maxHz:24});
  water.uniforms.uCaustic.value=caustics.texture;
  water.uniforms.uCausticExtent.value=caustics.extent;
  caustics.update(0,true);
  makeTerrain(textures);
  Object.assign(water.uniforms,sand.albedoUniforms);
  floatingLeaves=createFloatingLeaves(scene,{uniforms:water.uniforms,hydrodynamics,terrainHeight});
  stoneThrow=createStoneThrow(THREE,{scene,onImpact:dropStone,terrainHeight,surfaceHeight:(x,z,t)=>estimateLeafSurface(water.uniforms,x,z,t)});
  splashes=createSplash(THREE,{scene,uniforms:water.uniforms,sunDirection:keyDirection,sampleSurfaceHeight:(x,z,t)=>estimateLeafSurface(water.uniforms,x,z,t)});
  fireworks=createFireworks(THREE,{terrainHeight,origin:[29,0,7],seed:14271});scene.add(fireworks.rig);fireworks.configure(fireworksSettings);
  scene.traverse(object=>{if(object.isMesh){for(const material of Array.isArray(object.material)?object.material:[object.material])applyCloudLighting(material,atmosphere);}});
  applyCloudLighting(floatingLeaves.material,atmosphere);
  applyCloudLighting(stoneThrow.material,atmosphere);indirectLighting.apply(stoneThrow.material);indirectLighting.apply(floatingLeaves.material);
  scene.traverse(object=>{if(object.isMesh)for(const material of Array.isArray(object.material)?object.material:[object.material])indirectLighting.apply(material);});
  scene.traverse(object=>{if(object.isMesh)for(const material of Array.isArray(object.material)?object.material:[object.material])localLights.apply(material);});
  await indirectLighting.ready;
  updateIndirect(true);
  shoreline=createShoreline();
  soundscape=createSoundscape({shoreline,palmPosition:[-7,10,-2],onWarning:message=>console.warn(message)});
  fireworksAudio=createFireworksAudio({getContext:()=>soundscape.context,getOutput:()=>soundscape.eventOutput,isEnabled:()=>soundscape.state.enabled,getListenerPosition:()=>camera.position.toArray(),onWarning:message=>console.warn(message)});
  lens.setEffectsRenderer(drawFiniteEffects);water.setEffectsRenderer(drawFiniteEffects);
  await applyQualityPreset(parameters.qualityPreset);
  updateScenePhotometry(0,true);syncTimeUI();refreshLocalSettings();ui.syncFireworks(fireworksSettings);
  document.addEventListener('visibilitychange',()=>soundscape.update({paused:parameters.paused||document.hidden}));
  if(new URLSearchParams(location.search).get('inspect')==='caustic'){
    const inspectScene=new THREE.Scene();
    inspectScene.add(new THREE.Mesh(new THREE.PlaneGeometry(2,2),new THREE.MeshBasicMaterial({map:caustics.texture,toneMapped:false})));
    inspection={scene:inspectScene,camera:new THREE.OrthographicCamera(-1,1,1,-1,0,2)};inspection.camera.position.z=1;
  }
  bindInteraction();
  addEventListener('resize',resize);
  resize();controls.update();
  addEventListener('focus',()=>{if(!document.hidden&&parameters.graphics.hdrMode==='auto')refreshDisplay();});
  matchMedia('(dynamic-range: high)').addEventListener('change',()=>refreshDisplay());
  setInterval(()=>{if(!document.hidden&&parameters.graphics.hdrMode==='auto'&&parameters.graphics.displayName==='auto')refreshDisplay();},30000);
  // Warm up the real shader programs before dismissing the loading state.
  renderer.compile(scene,camera);
  frame();
  ui.setReady();
  window.__ATOLL__={
    get state(){return {ready:true,time,fps,gpuMs,renderScale,pausedRenderCached,pausedSteadyFrames,parameters:structuredClone(parameters),lens:lens.state,caustics:{quality:causticQuality,gridSegments:caustics.gridSegments,maxHz:caustics.maxHz},performance:governor.state,camera:camera.position.toArray(),target:controls.target.toArray(),ripples:water.uniforms.uRipples.value.map(v=>v.toArray()),triangles:lens.state.sceneStats.triangles,drawCalls:lens.state.sceneStats.calls,leaves:floatingLeaves.state};},
    setMotionEnabled(value){lens.setMotionEnabled(value);},
    navigation(){return navigation.state;},
    celestial(){return celestialController.state;},
    setTime, timePreset:setNightPreset,weatherPreset:setWeatherPreset,
    setWeather,
    photometry(){return {...radiometry.state,frame:frameSnapshot,environment:environmentCapture.state};},
    localLights(){return localLights.state;},
    setLocalLights(value){localLights.configure(value);refreshLocalSettings();return localLights.state;},
    fireworks(){return {...fireworks.diagnostics(),settings:{...fireworksSettings},bounds:fireworks.getBounds(),audio:fireworksAudio.diagnostics()};},
    setFireworks(value){Object.assign(fireworksSettings,value);const result=fireworks.configure(value);ui.syncFireworks(fireworksSettings);return result;},
    launchFirework,
    throwStone:throwFromCamera,
    setQuality:applyQualityPreset,
    shaderSamplers(){const gl=renderer.getContext(),types=new Set([gl.SAMPLER_2D,gl.SAMPLER_CUBE,gl.SAMPLER_3D,gl.SAMPLER_2D_ARRAY,gl.SAMPLER_2D_SHADOW,gl.SAMPLER_CUBE_SHADOW,gl.SAMPLER_2D_ARRAY_SHADOW,gl.INT_SAMPLER_2D,gl.UNSIGNED_INT_SAMPLER_2D]);return {fragmentLimit:gl.getParameter(gl.MAX_TEXTURE_IMAGE_UNITS),programs:renderer.info.programs.map(p=>{const samplers=[];for(let i=0,n=gl.getProgramParameter(p.program,gl.ACTIVE_UNIFORMS);i<n;i++){const u=gl.getActiveUniform(p.program,i);if(types.has(u.type))samplers.push({name:u.name,size:u.size});}return {name:p.name,linked:!!gl.getProgramParameter(p.program,gl.LINK_STATUS),count:samplers.reduce((s,u)=>s+u.size,0),samplers};})};},
    async inspectRadiance(){const {readRadianceRange}=await import('./verification/radiance-range-gpu-check.js');return {...await lens.inspectRadiance(),reflection:await readRadianceRange(THREE,renderer,water.reflection.texture,water.reflection.width,water.reflection.height),photometry:radiometry.state};},
    async runFireworksCheck(){const {runFireworksGPUCheck}=await import('./verification/fireworks/gpu-check.js');return runFireworksGPUCheck(THREE,renderer,createFireworks);},
    async runFireworksOpticsCheck(){const {runFireworksOpticsGPUCheck}=await import('./verification/fireworks/optics-gpu-check.js');return runFireworksOpticsGPUCheck(THREE,renderer,createFireworks);},
    async runFireworksTrailCheck(){const {runFireworksTrailABGPUCheck}=await import('./verification/fireworks/trail-ab-gpu-check.js');return runFireworksTrailABGPUCheck(THREE,renderer,createFireworks,{capture:true});},
    async runFireworksBoundCheck(){const {runFireworksBoundGPUCheck}=await import('./verification/fireworks/bound-gpu-check.js');return runFireworksBoundGPUCheck(THREE,renderer,createFireworks);},
    async runFireworksContactCheck(){const {runFireworksContactCheck}=await import('./verification/fireworks/contact-gpu-check.js');return runFireworksContactCheck(THREE,renderer,createFireworks);},
    async runFireworksAudioABCheck(){const {runFireworksAudioABCheck}=await import('./verification/fireworks/audio-ab-check.js');return runFireworksAudioABCheck({capture:true});},
    async runCelestialDiscCheck(){const {runCelestialDiscCheck}=await import('./verification/celestial-disc-gpu-check.js');return runCelestialDiscCheck(THREE,renderer,atmosphere);},
    async runStarFieldCheck(){const {runStarFieldCheck}=await import('./verification/star-field-gpu-check.js');return runStarFieldCheck(THREE,renderer,atmosphere);},
    async runCelestialZeroCheck(){const {runCelestialZeroCheck}=await import('./verification/celestial-zero-gpu-check.js');return runCelestialZeroCheck(THREE,renderer,atmosphere);},
    async runCelestialZeroCostCheck(){const {runCelestialZeroCostCheck}=await import('./verification/celestial-zero-cost-gpu.js');return runCelestialZeroCostCheck(THREE,renderer,atmosphere,{camera,width:lens.state.width,height:lens.state.height,cubePosition:[0,2,0]});},
    async runRadianceRangeCheck(){const {runRadianceRangeGPUCheck}=await import('./verification/radiance-range-gpu-check.js');return runRadianceRangeGPUCheck(THREE,renderer);},
    interactions(){return {stones:stoneThrow.state,splashes:splashes.state,pending:!!pendingThrow};},
    pickFocus(u,v){return lens.pickFocus(u,v);},
    night(){const light=atmosphere.lighting();return {settings:nightSettings,lighting:Object.fromEntries(Object.entries(light).map(([k,v])=>[k,v?.isColor||v?.isVector3?v.toArray():v]))};},
    display(){return {report:displayReport,calibration:hdrCalibration};},
    refreshDisplay,
    setNight:setNightScene,nightPreset:setNightPreset,
    graphics(){return {indirect:indirectLighting.diagnostics(),shadows:shadowQuality.diagnostics(),hdr:hdrOutput.state};},
    setGraphics,
    setSea,
    async runNightCheck(){const {runNightSkyCheck}=await import('./verification/night-sky-gpu-check.js');return runNightSkyCheck(THREE,renderer,atmosphere);},
    async runVegetationMotionCheck(){const {runVegetationMotionGPUCheck}=await import('./verification/vegetation-motion-gpu-check.js');const {selectiveTemporalGLSL}=await import('./lens.js');return runVegetationMotionGPUCheck(THREE,renderer,grove,camera,selectiveTemporalGLSL);},
    async runSeaStateCheck(){const {runSeaStateCheck}=await import('./verification/sea-state-gpu-check.js');return runSeaStateCheck(THREE,renderer);},
    async runIndirectCheck(){const {runIndirectLightingGPUCheck}=await import('./verification/indirect-lighting-gpu-check.js');return runIndirectLightingGPUCheck(THREE,renderer,indirectLighting);},
    setLens(value){Object.assign(parameters.lens,value);setLens();ui.syncLens(parameters.lens);},
    setRenderScale(value){renderScale=THREE.MathUtils.clamp(value,.6,1);resize();},
    benchmark(seconds=12){if(parameters.paused)throw new Error('Resume the scene before benchmarking rendering');return renderBenchmark.start(seconds);},
    setFrameProbe(callback){frameProbe=typeof callback==='function'?callback:null;},
    profileFrames(seconds=10){activeFrameProfile={started:performance.now(),until:performance.now()+seconds*1000,frames:[]};return true;},
    frameProfile(){return activeFrameProfile;},
    get audio(){return soundscape.state;},
    captureAudio(){return soundscape.startCapture();},
    stopAudioCapture(){return soundscape.stopCapture();},
    async renderAudio(options){const result=await soundscape.renderOffline(options);let binary='';for(let i=0;i<result.wav.length;i+=32768)binary+=String.fromCharCode(...result.wav.subarray(i,i+32768));return {report:result.report,wavBase64:btoa(binary)};},
    atmosphere(){return {lighting:atmosphere.lighting(),diagnostics:atmosphere.diagnostics(),cloudShadowAtIsland:atmosphere.cloudShadowAt([0,1,0]),shadowCache:cloudShadowCache.state,sharedSun:{sceneRGB:sunLight.color.toArray(),waterRGB:water.uniforms.uSunColor.value.toArray(),leafRGB:grove.userData.sunColor.value.toArray(),sceneIntensity:sunLight.intensity,waterIntensity:water.uniforms.uSunIrradiance.value}};},
    setSun(value){Object.assign(parameters.sun,value);celestialFrame=celestialController.configure({mode:'artistic'});setSun();syncTimeUI();},
    setView:moveTo,
    setCamera(position,target){navigation.stop();transition=null;camera.position.fromArray(position);controls.target.fromArray(target);controls.update();},
    drop(x,z){dropStone(x,z);},
    float(x,z){return floatingLeaves.spawn(x,z);},
    flow(x,z){return hydrodynamics.sampleFlow(x,z);},
    spectrum(){return waveSpectrum.state;},
    treeShadows(){return water.treeShadow.diagnostics();},
    waterDiagnostics(){return water.diagnostics();},
    cloudShape(value){atmosphere.uniforms.uCloudShapeBlend.value=Math.max(0,Math.min(2,value));cloudShadowCache.update(time,true);updateIndirect(true);updateEnvironment();lens.resetTemporalHistory('cloud shape');return atmosphere.uniforms.uCloudShapeBlend.value;},
    cloudDensityAt(position,physicalTime=time){return atmosphere.cloudDensityAt(position,physicalTime);},
    setCloudBaseContinuity(value){
      const flag=atmosphere.setCloudBaseContinuity(value);
      lastPausedRenderKey=null;lens.resetTemporalHistory('cloud base continuity');
      cloudShadowCache.update(time,true);updateIndirect(true);caustics?.update(time,true);updateEnvironment();
      return flag;
    },
    async runCloudBaseContinuityCheck(){const {runCloudBaseContinuityGPUCheck}=await import('./verification/cloud-base-continuity-gpu-check.js');return runCloudBaseContinuityGPUCheck(THREE,renderer,atmosphere);},
    weather(){return atmosphere.getWeatherState();},
    air(){return aerialPerspective.diagnostics();},
    setAir(value){Object.assign(parameters.air,value);lens.resetTemporalHistory('air parameters');setAir();},
    leafDebug(value){lastPausedRenderKey=null;lens.resetTemporalHistory('leaf diagnostic');return grove.userData.setLeafDebug?.(value);},
    setLeafCentroid(value){lastPausedRenderKey=null;lens.resetTemporalHistory('centroid colour diagnostic');return grove.userData.setCentroidColour(value);},
    setPalmFrameMode(mode){
      // A diagnostic switch cannot reuse GI emitter patches built from the
      // other rest geometry. Final production selection rebuilds the scene.
      if(parameters.graphics.indirect!=='off')throw new Error('Palm frame A/B requires indirect lighting off; emitter geometry is cached at scene construction.');
      const result=grove.userData.setPalmFrameMode(mode);
      if(result.changed){lastPausedRenderKey=null;lens.resetTemporalHistory('palm cross-section frame');scene.traverse(o=>{if(o.isLight&&o.shadow)o.shadow.needsUpdate=true;});renderer.shadowMap.needsUpdate=true;}
      return result;
    },
    palmFrameDiagnostics(){return grove.userData.palmFrameDiagnostics();},
    async runPalmFrameCoverageCheck(){const {runPalmFrameCoverageCheck}=await import('./verification/palm-frame-coverage-gpu-check.js');return runPalmFrameCoverageCheck(THREE,renderer,grove);},
    async runPalmFrameCostCheck(){const {runPalmFrameCostGPUCheck}=await import('./verification/palm-frame-cost-gpu-check.js');return runPalmFrameCostGPUCheck(THREE,renderer,window.__ATOLL__,()=>lens.render(scene,camera.position.distanceTo(controls.target),{sdr:true}));},
    async runLeafCentroidCheck(){const {runLeafCentroidCheck}=await import('./verification/leaf-centroid-gpu-check.js');return runLeafCentroidCheck(THREE,renderer);},
    vegetationDiagnostics(){return grove.userData.diagnostics?.();},
    leafMips(){return grove.userData.inspectLeafMips?.(renderer);},
    async textureAudit(){
      const {auditTextureMipmaps}=await import('./verification/mipmap-audit.js?v=2');
      const entries=[],seen=new Set();
      const add=(texture,label,policy,role)=>{if(!texture?.isTexture||seen.has(texture.uuid))return;seen.add(texture.uuid);entries.push({texture,label,policy,role});};
      scene.traverse(o=>{if(o.isMesh)for(const material of Array.isArray(o.material)?o.material:[o.material])for(const [key,value]of Object.entries(material))if(value?.isTexture)add(value,`${material.type}.${key}`,'mip','surface material');});
      for(const [name,uniform]of Object.entries(water.uniforms)){
        const mip=/^uWave[0-3]$|^uSand|^uReflect$|^uSkyCube$|^uCaustic$|^uCloudNoise$/.test(name);
        add(uniform.value,name,mip?'mip':/^uDepth$|Depth|ShadowMap/.test(name)?'exact':'numeric','water/shared field');
      }
      add(reflectionTexture(),'reflection depth','exact','visibility');
      add(sunLight.shadow.map?.texture,'directional RGBA packed depth','exact','PCF comparison');
      return auditTextureMipmaps(renderer,entries,{probeMutable:true});
      function reflectionTexture(){return water.reflection.depthTexture;}
    },
    async runAerialCheck(){const {runAerialGPUCheck}=await import('./verification/aerial-gpu-check.js');return runAerialGPUCheck(THREE,renderer);},
    async runWaterTemporalCheck(){const {runTemporalWaterCheck}=await import('./verification/temporal-water-gpu-check.js');const {selectiveTemporalGLSL}=await import('./lens.js');return runTemporalWaterCheck(THREE,renderer,selectiveTemporalGLSL);},
    async waterVariance(regions){const {createWaterVarianceProbe}=await import('./verification/flicker-audit.js?v=3');const probe=createWaterVarianceProbe(THREE,renderer,water,camera);try{return probe.read(regions);}finally{probe.dispose();}},
    async replayFlicker({regions,frames=48,startTime=10,step=1/60,mode=0,kind='water'}={}){
      const {createFlickerAnalyzer,createBrowserSnapshotReader}=await import('./verification/flicker-audit.js?v=6');
      const saved={paused:parameters.paused,lens:{...parameters.lens},offset:water.uniforms.uCurrentOffset.value.clone(),debug:water.uniforms.uDebugMode.value};
      const reader=createBrowserSnapshotReader(),reports={};parameters.paused=true;frames=Math.max(16,Math.min(96,frames));
      try{
        for(const enabled of [false,true]){
          parameters.lens[kind==='water'?'glintAA':'temporal']=enabled;setLens();water.uniforms.uDebugMode.value=mode;
          const analyzer=createFlickerAnalyzer(regions,{warmupFrames:0});
          for(let frame=-32;frame<frames;frame++){
            const sampleTime=startTime+frame*step;
            water.uniforms.uCurrentOffset.value.copy(saved.offset).addScaledVector(water.uniforms.uMeanCurrent.value,sampleTime-time);
            waveSpectrum.update(sampleTime,true);grove.userData.update(sampleTime);water.uniforms.uTime.value=sampleTime;
            caustics.update(sampleTime);sunLight.shadow.needsUpdate=true;renderer.shadowMap.needsUpdate=true;
            water.render(sampleTime);lens.render(scene,camera.position.distanceTo(controls.target));
            if(frame>=0)analyzer.push({timestamp:frame*step*1000,simulationTime:sampleTime,cameraKey:JSON.stringify([camera.position.toArray(),controls.target.toArray()]),phase:null,renderScale,regions:reader.read(renderer.domElement,regions)});
          }
          reports[enabled?'enabled':'disabled']=analyzer.finish();
        }
        return {kind:'Controlled identical-time directional-wave/wind replay; same camera, sky, hydro snapshot and source phases',captureMethod:'browser-2d-snapshot',frames,startTime,step,mode,scope:kind,reports,limits:['Bounded QA render, not production frame-rate measurement','SWE snapshot and sky/cloud field remain fixed; caustics and foliage shadow update at replay times','Residual includes real wave/wind motion; not all reduction is removal of sampling noise']};
      }finally{
        parameters.paused=saved.paused;Object.assign(parameters.lens,saved.lens);setLens();water.uniforms.uDebugMode.value=saved.debug;
        water.uniforms.uCurrentOffset.value.copy(saved.offset);waveSpectrum.update(time,true);grove.userData.update(time);water.uniforms.uTime.value=time;caustics.update(time,true);sunLight.shadow.needsUpdate=true;renderer.shadowMap.needsUpdate=true;lastPausedRenderKey=null;reader.dispose();
      }
    },
    setWeather,
    get splashes(){return splashes.state;},
    floatVisible(){return floatAtVisibleWater();},
    locateLeaf(){return floatingLeaves.locate(camera,{viewportWidth:innerWidth,viewportHeight:innerHeight});},
    focusLeaf,
    hydroDiagnostics(){return hydrodynamics.diagnostics({readback:true});},
    async runHydroCheck(){const {runHydroCheck}=await import('./verification/hydro-gpu-check.js');return runHydroCheck(THREE,renderer,createHydrodynamics);},
    async runSpectrumCheck(version=1){const {runSpectrumCheck}=await import(`./verification/spectral-gpu-check.js?v=${version}`);return runSpectrumCheck(THREE,renderer,waveSpectrum);},
    async runTemporalCheck(){const {runTemporalResolveCheck}=await import('./verification/temporal-aa-gpu-check.js');const {selectiveTemporalGLSL}=await import('./lens.js');return runTemporalResolveCheck(THREE,renderer,selectiveTemporalGLSL);},
    async runTemporalSequenceCheck(version=1){const {runTemporalSequenceCheck}=await import(`./verification/temporal-sequence-gpu-check.js?v=${version}`);const {selectiveTemporalGLSL}=await import('./lens.js');return runTemporalSequenceCheck(THREE,renderer,selectiveTemporalGLSL);},
    async runWeatherCheck(){const {runWeatherCheck}=await import('./verification/weather-gpu-check.js');return runWeatherCheck(THREE,renderer,atmosphere);},
    pause(value=true){parameters.paused=value;ui.setPaused(value);},
    debugFill(hemiIntensity,environmentIntensity){hemi.intensity=hemiIntensity;scene.environmentIntensity=environmentIntensity;},
    diagnostics(){return {sandSource:sandShader?.fragmentShader,sandUniforms:{sun:sunDirection.toArray(),texture:sandShader?.uniforms.uSand.value.image?.width},sand:sand.metadata,vegetation:grove.userData.diagnostics?.(),sceneMeshes:scene.children.filter(o=>o.isMesh).map(o=>({name:o.name,y:o.position.y,material:o.material.type})),sky:sky.userData};},
    debugSand(mode=0){sandShader.uniforms.uSandInspect.value=mode;},
    debugWater(mode=0){water.uniforms.uDebugMode.value=mode;},
    reflectionDiagnostics(){return inspectTarget(water.reflection);},
    debugBuffer(name){
      if(!name){inspection=null;return;}
      const texture=name==='shadow'?sunLight.shadow.map.texture:name==='reflection'?water.reflection.texture:name==='refraction'?water.refraction.texture:caustics.texture;
      const inspectMaterial=name==='shadow'?new THREE.ShaderMaterial({uniforms:{uInput:{value:texture}},toneMapped:false,vertexShader:'varying vec2 vUv;void main(){vUv=uv;gl_Position=vec4(position.xy,0.,1.);}',fragmentShader:'#include <packing>\nuniform sampler2D uInput;varying vec2 vUv;void main(){float d=unpackRGBAToDepth(texture2D(uInput,vUv));gl_FragColor=vec4(vec3(d),1.);}'}):new THREE.MeshBasicMaterial({map:texture,toneMapped:true});
      const inspectScene=new THREE.Scene();inspectScene.add(new THREE.Mesh(new THREE.PlaneGeometry(2,2),inspectMaterial));
      inspection={scene:inspectScene,camera:new THREE.OrthographicCamera(-1,1,1,-1,0,2)};inspection.camera.position.z=1;
    },
    screenshot(){lens.render(scene,camera.position.distanceTo(controls.target),{sdr:true});return renderer.domElement.toDataURL('image/png');}
  };
}

let sandShader;
function makeTerrain(textures){
  const geometry=new THREE.PlaneGeometry(2,2,560,560).rotateX(-Math.PI/2);
  const p=geometry.attributes.position;
  const spread=v=>Math.sign(v)*(Math.abs(v)<.88?Math.abs(v)/.88*68:68+(Math.abs(v)-.88)/.12*170);
  for(let i=0;i<p.count;i++){const x=spread(p.getX(i)),z=spread(p.getZ(i));p.setXYZ(i,x,terrainHeight(x,z),z);}
  geometry.computeVertexNormals();
  sand=createSand(THREE,{geometry,textures,sunDirection:keyDirection,getCaustics:()=>caustics,terrainHeight,onCompile:shader=>{sandShader=shader;}});
  sand.mesh.castShadow=true;
  scene.add(sand.mesh,sand.detailGroup);
  const bottom=new THREE.Mesh(new THREE.PlaneGeometry(18000,18000).rotateX(-Math.PI/2),new THREE.MeshStandardMaterial({color:'#d9d1b3',roughness:1}));bottom.position.y=-33;scene.add(bottom);
}

function makeCoralAndShells(){
  const rng=seeded(39821);
  const material=new THREE.MeshStandardMaterial({color:'#e5d9bd',roughness:.94});
  const geometry=new THREE.IcosahedronGeometry(1,1);
  const coral=new THREE.InstancedMesh(geometry,material,130);
  coral.layers.enable(1);
  const matrix=new THREE.Matrix4(),q=new THREE.Quaternion(),scale=new THREE.Vector3();
  for(let i=0;i<130;i++){
    const a=rng()*Math.PI*2,r=1.+rng()*.8;
    const x=Math.cos(a)*32*r,z=Math.sin(a)*20*r;
    const h=terrainHeight(x,z);const s=.015+rng()*.07;
    q.setFromEuler(new THREE.Euler(rng()*3,rng()*6,rng()*3));
    scale.set(s,s*(.25+rng()*.5),s*(.6+rng()*.8));
    matrix.compose(new THREE.Vector3(x,h+s*.13,z),q,scale);coral.setMatrixAt(i,matrix);
    coral.setColorAt(i,new THREE.Color().setHSL(.09+rng()*.04,.08+rng()*.13,.63+rng()*.2));
  }
  coral.castShadow=coral.receiveShadow=true;scene.add(coral);
}
function seeded(seed){return ()=>{seed=(Math.imul(1664525,seed)+1013904223)|0;return (seed>>>0)/4294967296;};}
function makeFish(){
  const material=new THREE.MeshStandardMaterial({color:'#72918a',metalness:.12,roughness:.4});
  const bodyGeo=new THREE.SphereGeometry(1,12,6);
  const tailGeo=new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(0,0,0),new THREE.Vector3(-.16,.14,0),new THREE.Vector3(-.16,-.14,0)]);tailGeo.setIndex([0,1,2]);tailGeo.computeVertexNormals();
  for(let i=0;i<7;i++){
    const group=new THREE.Group();
    const body=new THREE.Mesh(bodyGeo,material);body.scale.set(.23,.075,.055);group.add(body);
    const tail=new THREE.Mesh(tailGeo,new THREE.MeshStandardMaterial({color:'#5e8178',side:THREE.DoubleSide,roughness:.6}));tail.position.x=-.2;group.add(tail);
    group.position.set(21+i*.8,-.75-i*.07,20+i*.24);scene.add(group);fish.push({group,tail,offset:i*.7});
  }
}

function setSun(refresh=true){
  if(!sky)return;
  lens?.resetTemporalHistory?.('sun');
  const s=parameters.sun;
  const e=THREE.MathUtils.degToRad(s.elevation),a=THREE.MathUtils.degToRad(s.azimuth);
  sunDirection.set(Math.cos(e)*Math.sin(a),Math.sin(e),-Math.cos(e)*Math.cos(a));
  sky.material.uniforms.sunPosition.value.copy(sunDirection);
  sky.material.uniforms.uSkyIntensity.value=s.intensity;
  sunLight.position.copy(sunDirection).multiplyScalar(110);
  atmosphere.setSun({direction:sunDirection,intensity:s.intensity});
  applySolarLighting();
  if(renderer){sunLight.shadow.needsUpdate=true;renderer.shadowMap.needsUpdate=true;}
  shadowQuality?.update();updateIndirect(true);
  cloudShadowCache?.update(time,true);
  ui.syncSun(s);
  if(refresh){clearTimeout(environmentTimer);environmentTimer=setTimeout(updateEnvironment,170);}
}
function applySolarLighting(){
  const s=parameters.sun,lighting=atmosphere.lighting();
  keyDirection.copy(lighting.keyDirection||sunDirection);
  sunLight.position.copy(keyDirection).multiplyScalar(110);
  const scale=radiometry.state.sceneScale;
  sunLight.intensity=3.6*(lighting.physicalKeyStrength??lighting.physicalSunStrength??lighting.keyStrength??lighting.sunStrength)*scale;
  sunLight.color.copy(lighting.keyColor||lighting.sunColor);
  sunLight.castShadow=sunLight.intensity>1e-8;
  document.body.classList.toggle('night-view',(lighting.nightBlend||0)>.5);
  updateExposure(lighting);
  // The HDR already supplies diffuse skylight. Keep the extra ground/sky fill
  // small enough to preserve the direct-sun / shade ratio on white coral sand.
  // Sky irradiance comes from the same radiance cube. This hemisphere is only
  // a bounded white-sand ground-bounce approximation, strongest on leaf undersides.
  hemi.color.setRGB(0,0,0);hemi.groundColor.setRGB(0,0,0);hemi.intensity=1;
  // skyTintPhysical already includes the artistic solar intensity. Applying it
  // again here would square only the water ambient while land/sky stay linear.
  if(water)water.uniforms.uIntensity.value=1;
  if(water)water.uniforms.uSunIrradiance.value=sunLight.intensity;
  if(water)water.uniforms.uSunColor.value.copy(sunLight.color);
  if(water)water.uniforms.uSkyColor.value.copy(lighting.skyTintPhysical||lighting.skyTint).multiplyScalar(1.7*scale);
  if(grove)grove.userData.sunDirection.value.copy(keyDirection);
  if(grove?.userData.sunColor)grove.userData.sunColor.value.copy(sunLight.color);
  if(grove?.userData.sunIrradiance)grove.userData.sunIrradiance.value=sunLight.intensity;
  if(grove?.userData.translucencyIntensity)grove.userData.translucencyIntensity.value=1;
}
function setWeather(value){
  Object.assign(parameters.weather,value);if(!atmosphere)return null;
  const state=atmosphere.setWeather(value,{immediate:parameters.paused});
  setAir();updateScenePhotometry(0,true);
  lens?.resetTemporalHistory?.('weather');
  if(parameters.paused){cloudShadowCache?.update(time,true);clearTimeout(environmentTimer);environmentTimer=setTimeout(updateEnvironment,170);}
  updateIndirect(parameters.paused);
  return state;
}
function setAir(){
  if(!atmosphere)return;
  const weather=atmosphere.getWeatherState().current;
  const coefficients=marineAirCoefficients({humidity:weather.humidity,aerosolScale:parameters.air.aerosolScale});
  const mieScale=coefficients.normalizedMieScale;
  if(lastAirMieScale===null||Math.abs(mieScale-lastAirMieScale)>1e-4){
    atmosphere.setAirMieScale(mieScale);lastAirMieScale=mieScale;
    applySolarLighting();
  }
  aerialPerspective?.configure({...parameters.air,quality:parameters.quality});
  aerialPerspective?.update({time,weather,sunDirection:keyDirection,quality:parameters.quality,sunLight});
}
function updateEnvironment(){
  if(environmentCapture){const c=celestialController?.state;environmentCapture.refresh({time,utcMs:c?.utcMs,storageEV:radiometry.state.storageEV,physicalRevision:c?.physicalSkyRevision,sunDirection:sunDirection});applyEnvironmentRatios();return;}
  skyCubeTarget.texture.generateMipmaps=true;
  sky.material.uniforms.uSolarDisk.value=0;
  cubeCamera.update(renderer,environmentScene);
  sky.material.uniforms.uSolarDisk.value=1;
  const old=environmentTarget;
  environmentTarget=pmrem.fromCubemap(skyCubeTarget.texture);
  scene.environment=environmentTarget.texture;
  scene.environmentIntensity=.8;
  if(old)old.dispose();
  lastPmremTime=time;lastCubeTime=time;cubeFace=0;
}
function updateDynamicEnvironment(){
  if(environmentCapture){const c=celestialFrame||celestialController.state;environmentCapture.update({time,utcMs:c.utcMs,storageEV:radiometry.state.storageEV,physicalRevision:c.physicalSkyRevision,sunDirection,paused:parameters.paused});applyEnvironmentRatios();return;}
  if(parameters.paused||time-lastCubeTime<1/12)return;
  const previous=renderer.getRenderTarget();
  sky.material.uniforms.uSolarDisk.value=0;
  skyCubeTarget.texture.generateMipmaps=cubeFace===5;
  renderer.setRenderTarget(skyCubeTarget,cubeFace);
  renderer.render(environmentScene,cubeCamera.children[cubeFace]);
  renderer.setRenderTarget(previous);
  sky.material.uniforms.uSolarDisk.value=1;
  cubeFace=(cubeFace+1)%6;lastCubeTime=time;
  if(cubeFace===0&&time-lastPmremTime>=2){
    const old=environmentTarget;environmentTarget=pmrem.fromCubemap(skyCubeTarget.texture);scene.environment=environmentTarget.texture;old?.dispose();lastPmremTime=time;
  }
}
function resize(){
  if(!renderer)return;
  // Even a same-size canvas reset discards its presented drawing buffer.
  // A paused view must redraw/reconverge after every resize notification.
  lastPausedRenderKey=null;pausedSteadyFrames=0;pausedRenderCached=false;
  const dpr=Math.min(devicePixelRatio,parameters.renderSampling?.dprCap??1.65);
  renderer.setPixelRatio(dpr);renderer.setSize(innerWidth,innerHeight);
  camera.aspect=innerWidth/innerHeight;camera.setFocalLength(parameters.lens.focal);
  renderer.getDrawingBufferSize(size);
  const sceneW=Math.max(1,Math.round(size.x*renderScale)),sceneH=Math.max(1,Math.round(size.y*renderScale));
  water?.resize(sceneW,sceneH,parameters.quality);
  lens?.setSize(sceneW,sceneH,size.x,size.y);
}
function setLens(){
  if(!renderer||!camera)return;
  camera.setFocalLength(parameters.lens.focal);
  updateExposure();
  lens?.configure({...parameters.lens,quality:parameters.quality,msaaSamples:parameters.renderSampling?.msaaSamples});
  if(water?.uniforms.uGlintAA)water.uniforms.uGlintAA.value=parameters.lens.glintAA?1:0;
  governor?.setTargetFps(parameters.graphics.targetFps);
  if(governor&&governor.state.enabled!==parameters.lens.automatic)governor.setEnabled(parameters.lens.automatic);
}
function updateExposure(lighting=atmosphere?.lighting?.()){
  if(renderer)renderer.toneMappingExposure=radiometry.state.outputExposureScale;
}
async function setNightScene(value={}){
  Object.assign(nightSettings,value);if(!atmosphere)return null;
  if(value.date){const hasZone=/Z$|[+-]\d\d:\d\d$/.test(value.date),offset=celestialController?.state.timeZoneOffsetMinutes??480,utc=Date.parse(hasZone?value.date:value.date+'Z')-(hasZone?0:offset*60000);ui.setNight({autoExposure:nightSettings.autoExposure});return setTime({utcMs:utc,mode:'astronomical'});}
  updateScenePhotometry(0,true);ui.setNight({autoExposure:nightSettings.autoExposure});syncTimeUI();return atmosphere.lighting();
}
async function setNightPreset(name){
  if(!celestialController)return;
  const c=celestialController.state,day=Math.floor(c.utcMs/86400000)*86400000,noon=day+(12-c.observer.longitudeDeg/15)*3600000;
  let utc=name==='moon'?Date.parse('2026-10-26T14:00:00Z'):name==='stars'?Date.parse('2026-08-13T14:00:00Z'):noon;
  if(name==='dawn'||name==='sunset'){const approx=noon+(name==='dawn'?-6:6)*3600000;let lo=approx-3*3600000,hi=approx+3*3600000;const altitude=t=>exactCelestialEphemeris(t,c.observer).sun.altitudeDeg+.30;let a=altitude(lo),b=altitude(hi);if(a*b>0){ui.notify('此地点今天没有对应的日出或日落，时间保持不变');return;}for(let i=0;i<20;i++){const mid=(lo+hi)/2,v=altitude(mid);if(a*v<=0)hi=mid;else{lo=mid;a=v;}}utc=(lo+hi)/2;}
  await setTime({utcMs:utc,mode:'astronomical'});ui.notify({day:'已切到当地白昼',dawn:'已切到当地黎明',sunset:'已切到当地日落',moon:'已切到月夜示例日期',stars:'已切到无月夜示例日期'}[name]||'时间已调整');
}
function updateIndirect(force=false,delta=1/60){
  const l=atmosphere?.lighting();indirectLighting?.setSceneExposure(radiometry.state.storageEV);
  indirectLighting?.update({time,delta:parameters.paused?0:delta,force,sunDirection:keyDirection,sunColor:sunLight?.color,sunIntensity:3.6*(l?.physicalKeyStrength??0)});
}
function arrayRGB(value,fallback=[0,0,0]){return value?.toArray?value.toArray():Array.isArray(value)?value:fallback;}
function currentOptics(){const l=lens?.state;return {width:l?.width||innerWidth,height:l?.height||innerHeight,focalMm:parameters.lens.focal,aperture:parameters.lens.aperture,focusMetres:l?.focusMetres||60,sensorHeightMm:camera?.getFilmHeight()||24,dof:parameters.lens.dof,vignette:parameters.lens.vignette,shutterSeconds:parameters.lens.shutterSeconds??1/120};}
function finiteAirPayload(){const light=atmosphere.lighting(),coefficients=marineAirCoefficients({...parameters.air,humidity:atmosphere.getWeatherState().current.humidity});return {...coefficients,enabled:parameters.air.enabled,sunDirection:keyDirection.toArray(),rawSunRGB:arrayRGB(light.keyColor).map(v=>v*3.6*(light.physicalKeyStrength??0)),ambientIrradianceRGB:arrayRGB(light.physicalSkyIrradiance)};}
function applyEnvironmentRatios(){if(!environmentCapture)return;const r=environmentCapture.setSceneExposure(radiometry.state.storageEV);scene.environmentIntensity=.8*r.environmentRatio;if(water){water.uniforms.uSkyCube.value=environmentCapture.cubeTarget.texture;water.uniforms.uSkyCubeScale.value=r.cubeRatio;}}
function updateScenePhotometry(delta=0,force=false){
  if(!atmosphere||!localLights||!camera)return;
  const light=atmosphere.lighting(),baseFrame={time,dt:delta,utcMs:celestialFrame?.utcMs,storageEV:radiometry.state.storageEV,sceneScale:radiometry.state.sceneScale,rawPerCandela:RAW_PER_CANDELA};
  atmosphere.prepareStarView(renderer,camera,{width:lens.state.width,height:lens.state.height,storageEV:baseFrame.storageEV,frame:baseFrame,optics:currentOptics()});
  const b=fireworks?.getBounds();localLights.update({frame:baseFrame,camera,sunAltitude:celestialFrame?.mode==='astronomical'?celestialFrame.sun.altitudeDeg:parameters.sun.elevation,clusters:fireworks?.getLightClusters()||[],burstBounds:b?.active?[{center:b.centre,radius:b.radius}]:[]});
  const local=localLights.getRadianceBound(),skyBound=atmosphere.getRadianceBound(),pyro=fireworks?.getRadianceBound({camera,optics:currentOptics(),rawPerCandela:RAW_PER_CANDELA})||{},pstate=fireworks?.diagnostics();
  const pyroMirror=water&&pstate?.active>0?fireworks.getRadianceBound({camera:water.prepareReflectionCamera(),optics:{...currentOptics(),width:water.reflection.width,height:water.reflection.height,dof:false,shutterSeconds:0},rawPerCandela:RAW_PER_CANDELA}):{};
  let targetC=nightSettings.autoExposure?(light.recommendedExposureEV||0):0;
  const lit=localLights.state,lamps=lit.lights.slice(0,3).reduce((v,s)=>Math.max(v,s.candela),0);
  if(nightSettings.autoExposure&&lamps>0)targetC=Math.min(targetC,18-Math.max(-2,Math.log2(lamps/30))*.45);
  if(nightSettings.autoExposure&&lit.flashlight.enabled)targetC=Math.min(targetC,16);
  if(nightSettings.autoExposure&&pstate?.active>0)targetC=Math.min(targetC,16.5);
  const adaptationSeconds=targetC<adaptedCameraEV ? .16 : 1.25;
  if(adaptedCameraEV===null||force)adaptedCameraEV=targetC;else adaptedCameraEV+=(targetC-adaptedCameraEV)*(1-Math.exp(-Math.max(0,delta)/adaptationSeconds));
  const night=(light.nightBlend||0)>.5,photometry=radiometry.update({recommendedEV:night?21:0,cameraExposureEV:adaptedCameraEV+parameters.lens.exposure,dt:delta,force,bounds:{sky:skyBound,locals:local,fireworks:Math.max(pyro.maximumRawRadiance||0,pyroMirror.maximumRawRadiance||0),medium:(local.maxRGB||0)*.25}});
  atmosphere.setStorageExposureEV(photometry.storageEV);localLights.setSceneExposure(photometry.storageEV);applySolarLighting();applyEnvironmentRatios();indirectLighting?.setSceneExposure(photometry.storageEV);
  lens?.setFrameExposure(photometry.storageEV,{dynamic:!parameters.paused&&!!(pstate?.active>0||celestialFrame?.running)});
  frameSnapshot={...baseFrame,...photometry,dt:parameters.paused?0:delta,adaptationDelta:delta,utcMs:celestialFrame?.utcMs,observer:celestialFrame?.observer,windVector:[effectiveWind*.936,0,effectiveWind*.352],weather:atmosphere.getWeatherState().current};
}
function drawFiniteEffects({renderer,target,camera,opaqueDepth=null,reflection=false,planeY=0,width,height,optics}){if(!fireworks||!frameSnapshot)return;fireworks.render({renderer,target,camera,opaqueDepth,reflection,planeY,frame:frameSnapshot,optics:{...currentOptics(),...optics,width:width||target.width,height:height||target.height},air:finiteAirPayload()});}
function syncTimeUI(){
  if(!celestialController)return;const c=celestialController.state,altitude=c.mode==='artistic'?parameters.sun.elevation:c.sun.altitudeDeg;
  ui.syncTime({utcMs:c.utcMs,rate:c.rate,running:c.running,mode:c.mode,observer:{latitude:c.observer.latitudeDeg,longitude:c.observer.longitudeDeg,height:c.observer.heightM},timeZoneOffsetMinutes:c.timeZoneOffsetMinutes,message:`${c.mode==='artistic'?'手动太阳':'太阳'} ${altitude.toFixed(1)}° · 月亮 ${c.moon.altitudeDeg.toFixed(1)}° · 月相 ${Math.round(c.moonPhase*100)}%`});
  ui.setNight({label:altitude>0?'晴空与海，随时间流转。':altitude>-12?'暮光，慢慢落在海上。':'夜色，环抱一座海岛。'});
}
function refreshLocalSettings(){if(!localLights)return;const s=localLights.state;ui.syncLamps(s);ui.syncFlashlight(s.flashlight);lastPausedRenderKey=null;lens?.resetTemporalHistory('local light parameters');if(atmosphere)updateScenePhotometry(0,true);}
async function setTime(patch={}){if(!celestialController)return;celestialFrame=celestialController.configure(patch);atmosphere.setCelestial(celestialFrame);if(celestialFrame.mode==='artistic')setSun(false);else{sunDirection.fromArray(celestialFrame.sunDirection);atmosphere.setSun({intensity:1});}updateScenePhotometry(0,true);shadowQuality?.update();cloudShadowCache?.update(time,true);updateIndirect(true);lens?.resetTemporalHistory('clock/location');updateEnvironment();syncTimeUI();lastPausedRenderKey=null;return celestialFrame;}
function setWeatherPreset(name){const presets={clear:{humidity:.55,temperature:29,coverage:.08,thickness:650,shear:.8},fair:{humidity:.68,temperature:29,coverage:.35,thickness:950,shear:1.1},cloudy:{humidity:.78,temperature:28,coverage:.72,thickness:1450,shear:1.8},humid:{humidity:.90,temperature:28,coverage:.28,thickness:850,shear:.7}};if(!presets[name])return;setWeather(presets[name]);ui.syncWeather(parameters.weather);ui.notify('天气预设已更新，时间与视角保持当前设置');}
async function applyQualityPreset(id=DEFAULT_QUALITY){
  parameters.qualityPreset=id;const requested=getQualityPreset(id),caps=renderer?{maxTextureSize:renderer.capabilities.maxTextureSize,sampleSupport:lens.state.sampleSupport}:{};const result=resolveQualityPreset(id,caps),q=result.effective;parameters.renderSampling=q;parameters.qualityCustom=false;qualityApplying=true;
  try{parameters.quality=q.msaaSamples>=8?'high':'balanced';parameters.graphics.waveResolution=q.waveResolution;parameters.graphics.shadows=({2048:'soft',4096:'recommended',6144:'fine',8192:'ultra'})[q.shadowSize]||'recommended';parameters.graphics.indirect=q.indirect;Object.assign(parameters.lens,{antialias:q.antialias,temporal:q.temporal,glintAA:q.glintAA,opticalBloom:q.opticalBloom});
    shadowQuality?.setSampling({size:q.shadowSize,hz:q.shadowHz});waveSpectrum?.setResolution(q.waveResolution);waveSpectrum?.update(time,true);caustics?.setSampling({grid:q.causticsGrid,size:q.causticsSize,hz:q.causticsHz});atmosphere?.setSampling?.({cloudSteps:q.cloudSteps,atmosphereSteps:q.atmosphereSteps});aerialPerspective?.setSampling?.({steps:q.airSteps,shadowTaps:q.airShadowTaps});water?.setSampling(q);indirectLighting?.setQuality(q.indirect);localLights?.setQuality({flashShadowSize:id==='low'?512:id==='ultra'?2048:1024,flashShadowHz:q.shadowHz});setLens();resize();caustics?.update(time,true);ui.syncGraphics(parameters.graphics);ui.syncLens(parameters.lens);ui.setQualityState({requested:id,effective:q,custom:false,limits:result.limits});lastPausedRenderKey=null;
    fireworks?.setQuality({trailSegments:({low:6,balanced:6,medium:8,high:12,ultra:16})[id]});
  }finally{qualityApplying=false;}return result;
}
function markCustomQuality(){
  if(qualityApplying)return;
  parameters.qualityCustom=true;
  const shadows=shadowQuality?.diagnostics();
  const effective={...parameters.renderSampling,
    ...(shadows?{shadowSize:shadows.mapSize[0],shadowHz:shadows.maxHz}:{}),
    ...(waveSpectrum?{waveResolution:waveSpectrum.state.resolution}:{}),
    indirect:parameters.graphics.indirect};
  parameters.renderSampling=effective;
  ui.setQualityState({requested:parameters.qualityPreset,effective,custom:true,limits:[]});
}
function frameFireworks(){
  const b=fireworks.getBounds();if(!b.active)return;
  const box=new THREE.Box3(new THREE.Vector3(-39,0,-27),new THREE.Vector3(44,18,30));box.expandByPoint(new THREE.Vector3(...b.min));box.expandByPoint(new THREE.Vector3(...b.max));
  const fit=fitPerspectiveBounds(THREE,camera,box,{eyeHeight:THREE.MathUtils.clamp(camera.position.y,2.5,12)});
  fit.position.y=Math.max(fit.position.y,terrainHeight(fit.position.x,fit.position.z)+1.6);
  controls.maxDistance=Math.max(controls.maxDistance,fit.distance*1.2);
  transition={start:performance.now(),from:camera.position.clone(),to:fit.position,targetFrom:controls.target.clone(),targetTo:fit.target};
}
function launchFirework(options={}){if(!fireworks)return;parameters.paused=false;ui.setPaused(false);fireworks.configure(fireworksSettings);const event=fireworks.launch({type:fireworksSettings.type,...options});if(fireworksSettings.autoFrame)frameFireworks();lastFramedLaunches=fireworks.diagnostics().launches;ui.notify('烟花已发射；手动移动可接管镜头');return event;}
function setSea(value){
  Object.assign(parameters.sea,sanitizeSeaState(value,parameters.sea));waveSpectrum?.setSeaState(parameters.sea);
  // Long boundary waves remain in the shallow-water validity regime. This is
  // an authored lagoon coupling, not a claim to full dispersive refraction.
  hydrodynamics?.setSwellState({amplitude:.015*parameters.sea.swellHeight/.16,period:20,groupiness:.35});
  lens?.resetTemporalHistory('sea state');caustics?.update(time,true);
  return waveSpectrum?.state;
}
async function setGraphics(value){
  const changed=new Set(Object.keys(value).filter(k=>value[k]!==parameters.graphics[k]));
  Object.assign(parameters.graphics,value);
  if(changed.has('indirect')){indirectLighting?.setQuality(parameters.graphics.indirect);updateIndirect(true);markCustomQuality();}
  if(changed.has('shadows')){shadowQuality?.setQuality(parameters.graphics.shadows);markCustomQuality();}
  governor?.setTargetFps(parameters.graphics.targetFps);
  if(waveSpectrum&&waveSpectrum.state.resolution!==parameters.graphics.waveResolution){waveSpectrum.setResolution(parameters.graphics.waveResolution);waveSpectrum.update(time,true);caustics?.update(time,true);markCustomQuality();}
  if(hdrOutput){
    await applyDisplaySettings();
    parameters.graphics.hdr=hdrOutput.state.enabled;
    ui.setHDRSupport(hdrOutput.state);
  }
  ui.syncGraphics(parameters.graphics);
  lastPausedRenderKey=null;lens?.resetTemporalHistory('graphics');
  return {parameters:{...parameters.graphics},hdr:hdrOutput?.state};
}
async function refreshDisplay(){if(refreshingDisplay)return refreshingDisplay;refreshingDisplay=(async()=>{displayReport=await fetchDisplayHDR();return applyDisplaySettings();})().catch(error=>{console.warn('Display refresh:',error.message);return null;}).finally(()=>{refreshingDisplay=null;});return refreshingDisplay;}
async function applyDisplaySettings(){
  if(!hdrOutput)return;
  const g=parameters.graphics;
  hdrCalibration=resolveHDRCalibration(displayReport,{deviceName:g.displayName==='auto'?undefined:g.displayName,...(g.systemCalibration?{}:{peakNits:g.peakNits,paperWhiteNits:g.paperWhiteNits})});
  if(g.systemCalibration){g.peakNits=hdrCalibration.peakNits;g.paperWhiteNits=hdrCalibration.paperWhiteNits;}
  const nativeAllows=!hdrCalibration.display||hdrCalibration.display.advancedColorEnabled;
  const verified=hdrCalibration.calibrationSource!=='unverified-fallback';
  const enable=g.hdrMode==='hdr'||g.hdrMode==='auto'&&hdrOutput.state.available&&nativeAllows&&verified;
  const signature=JSON.stringify([g.hdrMode,g.displayName,g.systemCalibration,hdrCalibration.peakNits,hdrCalibration.paperWhiteNits,hdrCalibration.sdrWhiteNits,hdrCalibration.calibrationSource,nativeAllows,enable]);
  if(signature===lastDisplaySignature&&hdrOutput.state.enabled===enable){ui.setDisplays(displayReport,hdrCalibration);ui.setHDRSupport(hdrOutput.state);return hdrCalibration;}
  lastDisplaySignature=signature;
  hdrOutput.configure({paperWhiteNits:hdrCalibration.paperWhiteNits,peakNits:hdrCalibration.peakNits,sdrWhiteNits:hdrCalibration.sdrWhiteNits,calibrationSource:hdrCalibration.calibrationSource,displayName:hdrCalibration.displayName});
  await hdrOutput.setEnabled(enable);g.hdr=hdrOutput.state.enabled;
  ui.setDisplays(displayReport,hdrCalibration);ui.setHDRSupport(hdrOutput.state);
  lastPausedRenderKey=null;return hdrCalibration;
}
function moveTo(name){
  if(!camera)return;
  let view=views[name];
  if(name==='sun'||name==='moon'){
    const direction=new THREE.Vector3(...(name==='moon'?celestialFrame.moonDirection:celestialFrame.sunDirection));
    if(name==='sun'&&celestialFrame.mode==='artistic')direction.copy(sunDirection);
    const position=new THREE.Vector3(-48,2.8,38),target=position.clone().addScaledVector(direction,100);
    view={position:position.toArray(),target:target.toArray()};
  }
  if(!view)return;
  if(fireworksSettings.autoFrame){fireworksSettings.autoFrame=false;ui.syncFireworks(fireworksSettings);}
  navigation?.stop();pendingThrow=null;
  transition={start:performance.now(),from:camera.position.clone(),to:new THREE.Vector3(...view.position),targetFrom:controls.target.clone(),targetTo:new THREE.Vector3(...view.target)};
}
function bindInteraction(){
  const canvas=renderer.domElement;
  const cancel=()=>{throwGesture=null;ui.setThrowCharge(0,false);};
  canvas.addEventListener('pointerdown',e=>{if(e.isPrimary&&e.button===0){canvas.focus({preventScroll:true});throwGesture={x:e.clientX,y:e.clientY,time:performance.now(),cancelled:false,picking:focusPicking||e.altKey};}});
  canvas.addEventListener('pointermove',e=>{if(throwGesture&&Math.hypot(e.clientX-throwGesture.x,e.clientY-throwGesture.y)>5){throwGesture.cancelled=true;ui.setThrowCharge(0,false);}});
  canvas.addEventListener('pointercancel',cancel);addEventListener('blur',cancel);
  document.addEventListener('visibilitychange',()=>{if(document.hidden)cancel();});
  canvas.addEventListener('pointerup',e=>{
    if(!throwGesture||!e.isPrimary||e.button!==0)return;
    const gesture=throwGesture;cancel();
    if(!gesture.cancelled&&Math.hypot(e.clientX-gesture.x,e.clientY-gesture.y)<5){
      if(gesture.picking){
        const uv=new THREE.Vector2(e.clientX/innerWidth,1-e.clientY/innerHeight),focus=lens.pickFocus(uv.x,uv.y);
        if(e.altKey&&focus.sky){focusPicking=false;canvas.style.cursor='';ui.notify('天空没有可移动的环绕中心，请点选地面或海面');return;}
        if(e.altKey&&!focus.sky){const p=new THREE.Vector3(uv.x*2-1,uv.y*2-1,.5).unproject(camera).sub(camera.position).normalize(),f=new THREE.Vector3();camera.getWorldDirection(f);navigation.setPivot(camera.position.clone().addScaledVector(p,focus.metres/Math.max(.01,p.dot(f))));ui.notify('已移动环绕中心，Home 可还原视角');}
        else{parameters.lens.focusMode='manual';parameters.lens.focusDistance=focus.metres;parameters.lens.dof=true;setLens();ui.syncLens(parameters.lens);ui.notify(`已对焦 ${focus.metres.toFixed(1)} 米`);}
        focusPicking=false;canvas.style.cursor='';return;
      }
      throwFromCamera({x:e.clientX,y:e.clientY},THREE.MathUtils.clamp((performance.now()-gesture.time)/1200,0,1));
    }
  });
  canvas.addEventListener('keydown',e=>{
    if(e.key==='Escape'){focusPicking=false;canvas.style.cursor='';pendingThrow=null;cancel();}
    if(['+','-','=','Enter'].includes(e.key))e.preventDefault();
    if(e.key==='Enter')throwFromCamera(null,.45);
    if(['+','-','='].includes(e.key)){const offset=camera.position.clone().sub(controls.target);offset.multiplyScalar(e.key==='-'?1.1:.9);navigation.stop();transition=null;camera.position.copy(controls.target).add(offset);controls.update();}
  });
  canvas.addEventListener('webglcontextlost',e=>{e.preventDefault();ui.setStats({error:'图形连接已中断，刷新页面可重新进入海岛。'});});
}
function throwFromCamera(clientPoint=null,charge=.45){
  if(!stoneThrow)return null;
  const rect=renderer.domElement.getBoundingClientRect();
  pointer.set(clientPoint?(clientPoint.x-rect.left)/rect.width*2-1:0,clientPoint?1-(clientPoint.y-rect.top)/rect.height*2:0);
  raycaster.setFromCamera(pointer,camera);parameters.paused=false;ui.setPaused(false);
  const event=stoneThrow.launchRay(camera,raycaster.ray.direction,charge,time);
  if(event)ui.notify(`已从镜头投出石子，力度 ${Math.round(charge*100)}%`,1400);
  return event;
}
function floatAtVisibleWater(){
  const suggestion=floatingLeaves.suggestSpawn(camera,{viewportHeight:innerHeight,maxDistance:350});
  if(suggestion&&floatingLeaves.spawn(suggestion.x,suggestion.z)){
    leafLocatorUntil=performance.now()+6500;ui.showLeafAvailable();
    if(suggestion.focusRecommended&&suggestion.focus){focusLeaf();ui.notify('已放下22厘米的叶片，并靠近查看',3200);}
    else ui.notify('叶片已放在圈出的水面上，会随潮流漂移',3200);
    return suggestion;
  }
  ui.notify('请把视角转向近处海面，再放下一片叶子');
  return null;
}
function focusLeaf(){
  const location=floatingLeaves.locate(camera,{viewportWidth:innerWidth,viewportHeight:innerHeight});
  if(!location?.focus){ui.notify('当前没有可观察的漂浮叶片');return false;}
  transition={start:performance.now(),from:camera.position.clone(),to:new THREE.Vector3(...location.focus.position),targetFrom:controls.target.clone(),targetTo:new THREE.Vector3(...location.focus.target)};
  leafLocatorUntil=performance.now()+6500;return true;
}
function setCurrent(){
  if(!hydrodynamics||!water)return;
  hydrodynamics.setCurrent(parameters.current);
  const reference=hydrodynamics.sampleFlow(60,60);
  water.uniforms.uMeanCurrent.value.set(reference.x,reference.z);
}
function dropStone(x,z,event={}){
  if(!water)return;
  if(event.kind==='land'||terrainHeight(x,z)>-.05){ui.notify('石子落在沙滩上',1500);return;}
  const impactTime=event.time??time,strength=THREE.MathUtils.clamp(Math.sqrt(Math.max(.02,event.energy??.5)/.5),.25,1.6);
  // Centimetre pebble, not a boulder: the old full-strength metre-wide impulse
  // carried several joules. These smaller visual/solver impulses fit its scale.
  water.impulse(x,z,impactTime,.10*strength);
  hydrodynamics.disturb(x,z,.20*strength);
  splashes.spawn(x,z,impactTime,strength,{stoneDiameter:event.diameter??.025,surfaceHeight:event.position?.[1]});
  soundscape?.splash(x,z,strength);
  impactLocator={point:new THREE.Vector3(x,estimateLeafSurface(water.uniforms,x,z,time),z),until:performance.now()+2800};
  ui.notify('石子落水，水花与涟漪正在散开',2000);
}

function frame(){
  requestAnimationFrame(frame);
  const frameStart=performance.now();
  const profile=activeFrameProfile&&frameStart<activeFrameProfile.until?{quality:parameters.qualityPreset,started:frameStart,phases:{},last:frameStart}:null;
  const mark=name=>{if(profile){const now=performance.now();profile.phases[name]=now-profile.last;profile.last=now;}};
  const delta=Math.min(clock.getDelta(),.055);
  if(document.hidden)return;
  const gl=renderer.getContext();
  if(gpuTimer&&gpuQueries.length&&gl.getQueryParameter(gpuQueries[0],gl.QUERY_RESULT_AVAILABLE)){
    const query=gpuQueries.shift();if(!gl.getParameter(gpuTimer.GPU_DISJOINT_EXT)){gpuMs=Number((gl.getQueryParameter(query,gl.QUERY_RESULT)/1e6).toFixed(3));renderBenchmark.gpu(gpuMs);}gl.deleteQuery(query);
  }
  let activeQuery=null;
  mark('timer-read');
  frameIndex++;
  if(!parameters.paused&&gpuTimer&&(renderBenchmark.active||frameIndex>=nextGpuFrame)&&gpuQueries.length<6){activeQuery=gl.createQuery();gl.beginQuery(gpuTimer.TIME_ELAPSED_EXT,activeQuery);nextGpuFrame=frameIndex+97+(frameIndex%37);}
  if(!parameters.paused){
    time+=delta;
    effectiveWind+=(parameters.wind-effectiveWind)*(1.-Math.exp(-delta/1.4));
    water.uniforms.uWind.value=waveWindFactor(effectiveWind);
    waveSpectrum.update(time);
    if(grove.userData.windStrength)grove.userData.windStrength.value=effectiveWind;
    water.uniforms.uCurrentOffset.value.addScaledVector(water.uniforms.uMeanCurrent.value,delta);
    hydrodynamics.update(delta,time);
    floatingLeaves.update(delta,time);
    grove?.userData.update?.(time);
    atmosphere.update({time,wind:effectiveWind,camera});
    if(sandShader)sandShader.uniforms.uSandTime.value=time;
    for(const f of fish){const t=time*.2+f.offset;f.group.position.set(24+Math.cos(t)*3,-.9+Math.sin(t*1.1)*.1,20+Math.sin(t)*2.);f.group.rotation.y=-t-Math.PI/2;f.tail.rotation.x=Math.sin(time*13+f.offset)*.25;}
  }
  mark('physical-simulation');
  celestialFrame=celestialController.update({time,dt:delta,paused:parameters.paused});
  atmosphere.setCelestial(celestialFrame);
  if(celestialFrame.mode==='astronomical'){sunDirection.fromArray(celestialFrame.sunDirection);if(atmosphere.uniforms.uSkyIntensity.value!==1)atmosphere.setSun({intensity:1});}
  else atmosphere.setSun({direction:sunDirection,intensity:parameters.sun.intensity});
  if(transition){
    const t=Math.min(1,(performance.now()-transition.start)/1450),a=t*t*(3.-2.*t);
    camera.position.lerpVectors(transition.from,transition.to,a);controls.target.lerpVectors(transition.targetFrom,transition.targetTo,a);
    if(t===1){transition=null;controls.maxDistance=Math.max(230,camera.position.distanceTo(controls.target)*1.001);controls.maxTargetRadius=Math.max(1500,controls.target.length()*1.001);}
  }
  const navigationChanged=navigation.update(delta);
  controls.update();
  if(pendingThrow&&performance.now()>=pendingThrow.at){const p=pendingThrow;pendingThrow=null;stoneThrow.launch(camera,p.x,p.z,time);}
  if(!parameters.paused)stoneThrow.update(time);
  // Keep the observer above the actual surface, including after panning on land.
  const floor=Math.max(.42,terrainHeight(camera.position.x,camera.position.z)+.5);
  if(camera.position.y<floor){const correction=floor-camera.position.y;camera.position.y=floor;if(navigationChanged)controls.target.y+=correction;camera.lookAt(controls.target);}
  camera.updateMatrixWorld();
  mark('celestial-navigation');
  if(!parameters.paused)fireworks.update({time,dt:delta,windVector:[effectiveWind*.936,0,effectiveWind*.352]});
  const pyroEvents=fireworks.drainEvents();
  fireworksAudio.enqueue(pyroEvents,{time,listenerPosition:camera.position.toArray(),temperature:atmosphere.getWeatherState().current.temperature,paused:parameters.paused});
  const launchCount=fireworks.diagnostics().launches;
  if(fireworksSettings.autoFrame&&launchCount>lastFramedLaunches)frameFireworks();
  lastFramedLaunches=launchCount;
  mark('firework-simulation-audio');
  setAir();updateScenePhotometry(delta);
  mark('photometry');
  splashes.update(delta,time,camera,lens.state.height);
  if(throwGesture&&!throwGesture.cancelled&&!throwGesture.picking)ui.setThrowCharge(Math.min(1,(performance.now()-throwGesture.time)/1200),true);
  if(impactLocator){const p=impactLocator.point.clone().project(camera);ui.locateImpact([(.5+p.x*.5)*innerWidth,(.5-p.y*.5)*innerHeight],performance.now()<impactLocator.until&&Math.abs(p.x)<1&&Math.abs(p.y)<1);if(performance.now()>=impactLocator.until)impactLocator=null;}
  ui.locateLeaf(performance.now()<leafLocatorUntil?floatingLeaves.locate(camera,{viewportWidth:innerWidth,viewportHeight:innerHeight}):null,performance.now()<leafLocatorUntil);
  cloudShadowCache.update(time);
  updateIndirect(false,delta);
  mark('locators-cloud-GI');
  updateDynamicEnvironment();
  mark('environment-capture');
  if(!parameters.paused&&time-lastShadowTime>=1/shadowQuality.hz){shadowQuality.update();sunLight.shadow.needsUpdate=true;renderer.shadowMap.needsUpdate=true;lastShadowTime=time;}
  if(localLights.shadowNeedsUpdate)renderer.shadowMap.needsUpdate=true;
  setAir();
  caustics.update(time);
  sand.update(time);
  mark('shadow-caustics-sand');
  // Once a paused view has settled, retain its presented canvas. Camera,
  // light, weather, lens, resize and environment changes immediately redraw.
  const roundedPose=values=>values.map(v=>Math.round(v*1e8)/1e8);
  const pausedKey=parameters.paused?JSON.stringify([roundedPose(camera.position.toArray()),roundedPose(controls.target.toArray()),parameters,renderScale,innerWidth,innerHeight,scene.environment?.uuid,water.uniforms.uDebugMode.value,frameSnapshot.storageEV,Math.round(frameSnapshot.outputExposureScale*1e10)/1e10,celestialFrame.physicalSkyRevision,localLights.state.flashlight]):null;
  if(!parameters.paused||pausedKey!==lastPausedRenderKey){pausedSteadyFrames=0;lastPausedRenderKey=pausedKey;}
  else pausedSteadyFrames++;
  pausedRenderCached=parameters.paused&&pausedSteadyFrames>40&&!inspection;
  if(!pausedRenderCached){atmosphere.prepareStarView(renderer,camera,{width:lens.state.width,height:lens.state.height,storageEV:frameSnapshot.storageEV,frame:frameSnapshot,optics:currentOptics()});water.render(time);mark('water-captures');lens.render(scene,camera.position.distanceTo(controls.target));mark('main-lens-display');}
  if(frameProbe){const callback=frameProbe;frameProbe=null;callback(frameStart);}
  if(inspection)renderer.render(inspection.scene,inspection.camera);
  if(activeQuery){gl.endQuery(gpuTimer.TIME_ELAPSED_EXT);gpuQueries.push(activeQuery);}
  if(!parameters.paused)governor.update({delta,gpuMs,cpuMs:performance.now()-frameStart,frameMs:delta*1000});
  frames++;
  const now=performance.now();
  if(now-lastUIUpdate>500){lastUIUpdate=now;syncTimeUI();const ps=fireworks.diagnostics();ui.syncFireworks({...fireworksSettings,active:ps.active,queued:ps.queued});ui.setNavigationStatus({speedMps:navigation.state.speedMetresPerSecond,message:'滚轮沿视线移动；按住右键滚轮调整移动速度'});}
  if(now-lastFPS>1000){fps=Math.round(frames*1000/(now-lastFPS));frames=0;lastFPS=now;ui.setStats({fps,focusMetres:lens.state.focusMetres});renderer.domElement.dataset.fps=String(fps);renderer.domElement.dataset.camera=JSON.stringify(camera.position.toArray());renderer.domElement.dataset.simulationTime=time.toFixed(3);renderer.domElement.dataset.ripples=String(water.uniforms.uRipples.value.filter(v=>time-v.z>=0&&time-v.z<7).length);}
  camera.getWorldDirection(audioForward);
  soundscape.update({time,wind:effectiveWind,cameraPosition:camera.position,cameraForward:audioForward,paused:parameters.paused,swellEnvelope:shoreSoundEnvelope()});
  fireworksAudio.update({paused:parameters.paused});
  mark('ui-audio');
  if(profile){profile.total=performance.now()-frameStart;delete profile.last;activeFrameProfile.frames.push(profile);}
  renderBenchmark.frame(frameStart,performance.now()-frameStart);
}

async function setSound(enabled){
  await soundscape.setEnabled(enabled);
  if(enabled)await fireworksAudio?.prepare();else fireworksAudio?.cancel();
}
function createShoreline(){
  return Array.from({length:96},(_,i)=>{
    const angle=i/96*Math.PI*2,dx=Math.cos(angle),dz=Math.sin(angle);
    let lo=0,hi=85;
    for(let j=0;j<20;j++){const r=(lo+hi)*.5;if(terrainHeight(-1.5+dx*r,-1+dz*r)>0)lo=r;else hi=r;}
    return [-1.5+dx*(lo+hi)*.5,.05,-1+dz*(lo+hi)*.5];
  });
}
function shoreSoundEnvelope(){
  if(!shoreline.length||!water)return .5;
  let nearest=shoreline[0],best=Infinity;
  for(const p of shoreline){const d=(p[0]-camera.position.x)**2+(p[2]-camera.position.z)**2;if(d<best){best=d;nearest=p;}}
  const offset=water.uniforms.uCurrentOffset.value,wind=water.uniforms.uWind.value,current=water.uniforms.uMeanCurrent.value;
  let h=0,velocity=0;
  for(const w of acousticWaves){
    const phase=((nearest[0]-offset.x)*w.dx+(nearest[2]-offset.y)*w.dz)*w.k-w.omega*time+w.phase;
    const gain=w.kind==='swell'?water.uniforms.uSwell.value:wind*water.uniforms.uWindSea.value;
    h+=w.amplitude*gain*Math.sin(phase);
    velocity-=w.amplitude*gain*(w.omega+w.k*(w.dx*current.x+w.dz*current.y))*Math.cos(phase);
  }
  // Envelope from the same resolved fine-wave phases, not random audio sine
  // oscillators. GPU long-wave velocity is not read back into the audio graph.
  return THREE.MathUtils.clamp(Math.hypot(h,velocity*.42)/.075,0,1);
}
function savePhoto(){
  lens.render(scene,camera.position.distanceTo(controls.target),{sdr:true});
  const a=document.createElement('a');a.download=`玻璃海-${new Date().toISOString().slice(0,10)}.png`;a.href=renderer.domElement.toDataURL('image/png');a.click();ui.notify('已保存没有界面的海岛照片');
}

function inspectTarget(source){
  const previous=renderer.getRenderTarget(),viewport=renderer.getViewport(new THREE.Vector4());
  const target=new THREE.WebGLRenderTarget(source.width,source.height,{type:THREE.FloatType,depthBuffer:false});
  const inspectScene=new THREE.Scene(),material=new THREE.ShaderMaterial({uniforms:{uInput:{value:source.texture}},depthTest:false,depthWrite:false,toneMapped:false,
    vertexShader:'varying vec2 vUv;void main(){vUv=uv;gl_Position=vec4(position.xy,0.,1.);}',
    fragmentShader:'uniform sampler2D uInput;varying vec2 vUv;void main(){gl_FragColor=texture2D(uInput,vUv);}'});
  const geometry=new THREE.PlaneGeometry(2,2);inspectScene.add(new THREE.Mesh(geometry,material));
  const data=new Float32Array(source.width*source.height*4);
  try{
    renderer.setRenderTarget(target);renderer.render(inspectScene,new THREE.OrthographicCamera(-1,1,1,-1,0,1));
    renderer.readRenderTargetPixels(target,0,0,source.width,source.height,data);
    let invalid=0,negative=0;const min=[Infinity,Infinity,Infinity],max=[-Infinity,-Infinity,-Infinity],examples=[];
    for(let i=0;i<data.length;i+=4){let bad=false;for(let c=0;c<3;c++){const v=data[i+c];if(!Number.isFinite(v))bad=true;else{min[c]=Math.min(min[c],v);max[c]=Math.max(max[c],v);if(v<0)negative++;}}if(bad){invalid++;if(examples.length<5)examples.push([i/4%source.width,Math.floor(i/4/source.width)]);}}
    return {width:source.width,height:source.height,pixels:source.width*source.height,nonFinitePixels:invalid,negativeChannels:negative,minimum:min,maximum:max,examples};
  }finally{renderer.setRenderTarget(previous);renderer.setViewport(viewport);target.dispose();material.dispose();geometry.dispose();}
}

init().catch(error=>{
  console.error(error);
  ui.setStats({error:`海岛暂时无法载入。请用“启动网页.cmd”打开，并使用支持 WebGL 2 的浏览器。${error.message||''}`});
});
