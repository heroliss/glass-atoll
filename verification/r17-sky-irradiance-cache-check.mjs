import assert from 'node:assert/strict';
import {readFileSync,writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import * as THREE from '../vendor/three.module.js';
import {createCelestialController} from '../celestial-controller.js';

// These are CPU-only copies of the actual modules, with a counter at the
// existing numerical integral entry. The oracle disables only the saved
// baseline cache decision; all integration/combination formulas stay intact.
const current=readFileSync(new URL('../sky.js',import.meta.url),'utf8');
const baseline=readFileSync(new URL('./baselines/r17-irradiance-before-cache/sky.js',import.meta.url),'utf8');
async function instrument(source,label,{uncached=false}={}){
  source=source.replace("'./weather.js'",JSON.stringify(new URL('../weather.js',import.meta.url).href))
    .replace("'./night-sky.js'",JSON.stringify(new URL('../night-sky.js',import.meta.url).href));
  const signature='export function clearSkyIrradiance(sun,mieScale=1){';
  assert.equal(source.split(signature).length,2);
  source=source.replace(signature,signature+'__qa.integrations++;');
  const mean='nightSky.getStellarMeanRGB()??';
  assert.equal(source.split(mean).length,2);
  source=source.replace(mean,'(__qa.stellarMean??nightSky.getStellarMeanRGB())??');
  if(uncached){assert.equal(source.split('if(cacheKey!==skyLightingKey){').length,2);source=source.replace('if(cacheKey!==skyLightingKey){','if(true){');}
  // Reset is test-only: production fills the initially-null tuple at its
  // constructor lighting() call, before the returned object is observable.
  // 2026-11-05: ready became a lazy getter (night assets load on demand).
  const api='return {mesh,uniforms,get ready(){';
  if(label==='candidate'){assert.equal(source.split(api).length,2);source=source.replace(api,
    'return {__qaResetCache(){skyLightingKey=null;},mesh,uniforms,get ready(){');}
  source=`export const __qa={integrations:0,stellarMean:null};\n${source}\n//# sourceURL=r17-sky-${label}.mjs`;
  return import('data:text/javascript;base64,'+Buffer.from(source).toString('base64'));
}
const candidateModule=await instrument(current,'candidate'),oracleModule=await instrument(baseline,'oracle',{uncached:true}),legacyModule=await instrument(baseline,'legacy');
const options={seed:7183,weather:{coverage:0},night:{date:'2026-10-26T04:00:00Z'}};
const sky=candidateModule.createAtmosphere(THREE,options),oracle=oracleModule.createAtmosphere(THREE,options),legacy=legacyModule.createAtmosphere(THREE,options);
const qa=candidateModule.__qa,checks=[],observations=[];
const check=(name,fn)=>{try{checks.push({name,passed:true,evidence:fn()});}catch(error){checks.push({name,passed:false,error:error.stack});}};
const both=fn=>{fn(sky);fn(oracle);};
const equal=()=>{const actual=sky.lighting(),expected=oracle.lighting();assert.deepEqual(actual,expected);return actual;};
const frame=createCelestialController({utcMs:Date.parse('2026-10-26T04:00:00Z'),running:false}).state;
const sameRounded=(a,b)=>a.toPrecision(7)===b.toPrecision(7);
const miss=(name,fn)=>{const n=qa.integrations;both(fn);equal();assert.equal(qa.integrations-n,2,name);};
try{
  check('cold constructor computes two physical integrals once, equal to saved formula',()=>{
    assert.equal(qa.integrations,3); // One fixed reference + solar and lunar.
    equal();assert.equal(qa.integrations,3);return{clearSkyCalls:3,physicalCacheMisses:1};
  });
  check('repeated lighting reads return every field bit-for-bit without reintegration',()=>{
    const before=sky.lighting(),n=qa.integrations;for(let i=0;i<32;i++)assert.deepEqual(equal(),before);
    assert.equal(qa.integrations,n);return{lightingReads:32,additionalIntegralCalls:0};
  });
  check('same celestial values in distinct snapshot objects skip 120 former integral calls',()=>{
    both(s=>s.setCelestial(frame));legacy.setCelestial(frame);
    const n=qa.integrations,old=legacyModule.__qa.integrations,before=sky.lighting();
    for(let i=0;i<60;i++){const clone=structuredClone(frame);both(s=>s.setCelestial(clone));legacy.setCelestial(clone);assert.deepEqual(equal(),before);}
    assert.equal(qa.integrations-n,0);assert.equal(legacyModule.__qa.integrations-old,120);
    return{setCelestialCalls:60,candidateIntegralCalls:0,savedBaselineIntegralCalls:120,scope:'Same input, as in paused rAF; not measured frame time'};
  });
  check('each mutable numeric dependency is compared by value, including old 7-digit collisions',()=>{
    const vectorComponents=['x','y','z'],rows=[];
    for(const [name,change] of [
      ...vectorComponents.map(c=>['sun.'+c,s=>{const v=s.uniforms.sunPosition.value,a=v[c],b=a+2**-38;assert.ok(sameRounded(a,b));v[c]=b;}]),
      ['intensity',s=>{const u=s.uniforms.uSkyIntensity,a=u.value,b=a+2**-38;assert.ok(sameRounded(a,b));u.value=b;}],
      ['solarDistanceGain',s=>{const u=s.uniforms.uSolarDistanceGain,a=u.value,b=a+2**-38;assert.ok(sameRounded(a,b));u.value=b;}],
      ['mieScale',s=>{const u=s.uniforms.uAirMieScale,a=u.value,b=a+2**-38;assert.ok(sameRounded(a,b));u.value=b;}],
      ...vectorComponents.map(c=>['moon.'+c,s=>{const v=s.uniforms.uMoonDirection.value,a=v[c],b=a+2**-38;assert.ok(sameRounded(a,b));v[c]=b;}]),
    ]){both(s=>s.setCelestial(frame));equal();miss(name,change);rows.push(name);}
    const changed=structuredClone(frame);changed.moonSourceRatio*=1+2**-38;
    assert.ok(sameRounded(frame.moonSourceRatio,changed.moonSourceRatio));both(s=>s.setCelestial(frame));equal();miss('moonSourceRatio',s=>s.setCelestial(changed));rows.push('moonSourceRatio');
    qa.stellarMean=[1e-5,2e-5,3e-5];oracleModule.__qa.stellarMean=qa.stellarMean.slice();equal();
    for(let c=0;c<3;c++){const n=qa.integrations,a=qa.stellarMean[c],b=a*(1+2**-38);assert.ok(sameRounded(a,b));qa.stellarMean[c]=b;oracleModule.__qa.stellarMean[c]=b;equal();assert.equal(qa.integrations-n,2);rows.push('stellarMean.'+c);}
    assert.equal(rows.length,13);return{dependencies:rows,oldRoundedKeysCollide:true,additionalCallsPerMutation:2};
  });
  check('tiny intensity mutation updates actual irradiance rather than returning rounded-key stale RGB',()=>{
    qa.stellarMean=null;oracleModule.__qa.stellarMean=null;both(s=>s.setCelestial(frame));both(s=>s.setSun({intensity:1}));legacy.setCelestial(frame);legacy.setSun({intensity:1});
    const before=sky.lighting().physicalSkyIrradiance,oldBefore=legacy.lighting().physicalSkyIrradiance,v=1+2**-40;
    assert.ok(sameRounded(1,v));both(s=>s.setSun({intensity:v}));legacy.setSun({intensity:v});
    const after=equal().physicalSkyIrradiance;assert.notDeepEqual(after,before);assert.deepEqual(legacy.lighting().physicalSkyIrradiance,oldBefore);
    return{intensityBefore:1,intensityAfter:v,physicalBefore:before,physicalAfter:after,savedRoundedKeyReturnsStale:true};
  });
  check('normal public sun moon air and stellar setters match the uncached baseline exactly',()=>{
    miss('public sun direction',s=>s.setSun({elevation:17,azimuth:215,intensity:.8}));
    miss('public aerosol',s=>s.setAirMieScale(13.83813578196115));
    miss('public lunar intensity',s=>s.setNight({moonIntensity:1.4}));
    miss('public stellar intensity',s=>s.setNight({starIntensity:2}));
    const n=qa.integrations;both(s=>s.setNight({moonIntensity:1.4,starIntensity:2}));equal();assert.equal(qa.integrations,n);
    return{changedSetters:4,repeatedSameSettingsAdditionalCalls:0};
  });
  check('celestial distance and normalized direction tiny changes are not hidden by setCelestial',()=>{
    both(s=>s.setCelestial(frame));equal();const distance=structuredClone(frame);distance.sun.distanceAU*=1+2**-38;
    miss('distance',s=>s.setCelestial(distance));const sun=structuredClone(distance);sun.sunDirection[0]+=2**-38;
    miss('normalized sun',s=>s.setCelestial(sun));const moon=structuredClone(sun);moon.moonDirection[2]+=2**-38;
    miss('moon direction',s=>s.setCelestial(moon));return{changes:['solar distance','normalized solar direction','lunar direction']};
  });
  check('storageP changes never invalidate raw irradiance and still rescale all stored fields',()=>{
    const raw=equal().physicalSkyIrradiance,n=qa.integrations;
    for(const P of [-24,-1,0,12.5,24]){both(s=>s.setStorageExposureEV(P));const l=equal();assert.deepEqual(l.physicalSkyIrradiance,raw);assert.deepEqual(l.skyIrradiance,raw.map(v=>v*2**P));assert.equal(l.preExposureEV,P);}
    assert.equal(qa.integrations,n);return{storageEVs:[-24,-1,0,12.5,24],additionalIntegralCalls:0};
  });
  check('cloud and diffuse-air controls preserve cache while updating their own uniforms and outputs',()=>{
    const raw=equal().physicalSkyIrradiance,n=qa.integrations;
    for(const shape of [0,1,2])both(s=>s.setCloudShape(shape));both(s=>s.setCloudBaseContinuity(1));both(s=>s.setDiffuseAirEnabled(false));
    both(s=>s.setWeather({coverage:.85,humidity:.92,thickness:1600},{immediate:true}));
    const l=equal();assert.deepEqual(l.physicalSkyIrradiance,raw);assert.deepEqual(l.physicalAirDiffuseRadianceRGB,[0,0,0]);assert.equal(sky.uniforms.uCloudBaseContinuity.value,1);assert.equal(sky.uniforms.uCloudShapeBlend.value,2);assert.equal(qa.integrations,n);
    both(s=>s.setDiffuseAirEnabled(true));equal();assert.equal(qa.integrations,n);return{additionalIntegralCalls:0,reason:'These controls do not enter existing clear-sky irradiance formula'};
  });
  check('stellar mean becoming available and same-array element mutation both invalidate exactly',()=>{
    const mean=[.00001,.00002,.00003],old=sky.lighting().physicalSkyIrradiance,n=qa.integrations;
    qa.stellarMean=mean;oracleModule.__qa.stellarMean=mean;assert.notDeepEqual(equal().physicalSkyIrradiance,old);assert.equal(qa.integrations-n,2);
    const n2=qa.integrations;mean[1]+=.000001;equal();assert.equal(qa.integrations-n2,2);
    const n3=qa.integrations;qa.stellarMean=mean.slice();oracleModule.__qa.stellarMean=mean.slice();equal();assert.equal(qa.integrations,n3);
    qa.stellarMean=null;oracleModule.__qa.stellarMean=null;equal();return{asyncContentChangeAdditionalCalls:2,inPlaceMutationAdditionalCalls:2,equalNewArrayAdditionalCalls:0,scope:'CPU injected mean availability, no asset or GPU load'};
  });
  check('snapshot cache tuple and values restore on normal, nested and throwing paths',()=>{
    both(s=>s.setCelestial(frame));both(s=>s.setStorageExposureEV(-1));const frozen=sky.captureSnapshot(),frozenOracle=oracle.captureSnapshot(),frozenLighting=equal();
    both(s=>s.setSun({elevation:48,azimuth:80,intensity:2}));both(s=>s.setNight({starIntensity:.4,moonIntensity:.5}));both(s=>s.setAirMieScale(2));both(s=>s.setStorageExposureEV(10));
    const live=sky.captureSnapshot(),liveOracle=oracle.captureSnapshot(),liveLighting=equal(),n=qa.integrations;
    sky.withSnapshot(frozen,()=>oracle.withSnapshot(frozenOracle,()=>{
      assert.deepEqual(equal(),frozenLighting);const afterFirst=qa.integrations;equal();assert.equal(qa.integrations,afterFirst);
      sky.withSnapshot(live,()=>oracle.withSnapshot(liveOracle,()=>assert.deepEqual(equal(),liveLighting)));
      const restored=qa.integrations;assert.deepEqual(equal(),frozenLighting);assert.equal(qa.integrations,restored);
    }));
    assert.equal(qa.integrations-n,4);const restored=qa.integrations;assert.deepEqual(equal(),liveLighting);assert.equal(qa.integrations,restored);
    assert.throws(()=>sky.withSnapshot(frozen,()=>{sky.lighting();throw new Error('intentional snapshot exception');}),/intentional snapshot/);
    const failedRestore=qa.integrations;assert.deepEqual(equal(),liveLighting);assert.equal(qa.integrations,failedRestore);
    assert.throws(()=>sky.withSnapshot(frozen,()=>Promise.resolve(1)),/must be synchronous/);assert.deepEqual(equal(),liveLighting);
    return{nestedCacheMisses:2,restoredLiveReintegration:0,exceptionAndAsyncRestored:true};
  });
  check('initially empty cache and signed-zero dependencies are conservative and recoverable',()=>{
    sky.__qaResetCache();const n=qa.integrations;equal();assert.equal(qa.integrations-n,2);
    for(const sign of [0,-0,0]){const before=qa.integrations;sky.uniforms.sunPosition.value.x=sign;oracle.uniforms.sunPosition.value.x=sign;equal();assert.equal(qa.integrations-before,2);}
    return{initialNullReintegrations:2,signedZeroComparison:'Object.is keeps +0 and -0 distinct; conservative extra misses are permitted'};
  });
  check('CPU physical formulas, all actual material shaders and sampler/pass budgets stay unchanged',()=>{
    const block=(source,start,end)=>source.slice(source.indexOf(start),source.indexOf(end,source.indexOf(start)));
    assert.equal(block(current,'export function solarTransmittance','// This exact density'),block(baseline,'export function solarTransmittance','// This exact density'));
    assert.equal(sky.mesh.material.vertexShader,oracle.mesh.material.vertexShader);assert.equal(sky.mesh.material.fragmentShader,oracle.mesh.material.fragmentShader);
    const combination='cachedSkyIrradiance=solarE.map((v,i)=>v*intensityUniform.value*uniforms.uSolarDistanceGain.value+moonE[i]*n.moonSourceRatio*[1,.96,.90][i]+stellarMean[i]*Math.PI);';
    assert.ok(current.includes(combination)&&baseline.includes(combination));
    for(const pattern of [/sampler(?:2D|3D|Cube)/g,/renderer\.render\(/g,/new THREE\.WebGLRenderTarget/g])assert.equal([...current.matchAll(pattern)].length,[...baseline.matchAll(pattern)].length);
    return{changedPhysicalFormulas:0,changedGPUShaders:0,newSamplers:0,newPasses:0,newRenderTargets:0};
  });
}finally{sky.dispose();oracle.dispose();legacy.dispose();}
const sha=source=>createHash('sha256').update(source).digest('hex');
const report={schema:'glass-atoll.r17-sky-irradiance-cache-cpu.v1',date:new Date().toISOString(),actualGPU:false,passed:checks.every(c=>c.passed),counts:{passed:checks.filter(c=>c.passed).length,total:checks.length},sourceSHA256:sha(current),baselineSHA256:sha(baseline),dependencies:['sunDirection.x','sunDirection.y','sunDirection.z','skyIntensity','solarDistanceGain','airMieScale','moonDirection.x','moonDirection.y','moonDirection.z','moonSourceRatio','stellarMean.r','stellarMean.g','stellarMean.b'],checks,observations,limits:['Source instrumentation only counts existing CPU integration calls; no GPU/browser execution.','The saved baseline oracle disables its cache decision, preserving integration and physical combination formulas.','Star mean availability uses a CPU injection; actual catalogue GPU loading is not tested.','Same-input work reduction is proven, but actual native frame-time/FPS benefit is not measured.','Continuously changing astronomical directions still require the unchanged integrals.']};
writeFileSync(new URL('./r17-sky-irradiance-cache-check.json',import.meta.url),JSON.stringify(report,null,2));
console.log(JSON.stringify({passed:report.passed,counts:report.counts,sourceSHA256:report.sourceSHA256,baselineSHA256:report.baselineSHA256,failed:checks.filter(c=>!c.passed)},null,2));
if(!report.passed)process.exitCode=1;
