// CPU-only actual production FW attribute fills + isolated-source output proxy.
// No WebGLRenderer, context, texture readback, image render or GPU timing.
import fs from 'node:fs';import assert from 'node:assert/strict';import crypto from 'node:crypto';
import * as THREE from '../../vendor/three.module.js';
import {createFireworks} from '../../fireworks.js';import {sampleBody} from '../../fireworks-physics.js';
import {RAW_PER_CANDELA,createSceneRadiometry} from '../../scene-radiometry.js';
const root=new URL('../../',import.meta.url),here=new URL('./',import.meta.url),read=p=>fs.readFileSync(new URL(p,root),'utf8'),sha=s=>crypto.createHash('sha256').update(s).digest('hex');
const physics=read('fireworks-physics.js'),oldPhysics=read('verification/choreography-polish/before-log-cooling/fireworks-physics.js'),fwSource=read('fireworks.js');
const absolute=s=>s.replace(/from (['"])(\.\/[^'"]+)\1/g,(_,q,p)=>`from '${new URL(p.slice(2),root).href}'`);
const oldURL='data:text/javascript;base64,'+Buffer.from(absolute(oldPhysics)).toString('base64');
const oldFW=absolute(fwSource).replace(new URL('fireworks-physics.js',root).href,oldURL);
assert.notEqual(oldFW,absolute(fwSource));const createOld=(await import('data:text/javascript;base64,'+Buffer.from(oldFW).toString('base64'))).createFireworks;
const width=1209,height=1292,shutter=1/120,storageEV=11.75,cameraEV=21,gain=64;
const radiometry=createSceneRadiometry().update({recommendedEV:storageEV,cameraExposureEV:cameraEV,bounds:{isolated:1},force:true});assert.equal(radiometry.storageEV,storageEV);
const exposure=radiometry.outputExposureScale;
const hdrSource=read('hdr-output.js');assert.ok(hdrSource.includes('vec3 v=inputMat*(c/.6);v=(v*(v+.0245786)-.000090537)/(v*(.983729*v+.432951)+.238081);'));
assert.ok(fwSource.includes('float integratedGaussian(vec2 p,float sigma)'));
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v)),mat=(columns,v)=>[0,1,2].map(r=>columns.reduce((s,c,i)=>s+c[r]*v[i],0));
const filmic=c=>{let v=mat([[.59719,.076,.0284],[.35458,.90834,.13383],[.04823,.01566,.83777]],c.map(x=>x/.6));v=v.map(x=>(x*(x+.0245786)-.000090537)/(x*(.983729*x+.432951)+.238081));return mat([[1.60475,-.10208,-.00327],[-.53108,1.10813,-.07276],[-.07367,-.00605,1.07602]],v).map(x=>clamp(x,0,1));};
const encode=x=>x<=.0031308?12.92*x:1.055*Math.max(0,x)**(1/2.4)-.055;
const legacyOutput=c=>{const base=filmic(c),peak=Math.max(...c),basePeak=Math.max(...base),headroom=1270/203,tail=peak>1?(headroom-1)*(1-Math.exp(-((peak-1)**2)/(headroom-1))):0;return{sdr:base.map(encode),hdr:base.map(v=>encode(v+v/Math.max(basePeak,1e-8)*tail))};};
const erf=x=>{const s=Math.sign(x);x=Math.abs(x);const t=1/(1+.3275911*x);return s*(1-(((((1.061405429*t-1.453152027)*t)+1.421413741)*t-.284496736)*t+.254829592)*t*Math.exp(-x*x));};
const gaussian=(x,y,sigma)=>Math.max(0,.25*(erf((x+.5)/(sigma*1.41421356237))-erf((x-.5)/(sigma*1.41421356237)))*(erf((y+.5)/(sigma*1.41421356237))-erf((y-.5)/(sigma*1.41421356237))));
const factories={previous:createOld,logCooling:createFireworks},fractions=[.1,.35,.5,.6,.65,.7,.75,.8,.85,.9,.95,.99,1,1.003],captures=[],owned=[];let forbiddenContextCalls=0,inertFills=0;
function rendererFor(position){let captured=null;return{renderer:{autoClear:true,shadowMap:{autoUpdate:true,needsUpdate:false},getRenderTarget:()=>null,getActiveCubeFace:()=>0,getActiveMipmapLevel:()=>0,setRenderTarget(){},getContext(){forbiddenContextCalls++;throw Error('No context permitted');},render(scene){inertFills++;const mesh=scene.children[0],g=mesh.geometry;let found=-1;for(let i=0;i<g.instanceCount;i++)if([0,1,2].every(c=>g.attributes.aCentre.array[3*i+c]===Math.fround(position[c]))){assert.equal(found,-1);found=i;}assert.ok(found>=0,'Selected real root has a full source row');const a=name=>{const x=g.attributes[name];return Array.from(x.array.subarray(found*x.itemSize,(found+1)*x.itemSize));};captured={centre:a('aCentre'),velocity:a('aVelocity'),colour:a('aColour'),shape:a('aShape'),temporal:[...a('aTemporal0'),...a('aTemporal1')]};}},get captured(){return captured;}};}
function proxy(input,camera,distance){
 const p=new THREE.Vector3().fromArray(input.centre),P=camera.projectionMatrix.elements,clip=new THREE.Vector4(p.x,p.y,p.z,1).applyMatrix4(camera.matrixWorldInverse).applyMatrix4(camera.projectionMatrix),depth=clip.w,pixelScale=Math.abs(P[5])*height*.5/depth,worldSigma=input.shape[1]*pixelScale*.70710678,sigma=Math.max(.42,Math.sqrt(.0784+worldSigma*worldSigma));
 const pp=v=>{const q=new THREE.Vector3(...v).project(camera);return[q.x*width*.5,q.y*height*.5];},a=pp(input.centre.map((v,c)=>v+input.velocity[c]*shutter*.5)),b=pp(input.centre.map((v,c)=>v-input.velocity[c]*shutter*.5)),motion=a.map((v,c)=>v-b[c]);
 const omega=4/(width*height*Math.abs(P[0]*P[5])),extent=3.65*sigma+Math.abs(motion[0])*.5+.90,dist=Math.max(p.distanceTo(camera.position),input.shape[1]);
 const at=x=>{let kernel=0;if(Math.abs(x)>extent)return{exposedRGB:[0,0,0],sdrPeak:0,hdrPeak:0};for(let i=0;i<8;i++){const t=(i+.5)/8-.5;kernel+=gaussian(x-motion[0]*t,-motion[1]*t,sigma)*input.temporal[i]*.125;}
  const raw=input.colour.map(c=>c*input.shape[2]*RAW_PER_CANDELA/Math.max(dist*dist*omega,1e-12)*kernel),stored=raw.map(v=>THREE.DataUtils.fromHalfFloat(THREE.DataUtils.toHalfFloat(v*2**storageEV))),exposedRGB=stored.map(v=>v*exposure),output=legacyOutput(exposedRGB);return{exposedRGB,sdrPeak:Math.max(...output.sdr),hdrPeak:Math.max(...output.hdr)};};
 const thresholds=[1/255,.1,.5,.98],spans=thresholds.map(threshold=>{let min=Infinity,max=-Infinity;for(let k=-800;k<=800;k++){const x=k/100;if(at(x).sdrPeak>=threshold){min=Math.min(min,x);max=Math.max(max,x);}}return{threshold,diameterPixels:Number.isFinite(min)?max-min:0};});
 return{distance,actualRayDistance:dist,sigmaPixels:sigma,projectedShutterPixels:Math.hypot(...motion),headRadiusMetres:input.shape[1],unmodulatedReferenceIntensity:input.shape[2],meanUploadedEnvelope:input.temporal.reduce((a,b)=>a+b,0)/8,centre:at(0),sdrThresholdSpans:spans};
}
let failure=null;
try{
 for(const [law,factory]of Object.entries(factories)){
  const fw=factory(THREE,{terrainHeight:()=>0,origin:[0,0,0],sourceVisibility:'none',trailIntegration:'adaptive'});owned.push(fw);
  fw.configure({type:'ring',effectProfile:'legacy',autoDirection:false,autoLaunch:false,launchSpreadDegrees:0,burstTiltDegrees:0,burstRollDegrees:0,elevation:90,intensityScale:gain,starDragModel:'bounded-descent'});fw.update({time:0,windVector:[0,0,0]});const launch=fw.launch({seed:341070});assert.equal(launch.accepted,true);
  const rootBody=fw.smokeSourceProvider.describe(launch.id).roots[0];fw.update({time:rootBody.birth,windVector:[0,0,0]});const birth=fw.smokeSourceProvider.sampleBody(launch.id,{bodyId:0,time:rootBody.birth}).position,body={birth:rootBody.birth,position:birth,velocity:rootBody.baseVelocity,drag:9.81/18,life:rootBody.life};
  for(const f of fractions){const time=body.birth+body.life*f;fw.update({time,windVector:[0,0,0]});const point=sampleBody(body,time).position;
   for(const distance of [100,706]){const camera=new THREE.PerspectiveCamera(50,width/height,.1,30000);camera.filmGauge=36;camera.setFocalLength(28);camera.position.set(point[0],point[1],point[2]+distance);camera.lookAt(...point);camera.updateMatrixWorld();const harness=rendererFor(point);fw.render({renderer:harness.renderer,target:{width,height},camera,frame:{time,storageEV,rawPerCandela:RAW_PER_CANDELA},optics:{width,height,focalMm:28,aperture:8,focusMetres:distance,sensorHeightMm:camera.getFilmHeight(),dof:false,vignette:false,shutterSeconds:shutter,firelightSigmaPixels:.42},legacySmoke:false});
    captures.push({law,lifeFraction:f,life:body.life,time,uploaded:harness.captured,...proxy(harness.captured,camera,distance)});
   }
  }
 }
 assert.equal(forbiddenContextCalls,0);for(const distance of [100,706]){const a=captures.find(c=>c.law==='previous'&&c.lifeFraction===.8&&c.distance===distance),b=captures.find(c=>c.law==='logCooling'&&c.lifeFraction===.8&&c.distance===distance);assert.ok(b.centre.sdrPeak<a.centre.sdrPeak);assert.ok(b.meanUploadedEnvelope<a.meanUploadedEnvelope*1e-5);}
}catch(e){failure=String(e.stack).replace(/data:text\/javascript;base64,[^\s)]+/g,'[actual production source clone]');}
finally{for(const fw of owned)fw.dispose();}
const report={schema:'glass-atoll.choreography-polish.actual-fill-output-proxy.v2',passed:!failure,actualGPU:false,failure,inertProductionFills:inertFills,forbiddenContextCalls,sourcePins:Object.fromEntries(['fireworks-physics.js','fireworks.js','scene-radiometry.js','hdr-output.js','lens.js','vendor/three.module.js'].map(p=>[p,sha(read(p))])),configuration:{width,height,focalMm:28,filmGaugeMm:36,distances:[100,706],cameraEV,storageEV,outputExposureScale:exposure,gain,shutterSeconds:shutter,firelightSigmaPixels:.42,hdrSystemReportedPeakNits:1270,paperWhiteNits:203},scope:['Actual production create/configure/launch/update/render CPU attribute fills; renderer.render is an inert capture, never a GPU draw.','Isolated real root0 centered at each distance, no depth/air/overlap/bloom/vignette/DoF. Widths are continuous horizontal code-threshold spans, not screenshot pixels or real-world visibility measurements.','CPU binary64 translation of existing GLSL pixel Gaussian, shutter8 taps and legacy fitted-ACES/HDR extension; Float32 upload and stored FP16 quantization are included, GPU arithmetic and compositing are not.','Storage and camera exposure cancel analytically before finite FP16 quantization; EV21 is this app relative gain, not EV100.','HDR1270 is a system-report setting, not physical panel luminance calibration or HDR approval.'],captures};
fs.writeFileSync(new URL('physics-cooling-output-proxy.json',here),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({passed:report.passed,failure,rows:captures.length,inertProductionFills:inertFills,forbiddenContextCalls,at80Percent:captures.filter(c=>c.lifeFraction===.8).map(c=>({law:c.law,distance:c.distance,meanUploadedEnvelope:c.meanUploadedEnvelope,centre:c.centre,spans:c.sdrThresholdSpans}))},null,2));if(!report.passed)process.exitCode=1;
