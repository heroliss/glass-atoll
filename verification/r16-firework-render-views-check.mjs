import assert from 'node:assert/strict';import fs from 'node:fs';import crypto from 'node:crypto';
import * as THREE from '../vendor/three.module.js';
const source=fs.readFileSync(new URL('../fireworks.js',import.meta.url),'utf8'),hash=v=>crypto.createHash('sha256').update(v).digest('hex'),checks=[],owned=[],textures=[];
const check=(name,fn)=>{try{checks.push({name,passed:true,evidence:fn()??null});}catch(e){checks.push({name,passed:false,error:String(e.stack)});}};
let recovered=source.replace(/\r\n/g,'\n').replace("  const lastRenderByView={main:null,reflection:null};\n  function recordViewRender(info){lastRender=info;lastRenderByView[info.reflection?'reflection':'main']=info;}\n",'');
recovered=recovered.replace(/      if\(disposed\|\|!records.length\)\{[\s\S]*?\n      \}/,'      if(disposed||!records.length)return;');
recovered=recovered.replace("      const renderInfo={instances:count,reflection,time:simulation.time,rendered:false,skipped:false,storageEV:frame.storageEV??Math.log2(scale),rawPerCandela,width,height,mediumQueries:lastSourceVisibility.mediumQueries,sourceTransmission:lastSourceTransmission,sourceVisibility:lastSourceVisibility};recordViewRender(renderInfo);\n      try{renderer.autoClear=false;renderer.shadowMap.autoUpdate=false;renderer.shadowMap.needsUpdate=false;renderer.setRenderTarget(target);renderer.render(effectsScene,camera);renderInfo.rendered=true;}","      try{renderer.autoClear=false;renderer.shadowMap.autoUpdate=false;renderer.shadowMap.needsUpdate=false;renderer.setRenderTarget(target);renderer.render(effectsScene,camera);lastRender={instances:count,reflection,storageEV:frame.storageEV??Math.log2(scale),rawPerCandela,width,height,mediumQueries:lastSourceVisibility.mediumQueries,sourceTransmission:lastSourceTransmission,sourceVisibility:lastSourceVisibility};}");
recovered=recovered.replace('records:records.length,lastRender,lastRenderByView:{main:lastRenderByView.main,reflection:lastRenderByView.reflection},quality:{...quality}','records:records.length,lastRender,quality:{...quality}');
recovered=recovered.replace(/\n/g,'\r\n');
check('only authorized metadata edits invert byteexactly to frozenb8 source; no shader/optics changes',()=>{
  assert.equal(hash(recovered),'b8f681b24b0353f3e19f568dbd1589f262543e1a856297c957aaf76caf626877');
  const directory=new URL('./baselines/r16-fireworks-before-render-views/',import.meta.url);fs.mkdirSync(directory,{recursive:true});const target=new URL('fireworks.js',directory);if(!fs.existsSync(target))fs.writeFileSync(target,recovered);assert.equal(hash(fs.readFileSync(target)),hash(recovered));
});
const text=source.replace("from './fireworks-physics.js'",`from '${new URL('../fireworks-physics.js',import.meta.url).href}'`).replace('api.configure({});return api;','api.configure({});api.__setRows=rows=>{records=rows;clusterCache=null;boundCache=null;};return api;');
const {createFireworks}=await import('data:text/javascript;base64,'+Buffer.from(text).toString('base64'));
const rows=[{eventId:'fixture',kind:'star',position:[0,30,-100],velocity:[0,0,0],stretch:[0,0,0],colour:[1,.4,.2],radius:.003,intensity:2,sourceAge:.2}];
const make=()=>{const f=createFireworks(THREE);f.__setRows(rows);owned.push(f);return f;};
const camera=(reflection=false,away=false)=>{const c=new THREE.PerspectiveCamera(50,1.5,.1,30000);c.position.set(0,reflection?-3:3,7);c.lookAt(0,30,away?100:-100);c.updateMatrixWorld();return c;};
const renderer=()=>({autoClear:true,shadowMap:{autoUpdate:true,needsUpdate:false},target:null,getRenderTarget(){return this.target;},getActiveCubeFace(){return 0;},getActiveMipmapLevel(){return 0;},setRenderTarget(t){this.target=t;},render(){}});
const medium={snapshot:()=>({revision:7,packets:[{}]}),writeTransmission(){throw new Error('Effective GPU must not query CPU medium');}};
const batch={prepare(p){const t=new THREE.DataTexture(new Float32Array([.8,.9,.7,1]),1,1,THREE.RGBAFormat,THREE.FloatType);textures.push(t);return{effective:true,texture:t,width:1,height:1,count:p.count,densityRevision:p.snapshot.revision,sourceVersion:p.sourceVersion,cameraKey:p.eye.map(v=>Object.is(v,-0)?'-0':String(v)).join(','),reason:'view-fixture-ready'};}};
const draw=(f,reflection=false,away=false)=>f.render({renderer:renderer(),target:{width:1200,height:800},camera:camera(reflection,away),reflection,medium,transmissionBatch:batch,legacySmoke:false});
check('independent main/mirror lastGPU metadata both show0 CPUqueries and retain lastRender compatibility',()=>{
  const f=make();draw(f);const first=f.diagnostics().lastRenderByView.main;draw(f,true);const d=f.diagnostics();assert.equal(d.lastRender,d.lastRenderByView.reflection);assert.equal(d.lastRenderByView.main,first);
  for(const [view,info]of Object.entries(d.lastRenderByView)){assert.equal(info.instances,1);assert.equal(info.mediumQueries,0);assert.equal(info.rendered,true);assert.equal(info.sourceTransmission.backend,'gpu');assert.equal(info.sourceTransmission.reason,'view-fixture-ready');assert.equal(info.reflection,view==='reflection');}
  assert.notEqual(d.lastRenderByView.main.sourceTransmission.sourceVersion,d.lastRenderByView.reflection.sourceTransmission.sourceVersion);return d.lastRenderByView;
});
check('a view culled to0 refreshes that view instead of retaining priorGPU metadata',()=>{
  const f=make();draw(f);draw(f,true);const main=f.diagnostics().lastRenderByView.main;draw(f,true,true);const d=f.diagnostics();assert.equal(d.lastRenderByView.main,main);assert.equal(d.lastRenderByView.reflection.instances,0);assert.equal(d.lastRenderByView.reflection.mediumQueries,0);assert.equal(d.lastRenderByView.reflection.sourceTransmission.reason,'no-active-source-rays');assert.equal(d.lastRenderByView.reflection.sourceTransmission.effective,false);return d.lastRenderByView.reflection;
});
check('empty logical records refresh eachview to bounded explicit skippedmetadata without renderer work',()=>{
  const f=make();draw(f);draw(f,true);f.__setRows([]);f.render({reflection:false,medium,transmissionBatch:batch});let d=f.diagnostics();assert.equal(d.lastRenderByView.main.instances,0);assert.equal(d.lastRenderByView.reflection.instances,1);f.render({reflection:true,medium,transmissionBatch:batch});d=f.diagnostics();assert.equal(d.lastRender,d.lastRenderByView.reflection);
  for(const info of Object.values(d.lastRenderByView)){assert.equal(info.instances,0);assert.equal(info.mediumQueries,0);assert.equal(info.rendered,false);assert.equal(info.skipped,true);assert.equal(info.sourceTransmission.reason,'no-source-records');assert.equal(info.sourceTransmission.backend,'none');}
});
for(const f of owned)f.dispose();for(const t of textures)t.dispose();
const report={schema:'glass-atoll.r16-firework-render-views.v1',dateUTC:new Date().toISOString(),passed:checks.every(c=>c.passed),passedCount:checks.filter(c=>c.passed).length,total:checks.length,sourceSHA256:hash(source),baselineSHA256:hash(recovered),checks,limits:['CPU metadata/mockGPU fixture only; native main/mirror readback/performance belongs to parent.','Only two latest view entries retained; no per-frame/history allocation archive.']};
if(!report.passed&&!fs.existsSync(new URL('./r16-firework-render-views-first-failure.json',import.meta.url)))fs.writeFileSync(new URL('./r16-firework-render-views-first-failure.json',import.meta.url),JSON.stringify(report,null,2)+'\n');
fs.writeFileSync(new URL('./r16-firework-render-views-check.json',import.meta.url),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report,null,2));if(!report.passed)process.exitCode=1;
