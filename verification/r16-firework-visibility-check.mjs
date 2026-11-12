import assert from 'node:assert/strict';
import fs from 'node:fs';import crypto from 'node:crypto';
import * as THREE from '../vendor/three.module.js';
import {classifyFireworkSourceVisibility,createFireworks} from '../fireworks.js';

const currentSource=fs.readFileSync(new URL('../fireworks.js',import.meta.url),'utf8'),oldSource=fs.readFileSync(new URL('./baselines/r16-fireworks-before-visibility/fireworks.js',import.meta.url),'utf8');
const checks=[],owned=[],hash=v=>crypto.createHash('sha256').update(v).digest('hex');
const check=(name,fn)=>{try{checks.push({name,passed:true,evidence:fn()??null});}catch(e){checks.push({name,passed:false,error:String(e.stack)});}};
const physicsURL=new URL('../fireworks-physics.js',import.meta.url).href;
async function factory(source){const text=source.replace("from './fireworks-physics.js'",`from '${physicsURL}'`).replace('api.configure({});return api;',`api.configure({});Object.defineProperty(api,'__qaSetRecords',{value:rows=>{records=rows;clusterCache=null;boundCache=null;}});return api;`);assert.ok(text.includes('__qaSetRecords'));return(await import('data:text/javascript;base64,'+Buffer.from(text).toString('base64'))).createFireworks;}
const currentFactory=await factory(currentSource),oldFactory=await factory(oldSource);
const create=(f=currentFactory,options={})=>{const value=f(THREE,{clusterModel:'moments',...options});owned.push(value);return value;};
const camera=(fov=50,aspect=1.5,near=.1,far=30000)=>{const c=new THREE.PerspectiveCamera(fov,aspect,near,far);c.updateMatrixWorld();return c;};
const record=(position,extra={})=>({eventId:'fixture',kind:'star',position,velocity:[0,0,0],stretch:[0,0,0],colour:[1,.4,.1],radius:.003,intensity:2,sourceAge:.1,...extra});
const defaultOptics={width:1200,height:800,focalMm:28,focusMetres:60,aperture:8,sensorHeightMm:24,dof:false,shutterSeconds:1/120};

