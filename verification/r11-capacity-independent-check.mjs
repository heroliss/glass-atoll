import assert from 'node:assert/strict';
import {readFileSync,writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import * as THREE from '../vendor/three.module.js';
import {createPyroSmokeLogicalEvents} from '../pyro-smoke-logical-events.js';

const root=new URL('../',import.meta.url),read=p=>readFileSync(new URL(p,root),'utf8'),hash=s=>createHash('sha256').update(s).digest('hex');
const current=read('pyro-smoke-state.js'),prior=read('verification/baselines/r10-sealed-runtime/pyro-smoke-state.js');
const frozen='67fa049f11928d23edf7b57798fd899fdbacb8956c3d939a479839642b429172',baseline='1aa90d24f42adbf6416bd871e8de56d26c4841535e7f0d7f80e591286c6a2cba';
assert.equal(hash(current),frozen);assert.equal(hash(prior),baseline);
const oldStart=prior.indexOf('      const selected=[...pool.filter'),oldEnd=prior.indexOf('\n      let choice=',oldStart),newStart=current.indexOf('      // Keep the same stable top8 order'),newEnd=current.indexOf('\n      let choice=',newStart);
assert(oldStart>=0&&oldEnd>oldStart&&newStart>=0&&newEnd>newStart);
const oldBlock=prior.slice(oldStart,oldEnd),newBlock=current.slice(newStart,newEnd),oldSelect=new Function('pool',oldBlock+'\nreturn selected;'),newSelect=new Function('pool',newBlock+'\nreturn selected;');
const checks=[];let started=performance.now(),deadline=started+20000;
const timebox=()=>assert(performance.now()<deadline,'independent20second CPU work budget exceeded');
const check=(name,fn)=>{try{timebox();checks.push({name,passed:true,evidence:fn()});}catch(e){checks.push({name,passed:false,error:String(e.stack||e).replace(/data:text\/javascript;base64,[A-Za-z0-9+/=]+/g,'[in-memory QA module]')});}};
function sameSelection(pool){const original=Object.freeze(pool.map(Object.freeze)),old=oldSelect(original),next=newSelect(original);assert.equal(old.length,next.length);for(let i=0;i<old.length;i++)assert.equal(old[i],next[i]);return next;}
async function compile(source,name){const adjusted=source.replaceAll(/from '\.\/([^']+)'/g,(_,p)=>'from '+JSON.stringify(new URL(p,root).href));return(await import('data:text/javascript;base64,'+Buffer.from(adjusted).toString('base64')))[name];}
function observed(source){
 const site='      let choice=null,quality=Infinity,choicePreferred=false;',tail='  };return api;';
 assert.equal(source.split(site).length,2);assert.equal(source.split(tail).length,2);
 return source.replace(site,`      __independent.observe(pool,selected);
${site}`).replace(tail,`  };Object.defineProperty(api,'__independent',{value:__independent});return api;`).replace('  function compact(){',`  const __independent={calls:0,pairs:0,rows:[],maximumScore:0,observe(pool,selected){
    if(performance.now()>${deadline})throw Error('independent state deadline exceeded');
    this.calls++;this.pairs+=pool.length;const seenPairs=new Set();
    for(const c of pool){if(!Number.isFinite(c.score)||c.score<0||!Number.isSafeInteger(c.i)||!Number.isSafeInteger(c.j)||!(c.i<c.j)||typeof c.sameSource!=='boolean')throw Error('invalid production candidate domain');const key=c.i+','+c.j;if(seenPairs.has(key))throw Error('duplicate production pair');seenPairs.add(key);this.maximumScore=Math.max(this.maximumScore,c.score);}
    this.rows.push(selected.map(c=>[c.i,c.j,c.sameSource,c.score]));
  }};
  function compact(){`);
}
const oldFactory=await compile(observed(prior),'createPyroSmokeState'),newFactory=await compile(observed(current),'createPyroSmokeState');
const unit=v=>{const n=Math.hypot(...v);return v.map(c=>c/n);},diag=(x,y,z)=>[x,0,0,0,y,0,0,0,z],packet=(i,o={})=>({time:0,emissionId:i,sourceId:'same',profileId:'reference',mass:.01,mean:[0,100,0],covariance:diag(1,1,1),temperatureExcessK:0,buoyantVelocity:0,...o});
function equalStates(a,b){assert.deepEqual(a.snapshot(),b.snapshot());assert.deepEqual(a.diagnostics(),b.diagnostics());assert.deepEqual(a.__independent.rows,b.__independent.rows);}
function settleBoth(a,b,t){let x,y,iterations=0;do{timebox();x=a.advanceTo(t);y=b.advanceTo(t);assert.deepEqual(x,y);equalStates(a,b);assert(++iterations<1000);}while(!x.completed);return iterations;}

check('independent prefix and suffix comparison finds exactly the selection block changed',()=>{
 assert.equal(prior.slice(0,oldStart),current.slice(0,newStart));assert.equal(prior.slice(oldEnd),current.slice(newEnd));assert.equal(current.replace(newBlock,oldBlock),prior);return{baselineHash:baseline,currentHash:frozen,changedBlocks:1,ownerNormalizerUsed:false,validationKernelsAndMutationSequenceUntouched:true};
});
check('right-of-equals insertion preserves duplicate complete keys stable object identity',()=>{
 let cases=0,objects=0;for(const n of [0,1,7,8,9,16,17,40,160])for(const mixed of [false,true])for(const score of [-0,0,Number.MIN_VALUE,1,2e42]){
  const pool=Array.from({length:n},(_,i)=>({i:3,j:9,score,sameSource:mixed?i%3===0:true,tag:i}));const result=sameSelection(pool);
  for(const kind of [false,true])assert.deepEqual(result.filter(c=>c.sameSource===kind).map(c=>c.tag),pool.filter(c=>c.sameSource===kind).slice(0,8).map(c=>c.tag));cases++;objects+=n;
 }return{cases,objects,duplicateFullKeysAreSynthetic:true,productionPairsDeduplicated:true};
});
check('finite total-order pools match after shuffled ties and x-index tie breaks',()=>{
 let rng=0x17ba3c6d;const rand=()=>{rng=(Math.imul(rng,1664525)+1013904223)>>>0;return rng/4294967296;};let cases=0,objects=0;
 for(let t=0;t<240;t++){const n=1+Math.floor(rand()*1024),pool=Array.from({length:n},(_,k)=>({i:Math.floor(rand()*32),j:33+Math.floor(rand()*32),score:t%3===0?Math.floor(rand()*4):t%3===1?rand()*2e42:rand()*1e-42,sameSource:rand()<.5,tag:k}));for(let k=n-1;k>0;k--){const q=Math.floor(rand()*(k+1));[pool[k],pool[q]]=[pool[q],pool[k]];}sameSelection(pool);objects+=n;cases++;}return{cases,objects,seed:'0x17ba3c6d',scoresFiniteNonnegative:true};
});
check('nonfinite generic comparator equivalence is explicitly rejected as a claim',()=>{
 const input=[[1,1,5],[2,0,7],[0,5,6],[1,9,8],[1,6,5],[1,9,2],[1,3,5],[1,5,2],[NaN,9,6],[2,3,5]].map(([score,i,j],tag)=>({score,i,j,tag,sameSource:true}));
 const old=oldSelect(input).map(c=>c.tag),next=newSelect(input).map(c=>c.tag);assert.notDeepEqual(old,next);
 const maxWorld=1e9,minVariance=1e-24,maxCovariance=1e20,maximumDistanceSquared=3*(2*maxWorld)**2,minimumTrace=6*minVariance,maximumTrace=6*maxCovariance,maximumScore=maximumDistanceSquared/minimumTrace;assert(Number.isFinite(maximumScore));
 return{invalidNaNPool:{input:input.map(c=>({...c,score:Number.isNaN(c.score)?'NaN':c.score})),old,next},notAnAdmissibleStatePool:true,why:'Array.sort comparator with NaN score may not be transitive; equivalence is for validated finite production tuples only.',numericDomain:{maximumDistanceSquared,minimumTrace,maximumTrace,maximumScore},publishedDomainsAndValidationUnchanged:true};
});
check('NaN Infinity signed-domain violations reject before current or prior state mutation',()=>{
 const a=oldFactory(),b=newFactory();let cases=0;
 for(const override of [{mean:[0,NaN,0]},{mean:[Infinity,0,0]},{mean:[1e9+1,0,0]},{mass:NaN},{mass:Infinity},{covariance:diag(NaN,1,1)},{covariance:diag(Infinity,1,1)},{covariance:diag(1e-30,1,1)},{temperatureExcessK:NaN},{buoyantVelocity:Infinity},{time:NaN}]){
  const before=JSON.stringify(a.snapshot());let x,y;try{a.queueEmission(packet(0,override));}catch(e){x=e;}try{b.queueEmission(packet(0,override));}catch(e){y=e;}assert(x&&y);assert.equal(x.constructor,y.constructor);assert.equal(x.message,y.message);assert.equal(JSON.stringify(a.snapshot()),before);equalStates(a,b);cases++;
 }for(const velocity of [[NaN,0,0],[0,Infinity,0],[1e6+1,0,0]]){assert.throws(()=>a.setWind({time:0,velocity}));assert.throws(()=>b.setWind({time:0,velocity}));equalStates(a,b);cases++;}
 assert.equal(a.__independent.calls,0);assert.equal(b.__independent.calls,0);return{cases,compactionInvocations:0,noNaNCandidateFallbackAdded:true};
});
check('fixed ticks off-tick sources variable wind and bounded catchup preserve actual merges',()=>{
 let cases=0,merges=0,pairs=0,rayQueries=0;const cadenceResults=[];
 for(const dispersionModel of ['brownian','taylor'])for(const origin of [0,4000])for(const capacity of [1,5,17]){
  let previousFinal=null;
  for(const hz of [30,120]){
   const profiles=capacity===1?{reference:{extinctionPerMassRGB:[2,1,.5]}}:{reference:{extinctionPerMassRGB:[2,1,.5]},other:{extinctionPerMassRGB:[.1,.7,3]}};
   const opts={time:origin,capacity,profiles,dispersionModel,maxStepsPerAdvance:2},a=oldFactory(opts),b=newFactory(opts);
   for(const w of [{time:origin,velocity:[1.3,0,-.5]},{time:origin+.037,velocity:[-.4,.1,.8]},{time:origin+.313,velocity:[2,0,-.3]},{time:origin+.575,velocity:[0,0,0]}]){a.setWind(w);b.setWind(w);}
   for(let i=0;i<48;i++){
    const p=packet(i,{time:origin+Math.floor(i/3)*.037,sourceId:i%4===0?null:'s'+i%5,profileId:capacity===1?'reference':i%3===0?'other':'reference',mass:.02+(i%7)*.03,mean:[i%4,100+i%5*.1,i%3],covariance:[1+i%3,.12,.03,.12,2,.05,.03,.05,1.4+i%2],temperatureExcessK:i%5*4,buoyantVelocity:i%4*.3,...(dispersionModel==='taylor'?{dispersionQ:(i%4)/4}:{} )});a.queueEmission(p);b.queueEmission(p);equalStates(a,b);
   }
   for(let k=1;k<=hz;k++)settleBoth(a,b,origin+k/hz);
   for(let q=0;q<6;q++){const ray={origin:[q-7,95,-2],direction:unit([.2,1,.1]),start:0,end:30};assert.deepEqual(a.columnOpticalDepth(ray),b.columnOpticalDepth(ray));assert.deepEqual(a.sampleMedium([q%3,100,q%4]),b.sampleMedium([q%3,100,q%4]));rayQueries++;}
   const at=origin+1,before=JSON.stringify(a.snapshot());assert.throws(()=>a.queueEmission(packet(48,{time:at-.1})));assert.throws(()=>b.queueEmission(packet(48,{time:at-.1})));assert.throws(()=>a.setWind({time:at-.1,velocity:[0,0,0]}));assert.throws(()=>b.setWind({time:at-.1,velocity:[0,0,0]}));assert.equal(JSON.stringify(a.snapshot()),before);equalStates(a,b);
   const final=hash(JSON.stringify(a.snapshot()));if(previousFinal!==null)assert.equal(final,previousFinal);previousFinal=final;
   const d=a.diagnostics();assert(d.merges>0);merges+=d.merges;pairs+=a.__independent.pairs;cadenceResults.push({dispersionModel,origin,capacity,hz,merges:d.merges,forced:d.forcedMerges,selectionTraceSHA256:hash(JSON.stringify(a.__independent.rows)),snapshotSHA256:final});cases++;
  }
 }return{cases,merges,pairs,rayQueries,allCandidateScoresFinite:true,selectionOrdersEqual:true,results:cadenceResults};
});

const fwFactory=await compile(read('fireworks.js'),'createFireworks');
check('native palm past-segment emissions replay exactly through wind changes and merges',()=>{
 const f=fwFactory(THREE),sourceState=newFactory({capacity:65536}),tape=[],queue=sourceState.queueEmission;
 sourceState.queueEmission=e=>{const r=queue(e);tape.push(structuredClone(e));return r;};f.configure({autoLaunch:false,autoDirection:false});f.update({time:0,windVector:[0,0,0]});const launch=f.launch({type:'palm',seed:77}),end=launch.burstTime+1.05;
 const windChanges=[{time:0,velocity:[0,0,0]},{time:.713,velocity:[1.2,0,-.7]},{time:launch.burstTime-.17,velocity:[-.6,0,1.3]},{time:launch.burstTime+.143,velocity:[.4,.05,-.2]}].sort((a,b)=>a.time-b.time),times=new Set([0,end,...windChanges.map(w=>w.time)]);for(let i=1;i/30<end;i++)times.add(i/30);
 const adapter=createPyroSmokeLogicalEvents({state:sourceState,sourceProvider:f.smokeSourceProvider});let wi=0,wind=[0,0,0];
 try{for(const t of [...times].sort((a,b)=>a-b)){timebox();while(wi<windChanges.length&&windChanges[wi].time<=t){wind=windChanges[wi].velocity;sourceState.setWind(windChanges[wi]);wi++;}f.update({time:t,windVector:wind});adapter.consume(f.drainEvents(),{throughTime:t,windVector:wind});let advance;do{advance=sourceState.advanceTo(t);}while(!advance.completed);}}
 finally{f.dispose();adapter.dispose();}
 assert(tape.length>24&&tape.length<800);assert(tape.every(p=>Number.isFinite(p.time)&&p.time<=end));
 const results=[];for(const capacity of [8,24]){
  const a=oldFactory({capacity,maxStepsPerAdvance:3}),b=newFactory({capacity,maxStepsPerAdvance:3});for(const w of windChanges){a.setWind(w);b.setWind(w);}for(const e of tape){a.queueEmission(e);b.queueEmission(e);equalStates(a,b);}settleBoth(a,b,Math.ceil(end*20)/20);
  for(const ray of [{origin:[0,0,0],direction:[0,1,0],start:0,end:400},{origin:[-50,90,0],direction:unit([1,0,.1]),start:0,end:200}])assert.deepEqual(a.columnOpticalDepth(ray),b.columnOpticalDepth(ray));
  const d=a.diagnostics();assert(d.merges>0);results.push({capacity,merges:d.merges,forcedMerges:d.forcedMerges,candidatePairs:a.__independent.pairs,selectionSHA256:hash(JSON.stringify(a.__independent.rows)),snapshotSHA256:hash(JSON.stringify(a.snapshot())),diagnosticsSHA256:hash(JSON.stringify(d))});
 }return{type:'palm',seed:77,burstTime:launch.burstTime,end,emissions:tape.length,tapeSHA256:hash(JSON.stringify(tape)),windChanges,results,scope:'real native causal source tape, bounded source prefix and CPU states only; no GPU or default4096 stress'};
});
check('source hashes remained frozen through all independent tests',()=>{assert.equal(hash(read('pyro-smoke-state.js')),frozen);assert.equal(hash(read('verification/baselines/r10-sealed-runtime/pyro-smoke-state.js')),baseline);return{current:frozen,baseline};});
const report={schema:'glass-atoll.r11-capacity-independent.v1',dateUTC:new Date().toISOString(),actualGPU:false,sourceSHA256:{state:frozen,baselineState:baseline,helper:hash(read('verification/r11-capacity-independent-check.mjs'))},checks,counts:{passed:checks.filter(c=>c.passed).length,total:checks.length},wallMs:performance.now()-started,limits:['CPU source and selection semantics only. No new GPU/FPS, photoreal smoke, long-accumulation or all6291/default4096 willow claim.','Equivalence is for finite validated production candidate tuples. Arbitrary NaN comparators are explicitly not assumed transitive or equivalent.','Existing forced merge spatial/column approximations remain; exact equality to baseline is not a new global optical error bound.','Private pool observers are inserted only into in-memory test copies, not runtime files.']};report.passed=checks.every(c=>c.passed);
writeFileSync(new URL('./r11-capacity-independent-check.json',import.meta.url),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({passed:report.passed,counts:report.counts,wallMs:report.wallMs,failures:checks.filter(c=>!c.passed)},null,2));if(!report.passed)process.exitCode=1;
