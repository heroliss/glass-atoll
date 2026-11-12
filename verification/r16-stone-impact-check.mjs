import {strict as assert} from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {createHash} from 'node:crypto';
import * as THREE from '../vendor/three.module.js';
import {resolveWaterImpact,createWaterImpactDroplets,representedDropletEnergy,waterImpactSound} from '../water-impact.js';
import {createSplash} from '../splash.js';
import {splashAudioParameters,proceduralSplashPCM,createSoundscape} from '../audio.js';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const read=name=>fs.readFileSync(path.join(root,name),'utf8');
const importSource=source=>import('data:text/javascript;base64,'+Buffer.from(source).toString('base64'));
const baselineSplash=await importSource(read('verification/baselines/r16-stone-impact/splash.js').replace("from './waves.js'",`from '${pathToFileURL(path.join(root,'waves.js')).href}'`));
const baselineAudio=await importSource(read('verification/baselines/r16-stone-impact/audio.js'));
const checks=[];
const test=async(name,fn)=>{try{checks.push({name,passed:true,evidence:await fn()});}catch(e){checks.push({name,passed:false,error:e.stack||String(e)});}};
const close=(a,b,tolerance=1e-10)=>assert.ok(Math.abs(a-b)<=tolerance,`${a} != ${b}`);
const mass=2600*Math.PI*.025**3/6;
const impact=(v,extra={})=>({stoneDiameter:.025,mass,velocity:v,...extra});
const near=resolveWaterImpact(impact([0,-5,0])),far=resolveWaterImpact(impact([0,-22,0]));
const camera=new THREE.PerspectiveCamera();
const uniforms={uSwell:{value:0},uWind:{value:0},uWindSea:{value:0},uCurrentOffset:{value:new THREE.Vector2()}};

