// CPU/backend QA. Actual1200 cache reuse plus isolated SourceTextModule scheduler
// experiments. Mocked spawn cases NEVER invoke Python or alter asset contents.
import * as fs from 'node:fs/promises';
import * as child from 'node:child_process';
import {createHash} from 'node:crypto';
import path from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import vm from 'node:vm';
if(typeof vm.SourceTextModule!=='function'){
  const r=child.spawnSync(process.execPath,['--experimental-vm-modules',fileURLToPath(import.meta.url)],{stdio:'inherit',windowsHide:true});process.exit(r.status??1);
}
const ROOT=path.dirname(path.dirname(fileURLToPath(import.meta.url))),FILE=path.join(ROOT,'aces2-target-service.mjs'),CACHE=path.join(ROOT,'vendor','aces2-generated'),source=await fs.readFile(FILE,'utf8');
const sha=b=>createHash('sha256').update(b).digest('hex'),checks=[],report={schema:'glass-atoll.aces2-target-service-check.v1',dateUTC:new Date().toISOString(),actualCPU:true,actualGPU:false,checks,sourceSHA256:sha(source),limits:['ExistinglocalOCIO CPU export/cache integrity and backend scheduler/path contract only.','VM cases isolate the same service source with explicit spawn/filesystem adapters; they are not actual extra-peak exports.','No new GPU target was admitted or production output enabled.']};
const check=(name,passed,evidence={})=>checks.push({name,passed:!!passed,...evidence});
async function inventory(directory){const out={};for(const entry of await fs.readdir(directory,{withFileTypes:true})){const file=path.join(directory,entry.name);if(entry.isDirectory()){const nested=await inventory(file);for(const [k,v]of Object.entries(nested))out[entry.name+'/'+k]=v;}else if(entry.isFile())out[entry.name]=sha(await fs.readFile(file));else throw Error('Unexpected reference link');}return out;}
const oldBefore=await inventory(path.join(ROOT,'verification','aces2-generated-1200')),pinnedBefore=await inventory(path.join(ROOT,'vendor','aces2'));
const actual=await import(pathToFileURL(FILE).href);
for(const value of [99,10001,100.5,NaN,Infinity,'1200',null,{},[1200]]){let error;try{actual.ensureACES2Target(value);}catch(e){error=e;}check('reject invalid peak '+String(value),error?.code==='INVALID_PEAK');}
const first=actual.ensureACES2Target(1200),same=actual.ensureACES2Target(1200);check('actual in-flight samepeak exact Promise identity',first===same);
const a=await first,b=await actual.ensureACES2Target(1200);report.actual1200={firstCache:a.cache,secondCache:b.cache,assetBaseURL:b.assetBaseURL,descriptorURL:b.descriptorURL,descriptorSHA256:b.candidateDescriptorSHA256,artifactManifestSHA256:b.artifactManifestSHA256,readyMarkerSHA256:b.readyMarkerSHA256,cpu:b.cpuChecks,fixtures:b.fixtures,state:actual.getACES2TargetServiceState()};
check('actual1200 CPU14 and963 exact fixtures, no GPU admission',b.peakNits===1200&&b.cpuChecks.passed===14&&b.cpuChecks.total===14&&b.fixtures.sampleCount===963&&b.actualGPU===false&&b.gpuAdmission==='required'&&b.productionIntegrated===false);
check('actual1200 second request validates and reuses byteidentical package',b.cache.reused&&a.candidateDescriptorSHA256===b.candidateDescriptorSHA256&&a.artifactManifestSHA256===b.artifactManifestSHA256&&a.readyMarkerSHA256===b.readyMarkerSHA256);
const generated=await inventory(path.join(CACHE,'1200')),oldPackageOnly=Object.fromEntries(Object.entries(generated).filter(([name])=>name!=='ready.json'));
check('new1200 exporter package byteexact with preserved old research1200',JSON.stringify(Object.entries(oldPackageOnly).sort())===JSON.stringify(Object.entries(oldBefore).sort()),{files:Object.keys(oldPackageOnly).length});
check('actual queue idle and local lock released',actual.getACES2TargetServiceState().runningPeak===null&&actual.getACES2TargetServiceState().queuedPeaks.length===0&&!await fs.stat(path.join(CACHE,'.service.lock')).catch(()=>null));

