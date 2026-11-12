import fs from 'node:fs';import assert from 'node:assert/strict';import crypto from 'node:crypto';
const root=new URL('../',import.meta.url),read=p=>fs.readFileSync(new URL(p,root),'utf8'),hash=s=>crypto.createHash('sha256').update(s).digest('hex'),checks=[];
const check=async(name,fn)=>{try{checks.push({name,passed:true,evidence:await fn()});}catch(error){checks.push({name,passed:false,error:String(error.stack||error)});}};
const before=read('verification/r13-shore-first-1b8-shoreline-dynamics.js.txt'),now=read('shoreline-dynamics.js');
const oldLines=`    Cell l=p.x>0?insideCell(p-ivec2(1,0)):ghostCell(p,0,world-vec2(uCell.x*.5,0));
    Cell r=p.x+1<uSize.x?insideCell(p+ivec2(1,0)):ghostCell(p,1,world+vec2(uCell.x*.5,0));
    Cell b=p.y>0?insideCell(p-ivec2(0,1)):ghostCell(p,2,world-vec2(0,uCell.y*.5));
    Cell t=p.y+1<uSize.y?insideCell(p+ivec2(0,1)):ghostCell(p,3,world+vec2(0,uCell.y*.5));`;
const newLines=`    Cell l,r,b,t;
    if(p.x>0)l=insideCell(p-ivec2(1,0));else l=ghostCell(p,0,world-vec2(uCell.x*.5,0));
    if(p.x+1<uSize.x)r=insideCell(p+ivec2(1,0));else r=ghostCell(p,1,world+vec2(uCell.x*.5,0));
    if(p.y>0)b=insideCell(p-ivec2(0,1));else b=ghostCell(p,2,world-vec2(0,uCell.y*.5));
    if(p.y+1<uSize.y)t=insideCell(p+ivec2(0,1));else t=ghostCell(p,3,world+vec2(0,uCell.y*.5));`;
await check('the production delta is exactly four Cell ternaries rewritten as equivalent branches',()=>{
  assert.equal(hash(before),'1b8f46e37143f6f869319ab6e17ad1f44b16175fcea56f8cb734aee33d957e07');assert.equal(before.split(oldLines).length,2);assert.equal(before.replace(oldLines,newLines),now);return{before:hash(before),after:hash(now),CPUFluxCFLVolumeClockUnchanged:true};
});
await check('the first actual GPU shader failure is preserved with its failing gate',()=>{
  const original=read('verification/r13-shore-gpu-first.json'),preserved=read('verification/r13-shore-first-1b8-r13-shore-gpu-first.json.txt');assert.equal(original,preserved);const r=JSON.parse(original);assert.equal(r.passed,false);assert.deepEqual(r.counts,{passed:2,total:9});assert(r.shaderErrors[0].fragment.includes('ternary operator is not allowed for structures'));return{counts:r.counts,actualGPU:r.actualGPU,firstReportSHA256:hash(original)};
});
await check('boundary and accepted runtime/audio incumbents remain the protected bytes',()=>{
  const expected={'shoreline-boundary.js':'c6fd1347bdb246f9c1c9a440f522b48d365b2fd135c08e3ecb7e38568a678707','hydrodynamics.js':'6ac8daffa0c27bd2387990edc7930ea60e91755e0261fd132eeb5cc3785c5ad9','waves.js':'af1d6b1559b701b8f1d36c53bbd89dd721e22bb792517a58543473f4629396d4','spectral-waves.js':'58ae823709ff9b5db57b638813ff2350bdd70405c38f4c3892adae999afaf82a','sand.js':'37b156b3ef9e9574596e284ed6b5e69bff35f0ffbc1e7089779d87e14fa61e91','fireworks.js':'bb6a0080f34d714379eb860a45f1e595c2d82241fb62cd04dfb4cb2b601b949b','fireworks-audio.js':'4e5ede41813249f062e50b212553e5e1821c27feaead8416b68ab51ba1b8ec31'};
  for(const [file,sha]of Object.entries(expected))assert.equal(hash(read(file)),sha,file);return expected;
});
function transactionOracle(){let busy=false,tick=0;return{async advance(){if(busy)throw new Error('busy');busy=true;try{for(let i=0;i<3;i++){tick++;await Promise.resolve();}}finally{busy=false;}},dispose(){if(busy)throw new Error('busy');},snapshot(){return{tick,busy};}};}
await check('a rejected-promise await advances the valid transaction, but synchronous queries observe tick1',async()=>{
  const old=transactionOracle(),pendingOld=old.advance();let oldRejected=false;try{await old.advance();}catch{oldRejected=true;}const oldObserved=old.snapshot();await pendingOld;
  const next=transactionOracle(),pending=next.advance(),reentrant=next.advance().then(()=>false,()=>true);let disposeRejected=false;try{next.dispose();}catch{disposeRejected=true;}const synchronous=next.snapshot(),advanceRejected=await reentrant;await pending;
  assert(oldRejected&&oldObserved.tick===2);assert(synchronous.busy&&synchronous.tick===1&&advanceRejected&&disposeRejected);assert.equal(next.snapshot().busy,false);return{oldObservedTickAfterAwait:oldObserved.tick,newObservedTickBeforeAwait:synchronous.tick,busyContractUnchanged:true,actualGPU:false};
});
const report={schema:'glass-atoll.r13-shore-compile-repair-check.v1',dateUTC:new Date().toISOString(),actualGPU:false,passed:checks.every(c=>c.passed),counts:{passed:checks.filter(c=>c.passed).length,total:checks.length},checks,limits:['Mechanical source equivalence and JavaScript microtask oracle only. New actual GPU compilation/numerics remain unrun.','No CFL/volume/timing tolerance change and no main-host integration.']};
fs.writeFileSync(new URL('r13-shore-compile-repair-check.json',import.meta.url),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report,null,2));if(!report.passed)process.exitCode=1;