// Independent rounded binary32 reconstruction of the unchanged production
// vertex geometry, including shutter endpoints, both trail branches and DOF.
const F=Math.fround,A=(a,b)=>F(F(a)+F(b)),S=(a,b)=>F(F(a)-F(b)),B=(a,b)=>F(F(a)*F(b)),D=(a,b)=>F(F(a)/F(b));
function fp32Quad(p,c,o=defaultOptics){
  const M=Array.from(new Float32Array(new THREE.Matrix4().multiplyMatrices(c.projectionMatrix,c.matrixWorldInverse).elements)),P=Array.from(new Float32Array(c.projectionMatrix.elements));
  const pos=p.position.map(F),vel=(p.velocity||[0,0,0]).map(F),stretch=(p.stretch||[0,0,0]).map(F),width=F(o.width),height=F(o.height),sh=F(o.shutterSeconds??1/120);
  const dot=(v,row)=>A(A(A(B(M[row],v[0]),B(M[row+4],v[1])),B(M[row+8],v[2])),M[row+12]);
  const project=v=>{const w=Math.max(dot(v,3),F(1e-5));return[B(B(D(dot(v,0),w),width),.5),B(B(D(dot(v,1),w),height),.5)];};
  const clip=[dot(pos,0),dot(pos,1),dot(pos,2),dot(pos,3)],depth=Math.max(clip[3],F(.001));
  if(clip[3]<=F(.01))return{outside:true,reason:'shader-w',clip};
  const focal=F(o.focalMm??28),focus=Math.max(A(focal,1),B(o.focusMetres??60,1000)),s=B(depth,1000),ap=F(o.aperture??8),sensor=F(o.sensorHeightMm??24);
  const pixel=D(B(B(Math.abs(P[5]),height),.5),depth),world=B(B(p.radius,pixel),.70710678);
  const coc=o.dof?B(B(D(Math.abs(D(B(B(focal,focal),S(s,focus)),B(B(ap,Math.max(s,A(focal,1))),S(focus,focal)))),sensor),height),.5):0;
  let sigma=F(Math.sqrt(A(A(.0784,B(world,world)),B(B(coc,coc),.25))));
  const segment=(v,t)=>{const a=project(pos.map((x,i)=>A(x,B(B(v[i],t),.5)))),b=project(pos.map((x,i)=>S(x,B(B(v[i],t),.5))));return a.map((x,i)=>S(x,b[i]));};
  const shutter=segment(vel,sh),trail=A(A(B(stretch[0],stretch[0]),B(stretch[1],stretch[1])),B(stretch[2],stretch[2]))>F(1e-12);
  let motion=shutter,explicit=0;
  if(trail){motion=segment(stretch,1);const norm=F(Math.sqrt(A(B(shutter[0],shutter[0]),B(shutter[1],shutter[1]))));if(norm<=1)sigma=F(Math.sqrt(A(B(sigma,sigma),D(A(B(shutter[0],shutter[0]),B(shutter[1],shutter[1])),24))));else explicit=1;}
  const extent=motion.map((m,i)=>A(A(A(B(3.65,sigma),B(Math.abs(m),.5)),B(B(Math.abs(shutter[i]),.5),explicit)),.65));
  const vertices=[];for(const [x,y]of [[-1,-1],[1,-1],[1,1],[-1,1]])vertices.push([A(clip[0],B(D(B(B(x,extent[0]),2),width),clip[3])),A(clip[1],B(D(B(B(y,extent[1]),2),height),clip[3])),clip[2],clip[3]]);
  const finite=vertices.every(v=>v.every(Number.isFinite));
  const planes=[v=>v[0]<-v[3],v=>v[0]>v[3],v=>v[1]<-v[3],v=>v[1]>v[3],v=>v[2]<-v[3],v=>v[2]>v[3]];
  return{outside:finite&&planes.some(plane=>vertices.every(plane)),finite,clip,extent,vertices};
}
check('baseline is exact prior911 source; shader literals and emission/audio paths unchanged',()=>{
  assert.equal(hash(oldSource),'911fba3ebd274e7a86642431d6296af0f28f2c57fef03ee93cb3cd6ca6b8d957');
  const block=(s,a,b)=>s.slice(s.indexOf(a),s.indexOf(b,s.indexOf(a)));
  assert.equal(block(currentSource,'const vertex=','let records='),block(oldSource,'const vertex=','let records='));
  for(const [a,b]of [['function updateRecords()','function getLightClusters()'],['function getLightClusters()','function smokeLighting(']])assert.equal(block(currentSource,a,b),block(oldSource,a,b));
  assert.equal(hash(fs.readFileSync(new URL('../fireworks-audio.js',import.meta.url))),'4e5ede41813249f062e50b212553e5e1821c27feaead8416b68ab51ba1b8ec31');
});
check('complete depth clipping rejects entire actual quad even if trail reaches across plane',()=>{
  const c=camera();for(const z of [-.02,-40000,1]){const p=record([0,0,z],{stretch:[0,0,400],velocity:[0,0,-6000]});const result=classifyFireworkSourceVisibility(p,c,defaultOptics);assert.equal(result.clipped,true);assert.equal(result.reason,'homogeneous-depth');assert.equal(fp32Quad(p,c).outside,true);}return{depthCases:3};
});
check('side clipping includes PSF, long tail, shutter and lens defocus; not centre-only',()=>{
  const c=camera(),z=-100,side=Math.tan(25*Math.PI/180)*100*1.5;
  const samples=[
    {p:record([side+1,0,z]),outside:true},
    {p:record([side+1,0,z],{stretch:[20,0,0]}),outside:false},
    {p:record([side+1,0,z],{velocity:[500,0,0]}),outside:false},
    {p:record([side+1,0,z],{radius:2}),outside:false},
    {p:record([side+1,0,z]),o:{...defaultOptics,dof:true,focusMetres:.05,aperture:.2,focalMm:100},outside:false},
  ];
  for(const row of samples){const o=row.o||defaultOptics,a=classifyFireworkSourceVisibility(row.p,c,o),b=fp32Quad(row.p,c,o);assert.equal(b.outside,row.outside);if(!b.outside)assert.equal(a.clipped,false);else assert.equal(a.clipped,true);}
  return samples.map(row=>classifyFireworkSourceVisibility(row.p,c,row.o||defaultOptics));
});
check('near-crossing endpoint and uncertain clip plane retain potential coverage',()=>{
  const c=camera();for(const p of [record([2,0,-.2],{stretch:[-5,0,.5]}),record([0,0,-.1]),record([0,0,-.10000001])]){
    const a=classifyFireworkSourceVisibility(p,c,defaultOptics),b=fp32Quad(p,c);if(!b.outside)assert.equal(a.clipped,false);
  }
});
let seed=7223,random=()=>((seed=Math.imul(seed,1664525)+1013904223>>>0)/2**32),span=(a,b)=>a+(b-a)*random();
check('16000 deterministic rounded-FP32 quad witnesses: no visible sprite falsely rejected',()=>{
  let rejected=0,retained=0,visible=0,side=0,depth=0;
  for(let i=0;i<16000;i++){
    const c=camera(span(15,130),span(.5,2.2),span(.01,1),25000);c.position.set(span(-400,400),span(-100,300),span(-400,400));c.lookAt(span(-50,50),span(0,180),span(-50,50));c.updateMatrixWorld();
    if(i%3===0)c.setViewOffset(2000,1500,200,100,1500,1200);
    if(i%7===0){c.projectionMatrix.elements[2]+=.013;c.projectionMatrix.elements[6]-=.007;}
    const local=new THREE.Vector3(span(-1.8,1.8),span(-1.8,1.8),-1).multiplyScalar(10**span(-1.8,4.8)),position=local.applyMatrix4(c.matrixWorld).toArray();
    const p=record(i%2?new Float32Array(position):position,{velocity:[span(-1000,1000),span(-1000,1000),span(-1000,1000)],stretch:i%2?[span(-35,35),span(-35,35),span(-35,35)]:[0,0,0],radius:10**span(-4,0)});
    const o={...defaultOptics,width:Math.round(span(64,2048)),height:Math.round(span(64,1600)),dof:i%3===0,focusMetres:10**span(-.5,2.8),focalMm:span(12,120),aperture:span(.7,16),shutterSeconds:i%5?1/120:1/15};
    const a=classifyFireworkSourceVisibility(p,c,o),b=fp32Quad(p,c,o);
    if(a.clipped){rejected++;side+=Number(a.reason==='complete-quad-outside');depth+=Number(a.reason==='homogeneous-depth');assert.equal(b.outside,true,JSON.stringify({i,p,o,a,b}));}else retained++;
    visible+=Number(b.finite&&!b.outside);
  }assert.ok(side>1000&&depth>1000&&visible>1000);return{samples:16000,rejected,side,depth,retained,visible};
});

