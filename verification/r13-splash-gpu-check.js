import * as THREE from '../vendor/three.module.js';
import {createSplash} from '../splash.js';
import {createSplash as createBefore} from './r13-splash-before.js';
import {createSplash as createStraight} from './r13-splash-straight-alpha.js';
import {createVegetationMotionCapture} from '../vegetation-motion.js';

// Bounded isolated actual-GL test, not a main-scene/FPS or visual verdict.
// Call await (await import('/verification/r13-splash-gpu-check.js')).runSplashOpticsGPUCheck().
export function runSplashOpticsGPUCheck({renderer:provided=null,size=256}={}){
 const renderer=provided||new THREE.WebGLRenderer({canvas:document.createElement('canvas'),antialias:false}),owned=!provided;
 const checks=[],rows=[],resources=[],gl=renderer.getContext();gl.getExtension('EXT_color_buffer_float');
 const saved={target:renderer.getRenderTarget(),face:renderer.getActiveCubeFace(),mip:renderer.getActiveMipmapLevel(),viewport:renderer.getViewport(new THREE.Vector4()),scissor:renderer.getScissor(new THREE.Vector4()),scissorTest:renderer.getScissorTest(),autoClear:renderer.autoClear,clearColor:renderer.getClearColor(new THREE.Color()),clearAlpha:renderer.getClearAlpha(),toneMapping:renderer.toneMapping,outputColorSpace:renderer.outputColorSpace,xr:renderer.xr.enabled};
 const add=(name,passed,evidence={})=>checks.push({name,passed:!!passed,...evidence});
 const zero=new THREE.DataTexture(new Float32Array([0,0,0,0]),1,1,THREE.RGBAFormat,THREE.FloatType);zero.needsUpdate=true;resources.push(zero);
 const cube=new THREE.WebGLCubeRenderTarget(16,{type:THREE.HalfFloatType,depthBuffer:false,generateMipmaps:true,minFilter:THREE.LinearMipmapLinearFilter});resources.push(cube);
 const capture=new THREE.Scene();capture.background=new THREE.Color(.4,.6,.8);const captureCamera=new THREE.CubeCamera(.1,10,cube);
 const target=new THREE.WebGLRenderTarget(size,size,{type:THREE.HalfFloatType,depthBuffer:true,count:4});resources.push(target);
 const copyTarget=new THREE.WebGLRenderTarget(size,size,{type:THREE.FloatType,depthBuffer:false});resources.push(copyTarget);
 const copyUniforms={tInput:{value:target.texture}},copyMaterial=new THREE.ShaderMaterial({uniforms:copyUniforms,depthTest:false,depthWrite:false,toneMapped:false,vertexShader:'varying vec2 vUv;void main(){vUv=uv;gl_Position=vec4(position.xy,0.,1.);}',fragmentShader:'uniform sampler2D tInput;varying vec2 vUv;void main(){gl_FragColor=texture2D(tInput,vUv);}'});resources.push(copyMaterial);
 const copyGeometry=new THREE.PlaneGeometry(2,2);resources.push(copyGeometry);const copyScene=new THREE.Scene();copyScene.add(new THREE.Mesh(copyGeometry,copyMaterial));
 const camera=new THREE.PerspectiveCamera(50,1,.02,100);camera.position.set(.3,.35,.55);camera.lookAt(0,.045,0);camera.updateMatrixWorld();
 const readAttachment=i=>{copyUniforms.tInput.value=target.textures[i];renderer.setRenderTarget(copyTarget);renderer.render(copyScene,new THREE.Camera());const a=new Float32Array(size*size*4);renderer.readRenderTargetPixels(copyTarget,0,0,size,size,a);return a;};
 const imageStats=(image,background,scale)=>{let nonFinite=0,changed=0,maxDelta=0,sum=0;for(let i=0;i<image.length;i+=4){let delta=0;for(let c=0;c<3;c++){const v=image[i+c]/scale,b=background[i+c]/scale;if(!Number.isFinite(v))nonFinite++;delta=Math.max(delta,Math.abs(v-b));}if(delta>.001)changed++;maxDelta=Math.max(maxDelta,delta);sum+=delta;}return{nonFinite,changedPixels:changed,maximumRawContrast:maxDelta,summedRawContrast:sum};};
 try{
  renderer.xr.enabled=false;renderer.autoClear=true;renderer.setScissorTest(false);renderer.setClearColor(0,0);renderer.toneMapping=THREE.NoToneMapping;renderer.outputColorSpace=THREE.LinearSRGBColorSpace;captureCamera.update(renderer,capture);
  const outputs={},parts=[],directSunControls=[];
  for(const [mode,create]of [['before',createBefore],['straight',createStraight],['candidate',createSplash]])for(const P of [-8,0,8]){
   const scale=2**P,scene=new THREE.Scene(),planeGeometry=new THREE.PlaneGeometry(5,5),planeMaterial=new THREE.MeshBasicMaterial({color:new THREE.Color(.03*scale,.06*scale,.08*scale),toneMapped:false});
   const plane=new THREE.Mesh(planeGeometry,planeMaterial);plane.rotation.x=-Math.PI/2;scene.add(plane);
   const uniforms={uTime:{value:10.11},uWind:{value:0},uSwell:{value:0},uWindSea:{value:0},uCurrentOffset:{value:new THREE.Vector2()},uMeanCurrent:{value:new THREE.Vector2()},uRipples:{value:Array.from({length:8},()=>new THREE.Vector4(0,0,-100,0))},uRippleOffsets:{value:Array.from({length:8},()=>new THREE.Vector2())},uWave0:{value:zero},uWave1:{value:zero},uWave2:{value:zero},uWave3:{value:zero},uWaveDomains:{value:new THREE.Vector4(1021,137,29,5.3)},uWaveResolution:{value:32},uHydroEnabled:{value:0},uHydroState:{value:zero},uHydroExtent:{value:72},uHydroResolution:{value:32},uSun:{value:new THREE.Vector3(.4,.8,.3).normalize()},uSunColor:{value:new THREE.Color(1,.97,.9)},uSunIrradiance:{value:0},uSolarDisk:{value:1},uSkyCube:{value:cube.texture},uSkyCubeScale:{value:scale}};
   const splash=create(THREE,{scene,uniforms}),motion=createVegetationMotionCapture(THREE);splash.spawn(0,0,10,1,{surfaceHeight:0});splash.update(.11,10.11,camera,size);splash.root.visible=false;motion.prepare(scene,camera,[],{});renderer.setRenderTarget(target);renderer.render(scene,camera);motion.finish();const background=readAttachment(0);
   splash.root.visible=true;motion.prepare(scene,camera,[],{});renderer.setRenderTarget(target);renderer.render(scene,camera);motion.finish();const image=readAttachment(0),reactive=readAttachment(3),stats=imageStats(image,background,scale);let reactivePixels=0;for(let i=0;i<reactive.length;i+=4)if(reactive[i]>.001)reactivePixels++;
   rows.push({mode,storageEV:P,ageSeconds:.11,reactivePixels,...stats,metric:splash.state.events[0]});outputs[mode+P]={image,scale};
   if(mode==='candidate'&&P===0){const meshes=splash.root.children[0].children;for(const mesh of meshes){for(const other of meshes)other.visible=other===mesh;motion.prepare(scene,camera,[],{});renderer.setRenderTarget(target);renderer.render(scene,camera);motion.finish();parts.push({name:mesh.name,...imageStats(readAttachment(0),background,scale)});}for(const mesh of meshes)mesh.visible=true;uniforms.uSunIrradiance.value=3.6;const actual=[];for(const containsDisc of [0,1]){for(const mesh of meshes)mesh.material.uniforms.uSplashSkyHasSun.value=containsDisc;motion.prepare(scene,camera,[],{});renderer.setRenderTarget(target);renderer.render(scene,camera);motion.finish();actual.push(readAttachment(0));}let maximumAdded=0,summedAdded=0,minimumAdded=0,nonFinite=0;for(let i=0;i<actual[0].length;i+=4)for(let c=0;c<3;c++){const added=actual[0][i+c]-actual[1][i+c];if(!Number.isFinite(added))nonFinite++;maximumAdded=Math.max(maximumAdded,added);minimumAdded=Math.min(minimumAdded,added);summedAdded+=added;}directSunControls.push({liveSolarDisk:1,defaultCubeHasDisc:0,explicitDiscMetadataSuppressesAnalyticSun:1,maximumAdded,minimumAdded,summedAdded,nonFinite});}
   splash.dispose();motion.dispose();planeGeometry.dispose();planeMaterial.dispose();
  }
  function invariance(mode){const base=outputs[mode+0];let max=0;for(const P of [-8,8]){const a=outputs[mode+P];for(let i=0;i<a.image.length;i+=4)for(let c=0;c<3;c++)max=Math.max(max,Math.abs(a.image[i+c]/a.scale-base.image[i+c]));}return max;}
  const beforeError=invariance('before'),candidateError=invariance('candidate');
  add('baseline detects missing captured-cube storage exposure ratio',beforeError>.1,{maximumRawRGBError:beforeError});
  add('candidate preserves raw splash radiance across16EV storage range',candidateError<.003,{maximumRawRGBError:candidateError,tolerance:.003});
  add('both actual crown and instanced droplet programs draw finite nonzero close-view response',rows.filter(r=>r.mode==='candidate').every(r=>r.nonFinite===0&&r.changedPixels>30&&r.maximumRawContrast>.01),{rows:rows.filter(r=>r.mode==='candidate')});
  add('isolated actual crown and droplet draws each contribute finite radiance',parts.length===2&&parts.every(r=>r.nonFinite===0&&r.changedPixels>0&&r.maximumRawContrast>.001),{parts});
  add('disc-absent production cube receives analytic sun; explicit disc metadata suppresses duplicate source',directSunControls.length===1&&directSunControls.every(r=>r.nonFinite===0&&r.maximumAdded>.005&&r.summedAdded>.01&&r.minimumAdded>=-.0001),{directSunControls});
  add('candidate marks splash pixels reactive for actual MRT temporal bypass',rows.filter(r=>r.mode==='candidate').every(r=>r.reactivePixels>30)&&rows.filter(r=>r.mode==='before').every(r=>r.reactivePixels===0),{before:rows.find(r=>r.mode==='before'&&r.storageEV===0)?.reactivePixels,candidate:rows.find(r=>r.mode==='candidate'&&r.storageEV===0)?.reactivePixels});
  let blendRGBError=0;for(const P of [-8,0,8]){const a=outputs['straight'+P],b=outputs['candidate'+P];for(let i=0;i<a.image.length;i+=4)for(let c=0;c<3;c++)blendRGBError=Math.max(blendRGBError,Math.abs(a.image[i+c]-b.image[i+c])/a.scale);}
  add('premultiplied candidate preserves bb2 straight-alpha RGB compositing',blendRGBError<.003,{maximumRawRGBError:blendRGBError,tolerance:.003,straightReactivePixels:rows.find(r=>r.mode==='straight'&&r.storageEV===0)?.reactivePixels,candidateReactivePixels:rows.find(r=>r.mode==='candidate'&&r.storageEV===0)?.reactivePixels});
  const blendProbe=[];
  for(const test of [{name:'straight scalar',premultiplied:false,transparent:true,vector:false},{name:'opaque scalar',premultiplied:false,transparent:false,vector:false},{name:'premultiplied scalar',premultiplied:true,transparent:true,vector:false},{name:'straight vec4 alpha1',premultiplied:false,transparent:true,vector:true}]){
   // Match the actual four active draw buffers. WebGL rejects a control draw
   // that leaves enabled locations1/2 without fragment outputs; that error is
   // unrelated to the scalar-alpha blend being measured at location3.
   const material=new THREE.ShaderMaterial({transparent:test.transparent,premultipliedAlpha:test.premultiplied,depthTest:false,depthWrite:false,toneMapped:false,vertexShader:'void main(){gl_Position=vec4(position.xy,0.,1.);}',fragmentShader:`layout(location=1) out vec4 motion;layout(location=2) out float physicalDepth;layout(location=3) out ${test.vector?'vec4':'float'} probe;void main(){gl_FragColor=vec4(${test.premultiplied?'.05,.1,.15':'.2,.4,.6'},.25);motion=vec4(0.);physicalDepth=0.;probe=${test.vector?'vec4(1.,0.,0.,1.)':'1.'};}`}),scene=new THREE.Scene();scene.add(new THREE.Mesh(copyGeometry,material));renderer.setRenderTarget(target);renderer.render(scene,new THREE.Camera());const reactive=readAttachment(3),rgb=readAttachment(0),at=(Math.floor(size/2)*size+Math.floor(size/2))*4;blendProbe.push({...test,reactive:reactive[at],rgb:Array.from(rgb.slice(at,at+3))});material.dispose();
  }
  add('actual MRT control isolates scalar output SRC_ALPHA loss and ONE repair',blendProbe[0].reactive===0&&blendProbe.slice(1).every(r=>r.reactive>.99),{blendProbe});
  const error=gl.getError();add('actual WebGL completes without GL errors',error===gl.NO_ERROR,{error});
  return{schema:'glass-atoll.r13-splash-isolated-gpu.v2-premultiplied',passed:checks.every(c=>c.passed),checks,rows,knownPhase:{born:10,renderedTime:10.11,ageSeconds:.11,camera:camera.position.toArray(),target:[0,.045,0],viewport:[size,size]},limits:['Isolated real-GL scene; main lens/history and actual moving water require separate scene capture.','Reflection-only droplet proxy; no resolved refracted scene/internal caustics or Navier-Stokes water entry.','No FPS or visible-at-arbitrary-distance claim.']};
 }finally{renderer.setRenderTarget(saved.target,saved.face,saved.mip);renderer.setViewport(saved.viewport);renderer.setScissor(saved.scissor);renderer.setScissorTest(saved.scissorTest);renderer.setClearColor(saved.clearColor,saved.clearAlpha);renderer.autoClear=saved.autoClear;renderer.toneMapping=saved.toneMapping;renderer.outputColorSpace=saved.outputColorSpace;renderer.xr.enabled=saved.xr;for(const r of resources)r.dispose();if(owned){renderer.dispose();renderer.forceContextLoss();}}
}

