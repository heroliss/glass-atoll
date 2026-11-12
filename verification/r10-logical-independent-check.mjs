import assert from 'node:assert/strict';
import {readFileSync,writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {createFireworkEvent,FIREWORK_TYPES} from '../fireworks-physics.js';
import {describeFireworkCombustion} from '../fireworks-combustion.js';
import {buildLogicalBurnProfile,createLogicalBurnCursor,logicalBurnCell} from '../pyro-smoke-logical-burn.js';

// Independent pure-scheduler checks. No production provider, renderer, state
// queue, source-moment implementation or author test helper is imported.
const moduleURL=new URL('../pyro-smoke-logical-burn.js',import.meta.url);
const sha=()=>createHash('sha256').update(readFileSync(moduleURL)).digest('hex');
const frozen='235dff6244215b5a599d3d80ea93321ccacefb8d690a07813f0c25b827800a15';
const graph=(type,seed=7,time=0)=>describeFireworkCombustion(createFireworkEvent({type,seed,time,origin:[29,1.477,7]}));
const sum=xs=>xs.reduce((a,b)=>a+b,0);
const near=(a,b)=>assert(Math.abs(a-b)<=2e-11*Math.max(1,Math.abs(a),Math.abs(b)),`${a} != ${b}`);
const balance=d=>near(d.allocated,d.materialized+d.reserved+d.cancelled);
const checks=[];
function check(name,fn){try{checks.push({name,passed:true,evidence:fn()});}catch(e){checks.push({name,passed:false,error:String(e.stack||e)});}}
function cells(p){return p.streams.flatMap((s,i)=>Array.from({length:s.count},(_,k)=>logicalBurnCell(p,i,k))).sort((a,b)=>a.time-b.time||(a.key<b.key?-1:a.key>b.key?1:0));}
const end=p=>Math.max(...p.streams.map((s,i)=>logicalBurnCell(p,i,s.count-1).time));

check('reviewed frozen module exactly matches235dff',()=>{assert.equal(sha(),frozen);});
check('G2 native body coverage and family budgets contain every source without representative slots',()=>{
 let cases=0,bodies=0;
 for(const t of FIREWORK_TYPES)for(const seed of [7,123456]){
  const g=graph(t.id,seed),p=buildLogicalBurnProfile(g),burn=p.streams.filter(s=>s.mode==='burn');
  const actual=g.nodes.filter(n=>['aerial-root','aerial-child','ground-comet'].includes(n.role));
  assert.deepEqual(burn.map(s=>s.bodyId).sort((a,b)=>a-b),actual.map(n=>n.bodyId).sort((a,b)=>a-b));
  assert.equal(new Set(burn.map(s=>s.sourceID)).size,actual.length);
  assert(burn.every(s=>s.mass>0));near(sum(p.streams.map(s=>s.mass)),p.budget.total);
  const families=new Map();for(const s of burn){const a=families.get(s.familyID)||[];a.push(s);families.set(s.familyID,a);}
  for(const members of families.values())near(sum(members.map(s=>s.mass)),members[0].familyMass);
  if(t.id==='fan')for(const lift of p.streams.filter(s=>s.role==='lift'))near(lift.mass+sum(burn.filter(s=>s.parentSourceID===lift.sourceID).map(s=>s.mass)),.1);
  cases++;bodies+=actual.length;
 }
 return{nativeCases:cases,bodies};
});
check('G3 arbitrary batches and exact parent death boundary equal whole-event sorted sequence',()=>{
 let cases=0,callbacks=0,childBodies=0;
 for(const type of ['crossette','fan','bouquet','willow'])for(const origin of [0,4000]){
  const g=graph(type,7,origin),p=buildLogicalBurnProfile(g),all=cells(p),c=createLogicalBurnCursor(p),log=[];
  const nodes=new Map(g.nodes.map(n=>[n.sourceID,n]));
  const times=[origin,origin+.003,origin+.087,origin+.601];
  for(const n of g.nodes)if(n.role==='aerial-root'&&g.type==='crossette')times.push(n.endTime);
  for(let t=origin+.709;t<end(p);t+=.173)times.push(t);
  times.push(end(p));
  for(const time of [...new Set(times)].sort((a,b)=>a-b)){
   if(time<origin||time>end(p))continue;
   const token=c.prepare({throughTime:time,sampleCell:cell=>{
    assert(cell.time<=time);const n=nodes.get(cell.sourceID);assert(n);
    if(cell.mode==='burn'){assert(cell.start>=n.birth);assert(cell.end<=n.endTime);assert(cell.start<cell.end);if(n.role==='aerial-child')childBodies++;}
    callbacks++;return cell.key;
   }});log.push(...token.cells);c.commit(token);balance(c.diagnostics());
  }
  assert.deepEqual(log,all);assert.equal(log.length,p.cellCount);assert.equal(c.diagnostics().reserved,0);cases++;
 }
 return{cases,callbacks,childCellCallbacks:childBodies};
});
check('G3 tiny final cells retain exact end and positive full mass at physical origin4000',()=>{
 let cases=0,rebalanced=0;
 for(const origin of [0,4000])for(const delta of [-1e-9,-1e-14,0,1e-14,1e-9,1e-6])for(const periods of [1,3,17]){
  const g=structuredClone(graph('palm',7,origin)),n=g.nodes.find(n=>n.role==='aerial-root');
  const first=.1+.2*((Math.imul(n.bodyId,2654435761)+1013904223)>>>0)/2**32;
  n.life=first+periods*.30+delta;n.endTime=n.birth+n.life;g.endTime=Math.max(g.endTime,n.endTime);
  const p=buildLogicalBurnProfile(g),i=p.streams.findIndex(s=>s.bodyId===n.bodyId),s=p.streams[i];let last=n.birth,mass=0;
  for(let k=0;k<s.count;k++){const a=logicalBurnCell(p,i,k);assert.equal(a.start,last);assert(a.end>a.start&&a.end-a.start<=.30000001);assert(a.mass>0);mass+=a.mass;last=a.end;}
  assert.equal(last,n.endTime);near(mass,s.mass);if(s.penultimateAge!==null)rebalanced++;cases++;
 }
 return{cases,rebalanced};
});
check('G4 accepted-prefix boundaries cannot replay after fault clear or foreign clone',()=>{
 const p=buildLogicalBurnProfile(graph('crossette',7)),all=cells(p),counts=[0,1,9,12,all.findIndex(a=>a.role==='aerial-child'),all.length-1];
 let cases=0;
 for(const acceptedCount of counts){
  assert(acceptedCount>=0);const c=createLogicalBurnCursor(p),token=c.prepare({throughTime:end(p)}),copy=c.clone();
  assert.throws(()=>copy.commit(token));const d=c.commit(token,{acceptedCount});
  near(d.materialized,sum(all.slice(0,acceptedCount).map(a=>a.mass)));balance(d);assert(d.fault);
  assert.throws(()=>c.prepare({throughTime:end(p)+1}));assert.throws(()=>c.commit(token));
  const clonedFault=c.clone();assert.deepEqual(clonedFault.diagnostics(),d);
  const cleared=c.clear(end(p)+1);balance(cleared);assert.equal(cleared.reserved,0);assert.equal(cleared.remainingCells,0);
  assert.throws(()=>c.prepare({throughTime:end(p)+1000}));assert.throws(()=>c.commit(token));
  assert.deepEqual(c.clear(end(p)+2),cleared);assert.deepEqual(clonedFault.diagnostics(),d);
  cases++;
 }
 return{cases,partialCounts:counts};
});
check('G4 predictable sampling failure is local-readonly and leaves prior token valid',()=>{
 const c=createLogicalBurnCursor(buildLogicalBurnProfile(graph('palm',7))),a=c.prepare({throughTime:.1}),before=c.diagnostics();let calls=0;
 assert.throws(()=>c.prepare({throughTime:20,sampleCell:()=>{if(++calls===7)throw new Error('independent provider fault');return{ready:true};}}),/independent provider fault/);
 assert.deepEqual(c.diagnostics(),before);c.commit(a);balance(c.diagnostics());
 const old=c.diagnostics(),bad=c.prepare({throughTime:20});assert.throws(()=>c.commit(bad,{acceptedCount:NaN}));assert.deepEqual(c.diagnostics(),old);
 c.commit(bad);near(c.diagnostics().materialized,c.profile.budget.total);
 return{sampleCallsBeforeFailure:calls};
});
check('same event can be rebuilt in pure module: outer tombstone is a required G4 scope boundary',()=>{
 const g=graph('palm',7),p=buildLogicalBurnProfile(g),a=createLogicalBurnCursor(p);a.clear(1);
 const b=createLogicalBurnCursor(buildLogicalBurnProfile(g)),t=b.prepare({throughTime:1});assert(t.readyCount>0);b.commit(t);
 assert(b.diagnostics().materialized>0);
 return{notAnIntegratedDeduper:true,requiredOwner:'adapter/host event-ID watermark and tombstone; no assertion of G4 completion from pure module'};
});
check('review did not mutate the frozen module',()=>{assert.equal(sha(),frozen);});
const report={schema:'glass-atoll.r10-logical-independent-cpu.v1',actualGPU:false,productionIntegrated:false,moduleSHA256:sha(),checks,counts:{passed:checks.filter(c=>c.passed).length,total:checks.length},limits:['G2/G3 and the local cursor portion of G4 only. No source provider or physical queue transaction is exercised.','No cross-event seen/tombstone, global EmissionID owner, descriptor release or host clear protocol is implemented by this pure module.','Callbacks must remain readonly. Local cursor rollback cannot undo caller side effects.','No kg/yield, visual quality, real smoke transport or GPU/FPS validation.'],dateUTC:new Date().toISOString()};
report.passed=report.checks.every(c=>c.passed);
writeFileSync(new URL('./r10-logical-independent-check.json',import.meta.url),JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({passed:report.passed,counts:report.counts,moduleSHA256:report.moduleSHA256,failures:checks.filter(c=>!c.passed)},null,2));
process.exitCode=report.passed?0:1;
