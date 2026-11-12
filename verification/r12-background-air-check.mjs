import assert from 'node:assert/strict';
import fs from 'node:fs';import crypto from 'node:crypto';
import * as THREE from '../vendor/three.module.js';
import {createAerialPerspective,marineAirCoefficients,localAirRadianceBound,AERIAL_DEFAULTS} from '../aerial-perspective.js';
import {createLocalLights} from '../local-lights.js';
const checks=[],check=(name,fn)=>{try{checks.push({name,passed:true,evidence:fn()});}catch(e){checks.push({name,passed:false,error:String(e.stack||e)});}};
const close=(a,b,abs=1e-12,rel=1e-11)=>assert(Math.abs(a-b)<=abs+rel*Math.abs(b),`${a} != ${b}`);
const read=p=>fs.readFileSync(new URL(p,import.meta.url),'utf8'),hash=s=>crypto.createHash('sha256').update(s).digest('hex');
const runtime=read('../aerial-perspective.js'),baseline=read('r12-background-air-baseline-aerial-perspective.js');
const original=baseline.replace("'../sun-shadows.js'","'./sun-shadows.js'").replace("'../local-lights.js'","'./local-lights.js'");
function glslFunction(source,name){const start=source.indexOf('    '+name),open=source.indexOf('{',start);assert(start>=0&&open>=0);let balance=1,i=open+1;while(balance&&i<source.length){balance+=(source[i]==='{')-(source[i]==='}');i++;}return source.slice(start,i);}
const camera=new THREE.PerspectiveCamera(40,1,.15,24000),scene=new THREE.Scene(),local=createLocalLights(THREE,{scene}),air=createAerialPerspective(THREE,{capabilities:{maxTextureSize:16384}},{camera,localLights:local});
try{
  check('Saved baseline reconstructs the exact pre-edit source; opaque GLSL arithmetic unchanged',()=>{
    assert.equal(hash(original),'4d8c4f29f97c0495df6edd235d2d05e54d29766240d219b0b2e06a74ce9ac201');
    for(const name of ['vec3 sourceAt(','void integrateAir(','void coefficientsAt(','vec3 segmentIntegral('])assert.equal(glslFunction(runtime,name),glslFunction(original,name),name);
    return{baselineSHA256:hash(original),functions:['sourceAt','integrateAir','coefficientsAt','segmentIntegral']};
  });
  check('QA flag defaults to zero and no new raw budget; configure/setter survive frame updates',()=>{
    assert.equal(AERIAL_DEFAULTS.backgroundLocalScattering,0);assert.equal(air.getRadianceBound().maxRGB,0);assert.equal(air.uniforms.uBackgroundLocalScattering.value,0);
    air.setBackgroundLocalScattering(1);for(let i=0;i<10;i++){air.configure({quality:'high',aerosolScale:8});air.update({time:i,weather:{humidity:.68}});}assert.equal(air.diagnostics().backgroundLocalScattering,1);assert.equal(air.uniforms.uBackgroundLocalScattering.value,1);
    air.setBackgroundLocalScattering(false);assert.equal(air.getRadianceBound().maxRGB,0);return{updates:10};
  });
  check('Invalid flag rejected before mutating a mixed patch; booleans normalise explicitly',()=>{
    air.configure({aerosolScale:8,backgroundLocalScattering:0});
    for(const value of [NaN,Infinity,-1,2,'1',null,{},undefined]){assert.throws(()=>air.configure({aerosolScale:48,backgroundLocalScattering:value}),TypeError);assert.equal(air.diagnostics().coefficients.aerosolScale,8);assert.equal(air.diagnostics().backgroundLocalScattering,0);}
    air.configure({backgroundLocalScattering:true});assert.equal(air.diagnostics().backgroundLocalScattering,1);air.configure({backgroundLocalScattering:false});assert.equal(air.diagnostics().backgroundLocalScattering,0);return{invalidPatches:8};
  });
  check('Actual binding shares source identity; raw local-air budget independent of P',()=>{
    local.configure({mode:'on',flashlight:{enabled:true}});local.update({frame:{time:0,dt:1/60,storageEV:0,sceneScale:1},camera,clusters:[{position:[0,150,-120],radius:2,range:280,referenceCandela:2e6,linearColor:[1,.2,.03]}]});
    air.setBackgroundLocalScattering(1);const bound=air.getRadianceBound();assert(bound.maxRGB>0);for(const P of [-16,-3,0,4,16]){local.setSceneExposure(P);assert.deepEqual(air.getRadianceBound(),bound);}
    for(const name of Object.keys(local.uniforms))assert.equal(air.uniforms[name],local.uniforms[name]);
    air.configure({enabled:false});assert.equal(air.getRadianceBound().maxRGB,0);air.configure({enabled:true});return{bound,storageEVs:[-16,-3,0,4,16]};
  });
  check('Independent phase/near-field envelope covers all RGB channels and allowed media extremes',()=>{
    const sources=Array.from({length:6},(_,i)=>({rawRGB:[i+1,(i+1)*.3,(7-i)*2],radius:[.065,.065,.065,.025,.1,12][i],range:[45,45,45,45,280,280][i]}));
    let trials=0,largestRatio=0;
    for(const g of [0,.76,.9])for(const humidity of [0,.68,.95])for(const aerosolScale of [0,8,48])for(const rayleighScale of [0,1,8])for(const D of [1,12000,24000]){
      const beta=marineAirCoefficients({asymmetry:g,humidity,aerosolScale,rayleighScale}),bound=localAirRadianceBound({sources,coefficients:beta,maxDistance:D});
      const pR=3/(8*Math.PI),pM=(1+g)/(4*Math.PI*(1-g)**2);
      for(let c=0;c<3;c++){
        const E=sources.reduce((s,v,i)=>s+v.rawRGB[c]/(i<3?Math.max(.01,v.radius*v.radius):v.radius*v.radius),0),r=beta.betaRayleighRGB[c],m=beta.betaMieExtinctionRGB[c],ms=beta.betaMieScatteringRGB[c];
        // Independent variable-density segment walk; source at its maximum
        // allowed phase and E, with altitude varying per segment. This deliberately
        // overestimates the real finite-range/cone/shadow local source.
        for(const steps of [1,6,8]){let T=1,S=0;for(let k=0;k<steps;k++){const ds=D*((k+1)**2-k*k)/steps**2,h=[0,35,500,4000][k%4],br=r*Math.exp(-h/beta.rayleighHeight),bm=m*Math.exp(-h/beta.aerosolHeight),bms=ms*Math.exp(-h/beta.aerosolHeight),sigma=br+bm;const integral=sigma>0?-Math.expm1(-sigma*ds)/sigma:ds;S+=T*E*(br*pR+bms*pM)*integral;T*=Math.exp(-sigma*ds);}assert(S<=bound.maximumRGB[c]*(1+2e-12)+1e-12);if(bound.maximumRGB[c]>0)largestRatio=Math.max(largestRatio,S/bound.maximumRGB[c]);trials++;}
      }
      assert(bound.maximumRGB.every(Number.isFinite));
    }
    return{trials,largestRatio,nearFieldDenominators:sources.map((s,i)=>i<3?Math.max(.01,s.radius*s.radius):s.radius*s.radius)};
  });
  check('Zero source/medium/finite path cannot create an HDR bound; overflow inputs remain finite',()=>{
    assert.equal(localAirRadianceBound().maxRGB,0);const source={rawRGB:[6,12,24],radius:2,range:280};
    assert.equal(localAirRadianceBound({sources:[source],coefficients:marineAirCoefficients({aerosolScale:0,rayleighScale:0})}).maxRGB,0);
    assert.equal(localAirRadianceBound({sources:[source],maxDistance:0}).maxRGB,0);
    assert.equal(localAirRadianceBound({sources:[{...source,rawRGB:[0,0,0]}]}).maxRGB,0);
    const huge=localAirRadianceBound({sources:[{...source,rawRGB:[Number.MAX_VALUE,1,2],radius:1e-200}]});assert(huge.maximumRGB.every(Number.isFinite));return{hugeBound:huge.maxRGB};
  });
  check('No additional sampler, render pass, temporal state or source scaling added',()=>{
    assert.deepEqual(air.diagnostics().declaredSamplerBudget,{integration:5,composite:8});assert.equal((runtime.match(/new THREE\.WebGLRenderTarget\(/g)||[]).length,(original.match(/new THREE\.WebGLRenderTarget\(/g)||[]).length);
    const background=glslFunction(runtime,'vec3 backgroundLocalSourceAt(');assert(!background.includes('uSunRGB'));assert(!background.includes('sceneScale'));assert(background.includes('localIncident(p,i,localL)'));
    assert(runtime.includes('fragColor=vec4(colour.rgb+S,colour.a)'));assert(!runtime.includes('Math.random'));return{passes:2,samplers:air.diagnostics().declaredSamplerBudget};
  });
}finally{air.dispose();local.dispose();}
const report={passed:checks.every(c=>c.passed),count:checks.length,checks,runtimeSHA256:hash(runtime),baselineSHA256:hash(original),limits:['CPU/module/bound/source checks only; actual GPU byte parity, continuity, HDR safety and scene realism need the GPU helper and root A/B.','Shared finite-range midpoint integration retained, including its quadrature error; no source-to-sample extinction or extra sky/sun scattering.']};
fs.writeFileSync(new URL('r12-background-air-check.json',import.meta.url),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report,null,2));if(!report.passed)process.exitCode=1;
