// Independent CPU-only review. No WebGL context, browser or production edits.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import crypto from 'node:crypto';
import * as THREE from '../vendor/three.module.js';
import {POWERED_OPTICAL_MAX_SHUTTER_SECONDS,POWERED_OPTICAL_MAX_ROWS,validatePoweredOpticalShutter,partitionPoweredOpticalIntervals} from '../firework-powered-optics.js';
import {createFireworkEvent,sampleBody,sampleBodyEmissionWindow} from '../fireworks-physics.js';
import {createTailReleaseFieldNode,sampleTailReleaseFieldNode} from '../firework-tail-field.js';
import {buildContactOpticalRecords} from '../firework-contact-optics.js';
import {SMOKE_TRANSMISSION_LIMITS,planSmokeTransmission,packSmokeTransmissionInputs} from '../pyro-smoke-transmission-pack.js';
const checks=[],metrics={},check=(name,fn)=>{try{checks.push({name,passed:true,evidence:fn()});}catch(e){checks.push({name,passed:false,error:e.stack});}},near=(a,b,t=1e-10)=>assert(Math.abs(a-b)<=t,`${a} vs ${b}`),root=new URL('../',import.meta.url),read=file=>fs.readFileSync(new URL(file,root),'utf8'),hash=s=>crypto.createHash('sha256').update(s).digest('hex');
function nextUp(value){const a=new ArrayBuffer(8),v=new DataView(a);v.setFloat64(0,value);v.setBigUint64(0,v.getBigUint64(0)+1n);return v.getFloat64(0);}
check('short-shutter admission accepts exact endpoint and rejects every longer represented candidate exposure',()=>{
  assert.equal(POWERED_OPTICAL_MAX_SHUTTER_SECONDS,1/60);assert.equal(POWERED_OPTICAL_MAX_ROWS,18000);
  for(const t of [0,1/120,1/60])assert.equal(validatePoweredOpticalShutter(t,true),t);
  for(const t of [nextUp(1/60),.1,1])assert.throws(()=>validatePoweredOpticalShutter(t,true),/1\/60/);
  assert.equal(validatePoweredOpticalShutter(1,false),1);
  for(const t of [-Number.MIN_VALUE,NaN,Infinity,-Infinity,'0',null,undefined,nextUp(1)])assert.throws(()=>validatePoweredOpticalShutter(t,false));
});
check('force boundary and source birth cuts preserve exact represented clocks, order, duration and metadata',()=>{
  const body={birth:7,thrustProfile:{cells:[{toAge:.1},{toAge:.2},{toAge:.3}]}},input=[{from:7.09,to:7.11,certified:'keep'}],copy=structuredClone(input),parts=partitionPoweredOpticalIntervals({body,intervals:input});assert.deepEqual(input,copy);assert.deepEqual(parts,[{from:7.09,to:7.1,certified:'keep'},{from:7.1,to:7.11,certified:'keep'}]);
  const onBoundary=partitionPoweredOpticalIntervals({body,intervals:[{from:7.1,to:7.2}]});assert.equal(onBoundary.length,1);assert.equal(onBoundary[0].from,7.1);assert.equal(onBoundary[0].to,7.2);
  const born=partitionPoweredOpticalIntervals({body,intervals:[{from:6.995,to:7.005}]});assert.equal(born.length,2);assert.equal(born[0].to,7);assert.equal(born[1].from,7);
  let total=0;for(const p of parts){const mid=p.from+(p.to-p.from)/2;assert(mid>p.from&&mid<p.to);total+=p.to-p.from;}near(total,input[0].to-input[0].from,0);
  const ordinary=[{from:0,to:1}];assert.equal(partitionPoweredOpticalIntervals({body:{birth:0},intervals:ordinary}),ordinary);
});
check('tail cuts are shifted by physical lag once and remain independent of wind update count',()=>{
  const body={birth:4,thrustProfile:{cells:[{toAge:.1},{toAge:.2},{toAge:.3}]}},lagSeconds=.25,intervals=[{from:4.34,to:4.36}],reference=partitionPoweredOpticalIntervals({body,lagSeconds,intervals});assert.deepEqual(reference.map(p=>[p.from,p.to]),[[4.34,4.35],[4.35,4.36]]);
  for(const hz of [30,60,120,1000]){const windTimeline=Array.from({length:Math.ceil(4.36*hz)},(_,i)=>({time:i/hz,wind:[Math.sin(i),0,0]})),p=partitionPoweredOpticalIntervals({body,lagSeconds,intervals,windTimeline});assert.deepEqual(p,reference);}return{rows:reference.length,hostWindRates:[30,60,120,1000],policy:'force-only partitions; within-piece wind midpoint approximation'};
});
check('invalid or unresolved subintervals and explicit partition overflow fail without truncation',()=>{
  const body={birth:1,thrustProfile:{cells:[{toAge:.1},{toAge:.2}]}},base={body,intervals:[{from:1,to:1.01}]};
  for(const patch of [{lagSeconds:-1},{lagSeconds:NaN},{intervals:[{from:1,to:1}]},{intervals:[{from:1,to:Infinity}]},{intervals:[{from:1,to:nextUp(1)}]},{intervals:Array.from({length:65},(_,i)=>({from:2+i*.02,to:2+i*.02+.01}))}])assert.throws(()=>partitionPoweredOpticalIntervals({...base,...patch}));
});
const event=createFireworkEvent({type:'chrysanthemum',effectProfile:'powered-bees-v1',starDragModel:'bounded-descent',seed:7421}),motors=event.heads.filter(b=>b.thrustProfile);
check('all 32 native motors retain at most three force portions across admitted short exposures',()=>{
  let maximum=0,samples=0;
  for(const body of motors)for(const shutter of [1/120,1/60])for(const age of [0,...body.thrustProfile.cells.flatMap(c=>[c.fromAge,c.toAge,c.toAge-shutter/2,c.toAge+shutter/2]),body.thrustProfile.motorEndAge+.1]){
    const to=body.birth+Math.max(0,age),from=Math.max(body.birth,to-shutter);if(!(to>from))continue;const parts=partitionPoweredOpticalIntervals({body,intervals:[{from,to}]});maximum=Math.max(maximum,parts.length);samples++;assert(parts.every(p=>p.to<=to&&p.from>=from));assert(parts.length<=3);
  }
  assert.equal(motors.length,32);metrics.partition={motors:32,sampledWindows:samples,maximumRowsPerWindow:maximum};return metrics.partition;
});
check('positive head/tail temporal weights conserve reference RGB and query only strict causal midpoints',()=>{
  const body=motors[0],forceEnd=body.birth+body.thrustProfile.cells[1].toAge,wind=[{time:-Infinity,wind:[0,0,0]},{time:forceEnd-.003,wind:[2,0,-1]},{time:forceEnd+.001,wind:[-1,0,2]}],evidence=[];
  for(const lag of [0,.2]){
    const to=forceEnd+lag+.004,from=to-1/120,S=to-from,field=lag?createTailReleaseFieldNode(body,lag):body,intervals=partitionPoweredOpticalIntervals({body,lagSeconds:lag,intervals:[{from,to}]}),sampleTimes=[],p={vectorEmission:true,sourceBody:body,emissionFraction:.7,...(lag?{emberBody:{},emberLagSeconds:lag,emberFraction:.1,emberNormalization:1,emberDecay:.8,emberColour:[1,1,1],emberColourMaximum:[1,1,1]}:{})};
    const rows=buildContactOpticalRecords({p,physicalNow:to,globalExposure:{from,to,durationSeconds:S,physicalNow:to,shutterSeconds:1/120},intervals,sampleAnchorAt(t){assert(t>from&&t<to&&t<=to&&t>=field.birth);sampleTimes.push(t);return lag?sampleTailReleaseFieldNode(field,t,wind):sampleBody(field,t,wind);}});
    assert.equal(rows.length,intervals.length);assert.equal(sampleTimes.length,rows.length);let weights=0;for(const row of rows){const w=row.contactSupport.temporalWeight;assert(w>0&&w<=1);assert.equal(row.sampledTime,row.viewExposure.from+(row.viewExposure.to-row.viewExposure.from)/2);assert(row.rgbTaps.every(v=>Number.isFinite(v)&&v>=0));assert.equal(row.rasterExposureSeconds,S);weights+=w;}near(weights,1,1e-14);
    const taps=new Float64Array(24);sampleBodyEmissionWindow(body,{fromAge:from-body.birth-lag,toAge:to-body.birth-lag,outRGB:taps});
    for(let c=0;c<3;c++){const actual=rows.reduce((sum,row)=>sum+Array.from({length:8},(_,k)=>row.rgbTaps[k*3+c]).reduce((a,b)=>a+b,0)/8,0);let expected=0;for(let k=0;k<8;k++)expected+=lag?(taps[k*3]*.2126+taps[k*3+1]*.7152+taps[k*3+2]*.0722)*.1*.8/8:taps[k*3+c]*.7/8;near(actual,expected,1e-7);}
    evidence.push({lag,rows:rows.length,weightSum:weights,allSamplesPast:true});
  }
  return evidence;
});
check('future and prebirth support are rejected before any physical anchor callback',()=>{
  const body=motors[0],p={vectorEmission:true,sourceBody:body,emissionFraction:1};let reads=0;const now=body.birth+.1;
  const futureFrom=now-.01,futureTo=now+.01,prebirthFrom=body.birth-.005,prebirthTo=body.birth+.005;for(const args of [{physicalNow:now,globalExposure:{from:futureFrom,to:futureTo,durationSeconds:futureTo-futureFrom},intervals:[{from:futureFrom,to:futureTo}]},{physicalNow:prebirthTo,globalExposure:{from:prebirthFrom,to:prebirthTo,durationSeconds:prebirthTo-prebirthFrom},intervals:[{from:prebirthFrom,to:prebirthTo}]}])assert.throws(()=>buildContactOpticalRecords({p,...args,sampleAnchorAt(){reads++;return{position:[0,1,0],velocity:[0,0,0]};}}));assert.equal(reads,0);
});
check('source transmission accepts exactly 18000 rows while packet and pair caps remain unchanged',()=>{
  assert.equal(SMOKE_TRANSMISSION_LIMITS.maxSources,18000);assert.equal(SMOKE_TRANSMISSION_LIMITS.maxPackets,4096);assert.equal(SMOKE_TRANSMISSION_LIMITS.maxPairs,1048576);assert.equal(SMOKE_TRANSMISSION_LIMITS.defaultSources,64);assert.equal(SMOKE_TRANSMISSION_LIMITS.defaultPairs,3072);
  const caps={maxSources:18000,maxPackets:4096,maxPairs:1048576};assert(planSmokeTransmission(18000,58,caps).supported);assert.equal(planSmokeTransmission(18000,59,caps).reason,'pair-work-capacity');assert.equal(planSmokeTransmission(18001,1,caps).reason,'source-capacity');assert.throws(()=>planSmokeTransmission(1,1,{...caps,maxSources:18001}));assert(planSmokeTransmission(256,4096,caps).supported);assert.equal(planSmokeTransmission(257,4096,caps).reason,'pair-work-capacity');assert.equal(planSmokeTransmission(1,4097,caps).reason,'packet-capacity');assert.equal(planSmokeTransmission(64,48).pairs,3072);assert.equal(planSmokeTransmission(65,1).reason,'source-capacity');
  const count=18000,input={count,snapshot:{revision:3,packets:[],profiles:[]},endpoints64:new Float64Array(count*3),origins64:new Float64Array(count*3),active:new Uint8Array(count),eye:[0,1,0],sourceVersion:4};const packed=packSmokeTransmissionInputs(input,caps);assert(packed.supported);assert.equal(packed.count,18000);assert.equal(packed.diagnostics.inactiveRows,18000);assert.equal(packSmokeTransmissionInputs({...input,count:18001},caps).reason,'source-capacity');return{rows:18000,pairCap:1048576,packetCap:4096,actualGPU:false};
});

