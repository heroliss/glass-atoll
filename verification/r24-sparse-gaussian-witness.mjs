// Bounded synthetic CPU falsification only. No Three.js, renderer, GPU or native data.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import crypto from 'node:crypto';
import {performance} from 'node:perf_hooks';
import {createSyntheticGaussianHierarchy} from './r24-sparse-gaussian-hierarchy.js';

const sha=x=>crypto.createHash('sha256').update(x).digest('hex'),checks=[],cases=[];
const check=(name,fn)=>{try{checks.push({name,passed:true,evidence:fn()??null});}catch(e){checks.push({name,passed:false,error:String(e.stack??e)});}};
const profiles=[{id:'red',extinctionPerMassRGB:[1.4,.02,0]},{id:'green',extinctionPerMassRGB:[.01,2,.04]},{id:'neutral',extinctionPerMassRGB:[.8,.7,.6]},{id:'zero-optics',extinctionPerMassRGB:[0,0,0]}];
const mul=(A,B)=>Array.from({length:9},(_,n)=>{const r=Math.floor(n/3),c=n%3;return A[r*3]*B[c]+A[r*3+1]*B[c+3]+A[r*3+2]*B[c+6];});
const transpose=A=>Array.from({length:9},(_,i)=>A[(i%3)*3+Math.floor(i/3)]);
function covariance(values,angle=0){const c=Math.cos(angle),s=Math.sin(angle),R=[c,0,s,0,1,0,-s,0,c],C=mul(mul(R,[values[0],0,0,0,values[1],0,0,0,values[2]]),transpose(R));for(const [a,b]of [[1,3],[2,6],[5,7]])C[a]=C[b]=(C[a]+C[b])*.5;return C;}
function random(seed){let s=seed>>>0;return()=>{s=(Math.imul(s,1664525)+1013904223)>>>0;return s/4294967296;};}
function snapshot(count,kind,seed=81024){
  const rng=random(seed),packets=[];
  for(let i=0;i<count;i++){
    const near=i%4===0,jitter=()=>rng()-.5;let mean=[jitter()*.5,jitter()*.5,jitter()*2],C=covariance([.25,.3,.35],i*.1);
    if(kind==='separated')mean=near?mean:[48+jitter()*3,28+jitter()*2,2+jitter()*4];
    if(kind==='thin-gap'){mean=[i<count/2?-10:10,jitter()*.03,jitter()*.1];C=covariance([1,1,1]);}
    if(kind==='inside'){mean=[jitter()*.3,jitter()*.3,jitter()*.3];C=covariance([.7,.8,.9],i*.05);}
    if(kind==='tangent'){mean=[jitter()*.02,jitter()*.02,jitter()];C=covariance([1,1,1]);}
    if(kind==='long'){mean=near?[jitter(),jitter()*.1,jitter()*.1]:[jitter()*30,20+jitter(),15+jitter()];C=covariance([.01,.02,.03],i*.03);}
    if(kind==='anisotropic'){mean=near?mean:[18+jitter(),12+jitter(),jitter()];C=covariance([.0001,.3,4],i*.137);}
    if(kind==='mixed'){mean=near?mean:[50+jitter()*8,35+jitter()*4,jitter()*4];C=covariance([.1+.1*rng(),.2,.3],i*.05);}
    if(kind==='budget-tail'){mean=[4.5,0,0];C=covariance([1,1,1]);}
    packets.push({id:i%2===0?'packet-'+i:-i,profileId:kind==='mixed'?profiles[i%profiles.length].id:['thin-gap','budget-tail'].includes(kind)?'neutral':profiles[i%3].id,mass:kind==='budget-tail'?4e-5:.01+.005*rng(),mean,covariance:C,birthTime:i*.03,sourceFamily:'family-'+(i%4)});
  }
  return{revision:1,time:12,profiles:structuredClone(profiles),packets};
}
const ray=(tag,origin,end)=>({consumer:tag,origin,end});
const fixtures=[
  ...[16,64,128].map(n=>({name:'separated-'+n,snapshot:snapshot(n,'separated'),rays:[ray('eye-A',[0,0,-20],[0,0,20]),ray('eye-moved',[1,0,-20],[0,0,20]),ray('mirror-origin',[0,-3,-25],[0,0,20]),ray('light-to-medium',[-3,0,0],[3,0,0])]})),
  {name:'thin-gap',snapshot:snapshot(16,'thin-gap'),rays:[ray('gap',[0,0,-50],[0,0,50]),ray('one-lobe',[-10,0,-30],[-10,0,30])]},
  {name:'inside-smoke',snapshot:snapshot(16,'inside'),rays:[ray('inside',[0,0,0],[.2,.1,.5]),ray('long-inside',[0,0,0],[0,0,30])]},
  {name:'five-sigma-tangent',snapshot:snapshot(16,'tangent'),rays:[ray('tangent',[5,0,-20],[5,0,20]),ray('almost-tangent',[4.999,0,-20],[4.999,0,20])]},
  {name:'long-finite-segment',snapshot:snapshot(64,'long'),rays:[ray('long',[-700,0,0],[700,0,0]),ray('long-oblique',[-700,-.01,-.01],[700,.01,.01])]},
  {name:'rotated-anisotropic',snapshot:snapshot(64,'anisotropic'),rays:[ray('anisotropic',[0,0,-20],[0,0,20]),ray('near-thin-axis',[.001,.001,-20],[.001,.001,20])]},
  {name:'mixed-profiles',snapshot:snapshot(128,'mixed'),rays:[ray('eye',[0,0,-20],[0,0,20]),ray('shifted',[10,2,-20],[0,0,20]),ray('light',[-2,0,0],[2,0,0])]},
  {name:'nonzero-budget-tail',snapshot:snapshot(16,'budget-tail'),rays:[ray('finite-tail',[0,0,-20],[0,0,20]),ray('short-finite-tail',[0,0,-.5],[0,0,.5])]},
  {name:'zero-length',snapshot:snapshot(16,'inside'),rays:[ray('zero-L',[0,0,0],[0,0,0])]}
];

