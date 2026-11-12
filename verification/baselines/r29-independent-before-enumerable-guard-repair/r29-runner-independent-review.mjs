// Independent CPU-only R29 review. Never requests a browser or WebGL context.
import fs from 'node:fs';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import {R29_CALIBRATION_PINS as pins} from './r29-native-calibration-pins.js';
const read=p=>fs.readFileSync(new URL(p,import.meta.url),'utf8');
const sha=x=>crypto.createHash('sha256').update(x).digest('hex');
const source=read('./r29-native-calibration-runtime.js'),checks=[];
function extract(name){const start=source.indexOf('function '+name+'(');assert(start>=0);const end=source.indexOf('\n}\n',start);assert(end>=0);return source.slice(start,end+2);}
function freeze(v){if(v&&typeof v==='object'){Object.values(v).forEach(freeze);Object.freeze(v);}return v;}
function check(name,fn){try{checks.push({name,passed:true,evidence:fn()??null});}catch(e){checks.push({name,passed:false,error:String(e.stack??e)});}}
const makeGuard=p=>new Function('PINS','SPECS','R29_CALIBRATION_RUNTIME_REVISION','demand','return ('+extract('validatePins')+');')(p,{source:true,joint:true,light:true},'r29-complete-native-lifetime-v1',(v,m)=>assert(v,m));
check('All mandatory cached paths are enumerable: no skipped mandatory fetch via count-preserving extra key',()=>{
  assert.equal(makeGuard(pins)('source'),pins.jobs.source);
  const p=structuredClone(pins),required='../main.js',descriptor=Object.getOwnPropertyDescriptor(p.sources,required);
  Object.defineProperty(p.sources,required,{...descriptor,enumerable:false});
  p.sources['../index.html']='0'.repeat(64);
  freeze(p);
  assert.equal(Object.keys(p.sources).length,Object.keys(pins.sources).length);
  assert(Object.hasOwn(p.sources,required));
  assert(!Object.entries(p.sources).some(([k])=>k===required));
  assert.throws(()=>makeGuard(p)('source'),/pin|identity/i);
  return {requiredPath:required,requiredFetchWouldBeSkipped:true,extraEnumerablePath:'../index.html',rejectedBeforeCapture:true};
});
const report={schema:'glass-atoll.r29-runner-independent-review.v1',actualGPU:false,passed:checks.every(x=>x.passed),counts:{passed:checks.filter(x=>x.passed).length,total:checks.length},runtimeSHA256:sha(source),pinsModuleSHA256:sha(read('./r29-native-calibration-pins.js')),pinsManifestSHA256:sha(read('./r29-native-calibration-pins.json')),checks};
fs.writeFileSync(new URL('./r29-runner-independent-review.json',import.meta.url),JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify(report,null,2));if(!report.passed)process.exitCode=1;
