import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { createWater } from './water.js';
import { createVegetation } from './vegetation.js';
import { initUI } from './ui.js';
import { waveGLSL, waveComponents,waveWindFactor } from './waves.js';
import { createWaveSpectrum } from './spectral-waves.js';
import { createCaustics } from './caustics.js';
import { createHydrodynamics } from './hydrodynamics.js';
import { createFloatingLeaves } from './floating-leaves.js';
import { createSand } from './sand.js';
import { createLens } from './lens.js';
import { createQualityGovernor } from './quality-governor.js';
import { createRenderBenchmark } from './render-benchmark.js';
import { createAtmosphere } from './sky.js';
import { applyCloudLighting,createCloudShadowCache } from './cloud-lighting.js';
import { createSoundscape } from './audio.js';
import { createSplash } from './splash.js';

const parameters={sun:{azimuth:100,elevation:48,intensity:1},quality:'high',paused:false,sound:false,wind:1.8,current:.16,lens:{focal:28,aperture:8,exposure:0,dof:false,vignette:true,antialias:'smaa',automatic:true}};
parameters.lens.temporal=true;
parameters.lens.glintAA=true;
parameters.weather={humidity:.68,temperature:29,cloudBase:'auto',thickness:950,coverage:.35,shear:1.1};
let renderer,scene,camera,controls,water,grove,sky,sunLight,hemi,pmrem,environmentTarget,skyCubeTarget,cubeCamera,caustics,hydrodynamics,floatingLeaves,sand;
let time=0,frames=0,lastFPS=performance.now(),fps=0,transition=null,environmentTimer;
const sunDirection=new THREE.Vector3();
const clock=new THREE.Clock();
const size=new THREE.Vector2();
const raycaster=new THREE.Raycaster(),seaPlane=new THREE.Plane(new THREE.Vector3(0,1,0),0);
const pointer=new THREE.Vector2(),hit=new THREE.Vector3();
const fish=[];
let splashes,leafLocatorUntil=0;
let soundscape,atmosphere,environmentScene;
let cloudShadowCache;
let waveSpectrum;
let causticQuality='high';
let lastCubeTime=-1,lastPmremTime=-1,cubeFace=0;
let lastBounceTime=-1;
const audioForward=new THREE.Vector3();
let shoreline=[];
const acousticWaves=waveComponents.filter(w=>w.k<12).map(w=>({...w,dx:Math.cos(w.angle),dz:Math.sin(w.angle),omega:Math.sqrt((9.81*w.k+.000070244*w.k**3)*Math.tanh(Math.min(w.k*3,4)))}));
let inspection;
let gpuTimer,gpuMs=null,frameIndex=0;
let lastShadowTime=-1;
let effectiveWind=1.8;
let lens,governor,renderScale=1;
let renderBenchmark,nextGpuFrame=0;
const gpuQueries=[];
const views={
  shore:{position:[-48,12,-40],target:[0,2.5,0]},
  lagoon:{position:[41,4,39],target:[-3,2.6,-3]},
  aerial:{position:[84,84,92],target:[2,-.5,0]}
};
const ui=initUI({
  onSunChange(value){Object.assign(parameters.sun,value);setSun();},
  onView(name){moveTo(name);},
  onReset(){moveTo('shore');},
  onQuality(value){parameters.quality=value;caustics?.setQuality(value);causticQuality=value;atmosphere?.setQuality(value);setLens();resize();},
  onLensChange(value){Object.assign(parameters.lens,value);setLens();},
  onPause(value){parameters.paused=value;},
  async onSound(value){try{await setSound(value);parameters.sound=value;}catch(error){parameters.sound=false;await setSound(false);throw error;}},
  onDrop(){dropAtVisibleWater();},
  onWind(value){parameters.wind=value;},
  onCurrent(value){parameters.current=value;setCurrent();},
  onFloat(){return floatAtVisibleWater();},
  onFindLeaf(){return focusLeaf();},
  onWeatherChange(value){setWeather(value);},
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
  renderer=new THREE.WebGLRenderer({antialias:false,alpha:false,preserveDrawingBuffer:false,powerPreference:'high-performance'});
  renderer.setPixelRatio(Math.min(devicePixelRatio,1.65));
  renderer.outputColorSpace=THREE.SRGBColorSpace;
  renderer.toneMapping=THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure=.76;
  renderer.shadowMap.enabled=true;
  renderer.shadowMap.type=THREE.PCFSoftShadowMap;
  renderer.shadowMap.autoUpdate=false;
  renderer.shadowMap.needsUpdate=true;
  gpuTimer=renderer.getContext().getExtension('EXT_disjoint_timer_query_webgl2');
  renderer.domElement.setAttribute('aria-label','可以拖拽旋转、滚轮缩放的热带玻璃海。轻点海面投石，方向键旋转，减号和加号缩放。');
  renderer.domElement.tabIndex=0;
  document.querySelector('#scene').appendChild(renderer.domElement);
  scene=new THREE.Scene();
  scene.fog=new THREE.FogExp2('#c6e3eb',.0006);
  camera=new THREE.PerspectiveCamera(40,innerWidth/innerHeight,.15,24000);
  camera.filmGauge=36;camera.setFocalLength(parameters.lens.focal);
  camera.position.fromArray(views.shore.position);
  controls=new OrbitControls(camera,renderer.domElement);
  controls.target.fromArray(views.shore.target);
  controls.enableDamping=true;controls.dampingFactor=.065;
  controls.minDistance=.75;controls.maxDistance=230;
  controls.minPolarAngle=.03;controls.maxPolarAngle=Math.PI-.06;
  controls.maxTargetRadius=65;
  controls.panSpeed=.45;controls.rotateSpeed=.46;controls.zoomSpeed=.7;
  controls.screenSpacePanning=true;
  controls.addEventListener('start',()=>{transition=null;});
  lens=createLens(renderer,camera);
  await lens.ready;
  governor=createQualityGovernor({onScale(value){renderScale=value;resize();}});
  renderBenchmark=createRenderBenchmark(()=>({viewport:[innerWidth,innerHeight],dpr:devicePixelRatio,renderScale,lens:lens.state,water:water?.diagnostics?.(),spectrum:waveSpectrum?.state,performance:governor.state,parameters:structuredClone(parameters),atmosphere:atmosphere?.diagnostics(),audio:soundscape?.state,camera:camera.position.toArray(),target:controls.target.toArray()}));
  setLens();
  ui.setStats({loading:'展开真实晴空…'});
  atmosphere=createAtmosphere(THREE,{sunDirection,cloudSteps:64,cloudCoverage:.35,weather:parameters.weather});
  // A clear initial location in the same 3-D weather field. This is set once;
  // subsequent advection/evolution can bring these clouds over the island.
  atmosphere.uniforms.uCloudWeatherOrigin.value.set(.421875,.734375);
  sky=atmosphere.mesh;scene.add(sky);
  // Its vertex shader writes far depth (z=w). Draw after opaque geometry so
  // early depth rejection avoids marching atmosphere hidden by sea and sand.
  sky.renderOrder=10000;
  hemi=new THREE.HemisphereLight('#c8e9ff','#b6a78a',.65);hemi.layers.enable(1);scene.add(hemi);
  sunLight=new THREE.DirectionalLight('#fff5df',3.65);
  sunLight.castShadow=true;
  sunLight.layers.enable(1);
  sunLight.shadow.mapSize.set(3072,3072);
  Object.assign(sunLight.shadow.camera,{left:-50,right:50,top:45,bottom:-40,near:1,far:260});
  sunLight.shadow.normalBias=.035;sunLight.shadow.bias=-.00012;
  sunLight.shadow.radius=2;
  scene.add(sunLight);
  scene.add(sunLight.target);
  pmrem=new THREE.PMREMGenerator(renderer);
  skyCubeTarget=new THREE.WebGLCubeRenderTarget(256,{type:THREE.HalfFloatType,generateMipmaps:true,minFilter:THREE.LinearMipmapLinearFilter});
  cubeCamera=new THREE.CubeCamera(.1,24000,skyCubeTarget);
  environmentScene=new THREE.Scene();environmentScene.add(sky.clone());
  setSun(false);
  ui.setStats({loading:'让阳光穿过浅海…'});
  const loader=new THREE.TextureLoader();
  const textures=await Promise.all(['clean-sand/sand_02_diff_2k.jpg'].map(name=>loader.loadAsync(`./assets/${name}`)));
  textures.forEach(t=>{t.wrapS=t.wrapT=THREE.RepeatWrapping;t.anisotropy=Math.min(renderer.capabilities.getMaxAnisotropy(),12);});
  textures[0].colorSpace=THREE.SRGBColorSpace;
  grove=createVegetation(THREE,{terrainHeight,seed:40219});scene.add(grove);
  grove.userData.sunDirection.value.copy(sunDirection);
  grove.userData.sunColor?.value.copy(sunLight.color);
  if(grove.userData.windStrength)grove.userData.windStrength.value=parameters.wind;
  makeCoralAndShells();
  updateEnvironment();
  cloudShadowCache=createCloudShadowCache(renderer,atmosphere);cloudShadowCache.update(time,true);
  ui.setStats({loading:'让潮流绕过沙洲…'});
  hydrodynamics=createHydrodynamics(THREE,renderer,{terrainHeight,extent:72,resolution:384});
  waveSpectrum=createWaveSpectrum(THREE,renderer);waveSpectrum.update(0,true);
  water=createWater(renderer,scene,camera,sunDirection,{terrainHeight,skyCube:skyCubeTarget.texture,sandTexture:textures[0],atmosphere,waveSpectrum,sunLight});
  Object.assign(water.uniforms,hydrodynamics.uniforms);
  water.uniforms.uHydroEnabled.value=1;
  setCurrent();
  water.uniforms.uIntensity.value=parameters.sun.intensity;
  water.uniforms.uSunIrradiance.value=sunLight.intensity;
  water.uniforms.uSunColor.value.copy(sunLight.color);
  caustics=createCaustics(THREE,renderer,{waveGLSL,uniforms:water.uniforms,terrainHeight,sunDirection,extent:64,gridSegments:1536,textureSize:2048,heightmapSize:1024,maxHz:24});
  water.uniforms.uCaustic.value=caustics.texture;
  water.uniforms.uCausticExtent.value=caustics.extent;
  caustics.update(0,true);
  makeTerrain(textures);
  Object.assign(water.uniforms,sand.albedoUniforms);
  floatingLeaves=createFloatingLeaves(scene,{uniforms:water.uniforms,hydrodynamics,terrainHeight});
  splashes=createSplash(THREE,{scene,uniforms:water.uniforms,sunDirection});
  scene.traverse(object=>{if(object.isMesh){for(const material of Array.isArray(object.material)?object.material:[object.material])applyCloudLighting(material,atmosphere);}});
  applyCloudLighting(floatingLeaves.material,atmosphere);
  shoreline=createShoreline();
  soundscape=createSoundscape({shoreline,palmPosition:[-7,10,-2],onWarning:message=>console.warn(message)});
  setSun(false);
  document.addEventListener('visibilitychange',()=>soundscape.update({paused:parameters.paused||document.hidden}));
  if(new URLSearchParams(location.search).get('inspect')==='caustic'){
    const inspectScene=new THREE.Scene();
    inspectScene.add(new THREE.Mesh(new THREE.PlaneGeometry(2,2),new THREE.MeshBasicMaterial({map:caustics.texture,toneMapped:false})));
    inspection={scene:inspectScene,camera:new THREE.OrthographicCamera(-1,1,1,-1,0,2)};inspection.camera.position.z=1;
  }
  bindInteraction();
  addEventListener('resize',resize);
  resize();controls.update();
  // Warm up the real shader programs before dismissing the loading state.
  renderer.compile(scene,camera);
  frame();
  ui.setReady();
  window.__ATOLL__={
    get state(){return {ready:true,time,fps,gpuMs,renderScale,parameters:structuredClone(parameters),lens:lens.state,caustics:{quality:causticQuality,gridSegments:caustics.gridSegments,maxHz:caustics.maxHz},performance:governor.state,camera:camera.position.toArray(),target:controls.target.toArray(),ripples:water.uniforms.uRipples.value.map(v=>v.toArray()),triangles:lens.state.sceneStats.triangles,drawCalls:lens.state.sceneStats.calls,leaves:floatingLeaves.state};},
    setLens(value){Object.assign(parameters.lens,value);setLens();},
    setRenderScale(value){renderScale=THREE.MathUtils.clamp(value,.6,1);resize();},
    benchmark(seconds=12){return renderBenchmark.start(seconds);},
    get audio(){return soundscape.state;},
    captureAudio(){return soundscape.startCapture();},
    stopAudioCapture(){return soundscape.stopCapture();},
    async renderAudio(options){const result=await soundscape.renderOffline(options);let binary='';for(let i=0;i<result.wav.length;i+=32768)binary+=String.fromCharCode(...result.wav.subarray(i,i+32768));return {report:result.report,wavBase64:btoa(binary)};},
    atmosphere(){return {lighting:atmosphere.lighting(),diagnostics:atmosphere.diagnostics(),cloudShadowAtIsland:atmosphere.cloudShadowAt([0,1,0]),shadowCache:cloudShadowCache.state,sharedSun:{sceneRGB:sunLight.color.toArray(),waterRGB:water.uniforms.uSunColor.value.toArray(),leafRGB:grove.userData.sunColor.value.toArray(),sceneIntensity:sunLight.intensity,waterIntensity:water.uniforms.uSunIrradiance.value}};},
    setSun(value){Object.assign(parameters.sun,value);setSun();},
    setView:moveTo,
    setCamera(position,target){transition=null;camera.position.fromArray(position);controls.target.fromArray(target);controls.update();},
    drop(x,z){dropStone(x,z);},
    float(x,z){return floatingLeaves.spawn(x,z);},
    flow(x,z){return hydrodynamics.sampleFlow(x,z);},
    spectrum(){return waveSpectrum.state;},
    treeShadows(){return water.treeShadow.diagnostics();},
    waterDiagnostics(){return water.diagnostics();},
    weather(){return atmosphere.getWeatherState();},
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
    pause(value=true){parameters.paused=value;},
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
    screenshot(){lens.render(scene,camera.position.distanceTo(controls.target));return renderer.domElement.toDataURL('image/png');}
  };
}

let sandShader;
function makeTerrain(textures){
  const geometry=new THREE.PlaneGeometry(2,2,560,560).rotateX(-Math.PI/2);
  const p=geometry.attributes.position;
  const spread=v=>Math.sign(v)*(Math.abs(v)<.88?Math.abs(v)/.88*68:68+(Math.abs(v)-.88)/.12*170);
  for(let i=0;i<p.count;i++){const x=spread(p.getX(i)),z=spread(p.getZ(i));p.setXYZ(i,x,terrainHeight(x,z),z);}
  geometry.computeVertexNormals();
  sand=createSand(THREE,{geometry,textures,sunDirection,getCaustics:()=>caustics,terrainHeight,onCompile:shader=>{sandShader=shader;}});
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
  sunDirection.setFromSphericalCoords(1,THREE.MathUtils.degToRad(90-s.elevation),THREE.MathUtils.degToRad(s.azimuth));
  sky.material.uniforms.sunPosition.value.copy(sunDirection);
  sky.material.uniforms.uSkyIntensity.value=s.intensity;
  sunLight.position.copy(sunDirection).multiplyScalar(110);
  const lighting=atmosphere.setSun({direction:sunDirection,intensity:s.intensity});
  sunLight.intensity=3.6*lighting.sunStrength;
  sunLight.color.copy(lighting.sunColor);
  // The HDR already supplies diffuse skylight. Keep the extra ground/sky fill
  // small enough to preserve the direct-sun / shade ratio on white coral sand.
  // Sky irradiance comes from the same radiance cube. This hemisphere is only
  // a bounded white-sand ground-bounce approximation, strongest on leaf undersides.
  hemi.color.setRGB(0,0,0);hemi.intensity=1;updateGroundBounce();
  if(water)water.uniforms.uIntensity.value=s.intensity;
  if(water)water.uniforms.uSunIrradiance.value=sunLight.intensity;
  if(water)water.uniforms.uSunColor.value.copy(sunLight.color);
  if(water)water.uniforms.uSkyColor.value.copy(lighting.skyTint).multiplyScalar(1.7);
  if(grove)grove.userData.sunDirection.value.copy(sunDirection);
  if(grove?.userData.sunColor)grove.userData.sunColor.value.copy(sunLight.color);
  if(grove?.userData.translucencyIntensity)grove.userData.translucencyIntensity.value=.14*lighting.sunStrength;
  if(renderer)renderer.shadowMap.needsUpdate=true;
  cloudShadowCache?.update(time,true);
  if(refresh){clearTimeout(environmentTimer);environmentTimer=setTimeout(updateEnvironment,170);}
}
function setWeather(value){
  Object.assign(parameters.weather,value);if(!atmosphere)return null;
  const state=atmosphere.setWeather(value,{immediate:parameters.paused});
  lens?.resetTemporalHistory?.('weather');
  if(parameters.paused){cloudShadowCache?.update(time,true);clearTimeout(environmentTimer);environmentTimer=setTimeout(updateEnvironment,170);}
  return state;
}
function updateEnvironment(){
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
function updateGroundBounce(){
  if(!hemi||!sunLight||!atmosphere)return;
  const transmission=atmosphere.cloudShadowAt([0,1,0]);
  hemi.groundColor.copy(sunLight.color).multiplyScalar(.55*sunLight.intensity*Math.max(0,sunDirection.y)*transmission);
  lastBounceTime=time;
}
function updateDynamicEnvironment(){
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
  const dpr=Math.min(devicePixelRatio,parameters.quality==='high'?1.65:1);
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
  renderer.toneMappingExposure=.76*Math.pow(2,parameters.lens.exposure);
  lens?.configure({...parameters.lens,quality:parameters.quality});
  if(water?.uniforms.uGlintAA)water.uniforms.uGlintAA.value=parameters.lens.glintAA?1:0;
  if(governor&&governor.state.enabled!==parameters.lens.automatic)governor.setEnabled(parameters.lens.automatic);
}
function moveTo(name){
  if(!camera||!views[name])return;
  const view=views[name];
  transition={start:performance.now(),from:camera.position.clone(),to:new THREE.Vector3(...view.position),targetFrom:controls.target.clone(),targetTo:new THREE.Vector3(...view.target)};
}
function bindInteraction(){
  const canvas=renderer.domElement;
  let down=null;
  canvas.addEventListener('pointerdown',e=>{if(e.isPrimary)down={x:e.clientX,y:e.clientY,time:performance.now()};});
  canvas.addEventListener('pointerup',e=>{
    if(!down||!e.isPrimary)return;
    if(Math.hypot(e.clientX-down.x,e.clientY-down.y)<5 && performance.now()-down.time<350){
      pointer.set(e.clientX/innerWidth*2-1,1-e.clientY/innerHeight*2);
      raycaster.setFromCamera(pointer,camera);
      if(raycaster.ray.intersectPlane(seaPlane,hit)&&terrainHeight(hit.x,hit.z)<-.08&&hit.distanceTo(camera.position)<200)dropStone(hit.x,hit.z);
    }down=null;
  });
  canvas.addEventListener('keydown',e=>{
    if(['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','+','-','=','Enter'].includes(e.key))e.preventDefault();
    const offset=camera.position.clone().sub(controls.target),spherical=new THREE.Spherical().setFromVector3(offset);
    if(e.key==='ArrowLeft')spherical.theta-=.07;
    if(e.key==='ArrowRight')spherical.theta+=.07;
    if(e.key==='ArrowUp')spherical.phi=Math.max(.03,spherical.phi-.05);
    if(e.key==='ArrowDown')spherical.phi=Math.min(Math.PI/2-.015,spherical.phi+.05);
    if(e.key==='+'||e.key==='=')spherical.radius=Math.max(.75,spherical.radius*.9);
    if(e.key==='-')spherical.radius=Math.min(230,spherical.radius*1.1);
    if(e.key==='Enter')dropAtVisibleWater();
    if(e.key.startsWith('Arrow')||['+','-','='].includes(e.key)){transition=null;camera.position.copy(controls.target).add(new THREE.Vector3().setFromSpherical(spherical));controls.update();}
  });
  canvas.addEventListener('webglcontextlost',e=>{e.preventDefault();ui.setStats({error:'图形连接已中断，刷新页面可重新进入海岛。'});});
}
function dropAtVisibleWater(){
  for(const y of [-.35,-.65,-.1]){
    pointer.set(.25,y);raycaster.setFromCamera(pointer,camera);
    if(raycaster.ray.intersectPlane(seaPlane,hit)&&terrainHeight(hit.x,hit.z)<-.1&&hit.distanceTo(camera.position)<150){dropStone(hit.x,hit.z);return;}
  }
  dropStone(28,23);
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
function dropStone(x,z){
  if(!water||terrainHeight(x,z)>-.05)return;
  parameters.paused=false;
  // Centimetre pebble, not a boulder: the old full-strength metre-wide impulse
  // carried several joules. These smaller visual/solver impulses fit its scale.
  water.impulse(x,z,time,.10);
  hydrodynamics.disturb(x,z,.20);
  splashes.spawn(x,z,time,1,{stoneDiameter:.025});
  soundscape?.splash(x,z,1);
  ui.notify('石子落水，涟漪正在散开',1600);
}

function frame(){
  requestAnimationFrame(frame);
  const frameStart=performance.now();
  const delta=Math.min(clock.getDelta(),.055);
  if(document.hidden)return;
  const gl=renderer.getContext();
  if(gpuTimer&&gpuQueries.length&&gl.getQueryParameter(gpuQueries[0],gl.QUERY_RESULT_AVAILABLE)){
    const query=gpuQueries.shift();if(!gl.getParameter(gpuTimer.GPU_DISJOINT_EXT)){gpuMs=Number((gl.getQueryParameter(query,gl.QUERY_RESULT)/1e6).toFixed(3));renderBenchmark.gpu(gpuMs);}gl.deleteQuery(query);
  }
  let activeQuery=null;
  frameIndex++;
  if(gpuTimer&&(renderBenchmark.active||frameIndex>=nextGpuFrame)&&gpuQueries.length<6){activeQuery=gl.createQuery();gl.beginQuery(gpuTimer.TIME_ELAPSED_EXT,activeQuery);nextGpuFrame=frameIndex+97+(frameIndex%37);}
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
  if(transition){
    const t=Math.min(1,(performance.now()-transition.start)/1450),a=t*t*(3.-2.*t);
    camera.position.lerpVectors(transition.from,transition.to,a);controls.target.lerpVectors(transition.targetFrom,transition.targetTo,a);
    if(t===1)transition=null;
  }
  controls.update();
  // Keep the observer above the actual surface, including after panning on land.
  const floor=Math.max(.42,terrainHeight(camera.position.x,camera.position.z)+.5);
  if(camera.position.y<floor){camera.position.y=floor;camera.lookAt(controls.target);}
  camera.updateMatrixWorld();
  splashes.update(delta,time,camera,lens.state.height);
  ui.locateLeaf(performance.now()<leafLocatorUntil?floatingLeaves.locate(camera,{viewportWidth:innerWidth,viewportHeight:innerHeight}):null,performance.now()<leafLocatorUntil);
  cloudShadowCache.update(time);
  if(time-lastBounceTime>.25)updateGroundBounce();
  updateDynamicEnvironment();
  const islandDistance=Math.hypot(camera.position.x+1.5,camera.position.y,camera.position.z+1);
  const desiredCaustics=parameters.quality==='balanced'?'balanced':causticQuality==='high'?(islandDistance>125?'balanced':'high'):(islandDistance<95?'high':'balanced');
  if(desiredCaustics!==causticQuality){caustics.setQuality(desiredCaustics);causticQuality=desiredCaustics;}
  if(!parameters.paused&&time-lastShadowTime>=1/(parameters.quality==='high'?60:30)){renderer.shadowMap.needsUpdate=true;lastShadowTime=time;}
  caustics.update(time);
  sand.update(time);
  water.render(time);lens.render(scene,camera.position.distanceTo(controls.target));
  if(inspection)renderer.render(inspection.scene,inspection.camera);
  if(activeQuery){gl.endQuery(gpuTimer.TIME_ELAPSED_EXT);gpuQueries.push(activeQuery);}
  governor.update({delta,gpuMs,cpuMs:performance.now()-frameStart,frameMs:delta*1000});
  frames++;
  const now=performance.now();
  if(now-lastFPS>1000){fps=Math.round(frames*1000/(now-lastFPS));frames=0;lastFPS=now;ui.setStats({fps});renderer.domElement.dataset.fps=String(fps);renderer.domElement.dataset.camera=JSON.stringify(camera.position.toArray());renderer.domElement.dataset.simulationTime=time.toFixed(3);renderer.domElement.dataset.ripples=String(water.uniforms.uRipples.value.filter(v=>time-v.z>=0&&time-v.z<7).length);}
  camera.getWorldDirection(audioForward);
  soundscape.update({time,wind:effectiveWind,cameraPosition:camera.position,cameraForward:audioForward,paused:parameters.paused,swellEnvelope:shoreSoundEnvelope()});
  renderBenchmark.frame(frameStart,performance.now()-frameStart);
}

async function setSound(enabled){
  await soundscape.setEnabled(enabled);
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
    h+=w.amplitude*wind*Math.sin(phase);
    velocity-=w.amplitude*wind*(w.omega+w.k*(w.dx*current.x+w.dz*current.y))*Math.cos(phase);
  }
  // Envelope from the same resolved fine-wave phases, not random audio sine
  // oscillators. GPU long-wave velocity is not read back into the audio graph.
  return THREE.MathUtils.clamp(Math.hypot(h,velocity*.42)/.075,0,1);
}
function savePhoto(){
  lens.render(scene,camera.position.distanceTo(controls.target));
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