// Independent dense oracle: direct adjugate inverse and numerical integration
// of the physical 3D density. It uses no hierarchy Cholesky, node bounds or erf.
const GL8={x:[.1834346424956498,.525532409916329,.7966664774136267,.9602898564975363],w:[.362683783378362,.3137066458778873,.2223810344533745,.1012285362903763]};
const GL16={x:[.09501250983763744,.2816035507792589,.4580167776572274,.6178762444026438,.755404408355003,.8656312023878318,.9445750230732326,.9894009349916499],w:[.1894506104550685,.1826034150449236,.16915651939500254,.14959598881657673,.12462897125553388,.09515851168249278,.06225352393864789,.027152459411754095]};
function inverse(C){const[a,b,c,d,e,f,g,h,i]=C,co=[e*i-f*h,c*h-b*i,b*f-c*e,f*g-d*i,a*i-c*g,c*d-a*f,d*h-e*g,b*g-a*h,a*e-b*d],det=a*co[0]+b*co[3]+c*co[6];assert(det>0);return{A:co.map(x=>x/det),det};}
const quadratic=(A,x)=>x[0]*(A[0]*x[0]+A[1]*x[1]+A[2]*x[2])+x[1]*(A[3]*x[0]+A[4]*x[1]+A[5]*x[2])+x[2]*(A[6]*x[0]+A[7]*x[1]+A[8]*x[2]);
function densePacketColumn(packet,origin,end){
  const delta=end.map((v,c)=>v-origin[c]),L=Math.hypot(...delta);if(L===0||packet.mass===0)return{column:0,estimatedError:0,evaluations:0};
  const d=delta.map(v=>v/L),{A,det}=inverse(packet.covariance),r=origin.map((v,c)=>v-packet.mean[c]),a=quadratic(A,d),Ar=[A[0]*r[0]+A[1]*r[1]+A[2]*r[2],A[3]*r[0]+A[4]*r[1]+A[5]*r[2],A[6]*r[0]+A[7]*r[1]+A[8]*r[2]],middle=-(d[0]*Ar[0]+d[1]*Ar[1]+d[2]*Ar[2])/a,sigma=1/Math.sqrt(a),normalization=packet.mass/((2*Math.PI)**1.5*Math.sqrt(det));
  const breaks=[0,L];for(const k of [-12,-8,-4,-2,-1,-.5,0,.5,1,2,4,8,12]){const x=middle+k*sigma;if(x>0&&x<L)breaks.push(x);}breaks.sort((x,y)=>x-y);
  let evaluations=0,estimatedError=0;
  const density=s=>{evaluations++;const x=r.map((v,c)=>v+s*d[c]),q=quadratic(A,x);assert(q>=-1e-8,'oracle quadratic form negative outside margin');return normalization*Math.exp(-.5*Math.max(0,q));};
  const integrate=(lo,hi,rule)=>{const half=(hi-lo)*.5,mid=lo+half;let total=0;for(let i=0;i<rule.x.length;i++)total+=rule.w[i]*(density(mid-half*rule.x[i])+density(mid+half*rule.x[i]));return total*half;};
  function adaptive(lo,hi,depth=0){const fine=integrate(lo,hi,GL16),coarse=integrate(lo,hi,GL8),error=Math.abs(fine-coarse),tolerance=1e-13+1e-11*Math.abs(fine);if(error<=tolerance){estimatedError+=error;return fine;}if(depth>=12)throw new Error('bounded independent oracle did not converge');const m=(lo+hi)*.5;return adaptive(lo,m,depth+1)+adaptive(m,hi,depth+1);}
  let column=0;for(let j=1;j<breaks.length;j++)if(breaks[j]>breaks[j-1])column+=adaptive(breaks[j-1],breaks[j]);assert(Number.isFinite(column)&&column>=0);return{column,estimatedError,evaluations};
}
function denseColumns(snapshot,query){const profiles=new Map(snapshot.profiles.map(p=>[p.id,p.extinctionPerMassRGB])),start=performance.now(),rows=snapshot.packets.map(p=>{const v=densePacketColumn(p,query.origin,query.end),rgb=profiles.get(p.profileId);return{...v,tauRGB:rgb.map(k=>k*v.column),errorRGB:rgb.map(k=>k*v.estimatedError)};});return{rows,elapsedMs:performance.now()-start};}
const sum=(rows,field)=>rows.reduce((total,row)=>total.map((x,c)=>x+row[field][c]),[0,0,0]);

