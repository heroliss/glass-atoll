// R9 clone: output filename and original-source seal use this round's baseline.
// Real HTTP integration on ephemeral127.0.0.1 port; never touches5186.
import assert from 'node:assert/strict';
import http from 'node:http';
import { once } from 'node:events';
import { mkdtemp, writeFile, readFile, stat, open, rm } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import crypto from 'node:crypto';
import { createAtollServer } from '../server.mjs';

const root=fileURLToPath(new URL('../',import.meta.url)),verification=path.join(root,'verification');
const sha=x=>crypto.createHash('sha256').update(x).digest('hex'),checks=[];
const server=createAtollServer(),entrySource=await readFile(path.join(root,'server.mjs'),'utf8');
const temporary=await mkdtemp(path.join(verification,'.server-range-'));
assert(path.dirname(path.resolve(temporary))===path.resolve(verification));
assert(path.basename(temporary).startsWith('.server-range-'));
let port,cleanupComplete=false;
const body=Buffer.alloc(65539);for(let i=0;i<body.length;i++)body[i]=(i*73+17)&255;
body.writeUInt32BE(24,0);body.write('ftypisom',4);body.write('isomiso2',16);
await writeFile(path.join(temporary,'fixture.mp4'),body);
await writeFile(path.join(temporary,'fixture.webm'),body);
await writeFile(path.join(temporary,'empty.mp4'),Buffer.alloc(0));
await writeFile(path.join(temporary,'index.html'),'<!doctype html><title>Range fixture</title>');
const base='/'+path.relative(root,temporary).split(path.sep).map(encodeURIComponent).join('/');

function request(resource,method='GET',headers={}){
  return new Promise((resolve,reject)=>{
    const req=http.request({hostname:'127.0.0.1',port,path:resource,method,headers,agent:false},res=>{
      const chunks=[];let bytes=0;
      res.on('data',chunk=>{bytes+=chunk.length;if(bytes>2*1024*1024){res.destroy(Error('Bounded fixture response exceeded2MB'));return;}chunks.push(chunk);});
      res.on('end',()=>resolve({status:res.statusCode,headers:res.headers,body:Buffer.concat(chunks)}));res.on('error',reject);
    });
    req.setTimeout(5000,()=>req.destroy(Error('HTTP fixture timeout')));req.on('error',reject);req.end();
  });
}
async function check(name,fn){try{const evidence=await fn();checks.push({name,passed:true,evidence:evidence??null});}catch(error){checks.push({name,passed:false,error:String(error.stack||error)});}}
function full(r,expected=body,type='video/mp4'){
  assert.equal(r.status,200);assert.equal(r.headers['content-type'],type);assert.equal(r.headers['accept-ranges'],'bytes');
  assert.equal(r.headers['content-length'],String(expected.length));assert.equal(r.headers['content-range'],undefined);
  assert.equal(r.headers['transfer-encoding'],undefined);assert.deepEqual(r.body,expected);
}
async function partial(range,start,end){
  const r=await request(base+'/fixture.mp4','GET',{Range:range});
  assert.equal(r.status,206);assert.equal(r.headers['content-type'],'video/mp4');assert.equal(r.headers['accept-ranges'],'bytes');
  assert.equal(r.headers['content-range'],`bytes ${start}-${end}/${body.length}`);assert.equal(r.headers['content-length'],String(end-start+1));
  assert.deepEqual(r.body,body.subarray(start,end+1));return{range,status:r.status,contentRange:r.headers['content-range'],bytes:r.body.length};
}
async function unsatisfiable(range,resource='/fixture.mp4',length=body.length){
  const r=await request(base+resource,'GET',{Range:range});assert.equal(r.status,416);
  assert.equal(r.headers['content-range'],`bytes */${length}`);assert.equal(r.headers['content-length'],'0');assert.equal(r.body.length,0);
  return{range,status:r.status,contentRange:r.headers['content-range']};
}

