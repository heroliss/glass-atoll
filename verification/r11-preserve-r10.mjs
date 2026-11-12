// Preserve prior checkpoint source bytes before newer edits replace root files.
import fs from 'node:fs';import path from 'node:path';import crypto from 'node:crypto';
import {fileURLToPath} from 'node:url';
const root=new URL('../',import.meta.url),hash=b=>crypto.createHash('sha256').update(b).digest('hex'),r=JSON.parse(fs.readFileSync(new URL('r10-source-evidence-manifest.json',import.meta.url)));
const selected=r.entries.filter(e=>!e.path.includes('/')||['verification/plans/PROGRESS.md','verification/PLAYGROUND-ACCEPTANCE.md'].includes(e.path));
const out=[];
for(const e of selected){
 const dest=new URL('verification/baselines/r10-sealed-runtime/'+e.path,root),current=new URL(e.path,root);let bytes;
 if(fs.existsSync(dest)&&hash(fs.readFileSync(dest))===e.sha256)bytes=fs.readFileSync(dest);
 else if(hash(fs.readFileSync(current))===e.sha256)bytes=fs.readFileSync(current);
 else if(e.path==='camera-framing.js')bytes=fs.readFileSync(new URL('verification/r11-reflection-framing-baseline.js',root));
 else if(e.path==='package.json')bytes=Buffer.from(fs.readFileSync(current,'utf8').replace('node --check pyro-smoke-ring-burn.js && node --check pyro-smoke-logical-burn.js && node --check pyro-smoke-logical-events.js && node --check fireworks-combustion.js && node --check fireworks-thermal-tail.js','node --check pyro-smoke-ring-burn.js && node --check fireworks-combustion.js'));
 else throw Error('Missing original R10 source: '+e.path);
 if(hash(bytes)!==e.sha256)throw Error('R10 byte recovery mismatch: '+e.path);
 fs.mkdirSync(path.dirname(fileURLToPath(dest)),{recursive:true});fs.writeFileSync(dest,bytes);out.push(e.path);
}
console.log(JSON.stringify({preservedSources:out.length,byteExact:true}));
