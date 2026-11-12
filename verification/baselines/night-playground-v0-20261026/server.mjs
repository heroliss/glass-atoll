import http from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
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
const types = { '.html':'text/html; charset=utf-8', '.js':'text/javascript; charset=utf-8', '.mjs':'text/javascript; charset=utf-8', '.css':'text/css; charset=utf-8', '.jpg':'image/jpeg', '.png':'image/png', '.svg':'image/svg+xml', '.json':'application/json' };
export function createAtollServer(){return http.createServer(async (req,res) => {
  try {
    const url = new URL(req.url,'http://localhost');
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
    const file = (await stat(resolved)).isDirectory() ? path.join(resolved,'index.html') : resolved;
    res.writeHead(200, {'Content-Type':types[path.extname(file)] || 'application/octet-stream','Cache-Control':'no-cache'});
    res.end(await readFile(file));
  } catch { res.writeHead(404).end('Not found'); }
});}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url))createAtollServer().listen(port,'127.0.0.1',() => console.log(`Local: http://127.0.0.1:${port}`));
