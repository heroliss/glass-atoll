import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
const root=path.resolve(import.meta.dirname,'..'),v=path.join(root,'verification');
const hash=file=>{const b=fs.readFileSync(file);return{sha256:crypto.createHash('sha256').update(b).digest('hex'),bytes:b.length};};
const read=n=>JSON.parse(fs.readFileSync(path.join(v,n),'utf8'));
const r23=read('r23-final-manifest.json'),productionSource={};
for(const[n,pin]of Object.entries(r23.source))if(!n.startsWith('verification/')&&/\.(?:js|json|html|css)$/.test(n)){
  const current=hash(path.join(root,n));if(current.sha256!==pin.sha256)throw new Error('R24 changed runtime source: '+n);productionSource[n]=current;
}
if(productionSource['fireworks-audio.js']?.sha256!=='4e5ede41813249f062e50b212553e5e1821c27feaead8416b68ab51ba1b8ec31')throw new Error('Approved audio changed');
const validations=Object.fromEntries(['r24-joint-work-planner-check.json','r24-joint-planner-independent-check.json','r24-sparse-gaussian-witness.json','r24-sparse-independent-audit.json','r24-r23-seal-read-audit.json'].map(n=>{const r=read(n);if(!r.passed)throw new Error('Final scoped check failed: '+n);return[n,{passed:r.passed,counts:r.counts}];}));
function walk(d){return fs.readdirSync(d,{withFileTypes:true}).flatMap(e=>e.isDirectory()?walk(path.join(d,e.name)):[path.join(d,e.name)]);}
const selected=walk(v).filter(f=>/r24/i.test(path.relative(v,f))&&path.basename(f)!=='r24-final-manifest.json');
const artifacts=Object.fromEntries(selected.sort().map(f=>[path.relative(root,f).replaceAll('\\','/'),hash(f)]));
const report={schema:'glass-atoll.r24-final-manifest.v1',sealedUTC:new Date().toISOString(),goalStatus:'active',productionRuntimeUnchangedSinceR23:true,newGPUDispatches:0,newBrowserActions:0,plannerImportedByMain:false,sparseSelectorImportedByMain:false,candidateUIAdmission:'withheld',productionSource,artifacts,validations,R23Manifest:hash(path.join(v,'r23-final-manifest.json')),documents:{README:hash(path.join(root,'README.md')),progress:hash(path.join(v,'plans/PROGRESS.md'))},limits:['R24 is CPU verification and research only; current production improvement is R23 active-count layout.','Original sparse7/7 domain was independently falsified; archived failure and exact high-precision input remain. Current9/9 plus independent7/7 admit only narrowed synthetic numerical tests.','No universal Float32/binary64 certificate, GPU candidate, live coordinator, native/full-life performance or60FPS acceptance.','Current pair caps are this round admission boundaries, not permanent user requirements; future budgets require separate bounded measurement.']};
fs.writeFileSync(path.join(v,'r24-final-manifest.json'),JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({sealed:true,goalStatus:'active',runtimePins:Object.keys(productionSource).length,artifacts:Object.keys(artifacts).length,validations,productionRuntimeUnchanged:true,newGPUDispatches:0},null,2));