const fwSource=read('fireworks.js'),needle='api.configure({});return api;';assert.equal(fwSource.split(needle).length,2);const fwCode=fwSource.replace(needle,'api.configure({});api.__qaSetRecords=rows=>{records=rows;clusterCache=null;boundCache=null;};return api;').replaceAll(/from '\.\/([^']+)'/g,(_,file)=>'from '+JSON.stringify(new URL(file,root).href)),fwFactory=(await import('data:text/javascript;base64,'+Buffer.from(fwCode).toString('base64'))).createFireworks;
check('CPU-only FW fill admits all 18000 rows and rejects 18001 without clipping or drawing',()=>{
  const f=fwFactory(THREE,{sourceVisibility:'none'}),row={eventId:'fixture',kind:'star',position:[0,20,-50],velocity:[0,0,0],colour:[1,1,1],radius:.003,intensity:1,sourceAge:.1},camera=new THREE.PerspectiveCamera(50,1,.1,30000);camera.position.set(0,2,1);camera.lookAt(0,20,-50);let draws=0;
  const renderer={autoClear:true,shadowMap:{autoUpdate:true,needsUpdate:false},getRenderTarget:()=>null,getActiveCubeFace:()=>0,getActiveMipmapLevel:()=>0,setRenderTarget(){},render(){draws++;}};
  const render=()=>f.render({renderer,target:{width:256,height:256},camera,optics:{shutterSeconds:1/120}});f.__qaSetRecords(Array(18000).fill(row));render();assert.equal(f.effectsScene.children[0].geometry.instanceCount,18000);assert.equal(f.effectsScene.children[0].geometry.getAttribute('aCentre').array.length,18000*3);assert.equal(draws,1);f.__qaSetRecords(Array(18001).fill(row));assert.throws(render,/capacity/);assert.equal(draws,1);assert.equal(f.effectsScene.children[0].geometry.instanceCount,18000);f.dispose();return{acceptedRows:18000,rejectedRows:18001,actualDraws:0,rendererStubCalls:draws};
});