await test('same2.5cm physical mass; normal energy matches kinetic decomposition',()=>{
  close(mass,.021271200258680896);
  const a=resolveWaterImpact(impact([0,-10,0])),b=resolveWaterImpact(impact([Math.sqrt(100-6.25),-2.5,0]));
  close(a.energyJoules,b.energyJoules);close(b.normalEnergyJoules/a.normalEnergyJoules,1/16);
  close(b.energyJoules,b.normalEnergyJoules+b.tangentialEnergyJoules);
  assert.ok(b.maximumCrownRadiusMetres<a.maximumCrownRadiusMetres);
  assert.ok(waterImpactSound(1,impact([Math.sqrt(100-6.25),-2.5,0])).gain<waterImpactSound(1,impact([0,-10,0])).gain);
  return{normal:a,oblique:b};
});
await test('relative impact invariant under common translation and scaled surface normal',()=>{
  const a=resolveWaterImpact(impact([3,-8,4],{surfaceVelocity:[.2,1,-.4],surfaceNormal:[.2,1,.1]}));
  const b=resolveWaterImpact(impact([13,-10,11],{surfaceVelocity:[10.2,-1,6.6],surfaceNormal:[2,10,1]}));
  close(a.normalEnergyJoules,b.normalEnergyJoules);close(a.energyJoules,b.energyJoules);close(a.severity,b.severity);
  return{energy:a.energyJoules,normalEnergy:a.normalEnergyJoules};
});
await test('velocity is authoritative; inconsistent caller total-energy cannot inflate water crown',()=>{
  const a=resolveWaterImpact(impact([4,-3,0],{energy:1000,normalSpeed:400}));
  close(a.energyJoules,.5*mass*25);close(a.normalEnergyJoules,.5*mass*9);
  assert.ok(a.suppliedEnergyDifferenceJoules>999);return a;
});
await test('upward and tangential motion have zero normal response; no magic minimum splash',()=>{
  for(const v of [[0,4,0],[4,0,2],[0,0,0]]){
    const a=resolveWaterImpact(impact(v));assert.equal(a.normalEnergyJoules,0);assert.equal(a.visible,false);
    assert.equal(createWaterImpactDroplets(a).count,0);assert.equal(waterImpactSound(1,impact(v)).gain,0);
  }
});
await test('invalid vectors and unrepresentable energy fail explicitly',()=>{
  for(const metadata of [{mass:-1,normalSpeed:4},{mass,velocity:[0,NaN,0]},{mass,energy:-1},{mass,normalSpeed:4,surfaceNormal:[0,0,0]},{mass,velocity:[0,-1e300,0]}])
    assert.equal(resolveWaterImpact(metadata).valid,false);
  assert.equal(resolveWaterImpact({surfaceHeight:0,stoneDiameter:.025}),null);
});
await test('unclipped normal5→22m/s changes radius, count, velocity, duration and sound',()=>{
  const a=createWaterImpactDroplets(near),b=createWaterImpactDroplets(far);
  assert.ok(far.scale>near.scale*1.5&&b.count>a.count*1.5&&b.durationSeconds>a.durationSeconds*1.4);
  assert.ok(Math.max(...b.velocities)>Math.max(...a.velocities)*1.4);
  const audioA=waterImpactSound(1,impact([0,-5,0])),audioB=waterImpactSound(1,impact([0,-22,0]));
  assert.ok(audioB.gain>audioA.gain*1.8&&audioB.playbackRate<audioA.playbackRate&&audioB.lowpassHz>audioA.lowpassHz);
  return{low:{impact:near,count:a.count,duration:a.durationSeconds,audio:audioA},high:{impact:far,count:b.count,duration:b.durationSeconds,audio:audioB}};
});
await test('actual generated droplets repeat and use0.4–4mm diameters at ordinary impact speeds',()=>{
  const rows=[];
  for(const v of [1,3,5,10,16,22]){
    const r=resolveWaterImpact(impact([0,-v,0])),d=createWaterImpactDroplets(r,{seed:77});
    assert.deepEqual(d,createWaterImpactDroplets(r,{seed:77}));
    assert.ok(Math.min(...d.radii)*2>=.0004&&Math.max(...d.radii)*2<=.004);
    rows.push({v,diameterRange:[Math.min(...d.radii)*2,Math.max(...d.radii)*2],count:d.count});
  }return rows;
});
await test('generated droplet energy includes kinetic, height and new surface area; fits explicit3% normal-energy budget',()=>{
  let maxFraction=0,minRadiusScale=1;
  for(const v of [.0031,.01,.05,.2,1,5,22,100])for(const capacity of [24,96,160]){
    const r=resolveWaterImpact(impact([2,-v,0])),d=createWaterImpactDroplets(r,{seed:53,capacity});
    const e=representedDropletEnergy(d);
    close(e.totalJoules,e.kineticJoules+e.potentialJoules+e.surfaceJoules);
    assert.ok(e.totalJoules<=r.representedDropEnergyBudgetJoules*(1+1e-9)+1e-15);
    maxFraction=Math.max(maxFraction,e.totalJoules/Math.max(1e-30,r.normalEnergyJoules));minRadiusScale=Math.min(minRadiusScale,d.radiusScale);
    assert.ok(d.count<=160&&d.gravity===9.81);
  }return{maxFraction,minRadiusScale,limits:'Budget covers represented droplets, not unresolved sheet/ripples/cavity.'};
});
await test('physical droplet flight returns to initial water plane with g9.81; no slow-motion clock',()=>{
  const d=createWaterImpactDroplets(far,{seed:9});
  for(let i=0;i<d.count;i++){const t=d.lives[i];close(d.offsets[i*3+1]+d.velocities[i*3+1]*t-4.905*t*t,0,1e-12);}
});
await test('all accepted splash GLSL literal strings remain byte-identical',()=>{
  const shaders=s=>Array.from(s.matchAll(/const (\w+(?:GLSL|Vertex|Fragment))=(?:\/\* glsl \*\/)?`([\s\S]*?)`;/g),m=>[m[1],m[2]]);
  const before=shaders(read('verification/baselines/r16-stone-impact/splash.js')),after=shaders(read('splash.js'));
  assert.equal(before.length,5);assert.deepEqual(after,before);return{programStrings:after.map(v=>v[0])};
});
await test('legacy strength-only and surfaceHeight-only preserve exact geometry and shared shader uniform clock',()=>{
  const a=createSplash(THREE,{scene:new THREE.Scene(),uniforms}),b=baselineSplash.createSplash(THREE,{scene:new THREE.Scene(),uniforms});
  for(const strength of [.25,1,1.6]){
    a.spawn(3,5,10,strength,{surfaceHeight:.2});b.spawn(3,5,10,strength,{surfaceHeight:.2});
    const am=a.root.children.at(-1).children,bm=b.root.children.at(-1).children;
    for(const key of ['aOffset','aVelocity','aRadius','aLife'])assert.deepEqual(am[0].geometry.attributes[key].array,bm[0].geometry.attributes[key].array);
    assert.equal(am[0].material.uniforms,am[1].material.uniforms);
    a.update(.1,10.1,camera,700);b.update(.1,10.1,camera,700);close(am[0].material.uniforms.uAge.value,bm[0].material.uniforms.uAge.value);
  }a.dispose();b.dispose();
});
await test('production geometry receives new physical attributes and separate crown timing; pause and capacity retained',()=>{
  const scene=new THREE.Scene(),s=createSplash(THREE,{scene,uniforms});
  const a=s.spawn(2,3,10,1,impact([0,-22,0],{surfaceHeight:.1}));const meshes=s.root.children[0].children;
  assert.equal(meshes[0].geometry.instanceCount,createWaterImpactDroplets(far).count);assert.ok(a.impact.normalEnergyJoules>5);
  s.update(.1,10.1,camera,900);close(meshes[0].material.uniforms.uAge.value,.1);
  close(meshes[1].material.uniforms.uAge.value,.1*.34/far.crownDurationSeconds);
  const age=meshes[0].material.uniforms.uAge.value;s.update(.1,10.1,camera,900);close(meshes[0].material.uniforms.uAge.value,age);
  for(let i=0;i<8;i++)s.spawn(2,3,10.1,1,impact([0,-5,0]));assert.equal(s.state.active,4);
  s.update(1,12,camera,900);assert.equal(s.state.active,0);s.dispose();assert.equal(scene.children.length,0);
});
await test('omitting impact metadata preserves original splash PCM bit-for-bit',()=>{
  for(const sampleRate of [22050,48000])for(const seed of [7219,7920])
    assert.deepEqual(proceduralSplashPCM(sampleRate,seed),baselineAudio.proceduralSplashPCM(sampleRate,seed));
});
await test('live and offline new sound mapping is identical; legacy gain/rates preserved',()=>{
  const metadata=impact([4,-10,0]);assert.deepEqual(splashAudioParameters(1,metadata,3),splashAudioParameters(1,metadata,0,{offline:true}));
  close(splashAudioParameters(1,{},3).playbackRate,1.03);close(splashAudioParameters(1,{},3).gain,.9);
  close(splashAudioParameters(1,{},0,{offline:true}).playbackRate,1);
});

