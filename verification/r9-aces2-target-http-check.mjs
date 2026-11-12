// R9 actual HTTP on ephemeral loopback ports. Never starts/restarts5186.
import http from 'node:http';
import {once} from 'node:events';
import {readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {createAtollServer} from '../server.mjs';
import {ensureACES2Target,getACES2TargetServiceState} from '../aces2-target-service.mjs';
const sha=x=>createHash('sha256').update(x).digest('hex'),checks=[],servers=[],calls=[];
const report={schema:'glass-atoll.r9-ACES2-target-actual-HTTP.v1',dateUTC:new Date().toISOString(),actualHTTP:true,actualCPU:true,actualGPU:false,productionPort5186Untouched:true,productionServerRestarted:false,checks,sourceSHA256:sha(await readFile(new URL('../server.mjs',import.meta.url))),backendSHA256:sha(await readFile(new URL('../aces2-target-service.mjs',import.meta.url))),limits:['Actual loopback HTTP, one real1200 cache reuse; injected backends only for explicit error/disconnection protocol witnesses.','No actual new GPU target, native HDR bridge, browser CORS implementation or visual acceptance tested.','Queue saturation mapping uses injected QUEUE_FULL; original service singlequeue/limit protocol has its independent CPU/VM report.']};
const add=(name,passed,evidence={})=>checks.push({name,passed:!!passed,...evidence});
const pause=ms=>new Promise(r=>setTimeout(r,ms));
async function listen(server){servers.push(server);server.listen(0,'127.0.0.1');await once(server,'listening');const port=server.address().port;if(port===5186)throw Error('Fixture unexpectedly touched production port');return port;}
function request(port,{method='POST',url='/api/aces2-target',headers={},body='{"peakNits":1200}',chunks,origin=true,hold=false}={}){
  let req;const done=new Promise((resolve,reject)=>{
    const defaults={'Content-Type':'application/json',...(origin?{Origin:`http://127.0.0.1:${port}`}:{})};
    req=http.request({hostname:'127.0.0.1',port,path:url,method,headers:{...defaults,...headers},agent:false},res=>{const bytes=[];let total=0;res.on('data',v=>{total+=v.length;if(total>256*1024)res.destroy(Error('Bounded response exceeded256KiB'));else bytes.push(v);});res.on('end',()=>{const bytesBody=Buffer.concat(bytes);let json;try{json=JSON.parse(bytesBody.toString('utf8'));}catch{}resolve({status:res.statusCode,headers:res.headers,body:bytesBody,json});});res.on('error',reject);});
    req.setTimeout(6000,()=>req.destroy(Error('R9 HTTP timeout')));req.on('error',reject);
    if(hold){req.flushHeaders();return;}
    if(chunks){for(const chunk of chunks)req.write(chunk);req.end();}else req.end(body);
  });return{req,done};
}
async function expect(port,name,options,status,code,backendError=false){const before=calls.length,r=await request(port,options).done;add(name,r.status===status&&(!code||r.json?.error?.code===code)&&r.headers['cache-control']==='no-store'&&r.headers['x-content-type-options']==='nosniff'&&!r.headers['access-control-allow-origin']&&(status<400||backendError||calls.length===before),{status:r.status,code:r.json?.error?.code,bytes:r.body.length,noNewBackendCall:calls.length===before});return r;}
let release,startedResolve;const pending=new Promise(r=>{release=r;}),started=new Promise(r=>{startedResolve=r;});
const errors={2001:'QUEUE_FULL',2002:'CACHE_FULL',2003:'SERVICE_BUSY',2004:'HASH_MISMATCH',2005:'READY_MISMATCH',2006:'INVALID_PACKAGE',2007:'EXPORTER_SEAL_CHANGED',2008:'PYTHON_UNAVAILABLE',2009:'EXPORT_FAILED',2011:'constructor',2012:'__proto__'};
const fixture=createAtollServer({ensureTarget(peak){calls.push(peak);if(peak===3000){startedResolve();return pending;}if(errors[peak])throw Object.assign(Error('private E:/secret/token/worker.py trace'),{code:errors[peak]});if(peak===2010)throw Error('private E:/secret/token/worker.py trace');return Promise.resolve({peakNits:peak,actualGPU:false,gpuAdmission:'required',productionIntegrated:false,descriptorURL:'/fixture-only/no-assets'});},getTargetState(){return{runningPeak:null,queuedPeaks:[],scope:'injected protocol witness'};}});
try{
 const port=await listen(fixture);report.protocolPort=port;
 const valid=await expect(port,'valid JSON reaches only numeric backend argument',{},200);add('numeric argument only; response explicitlyCPU-notGPU',calls.at(-1)===1200&&valid.json.actualGPU===false&&valid.json.gpuAdmission==='required'&&valid.json.productionIntegrated===false,valid.json);
 for(const method of ['GET','HEAD','OPTIONS','PUT']){const r=await expect(port,'method '+method+' denied',{method},405,method==='HEAD'?null:'METHOD_NOT_ALLOWED');add('AllowPOST '+method,r.headers.allow==='POST');}
 await expect(port,'missingOrigin denied',{origin:false},403,'LOCAL_SAME_ORIGIN_REQUIRED');
 for(const origin of ['null','http://outside.invalid',`http://127.0.0.1:${port+1}`,`https://127.0.0.1:${port}`,`http://127.0.0.1:${port}/`])await expect(port,'Origin exact '+origin,{headers:{Origin:origin}},403,'LOCAL_SAME_ORIGIN_REQUIRED');
 await expect(port,'nonloopbackHost denied',{headers:{Host:'outside.invalid',Origin:'http://outside.invalid'}},403,'LOCAL_SAME_ORIGIN_REQUIRED');
 await expect(port,'credentialsHost denied',{headers:{Host:`evil@localhost:${port}`,Origin:`http://localhost:${port}`}},403,'LOCAL_SAME_ORIGIN_REQUIRED');
 await expect(port,'cross-site denied even spoofmatchingOrigin',{headers:{'Sec-Fetch-Site':'cross-site'}},403,'LOCAL_SAME_ORIGIN_REQUIRED');
 await expect(port,'localhost sameorigin alias allowed',{headers:{Host:`localhost:${port}`,Origin:`http://localhost:${port}`}},200);
 await expect(port,'UTF8 charset JSON accepted',{headers:{'Content-Type':'application/json; charset=UTF-8'}},200);
 for(const type of ['text/plain','application/x-www-form-urlencoded','application/json; charset=latin1'])await expect(port,'contenttype '+type+' rejected',{headers:{'Content-Type':type}},415,'JSON_REQUIRED');
 await expect(port,'compressed body rejected',{headers:{'Content-Encoding':'gzip'}},415,'JSON_REQUIRED');
 await expect(port,'queryoptions rejected',{url:'/api/aces2-target?out=elsewhere'},400,'INVALID_REQUEST');
 for(const body of ['{"peakNits":"1200"}','{"peakNits":1200,"out":"evil"}','{"peakNits":1200,"peakNits":700}','[1200]','null','{"command":"run"}'])await expect(port,'strictonefield '+body,{body},400,'INVALID_BODY');
 for(const value of ['99','10001','1200.5','1e309'])await expect(port,'finiteinteger '+value,{body:'{"peakNits":'+value+'}'},400,'INVALID_PEAK');
 await expect(port,'malformedJSON rejected',{body:'{"peakNits":'},400,'INVALID_JSON');
 await expect(port,'invalidUTF8 rejected',{body:Buffer.from([0xff,0xfe])},400,'INVALID_JSON');
 await expect(port,'legal integer exponent accepted',{body:'{"peakNits":1.2e3}'},200);
 const padded='{"peakNits":1200}'.padEnd(64,' ');await expect(port,'exact64bytes accepted',{body:padded,headers:{'Content-Length':64}},200);
 await expect(port,'known length65 rejected',{body:padded+' ',headers:{'Content-Length':65}},413,'BODY_TOO_LARGE');
 await expect(port,'chunked cumulative65 rejected',{chunks:[Buffer.from(padded.slice(0,32)),Buffer.from(padded.slice(32)+' ')]},413,'BODY_TOO_LARGE');
 const slow=request(port,{hold:true});const slowResult=await slow.done;slow.req.destroy();add('bounded bodyreadtimeout408 withoutbackend',slowResult.status===408&&slowResult.json?.error?.code==='BODY_TIMEOUT',{status:slowResult.status});
 // Abort an incomplete body: this is not a shared export yet.
 const abortBefore=calls.length,aborted=request(port,{hold:true});aborted.done.catch(()=>{});aborted.req.write('{"peakNits":');await pause(15);aborted.req.destroy();await pause(30);add('aborted body creates no job and server staysalive',calls.length===abortBefore&&(await request(port).done).status===200);
 for(const [peak,code,status]of [[2001,'QUEUE_FULL',429],[2002,'CACHE_FULL',409],[2003,'SERVICE_BUSY',503],[2004,'HASH_MISMATCH',409],[2005,'READY_MISMATCH',409],[2006,'INVALID_PACKAGE',409],[2007,'EXPORTER_SEAL_CHANGED',503],[2008,'PYTHON_UNAVAILABLE',503],[2009,'EXPORT_FAILED',503],[2010,'TARGET_UNAVAILABLE',500],[2011,'TARGET_UNAVAILABLE',500],[2012,'TARGET_UNAVAILABLE',500]]){const r=await expect(port,'backenderror '+code,{body:JSON.stringify({peakNits:peak})},status,code,true);add('private error text not exposed '+code,!r.body.includes('secret')&&!r.body.includes('worker.py')&&!r.body.includes('stack'),{retryAfter:r.headers['retry-after']??null});}
 const first=request(port,{body:'{"peakNits":3000}'});first.done.catch(()=>{});await started;first.req.destroy();const second=request(port,{body:'{"peakNits":3000}'});await pause(25);release({peakNits:3000,actualGPU:false,gpuAdmission:'required',productionIntegrated:false});const remaining=await second.done;add('disconnected client does not cancel shared job/otherwaiter',remaining.status===200&&remaining.json?.peakNits===3000&&calls.filter(x=>x===3000).length===2,{backendWaiterCalls:calls.filter(x=>x===3000).length});
 // Default backend, actualcache, no mocks or new peak generation.
 const promises=[],real=createAtollServer({ensureTarget(peak){const p=ensureACES2Target(peak);promises.push(p);return p;},getTargetState:getACES2TargetServiceState}),realPort=await listen(real);report.actualPort=realPort;
 const pair=await Promise.all([request(realPort).done,request(realPort).done]);
 add('actual1200 parallel HTTP requests share real backendPromise',promises.length===2&&promises[0]===promises[1]&&pair.every(x=>x.status===200));
 const actual=pair[0].json;report.actual1200={peakNits:actual?.peakNits,status:actual?.status,cache:actual?.cache,cpuChecks:actual?.cpuChecks,assetBaseURL:actual?.assetBaseURL,descriptorURL:actual?.descriptorURL,candidateDescriptorSHA256:actual?.candidateDescriptorSHA256,readyMarkerSHA256:actual?.readyMarkerSHA256,fixtures:actual?.fixtures};
 add('actualHTTP1200 cache14/14 and963fixtures stay CPU-only',actual?.status==='cpu-ready'&&actual.peakNits===1200&&actual.cache.reused&&actual.cpuChecks.passed===14&&actual.cpuChecks.total===14&&actual.fixtures.sampleCount===963&&actual.actualGPU===false&&actual.gpuAdmission==='required'&&actual.productionIntegrated===false);
 const r=await new Promise((resolve,reject)=>{http.get({hostname:'127.0.0.1',port:realPort,path:actual.descriptorURL,agent:false},res=>{const chunks=[];res.on('data',c=>chunks.push(c));res.on('end',()=>resolve({status:res.statusCode,body:Buffer.concat(chunks)}));}).on('error',reject);});
 add('returned descriptorURL actuallyserves sealed bytes sameport',r.status===200&&sha(r.body)===actual.candidateDescriptorSHA256,{bytes:r.body.length,sha256:sha(r.body)});
}finally{for(const server of servers){server.closeIdleConnections?.();await new Promise(resolve=>server.close(resolve));}report.listenersClosed=servers.every(s=>!s.listening);}
add('all temporarylisteners closed',report.listenersClosed);report.counts={passed:checks.filter(c=>c.passed).length,total:checks.length};report.passed=checks.every(c=>c.passed);await writeFile(new URL('./r9-aces2-target-http-check.json',import.meta.url),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({passed:report.passed,counts:report.counts,protocolPort:report.protocolPort,actualPort:report.actualPort,actual1200:report.actual1200,failures:checks.filter(c=>!c.passed)},null,2));process.exitCode=report.passed?0:1;