try{
  server.listen(0,'127.0.0.1');await once(server,'listening');port=server.address().port;assert.notEqual(port,5186);
  await check('temporary loopback listener uses ephemeral port and no production port',()=>({port,production5186Untouched:true}));
  await check('MP4 full GET correct MIME length and byteexact payload',async()=>{const r=await request(base+'/fixture.mp4');full(r);return{status:r.status,bytes:r.body.length,sha256:sha(r.body)};});
  await check('WebM correct MIME and byteexact content',async()=>{const r=await request(base+'/fixture.webm');full(r,body,'video/webm');return{contentType:r.headers['content-type']};});
  await check('bounded range',()=>partial('bytes=8-255',8,255));
  await check('single first byte inclusive endpoints',()=>partial('bytes=0-0',0,0));
  await check('single last byte',()=>partial(`bytes=${body.length-1}-${body.length-1}`,body.length-1,body.length-1));
  await check('open ended range',()=>partial('bytes=65520-',65520,body.length-1));
  await check('suffix range',()=>partial('bytes=-37',body.length-37,body.length-1));
  await check('oversized suffix clamps to full representation with206',()=>partial('bytes=-999999999999999999999999',0,body.length-1));
  await check('oversized end clamps without Float64 rounding',()=>partial('bytes=65000-999999999999999999999999',65000,body.length-1));
  await check('case insensitive byte unit',()=>partial('BYTES=31-47',31,47));
  await check('first byte beyond end returns416',()=>unsatisfiable(`bytes=${body.length}-`));
  await check('huge start unsatisfiable safely',()=>unsatisfiable('bytes=999999999999999999999999-'));
  await check('reversed range rejected',()=>unsatisfiable('bytes=100-1'));
  await check('zero suffix unsatisfiable',()=>unsatisfiable('bytes=-0'));
  await check('malformed supported byte ranges rejected',async()=>{for(const x of ['bytes=','bytes=-','bytes=abc','bytes=1.5-3','bytes=1--3'])await unsatisfiable(x);return{cases:5};});
  await check('multiple ranges deliberately ignored as full200',async()=>full(await request(base+'/fixture.mp4','GET',{Range:'bytes=0-1,4-5'})));
  await check('unknown range unit ignored as full200',async()=>full(await request(base+'/fixture.mp4','GET',{Range:'items=0-2'})));
  await check('IfRange unvalidated request safely falls back to full200',async()=>full(await request(base+'/fixture.mp4','GET',{Range:'bytes=1-7','If-Range':'"unknown-entity"'})));
  await check('HEAD full representation headers no body',async()=>{const r=await request(base+'/fixture.mp4','HEAD');assert.equal(r.status,200);assert.equal(r.headers['content-length'],String(body.length));assert.equal(r.headers['content-type'],'video/mp4');assert.equal(r.headers['accept-ranges'],'bytes');assert.equal(r.body.length,0);return{status:r.status,contentLength:r.headers['content-length'],bodyBytes:0};});
  await check('HEAD ignores Range per GETonly RFC semantics',async()=>{const r=await request(base+'/fixture.mp4','HEAD',{Range:'bytes=1-3'});assert.equal(r.status,200);assert.equal(r.headers['content-length'],String(body.length));assert.equal(r.headers['content-range'],undefined);assert.equal(r.body.length,0);});
  await check('empty full GET and HEAD no chunked body',async()=>{const r=await request(base+'/empty.mp4');full(r,Buffer.alloc(0));const h=await request(base+'/empty.mp4','HEAD');assert.equal(h.headers['content-length'],'0');assert.equal(h.body.length,0);});
  await check('empty range returns416 and total0',()=>unsatisfiable('bytes=0-','/empty.mp4',0));
  await check('directory index preserved',async()=>{const r=await request(base+'/');assert.equal(r.status,200);assert.equal(r.headers['content-type'],'text/html; charset=utf-8');assert.equal(r.headers['content-length'],String(r.body.length));assert(r.body.includes('Range fixture'));});
  await check('unsupported static method405 with Allow',async()=>{const r=await request(base+'/fixture.mp4','POST');assert.equal(r.status,405);assert.equal(r.headers.allow,'GET, HEAD');assert.equal(r.body.length,0);});
  await check('missing GET and HEAD404 without duplicate headers',async()=>{assert.equal((await request(base+'/missing.mp4')).status,404);const h=await request(base+'/missing.mp4','HEAD');assert.equal(h.status,404);assert.equal(h.body.length,0);});
  await check('existing encoded Windows traversal guard preserved',async()=>{const r=await request('/%2e%2e%5coutside-static-fixture.mp4');assert.equal(r.status,403);});
  await check('displayHDR crossOrigin rejection and method guard preserved without native probing',async()=>{assert.equal((await request('/api/display-hdr','GET',{Origin:'http://outside.invalid'})).status,403);const r=await request('/api/display-hdr','POST');assert.equal(r.status,405);assert.equal(r.headers.allow,'GET, HEAD');});
  await check('display probe route path guard and original listen bytes unchanged',async()=>{
    const oldSource=await readFile(new URL('./baselines/r9-server-before-aces2-route.mjs',import.meta.url),'utf8');
    const oldParts={displayProbe:oldSource.slice(oldSource.indexOf('const runFile='),oldSource.indexOf('const types =')),displayRoute:oldSource.slice(oldSource.indexOf("    if(url.pathname==='/api/display-hdr')"),oldSource.indexOf('    const resolved =')),pathGuard:oldSource.split('\n').find(x=>x.includes('resolved !== root')),listen:oldSource.slice(oldSource.indexOf('if(process.argv[1]'))};
    const before={serverSHA256:sha(oldSource),parts:Object.fromEntries(Object.entries(oldParts).map(([k,v])=>[k,sha(v)]))};
    const parts={displayProbe:entrySource.slice(entrySource.indexOf('const runFile='),entrySource.indexOf('const types =')),
      displayRoute:entrySource.slice(entrySource.indexOf("    if(url.pathname==='/api/display-hdr')"),entrySource.indexOf('    const resolved =')),
      pathGuard:entrySource.split('\n').find(x=>x.includes('resolved !== root')),listen:entrySource.slice(entrySource.indexOf('if(process.argv[1]'))};
    for(const[k,v]of Object.entries(parts))assert.equal(sha(v),before.parts[k],k);return{preserved:Object.keys(parts),beforeServerSHA256:before.serverSHA256};
  });
  await check('actual existing MP4 media header tail and seekoffset bytes match disk',async()=>{
    const relative='verification/pyro-r7-apex-motion.mp4',file=path.join(root,relative),info=await stat(file),h=await request('/'+relative,'HEAD');
    assert.equal(h.status,200);assert.equal(h.headers['content-type'],'video/mp4');assert.equal(h.headers['content-length'],String(info.size));
    const handle=await open(file,'r'),samples=[];
    try{for(const offset of [0,Math.floor(info.size*.37),info.size-128]){
      const end=Math.min(offset+127,info.size-1),expected=Buffer.alloc(end-offset+1);await handle.read(expected,0,expected.length,offset);
      const r=await request('/'+relative,'GET',{Range:`bytes=${offset}-${end}`});assert.equal(r.status,206);assert.equal(r.headers['content-range'],`bytes ${offset}-${end}/${info.size}`);assert.deepEqual(r.body,expected);
      samples.push({offset,bytes:r.body.length,sha256:sha(r.body)});
    }}finally{await handle.close();}
    return{file:relative,fileBytes:info.size,samples,mediaDecodedInThisTest:false};
  });
}finally{
  await new Promise(resolve=>server.close(resolve));
  assert(path.resolve(temporary).startsWith(path.resolve(verification)+path.sep));
  await rm(temporary,{recursive:true,force:true});cleanupComplete=true;
}
const report={schema:'glass-atoll.static-media-range-HTTP-QA.v1',dateUTC:new Date().toISOString(),actualHTTP:true,
  productionServerRestarted:false,productionPort5186Untouched:true,ephemeralPort:port,listenerClosed:!server.listening,temporaryFixtureRemoved:cleanupComplete,
  sourceSHA256:sha(entrySource),passed:checks.every(c=>c.passed),counts:{passed:checks.filter(c=>c.passed).length,total:checks.length},checks,
  limits:['Actual browser/native video seek is a separate acceptance after the owner restarts the existing server.','No browser decode/playback/FPS/HDR proof from HTTP bytes.','Single byte range only; multiRange/unknown-unit/IfRange fallback200; HEAD ignores Range.'],
  specification:'https://www.rfc-editor.org/rfc/rfc9110.html#section-14.2'};
await writeFile(new URL('./r9-server-media-range-check.json',import.meta.url),JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({passed:report.passed,counts:report.counts,ephemeralPort:port,listenerClosed:report.listenerClosed,temporaryFixtureRemoved:cleanupComplete,sourceSHA256:report.sourceSHA256,failed:checks.filter(c=>!c.passed)},null,2));
if(!report.passed)process.exitCode=1;
