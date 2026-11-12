import {strict as assert} from 'node:assert';
import {readFileSync,writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import * as THREE from '../../vendor/three.module.js';
import * as current from '../../fireworks.js';
import {normalizeFireworksMediumSource} from './medium-compat-normalize.mjs';
// The frozen projection implementation receives the same current body factory.
// Comparing different height/pattern scenes would not isolate this algorithm.
const oldText=readFileSync(new URL('../baselines/fireworks-before-scalar-bound/fireworks.js',import.meta.url),'utf8');
const old=await import('data:text/javascript;base64,'+Buffer.from(oldText.replace("from './fireworks-physics.js'",'from '+JSON.stringify(new URL('../../fireworks-physics.js',import.meta.url).href))).toString('base64'));
const tests=[],metrics={sources:0,maximumAbsoluteError:0,maximumRelativeError:0,maximumPeakUnderRelative:0,visibilityChanges:0,nearFallbackChanges:0};
function test(name,fn){try{tests.push({name,passed:true,detail:fn()});}catch(error){tests.push({name,passed:false,error:String(error.stack)});}}
function numeric(actual,expected,label){
  if(Object.is(actual,expected))return;
  const error=Math.abs(actual-expected),scale=Math.max(Math.abs(expected),1e-300),relative=error/scale;
  metrics.maximumAbsoluteError=Math.max(metrics.maximumAbsoluteError,error);metrics.maximumRelativeError=Math.max(metrics.maximumRelativeError,relative);
  assert(error<=Math.max(Number.MIN_VALUE*16,Math.abs(expected)*2e-13),JSON.stringify({label,actual,expected,error,relative}));
}
function compare(a,b){
  assert.deepEqual(Object.keys(a).sort(),Object.keys(b).sort());
  for(const key of Object.keys(b)){
    if(Array.isArray(b[key])){assert.equal(a[key].length,b[key].length);a[key].forEach((v,i)=>numeric(v,b[key][i],key+i));}
    else if(typeof b[key]==='number')numeric(a[key],b[key],key);else assert.equal(a[key],b[key],key);
  }
  if(a.peak<b.peak)metrics.maximumPeakUnderRelative=Math.max(metrics.maximumPeakUnderRelative,(b.peak-a.peak)/b.peak);
  if(a.visible!==b.visible)metrics.visibilityChanges++;if(a.nearPlaneFallback!==b.nearPlaneFallback)metrics.nearFallbackChanges++;
  metrics.sources++;
}
let seed=94271;const rng=()=>((seed=Math.imul(seed,1664525)+1013904223>>>0)/4294967296),range=(a,b)=>a+(b-a)*rng();
const source=(patch={})=>({position:[0,0,-.15],velocity:[0,0,0],stretch:[0,0,0],colour:[.48469855,0,12.42317296],radius:.003,intensity:10,unmodulatedIntensity:10,...patch});
test('12000 random camera/source cases preserve peak and every public field',()=>{
  for(let ci=0;ci<12;ci++){
    const camera=new THREE.PerspectiveCamera(range(18,150),range(.5,2.5),range(.02,.5),30000);camera.position.set(range(-100,100),range(-30,120),range(-200,100));camera.lookAt(range(-20,20),range(0,150),range(-60,60));camera.updateMatrixWorld();
    if(ci%3===1)camera.setViewOffset(2000,1200,100,50,1500,900);
    if(ci%3===2){const p=camera.projectionMatrix.elements;p[2]+=.013;p[6]-=.007;p[10]+=.012;p[14]-=.01;camera.projectionMatrixInverse.copy(camera.projectionMatrix).invert();}
    for(let i=0;i<1000;i++){
      const local=new THREE.Vector3(range(-250,250),range(-200,200),-(10**range(-2.3,3.2)));local.applyMatrix4(camera.matrixWorld);
      const p=source({position:local.toArray(),velocity:[range(-80,80),range(-100,100),range(-80,80)],stretch:i%3?[range(-2,2),range(-2,2),range(-2,2)]:[0,0,0],radius:10**range(-4,-.5),colour:[range(0,4),range(0,3),range(0,16)],unmodulatedIntensity:range(.001,80)});
      const optics={width:[390,1209,1440,3840][i%4],height:[844,1292,900,2160][i%4],dof:i%2===0,focalMm:range(24,70),aperture:range(1.4,16),focusMetres:10**range(-1.5,3),sensorHeightMm:range(18,36),shutterSeconds:[0,1/120,1/30,.2][i%4]};
      compare(current.getFireworkSourceBound(p,camera,optics),old.getFireworkSourceBound(p,camera,optics));
    }
  }
});
test('exact cull/near-plane boundaries and independent shutter/stretch endpoints',()=>{
  const camera=new THREE.PerspectiveCamera(140,4/3,.1,10000);camera.updateMatrixWorld();
  for(const depth of [.009999999999,.01,.010000000001,.099999999999,.1,.100000000001,.15,2])for(const stretch of [[0,0,0],[.12,0,.18],[0,.2,-.3]])for(const shutter of [0,1/120,.2]){
    const p=source({position:[.08,.015,-depth],velocity:[-3,1,6],stretch}),optics={width:384,height:288,shutterSeconds:shutter};compare(current.getFireworkSourceBound(p,camera,optics),old.getFireworkSourceBound(p,camera,optics));
  }
});
test('Float32 vector map endpoint rounding retained',()=>{
  const camera=new THREE.PerspectiveCamera(65,1.2,.1,2000);camera.position.set(3,7,13);camera.lookAt(0,0,0);camera.updateMatrixWorld();
  for(let i=0;i<400;i++){const p=source({position:new Float32Array([range(-3,3),range(0,8),range(-30,5)]),velocity:[11.345,-13.333,4.127],stretch:[.12345,.23456,.45678]});compare(current.getFireworkSourceBound(p,camera,{shutterSeconds:.03}),old.getFireworkSourceBound(p,camera,{shutterSeconds:.03}));}
});
test('blue overlapping source peak sum is unchanged',()=>{
  const camera=new THREE.PerspectiveCamera(140,4/3,.1,10000);camera.updateMatrixWorld();const sources=[source({position:[.45,0,-.15]}),source({position:[.451,0,-.15]}),source({position:[.45,.001,-.15]})];
  const a=sources.map(p=>current.getFireworkSourceBound(p,camera,{width:384,height:288})),b=sources.map(p=>old.getFireworkSourceBound(p,camera,{width:384,height:288}));a.forEach((v,i)=>compare(v,b[i]));numeric(a.reduce((sum,v)=>sum+v.peak,0),b.reduce((sum,v)=>sum+v.peak,0),'overlap sum');
});
test('public outputs retain independent arrays across subsequent calls',()=>{
  const camera=new THREE.PerspectiveCamera();camera.updateMatrixWorld();const a=current.getFireworkSourceBound(source(),camera),snapshot=structuredClone(a),b=current.getFireworkSourceBound(source({position:[.1,.2,-.4]}),camera);
  assert.deepEqual(a,snapshot);assert.notEqual(a.rect,b.rect);assert.notEqual(a.shutterPixels,b.shutterPixels);assert.notEqual(a.stretchPixels,b.stretchPixels);
});
test('factory aggregator and mutable camera/optics contexts match old full records',()=>{
  const a=current.createFireworks(THREE,{terrainHeight:()=>1,seed:14271}),b=old.createFireworks(THREE,{terrainHeight:()=>1,seed:14271});
  try{
    for(const x of [a,b]){x.update({time:0,windVector:[1.8,0,.5]});x.launch({type:'chrysanthemum'});x.launch({type:'chrysanthemum'});for(let i=1;i<=12;i++)x.update({time:i*.5,windVector:[1.8+i*.1,0,.5]});}
    const cameras=[new THREE.PerspectiveCamera(48,1209/1292,.1,30000),new THREE.PerspectiveCamera(140,4/3,.1,30000)];
    for(let i=0;i<16;i++){
      const camera=cameras[i%2];camera.position.set(-30+i,18-i*3,-140);camera.lookAt(40,120,0);camera.fov=40+i*3;camera.updateProjectionMatrix();camera.updateMatrixWorld();
      const optics={width:1209+i,height:1292-i,dof:i%3===0,shutterSeconds:i%2?0:1/120,focalMm:28,focusMetres:40,aperture:1.4};compare(a.getRadianceBound({camera,optics}),b.getRadianceBound({camera,optics}));
    }
  }finally{a.dispose();b.dispose();}
});
test('shader/upload/raw Gaussian projection unchanged; authorized depth-bin rejection verified independently',()=>{
  const a=readFileSync(new URL('../../fireworks.js',import.meta.url),'utf8'),b=readFileSync(new URL('../baselines/fireworks-before-scalar-bound/fireworks.js',import.meta.url),'utf8');
  const mediumDefault=normalizeFireworksMediumSource(a);
  for(const [start,end]of [['const vertex=','let records='],['function fillRecords(','const api=']])assert.equal(mediumDefault.slice(mediumDefault.indexOf(start),mediumDefault.indexOf(end,mediumDefault.indexOf(start))),b.slice(b.indexOf(start),b.indexOf(end,b.indexOf(start))),start);
  // The later authorized optimization changes only getBounds and its private
  // WeakMap. Preserve the old failed scope report, then guard every other byte
  // against the frozen scalar implementation (including projection/budget).
  const scalar=readFileSync(new URL('../baselines/fireworks-before-past-bounds/fireworks.js',import.meta.url),'utf8');
  const strip=s=>s.replaceAll('\r','').replace('  const boundsPastSamples=new WeakMap();let boundsSampleGeneration=0;\n','').replace(/    getBounds\(\)\{[\s\S]*?\n    getLightClusters,/, '    getLightClusters,').replace('mu=-delta.reduce','mu=delta.reduce');
  assert.equal(strip(mediumDefault),strip(scalar),'all runtime except authorized getBounds/cache, HG direction sign and exact optional-medium extension');
  const past=JSON.parse(readFileSync(new URL('past-bounds-check.json',import.meta.url),'utf8'));
  assert.equal(past.passed,true);assert.equal(past.passedCount,16);assert.equal(past.total,16);assert.equal(past.sourceSHA256,createHash('sha256').update(a).digest('hex'),'past bounds report matches this exact source');
  const phase=JSON.parse(readFileSync(new URL('../pyro-smoke-phase-check.json',import.meta.url),'utf8'));
  assert.equal(phase.passed,true);assert.equal(phase.passedCount,10);assert.equal(phase.sourceSHA256,createHash('sha256').update(a).digest('hex'));
  const clip=JSON.parse(readFileSync(new URL('homogeneous-clip-check.json',import.meta.url),'utf8'));assert.equal(clip.passed,true);assert.equal(clip.passedCount,11);assert.equal(clip.sourceSHA256,createHash('sha256').update(a).digest('hex'));
  return{unchanged:'render shader, default fillRecords and public raw Gaussian scalar projection',authorizedChanges:['getBounds plus private WeakMap','smoke HG propagation sign with independent10/10 physical oracle','exact optional-medium/read-only-trace edits normalized individually','three exact homogeneous-depth bin-rejection edits normalized; independent11/11 plus retained actual GPU8/8 witness'],samePhysicsInput:'current fireworks-physics.js for both factories',pastBoundsReport:'past-bounds-check.json',pastBoundsPassed:'16/16',clipReport:'homogeneous-clip-check.json',preservedObsoleteFailure:'scalar-bound-pre-past-scope-failure.json'};
});
const report={date:new Date().toISOString(),passed:tests.every(t=>t.passed),passedCount:tests.filter(t=>t.passed).length,total:tests.length,metrics,tests,limits:['CPU exact old/new projection/budget comparisons, not GPU peak verification or scene FPS','No reduction of sources, endpoints, frequency, binning or margins. GPU7-case bound fixture must be rerun by root.']};
writeFileSync(new URL('scalar-bound-check.json',import.meta.url),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report,null,2));if(!report.passed)process.exitCode=1;