// Scene-side known-phase helper. `launch` can invoke a real stone throw; absent
// that callback it calls the existing drop route once as an explicit control.
export async function freezeActualSplashPhase(api,{launch=null,x=-34,z=-9,phaseSeconds=.11,closeView=true,timeoutMs=6000}={}){
 const priorIds=new Set(api.splashes.events.map(e=>e.id)),started=performance.now();api.pause(false);if(launch)await launch();else api.drop(x,z);
 let found=null;while(performance.now()-started<timeoutMs){found=api.splashes.events.find(e=>!priorIds.has(e.id));if(found)break;await new Promise(requestAnimationFrame);}if(!found)throw new Error('No new actual splash event before bounded timeout');
 const remaining=Math.max(0,phaseSeconds-found.age);if(remaining>0)api.pauseAtPhysicalTime(api.state.time+remaining);else api.pause(true);
 while(!api.state.parameters.paused&&performance.now()-started<timeoutMs)await new Promise(requestAnimationFrame);
 if(!api.state.parameters.paused)throw new Error('Actual splash phase did not pause before bounded timeout');
 const event=api.splashes.events.find(e=>e.id===found.id);if(!event)throw new Error('Actual splash expired before phase capture');
 if(closeView){const y=event.impactHeightEstimate||0;api.setCamera([event.x+.3,y+.35,event.z+.55],[event.x,y+.045,event.z]);await new Promise(requestAnimationFrame);}
 return{kind:launch?'actual stone-entry callback':'explicit drop-route control',phaseSecondsRequested:phaseSeconds,event,physicalTime:api.state.time,photometry:api.photometry(),camera:api.state.camera,target:api.state.target,limits:['Leaves the scene paused at the requested physical phase for visual inspection.','The direct-drop control does not validate projectile collision; supply launch callback for that route.']};
}
