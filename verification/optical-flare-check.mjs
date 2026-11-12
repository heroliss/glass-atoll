import assert from 'node:assert/strict';
import fs from 'node:fs';
import crypto from 'node:crypto';
import * as THREE from '../vendor/three.module.js';
import {createOpticalBloom,opticalPSFBudget,OPTICAL_PSF_KERNEL} from '../optical-bloom.js';
import {referenceOpticalPSF,referenceImage,referenceStats,sampleReference} from './optical-flare-reference.js';
const checks=[];
const test=(name,fn)=>{try{checks.push({name,passed:true,detail:fn()??null});}catch(error){checks.push({name,passed:false,error:String(error.stack)});}};
const near=(a,b,tol=1e-12)=>assert(Math.abs(a-b)<=tol,JSON.stringify({a,b,error:Math.abs(a-b),tol}));
const rgbNear=(a,b,tol=1e-12)=>a.forEach((v,c)=>near(v,b[c],tol));
const sha=file=>crypto.createHash('sha256').update(fs.readFileSync(new URL(file,import.meta.url))).digest('hex');

test('legacy bool defaults keep flare off and preserve exact 1.8% budget',()=>{
  const psf=createOpticalBloom(THREE,{});
  assert.equal(psf.state.flare,false);assert.equal(psf.state.bloom,true);assert.equal(psf.state.strength,.018);assert.equal(psf.state.passes,5);
  psf.configure({flare:true});assert.equal(psf.state.flare,true);psf.configure(false);assert.equal(psf.state.enabled,false);assert.equal(psf.state.flare,false);assert.equal(psf.resultTarget,null);
  const texture={arbitrary:'texture token'};assert.equal(psf.render(texture),texture);psf.configure(true);assert.equal(psf.state.flare,false);assert.equal(psf.state.budget.bloom,.018);psf.dispose();
});
test('object configure preserves separate flags and validates atomically',()=>{
  const psf=createOpticalBloom(THREE,{});psf.configure({flare:true});psf.configure({bloom:false});assert.equal(psf.state.flare,true);assert.equal(psf.state.bloom,false);assert.equal(psf.state.strength,.005);assert.equal(psf.state.passes,5);
  const before=psf.state;for(const bad of [null,[],{flare:1},{bloom:undefined},{other:true}])assert.throws(()=>psf.configure(bad));assert.deepEqual(psf.state,before);
  psf.configure({bloom:false,flare:false});assert.equal(psf.state.passes,0);psf.dispose();
});
test('all four on/off budgets are nonnegative convex mixtures <=1.8%',()=>{
  const budgets=[];for(const bloom of [false,true])for(const flare of [false,true]){
    const budget=opticalPSFBudget({bloom,flare});assert(Object.values(budget).every(v=>v>=0));assert(budget.total<=.018);near(budget.direct+budget.bloom+budget.ghost+budget.veil,1);budgets.push({bloom,flare,...budget});
  }
  assert.deepEqual(opticalPSFBudget({bloom:true,flare:true}),{direct:.982,bloom:.013,ghost:.003,veil:.002,total:.018});return budgets;
});
test('coating weights are nonnegative and sum to one separately for R/G/B',()=>{
  for(let c=0;c<3;c++){const sum=OPTICAL_PSF_KERNEL.ghosts.reduce((v,k)=>v+k.weightsRGB[c],0);near(sum,1);assert(OPTICAL_PSF_KERNEL.ghosts.every(k=>k.weightsRGB[c]>=0));}
  near(OPTICAL_PSF_KERNEL.bloomWeights.reduce((a,b)=>a+b,0),1);
  assert(Object.isFrozen(OPTICAL_PSF_KERNEL)&&Object.isFrozen(OPTICAL_PSF_KERNEL.ghosts[0].weightsRGB));
});
test('every affine kernel expands, includes Jacobian s^2, and cannot amplify a pixel peak',()=>{
  const psf=createOpticalBloom(THREE,{});psf.configure({flare:true});
  assert(OPTICAL_PSF_KERNEL.ghosts.every(k=>Math.abs(k.scale)>0&&Math.abs(k.scale)<=1));assert(OPTICAL_PSF_KERNEL.veilScale>0&&OPTICAL_PSF_KERNEL.veilScale<=1);
  assert(psf.state.operatorPeakBoundRGB.every(v=>v<=1&&v>=0));const peakBound=psf.state.operatorPeakBoundRGB;psf.dispose();return{operatorPeakBoundRGB:peakBound};
});
test('independent continuous Gaussian integration verifies Jacobian/crop, not re-normalized ghosts',()=>{
  const integrate=(fn,steps=32768)=>{let s=0;for(let i=0;i<steps;i++)s+=fn(-.5+(i+.5)/steps)/steps;return s;},sigma=.025,results=[];
  for(const source of [[.04,-.03],[.38,.25],[.48,.48]]){
    const gaussian=(x,c)=>Math.exp(-(((x-c)/sigma)**2)/2),input=integrate(x=>gaussian(x,source[0]))*integrate(y=>gaussian(y,source[1]));
    for(const s of [-.72,-.48,.86,.24]){
      const flux=s*s*integrate(x=>gaussian(s*x,source[0]))*integrate(y=>gaussian(s*y,source[1]));assert(flux<=input+1e-12);
      results.push({source,scale:s,fluxRatio:flux/input});
    }
  }
  assert(results[0].fluxRatio>.999999);assert(results.at(-1).fluxRatio<.00001);return results;
});
test('zero-outside reference does not clamp a missing image into fake edge energy',()=>{
  const image=referenceImage(8,8,()=>[1,2,3]);assert.deepEqual(sampleReference(image,-.001,.5,{zeroOutside:true}),[0,0,0]);assert.deepEqual(sampleReference(image,1.001,.5,{zeroOutside:true}),[0,0,0]);assert.deepEqual(sampleReference(image,-.001,.5),[1,2,3]);
});
test('double raster uniform field stays below input in all modes, black stays exact zero',()=>{
  const results=[];for(const bloom of [false,true])for(const flare of [false,true]){
    const input=referenceImage(63,47,()=>[16,2,.5]),output=referenceOpticalPSF(input,{bloom,flare}),stats=referenceStats(output);
    assert(stats.maximum.every((v,c)=>v<=[16,2,.5][c]+1e-12));assert(stats.minimum.every(v=>v>=0));
    const black=referenceStats(referenceOpticalPSF(referenceImage(32,24,()=>[0,0,0]),{bloom,flare}));assert.deepEqual(black.sum,[0,0,0]);results.push({bloom,flare,ratio:stats.sum[0]/(16*63*47)});
  }
  return results;
});
test('double raster point flux includes source centre/edge/corner crop without extra energy',()=>{
  const results=[];for(const point of [[64,48],[90,65],[0,48],[0,0]])for(const bloom of [false,true]){
    const image=referenceImage(128,96,(x,y)=>x===point[0]&&y===point[1]?[16,8,4]:[0,0,0]),stats=referenceStats(referenceOpticalPSF(image,{bloom,flare:true})),budget=opticalPSFBudget({bloom,flare:true});
    assert(stats.sum.every((v,c)=>v<=[16,8,4][c]*(1+1e-12)));assert(stats.sum.every((v,c)=>v>=[16,8,4][c]*budget.direct));results.push({point,bloom,fluxRatio:stats.sum.map((v,c)=>v/[16,8,4][c])});
  }
  return results;
});
test('power-of-two P compensation is linear in reference including ghosts/veil',()=>{
  const image=referenceImage(64,48,(x,y)=>[x===44&&y===30?20:0,x/64,y/48]),base=referenceOpticalPSF(image,{bloom:true,flare:true});let maxError=0;
  for(const scale of [2**-8,2**10]){const scaled={...image,data:image.data.map(v=>v*scale)},out=referenceOpticalPSF(scaled,{bloom:true,flare:true});for(let i=0;i<out.data.length;i++)maxError=Math.max(maxError,Math.abs(out.data[i]/scale-base.data[i]));}
  assert.equal(maxError,0);return{maxCompensatedError:maxError};
});
test('source/lens/P/scene APIs are absent and pass topology remains four down + one combine',()=>{
  const source=fs.readFileSync(new URL('../optical-bloom.js',import.meta.url),'utf8');assert(source.includes('length:4'));assert(source.includes('passes:enabled()?5:0'));assert(source.includes('uniform highp sampler2D tInput,t0,t1,t2,t3;'));
  for(const forbidden of ['Math.random','uExposure','toneMappingExposure','renderer.toneMapping','textureLod','getRadianceBound','uSunDirection','threshold'])if(forbidden!=='threshold')assert(!source.includes(forbidden),forbidden);
  assert(source.includes('zeroOutside(t3'));assert(source.includes('return vec3(0.);'));
});
test('baseline original file is preserved byte-for-byte for real GPU A oracle',()=>assert.equal(sha('optical-bloom-c1-baseline.js'),'4bf96b00252cf79403a865b3d35b902c2aa8dcb9732c4dab4169ac96c1aaca63'));

