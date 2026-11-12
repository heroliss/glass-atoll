import http from 'node:http';
import { stat } from 'node:fs/promises';
import { createReadStream } from 'node:fs';
import { pipeline } from 'node:stream/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import {ensureACES2Target,getACES2TargetServiceState} from './aces2-target-service.mjs';
const root = path.dirname(fileURLToPath(import.meta.url));
const port = Number(process.env.PORT || 5186);
const runFile=promisify(execFile),displayCacheMs=5000;
let displayCache=null,displayCacheAt=0,displayProbe=null;
// Read only, fixed local script, bounded output/time, no OS setting writes.
export async function readDisplayHDR(){
  if(displayCache&&Date.now()-displayCacheAt<displayCacheMs)return {...displayCache,cache:{ageMs:Date.now()-displayCacheAt,ttlMs:displayCacheMs}};
  if(!displayProbe)displayProbe=(async()=>{
    let result;
    if(process.platform!=='win32')result={available:false,platform:process.platform,source:'Windows DXGI probe unavailable',displays:[],errors:['此原生显示探测仅支持 Windows；没有假造显示器亮度。']};
    else try{
      const {stdout}=await runFile('powershell.exe',['-NoLogo','-NoProfile','-NonInteractive','-File',path.join(root,'display-hdr.ps1')],{cwd:root,windowsHide:true,timeout:12000,maxBuffer:1024*1024,encoding:'utf8'});
      result=JSON.parse(stdout.replace(/^\uFEFF/,''));
      if(!result||!Array.isArray(result.displays))throw new Error('Invalid display probe response.');
    }catch(error){result={available:false,platform:process.platform,source:'Windows DXGI probe failed',displays:[],errors:[String(error.message||error)]};}
    displayCache={...result,serverReadAt:new Date().toISOString()};displayCacheAt=Date.now();return displayCache;
  })().finally(()=>{displayProbe=null;});
  return {...await displayProbe,cache:{ageMs:Date.now()-displayCacheAt,ttlMs:displayCacheMs}};
}
const types = { '.html':'text/html; charset=utf-8', '.js':'text/javascript; charset=utf-8', '.mjs':'text/javascript; charset=utf-8', '.css':'text/css; charset=utf-8', '.jpg':'image/jpeg', '.png':'image/png', '.svg':'image/svg+xml', '.json':'application/json', '.mp4':'video/mp4', '.webm':'video/webm' };
function byteRange(value,size){
  // GET only. Unknown units and multiple ranges use the permitted full200
  // fallback. BigInt avoids rounding arbitrary client decimal offsets.
  if(!value||!/^bytes=/i.test(value)||value.includes(','))return null;
  const m=/^bytes=(\d*)-(\d*)$/i.exec(value);
  if(!m||(!m[1]&&!m[2])||size===0)return false;
  const total=BigInt(size);let start,end;
  if(!m[1]){const suffix=BigInt(m[2]);if(suffix===0n)return false;start=suffix>=total?0n:total-suffix;end=total-1n;}
  else{start=BigInt(m[1]);end=m[2]?BigInt(m[2]):total-1n;if(start>=total||end<start)return false;if(end>=total)end=total-1n;}
  return {start:Number(start),end:Number(end)};
}

