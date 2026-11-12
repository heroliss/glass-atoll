// Actual source factory, in-memory candidate injection, mock renderer only.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import crypto from 'node:crypto';
import * as THREE from '../vendor/three.module.js';
const root=new URL('../',import.meta.url),read=p=>fs.readFileSync(new URL(p,root),'utf8'),uri=s=>'data:text/javascript;base64,'+Buffer.from(s).toString('base64'),hash=s=>crypto.createHash('sha256').update(s).digest('hex');
const fwSource=read('fireworks.js'),physicsSource=read('fireworks-physics.js'),layerSource=read('firework-layer-profile.js'),scratch=read('verification/r19-optical-sampling-microbench.mjs');
const resolve=(s,overrides={})=>s.replace(/from (['"])(\.\/[^'"]+)\1/g,(_,q,p)=>`from '${overrides[p]??new URL(p,root).href}'`);
const functionText=scratch.slice(scratch.indexOf('function sharedOverlapWindow('),scratch.indexOf('\nconst events='))
  .replace('function sharedOverlapWindow(','export function sampleProfileBodyEmissionWindow(').replaceAll('verified.has','verifiedWindowProfiles.has').replaceAll('verified.add','verifiedWindowProfiles.add')
  .replace('return sampleProfileBodyEmissionWindow(body,{fromAge,toAge,bins,outRGB});','return baselineWindow(body,{fromAge,toAge,bins,outRGB});');
assert(functionText.includes('let r=0,g=0,bv=0'));
const candidateLayer=resolve(layerSource.replace('export function sampleProfileBodyEmissionWindow(','function baselineWindow('))+'\n'+functionText;
const candidatePhysics=resolve(physicsSource,{'./firework-layer-profile.js':uri(candidateLayer)});
async function factory(candidate){const text=resolve(fwSource, candidate?{'./fireworks-physics.js':uri(candidatePhysics)}:{}).replace('const effectsScene=new THREE.Scene();','let __ordered=[];const effectsScene=new THREE.Scene();').replace('geometry.instanceCount=ordered.length;','__ordered=ordered.map(row=>row.p);geometry.instanceCount=ordered.length;').replace('api.configure({});return api;','api.configure({});api.__qa={records:()=>records,ordered:()=>__ordered};return api;');return(await import(uri(text))).createFireworks;}
const [makeBaseline,makeCandidate]=await Promise.all([factory(false),factory(true)]),checks=[],owned=[];
const check=(name,fn)=>{try{checks.push({name,passed:true,evidence:fn()});}catch(e){checks.push({name,passed:false,error:String(e.stack)});}};
function make(candidate,effectProfile,N){const f=(candidate?makeCandidate:makeBaseline)(THREE,{sourceVisibility:'none',clusterModel:'moments'});owned.push(f);f.setQuality({trailSegments:N});f.configure({type:'chrysanthemum',effectProfile,autoDirection:false,azimuth:104,elevation:80,launchSpreadDegrees:0,burstTiltDegrees:0,burstRollDegrees:0});return{f,launch:f.launch({seed:42})};}
const camera=reflection=>{const c=new THREE.PerspectiveCamera(55,1.5,.1,30000);c.position.set(180,reflection?-90:90,500);c.lookAt(60,150,0);c.updateMatrixWorld();return c;},renderer=()=>({autoClear:true,shadowMap:{autoUpdate:true,needsUpdate:false},target:null,getRenderTarget(){return this.target;},getActiveCubeFace:()=>0,getActiveMipmapLevel:()=>0,setRenderTarget(t){this.target=t;},render(){}});
function capture(f,S,reflection){const c=camera(reflection),optics={width:1200,height:800,shutterSeconds:S};f.render({renderer:renderer(),target:{width:1200,height:800},camera:c,reflection,legacySmoke:false,optics,frame:{rawPerCandela:3.6e-5}});const g=f.effectsScene.children[0].geometry;return{count:g.instanceCount,arrays:Object.fromEntries(Object.entries(g.attributes).map(([k,a])=>[k,a.array.slice(0,k==='position'?a.array.length:g.instanceCount*a.itemSize)])),ordered:f.__qa.ordered(),bound:f.getRadianceBound({camera:c,optics})};}
for(const effectProfile of ['three-heart-v1','two-colour-v1','legacy'])for(const N of [6,10,16])check(`${effectProfile} N${N} evolving records, ledger, clusters and main/mirror optical buffers/bounds exact`,()=>{
  const A=make(false,effectProfile,N),B=make(true,effectProfile,N);assert.deepEqual(A.launch,B.launch);let rowCount=0,views=0;
  for(const [i,phase] of [.03,.7,1.5,2.8,4.8,5.5].entries()){
    const time=A.launch.burstTime+phase,windVector=i%2?[2.4,0,-.1]:[1.8,0,.7];for(const x of [A,B])x.f.update({time,windVector});
    assert.deepEqual(B.f.__qa.records(),A.f.__qa.records());assert.deepEqual(B.f.getEmissionLedger(),A.f.getEmissionLedger());assert.deepEqual(B.f.getLightClusters(),A.f.getLightClusters());rowCount+=A.f.__qa.records().length;
    for(const S of [0,1/120,.5,1])for(const reflection of [false,true]){assert.deepEqual(capture(B.f,S,reflection),capture(A.f,S,reflection));views++;}
  }
  return{phases:6,views,rows:rowCount};
});
for(const f of owned)f.dispose();
const report={schema:'glass-atoll.r19-optical-sampling-factory-candidate.v1',dateUTC:new Date().toISOString(),passed:checks.every(c=>c.passed),counts:{passed:checks.filter(c=>c.passed).length,total:checks.length},sourceSHA256:{fireworks:hash(fwSource),physics:hash(physicsSource),layer:hash(layerSource),inMemoryCandidateLayer:hash(candidateLayer)},checks,limits:['In-memory import substitution only; production untouched.','Real Three constructors/owned geometry, mock renderer and no GL/GPU/native FPS.','Source identities and smoke budgets preserved; future isolated API emission-only shortcut not implemented.']};fs.writeFileSync(new URL('./r19-optical-sampling-factory-candidate.json',import.meta.url),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report,null,2));if(!report.passed)process.exitCode=1;
