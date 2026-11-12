import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import {fileURLToPath,pathToFileURL} from 'node:url';
const root=fileURLToPath(new URL('../../',import.meta.url));
const baselinePath=new URL('before/fireworks-physics.js',import.meta.url);
const source=fs.readFileSync(baselinePath);
const temp=path.join(root,`.ui-r2-isolated-before-physics-${process.pid}.mjs`);
assert.equal(path.dirname(path.resolve(temp)),path.resolve(root));
assert.equal(fs.existsSync(temp),false);
const originalTest=fs.readFileSync(new URL('before/intensity-scale-check.mjs',import.meta.url),'utf8');
const name='configure_only_changes_future_events_and_explicit_queued_scale_survives';
const line=originalTest.split(/\r?\n/).find(value=>value.startsWith(`check('${name}',`));
assert.ok(line);
const sha=bytes=>crypto.createHash('sha256').update(bytes).digest('hex');
const runs=[];
try{
  // This exact archived module is placed next to the original dependency graph;
  // no imports, model equations or test expectations are rewritten.
  fs.writeFileSync(temp,source);
  const baseline=await import(pathToFileURL(temp).href);
  const current=await import(new URL('../../fireworks-physics.js',import.meta.url));
  for(const [kind,module]of [['archived-before',baseline],['current',current]]){
    const check=(testName,fn)=>{try{runs.push({kind,name:testName,originalCasePassed:true,evidence:fn()});}catch(error){runs.push({kind,name:testName,originalCasePassed:false,code:error.code,actual:error.actual,expected:error.expected,error:error.message});}};
    Function('check','assert','createFireworksSimulation',line)(check,assert,module.createFireworksSimulation);
  }
}finally{if(fs.existsSync(temp))fs.unlinkSync(temp);}
const verified=runs.length===2&&runs.every(run=>run.originalCasePassed===false&&run.code==='ERR_ASSERTION')&&JSON.stringify(runs[0].actual)===JSON.stringify([1,16,64,4])&&JSON.stringify(runs[0].actual)===JSON.stringify(runs[1].actual)&&JSON.stringify(runs[0].expected)===JSON.stringify([1,16]);
const report={schema:'glass-atoll.ui-r2-preexisting-intensity-case-proof.v1',passed:verified,scope:'Unchanged original single testcase against exact archived module and current module; both fail the same old two-slot/default-queue assumption. Not a full-suite pass.',actualGPU:false,browserUsed:false,archivedModuleSHA256:sha(source),currentModuleSHA256:sha(fs.readFileSync(new URL('../../fireworks-physics.js',import.meta.url))),unchangedTestLineSHA256:sha(line),temporaryModuleRemoved:!fs.existsSync(temp),runs};
fs.writeFileSync(new URL('intensity-preexisting-proof.json',import.meta.url),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report,null,2));if(!verified)process.exitCode=1;
