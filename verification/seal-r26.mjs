import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import {fileURLToPath} from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const read=n=>fs.readFileSync(path.join(root,n));
const json=n=>JSON.parse(read(n).toString('utf8').replace(/^\uFEFF/,''));
const pin=n=>{const b=read(n);return{sha256:crypto.createHash('sha256').update(b).digest('hex'),bytes:b.length};};
const previous=json('verification/r25-final-manifest.json'),source={},changed=[];
for(const [name,before]of Object.entries(previous.source)){source[name]=pin(name);if(source[name].sha256!==before.sha256)changed.push(name);}
assert.deepEqual(changed,['main.js']);
assert.equal(source['main.js'].sha256,'6eae4cf63a6c975ec271191466c2d058d3a164e46fd8554148563fe6950d2c7c');
assert.equal(source['fireworks-audio.js'].sha256,'4e5ede41813249f062e50b212553e5e1821c27feaead8416b68ab51ba1b8ec31');
const currentReports=['r26-root-code-audit.json','r26-tiny-transmission-stepper-check.json','r26-tiny-transmission-independent-check.json','r26-tiny-transmission-gpu-preflight.json','r26-tiny-transmission-actual-gpu.json','r26-tiny-helper-independent-read-audit.json','r26-tiny-transmission-receipt-independent-audit.json','r26-transmission-rectangles-independent-check.json','r26-complete-transmission-candidate-check.json','r26-complete-transmission-independent-check.json','r26-complete-copies-independent-check.json','r26-row-straddle-gpu-preflight.json','r26-row-straddle-actual-gpu.json','r26-row-straddle-independent-read-audit.json','r26-row-straddle-receipt-independent-audit.json','r26-row-straddle-actual-read-audit.json','r26-user-restoration-check.json'];
const validation={};
for(const name of currentReports){const r=json('verification/'+name);assert.equal(r.passed,true,name);validation[name]={passed:r.passed,counts:r.counts??r.summary??null,actualGPURun:r.actualGPU===true};}
for(const [name,draws,bytes]of [['r26-tiny-transmission-actual-gpu.json',3,1024],['r26-row-straddle-actual-gpu.json',3,6192]]){const r=json('verification/'+name);assert.equal(r.actualGPU,true);assert.equal(r.actualDraws,draws);assert.equal(r.readbackBytes,bytes);assert.deepEqual(r.glErrors,[]);assert.deepEqual(r.shaderErrors,[]);}
const state=json('verification/r26-user-restoration-check.json');assert.equal(state.counts.exact,28);assert.deepEqual(json('verification/r26-final-console.json'),[]);
const artifacts={};
function walk(dir){for(const e of fs.readdirSync(path.join(root,dir),{withFileTypes:true})){const n=dir+'/'+e.name;if(e.isDirectory()){if(n==='verification/plans'||n==='verification/baselines'||n.startsWith('verification/baselines/r26'))walk(n);}else if((/^r26/i.test(e.name)||n.startsWith('verification/plans/R26')||n.startsWith('verification/baselines/r26'))&&!n.endsWith('/r26-final-manifest.json'))artifacts[n]=pin(n);}}
walk('verification');for(const n of ['README.md','verification/plans/PROGRESS.md','verification/seal-r26.mjs'])artifacts[n]=pin(n);
const report={schema:'glass-atoll.r26-final-manifest.v1',sealedUTC:new Date().toISOString(),goalStatus:'active',source,sourceDeltaFromR25:{changed,scope:'Only two locked diagnostic entry methods in main; all other inherited runtime pins unchanged.'},validation,syntax:{command:'npm run check',exitCodeObserved:0,log:'verification/r26-runtime-syntax-check.log'},server:{address:'127.0.0.1',port:5186,pid:23820,verification:'Get-NetTCPConnection -LocalPort 5186 -State Listen; no server restart'},artifacts,limitations:['Two fixed synthetic GPU foundations only; the1734x755 complete candidate remains CPU-only.','No native1.3m/SH aggregate/frame throughput/visual-quality or60FPS acceptance.','Historical failed CPU/audit fixtures remain archived and are not treated as passing current checks.','28 user intent/numeric settings restored exactly; normal reload does not replay prior cloud/wave physical instant.']};
fs.writeFileSync(path.join(root,'verification/r26-final-manifest.json'),JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({passed:true,runtimePins:Object.keys(source).length,currentPassingReports:currentReports.length,artifacts:Object.keys(artifacts).length,goalStatus:report.goalStatus,sourceDelta:changed},null,2));
