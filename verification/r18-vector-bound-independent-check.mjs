// Independent bounded CPU review. No renderer context, shader execution or GPU.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import crypto from 'node:crypto';
import * as THREE from '../vendor/three.module.js';
import {createBurnProfile,integrateBurnEmission} from '../firework-burn-profile.js';
import {sampleBody,sampleBodyEmission} from '../fireworks-physics.js';
import {getFireworkSourceBound,classifyFireworkSourceVisibility} from '../fireworks.js';
import {resolveFireworkExposure} from '../firework-exposure-window.js';

const source=fs.readFileSync(new URL('../fireworks.js',import.meta.url),'utf8'),hash=s=>crypto.createHash('sha256').update(s).digest('hex');
const resolved=source.replace(/from (['"])(\.\/[^'"]+)\1/g,(_,q,p)=>`from '${new URL('../'+p.slice(2),import.meta.url).href}'`);
assert.equal((resolved.match(/api\.configure\(\{\}\);return api;/g)||[]).length,1);
const instrumented=resolved.replace('const effectsScene=new THREE.Scene();','let __qaOrdered=[];const effectsScene=new THREE.Scene();')
 .replace('geometry.instanceCount=ordered.length;','__qaOrdered=ordered.map(row=>row.p);geometry.instanceCount=ordered.length;')
 .replace('api.configure({});return api;',`api.configure({});api.__qa={ordered:()=>__qaOrdered,active:()=>simulation.active,records:()=>records,setRecords:r=>{records=r;recordsGeneration++;clusterCache=null;boundCache=null;}};return api;`);
const {createFireworks}=await import('data:text/javascript;base64,'+Buffer.from(instrumented).toString('base64'));
const checks=[],observations=[],owned=[],check=(name,fn)=>{try{checks.push({name,passed:true,evidence:fn()??null});}catch(error){checks.push({name,passed:false,error:String(error.stack)});}};
const close=(a,b,t=2e-6)=>assert(Math.abs(a-b)<=t*Math.max(1,Math.abs(a),Math.abs(b)),`${a} != ${b}`);
const Y=v=>v[0]*.2126+v[1]*.7152+v[2]*.0722;
const profile=createBurnProfile({id:'independent RGB phase witness',emissionKnots:[{age:0,rgb:[0,0,0]},{age:.1,rgb:[12,0,0]},{age:.2,rgb:[0,0,0]},{age:.3,rgb:[0,10,0]},{age:.4,rgb:[0,0,0]},{age:.5,rgb:[0,0,30]},{age:.6,rgb:[0,0,0]}],materialRateKnots:[{age:0,rate:1},{age:.6,rate:1}]});
const body=(patch={})=>({id:0,kind:'star',birth:0,life:.6,position:[0,20,-100],velocity:[4,0,0],drag:0,gravity:0,radius:.003,intensity:10,emissionReferenceI0:10,effectProfile:'two-colour-v1',layerId:'single',burnProfile:profile,...patch});
const record=(b,now,patch={})=>{const e=sampleBodyEmission(b,now-b.birth),state=sampleBody(b,now);return{...state,eventId:'independent',kind:'star',radius:b.radius,sourceBody:b,sourceAge:now-b.birth,emissionFraction:1,vectorEmission:true,emissionRGBReference:e.emissionRGBReference,intensity:e.intensityCdReference,colour:e.unitYColour,maximumReferenceRGB:e.allPhaseMaximumRGB,unmodulatedIntensity:b.intensity,stretch:[0,0,0],...patch};};
const camera=(mirror=false)=>{const c=new THREE.PerspectiveCamera(55,1.5,.1,30000);c.position.set(0,mirror?-10:10,10);c.lookAt(0,20,-100);c.updateMatrixWorld();return c;};
const renderer=()=>({autoClear:true,shadowMap:{autoUpdate:true,needsUpdate:false},target:null,getRenderTarget(){return this.target;},getActiveCubeFace(){return 0;},getActiveMipmapLevel(){return 0;},setRenderTarget(t){this.target=t;},render(){}});
const make=now=>{const f=createFireworks(THREE,{sourceVisibility:'none'});owned.push(f);f.update({time:now,windVector:[0,0,0]});return f;};
function capture(f,{shutter=.5,reflection=false}={}){f.render({renderer:renderer(),target:{width:1200,height:800},camera:camera(reflection),reflection,legacySmoke:false,optics:{width:1200,height:800,shutterSeconds:shutter}});const m=f.effectsScene.children[0],g=m.geometry;return{rows:f.__qa.ordered(),count:g.instanceCount,shutter:m.material.uniforms.uShutter.value,legacyShutter:m.material.uniforms.uLegacyShutter.value,attributes:Object.fromEntries(Object.entries(g.attributes).filter(([k])=>k!=='position').map(([k,a])=>[k,a.array.slice(0,g.instanceCount*a.itemSize)]))};}
const taps=(a,i)=>Array.from({length:24},(_,k)=>a.attributes['aTemporal'+Math.floor(k/4)][i*4+k%4]);

check('dark-now but bright-history candidate survives filtering upload and projected radiance aggregation',()=>{
 const now=.75,f=make(now),p=record(body(),now);assert.deepEqual(p.colour,[0,0,0]);assert.equal(p.intensity,0);f.__qa.setRecords([p]);
 const seen=[],bound=f.getRadianceBound({camera:camera(),optics:{width:1200,height:800,shutterSeconds:.5},onSourceBound:x=>seen.push(x)}),a=capture(f);
 assert.equal(seen.length,1);assert.equal(a.count,1);assert(bound.maximumRawRadiance>0);assert(seen[0].bound.peak>0);assert(taps(a,0).some(v=>v>0));assert.equal(a.attributes.aShape[3],-1);assert.deepEqual(Array.from(a.attributes.aColour),[1,1,1]);
 const framing=f.getFramingSources({shutterSeconds:.5});assert.equal(framing.length,a.count);
 return{currentRGB:p.emissionRGBReference,maximumReferenceRGB:p.maximumReferenceRGB,bound:bound.maximumRawRadiance,tapMean:[0,1,2].map(c=>taps(a,0).filter((_,i)=>i%3===c).reduce((s,v)=>s+v,0)/8),diagnosticMaximumEmissionRGBChannel:bound.maximumEmissionRGBChannel};
});
check('every source phase and bin mean is below independently authored componentwise all-phase maximum',()=>{
 let windows=0;const b=body(),maximum=[12,10,30];assert.deepEqual(profile.emission.sourceMaximumRGB,maximum);
 for(const now of [.05,.1,.15,.2,.3,.4,.5,.6,.75])for(const shutter of [0,1/120,.125,.5,1]){const f=make(now);f.__qa.setRecords([record(b,now)]);const a=capture(f,{shutter}),e=resolveFireworkExposure({physicalNow:now,shutterSeconds:shutter}),truth=integrateBurnEmission(profile,e.from,e.to);if(!a.count){assert(truth.averageRGBReference.every(v=>v===0));continue;}const data=taps(a,0);for(let c=0;c<3;c++){for(let i=0;i<8;i++)assert(data[i*3+c]>=0&&data[i*3+c]<=maximum[c]*(1+1e-6));close(data.filter((_,i)=>i%3===c).reduce((s,v)=>s+v,0)/8,truth.averageRGBReference[c]);}windows++;}
 return{windows,maximumRGB:maximum,oracle:'independent exact local piecewise-linear integral from profile; no current unit-Y colour multiplication'};
});
check('mixed candidate and legacy records keep candidate causal shutter in mirror while legacy remains S0',()=>{
 const now=.45,f=make(now),b=body(),v=record(b,now),l={eventId:'independent',kind:'star',position:[1,20,-100],velocity:[3,0,0],stretch:[0,0,0],radius:.003,intensity:10,unmodulatedIntensity:10,colour:[1,.4,.1],sourceAge:.45,sourceBody:{kind:'star',life:2,intensity:10}};f.__qa.setRecords([v,l]);
 const main=capture(f),mirror=capture(f,{reflection:true}),iv=main.rows.findIndex(p=>p.vectorEmission),jv=mirror.rows.findIndex(p=>p.vectorEmission);assert(iv>=0&&jv>=0);assert.deepEqual(taps(main,iv),taps(mirror,jv));assert.equal(main.shutter,.5);assert.equal(mirror.shutter,.5);assert.equal(main.legacyShutter,.5);assert.equal(mirror.legacyShutter,0);assert.deepEqual(main.rows[iv].position,mirror.rows[jv].position);
 const il=mirror.rows.findIndex(p=>!p.vectorEmission);assert.equal(il>=0,true);const weights=Array.from(mirror.attributes.aTemporal0.slice(il*4,il*4+4)).concat(Array.from(mirror.attributes.aTemporal1.slice(il*4,il*4+4)));assert(weights.every(w=>w===weights[0]));return{candidateShutter:[main.shutter,mirror.shutter],legacyShutter:[main.legacyShutter,mirror.legacyShutter],candidateAnchor:main.rows[iv].position};
});
check('all eight time-bin centres and both spatial-tail endpoints fit the raster quad and CPU bin bound',()=>{
 const c=camera(),o={width:1200,height:800,shutterSeconds:.5,legacyShutterSeconds:0},base=record(body(),.45),project=p=>{const v=new THREE.Vector3(...p).project(c);return[(v.x*.5+.5)*o.width,(v.y*.5+.5)*o.height];};let witnesses=0;
 for(const speed of [0,.05,4,80])for(const stretch of [[0,0,0],[.3,.1,0],[8,-1,2]])for(const radius of [.001,2]){const p={...base,velocity:[speed,0,0],stretch,radius,viewExposure:{durationSeconds:.5}},b=getFireworkSourceBound(p,c,o),centre=project(p.position),sh=project(p.position.map((v,i)=>v+p.velocity[i]*.25)).map((v,i)=>v-project(p.position.map((v,j)=>v-p.velocity[j]*.25))[i]),tr=project(p.position.map((v,i)=>v+stretch[i]*.5)).map((v,i)=>v-project(p.position.map((v,j)=>v-stretch[j]*.5))[i]),trail=Math.hypot(...stretch)>1e-6,spread=3.65*Math.sqrt(b.baseSigma2),gpuExtent=sh.map((v,i)=>spread+Math.abs(trail?tr[i]:v)*.5+(trail?Math.abs(v)*.5:0)+.65);
  for(let i=0;i<8;i++)for(const j of trail?[-.5,.5]:[0])for(let axis=0;axis<2;axis++){const x=centre[axis]+sh[axis]*((i+.5)/8-.5)+(trail?tr[axis]*j:0);assert(Math.abs(x-centre[axis])+spread<=gpuExtent[axis]+1e-8);assert(x-spread>=b.rect[axis]-1e-8&&x+spread<=b.rect[axis+2]+1e-8);witnesses++;}assert.equal(classifyFireworkSourceVisibility(p,c,o).clipped,false);
 }return{witnesses,scope:'deterministic double-projection support witnesses; actual FP32 raster/link validation belongs to root GPU gate'};
});
check('candidate core maximum remains independent of current black colour when public single-source bound is queried',()=>{
 const p=record(body(),.75),c=camera(),o={width:1200,height:800,shutterSeconds:.5},a=getFireworkSourceBound(p,c,o),b=getFireworkSourceBound({...p,colour:[1e6,0,0],intensity:1e6},c,o);assert(a.peak>0);assert.equal(a.peak,b.peak);return{peak:a.peak,allPhaseReferenceRGB:p.maximumReferenceRGB};
});
check('exposure-aware framing retains historical RGB mean and identical optical midpoint at the SAME shutter',()=>{
 const now=.75,f=make(now),p=record(body(),now,{stretch:[2,1,0]});f.__qa.setRecords([p]);const a=capture(f,{shutter:.5}),framing=f.getFramingSources({shutterSeconds:.5}),truth=integrateBurnEmission(profile,.25,.75);assert.equal(framing.length,1);const row=framing[0];
 for(let c=0;c<3;c++)close(row.intensity*row.colour[c],truth.averageRGBReference[c],2e-12);assert.deepEqual(row.position,a.rows[0].position);assert.deepEqual(row.stretch,a.rows[0].stretch);assert.deepEqual(row.viewExposure,a.rows[0].viewExposure);
 for(const value of [framing,row,row.position,row.stretch,row.colour,row.viewExposure])assert(Object.isFrozen(value));
 assert.equal(f.getFramingSources({shutterSeconds:0}).length,0);assert.equal(f.getFramingSources().length,0);assert.throws(()=>f.getFramingSources({shutterSeconds:1.1}),/Shutter/);
 return{sameShutter:.5,renderedRows:a.count,framingRows:framing.length,meanReferenceRGB:truth.averageRGBReference,anchor:row.position,defaultWindowRows:0,defaultWindowMeaning:'1/120 excludes the already-extinguished history; different shutters are intentionally not interchangeable'};
});
check('maximumEmissionRGBChannel derives from all-phase reference divided by unmodulated I0 and retains legacy maximum',()=>{
 const now=.75,f=make(now),p=record(body(),now),options={camera:camera(),optics:{width:1200,height:800,shutterSeconds:.5}};f.__qa.setRecords([p]);const a=f.getRadianceBound(options);assert.equal(a.maximumEmissionRGBChannel,3);
 f.__qa.setRecords([{...p,colour:[1e6,0,0]}]);const b=f.getRadianceBound(options);assert.equal(b.maximumEmissionRGBChannel,3);assert.equal(b.maximumRawRadiance,a.maximumRawRadiance);
 const legacy={eventId:'independent',kind:'star',position:[1,20,-100],velocity:[0,0,0],stretch:[0,0,0],radius:.003,intensity:2,unmodulatedIntensity:2,colour:[1,6,.1],sourceAge:.45,sourceBody:{kind:'star',life:2,intensity:2}};f.__qa.setRecords([p,legacy]);const mixed=f.getRadianceBound(options);assert.equal(mixed.maximumEmissionRGBChannel,6);
 return{darkNowChannelMaximum:a.maximumEmissionRGBChannel,legacyMixedMaximum:mixed.maximumEmissionRGBChannel,semantics:'dimensionless channel-to-authored-unmodulated-I0 ratio; actual radiance peak continues to use full reference RGB'};
});
check('candidate kernel cost and approximation diagnostics distinguish the actual 64/2048 paths from legacy',()=>{
 const f=createFireworks(THREE);owned.push(f);const legacy=f.diagnostics();assert.match(legacy.tailIntegration.kernelEvaluations,/8 normal \/24 large/);assert.equal(legacy.profileOptics,undefined);
 f.configure({type:'chrysanthemum',effectProfile:'two-colour-v1',launchSpreadDegrees:0});f.launch({seed:42});const simple=f.diagnostics();assert.match(simple.tailIntegration.kernelEvaluations,/8 temporal by8 spatial =64/);assert.equal(simple.profileOptics.attributes,13);assert.equal(simple.profileOptics.estimatedVaryingComponents,54);assert(simple.profileOptics.limits.some(s=>s.includes('ground cutoff')));
 f.configure({trailIntegration:'adaptive'});const adaptive=f.diagnostics();assert.match(adaptive.tailIntegration.kernelEvaluations,/8 temporal bins times2 spatial levels times128 local samples =2048/);assert.match(adaptive.tailIntegration.kernelEvaluations,/zero motion shortcuts/);
 return{legacy:legacy.tailIntegration.kernelEvaluations,candidateSimple:simple.tailIntegration.kernelEvaluations,candidateAdaptive:adaptive.tailIntegration.kernelEvaluations,scope:'Published upper-work descriptions checked against nested vector time/spatial loop counts; no GPU timing claim'};
});

// Known-boundary observation, deliberately not counted as an acceptance pass:
// the current ground visibility cutoff predates causal exposure records.
{
 const f=make(0),b=body({position:[0,.2,-100],velocity:[0,-.5,0]}),now=.5;
 f.__qa.active().push({id:'ground history witness',type:'chrysanthemum',seed:42,time:0,burstTime:0,burstPosition:[0,.2,-100],origin:[0,.2,-100],definition:{ground:false},rocket:null,heads:[b],events:[],endTime:100});
 f.update({time:now,windVector:[0,0,0]});const a=capture(f,{shutter:.5}),past=sampleBody(b,.3),current=sampleBody(b,now),pastEmission=sampleBodyEmission(b,.3);
 observations.push({kind:'current ground cutoff omits above-ground shutter history',currentY:current.position[1],pastTime:.3,pastY:past.position[1],pastReferenceRGB:pastEmission.emissionRGBReference,expectedHistoricalSupport:past.position[1]>.03&&pastEmission.intensityCdReference>0,renderedHistoryRows:a.count,scope:'Synthetic one-body boundary repro; ordinary high-altitude two-profile launches are not established to hit this boundary. Correct physical treatment requires terminating at ground crossing while retaining earlier shutter support, not emitting under water.'});
}

for(const f of owned)f.dispose();
const report={schema:'glass-atoll.r18-vector-bound-independent-cpu.v1',dateUTC:new Date().toISOString(),passed:checks.every(x=>x.passed),passedCount:checks.filter(x=>x.passed).length,total:checks.length,sourceSHA256:hash(source),checks,observations,limits:['CPU-only actual Three constructors with instrumented private getters and no-context renderer stub.','No native shader compilation, fragment radiance, VTF, HDR presentation, frame time or GPU acceptance.','Same current source snapshot is imported/instrumented; root may subsequently edit runtime; source hash identifies this run.','Observations are explicit unresolved contract limits, not requirement acceptance passes.']};
const text=JSON.stringify(report,null,2)+'\n';fs.writeFileSync(new URL('./r18-vector-bound-independent-check.json',import.meta.url),text);console.log(text);if(!report.passed)process.exitCode=1;
