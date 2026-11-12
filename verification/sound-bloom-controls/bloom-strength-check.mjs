import fs from 'node:fs';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import * as THREE from '../../vendor/three.module.js';
import {createOpticalBloom,opticalPSFBudget} from '../../optical-bloom.js';

const checks=[];
const check=(name,fn)=>{try{checks.push({name,passed:true,evidence:fn()});}catch(error){checks.push({name,passed:false,error:error.stack});}};
check('Former full-strength budgets remain exact without a strength argument',()=>{
  assert.deepEqual(opticalPSFBudget(),{direct:.982,bloom:.018,ghost:0,veil:0,total:.018});
  assert.deepEqual(opticalPSFBudget({bloom:true,flare:true}),{direct:.982,bloom:.013,ghost:.003,veil:.002,total:.018});
  return {legacyBloom:.018,legacyCombined:.018};
});
check('Amount scales bloom only; every combination remains a nonnegative unit mixture',()=>{
  let combinations=0;
  for(const bloom of [false,true])for(const flare of [false,true])for(const amount of [0,.1,.25,.5,.75,1]){
    const budget=opticalPSFBudget({bloom,flare,bloomStrength:amount});
    assert.ok(Object.values(budget).every(value=>Number.isFinite(value)&&value>=0&&value<=1));
    assert.ok(Math.abs(budget.direct+budget.bloom+budget.ghost+budget.veil-1)<=2*Number.EPSILON);
    assert.equal(budget.bloom,(bloom?(flare?.013:.018):0)*amount);
    assert.equal(budget.ghost,flare?.003:0);assert.equal(budget.veil,flare?.002:0);
    combinations++;
  }
  assert.equal(opticalPSFBudget({bloomStrength:.75}).bloom/.018,.75);
  return {combinations,productionDefaultBudget:opticalPSFBudget({bloomStrength:.75})};
});
check('Actual factory retains chosen amount across toggles and bypasses zero without render work',()=>{
  const rows=[];
  for(const quality of ['legacy','gaussian']){
    // No renderer methods: an accidental zero-strength draw fails this check.
    const psf=createOpticalBloom(THREE,{}, {quality});
    try{
      assert.equal(psf.state.bloomStrength,1);
      psf.configure({bloomStrength:.75});assert.ok(Math.abs(psf.state.budget.bloom-.0135)<Number.EPSILON);
      psf.configure(false);assert.equal(psf.state.bloomStrength,.75);assert.equal(psf.state.enabled,false);
      psf.configure(true);assert.equal(psf.state.bloomStrength,.75);assert.equal(psf.state.enabled,true);
      psf.configure({bloomStrength:0});const token={};assert.equal(psf.render(token),token);
      assert.equal(psf.resultTarget,null);assert.equal(psf.state.passes,0);assert.equal(psf.state.bloom,true);
      psf.configure({flare:true});assert.equal(psf.state.enabled,true);assert.equal(psf.state.budget.total,.005);
      assert.equal(psf.state.passes,quality==='gaussian'?13:5);
      rows.push({quality,zeroAmountFlareBudget:psf.state.budget});
    }finally{psf.dispose();}
  }
  return rows;
});
check('Malformed amounts reject atomically in both budget and factory',()=>{
  const psf=createOpticalBloom(THREE,{}),invalid=[-.01,1.01,NaN,Infinity,-Infinity,'0.75',null,undefined,false,{},[]];
  try{
    psf.configure({bloomStrength:.4});const before=psf.state;
    for(const value of invalid){
      // Missing arguments use the compatible default; explicit undefined in
      // configure is rejected so it cannot silently reset a chosen amount.
      if(value!==undefined)assert.throws(()=>opticalPSFBudget({bloomStrength:value}));
      assert.throws(()=>psf.configure({bloomStrength:value}));assert.deepEqual(psf.state,before);
    }
  }finally{psf.dispose();}
  return {invalidInputs:invalid.length};
});
const root=new URL('../../',import.meta.url),sourcePins=Object.fromEntries(['optical-bloom.js','lens.js'].map(file=>[file,createHash('sha256').update(fs.readFileSync(new URL(file,root))).digest('hex')]));
const report={schema:'glass-atoll.bloom-strength.cpu.v1',date:new Date().toISOString(),passed:checks.every(row=>row.passed),checks,sourcePins,scope:'Pure unit-mixture algebra and actual Three factory configuration/bypass. No shader execution, GPU/scene readback or visual acceptance.'};
fs.writeFileSync(new URL('bloom-strength-check.json',import.meta.url),JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({passed:report.passed,checks:checks.length,failed:checks.filter(row=>!row.passed)},null,2));
if(!report.passed)process.exitCode=1;
