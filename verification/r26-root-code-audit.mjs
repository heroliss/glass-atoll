import fs from 'node:fs';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
const sha=b=>crypto.createHash('sha256').update(b).digest('hex');
const baseline=new URL('./baselines/r26-before-tiny-chunk/',import.meta.url), root=new URL('../',import.meta.url), checks=[];
function check(name,fn){try{checks.push({name,passed:true,evidence:fn()??null});}catch(e){checks.push({name,passed:false,error:String(e.stack??e)});}}
check('Main changes only two exclusive paused QA entries with trusted factory overrides',()=>{
 const now=fs.readFileSync(new URL('main.js',root)),old=fs.readFileSync(new URL('main.js',baseline));
 const rows=now.toString().split(/(?<=\n)/),hook=rows.find(r=>r.startsWith('    async runTinyTransmissionCheck(options={})')),rowHook=rows.find(r=>r.startsWith('    async runRowStraddleTransmissionCheck(options={})'));
 assert(hook);assert.equal(rows.filter(r=>r.includes('async runTinyTransmissionCheck(')).length,1);
 for(const token of ['qaRenderLock||qaFrozenWorkload||graphicsContextInterrupted||!parameters.paused','qaRenderLock=true','{...options,parentLocked:true,createStepper:createTinyTransmissionStepper}','finally{clock.getDelta();qaRenderLock=false;lastPausedRenderKey=null;}']) assert(hook.includes(token));
 assert(rowHook);assert.equal(rows.filter(r=>r.includes('async runRowStraddleTransmissionCheck(')).length,1);for(const token of ['qaRenderLock||qaFrozenWorkload||graphicsContextInterrupted||!parameters.paused','qaRenderLock=true','{...options,parentLocked:true,createField:createCompleteTransmissionCandidate}','finally{clock.getDelta();qaRenderLock=false;lastPausedRenderKey=null;}']) assert(rowHook.includes(token));
 assert(Buffer.from(rows.filter(r=>r!==hook&&r!==rowHook).join('')).equals(old));
 return{mainSHA256:sha(now),baselineSHA256:sha(old),qaHooksOnly:2};
});
check('Production transmission math, volume renderer and approved audio are unchanged this round',()=>{
 const pinned={};for(const name of ['pyro-smoke-transmission-gpu.js','pyro-smoke-renderer.js']){const a=fs.readFileSync(new URL(name,root)),b=fs.readFileSync(new URL(name,baseline));assert(a.equals(b));pinned[name]=sha(a);}
 pinned['fireworks-audio.js']=sha(fs.readFileSync(new URL('fireworks-audio.js',root)));assert.equal(pinned['fireworks-audio.js'],'4e5ede41813249f062e50b212553e5e1821c27feaead8416b68ab51ba1b8ec31');return pinned;
});
const report={schema:'glass-atoll.r26-root-code-audit.v1',actualGPU:false,passed:checks.every(c=>c.passed),counts:{passed:checks.filter(c=>c.passed).length,total:checks.length},checks};
fs.writeFileSync(new URL('./r26-root-code-audit.json',import.meta.url),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report,null,2));if(!report.passed)process.exitCode=1;
