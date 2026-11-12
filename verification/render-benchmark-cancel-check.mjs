// Actual module protocol with a deterministic clock/timer boundary, not a GPU benchmark.
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import vm from 'node:vm';
const source=readFileSync(new URL('../render-benchmark.js',import.meta.url),'utf8');
const baseline=readFileSync(new URL('./baselines/render-benchmark-before-interruption/render-benchmark.js',import.meta.url),'utf8');
const checks=[];
const plain=value=>JSON.parse(JSON.stringify(value));
function fixture(code=source,{snapshotThrowsAfterInitial=false}={}){
  let now=1000,next=1,snapshots=0;const timers=new Map(),cleared=[];
  const scope={performance:{now:()=>now},setTimeout(fn,ms){const id=next++;timers.set(id,{fn,due:now+ms,ms});return id;},clearTimeout(id){cleared.push(id);timers.delete(id);},Date:class{toISOString(){return '2026-10-28T00:00:00.000Z';}}};
  const factory=vm.runInNewContext(code.replace('export function createRenderBenchmark','function createRenderBenchmark')+';createRenderBenchmark;',scope);
  const benchmark=factory(()=>{snapshots++;if(snapshotThrowsAfterInitial&&snapshots>1)throw Error('Snapshot must not run after context interruption');return {snapshot:snapshots};});
  return {benchmark,timers,cleared,get snapshots(){return snapshots;},setNow(value){now=value;},fire(){const [id,timer]=[...timers][0]||[];assert(timer,'expected scheduled timeout');timers.delete(id);now=timer.due;timer.fn();}};
}
async function check(name,fn){try{const evidence=await fn();checks.push({name,passed:true,evidence});}catch(error){checks.push({name,passed:false,error:String(error.stack||error)});}}
await check('normal completion preserves every historical report field and statistic',async()=>{
  const results=[];
  for(const code of [baseline,source]){const f=fixture(code),b=f.benchmark,p=b.start(8);assert(b.active);b.frame(1000,3);b.frame(1016,4);b.frame(1033,5);b.gpu(2.5);b.gpu(NaN);f.fire();const r=plain(await p);assert(!b.active);assert.equal(f.timers.size,0);assert.equal(f.snapshots,2);results.push(r);}
  const [old,current]=results;for(const key of Object.keys(old))assert.deepEqual(current[key],old[key],key);
  assert.equal(current.status,'completed');assert.equal(current.validity,'valid');assert.equal(current.reason,null);
  return{legacyFieldsCompared:Object.keys(old),frames:current.frames,averageFps:current.averageFps};
});
await check('cancel returns invalid partial evidence with no FPS claim and no terminal snapshot',async()=>{
  const f=fixture(source,{snapshotThrowsAfterInitial:true}),b=f.benchmark,p=b.start(8);b.frame(1000,3);b.frame(1017,5);b.gpu(2.75);f.setNow(1450);
  assert.equal(b.cancel('webgl-context-lost'),true);const r=plain(await p);
  assert.equal(r.status,'cancelled');assert.equal(r.validity,'invalid');assert.equal(r.reason,'webgl-context-lost');assert.equal(r.averageFps,null);assert.equal(r.final,null);
  assert.equal(r.frames,1);assert.equal(r.cpuMs.count,2);assert.equal(r.gpuMs.mean,2.75);assert.equal(r.elapsedSeconds,.45);assert.equal(f.snapshots,1);assert.equal(f.timers.size,0);assert(!b.active);
  return{partialFrames:r.frames,finalSnapshotCalled:false,averageFps:r.averageFps};
});
await check('repeated cancel resolves once and leaves no pending timeout',async()=>{
  const f=fixture(),b=f.benchmark,p=b.start();let resolutions=0;p.then(()=>resolutions++);
  assert.equal(b.cancel('first'),true);assert.equal(b.cancel('second'),false);assert.equal(b.cancel(),false);const r=await p;await Promise.resolve();assert.equal(resolutions,1);assert.equal(r.reason,'first');assert.equal(f.timers.size,0);
});
await check('cancel before first frame is explicit, bounded, and serializable',async()=>{
  const f=fixture(),b=f.benchmark,p=b.start();assert.equal(b.cancel(),true);const r=await p;
  assert.equal(r.reason,'cancelled');assert.equal(r.frames,0);assert.equal(r.frameMs,null);assert.equal(r.gpuMs,null);assert.equal(r.cpuMs,null);assert.equal(r.averageFps,null);assert.doesNotThrow(()=>JSON.stringify(r));
  assert(!('resolve'in r.raw));assert(!('timeout'in r.raw));assert.equal(f.timers.size,0);
});
await check('a stale cancelled timeout cannot finish or cancel a subsequent run',async()=>{
  const f=fixture(),b=f.benchmark,old=b.start(),stale=[...f.timers.values()][0].fn;b.cancel('old');await old;
  const next=b.start(3);let settled=false;next.then(()=>settled=true);stale();await Promise.resolve();assert.equal(settled,false);assert.equal(b.active,true);assert.equal(f.timers.size,1);
  b.frame(1000,2);b.frame(1010,2);f.fire();const r=await next;assert.equal(r.status,'completed');assert.equal(r.frames,1);assert.equal(f.timers.size,0);
});
await check('completion followed by cancel cannot resolve twice or mutate a settled report',async()=>{
  const f=fixture(),b=f.benchmark,p=b.start(3);let resolutions=0;p.then(()=>resolutions++);b.frame(1000,3);f.fire();const r=await p,before=JSON.stringify(r);
  assert.equal(b.cancel('too-late'),false);b.frame(5000,99);b.gpu(99);await Promise.resolve();assert.equal(resolutions,1);assert.equal(JSON.stringify(r),before);assert.equal(f.timers.size,0);
});
await check('concurrent start remains rejected without replacing its owner or timer',async()=>{
  const f=fixture(),b=f.benchmark,p=b.start(8);assert.throws(()=>b.start(5),/already active/);assert.equal(f.timers.size,1);assert.equal(f.snapshots,1);b.cancel('cleanup');await p;assert.equal(f.timers.size,0);
});
await check('historical duration clamp is preserved and cancellation clears long timers',async()=>{
  for(const [seconds,delay]of [[1,3000],[75,60000],[8,8000]]){const f=fixture(),p=f.benchmark.start(seconds);assert.equal([...f.timers.values()][0].ms,delay);f.benchmark.cancel('cleanup');await p;assert.equal(f.timers.size,0);}
});
const report={schema:'glass-atoll.render-benchmark-cancel-CPU.v1',dateUTC:new Date().toISOString(),passed:checks.every(c=>c.passed),counts:{passed:checks.filter(c=>c.passed).length,total:checks.length},checks,
  sourceSHA256:createHash('sha256').update(source).digest('hex'),baselineSHA256:createHash('sha256').update(baseline).digest('hex'),actualGPU:false,
  limits:['Tests the actual benchmark source and preserved baseline with deterministic clock/timer/snapshot seams.','No WebGL calls, context restoration, browser timing, renderer FPS or GPU-time accuracy is verified here.','Cancellation keeps partial raw statistics as invalid diagnostic evidence; averageFps and terminal snapshot are null.']};
writeFileSync(new URL('./render-benchmark-cancel-check.json',import.meta.url),JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({passed:report.passed,counts:report.counts,sourceSHA256:report.sourceSHA256,failed:checks.filter(c=>!c.passed)},null,2));if(!report.passed)process.exitCode=1;