const mainSource=read('main.js'),block=(name,next)=>mainSource.slice(mainSource.indexOf('function '+name+'('),mainSource.indexOf('function '+next+'(',mainSource.indexOf('function '+name+'('))),mainCode=[block('validateLensShutter','configureLensSettings'),block('configureLensSettings','setLens'),block('configureFireworksSettings','stopDirector'),block('launchFirework','setSea')].join('\n');
function mainHarness({shutter=1/120,profile='legacy',activeProfile=null}={}){
  const calls=[],context={parameters:{lens:{shutterSeconds:shutter,focal:35},director:{mode:'off'},paused:true},fireworksSettings:{effectProfile:profile,type:'chrysanthemum',autoFrame:false},lastPausedRenderKey:'before',lastFramedLaunches:0,lens:null,atmosphere:null,localLights:null,stopDirector:()=>calls.push('stopDirector'),markCustomQuality:()=>calls.push('markCustomQuality'),setLens:()=>calls.push('setLens'),frameFireworks:()=>calls.push('frameFireworks'),updateScenePhotometry:()=>calls.push('updateScenePhotometry'),ui:{syncLens:()=>calls.push('syncLens'),syncFireworks:()=>calls.push('syncFireworks'),setPaused:()=>calls.push('setPaused'),notify:()=>calls.push('notify')},fireworks:{configure(value){calls.push(['configure',structuredClone(value)]);if(value.autoLaunch&&value.effectProfile==='powered-bees-v1')throw Error('candidate autoLaunch rejected');return value;},launch(value){calls.push(['launch',structuredClone(value)]);if(value.randomType&&value.effectProfile&&value.effectProfile!=='legacy')throw Error('candidate random rejected');return{accepted:true};},diagnostics:()=>({launches:1,activeEvents:activeProfile?[{effectProfile:activeProfile}]:[]})}};
  vm.runInNewContext(mainCode+';this.api={configureLensSettings,configureFireworksSettings,launchFirework};',context);return{context,calls,api:context.api,snapshot:()=>JSON.stringify({parameters:context.parameters,fireworksSettings:context.fireworksSettings,lastPausedRenderKey:context.lastPausedRenderKey,calls})};
}
check('main lens rejects long exposures with configured or active motors before any setting mutation',()=>{
  for(const options of [{profile:'powered-bees-v1'},{activeProfile:'powered-bees-v1'}]){const h=mainHarness(options),before=h.snapshot();assert.throws(()=>h.api.configureLensSettings({shutterSeconds:nextUp(1/60)},{sync:true,markQuality:true}),/1\/60/);assert.equal(h.snapshot(),before);h.api.configureLensSettings({shutterSeconds:1/60});assert.equal(h.context.parameters.lens.shutterSeconds,1/60);}
  const ordinary=mainHarness();ordinary.api.configureLensSettings({shutterSeconds:1});assert.equal(ordinary.context.parameters.lens.shutterSeconds,1);
});
check('main candidate configuration and launch reject unsupported shutter before effects/UI/state mutate',()=>{
  const h=mainHarness({shutter:.5}),before=h.snapshot();assert.throws(()=>h.api.configureFireworksSettings({effectProfile:'powered-bees-v1'}),/1\/60/);assert.equal(h.snapshot(),before);assert.throws(()=>h.api.launchFirework({effectProfile:'powered-bees-v1'}),/1\/60/);assert.equal(h.snapshot(),before);
  const direct=mainHarness({shutter:.5,profile:'powered-bees-v1'}),saved=direct.snapshot();assert.throws(()=>direct.api.launchFirework(),/1\/60/);assert.equal(direct.snapshot(),saved);
});
check('main explicit random+candidate request rejects before resetting the selected profile',()=>{
  const h=mainHarness({profile:'powered-bees-v1'}),before=h.snapshot();assert.throws(()=>h.api.launchFirework({randomType:true,effectProfile:'powered-bees-v1'}),/explicit chrysanthemum/);assert.equal(h.snapshot(),before);const accepted=h.api.launchFirework({randomType:true});assert.equal(accepted.accepted,true);assert.equal(h.context.fireworksSettings.effectProfile,'legacy');assert(h.calls.some(c=>Array.isArray(c)&&c[0]==='launch'));
});
check('main native source-transmission allocation changes source count only',()=>{
  const match=mainSource.match(/function configureSmokeGPUField\(enabled,caps=\{maxSources:(\d+),maxPackets:(\d+),maxPairs:(\d+)\}\)/);assert(match);assert.deepEqual(match.slice(1).map(Number),[18000,4096,1048576]);return{maxSources:18000,maxPackets:4096,maxPairs:1048576};
});
const files=['firework-powered-optics.js','firework-contact-optics.js','fireworks.js','main.js','pyro-smoke-transmission-pack.js','pyro-smoke-transmission-gpu.js'],report={schema:'glass-atoll.r22-independent-powered-optics-cpu.v1',dateUTC:new Date().toISOString(),passed:checks.every(c=>c.passed),counts:{checks:checks.length,passed:checks.filter(c=>c.passed).length},checks,metrics,sourceSHA256:Object.fromEntries(files.map(file=>[file,hash(read(file))])),findings:[],limits:['No actual WebGL context, browser, GPU compilation, texture sampling or frame-time admission.','Force-only temporal partition; actual anchors retain committed wind, with within-piece wind derivative jumps approximated at local midpoint.','Positive source-only subinterval weights do not integrate camera motion or time-varying source transmission T(t).','Exact main function slices run in isolated CPU stubs; full browser UI binding remains root acceptance.']};fs.writeFileSync(new URL('./r22-independent-powered-optics-check.json',import.meta.url),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({passed:report.passed,counts:report.counts,metrics,failed:checks.filter(c=>!c.passed)},null,2));if(!report.passed)process.exitCode=1;
