import fs from 'node:fs';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import {createDisabledSunShadowEarlyReturnCandidate as apply,restoreDisabledSunShadowEarlyReturnCandidate as undo} from './r31-disabled-shadow-candidate.js';
const root=new URL('../',import.meta.url),production=new URL('sun-shadows.js',root),source=fs.readFileSync(production,'utf8');
const hash=s=>crypto.createHash('sha256').update(s).digest('hex'),checks=[];
function check(name,fn){try{fn();checks.push({name,passed:true});}catch(e){checks.push({name,passed:false,error:String(e)});}}
const candidate=apply(source);
check('Full source exact reverse including newline bytes',()=>assert.equal(undo(candidate),source));
check('Both LF and CRLF round trip strictly',()=>{for(const newline of ['\n','\r\n']){const s=source.replace(/\r?\n/g,newline);assert.equal(undo(apply(s)),s);}});
check('Disabled return precedes projection and derivatives',()=>{const p=candidate.indexOf('float treeSunVisibility('),a=candidate.indexOf('if(uSunShadowEnabled<0.5)return 1.0;',p);assert(a>p&&a<candidate.indexOf('vec4 projected=',p)&&a<candidate.indexOf('dFdx(',p));});
check('Already applied, absent symbol and drift all reject',()=>{assert.throws(()=>apply(candidate));assert.throws(()=>apply(source.replace('treeSunVisibility','renamedVisibility')));assert.throws(()=>apply(source.replace('uSunShadowEnabled<0.5||coordinate','uSunShadowEnabled<=0.5||coordinate')));});
const load=async s=>import('data:text/javascript;base64,'+Buffer.from(s).toString('base64'));
const [baselineModule,candidateModule]=await Promise.all([load(source),load(candidate)]);
check('Actual module exports and JS binding/refraction functions unchanged',()=>{assert.deepEqual(Object.keys(candidateModule),Object.keys(baselineModule));assert.equal(candidateModule.createSunShadowBinding.toString(),baselineModule.createSunShadowBinding.toString());assert.equal(candidateModule.refractedSolarEntry.toString(),baselineModule.refractedSolarEntry.toString());});
check('Production source untouched and original later frustum/PCF recoverable',()=>{assert.equal(fs.readFileSync(production,'utf8'),source);assert.equal(undo(candidate),source);assert(candidateModule.sunShadowGLSL.includes('for(int j=-1;j<=1;j++)for(int i=-1;i<=1;i++)'));});
const report={schema:'glass-atoll.r31-disabled-shadow-source-candidate-check.v1',actualGPU:false,nativeContextCalls:0,productionEdits:0,passed:checks.every(c=>c.passed),counts:{passed:checks.filter(c=>c.passed).length,total:checks.length},sourcePins:{production:hash(source),candidate:hash(candidate),transformer:hash(fs.readFileSync(new URL('./r31-disabled-shadow-candidate.js',import.meta.url)))},checks,scope:'Source/module/exact inverse only; no GPU derivative or pixel/time claim'};
fs.writeFileSync(new URL('./r31-disabled-shadow-candidate-check.json',import.meta.url),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report,null,2));if(!report.passed)process.exitCode=1;