// Instrumented Web Audio API fixture exercises the real renderOffline() branch.
// It does not replace native HRTF/compressor listening or browser audio QA.
const param=value=>({value,setValueAtTime(v){this.value=v;},linearRampToValueAtTime(v){this.value=v;},setTargetAtTime(v){this.value=v;}});
const recordedContexts=[];
class InstrumentedOfflineContext{
  constructor(channels,length,sampleRate){this.sampleRate=sampleRate;this.length=length;this.channels=channels;this.currentTime=0;this.destination={};this.nodes=[];this.listener={setPosition(){},setOrientation(){}};recordedContexts.push(this);}
  node(kind,extra={}){const n={kind,connected:[],connect(target){this.connected.push(target);},disconnect(){},...extra};this.nodes.push(n);return n;}
  createGain(){return this.node('gain',{gain:param(1)});}
  createDynamicsCompressor(){return this.node('compressor',Object.fromEntries(['threshold','knee','ratio','attack','release'].map(k=>[k,param(0)])));}
  createBiquadFilter(){return this.node('filter',{frequency:param(0),Q:param(0)});}
  createPanner(){return this.node('panner',{setPosition(...p){this.position=p;}});}
  createDelay(){return this.node('delay',{delayTime:param(0)});}
  createBufferSource(){return this.node('source',{playbackRate:param(1),start(at=0){this.startedAt=at;},stop(){}});}
  createBuffer(channels,length,sampleRate){const data=Array.from({length:channels},()=>new Float32Array(length));return{sampleRate,duration:length/sampleRate,length,numberOfChannels:channels,copyToChannel(a,i){data[i].set(a);},getChannelData(i){return data[i];}};}
  async decodeAudioData(){const b=this.createBuffer(1,12000,this.sampleRate);b.getChannelData(0).fill(.005);return b;}
  async startRendering(){return this.createBuffer(this.channels,this.length,this.sampleRate);}
}
await test('actual renderOffline schedules normal/oblique energy gains, filters, rates, arrival delay and legacy fallback',async()=>{
  const oldFetch=globalThis.fetch;globalThis.fetch=async()=>({ok:true,arrayBuffer:async()=>new ArrayBuffer(8)});
  const sound=createSoundscape({OfflineAudioContextConstructor:InstrumentedOfflineContext,proceduralAir:false});
  try{
    const metadata=[impact([0,-5,0]),impact([0,-22,0]),impact([Math.sqrt(100-6.25),-2.5,0])];
    const result=await sound.renderOffline({seconds:3,sampleRate:22050,cameraPosition:[0,.03,0],splashEvents:[
      {at:.3,x:34.3,z:0,strength:1,impact:metadata[0]},
      {at:.8,x:34.3,z:0,strength:1,...metadata[1]},
      {at:1.3,x:34.3,z:0,strength:1,impact:metadata[2]},
      {at:1.8,x:34.3,z:0,strength:1},
    ]});
    const ctx=recordedContexts.at(-1),sources=ctx.nodes.filter(n=>n.kind==='source'&&!n.loop),rows=[];
    assert.equal(sources.length,4);assert.equal(result.report.splashResponses.length,4);
    for(let i=0;i<4;i++){
      const expected=splashAudioParameters(1,metadata[i]||{},0,{offline:true}),source=sources[i];
      const filter=source.connected[0].kind==='filter'?source.connected[0]:null,gain=filter?filter.connected[0]:source.connected[0],spatial=gain.connected[0],delay=spatial.connected[0];
      close(gain.gain.value,expected.gain);close(source.playbackRate.value,expected.playbackRate);close(delay.delayTime.value,.1);
      if(i<3){assert.ok(filter);close(filter.frequency.value,expected.lowpassHz);}else assert.equal(filter,null);
      rows.push({at:source.startedAt,gain:gain.gain.value,rate:source.playbackRate.value,lowpassHz:filter?.frequency.value??null,delay:delay.delayTime.value});
    }
    assert.ok(rows[1].gain>rows[0].gain&&rows[2].gain<rows[0].gain);return{rows,limits:'Instrumented graph-control acceptance only, fixture renders silence; native acoustic listening pending.'};
  }finally{globalThis.fetch=oldFetch;sound.dispose();}
});
await test('locked fireworks audio source unchanged',()=>assert.equal(createHash('sha256').update(read('fireworks-audio.js')).digest('hex'),'4e5ede41813249f062e50b212553e5e1821c27feaead8416b68ab51ba1b8ec31'));