check('Independent numerical oracle matches known finite isotropic and long-line columns',()=>{
  const p={mass:2*Math.PI,mean:[0,0,0],covariance:[1,0,0,0,1,0,0,0,1]},full=densePacketColumn(p,[0,0,-30],[0,0,30]),half=densePacketColumn(p,[0,0,0],[0,0,30]),off=densePacketColumn(p,[5,0,-30],[5,0,30]);assert(Math.abs(full.column-1)<2e-13);assert(Math.abs(half.column-.5)<2e-13);assert(Math.abs(off.column-Math.exp(-12.5))<1e-15);return{full:full.column,half:half.column,offAxis:off.column,oracleEstimatedError:full.estimatedError};
});
check('Bounded synthetic fixtures retain every physical packet and falsify omitted RGB tau/T bounds with a separate dense integrator',()=>{
  let totalDensePairs=0,totalKeptPairs=0,totalNodes=0,largestTauBoundExcess=-Infinity,maximumTError=0,maximumNumericalSlack=0;
  for(const f of fixtures){
    const original=JSON.stringify(f.snapshot),h=createSyntheticGaussianHierarchy(f.snapshot),orderedIDs=f.snapshot.packets.map(p=>p.id);assert.deepEqual(h.physical,f.snapshot);assert.notEqual(h.physical,f.snapshot);assert.notEqual(h.physical.packets[0],f.snapshot.packets[0]);assert(Object.isFrozen(h.physical.packets[0].covariance));
    const queries=[];
    for(const q of f.rays){const selection=h.query({...q,budgetRGB:[1e-5,1e-5,1e-5]});assert(selection.supported);assert.equal(selection.numericCertificate,false);assert.equal(selection.keptIDs.length+selection.omittedIDs.length,orderedIDs.length);assert.deepEqual([...selection.keptPacketIndices,...selection.omittedPacketIndices].sort((a,b)=>a-b),orderedIDs.map((_,i)=>i));assert.equal(new Set([...selection.keptIDs,...selection.omittedIDs]).size,orderedIDs.length);assert.deepEqual(selection.keptIDs,selection.keptPacketIndices.map(i=>orderedIDs[i]));
      const dense=denseColumns(f.snapshot,q),keptSet=new Set(selection.keptPacketIndices),keptRows=dense.rows.filter((_,i)=>keptSet.has(i)),omittedRows=dense.rows.filter((_,i)=>!keptSet.has(i)),full=sum(dense.rows,'tauRGB'),kept=sum(keptRows,'tauRGB'),omitted=sum(omittedRows,'tauRGB'),oracleErrors=sum(dense.rows,'errorRGB'),actualTError=kept.map((t,c)=>Math.exp(-t)-Math.exp(-full[c])),boundT=selection.omittedBoundRGB.map(E=>-Math.expm1(-E)),slack=oracleErrors.map((v,c)=>Math.max(2e-12,32*v+256*Number.EPSILON*Math.max(1,full[c])));
      for(let c=0;c<3;c++){assert(selection.omittedBoundRGB[c]<=1e-5);assert(omitted[c]<=selection.omittedBoundRGB[c]+slack[c],'actual omitted tau exceeded proposed node bound');assert(actualTError[c]<=boundT[c]+slack[c],'T error exceeded omitted-bound propagation');assert(actualTError[c]>=-slack[c]);largestTauBoundExcess=Math.max(largestTauBoundExcess,omitted[c]-selection.omittedBoundRGB[c]);maximumTError=Math.max(maximumTError,actualTError[c]);maximumNumericalSlack=Math.max(maximumNumericalSlack,slack[c]);}
      totalDensePairs+=orderedIDs.length;totalKeptPairs+=selection.keptIDs.length;totalNodes+=selection.stats.visitedNodes;
      queries.push({consumer:q.consumer,origin:q.origin,end:q.end,queryKey:selection.queryKey,fullTauRGB:full,keptTauRGB:kept,actualOmittedTauRGB:omitted,omittedBoundRGB:selection.omittedBoundRGB,actualTErrorRGB:actualTError,propagatedTBoundRGB:boundT,numericalSlackRGB:slack,oracleEstimatedErrorRGB:oracleErrors,oracleDensityEvaluations:dense.rows.reduce((s,r)=>s+r.evaluations,0),denseOracleMs:dense.elapsedMs,selection:selection.stats,keptIDs:selection.keptIDs,omittedIDs:selection.omittedIDs});
    }
    assert.equal(JSON.stringify(f.snapshot),original);assert.deepEqual(h.physical,f.snapshot);cases.push({name:f.name,packetCount:orderedIDs.length,physicalKey:h.physicalKey,physicalIDs:orderedIDs,totalPhysicalMass:f.snapshot.packets.reduce((s,p)=>s+p.mass,0),build:h.build,queries});
  }
  assert(cases.find(c=>c.name==='separated-128').queries.some(q=>q.selection.retainedPackets<128),'bounded separated witness must demonstrate some actual pruning');
  assert(maximumTError>1e-10,'include a nonzero accepted omission/T error witness');
  return{fixtureCount:fixtures.length,rayCount:cases.reduce((n,c)=>n+c.queries.length,0),totalDensePairs,totalKeptPairs,nodeVisits:totalNodes,largestTauBoundExcess,maximumTError,maximumNumericalSlack,claim:'Numerical synthetic falsification only; bounds exclude a universal floating-point/transcendental certificate'};
});
check('Deterministic hierarchy/order is independent of timing and all physical packet copies survive caller mutation',()=>{
  const s=snapshot(64,'mixed'),a=createSyntheticGaussianHierarchy(s),b=createSyntheticGaussianHierarchy(structuredClone(s)),q=ray('eye',[0,0,-20],[0,0,20]),A=a.query(q),B=b.query(q);assert.equal(a.physicalKey,b.physicalKey);assert.deepEqual(a.order,b.order);assert.deepEqual(a.nodes,b.nodes);assert.deepEqual(A.keptIDs,B.keptIDs);assert.deepEqual(A.omittedBoundRGB,B.omittedBoundRGB);const before=JSON.stringify(a.physical);s.packets[0].mean[0]=999;s.profiles[0].extinctionPerMassRGB[0]=900;assert.equal(JSON.stringify(a.physical),before);assert.deepEqual(a.query(q).keptIDs,A.keptIDs);return{allPhysicalCopiesFrozen:true,originalPacketCount:a.physical.packets.length,timingsExcludedFromEquality:true};
});
check('Every query keeps distinct eye/moved-eye/light/mirror keys; changed density or color/profile produces a new key',()=>{
  const s=snapshot(16,'separated'),h=createSyntheticGaussianHierarchy(s),queries=fixtures[0].rays,keys=queries.map(q=>h.query(q).queryKey);assert.equal(new Set(keys).size,keys.length);const copy=structuredClone(s);copy.packets[0].mean[0]+=.01;assert.notEqual(createSyntheticGaussianHierarchy(copy).physicalKey,h.physicalKey);copy.packets[0].mean[0]-=.01;copy.profiles[0].extinctionPerMassRGB[0]+=.01;assert.notEqual(createSyntheticGaussianHierarchy(copy).physicalKey,h.physicalKey);assert.equal(h.query(queries[0]).queryKey,keys[0]);return{distinctRayKeys:keys.length,outputContainsNoReusableTTexture:true};
});
check('Traversal/retained-work rejection never publishes a partial source selection; zero budget is not a forced packet target',()=>{
  const h=createSyntheticGaussianHierarchy(snapshot(64,'inside')),q=ray('inside',[0,0,-5],[0,0,5]);for(const options of [{maxNodeVisits:0},{maxRetainedPackets:0}]){const result=h.query({...q,budgetRGB:[0,0,0],...options});assert.equal(result.supported,false);for(const key of ['keptIDs','keptPacketIndices','omittedIDs','omittedBoundRGB'])assert.equal(key in result,false);}
  const full=h.query({...q,budgetRGB:[0,0,0]});assert(full.supported);assert.equal(full.keptIDs.length,64);assert.equal(full.omittedIDs.length,0);return{unsupportedResultsExposeNoPartialSelection:true,zeroBudgetRetained:full.keptIDs.length};
});
check('Synthetic numeric-domain rejection handles non-SPD/asymmetry/negative extinction/duplicate IDs and nonfinite rays',()=>{
  for(const mutate of [s=>s.packets[0].covariance[0]=-1,s=>s.packets[0].covariance[1]=.01,s=>s.profiles[0].extinctionPerMassRGB[0]=-1,s=>s.packets[1].id=s.packets[0].id,s=>s.packets[0].mass=Infinity,s=>s.packets[0].mass=Number.MIN_VALUE,s=>s.profiles[0].extinctionPerMassRGB[0]=Number.MIN_VALUE]){const s=snapshot(16,'inside');mutate(s);assert.throws(()=>createSyntheticGaussianHierarchy(s));}const h=createSyntheticGaussianHierarchy(snapshot(16,'inside'));assert.throws(()=>h.query({origin:[NaN,0,0],end:[0,0,1]}));assert.throws(()=>h.query({origin:[0,0,0],end:[0,0,1],budgetRGB:[-1,0,0]}));return{invalidInputsRejected:true,subnormalPositiveInputsRejected:true};
});
check('Moment-preserving thin-gap replacement is not covered by one-sided omission bounds',()=>{
  const p={mass:2*Math.PI,mean:[0,0,0],covariance:[101,0,0,0,1,0,0,0,1]},left={...p,mass:Math.PI,mean:[-10,0,0],covariance:[1,0,0,0,1,0,0,0,1]},right={...left,mean:[10,0,0]},o=[0,0,-50],e=[0,0,50],fine=densePacketColumn(left,o,e).column+densePacketColumn(right,o,e).column,proxy=densePacketColumn(p,o,e).column,error=Math.exp(-fine)-Math.exp(-proxy);assert(Math.abs(fine-Math.exp(-50))<1e-28);assert(Math.abs(proxy-1/Math.sqrt(101))<1e-12);assert(error>.09);return{fineTau:fine,proxyTau:proxy,TError:error,totalMassAndSpatialMomentsEqual:true,oneSidedOmissionContractApplicable:false};
});
check('Retained independent90-digit short-ray conditioning counterexample is rejected before normalization/publication',()=>{
  const input=JSON.parse(fs.readFileSync(new URL('./r24-sparse-independent-conditioning-witness-input.json',import.meta.url),'utf8')),prior=JSON.parse(fs.readFileSync(new URL('./r24-sparse-independent-conditioning-witness.json',import.meta.url),'utf8'));
  const s={revision:1,profiles:[{id:'edge',extinctionPerMassRGB:input.extinction}],packets:[{id:'witness',profileId:'edge',mass:input.mass,mean:[0,0,0],covariance:input.covariance}]};
  assert(prior.approxTauBoundGap>0,'preserve the original failed numerical-domain evidence');assert.throws(()=>createSyntheticGaussianHierarchy(s),/conditioning\/cancellation/);
  const metadata=cases.flatMap(c=>[c.build]);assert(metadata.every(v=>v.maximumConditionProxy<=65536&&v.maximumPivotCancellationRatio<=131072));
  return{oldBound:prior.helperResult.omittedBoundRGB[0],highPrecisionTau:input.highPrecisionTau,oldUnderbound:prior.approxTauBoundGap,highPrecisionDigits:input.highPrecisionDigits,newStatus:'rejected before amplitude/query publication',maxConditionProxy:65536,maxPivotCancellationRatio:131072,originalRelativeMarginUnchanged:1e-10,scope:'Rejection regression, not a proof of all remaining floating-point inputs'};
});
check('Conditioning threshold is exercised on both sides without changing the optical safety margin',()=>{
  const epsilonFor=C=>4/(C-5+Math.sqrt((C-5)**2-16)),make=target=>({revision:1,profiles:[{id:'edge',extinctionPerMassRGB:[1,1,1]}],packets:[{id:'edge-packet',profileId:'edge',mass:.1,mean:[0,0,0],covariance:[epsilonFor(target),0,0,0,1,0,0,0,1]}]});
  const below=65536*(1-1e-6),above=65536*(1+1e-6),accepted=createSyntheticGaussianHierarchy(make(below));assert(accepted.build.maximumConditionProxy<65536);assert.throws(()=>createSyntheticGaussianHierarchy(make(above)),/conditioning\/cancellation/);
  return{threshold:65536,belowTarget:below,acceptedComputedProxy:accepted.build.maximumConditionProxy,aboveTarget:above,statusAbove:'rejected',originalRelativeMarginUnchanged:1e-10,scope:'Domain threshold behavior, not universal error certification'};
});
const columnsSource=fs.readFileSync(new URL('../pyro-smoke-columns.js',import.meta.url),'utf8');
const report={schema:'glass-atoll.r24-sparse-gaussian-synthetic-cpu.v2',dateUTC:new Date().toISOString(),actualGPU:false,productionImported:false,nativeSnapshotUsed:false,numericCertificate:false,captureMemoryGuard:false,passed:checks.every(c=>c.passed),counts:{passed:checks.filter(c=>c.passed).length,total:checks.length},checks,cases,sourceSHA256:sha(fs.readFileSync(new URL('./r24-sparse-gaussian-hierarchy.js',import.meta.url))),runnerSHA256:sha(fs.readFileSync(import.meta.url.startsWith('file:')?new URL(import.meta.url):import.meta.url)),priorInsufficientDomain:{archive:'baselines/r24-sparse-before-conditioning-rejection/',helperSHA256:'20c7d5a8320b5efb02ff60b8460e71081c598e8aec9605ee306b165ab2086cf2',reported:'7/7 fixture checks; disproved as accepted-domain bound by independent90-digit short-ray covariance counterexample',counterexampleInput:'r24-sparse-independent-conditioning-witness-input.json',counterexampleReport:'r24-sparse-independent-conditioning-witness.json'},existingCPUColumns:{SHA256:sha(columnsSource),alreadyHas:'5-sigma packet-AABB BVH, refit/rebuild, RGB omission budgets, scalar/full finite Gaussian kernels, origin cache and per-query kernel counters',difference:'This synthetic mean-AABB selector only returns original candidate IDs and a tail-bound witness; it does not replace or newly invent the existing CPU accelerator. A future existing-BVH candidate export is an alternative, with CPU traversal/packing/GPU list costs requiring measurement.'},limits:['Only controlled small-schema synthetic16/64/128 packet fixtures; full structuredClone is not a bounded arbitrary nested-payload/profile-count ingestion guard.','No native snapshot, source count study or scene/GPU benchmark.','Original minimum-pivot domain failed independent high-precision falsification; the current condition/cancellation rejection narrows it without changing the1e-10 margin.','Real-arithmetic bound plus declared ULP/relative/distance margins, numerically falsified against independent direct-density quadrature; no universal binary64/Float32 or transcendental interval certificate.','Full physical copies/IDs/profiles/mass are retained. Approximate omission changes evaluated optics, not physical material.','Times are one-run CPU diagnostics including allocation/JIT effects; fewer retained kernels does not imply lower CPU/GPU/frame time.','Current capacity limits are this validation round boundary, not a permanent user constraint. Later calibrated aggregate budgets could be admitted through separate bounded gates.','No production imports/renderer/context/canvas; selector and witness live under verification only.']};
fs.writeFileSync(new URL('./r24-sparse-gaussian-witness.json',import.meta.url),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({passed:report.passed,counts:report.counts,failed:checks.filter(c=>!c.passed),summary:checks[1].evidence,sourceSHA256:report.sourceSHA256},null,2));if(!report.passed)process.exitCode=1;