async function isolated({mode='stop'}={}){
  const trace={spawns:[],active:0,maximumActive:0,writes:[],renames:[],unlinks:[]},virtual=new Map();
  const f={...fs};
  if(mode==='capacity')f.readdir=async (p,...args)=>p===CACHE?Array.from({length:12},(_,i)=>({name:String(200+i),isDirectory:()=>true,isSymbolicLink:()=>false})):fs.readdir(p,...args);
  if(mode==='corrupt'||mode==='ready-corrupt')f.readFile=async (p,...args)=>{const value=await fs.readFile(p,...args);if(p===path.join(CACHE,'1200',mode==='corrupt'?'aces2-1200-accurate-atan.glsl':'ready.json')){if(mode==='corrupt'){const bytes=Buffer.from(value);bytes[0]^=1;return bytes;}const bytes=Buffer.from(value),at=bytes.indexOf('ocio2.6.0');if(at<0)throw Error('QA ready cachekey anchor absent');bytes[at]=bytes[at]===111?112:111;return bytes;}return value;};
  if(mode==='missing-ready'){
    f.lstat=async (p,...args)=>{if(virtual.has(p))return{isFile:()=>true,isSymbolicLink:()=>false,size:virtual.get(p).length};if(p===path.join(CACHE,'1200','ready.json'))throw Object.assign(Error('QA absentready'),{code:'ENOENT'});return fs.lstat(p,...args);};
    f.writeFile=async (p,bytes,options)=>{trace.writes.push(path.basename(p));virtual.set(p,Buffer.from(bytes));};
    f.rename=async (from,to)=>{trace.renames.push([path.basename(from),path.basename(to)]);virtual.set(to,virtual.get(from));virtual.delete(from);};
    f.readFile=async (p,...args)=>virtual.has(p)?virtual.get(p):fs.readFile(p,...args);
    f.unlink=async p=>{trace.unlinks.push(path.basename(p));virtual.delete(p);};
  }
  const execFile=(command,args,options,callback)=>{
    trace.spawns.push({command,args,options:{cwd:options.cwd,shell:options.shell,windowsHide:options.windowsHide,timeout:options.timeout,hasPythonPath:Object.hasOwn(options.env,'PYTHONPATH')}});trace.active++;trace.maximumActive=Math.max(trace.maximumActive,trace.active);
    setTimeout(()=>{trace.active--;callback(Object.assign(Error('QA bounded spawn rejection'),{code:'QA_STOP'}),'','');},1);return{};
  };
  const context=vm.createContext({Buffer,URL,Map,Set,WeakMap,Promise,Object,Array,Error,Number,String,JSON,process,console,setTimeout,clearTimeout});
  const mod=new vm.SourceTextModule(source,{context,identifier:pathToFileURL(FILE).href,initializeImportMeta(meta){meta.url=pathToFileURL(FILE).href;}}),linked=new Map();
  await mod.link(async spec=>{if(linked.has(spec))return linked.get(spec);const values=spec==='node:fs/promises'?f:spec==='node:child_process'?{execFile}:await import(spec);const names=Object.keys(values),m=new vm.SyntheticModule(names,function(){for(const name of names)this.setExport(name,values[name]);},{context});linked.set(spec,m);return m;});await mod.evaluate();return{api:mod.namespace,trace};
}
const scheduler=await isolated(),jobs=[],q=scheduler.api;
for(let i=0;i<9;i++){const promise=q.ensureACES2Target(8000+i);jobs.push(promise.then(()=>({unexpectedSuccess:true}),error=>({code:error.code})));}
const sameQueued=q.ensureACES2Target(8004),sameQueuedAgain=q.ensureACES2Target(8004);check('queued samepeak shares promise even at capacity',sameQueued===sameQueuedAgain);let queueError;try{q.ensureACES2Target(9000);}catch(e){queueError=e;}
check('global oneactive plus8 distinct queued rejects ninthwaiter',q.getACES2TargetServiceState().runningPeak===8000&&q.getACES2TargetServiceState().queuedPeaks.length===8&&queueError?.code==='QUEUE_FULL');
const results=await Promise.all(jobs);check('all failures settle queue; process remains retryable',results.every(r=>r.code==='EXPORT_FAILED')&&q.getACES2TargetServiceState().runningPeak===null&&q.getACES2TargetServiceState().queuedPeaks.length===0,{results});
check('same source scheduler spawns maximumone and exact fixed Python args',scheduler.trace.maximumActive===1&&scheduler.trace.spawns.length===9&&scheduler.trace.spawns.every(row=>row.command===path.join(ROOT,'.tools','aces2-oracle','Scripts','python.exe')&&row.args[0]==='-I'&&row.args[1]==='-B'&&row.args[2]===path.join(ROOT,'tools','export-aces2-target.py')&&row.options.shell===false&&row.options.windowsHide===true&&row.options.timeout===120000&&!row.options.hasPythonPath),{maximumActive:scheduler.trace.maximumActive,spawnCount:scheduler.trace.spawns.length});
const full=await isolated({mode:'capacity'});let capacityError;try{await full.api.ensureACES2Target(9000);}catch(e){capacityError=e;}check('12 cachepeaks prevents newexport without deleting',capacityError?.code==='CACHE_FULL'&&full.trace.spawns.length===0,{code:capacityError?.code});
for(const mode of ['corrupt','ready-corrupt']){const x=await isolated({mode});let error;try{await x.api.ensureACES2Target(1200);}catch(e){error=e;}check(mode+' cache rejected, never regenerate or overwrite',error?.code===(mode==='corrupt'?'HASH_MISMATCH':'READY_MISMATCH')&&x.trace.spawns.length===0,{code:error?.code});}
const missing=await isolated({mode:'missing-ready'}),recovered=await missing.api.ensureACES2Target(1200);check('complete package can publish ready only after hashCPUvalidation',recovered.peakNits===1200&&missing.trace.spawns.length===0&&missing.trace.writes.length===2&&missing.trace.renames.length===1&&missing.trace.renames[0][1]==='ready.json',{writes:missing.trace.writes,renames:missing.trace.renames,unlinks:missing.trace.unlinks});
check('old research1200 and pinned3 target inventory unchanged',JSON.stringify(await inventory(path.join(ROOT,'verification','aces2-generated-1200')))===JSON.stringify(oldBefore)&&JSON.stringify(await inventory(path.join(ROOT,'vendor','aces2')))===JSON.stringify(pinnedBefore));
report.counts={passed:checks.filter(c=>c.passed).length,total:checks.length};report.passed=checks.every(c=>c.passed);await fs.writeFile(path.join(ROOT,'verification','aces2-target-service-check.json'),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({passed:report.passed,counts:report.counts,actual1200:report.actual1200.assetBaseURL,failures:checks.filter(c=>!c.passed)},null,2));process.exitCode=report.passed?0:1;