function renderer(){return{autoClear:true,shadowMap:{autoUpdate:true,needsUpdate:false},target:null,getRenderTarget(){return this.target;},getActiveCubeFace(){return 0;},getActiveMipmapLevel(){return 0;},setRenderTarget(t){this.target=t;},render(){}};}
function capture(f,c,o=defaultOptics,{reflection=false,legacySmoke=false}={}){
  let queries=0;const medium={writeTransmission(eye,pos,out){queries++;out[0]=.71+Math.sin(pos[0])*.03;out[1]=.73;out[2]=.79;return out;}};
  f.render({renderer:renderer(),target:{width:o.width,height:o.height},camera:c,optics:o,medium,reflection,legacySmoke,frame:{storageEV:0,rawPerCandela:3.6e-5}});
  const g=f.effectsScene.children[0].geometry,count=g.instanceCount;
  return{count,queries,attributes:Object.fromEntries(Object.entries(g.attributes).filter(([name])=>name!=='position').map(([name,a])=>[name,{size:a.itemSize,data:a.array.slice(0,count*a.itemSize)}])),diagnostics:f.diagnostics().lastRender};
}
function compareSubsequence(full,subset){let cursor=0;for(let i=0;i<subset.count;i++){
  const key='aCentre',n=3;while(cursor<full.count&&![0,1,2].every(k=>Object.is(full.attributes[key].data[cursor*n+k],subset.attributes[key].data[i*n+k])))cursor++;
  assert.ok(cursor<full.count,'Candidate row missing from baseline order');
  for(const [name,a]of Object.entries(subset.attributes)){const before=full.attributes[name];assert.deepEqual(a.data.slice(i*a.size,(i+1)*a.size),before.data.slice(cursor*a.size,(cursor+1)*a.size));}cursor++;
}}
const fixtureRows=[];for(let i=0;i<100;i++){const z=-20-i*2;fixtureRows.push(record([Math.sin(i)*z,Math.cos(i)*z,z],{velocity:[i*2,-i,3],stretch:i%2?[1,.2,.4]:[0,0,0],sourceAge:i*.001}));}fixtureRows.push(record([0,0,1]),record([0,0,-.02]),record([0,0,-100],{kind:'smoke',radius:2,intensity:0,opticalDepth:.1}));
check('actual Three factory:none mode preserves cached geometry bytes and query count exactly vs baseline',()=>{
  const a=create(currentFactory,{sourceVisibility:'none'}),b=create(oldFactory);a.__qaSetRecords(fixtureRows);b.__qaSetRecords(fixtureRows);const c=camera();
  for(const reflection of [false,true]){const aa=capture(a,c,defaultOptics,{reflection,legacySmoke:true}),bb=capture(b,c,defaultOptics,{reflection,legacySmoke:true});assert.deepEqual(aa.attributes,bb.attributes);assert.equal(aa.count,bb.count);assert.equal(aa.queries,bb.queries);}return{records:fixtureRows.length};
});
check('actual Three factory:visible-row attributes byte-identical, offscreen medium queries omitted; source ledger unchanged',()=>{
  const a=create(currentFactory),b=create(oldFactory);a.__qaSetRecords(fixtureRows);b.__qaSetRecords(fixtureRows);const c=camera(),rows=[];
  const beforeA=Array.from(a.getEmissionLedger().data.subarray(0,a.getEmissionLedger().count*8)),beforeB=Array.from(b.getEmissionLedger().data.subarray(0,b.getEmissionLedger().count*8));assert.deepEqual(beforeA,beforeB);
  for(const reflection of [false,true]){const aa=capture(a,c,defaultOptics,{reflection,legacySmoke:true}),bb=capture(b,c,defaultOptics,{reflection,legacySmoke:true});compareSubsequence(bb,aa);assert.ok(aa.queries<bb.queries);assert.equal(aa.count,aa.queries+1);rows.push({reflection,before:bb.queries,after:aa.queries,visibility:aa.diagnostics.sourceVisibility});}
  const after=a.getEmissionLedger();assert.deepEqual(Array.from(after.data.subarray(0,after.count*8)),beforeA);assert.deepEqual(a.getLightClusters(),b.getLightClusters());return rows;
});
check('actual four-show source/light/audio ledgers intact across camera masks and runtime mode toggles',()=>{
  const a=create(currentFactory),b=create(oldFactory);const launches=[];
  for(const f of [a,b]){f.setQuality({trailSegments:16});for(let i=0;i<4;i++){const result=f.launch({type:'chrysanthemum',seed:42+i,launchSpreadDegrees:0,burstTiltDegrees:0,burstRollDegrees:0});if(f===a)launches.push(result);}f.update({time:launches[0].burstTime+1.1,windVector:[0,0,0]});}
  assert.deepEqual(a.drainEvents(),b.drainEvents());assert.deepEqual(a.getLightClusters(),b.getLightClusters());
  const la=a.getEmissionLedger(),lb=b.getEmissionLedger();assert.equal(la.count,lb.count);assert.deepEqual(la.data,lb.data);assert.deepEqual(la.groups,lb.groups);
  const rows=[];for(const mode of ['none','depth','conservative'])for(const view of ['show','partial','island','away']){
    a.setSourceVisibility(mode);const c=camera(view==='partial'?30:50,1.5,.1,30000);c.position.set(110,8,150);const centre=la.groups[0].min.map((v,i)=>(v+la.groups[0].max[i])/2);c.lookAt(...(['show','partial'].includes(view)?centre:view==='island'?[0,1,0]:[500,0,1000]));if(view==='partial')c.rotateY(.38);c.updateMatrixWorld();
    const aa=capture(a,c),bb=capture(b,c);compareSubsequence(bb,aa);if(mode==='none')assert.deepEqual(aa.attributes,bb.attributes);
    rows.push({mode,view,records:a.diagnostics().records,sources:la.count,beforeQueries:bb.queries,afterQueries:aa.queries,visibility:aa.diagnostics.sourceVisibility});
  }assert.ok(rows.find(r=>r.mode==='conservative'&&r.view==='island').afterQueries<la.count/4);
  const partial=rows.find(r=>r.mode==='conservative'&&r.view==='partial');assert.ok(partial.afterQueries>0&&partial.afterQueries<la.count,JSON.stringify(partial));
  assert.deepEqual(a.getEmissionLedger().data,lb.data);return rows;
});
check('invalid cull modes fail before mutation and no instance capacity is silently bypassed',()=>{
  const f=create();assert.equal(f.sourceVisibility,'conservative');assert.throws(()=>f.setSourceVisibility('fast'));assert.equal(f.sourceVisibility,'conservative');
  f.__qaSetRecords(Array.from({length:14001},(_,i)=>record([i,0,10])));assert.throws(()=>capture(f,camera()),/capacity/);
});
for(const f of owned)f.dispose();
const report={schema:'glass-atoll.r16-firework-visibility.v1',dateUTC:new Date().toISOString(),passed:checks.every(c=>c.passed),passedCount:checks.filter(c=>c.passed).length,total:checks.length,sourceSHA256:hash(currentSource),baselineSHA256:hash(oldSource),checks,
  limits:['CPU-only exact-Float32 vertex reconstruction and actual Three factory geometry; no GPU raster proof or main-scene FPS acceptance in this child.','Outward interval model assumes binary32 highp operations;8unit-roundoff per elementary operation, gamma7 matrix-dot bound and FTZ padding retain numerical uncertainty.','The side extent deliberately overbounds both shutter branches plus1pixel guard; near endpoint/cancellation/overflow cases retain sources.','Culling changes only per-camera upload and medium-query masks; all physical records and unattenuated luminous ledgers remain complete.']};
const output=new URL('./r16-firework-visibility-check.json',import.meta.url);if(!report.passed&&!fs.existsSync(new URL('./r16-firework-visibility-first-failure.json',import.meta.url)))fs.writeFileSync(new URL('./r16-firework-visibility-first-failure.json',import.meta.url),JSON.stringify(report,null,2)+'\n');
fs.writeFileSync(output,JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report,null,2));if(!report.passed)process.exitCode=1;
