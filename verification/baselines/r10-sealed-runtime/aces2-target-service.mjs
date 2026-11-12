import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {createHash,randomUUID} from 'node:crypto';
import {readFile,writeFile,readdir,lstat,realpath,mkdir,rename,unlink} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

// Local backend foundation only. No HTTP listener, browser, GPU admission,
// network, package installation, caller-controlled path or shell command.
const ROOT=path.dirname(fileURLToPath(import.meta.url));
const PYTHON=path.join(ROOT,'.tools','aces2-oracle','Scripts','python.exe');
const EXPORTER=path.join(ROOT,'tools','export-aces2-target.py');
const CACHE=path.join(ROOT,'vendor','aces2-generated');
const EXPORTER_SHA='4f4d6331e0bd280558259bbdce15d27bc3c9bbf3f5f97dd96d86cca5c9de75ea';
const CORE_SHA='f0fcdd7629964d612b4805604bbbd9559b0fcf04129a104040ffccb7cf230a2c';
const INPUT_SHA='fa82b382df34da9b22805bb823c446dd56f6f9e4cd06d02b77d6286ad3184474';
const ATAN_SHA='565860bc7bbb5a1f9b4cce3e53609a311fe260e14dd2968ef28533dfbfa30d19';
export const ACES2_TARGET_SERVICE_LIMITS=Object.freeze({minimumPeak:100,maximumPeak:10000,maxQueued:8,maxCachedPeaks:12,timeoutMs:120000,maxFileBytes:8*1024*1024,maxPackageBytes:16*1024*1024,maxFiles:32});
const readySchema='glass-atoll.aces2-generated-target-ready.v1';
const cacheKey='ocio2.6.0-numpy2.3.4-rec709-atan17-'+EXPORTER_SHA;
const runFile=promisify(execFile),pending=new Map(),queue=[];
let runningPeak=null,lastCachedPeaks=[],generated=0,reused=0,rejected=0;
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
const fail=(code,message)=>Object.assign(new Error(message),{code});
function requireThat(value,code,message){if(!value)throw fail(code,message);}
function peakValue(peak){requireThat(typeof peak==='number'&&Number.isInteger(peak)&&peak>=100&&peak<=10000,'INVALID_PEAK','peakNits must be an integer number in100..10000');return peak;}
function fileName(value){requireThat(typeof value==='string'&&/^[A-Za-z0-9][A-Za-z0-9._-]*$/.test(value)&&value!=='.'&&value!=='..','INVALID_PACKAGE','Package members must be flat fixed basenames');return value;}
async function exists(file){try{return await lstat(file);}catch(error){if(error.code==='ENOENT')return null;throw error;}}
async function directorySafe(directory,{create=false}={}){
  const relative=path.relative(ROOT,directory);requireThat(relative&&!relative.startsWith('..')&&!path.isAbsolute(relative),'UNSAFE_CACHE','Cache path escaped project');
  let current=ROOT;const rootReal=await realpath(ROOT);
  for(const component of relative.split(path.sep)){
    current=path.join(current,component);let info=await exists(current);
    if(!info&&create){try{await mkdir(current);}catch(error){if(error.code!=='EEXIST')throw error;}info=await lstat(current);}
    requireThat(info&&info.isDirectory()&&!info.isSymbolicLink(),'UNSAFE_CACHE','Cache path requires ordinary directories: '+path.relative(ROOT,current));
    const resolved=await realpath(current),expected=path.join(rootReal,path.relative(ROOT,current));
    requireThat(resolved.toLowerCase()===expected.toLowerCase(),'UNSAFE_CACHE','Cache path resolved through an unexpected link');
  }
}
async function readBounded(file,max=ACES2_TARGET_SERVICE_LIMITS.maxFileBytes){const info=await lstat(file);requireThat(info.isFile()&&!info.isSymbolicLink()&&info.size<=max,'INVALID_PACKAGE','Package file must be an ordinary bounded file: '+path.basename(file));const bytes=await readFile(file);requireThat(bytes.length===info.size,'INVALID_PACKAGE','Package file changed during validation');return bytes;}
async function readJSON(file,max){const bytes=await readBounded(file,max);let value;try{value=JSON.parse(bytes.toString('utf8'));}catch{throw fail('INVALID_PACKAGE','Malformed JSON: '+path.basename(file));}return{value,bytes,hash:sha(bytes)};}
async function dependencies(){
  await directorySafe(path.dirname(PYTHON));await directorySafe(path.dirname(EXPORTER));
  const exporter=await readBounded(EXPORTER);requireThat(sha(exporter)===EXPORTER_SHA,'EXPORTER_SEAL_CHANGED','Pinned exporter source changed; review before generating or reusing a target');
  const interpreter=await lstat(PYTHON);requireThat(interpreter.isFile()&&!interpreter.isSymbolicLink(),'PYTHON_UNAVAILABLE','Project-local Python interpreter unavailable');
}
async function scanCache(){await directorySafe(CACHE,{create:true});const entries=await readdir(CACHE,{withFileTypes:true}),peaks=[];for(const e of entries){if(/^\d+$/.test(e.name)){const n=Number(e.name);requireThat(e.name===String(n)&&n>=100&&n<=10000&&e.isDirectory()&&!e.isSymbolicLink(),'INVALID_CACHE_ENTRY','Unexpected numeric cache entry');peaks.push(n);}}lastCachedPeaks=peaks.sort((a,b)=>a-b);return peaks;}
function fixtureDescriptor(base,t,inventory){const p=t.gpuPattern;return{sampleCount:p.samples,width:p.width,height:p.height,paddedPixels:p.paddedPixels,stride:p.stride,dtype:p.dtype,input:{url:base+p.inputFile,sha256:p.inputSHA256,bytes:inventory.get(p.inputFile).bytes},expected:{url:base+p.expectedFile,sha256:p.expectedSHA256,bytes:inventory.get(p.expectedFile).bytes},oracle:{url:base+t.cpuOracleFile,sha256:inventory.get(t.cpuOracleFile).sha256,bytes:inventory.get(t.cpuOracleFile).bytes},inputRounding:p.inputRounding,layout:p.layout};}
async function validatePackage(peak,{allowMissingReady=false}={}){
  const directory=path.join(CACHE,String(peak));await directorySafe(directory);
  const artifacts=await readJSON(path.join(directory,'ARTIFACTS.json'),64*1024),seal=artifacts.value;
  requireThat(seal.schema==='glass-atoll.single-peak-aces2-seal.v1'&&seal.peakNits===peak&&seal.actualGPU===false&&Array.isArray(seal.files)&&seal.files.length>0&&seal.files.length<=ACES2_TARGET_SERVICE_LIMITS.maxFiles,'INVALID_PACKAGE','Invalid artifact seal');
  const inventory=new Map(),contents=new Map();let total=artifacts.bytes.length;
  for(const row of seal.files){const name=fileName(row.file);requireThat(!inventory.has(name)&&name!=='ARTIFACTS.json'&&name!=='ready.json'&&Number.isSafeInteger(row.bytes)&&row.bytes>=0&&row.bytes<=ACES2_TARGET_SERVICE_LIMITS.maxFileBytes&&/^[a-f0-9]{64}$/.test(row.sha256),'INVALID_PACKAGE','Invalid duplicate/file seal row');const bytes=await readBounded(path.join(directory,name));requireThat(bytes.length===row.bytes&&sha(bytes)===row.sha256,'HASH_MISMATCH','Asset hash mismatch: '+name);inventory.set(name,row);contents.set(name,bytes);total+=bytes.length;}
  requireThat(total<=ACES2_TARGET_SERVICE_LIMITS.maxPackageBytes,'PACKAGE_TOO_LARGE','Generated package exceeds bounded storage');
  const actualNames=await readdir(directory);requireThat(actualNames.every(name=>name==='ARTIFACTS.json'||name==='ready.json'||inventory.has(name))&&actualNames.length===inventory.size+1+(actualNames.includes('ready.json')?1:0),'INVALID_PACKAGE','Unsealed or missing package member');
  const descriptorBytes=contents.get('candidate-export-report.json');requireThat(descriptorBytes,'INVALID_PACKAGE','Missing candidate descriptor');const descriptor=JSON.parse(descriptorBytes.toString('utf8'));
  requireThat(descriptor.schema==='glass-atoll.official-aces2-export.v1'&&descriptor.passed===true&&descriptor.actualGPU===false&&descriptor.productionIntegrated===false&&descriptor.OCIOVersion==='2.6.0'&&descriptor.NumPyVersion==='2.3.4'&&descriptor.scriptSHA256===EXPORTER_SHA&&descriptor.sourceInputSHA256===INPUT_SHA&&descriptor.provenance?.coreSHA256===CORE_SHA&&descriptor.candidate?.mathSHA256===ATAN_SHA&&descriptor.candidate?.inverseExact===true&&descriptor.candidate?.nonOfficial===true&&descriptor.counts?.passed===descriptor.counts?.total&&descriptor.counts.total>=14&&descriptor.checks?.every(c=>c.passed===true)&&descriptor.targets?.length===1,'INVALID_PACKAGE','Descriptor does not match the pinned exporter/CPU contract');
  const t=descriptor.targets[0],p=t.gpuPattern;
  requireThat(t.peakNits===peak&&t.textures3D===0&&t.officialDynamicUniforms===0&&t.textures2D?.length===2&&p?.samples===963&&p.width===64&&p.height===16&&p.stride===4&&p.paddedPixels===61,'INVALID_PACKAGE','Target or963 fixture mismatch');
  for(const [name,hash]of [[t.functionFile,t.functionSHA256],[t.probeFragmentFile,t.probeFragmentSHA256],[p.inputFile,p.inputSHA256],[p.expectedFile,p.expectedSHA256],[descriptor.candidate.officialFunctionFile,descriptor.candidate.officialFunctionSHA256]])requireThat(inventory.get(fileName(name))?.sha256===hash,'INVALID_PACKAGE','Descriptor hash does not match inventory: '+name);
  for(const table of t.textures2D)requireThat(table.width===363&&table.height===1&&table.interpolation==='Interpolation.INTERP_NEAREST'&&table.upload?.generateMipmaps===false&&inventory.get(fileName(table.rgbaUploadFile))?.sha256===table.rgbaSHA256&&inventory.get(fileName(table.rawFile))?.sha256===table.rawSHA256,'INVALID_PACKAGE','Unexpected table upload contract');
  const cpu=JSON.parse(contents.get(fileName(t.cpuOracleFile)).toString('utf8'));
  requireThat(cpu.schema==='glass-atoll.official-aces2-cpu-oracle.v1'&&cpu.peakNits===peak&&cpu.library?.version==='2.6.0'&&cpu.sampleCount===963&&cpu.samples?.length===963&&JSON.stringify(cpu.gpuPattern)===JSON.stringify(p),'INVALID_PACKAGE','CPU oracle metadata mismatch');
  const expected=contents.get(p.expectedFile),input=contents.get(p.inputFile);requireThat(input.length===64*16*16&&expected.length===input.length,'INVALID_PACKAGE','Unexpected Float32 fixture size');
  for(let i=0;i<64*16;i++)for(let c=0;c<4;c++){const offset=(i*4+c)*4,a=input.readFloatLE(offset),b=expected.readFloatLE(offset);requireThat(Number.isFinite(a)&&Number.isFinite(b)&&b>=0&&b<=peak/100+1e-6&&((c===3)?a===1&&b===1:i<963?a===cpu.samples[i].inputFloat32[c]&&b===cpu.samples[i].outputNormalized100Nit[c]:a===0&&b===0),'INVALID_PACKAGE','CPU/texture fixture values do not match');}
  const baseURL='/vendor/aces2-generated/'+peak+'/',marker={schema:readySchema,cacheKey,peakNits:peak,artifactManifestSHA256:artifacts.hash,candidateDescriptorSHA256:sha(descriptorBytes),exporterSHA256:EXPORTER_SHA,assetBaseURL:baseURL,descriptorURL:baseURL+'candidate-export-report.json',fixtures:fixtureDescriptor(baseURL,t,inventory),cpuChecks:{...descriptor.counts},actualGPU:false,gpuAdmission:'required',productionIntegrated:false};
  const ready=await exists(path.join(directory,'ready.json'));let markerHash=null;
  if(ready){const published=await readJSON(path.join(directory,'ready.json'),64*1024);requireThat(JSON.stringify(published.value)===JSON.stringify(marker),'READY_MISMATCH','Published ready seal differs from verified package');markerHash=published.hash;}
  else requireThat(allowMissingReady,'NOT_READY','Target has no completed ready seal');
  return{directory,marker,markerHash,descriptor,packageBytes:total};
}
async function publishReady(validated){
  if(validated.markerHash)return validated;
  const temporary=path.join(validated.directory,'.ready-'+process.pid+'-'+randomUUID()+'.tmp'),destination=path.join(validated.directory,'ready.json'),bytes=Buffer.from(JSON.stringify(validated.marker,null,2)+'\n');
  try{await writeFile(temporary,bytes,{flag:'wx'});requireThat(!(await exists(destination)),'READY_RACE','Another process published the target');await rename(temporary,destination);}finally{if(await exists(temporary))await unlink(temporary);}
  return{...validated,markerHash:sha(bytes)};
}
async function lockedJob(peak){
  const peaks=await scanCache(),directory=path.join(CACHE,String(peak)),present=await exists(directory);let creation=null,validated;
  if(present){validated=await validatePackage(peak,{allowMissingReady:true});reused++;}
  else{
    requireThat(peaks.length<ACES2_TARGET_SERVICE_LIMITS.maxCachedPeaks,'CACHE_FULL','At most12 generated target directories; refusing growth without deleting existing files');
    const env={...process.env,PYTHONNOUSERSITE:'1',PYTHONDONTWRITEBYTECODE:'1',PIP_NO_INDEX:'1'};for(const name of ['PYTHONPATH','PYTHONHOME','PYTHONSTARTUP','PYTHONINSPECT'])delete env[name];
    try{const {stdout,stderr}=await runFile(PYTHON,['-I','-B',EXPORTER,'--peak',String(peak),'--out',directory],{cwd:ROOT,windowsHide:true,shell:false,timeout:ACES2_TARGET_SERVICE_LIMITS.timeoutMs,maxBuffer:256*1024,encoding:'utf8',env});creation=JSON.parse(stdout.replace(/^\uFEFF/,''));requireThat(creation.passed===true&&creation.peakNits===peak&&creation.sampleCount===963&&creation.actualGPU===false&&creation.productionIntegrated===false,'EXPORT_FAILED','Exporter did not return the expected CPU-only success');if(stderr.trim())throw fail('EXPORT_FAILED','Pinned exporter wrote unexpected stderr: '+stderr.slice(0,2048));}
    catch(error){throw fail(error.code==='EXPORT_FAILED'?error.code:'EXPORT_FAILED','Local target generation failed: '+String(error.message||error).slice(0,4096));}
    validated=await validatePackage(peak,{allowMissingReady:true});requireThat(validated.marker.artifactManifestSHA256===creation.artifactManifestSHA256,'EXPORT_FAILED','Exporter and post-validation seals differ');generated++;
  }
  validated=await publishReady(validated);lastCachedPeaks=(await scanCache());
  return{...validated.marker,readyMarkerSHA256:validated.markerHash,descriptor:validated.descriptor,cache:{reused:!!present,packageBytes:validated.packageBytes,generatedCount:generated,reusedCount:reused},scope:'CPU-exported local asset package only; browser GPU admission and visual/native HDR verification are still required'};
}
async function job(peak){
  await dependencies();await directorySafe(CACHE,{create:true});
  // An exclusive local lock also prevents accidental concurrent generators
  // from a second server/module instance. Never steal/delete a stale lock.
  const lock=path.join(CACHE,'.service.lock'),token=JSON.stringify({pid:process.pid,token:randomUUID(),peakNits:peak});
  try{await writeFile(lock,token,{flag:'wx'});}catch(error){if(error.code==='EEXIST')throw fail('SERVICE_BUSY','Another local target service owns the cache; stale locks require explicit operator review');throw error;}
  try{return await lockedJob(peak);}finally{const current=await readBounded(lock,4096);requireThat(current.toString('utf8')===token,'LOCK_CHANGED','Cache lock changed unexpectedly; refusing to delete a foreign lock');await unlink(lock);}
}
async function pump(){
  if(runningPeak!==null||queue.length===0)return;const next=queue.shift();runningPeak=next.peak;
  try{next.resolve(await job(next.peak));}catch(error){rejected++;next.reject(error);}finally{pending.delete(next.peak);runningPeak=null;void pump();}
}
/** Finite integer only. Same peak shares the exact in-flight Promise. No paths. */
export function ensureACES2Target(peak){
  peak=peakValue(peak);if(pending.has(peak))return pending.get(peak);
  // Start one immediately; at most8 additional distinct requests may wait.
  requireThat(queue.length<ACES2_TARGET_SERVICE_LIMITS.maxQueued,'QUEUE_FULL','At most8 distinct target requests may wait');
  let resolve,reject;const promise=new Promise((a,b)=>{resolve=a;reject=b;});pending.set(peak,promise);queue.push({peak,resolve,reject});void pump();return promise;
}
export function getACES2TargetServiceState(){return{runningPeak,queuedPeaks:queue.map(x=>x.peak),inFlightPeaks:[...pending.keys()],cachedPeaksLastScan:[...lastCachedPeaks],generated,reused,rejected,limits:{...ACES2_TARGET_SERVICE_LIMITS},cacheKey,scope:'local CPU generation; not GPU readiness'};}
