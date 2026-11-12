import assert from 'node:assert/strict';import fs from 'node:fs';import crypto from 'node:crypto';
import * as THREE from '../vendor/three.module.js';
const source=fs.readFileSync(new URL('../fireworks.js',import.meta.url),'utf8'),baseline=fs.readFileSync(new URL('./baselines/r16-fireworks-before-gpu-transmission/fireworks.js',import.meta.url),'utf8');
const checks=[],owned=[],textures=[];const check=(name,fn)=>{try{checks.push({name,passed:true,evidence:fn()??null});}catch(e){checks.push({name,passed:false,error:String(e.stack)});}};
const hash=v=>crypto.createHash('sha256').update(v).digest('hex');
async function factory(s){const text=s.replace("from './fireworks-physics.js'",`from '${new URL('../fireworks-physics.js',import.meta.url).href}'`).replace('api.configure({});return api;',"api.configure({});api.__qaSetRecords=rows=>{records=rows;clusterCache=null;boundCache=null;};return api;");return(await import('data:text/javascript;base64,'+Buffer.from(text).toString('base64'))).createFireworks;}
const create=await factory(source),oldCreate=await factory(baseline);
const records=Array.from({length:15},(_,i)=>({eventId:'fixture',kind:i===14?'smoke':'star',position:[(i-7)*.9+1e-11,20+i*.6+1e-10,-75-i*.7-1e-11],velocity:[.1,.2,.3],stretch:i%2?[.1,.01,.2]:[0,0,0],colour:[.2+i*.05,.5,.8],radius:i===14?1:.003,intensity:i===14?0:2,opticalDepth:i===14?.1:0,sourceAge:.2}));
const make=(f=create)=>{const api=f(THREE,{sourceVisibility:'conservative'});api.__qaSetRecords(records);owned.push(api);return api;};
const camera=reflection=>{const c=new THREE.PerspectiveCamera(50,1.5,.1,30000);c.position.set(-0,reflection?-3:3,7);c.lookAt(0,26,-80);c.updateMatrixWorld();return c;};
const renderer=()=>({autoClear:true,shadowMap:{autoUpdate:true,needsUpdate:false},target:null,getRenderTarget(){return this.target;},getActiveCubeFace(){return 0;},getActiveMipmapLevel(){return 0;},setRenderTarget(t){this.target=t;},render(){}});
const clipOrigin=(eye,p,reflection,planeY)=>{if(!reflection)return eye.slice();const dy=p[1]-eye[1],t=(planeY-eye[1])/dy;return Number.isFinite(t)&&t>=0&&t<=1?eye.map((v,c)=>v+(p[c]-v)*t):null;};
const transmission=(o,p)=>o?[Math.exp(-Math.abs(p[0]-o[0])*.001),Math.exp(-Math.abs(p[1]-o[1])*.002),Math.exp(-Math.abs(p[2]-o[2])*.003)]:[1,1,1];
function medium(){const calls=[],snapshot={revision:7,packets:[{id:'fixture'}]};return{calls,snapshot:()=>snapshot,writeTransmission(eye,p,out,options){calls.push({eye:eye.slice(),endpoint:p.slice(),...options});const T=transmission(clipOrigin(eye,p,options.reflection,options.planeY),p);out.set(T);return out;}};}
function capture(f,{reflection=false,batch=null,medium:m=medium(),target={width:1200,height:800}}={}){f.render({renderer:renderer(),target,camera:camera(reflection),reflection,planeY:.125,medium:m,legacySmoke:true,transmissionBatch:batch,optics:{dof:true,shutterSeconds:1/120}});const mesh=f.effectsScene.children[0],g=mesh.geometry,n=g.instanceCount;return{count:n,attributes:Object.fromEntries(Object.entries(g.attributes).filter(([k])=>k!=='position').map(([k,a])=>[k,a.array.slice(0,n*a.itemSize)])),uniforms:mesh.material.uniforms,diagnostics:f.diagnostics().lastRender,calls:m.calls,target};}
function batch({change,fail=false,feedback=false}={}){const requests=[],responses=[];return{requests,responses,assertReadableFrom(){if(feedback)throw new Error('feedback forbidden');},prepare(payload){if(fail)throw new Error('fixture prepare failed');const {count,endpoints64,origins64,active,eye,sourceVersion,snapshot}=payload;requests.push({count,endpoints64:endpoints64.slice(0,count*3),origins64:origins64.slice(0,count*3),active:active.slice(0,count),eye:eye.slice(),sourceVersion,snapshot});const width=8,height=Math.max(1,Math.ceil(count/width)),data=new Float32Array(width*height*4);data.fill(1);for(let i=0;i<count;i++){const T=active[i]&&snapshot.packets.length?transmission(Array.from(origins64.slice(i*3,i*3+3)),Array.from(endpoints64.slice(i*3,i*3+3))):[1,1,1];data.set(T,i*4);}const texture=new THREE.DataTexture(data,width,height,THREE.RGBAFormat,THREE.FloatType);textures.push(texture);const result={effective:true,texture,width,height,count,densityRevision:snapshot.revision,sourceVersion,cameraKey:eye.map(v=>Object.is(v,-0)?'-0':String(v)).join(','),reason:'fixture-ready'};if(change)change(result,payload);responses.push(result);return result;}};}
check('baseline remains59b; no physical source, ledger or fragment shader changes',()=>{
  assert.equal(hash(baseline),'59b16a127228ede30ef7b2b839725ef05b2c1f850ae0cc147680bad32979ca1f');
  const block=(s,a,b)=>s.slice(s.indexOf(a),s.indexOf(b,s.indexOf(a)));
  assert.equal(block(source,'// The actual quad expands only clip.xy','export function createFireworks('),block(baseline,'// The actual quad expands only clip.xy','export function createFireworks('));
  assert.equal(block(source,'const fragment=','function material('),block(baseline,'const fragment=','function material('));
  assert.equal(block(source,'function getLightClusters()','function smokeLighting('),block(baseline,'function getLightClusters()','function smokeLighting('));
  assert.equal(hash(fs.readFileSync(new URL('../fireworks-audio.js',import.meta.url))),'4e5ede41813249f062e50b212553e5e1821c27feaead8416b68ab51ba1b8ec31');
});
check('defaultCPU retained attributes and query order are byteexact vs59b, inmainandmirror',()=>{
  for(const reflection of [false,true]){const a=capture(make(),{reflection}),b=capture(make(oldCreate),{reflection});assert.deepEqual(a.attributes,b.attributes);assert.deepEqual(a.calls,b.calls);assert.equal(a.uniforms.uSourceTransmissionEnabled.value,0);assert.equal(a.diagnostics.sourceTransmission.backend,'cpu');assert.equal(a.diagnostics.mediumQueries,b.calls.length);}return{views:2};
});
check('effectiveGPU keeps unattenuatedcolour and skips every CPU query; other instance bytes retained',()=>{
  const field=batch(),f=make(),a=capture(f,{batch:field}),old=capture(make(oldCreate));assert.equal(a.calls.length,0);assert.equal(a.diagnostics.mediumQueries,0);assert.equal(a.diagnostics.sourceTransmission.backend,'gpu');assert.equal(a.uniforms.uSourceTransmissionEnabled.value,1);assert.equal(a.uniforms.uSourceTransmission.value,field.responses[0].texture);
  for(const k of Object.keys(a.attributes))if(k!=='aColour')assert.deepEqual(a.attributes[k],old.attributes[k]);
  let maximumFloat32Difference=0;const T=field.responses[0].texture.image.data;
  for(let i=0;i<a.count;i++)for(let c=0;c<3;c++){const value=Math.fround(a.attributes.aColour[i*3+c]*(records.find(r=>r.position.map(Math.fround).every((v,j)=>v===a.attributes.aCentre[i*3+j])).kind==='smoke'?1:T[i*4+c]));maximumFloat32Difference=Math.max(maximumFloat32Difference,Math.abs(value-old.attributes.aColour[i*3+c]));}
  assert.ok(maximumFloat32Difference<1.2e-7);return{instances:a.count,maximumFloat32Difference,limits:'CPU mimicsFloat32 texturecolour multiplication only; actualVTFGPU acceptance remains parent-owned.'};
});
check('GPU payload preserves original double world endpoints and exact CPU waterhit origins, with orderedmask',()=>{
  const field=batch(),f=make();let priorVersion=0;const rows=[];
  for(const reflection of [false,true]){const m=medium(),a=capture(f,{reflection,batch:field,medium:m}),reference=capture(make(oldCreate),{reflection}),request=field.requests.at(-1);assert.ok(request.sourceVersion>priorVersion);priorVersion=request.sourceVersion;assert.equal(request.active.filter(v=>v===1).length,reference.calls.length);
    let j=0;for(let i=0;i<request.count;i++){const end=Array.from(request.endpoints64.slice(i*3,i*3+3));assert.ok(records.some(p=>p.position.every((v,c)=>Object.is(v,end[c]))));if(!request.active[i])continue;const call=reference.calls[j++];assert.deepEqual(end,call.endpoint);assert.deepEqual(Array.from(request.origins64.slice(i*3,i*3+3)),clipOrigin(call.eye,call.endpoint,reflection,.125));}
    rows.push({reflection,requestVersion:request.sourceVersion,cameraKey:a.diagnostics.sourceTransmission.cameraKey,active:request.active.filter(v=>v===1).length});
  }return rows;
});
check('unsupported/stale/invalid/error/feedback output clearsT and uses exact originalCPU fallback',()=>{
  const scenarios=[{name:'unsupported',change:r=>{r.effective=false;r.texture=null;r.reason='capacity';}},{name:'stale-source',change:r=>r.sourceVersion--},{name:'stale-density',change:r=>r.densityRevision--},{name:'stale-camera',change:r=>r.cameraKey='old-camera'},{name:'bad-count',change:r=>r.count--},{name:'bad-size',change:r=>r.width=0},{name:'bad-texture',change:r=>r.texture=null},{name:'throw',fail:true},{name:'feedback',feedback:true}];
  for(const scenario of scenarios){const f=make(),good=batch();capture(f,{batch:good});for(const reflection of [false,true]){const field=batch(scenario),a=capture(f,{reflection,batch:field}),b=capture(make(oldCreate),{reflection});assert.deepEqual(a.attributes,b.attributes,scenario.name);assert.deepEqual(a.calls,b.calls);assert.equal(a.uniforms.uSourceTransmissionEnabled.value,0);assert.notEqual(a.uniforms.uSourceTransmission.value,good.responses[0].texture);assert.equal(a.diagnostics.sourceTransmission.backend,'cpu');}}
  return{scenarios:scenarios.map(s=>s.name),views:2};
});
check('GPUtoCPU/no-medium transitions never retain an old enabled sampler',()=>{
  const f=make(),field=batch();capture(f,{batch:field});const cpu=capture(f);assert.equal(cpu.uniforms.uSourceTransmissionEnabled.value,0);assert.equal(cpu.diagnostics.sourceTransmission.backend,'cpu');
  f.render({renderer:renderer(),target:{width:1200,height:800},camera:camera(false),legacySmoke:false,transmissionBatch:field,medium:null});const mesh=f.effectsScene.children[0];assert.equal(mesh.material.uniforms.uSourceTransmissionEnabled.value,0);assert.equal(f.diagnostics().lastRender.sourceTransmission.backend,'none');
});
check('dense-to-empty smoke binds current validwhite rows, never the previous attenuating field',()=>{
  const f=make(),field=batch();capture(f,{batch:field});const prior=field.responses.at(-1).texture;
  const m=medium();m.snapshot=()=>({revision:8,packets:[]});const a=capture(f,{reflection:true,batch:field,medium:m}),texture=field.responses.at(-1).texture;
  assert.equal(a.calls.length,0);assert.equal(a.uniforms.uSourceTransmissionEnabled.value,1);assert.notEqual(texture,prior);assert.equal(a.uniforms.uSourceTransmission.value,texture);assert.ok(texture.image.data.every(v=>v===1));assert.equal(a.diagnostics.sourceTransmission.densityRevision,8);
});
check('GPUbatch emptyactive sources do not prepare an unsafe stale field',()=>{
  const f=make();f.__qaSetRecords(records.filter(r=>r.kind==='smoke'));const field=batch(),a=capture(f,{batch:field});assert.equal(field.requests.length,0);assert.equal(a.uniforms.uSourceTransmissionEnabled.value,0);assert.equal(a.diagnostics.sourceTransmission.reason,'no-active-source-rays');assert.equal(a.calls.length,0);
});
check('FW itself blocks framebufferfeedback without a provider guard and VTFsampler is explicit highp',()=>{
  assert.ok(source.includes('uniform highp sampler2D uSourceTransmission;'));
  for(const attachment of ['texture','depthTexture','textures']){
    const texture=new THREE.DataTexture(new Float32Array(8*2*4).fill(1),8,2,THREE.RGBAFormat,THREE.FloatType);textures.push(texture);const target={width:1200,height:800,[attachment]:attachment==='textures'?[texture]:texture};
    const provider=batch({change:r=>r.texture=texture});delete provider.assertReadableFrom;
    const a=capture(make(),{batch:provider,target}),b=capture(make(oldCreate),{target});assert.equal(a.uniforms.uSourceTransmissionEnabled.value,0);assert.deepEqual(a.attributes,b.attributes);assert.equal(a.diagnostics.sourceTransmission.backend,'cpu');assert.ok(a.diagnostics.sourceTransmission.reason.includes('attached'));
  }
});
for(const f of owned)f.dispose();for(const t of textures)t.dispose();
const report={schema:'glass-atoll.r16-firework-transmission-batch.v1',dateUTC:new Date().toISOString(),passed:checks.every(c=>c.passed),passedCount:checks.filter(c=>c.passed).length,total:checks.length,sourceSHA256:hash(source),baselineSHA256:hash(baseline),checks,limits:['CPU actualThree factory/mockbatch wiring only; noGL orGPUerror/precision/performance acceptance.','Opt-inGPU only; production defaultCPU, preserved59b fallback geometry/queryvalues.','GPUfield itself has separate numerical and native framebuffer/VTF admission gates.']};
if(!report.passed&&!fs.existsSync(new URL('./r16-firework-transmission-batch-first-failure.json',import.meta.url)))fs.writeFileSync(new URL('./r16-firework-transmission-batch-first-failure.json',import.meta.url),JSON.stringify(report,null,2)+'\n');
fs.writeFileSync(new URL('./r16-firework-transmission-batch-check.json',import.meta.url),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report,null,2));if(!report.passed)process.exitCode=1;
