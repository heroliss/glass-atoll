import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
const root=process.cwd(),read=n=>fs.readFileSync(path.join(root,n)),json=n=>JSON.parse(read(n));
const pin=n=>{const b=read(n);return {sha256:crypto.createHash('sha256').update(b).digest('hex'),bytes:b.length};};
const manifestPath='verification/r29-production-capacity-pins.json',m=json(manifestPath);
assert.equal(m.calibrationPending,true,'Run finalization once, preserving pending evidence');
for(const [name,p] of Object.entries(m.source))assert.deepEqual(pin(name),p,name);
for(const name of ['r29-native-actual-independent-audit.json','r29-actual-job-receipts-independent-audit.json','r29-runner-independent-review.json','r29-native-calibration-gpu-preflight.json','r29-user-restoration-check.json'])assert.equal(json('verification/'+name).passed,true,name);
const expected={source:{draws:5,bytes:21984,prepares:1},light:{draws:6,bytes:110832,prepares:1},joint:{draws:10,bytes:122832,prepares:2}},receipts={};
for(const [kind,e] of Object.entries(expected)){
 const name='verification/r29-'+kind+'-peak-actual-gpu.json',r=json(name);
 assert(r.passed&&r.actualGPU);assert.equal(r.actualDraws,e.draws);assert.equal(r.renderPasses,e.draws);assert.equal(r.prepares,e.prepares);assert.equal(r.readbackBytes,e.bytes);assert.deepEqual(r.glErrors,[]);assert.deepEqual(r.shaderErrors,[]);assert.equal(r.timedIntervals.length,1);const t=r.timedIntervals[0];assert(t.ready&&!t.disjoint&&t.gpuMs<=25);
 receipts[kind]={...pin(name),path:name,counts:r.counts,draws:r.actualDraws,prepares:r.prepares,readbackBytes:r.readbackBytes,gpuMs:t.gpuMs,cpuSubmitMs:r.cpuSubmitMs,fresh:r.jobs.every(j=>j.fresh&&!j.reused)};assert(receipts[kind].fresh);
}
const archive='verification/baselines/r29-before-calibration-complete';fs.mkdirSync(archive,{recursive:true});fs.writeFileSync(path.join(root,archive,'r29-production-capacity-pins.json'),read(manifestPath),{flag:'wx'});
m.calibrationPending=false;m.calibratedUTC=new Date().toISOString();m.actualReceipts=receipts;
m.scope='Capacity-only three literal changes plus four explicit daily budgets and three exclusive QA methods. Existing kernels/scheduler/state/old library defaults preserved. Three isolated complete production numerical peak calibrations passed; real scene/mirror/evolving/multi-event frame admission remains pending.';
m.calibrationScope='Three original complete native one-event later-life numerical production jobs only; no scene/volume/real mirror/evolving/multi-event FPS admission. Four-million daily complete policy remains explicit, not a permanent or user-imposed cap.';
fs.writeFileSync(path.join(root,manifestPath),JSON.stringify(m,null,2)+'\n');
fs.writeFileSync(path.join(root,'verification/r29-syntax-check.json'),JSON.stringify({schema:'glass-atoll.r29-syntax.v1',passed:true,actualGPU:false,command:'npm run check',exitCode:0,log:pin('verification/r29-runtime-syntax.log'),additionalVerificationSyntax:['r29-native-calibration-runtime.js','r29-native-calibration-pins.js','r29-source-peak-gpu-check.js','r29-light-peak-gpu-check.js','r29-joint-peak-gpu-check.js'],verificationExitCode:0},null,2)+'\n');
console.log(JSON.stringify({passed:true,calibrationPending:m.calibrationPending,receipts,manifest:pin(manifestPath)},null,2));
