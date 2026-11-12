import assert from 'node:assert/strict';
import {readFileSync,writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import * as THREE from '../../vendor/three.module.js';
import {createFireworks,describeFireworkCombustion} from '../../fireworks.js';
import {createFireworkEvent,FIREWORK_TYPES,sampleBody} from '../../fireworks-physics.js';
import {pastSegmentSourceMoments,createSourceWindHistory,appendSourceWindHistory,SMOKE_SOURCE_TRANSPORT} from '../../pyro-smoke-source-moments.js';
import {buildBurnProfile,createBurnCursor,burnCell} from './burn-profile-prototype.mjs';
const paths=['fireworks.js','fireworks-physics.js','fireworks-combustion.js','pyro-smoke-ring-burn.js','pyro-smoke-trajectory-events.js','pyro-smoke-state.js','fireworks-audio.js'];
const root=new URL('../../',import.meta.url),sha=path=>createHash('sha256').update(readFileSync(new URL(path,root))).digest('hex'),before=Object.fromEntries(paths.map(p=>[p,sha(p)]));
const adapter=readFileSync(new URL('pyro-smoke-trajectory-events.js',root),'utf8'),chooserStart=adapter.indexOf('function chooseRoots('),chooserEnd=adapter.indexOf('function makeEntry(',chooserStart),distanceStart=adapter.indexOf('const dist2=');
assert(chooserStart>=0&&chooserEnd>chooserStart&&distanceStart>=0);
const actualChooseRoots=new Function(adapter.slice(distanceStart,adapter.indexOf('\n',distanceStart))+adapter.slice(chooserStart,chooserEnd)+';return chooseRoots;')();
const checks=[],counts=[],sum=a=>a.reduce((x,y)=>x+y,0),close=(a,b,tol=1e-11)=>assert(Math.abs(a-b)<=tol*Math.max(1,Math.abs(a),Math.abs(b)),a+' vs '+b);
function event(type='ring',seed=42,options={}){const e=createFireworkEvent({type,seed,time:10,origin:[29,1.477,7],elevation:80,...options});return {e,g:describeFireworkCombustion(e)};}
function check(name,fn){try{checks.push({name,passed:true,evidence:fn()});}catch(error){checks.push({name,passed:false,error:String(error.stack||error)});}}
function ledger(d){close(d.allocated,d.materialized+d.cancelled+d.reserved);}
check('all10 actual logical graphs retain type totals, all burn bodies, and finite bounded cells',()=>{
  for(const t of FIREWORK_TYPES)for(const seed of [1,42,999]){const {g}=event(t.id,seed),p=buildBurnProfile(g),expected=t.id==='fan'?.9:t.id==='bouquet'?2:20.35;
    close(p.budget.total,expected);close(sum(p.streams.map(s=>s.mass)),expected);assert.equal(p.streams.filter(s=>s.mode==='burn').length,g.counts.bodies);assert(p.cellCount<32768);
    let maximumCell=0;for(const s of p.streams){close(sum(s.masses),s.mass);for(let i=0;i<s.count;i++){const c=burnCell(p,s,i);assert(c.mass>0);assert(Number.isFinite(c.time));if(c.kind==='burn'){assert(c.start>=s.birth&&c.end<=s.endTime);assert(c.end>c.start);maximumCell=Math.max(maximumCell,c.end-c.start);assert(c.end-c.start<=.30000001);}}}
    if(seed===42){const bodies=p.streams.filter(s=>s.mode==='burn'),e=event(t.id,seed).e,selected=actualChooseRoots({roots:e.heads.filter(b=>!b.parentBody).map(b=>({id:b.id,birth:b.birth,life:b.life,baseVelocity:b.baseVelocity,patternPart:b.patternPart})),baselineVelocity:e.baselineBurst.velocity},48),familyIDs=new Set(selected.map(s=>g.nodes.find(n=>n.bodyId===s.bodyId).familyID)),subset=p.streams.filter(s=>s.mode==='trigger'||familyIDs.has(s.familyID));
      const bins=new Map();let lastBirth=-Infinity;for(const s of p.streams)for(let i=0;i<s.count;i++){const c=burnCell(p,s,i),key=Math.ceil((c.time-e.time)/.05);bins.set(key,(bins.get(key)||0)+1);lastBirth=Math.max(lastBirth,c.time);}
      counts.push({type:t.id,logicalBodies:g.counts.bodies,families:new Set(bodies.map(s=>s.familyID)).size,allLogicalCells:p.cellCount,selected48FamilyCells:sum(subset.map(s=>s.count)),selectedFamilies:selected.length,selectedLogicalBodies:subset.filter(s=>s.mode==='burn').length,subsetScope:'count-only existing spatial root chooser; not an implemented grouped matter/temporal oracle',maximumDuePerAligned20HzTick:Math.max(...bins.values()),lastBirthBeforeEventRetirementSeconds:e.endTime-lastBirth,totalReferenceMass:expected,bodyMass:p.budget.bodies,triggerMass:p.budget.launch+p.budget.central,lifeRange:[Math.min(...bodies.map(s=>s.life)),Math.max(...bodies.map(s=>s.life))],maximumCell});}}
  return{events:30,table:counts};
});
check('crossette one family budget follows parent and four children rather than five new budgets',()=>{
  const {g}=event('crossette'),p=buildBurnProfile(g),families=new Map();for(const s of p.streams.filter(s=>s.mode==='burn')){const a=families.get(s.familyID)||[];a.push(s);families.set(s.familyID,a);}
  for(const a of families.values()){assert.equal(a.length,5);const parent=a.find(s=>s.role==='aerial-root'),children=a.filter(s=>s.role==='aerial-child');assert.equal(parent.life,.78);close(sum(a.map(s=>s.mass)),19/36);for(const c of children){assert.equal(c.birth,parent.endTime);assert.equal(c.pathShare,.25);close(c.mass/c.life,(parent.mass/parent.life)/4);}}
  return{families:families.size,parents:36,children:144,childPathShare:.25,sourceYield:'authored allocation only, unknown fuel remains unknown'};
});
check('ground reallocates existing launch total, never adds ground comet mass on top',()=>{
  for(const type of ['fan','bouquet']){const {g}=event(type),p=buildBurnProfile(g);assert.equal(p.budget.central,0);close(p.budget.launch,p.budget.total*.1);close(p.budget.bodies,p.budget.total*.9);assert.equal(p.streams.filter(s=>s.mode==='burn').length,g.counts.roles['ground-comet']);assert(p.streams.every(s=>s.role!=='burst'&&s.role!=='mortar-carrier'));}
  return{fan:{total:.9,lift:.09,comets:.81},bouquet:{total:2,lift:.2,comets:1.8},groundChargeFraction:'author candidate .10, not measured'};
});
check('early phases materialize only past burn cells while exact remaining budget stays reserved',()=>{
  const {e,g}=event(),p=buildBurnProfile(g),cursor=createBurnCursor(p),samples=[];
  for(const phase of [.35,.65,1.1,2,4.1]){const t=e.burstTime+phase,token=cursor.prepare({throughTime:t});assert(token.cells.every(c=>c.time<=t));cursor.commit(token);const d=cursor.diagnostics();ledger(d);samples.push({phase,...d});}
  assert(samples[0].reserved>samples[2].reserved);assert(samples[2].reserved>0);close(samples.at(-1).reserved,0);close(samples.at(-1).materialized,20.35);return samples;
});
check('30/60/120Hz produce exactly the same cells and causal physical sample positions',()=>{
  const runs=[];for(const hz of [30,60,120]){const {e,g}=event('crossette'),p=buildBurnProfile(g),cursor=createBurnCursor(p),rows=[],timeline=[{time:0,wind:[0,0,0]}];
    const sampleCell=(c,now)=>{assert(c.time<=now);if(c.kind==='trigger')return null;const t=c.start+(c.end-c.start)*.5,b=e.heads.find(b=>b.id===c.bodyId);assert(t>=b.birth&&t<b.birth+b.life&&t<=now);return sampleBody(b,t,timeline).position;};
    const stop=e.endTime+.1;for(let i=0;i<=Math.ceil((stop-e.time)*hz);i++){const token=cursor.prepare({throughTime:Math.min(stop,e.time+i/hz),sampleCell});token.cells.forEach((c,j)=>rows.push([c.key,c.mass,c.start,c.end,token.samples[j]]));cursor.commit(token);}const d=cursor.diagnostics();ledger(d);close(d.materialized,20.35);runs.push(rows);}
  assert.deepEqual(runs[1],runs[0]);assert.deepEqual(runs[2],runs[0]);return{rates:[30,60,120],identicalCells:runs[0].length,bodySampling:'actual sampleBody at fixed interior clocks; no future XYZ plan'};
});
check('prepared sample failure and clear keep the scheduler budget transactional',()=>{
  const {e,g}=event(),p=buildBurnProfile(g),cursor=createBurnCursor(p),start=cursor.diagnostics();let sampled=0;
  assert.throws(()=>cursor.prepare({throughTime:e.burstTime+1.1,sampleCell(){if(++sampled===7)throw Error('provider lost history');return null;}}),/lost history/);assert.deepEqual(cursor.diagnostics(),start);
  const token=cursor.prepare({throughTime:e.burstTime+.35});cursor.commit(token);const old=cursor.diagnostics(),pending=cursor.prepare({throughTime:e.burstTime+.65});const cleared=cursor.clear(e.burstTime+.35);ledger(cleared);close(cleared.cancelled,old.reserved);assert.equal(cleared.reserved,0);assert.throws(()=>cursor.commit(pending),/Stale/);assert.throws(()=>cursor.prepare({throughTime:e.endTime}),/Closed/);return{sampleFailureLeavesCursorUntouched:true,cancelled:cleared.cancelled,alreadyMaterialized:cleared.materialized};
});
check('same past GL5/fullSPD thermal and held-wind closure supports a real child cell',()=>{
  const {e,g}=event('crossette'),p=buildBurnProfile(g),stream=p.streams.find(s=>s.role==='aerial-child'),c=burnCell(p,stream,0),body=e.heads.find(b=>b.id===c.bodyId);
  let history=createSourceWindHistory({time:e.time,wind:[1.8,0,.3]});history=appendSourceWindHistory(history,{time:c.start+.03,windVector:[3,0,-1],retainFrom:e.time});history=appendSourceWindHistory(history,{time:c.end,windVector:[3,0,-1],retainFrom:e.time});let n=0;
  const moments=pastSegmentSourceMoments({start:c.start,end:c.end,mass:c.mass,windHistory:history,transport:{...SMOKE_SOURCE_TRANSPORT,dispersionModel:'taylor',lagrangianSeconds:10},samplePosition:t=>{assert(t>=c.start&&t<c.end);n++;return sampleBody(body,t,history.samples).position;}});
  assert.equal(n,5);assert.equal(moments.mass,c.mass);assert(moments.mean.every(Number.isFinite));const a=moments.covariance,det=a[0]*(a[4]*a[8]-a[5]*a[7])-a[1]*(a[3]*a[8]-a[5]*a[6])+a[2]*(a[3]*a[7]-a[4]*a[6]);assert(a[0]>0&&a[0]*a[4]-a[1]*a[3]>0&&det>0);return{GL5:n,positiveDeterminant:det,dispersionQ:moments.dispersionQ,mean:moments.mean,scope:'same delayed finite cell; not continuous CFD'};
});
check('I, colour and strobe do not assign smoke mass or add render-tail entities',()=>{
  for(const type of ['ring','strobe','crossette']){const a=event(type,42,{intensityScale:0,palette:'blue'}),b=event(type,42,{intensityScale:16,palette:'red'});assert.deepEqual(buildBurnProfile(a.g),buildBurnProfile(b.g));}
  const json=JSON.stringify(buildBurnProfile(event().g));for(const key of ['"position"','"velocity"','"intensity"','"colour"','"shutter"'])assert(!json.includes(key),key);
});
check('current production provider really rejects child sampling; prototype does not hide integration gap',()=>{
  const f=createFireworks(THREE);try{f.configure({autoLaunch:false});f.update({time:0,windVector:[0,0,0]});const launch=f.launch({type:'crossette',seed:42}),g=f.smokeSourceProvider.describeCombustion(launch.id),child=g.nodes.find(n=>n.role==='aerial-child');f.update({time:child.birth+.1,windVector:[0,0,0]});assert.throws(()=>f.smokeSourceProvider.sample(launch.id,{kind:'root',bodyId:child.bodyId,time:child.birth+.05}),/existing burning root/);return{metadataChildren:g.counts.roles['aerial-child'],productionChildSamplingSupported:false};}finally{f.dispose();}
});
check('complete capacity failure is explicit, and runtime source bytes remain untouched',()=>{
  assert.throws(()=>buildBurnProfile(event('willow').g,{maxCells:100}),/no source was truncated/);assert.throws(()=>buildBurnProfile(event().g,{maxCellSeconds:.4}),/GL5/);assert.throws(()=>buildBurnProfile(event().g,{groundChargeFraction:1.2}),/in0/);
  assert.deepEqual(Object.fromEntries(paths.map(p=>[p,sha(p)])),before);return{productionFilesChecked:paths.length,changes:0};
});
const report={schema:'glass-atoll.generic-burn-profile-QA.v1',dateUTC:new Date().toISOString(),passed:checks.every(c=>c.passed),counts:{passed:checks.filter(c=>c.passed).length,total:checks.length},checks,typeCounts:counts,sourceSHA256:before,prototypeSHA256:sha('verification/fireworks/burn-profile-prototype.mjs'),actualGPU:false,
  limits:['All logical bodies sampled in this prototype; no production representative compression, emission queue or visual acceptance.','Equal family budget, branch-share and ground charge fraction are declared author choices, not measured smoke yields.','Source cells use native burn life; submerged extinguishing, incoming self-shadow, shear/turbulence and ground boundaries remain unsolved.','Full-event cell counts are density/storage pressure, not GPU timings or scene FPS. Existing 4096 density and field pair cap require a separate explicit policy before integration.']};
writeFileSync(new URL('./burn-profile-prototype-check.json',import.meta.url),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({passed:report.passed,counts:report.counts,typeCounts:counts,prototypeSHA256:report.prototypeSHA256,failed:checks.filter(c=>!c.passed)},null,2));if(!report.passed)process.exitCode=1;
