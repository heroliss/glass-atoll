import assert from 'node:assert/strict';
import fs from 'node:fs';
import crypto from 'node:crypto';
import * as THREE from '../vendor/three.module.js';
import {sampleBodyEmission,sampleBodyEmissionWindow,EMISSION_PROFILES} from '../fireworks-physics.js';
import {resolveFireworkExposure,sampleFixedReleaseEmberWindow} from '../firework-exposure-window.js';
import {sampleTrailColour} from '../firework-trail-profile.js';
const source=fs.readFileSync(new URL('../fireworks.js',import.meta.url),'utf8'),baseline=fs.readFileSync(new URL('./baselines/r18-before-vector-render/fireworks.js',import.meta.url),'utf8'),oldPhysics=fs.readFileSync(new URL('./baselines/r17-physics-before-layers/fireworks-physics.js',import.meta.url));
const hash=s=>crypto.createHash('sha256').update(s).digest('hex'),started=new Date().toISOString(),checks=[],owned=[],textures=[],RAW=3.6e-5;
const close=(a,b,t=3e-7)=>assert.ok(Math.abs(a-b)<=t*Math.max(1,Math.abs(a),Math.abs(b)),`${a} != ${b}`),vec=(a,b,t)=>a.forEach((v,c)=>close(v,b[c],t)),Y=a=>a[0]*.2126+a[1]*.7152+a[2]*.0722;
function check(name,fn){try{checks.push({name,passed:true,details:fn()??null});}catch(e){checks.push({name,passed:false,error:String(e.message).slice(0,5000)});}}
async function factory(text,isOld){
  const resolved=text.replace(/from (['"])(\.\/[^'"]+)\1/g,(_,q,path)=>`from '${(isOld&&path==='./fireworks-physics.js'?new URL('./baselines/r17-physics-before-layers/fireworks-physics.js',import.meta.url):new URL('../'+path.slice(2),import.meta.url)).href}'`);
  assert.ok(resolved.includes('geometry.instanceCount=ordered.length;'));assert.ok(resolved.includes('api.configure({});return api;'));
  const instrumented=resolved.replace('const effectsScene=new THREE.Scene();','let __qaOrdered=[];const effectsScene=new THREE.Scene();').replace('geometry.instanceCount=ordered.length;','__qaOrdered=ordered.map(row=>row.p);geometry.instanceCount=ordered.length;').replace('api.configure({});return api;',`api.configure({});api.__qa={records:()=>records,active:()=>simulation.active,ordered:()=>__qaOrdered,setRecords:rows=>{records=rows;clusterCache=null;boundCache=null;recordsGeneration++;}};return api;`);
  const module=await import('data:text/javascript;base64,'+Buffer.from(instrumented).toString('base64'));module.createFireworks.__qaThermalTailColour=module.thermalTailColour;return module.createFireworks;
}
const makeFactory=await factory(source,false),oldFactory=await factory(baseline,true);
function make({old=false,effectProfile='legacy',seed=42,type='chrysanthemum',gain=1,trailIntegration='legacy8'}={}){
  const f=(old?oldFactory:makeFactory)(THREE,{sourceVisibility:'none',clusterModel:'moments',trailIntegration});owned.push(f);
  f.configure({type,autoDirection:false,azimuth:104,elevation:80,launchSpreadDegrees:0,burstTiltDegrees:0,burstRollDegrees:0,intensityScale:gain,...(old?{}:{effectProfile})});const launch=f.launch({seed});assert.equal(launch.accepted,true);return{f,launch};
}
function advance(f,time,wind=[0,0,0]){f.update({time,dt:1/60,windVector:wind});}
function camera(reflection=false){const c=new THREE.PerspectiveCamera(55,1.5,.1,30000);c.position.set(180,reflection?-90:90,500);c.lookAt(60,150,0);c.updateMatrixWorld();return c;}
function renderer(){return{autoClear:true,shadowMap:{autoUpdate:true,needsUpdate:false},target:null,getRenderTarget(){return this.target;},getActiveCubeFace(){return 0;},getActiveMipmapLevel(){return 0;},setRenderTarget(t){this.target=t;},render(){}};}
function medium(T=[.2,.4,.6]){const calls=[],snapshot={revision:7,packets:[{id:'fixed-density'}]};return{calls,snapshot:()=>snapshot,writeTransmission(eye,endpoint,out,options){calls.push({eye:[...eye],endpoint:[...endpoint],...options});out.set(T);return out;}};}
function capture(f,{reflection=false,shutter=1/120,m=null,batch=null}={}){
  f.render({renderer:renderer(),target:{width:1200,height:800},camera:camera(reflection),reflection,planeY:0,medium:m,transmissionBatch:batch,legacySmoke:false,optics:{width:1200,height:800,shutterSeconds:shutter,dof:false},frame:{storageEV:0,rawPerCandela:RAW}});
  const mesh=f.effectsScene.children[0],g=mesh.geometry,n=g.instanceCount;return{count:n,rows:f.__qa.ordered(),attributes:Object.fromEntries(Object.entries(g.attributes).map(([k,a])=>[k,a.array.slice(0,k==='position'?a.array.length:n*a.itemSize)])),uniforms:mesh.material.uniforms,shader:mesh.material.fragmentShader,diagnostics:f.diagnostics().lastRender};
}
function sourceRows(f){return f.__qa.records().filter(p=>p.kind!=='smoke');}
function snapshotRows(f){return f.__qa.records().map(p=>({eventId:p.eventId,kind:p.kind,position:p.position,velocity:p.velocity,stretch:p.stretch,colour:p.colour,radius:p.radius,intensity:p.intensity,unmodulatedIntensity:p.unmodulatedIntensity,opticalDepth:p.opticalDepth,sourceAge:p.sourceAge,sourceBody:p.sourceBody}));}
function ledgerCopy(f){const a=f.getEmissionLedger({rawPerCandela:RAW});return{...a,data:a.data.slice(0,a.count*a.stride)};}
function sumRows(rows){const s=[0,0,0];for(const p of rows)for(let c=0;c<3;c++)s[c]+=p.emissionRGBReference?.[c]??p.intensity*p.colour[c];return s;}
function sumLedger(l){const s=[0,0,0];for(let i=0;i<l.count;i++)for(let c=0;c<3;c++)s[c]+=l.data[i*8+4+c]/RAW;return s;}
function sumClusters(f){const s=[0,0,0];for(const l of f.getLightClusters())for(let c=0;c<3;c++)s[c]+=l.referenceCandela*l.color[c];return s;}
function taps(a,row){return Array.from({length:24},(_,k)=>a.attributes['aTemporal'+Math.floor(k/4)][row*4+k%4]);}
function mockBatch({fail=false,stale=false}={}){const requests=[];return{requests,prepare(p){requests.push({count:p.count,eye:[...p.eye],endpoints64:p.endpoints64.slice(0,p.count*3),origins64:p.origins64.slice(0,p.count*3),sourceVersion:p.sourceVersion});if(fail)throw new Error('fixture GPU field rejected');const width=64,height=Math.ceil(p.count/width),data=new Float32Array(width*height*4).fill(1);for(let i=0;i<p.count;i++)data.set([.2,.4,.6,1],i*4);const texture=new THREE.DataTexture(data,width,height,THREE.RGBAFormat,THREE.FloatType);textures.push(texture);return{effective:true,texture,width,height,count:p.count,sourceVersion:p.sourceVersion-(stale?1:0),densityRevision:p.snapshot.revision,cameraKey:p.eye.map(v=>Object.is(v,-0)?'-0':String(v)).join(','),reason:'fixture GPU transmission'};}};}

check('Baseline imports use actual frozen fb6 physics, never the current candidate implementation',()=>{assert.equal(hash(oldPhysics),'fb6be290ea34ced9a36925c0ec24e2e3745c1108bded80d4a8aee0d72fe63236');return{baselineSHA256:hash(baseline),oldPhysicsSHA256:hash(oldPhysics)};});
check('No-options constructor/default launch retain exact legacy records, ledger and cluster values',()=>{
  const a=makeFactory(THREE),b=oldFactory(THREE);owned.push(a,b);const A=a.launch({seed:42}),B=b.launch({seed:42});assert.deepEqual(A,B);advance(a,A.burstTime+.4);advance(b,B.burstTime+.4);assert.deepEqual(snapshotRows(a),snapshotRows(b));assert.deepEqual(ledgerCopy(a),ledgerCopy(b));assert.deepEqual(a.getLightClusters(),b.getLightClusters());return{type:a.diagnostics().activeEvents[0].type};
});
check('Legacy records, full ledger and clusters remain exactly equal to real frozen factory',()=>{
  let phases=0;for(const type of ['peony','chrysanthemum','willow','crossette']){const a=make({type}),b=make({old:true,type});for(const dt of [-.1,.4,1.5]){const t=a.launch.burstTime+dt;advance(a.f,t,[2.1,0,.7]);advance(b.f,t,[2.1,0,.7]);assert.deepEqual(snapshotRows(a.f),snapshotRows(b.f));assert.deepEqual(ledgerCopy(a.f),ledgerCopy(b.f));assert.deepEqual(a.f.getLightClusters(),b.f.getLightClusters());phases++;}}return{types:4,phases};
});
check('Legacy main/mirror common upload bytes remain exact; additional vector attributes are zero',()=>{
  let views=0;for(const trailIntegration of ['legacy8','adaptive']){const a=make({trailIntegration}),b=make({old:true,trailIntegration});advance(a.f,a.launch.burstTime+1);advance(b.f,b.launch.burstTime+1);for(const reflection of [false,true]){const A=capture(a.f,{reflection}),B=capture(b.f,{reflection});assert.equal(A.count,B.count);for(const [key,value]of Object.entries(B.attributes))assert.deepEqual(A.attributes[key],value,`legacy ${trailIntegration}/${reflection}/${key}`);for(let i=2;i<6;i++)assert.ok(A.attributes['aTemporal'+i].every(v=>v===0));views++;}}return{views};
});
check('Candidate192 current head RGB and fixed-release own-age spectra sum identically into ledger and clusters',()=>{
  const output=[];for(const effectProfile of ['three-heart-v1','two-colour-v1']){const {f,launch}=make({effectProfile}),now=launch.burstTime+1.5;advance(f,now);const rows=sourceRows(f),heads=rows.filter(p=>p.vectorEmission&&!p.emberBody),tails=rows.filter(p=>p.vectorEmission&&p.emberBody);assert.equal(heads.length,192);assert.ok(tails.length>=192);
    for(const p of heads){const sample=sampleBodyEmission(p.sourceBody,p.sourceAge);vec(p.emissionRGBReference,sample.emissionRGBReference.map(v=>v*(p.sourceBody.trailProfile?.headIntensityFraction??.66)),1e-12);close(p.intensity,Y(p.emissionRGBReference),1e-12);}
    for(const p of tails){const age=now-p.emberBody.birth,expected=p.emberSourceIntensity*Math.exp(-3.5*age/p.emberDuration);vec(p.emissionRGBReference,(p.sourceBody.trailProfile?sampleTrailColour(p.sourceBody.trailProfile,age):EMISSION_PROFILES.thermal).map(v=>v*expected),1e-11);}
    const sum=sumRows(rows),ledger=ledgerCopy(f),cluster=sumClusters(f);vec(sumLedger(ledger),sum,1e-7);vec(cluster,sum,1e-12);output.push({effectProfile,heads:heads.length,tails:tails.length,ledgerRows:ledger.count,referenceRGB:sum});}return output;
});
check('Colour-only emission change invalidates ledger/cache key while density revision and source positions stay fixed',()=>{
  const {f,launch}=make({effectProfile:'two-colour-v1'});advance(f,launch.burstTime+1);const head=sourceRows(f).find(p=>p.vectorEmission&&!p.emberBody),body=head.sourceBody;
  const at=age=>{const e=sampleBodyEmission(body,age),rgb=e.emissionRGBReference.map(v=>v*.66),I=Y(rgb);return{...head,sourceAge:age,emissionRGBReference:rgb,intensity:I,colour:rgb.map(v=>v/I)};};
  f.__qa.setRecords([at(.5)]);const A=ledgerCopy(f),aRGB=sumClusters(f);f.__qa.setRecords([at(2)]);const B=ledgerCopy(f),bRGB=sumClusters(f);assert.ok(B.version>A.version);assert.notDeepEqual(Array.from(A.data),Array.from(B.data));assert.notDeepEqual(aRGB,bRGB);assert.deepEqual(Array.from(A.data.slice(0,4)),Array.from(B.data.slice(0,4)));const fixedDensityRevision=7;assert.notDeepEqual([fixedDensityRevision,A.version],[fixedDensityRevision,B.version]);return{densityRevision:fixedDensityRevision,ledgerVersions:[A.version,B.version],geometry:'same XYZ/variance',scope:'CPU source-generation/cache-key contract, not an actual GPU light-field bake'};
});
check('Candidate I0 optical gain is not multiplied a second time in current records or upload RGB',()=>{
  const one=make({effectProfile:'two-colour-v1',gain:1}),two=make({effectProfile:'two-colour-v1',gain:2});advance(one.f,one.launch.burstTime+.7);advance(two.f,two.launch.burstTime+.7);vec(sumRows(sourceRows(two.f)),sumRows(sourceRows(one.f)).map(v=>2*v),1e-12);
  const A=capture(one.f,{shutter:0}),B=capture(two.f,{shutter:0});assert.equal(A.count,B.count);for(let i=0;i<A.count;i++){const x=taps(A,i),z=taps(B,i);vec(z,x.map(v=>2*v));}return{instances:A.count};
});
check('Candidate S0 and causal S1/120 upload all24 RGB coefficients in agreed6vec4 order for both views',()=>{
  let rows=0;for(const reflection of [false,true])for(const shutter of [0,1/120]){const {f,launch}=make({effectProfile:'two-colour-v1'});const now=launch.burstTime+1.5;advance(f,now);const a=capture(f,{reflection,shutter}),window=resolveFireworkExposure({physicalNow:now,shutterSeconds:shutter});assert.equal(a.uniforms.uShutter.value,window.durationSeconds);
    for(let i=0;i<a.count;i++){const p=a.rows[i];if(!p.vectorEmission)continue;assert.equal(a.attributes.aShape[i*4+3],-1);vec(Array.from(a.attributes.aColour.slice(i*3,i*3+3)),[1,1,1]);const expected=new Float64Array(24);
      if(p.emberBody)sampleFixedReleaseEmberWindow({releaseTime:p.emberBody.birth,sourceIntensity:p.emberSourceIntensity,duration:p.emberDuration,colourAtAge:()=>EMISSION_PROFILES.thermal,allPhaseColourMaximum:EMISSION_PROFILES.thermal},{fromTime:window.from,toTime:window.to,outRGB:expected});else{sampleBodyEmissionWindow(p.sourceBody,{fromAge:window.from-p.sourceBody.birth,toAge:window.to-p.sourceBody.birth,outRGB:expected});for(let k=0;k<24;k++)expected[k]*=p.emissionFraction;}
      vec(taps(a,i),Array.from(expected));rows++;}
  }return{vectorRows:rows,packing:'flat RGB0..7 in consecutive aTemporal0..5 vec4 components'};
});
check('Cooling-tail mode uses fixed past release intensity and separately ages the gold ember spectrum',()=>{
  const {f,launch}=make({effectProfile:'two-colour-v1'}),now=launch.burstTime+1.5;advance(f,now);f.configure({tailColourMode:'cooling'});const a=capture(f,{shutter:1/120}),window=resolveFireworkExposure({physicalNow:now,shutterSeconds:1/120});let checked=0;
  for(let i=0;i<a.count;i++){const p=a.rows[i];if(!p.emberBody)continue;const expected=new Float64Array(24);sampleFixedReleaseEmberWindow({releaseTime:p.emberBody.birth,sourceIntensity:p.emberSourceIntensity,duration:p.emberDuration,colourAtAge:age=>makeFactory.__qaThermalTailColour(age,p.emberDuration),colourSegments:128},{fromTime:window.from,toTime:window.to,outRGB:expected});vec(taps(a,i),Array.from(expected));assert.ok(p.emberBody.birth<=now);checked++;}
  assert.equal(checked,1920);return{fixedReleaseEmbers:checked,scope:'LUT sampler wiring; pure exposure helper owns independent integration oracle'};
});
check('CPU transmission and rejected/stale GPU fallback multiply candidate view RGB by T exactly once',()=>{
  const output=[];for(const reflection of [false,true]){const {f,launch}=make({effectProfile:'three-heart-v1'});advance(f,launch.burstTime+.7);const clear=capture(f,{reflection,shutter:1/120});for(const fail of [null,'throw','stale']){const m=medium(),field=fail?mockBatch({fail:fail==='throw',stale:fail==='stale'}):null,a=capture(f,{reflection,m,batch:field,shutter:1/120});assert.equal(a.count,clear.count);assert.equal(a.diagnostics.sourceTransmission.backend,'cpu');assert.equal(a.diagnostics.mediumQueries,a.count);
      for(let i=0;i<a.count;i++){if(!a.rows[i].vectorEmission)continue;vec(Array.from(a.attributes.aColour.slice(i*3,i*3+3)),[.2,.4,.6]);vec(taps(a,i),taps(clear,i),1e-12);}output.push({reflection,failure:fail,queries:a.diagnostics.mediumQueries});}}return output;
});
check('Effective mock GPU preserves white candidate colour and ordered bindings with zero CPU column queries',()=>{
  const {f,launch}=make({effectProfile:'two-colour-v1'});advance(f,launch.burstTime+.8);const m=medium(),field=mockBatch(),a=capture(f,{m,batch:field});assert.equal(a.diagnostics.mediumQueries,0);assert.equal(m.calls.length,0);assert.equal(a.diagnostics.sourceTransmission.backend,'gpu');assert.equal(a.uniforms.uSourceTransmissionEnabled.value,1);const data=a.uniforms.uSourceTransmission.value.image.data;
  for(let i=0;i<a.count;i++){if(!a.rows[i].vectorEmission)continue;vec(Array.from(a.attributes.aColour.slice(i*3,i*3+3)),[1,1,1]);vec(Array.from(data.slice(i*4,i*4+3)),[.2,.4,.6]);vec(Array.from(field.requests[0].endpoints64.slice(i*3,i*3+3)),a.rows[i].position,1e-12);}return{instances:a.count,scope:'CPU actual factory/mock-provider wiring; no real VTF execution'};
});
for(const f of owned)f.dispose();for(const t of textures)t.dispose();
const report={schema:'glass-atoll.r18-vector-records-check.v1',started,completed:new Date().toISOString(),passed:checks.every(c=>c.passed),counts:{passed:checks.filter(c=>c.passed).length,total:checks.length},sourceSHA256:hash(source),baselineSHA256:hash(baseline),oldPhysicsSHA256:hash(oldPhysics),checks,limits:['Actual Three constructors and instrumented source getters with a no-context renderer stub only.','No GL compilation, native VTF/fragment pixels, SH1 bake, cloud/GI image, GPU timing or visual acceptance.','Source may be mid-integration until root declares freeze; each run records exact source hash.']},encoded=JSON.stringify(report,null,2)+'\n',runs=new URL('./r18-vector-records-runs/',import.meta.url);fs.mkdirSync(runs,{recursive:true});fs.writeFileSync(new URL(started.replace(/[:.]/g,'-')+'.json',runs),encoded);fs.writeFileSync(new URL('./r18-vector-records-check.json',import.meta.url),encoded);console.log(encoded);if(!report.passed)process.exitCode=1;
