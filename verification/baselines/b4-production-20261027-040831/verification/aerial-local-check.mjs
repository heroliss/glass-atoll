import assert from 'node:assert/strict';
import {writeFileSync} from 'node:fs';
import * as THREE from '../vendor/three.module.js';
import {createAerialPerspective,localAirSourceRGB} from '../aerial-perspective.js';
import {createLocalLights} from '../local-lights.js';
import {RAW_PER_CANDELA} from '../scene-radiometry.js';

const checks=[],add=(name,fn)=>{try{fn();checks.push({name,passed:true});}catch(error){checks.push({name,passed:false,error:String(error.stack)});}};
const close=(a,b,tolerance=1e-12)=>assert(Math.abs(a-b)<=tolerance*Math.max(1,Math.abs(a),Math.abs(b)),`${a} != ${b}`);
const scene=new THREE.Scene(),camera=new THREE.PerspectiveCamera(45,1,.15,24000);camera.position.set(0,2,0);camera.lookAt(0,2,-1);camera.updateMatrixWorld();
const local=createLocalLights(THREE,{scene}),renderer={capabilities:{maxTextureSize:16384}};
let air;
try{
  air=createAerialPerspective(THREE,renderer,{camera,localLights:local});
  add('factory shares exact local uniform objects, no copied exposure-scaled colours',()=>{
    for(const key of Object.keys(local.uniforms))assert.equal(air.uniforms[key],local.uniforms[key],key);
  });
  add('local source integration stays below fragment sampler limit',()=>{
    const budget=air.diagnostics().declaredSamplerBudget;assert.equal(budget.integration,5);assert.equal(budget.composite,8);assert(budget.composite<=16);
  });
  add('persistent sampling survives per-frame coefficient and quality updates',()=>{
    air.setSampling({steps:5,shadowTaps:1});
    for(let i=0;i<4;i++){air.configure({aerosolScale:8+i,quality:'high'});air.update({time:i,weather:{humidity:.6+i*.02},quality:'high'});}
    assert.equal(air.diagnostics().steps,5);assert.equal(air.diagnostics().treeShadowTapsPerStep,1);
  });
  add('sampling overrides independently cleared to current quality defaults',()=>{
    air.configure({quality:'high'});air.setSampling({steps:null});assert.equal(air.diagnostics().steps,8);assert.equal(air.diagnostics().treeShadowTapsPerStep,1);
    air.setSampling({shadowTaps:null});assert.equal(air.diagnostics().treeShadowTapsPerStep,2);
  });
  add('explicit sample counts are bounded and cannot divide by zero',()=>{
    air.setSampling({steps:999,shadowTaps:0});assert.equal(air.diagnostics().steps,8);assert.equal(air.diagnostics().treeShadowTapsPerStep,1);
  });
  add('invalid sampling patch is rejected atomically',()=>{
    air.setSampling({steps:4,shadowTaps:1});assert.throws(()=>air.setSampling({steps:7,shadowTaps:NaN}),TypeError);
    air.configure({aerosolScale:5});assert.deepEqual(air.diagnostics().samplingOverride,{steps:4,shadowTaps:1});
  });
  add('Rayleigh local source agrees with independent mu=0 formula, no Lambert factor',()=>{
    const result=localAirSourceRGB({incidentRGB:[2,3,4],cosine:0,scatteringRayleigh:[1e-5,2e-5,3e-5],scatteringMie:[0,0,0]});
    for(let c=0;c<3;c++)close(result[c],[2,3,4][c]*[1e-5,2e-5,3e-5][c]*3/(16*Math.PI));
  });
  add('isotropic local Mie source agrees with E beta /4pi',()=>{
    const result=localAirSourceRGB({incidentRGB:[2,3,4],cosine:.75,scatteringRayleigh:[0,0,0],scatteringMie:[1e-4,2e-4,3e-4],asymmetry:0});
    for(let c=0;c<3;c++)close(result[c],[2,3,4][c]*[1e-4,2e-4,3e-4][c]/(4*Math.PI));
  });
  add('forward HG local illumination is stronger than backscatter',()=>{
    const args={incidentRGB:[1,1,1],scatteringMie:[1e-4,1e-4,1e-4]};
    assert(localAirSourceRGB({...args,cosine:1})[0]>localAirSourceRGB({...args,cosine:-1})[0]*100);
  });
  add('no medium or no incident light creates no local radiance',()=>{
    assert.deepEqual(localAirSourceRGB({incidentRGB:[8,16,32]}),[0,0,0]);
    assert.deepEqual(localAirSourceRGB({scatteringRayleigh:[1,2,3],scatteringMie:[3,2,1]}),[0,0,0]);
  });
  add('sum of six local sources is additive in stored RGB',()=>{
    const beta=[1e-5,2e-5,3e-5],sum=[0,0,0];for(let i=1;i<=6;i++){const value=localAirSourceRGB({incidentRGB:[i,i*2,i*3],scatteringRayleigh:beta,cosine:0});for(let c=0;c<3;c++)sum[c]+=value[c];}
    const reference=localAirSourceRGB({incidentRGB:[21,42,63],scatteringRayleigh:beta,cosine:0});sum.forEach((v,c)=>close(v,reference[c]));
  });
  add('actual local-light colour contains raw reference and sceneScale exactly once',()=>{
    local.configure({mode:'on',lamps:[{enabled:true,brightness:1,color:'#ffffff'},{enabled:false},{enabled:false}],flashlight:{enabled:false}});
    local.update({frame:{time:0,dt:1/60,storageEV:3,sceneScale:8,rawPerCandela:RAW_PER_CANDELA},camera,sunAltitude:-20});
    const rgb=air.uniforms.uLocalColour.value[0];for(const value of [rgb.x,rgb.y,rgb.z])close(value,65*RAW_PER_CANDELA*8);
    const before=localAirSourceRGB({incidentRGB:[rgb.x,rgb.y,rgb.z],scatteringMie:[1e-4,1e-4,1e-4],asymmetry:0});
    local.setSceneExposure(4);const after=localAirSourceRGB({incidentRGB:air.uniforms.uLocalColour.value[0].toArray().slice(0,3),scatteringMie:[1e-4,1e-4,1e-4],asymmetry:0});
    after.forEach((v,c)=>close(v,2*before[c]));
  });
  add('local illumination can remain lit at night with zero sun',()=>{
    local.configure({mode:'on'});local.update({frame:{time:1,dt:1/60,storageEV:0,sceneScale:1,rawPerCandela:RAW_PER_CANDELA},camera,sunAltitude:-30});
    const rgb=air.uniforms.uLocalColour.value[0].toArray().slice(0,3);assert(rgb.every(v=>v>0));
    assert(localAirSourceRGB({incidentRGB:rgb,scatteringMie:[1e-4,1e-4,1e-4]})[0]>0);
  });
  add('absent localLights keeps original solar-only path and defaults',()=>{
    const solarOnly=createAerialPerspective(THREE,renderer,{camera});try{assert.equal(solarOnly.diagnostics().localLightsEnabled,false);assert.equal(solarOnly.diagnostics().steps,8);assert.equal(solarOnly.diagnostics().declaredSamplerBudget.composite,7);}finally{solarOnly.dispose();}
  });
}finally{air?.dispose();local.dispose();}
const report={date:new Date().toISOString(),passed:checks.every(c=>c.passed),count:checks.length,checks,limits:['CPU source algebra and actual module/shared-uniform/sampling configuration only. No GPU shader, visibility pixel, beam realism or performance claim.','Source-to-sample air extinction is not separately integrated; flashlight uses shared nine-tap shadow.','Sampling override is independent of per-frame coefficient updates.']};
writeFileSync(new URL('aerial-local-check.json',import.meta.url),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report,null,2));if(!report.passed)process.exitCode=1;
