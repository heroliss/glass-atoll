import assert from 'node:assert/strict';
import {readFileSync,writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
const read=p=>readFileSync(new URL(p,import.meta.url),'utf8');
const hash=p=>createHash('sha256').update(read(p)).digest('hex');
const checks=[],check=(name,fn)=>{try{const evidence=fn();checks.push({name,passed:true,evidence});}catch(e){checks.push({name,passed:false,error:e.stack});}};
check('Frozen helper and private stepper match independently reviewed source pins',()=>{
 assert.equal(hash('./r26-tiny-transmission-gpu-check.js'),'ee01b632a58db7d9a2b2ba7660fc69d71071b0e20f5066db0c23f14b2d9f457a');
 assert.equal(hash('./r26-tiny-transmission-stepper.js'),'1b987d6e3e0f708af46d6c6209f8786abe5b6cf503f39f5261d3b02c56d36426');
 return {helperSHA256:hash('./r26-tiny-transmission-gpu-check.js'),stepperSHA256:hash('./r26-tiny-transmission-stepper.js')};
});
check('Executable independent stepper/hook CPU suite and separate owner helper preflight passed',()=>{
 const independent=JSON.parse(read('./r26-tiny-transmission-independent-check.json')),owner=JSON.parse(read('./r26-tiny-transmission-gpu-preflight.json'));
 assert.equal(independent.passed,true);assert.equal(owner.passed,true);
 return {independent:independent.summary??independent.counts,owner:owner.summary??owner.counts,scope:'CPU/source only; inert plumbing is not hardware optics'};
});
check('Root hardware artifact reports the exact bounded three-draw gate and no errors',()=>{
 const r=JSON.parse(read('./r26-tiny-transmission-actual-gpu.json'));assert.equal(r.actualGPU,true);assert.equal(r.passed,true);assert.equal(r.actualDraws,3);assert.equal(r.renderPasses,3);assert.equal(r.readbackBytes,1024);assert.deepEqual(r.glErrors,[]);assert.deepEqual(r.shaderErrors,[]);
 assert.equal(r.passes.length,3);assert.deepEqual(r.passes.map(p=>p.read.texels),[16,32,16]);assert.equal(r.passes[1].read.firstPartialPrefixBitwiseUnchanged,true);assert.ok(r.passes[1].read.secondTileMaximumTau>0);assert.ok(r.passes[2].read.maximumPhysicalTError<=1e-5);assert.ok(r.passes[2].read.maximumGPUVsQuantizedDoubleTError<=8e-6);
 assert.ok(r.checks.some(c=>c.name.includes('descriptors restored')&&c.passed));assert.ok(r.checks.some(c=>c.name.includes('outer READ/DRAW')&&c.passed));
 return {artifactSHA256:hash('./r26-tiny-transmission-actual-gpu.json'),checks:r.counts,readbackBytes:r.readbackBytes,physicalError:r.passes[2].read.maximumPhysicalTError,quantizedError:r.passes[2].read.maximumGPUVsQuantizedDoubleTError,scope:'Read of root artifact only; this audit makes no GPU/browser call'};
});
const report={schema:'glass-atoll.r26.tiny-helper-independent-read-audit.v1',dateUTC:new Date().toISOString(),actualGPURunByThisAudit:false,productionChanged:false,reviewDecision:'No remaining source/CPU blocker found for the frozen fixed tiny gate',passed:checks.every(c=>c.passed),counts:{passed:checks.filter(c=>c.passed).length,total:checks.length},manualReview:['Exact16×65 address domains and uint32 bit reinterpretation; packet64 positive witness.','Private original/packed fixture and double oracles before first await; trusted injected factory only after source pins.','Causal submit/read/accept; no published runtime target/T; first error retires later submissions.','Full named renderer/native/PACK/UNPACK/PBO/COPY_READ state restored before every timer yield; method descriptors restored.','One actual single-pass unblended RawShaderMaterial triangle per render; no clears or native input.'],limitations:['This source/CPU/artifact audit does not execute GL or rerun the root hardware check.','Fixed tiny success is not general chunk throughput, larger request admission, smoke physical completion or full-frame FPS.'],checks};
writeFileSync(new URL('./r26-tiny-helper-independent-read-audit.json',import.meta.url),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report,null,2));if(!report.passed)process.exitCode=1;
