import fs from'node:fs';import assert from'node:assert/strict';import crypto from'node:crypto';
const p=new URL('../main.js',import.meta.url),b=fs.readFileSync(p),s=b.toString(),sha=x=>crypto.createHash('sha256').update(x).digest('hex');assert.equal(sha(b),'08b43c653b3929bd7bd13d8b53493850958e3b18ce1a8ffddfbf9904940cbedf');
const marker='    async runR29SourcePeakCheck(options={}){';assert.equal(s.split(marker).length,2);assert(!s.includes('runR39DenseGPUCheck'));
const eol=s.includes('\r\n')?'\r\n':'\n';
const lines=[
"    async runR39DenseGPUCheck(){",
"      if(qaRenderLock||qaFrozenWorkload||renderBenchmark.active||graphicsContextInterrupted||!parameters.paused||qualityApplying||qaSmokeVariants||inspection||throwGesture||pendingThrow||transition||parameters.director.mode!=='off'||fireworks.diagnostics().active||fireworks.diagnostics().queued||pyroSmoke.packetCount)throw new Error('Pause an empty healthy scene with no interaction or diagnostic first');",
"      qaRenderLock=true;try{const {runR39DenseCalibration}=await import('./verification/r39-dense-calibration-runtime.js');return await runR39DenseCalibration(THREE,renderer,{parentLocked:true});}finally{clock.getDelta();qaRenderLock=false;lastPausedRenderKey=null;}",
"    },"
];
const insertion=lines.join(eol)+eol,next=s.replace(marker,insertion+marker);assert.equal(next.replace(insertion,''),s);fs.writeFileSync(p,next);
fs.writeFileSync(new URL('./r39-dense-qa-hook-receipt.json',import.meta.url),JSON.stringify({schema:'glass-atoll.r39-dense-qa-hook.v1',passed:true,beforeSHA256:sha(b),afterSHA256:sha(Buffer.from(next)),inverseExact:true,productionAlgorithmChange:false,newLiveGPUDraws:0,scope:'Fixed QA-only empty-paused-scene root entry; renderer ownership and finally clock release. No live capacity, shader, settings or scene change.'},null,2)+'\n');console.log(JSON.stringify({passed:true,main:sha(Buffer.from(next)),inverseExact:true}));