// Only this POST endpoint has generation capability. No request path/command
// options reach the backend; Node-side injection exists solely for protocol QA.
const targetBodyLimit=64,targetBodyTimeoutMs=2000;
function targetError(code,message,status){return Object.assign(new Error(message),{code,status});}
function targetJSON(req,res,status,value,headers={}){
  if(res.destroyed||res.writableEnded)return;
  const bytes=Buffer.from(JSON.stringify(value));
  res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Content-Length':bytes.length,'Cache-Control':'no-store','X-Content-Type-Options':'nosniff',...headers});
  res.end(req.method==='HEAD'?undefined:bytes);
}
function localTargetRequest(req){
  try{
    const rawHost=req.headers.host;if(typeof rawHost!=='string')return false;
    const host=new URL('http://'+rawHost),peer=req.socket.remoteAddress;
    if(!['127.0.0.1','localhost','[::1]'].includes(host.hostname)||host.username||host.password||host.pathname!=='/'||host.search||host.hash)return false;
    if(!['127.0.0.1','::1','::ffff:127.0.0.1'].includes(peer))return false;
    if(req.headers['sec-fetch-site']==='cross-site'||typeof req.headers.origin!=='string')return false;
    const origin=new URL(req.headers.origin);
    return origin.origin===host.origin&&req.headers.origin===origin.origin;
  }catch{return false;}
}
function discardTargetBody(req){req.once('error',()=>{});req.resume();}
function readTargetBody(req){
  return new Promise((resolve,reject)=>{
    let size=0,done=false;const chunks=[];
    const timer=setTimeout(()=>finish(targetError('BODY_TIMEOUT','Request body timed out',408)),targetBodyTimeoutMs);
    function cleanup(){clearTimeout(timer);req.off('data',data);req.off('end',end);req.off('error',error);req.off('aborted',aborted);}
    function finish(failure,value){if(done)return;done=true;cleanup();if(failure){discardTargetBody(req);reject(failure);}else resolve(value);}
    function data(chunk){size+=chunk.length;if(size>targetBodyLimit){finish(targetError('BODY_TOO_LARGE','JSON body must be at most64bytes',413));return;}chunks.push(chunk);}
    function end(){try{const text=new TextDecoder('utf-8',{fatal:true}).decode(Buffer.concat(chunks,size));let value;try{value=JSON.parse(text);}catch{throw targetError('INVALID_JSON','A valid JSON object is required',400);}
      // Single literal key prevents duplicate-key ambiguity while accepting
      // legal JSON number spellings such as1200.0 or1.2e3 if exactly integral.
      const shape=/^\s*\{\s*"peakNits"\s*:\s*(-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?)\s*\}\s*$/;
      if(!shape.test(text)||!value||Object.keys(value).length!==1||!Object.hasOwn(value,'peakNits'))throw targetError('INVALID_BODY','Only the peakNits numeric field is accepted',400);
      if(!Number.isInteger(value.peakNits)||value.peakNits<100||value.peakNits>10000)throw targetError('INVALID_PEAK','peakNits must be an integer in100..10000',400);
      finish(null,value.peakNits);
    }catch(failure){finish(failure.status?failure:targetError('INVALID_JSON','Body must be valid UTF-8 JSON',400));}}
    function error(){finish(targetError('BODY_ABORTED','Request body was interrupted',400));}
    function aborted(){error();}
    req.on('data',data);req.once('end',end);req.once('error',error);req.once('aborted',aborted);
  });
}
const targetFailures={
  INVALID_PEAK:[400,'peakNits must be an integer in100..10000'],QUEUE_FULL:[429,'Target request queue is full'],
  CACHE_FULL:[409,'Generated target cache is full; no assets were removed'],SERVICE_BUSY:[503,'Another local target job owns the cache'],
  HASH_MISMATCH:[409,'Cached target failed integrity verification'],READY_MISMATCH:[409,'Cached target ready seal is invalid'],
  INVALID_PACKAGE:[409,'Cached target package is invalid'],INVALID_CACHE_ENTRY:[409,'Generated target cache contains an invalid entry'],
  UNSAFE_CACHE:[503,'Generated target cache is unavailable'],NOT_READY:[503,'Target package is not ready'],READY_RACE:[503,'Target publication changed concurrently'],
  LOCK_CHANGED:[503,'Target cache lock changed'],EXPORTER_SEAL_CHANGED:[503,'Pinned target exporter requires review'],
  PYTHON_UNAVAILABLE:[503,'Project-local colour runtime is unavailable'],EXPORT_FAILED:[503,'Local target export failed']
};
async function handleTargetRequest(req,res,url,ensureTarget,getTargetState){
  if(req.method!=='POST'){targetJSON(req,res,405,{status:'error',error:{code:'METHOD_NOT_ALLOWED',message:'POST required'}},{Allow:'POST'});discardTargetBody(req);return;}
  if(!localTargetRequest(req)){targetJSON(req,res,403,{status:'error',error:{code:'LOCAL_SAME_ORIGIN_REQUIRED',message:'Local same-origin access only'}});discardTargetBody(req);return;}
  if(url.search){targetJSON(req,res,400,{status:'error',error:{code:'INVALID_REQUEST',message:'Query parameters are not accepted'}});discardTargetBody(req);return;}
  if(!/^application\/json(?:\s*;\s*charset=utf-8)?$/i.test(req.headers['content-type']||'')||req.headers['content-encoding']&&req.headers['content-encoding']!=='identity'){
    targetJSON(req,res,415,{status:'error',error:{code:'JSON_REQUIRED',message:'application/json UTF-8 is required'}});discardTargetBody(req);return;
  }
  if(req.headers['content-length']!==undefined&&(!/^\d+$/.test(req.headers['content-length'])||BigInt(req.headers['content-length'])>BigInt(targetBodyLimit))){targetJSON(req,res,413,{status:'error',error:{code:'BODY_TOO_LARGE',message:'JSON body must be at most64bytes'}},{Connection:'close'});discardTargetBody(req);return;}
  let peak;try{peak=await readTargetBody(req);}catch(error){targetJSON(req,res,error.status||400,{status:'error',error:{code:error.code||'INVALID_BODY',message:error.message}},{Connection:'close'});return;}
  try{
    // Disconnects do not cancel a shared generation. Complete/cache it, then
    // simply omit writing a response to a vanished client.
    const data=await ensureTarget(peak);targetJSON(req,res,200,{status:'cpu-ready',...data,service:getTargetState()});
  }catch(error){const code=Object.hasOwn(targetFailures,error?.code)?error.code:'TARGET_UNAVAILABLE',entry=code==='TARGET_UNAVAILABLE'?[500,'Target service is unavailable']:targetFailures[code];targetJSON(req,res,entry[0],{status:'error',error:{code,message:entry[1]}},[429,503].includes(entry[0])?{'Retry-After':'2'}:{});}
}
export function createAtollServer({ensureTarget=ensureACES2Target,getTargetState=getACES2TargetServiceState}={}){
  if(typeof ensureTarget!=='function'||typeof getTargetState!=='function')throw new TypeError('Target service injection must contain functions');
  return http.createServer(async (req,res) => {
  try {
    const url = new URL(req.url,'http://localhost');
    if(url.pathname==='/api/aces2-target'){await handleTargetRequest(req,res,url,ensureTarget,getTargetState);return;}
    if(url.pathname==='/api/display-hdr'){
      if(req.method!=='GET'&&req.method!=='HEAD'){res.writeHead(405,{'Allow':'GET, HEAD'}).end();return;}
      let allowed=false;
      try{
        const host=new URL('http://'+req.headers.host);
        allowed=['127.0.0.1','localhost','[::1]'].includes(host.hostname)&&(!req.headers.origin||new URL(req.headers.origin).host===host.host)&&req.headers['sec-fetch-site']!=='cross-site';
      }catch{}
      if(!allowed){res.writeHead(403).end('Local same-origin access only');return;}
      const data=await readDisplayHDR();res.writeHead(200,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});
      res.end(req.method==='HEAD'?undefined:JSON.stringify(data));return;
    }
    const resolved = path.resolve(root, '.' + decodeURIComponent(url.pathname));
    if (resolved !== root && !resolved.startsWith(root + path.sep)) { res.writeHead(403).end(); return; }
    if(req.method!=='GET'&&req.method!=='HEAD'){res.writeHead(405,{'Allow':'GET, HEAD','Content-Length':'0'}).end();return;}
    const file = (await stat(resolved)).isDirectory() ? path.join(resolved,'index.html') : resolved;
    const info=await stat(file);if(!info.isFile())throw new Error('Not a regular file');
    const headers={'Content-Type':types[path.extname(file).toLowerCase()] || 'application/octet-stream','Cache-Control':'no-cache','Accept-Ranges':'bytes','Content-Length':info.size};
    // HEAD has full representation headers without a body. No validators are
    // advertised, so an If-Range request safely gets the full representation.
    const range=req.method==='GET'&&!req.headers['if-range']?byteRange(req.headers.range?.trim(),info.size):null;
    if(range===false){res.writeHead(416,{...headers,'Content-Range':`bytes */${info.size}`,'Content-Length':0}).end();return;}
    if(range){headers['Content-Range']=`bytes ${range.start}-${range.end}/${info.size}`;headers['Content-Length']=range.end-range.start+1;}
    res.writeHead(range?206:200,headers);
    if(req.method==='HEAD'||info.size===0){res.end();return;}
    await pipeline(createReadStream(file,range||undefined),res);
  } catch { if(res.headersSent)res.destroy();else res.writeHead(404).end(req.method==='HEAD'?undefined:'Not found'); }
});}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url))createAtollServer().listen(port,'127.0.0.1',() => console.log(`Local: http://127.0.0.1:${port}`));
