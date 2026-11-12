import fs from 'node:fs';import crypto from 'node:crypto';import assert from 'node:assert/strict';
import {Worker,isMainThread,parentPort,workerData}from'node:worker_threads';
import {createShorelineCPU}from'../shoreline-dynamics.js';
const root=new URL('../',import.meta.url),read=p=>fs.readFileSync(new URL(p,root),'utf8'),hash=s=>crypto.createHash('sha256').update(s).digest('hex');
const shoreX=-32.76647392500336,slope=.09409202003697943;
if(!isMainThread){
  const started=performance.now(),n=workerData.n,duration=18,center=[shoreX-.5,-1],size=[8,8],terrainHeight=(x,z)=>slope*(x-shoreX),s=createShorelineCPU({resolution:n,center,size,terrainHeight,boundaryRampSeconds:1,maxTicksPerAdvance:120}),samples=[];
  const clamp=(x,a,b)=>Math.max(a,Math.min(b,x)),probeI=clamp(Math.floor((shoreX-.3-(center[0]-4))/(8/n)),0,n-1),probeJ=Math.floor(n/2),wetHistory=[];
  for(let target=.1;target<duration+.05;target+=.1){const goal=Math.min(duration,Math.round(target*10)/10);let r;do{r=s.advanceFence(goal);}while(!r.completed);const p=s.snapshot();let front=-Infinity,dryMoist=0;
    for(let j=Math.floor(n*.35);j<Math.ceil(n*.65);j++)for(let i=0;i<n;i++){const k=j*n+i;if(p.h[k]>.002)front=Math.max(front,p.grid.minimumXZ[0]+(i+.5)*p.grid.cellSize[0]);if(p.bed[k]>0&&p.h[k]<.002&&p.wetness[k]>.1)dryMoist++;}
    const k=probeJ*n+probeI,u=p.h[k]>0?p.qx[k]/p.h[k]:0;samples.push({time:p.time,frontX:front,runupHeight:slope*(front-shoreX),velocityAtProbeMps:u,dryButMoistCells:dryMoist});
  }
  const warm=samples.filter(t=>t.time>4),positive=Math.max(...warm.map(t=>t.velocityAtProbeMps)),negative=Math.min(...warm.map(t=>t.velocityAtProbeMps)),d=s.diagnostics();
  parentPort.postMessage({n,dx:8/n,elapsedCpuMs:performance.now()-started,maximumRunupMetres:Math.max(...warm.map(t=>t.runupHeight)),minimumRunupMetres:Math.min(...warm.map(t=>t.runupHeight)),peakOnshoreMps:positive,peakOffshoreMps:negative,hasDryWetMemory:warm.some(t=>t.dryButMoistCells>0),ledger:d.ledger,maximumLastTickCfl:d.state.maxCFL,samples});s.dispose();
}else{
  const freeze={state:hash(read('shoreline-dynamics.js')),boundary:hash(read('shoreline-boundary.js'))},runs=[];
  async function job(n){return new Promise((resolve,reject)=>{const w=new Worker(new URL(import.meta.url),{workerData:{n}}),timer=setTimeout(()=>{w.terminate();resolve({n,completed:false,error:'bounded30s-worker-limit'});},30000);w.on('message',r=>{clearTimeout(timer);w.terminate();resolve({...r,completed:true});});w.on('error',e=>{clearTimeout(timer);reject(e);});});}
  for(const n of [32,64,96]){const r=await job(n);runs.push(r);console.log(JSON.stringify({...r,samples:undefined}));}
  const checks=[];const check=(name,fn)=>{try{checks.push({name,passed:true,evidence:fn()});}catch(e){checks.push({name,passed:false,error:String(e.stack||e)});}};
  check('all bounded2D plane runs finish with positive/runback flow and moving wet/dry history',()=>{for(const r of runs){assert(r.completed);assert(r.peakOnshoreMps>.02);assert(r.peakOffshoreMps<-.02);assert(r.maximumRunupMetres>0);assert(r.hasDryWetMemory);assert(Math.abs(r.ledger.residual)<1e-9);}return runs.map(({samples,...r})=>r);});
  check('last two plane grids expose bounded runup sensitivity without claiming photo calibration',()=>{const a=runs[1],b=runs[2],relative=Math.abs(a.maximumRunupMetres/b.maximumRunupMetres-1);assert(relative<.25);return{relative64To96PeakDifference:relative,criterion:.25,notes:'Provisional coarse numerical trend gate; not the proposed<=10% full-quality visual admission gate.'};});
  check('new source remains frozen throughout the bounded studies',()=>{assert.equal(hash(read('shoreline-dynamics.js')),freeze.state);assert.equal(hash(read('shoreline-boundary.js')),freeze.boundary);return freeze;});
  const report={schema:'glass-atoll.r13-shore-runup-check.v1',dateUTC:new Date().toISOString(),actualGPU:false,passed:checks.every(c=>c.passed),counts:{passed:checks.filter(c=>c.passed).length,total:checks.length},sourceSHA256:freeze,geometry:{shoreX,slope,sizeMetres:[8,8],notActual2DBathymetry:true},checks,runs,limits:['Exact native64-mode absolute-clock incident source; plane tangent surrogate, not a surveyed lagoon.','No full-quality192/256/3842D convergence run or GPU budget here.','Provisional25% coarse peak sensitivity must not be relabelled the final10% or photographic acceptance.','Foam/sand/water/caustics handoff is not integrated.']};
  fs.writeFileSync(new URL('r13-shore-runup-check.json',import.meta.url),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({passed:report.passed,counts:report.counts,failed:checks.filter(c=>!c.passed)},null,2));if(!report.passed)process.exitCode=1;
}