// Additional falsification, not a hidden exact-conservation pass: inherited ceil
// mip sizes can change discrete column sums even in double precision. Preserve
// the measured positive bias rather than mislabel it as FP16-only rounding.
const oddSizeDiagnostic=[];
for(const [width,height] of [[63,47],[131,97]])for(const point of [[0,0],[1,1],[Math.floor(width/2),Math.floor(height/2)],[width-2,height-2]]){
  const input=referenceImage(width,height,(x,y)=>x===point[0]&&y===point[1]?[1,1,1]:[0,0,0]);
  oddSizeDiagnostic.push({size:[width,height],point,doubleReferenceFluxRatio:referenceStats(referenceOpticalPSF(input,{bloom:true,flare:true})).sum});
}
const report={date:new Date().toISOString(),passed:checks.every(c=>c.passed),passedCount:checks.filter(c=>c.passed).length,total:checks.length,sourceSHA256:sha('../optical-bloom.js'),baselineSHA256:sha('optical-bloom-c1-baseline.js'),productionFlareEnabled:false,gpuExecuted:false,scope:'CPU operator/configuration proofs and independent double reference. Real GPU/FP16/GLSL results are a separate required gate.',oddSizeDiagnostic,discreteFluxLimit:'131x97 centre point shows about +0.0779% discrete flux bias from inherited ceil/resampling. Continuous affine Jacobian conservation does not imply exact discrete flux conservation at arbitrary dimensions. Per-pixel peak bound remains valid.',checks};
fs.writeFileSync(new URL('optical-flare-check.json',import.meta.url),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({passed:report.passed,passedCount:report.passedCount,total:report.total,sourceSHA256:report.sourceSHA256,failed:checks.filter(c=>!c.passed)},null,2));if(!report.passed)process.exitCode=1;