const files=['water-impact.js','splash.js','audio.js','fireworks-audio.js'];
const report={schema:'glass-atoll.r16-stone-impact.v1',created:new Date().toISOString(),passed:checks.every(c=>c.passed),passedCount:checks.filter(c=>c.passed).length,total:checks.length,checks,
  sha256:Object.fromEntries(files.map(f=>[f,createHash('sha256').update(read(f)).digest('hex')])),
  limits:['CPU mechanics, actual geometry/uniform wiring and instrumented offline graph only; no GPU draw or native WebAudio listening performed.','Authored response, not a calibrated entry flow/pressure solver. Current main supplies a world-up normal and still-water velocity approximation.','Crown remains rotationally symmetric. Oblique entry adds modest droplet drift; asymmetric sheet/cavity and stone skipping are unresolved.','Represented droplet budget excludes the authored crown and shared ripple response.','Existing accepted reflection-only splash shader strings preserved; quarantined local-water-environment shader not restored.']};
const output=path.join(root,'verification/r16-stone-impact-check.json');
if(!report.passed&&!fs.existsSync(path.join(root,'verification/r16-stone-impact-first-failure.json')))fs.writeFileSync(path.join(root,'verification/r16-stone-impact-first-failure.json'),JSON.stringify(report,null,2)+'\n');
fs.writeFileSync(output,JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report,null,2));if(!report.passed)process.exitCode=1;
