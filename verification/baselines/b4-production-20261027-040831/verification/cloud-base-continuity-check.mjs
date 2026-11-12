import * as THREE from '../vendor/three.module.js';
import {createAtmosphere} from '../sky.js';
import {readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
const saved=await readFile(new URL('./baselines/cloud-base-before-sky.js',import.meta.url),'utf8');
const baselineCode=saved.replace("'./weather.js'",JSON.stringify(new URL('../weather.js',import.meta.url).href)).replace("'./night-sky.js'",JSON.stringify(new URL('../night-sky.js',import.meta.url).href));
const {createAtmosphere:createBaseline}=await import('data:text/javascript;base64,'+Buffer.from(baselineCode).toString('base64'));
const a=createAtmosphere(THREE),old=createBaseline(THREE),checks=[],observations=[];
const check=(name,passed,evidence)=>checks.push({name,passed:!!passed,evidence});
const R=6360000,point=(x,h,z)=>[x,Math.sqrt((R+h)**2-x*x-z*z)-R,z],smooth=(a,b,x)=>{const t=Math.max(0,Math.min(1,(x-a)/(b-a)));return t*t*(3-2*t);};
let seed=81251;const rand=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
check('new_candidate_defaults_to_legacy0',a.diagnostics().cloudBaseContinuity===0&&a.uniforms.uCloudBaseContinuity.value===0);
for(const s of [a,old]){s.uniforms.uCloudWeatherOrigin.value.set(.421875,.734375);s.update({time:.0825,wind:1.8});}
const profiles=[{name:'fair',settings:{temperature:29,humidity:.68,coverage:.35,thickness:950,shear:1.1},best:[-750,7500]},{name:'humid',settings:{temperature:28,humidity:.95,coverage:.9,thickness:1800,shear:1.8},best:[-6000,-9000]}];
try{
  for(const profile of profiles){
    a.setWeather(profile.settings,{immediate:true});old.setWeather(profile.settings,{immediate:true});const u=a.uniforms,base=u.uCloudBase.value,H=u.uCloudTop.value-base,top=base+H,points=[];
    for(let i=0;i<4000;i++){const near=i%2===0,x=near?profile.best[0]+(rand()-.5)*3000:(rand()-.5)*64000,z=near?profile.best[1]+(rand()-.5)*3000:(rand()-.5)*64000,h=i%4===0?base+rand()*.06*H:base+(-.02+rand()*1.04)*H;points.push(point(x,h,z));}
    const columns=[];for(const [ax,az]of [[1,0],[0,1],[Math.SQRT1_2,Math.SQRT1_2]])for(let i=0;i<256;i++){const d=(i/255-.5)*3000;columns.push([profile.best[0]+ax*d,profile.best[1]+az*d]);}
    for(const [x,z]of columns)for(const h of [base-.001,base+.001,base+.01,base+.1,base+1,base+10,base+.052*H,top-.001,top+.001])points.push(point(x,h,z));
    for(const shape of [0,1,1.25,1.5,1.75,2]){
      a.setCloudShape(shape);old.setCloudShape(shape);a.setCloudBaseContinuity(0);const reference=points.map(p=>old.cloudDensityAt(p)),v0=points.map(p=>a.cloudDensityAt(p));let oldDiff=0;for(let i=0;i<points.length;i++)oldDiff+=!Object.is(reference[i],v0[i]);
      check(`${profile.name}_shape${shape}_flag0_matches_saved64ed_formula_bitwise`,oldDiff===0,{samples:points.length,different:oldDiff});
      a.setCloudBaseContinuity(1);let increases=0,negative=0,nonfinite=0,unchangedHighDiff=0,legacyDiff=0,maxIncrease=0;
      for(let i=0;i<points.length;i++){const p=points[i],v=a.cloudDensityAt(p),h=Math.hypot(p[0],R+p[1],p[2])-R;negative+=v<0;nonfinite+=!Number.isFinite(v);maxIncrease=Math.max(maxIncrease,v-v0[i]);increases+=v>v0[i]+1e-12;if((h-base)/H>=.052)unchangedHighDiff+=!Object.is(v,v0[i]);if(shape<=1)legacyDiff+=!Object.is(v,v0[i]);}
      check(`${profile.name}_shape${shape}_candidate_nonnegative_finite_no_density_increase`,increases===0&&negative===0&&nonfinite===0,{samples:points.length,increases,negative,nonfinite,maxIncrease});
      check(`${profile.name}_shape${shape}_abovePoint052_is_bitwise_unchanged`,unchangedHighDiff===0,{different:unchangedHighDiff});
      if(shape<=1)check(`${profile.name}_legacy_shape${shape}_flag1_bitwise_preserved`,legacyDiff===0,{different:legacyDiff});
    }
    a.setCloudShape(2);old.setCloudShape(2);const edges=[];
    for(const epsilon of [-.001,.001,.01,.1,1,10]){
      const probes=columns.map(([x,z])=>point(x,base+epsilon,z));a.setCloudBaseContinuity(0);const A=probes.map(p=>a.cloudDensityAt(p));a.setCloudBaseContinuity(1);const B=probes.map(p=>a.cloudDensityAt(p));
      const maximumA=Math.max(...A),maximumB=Math.max(...B),meanA=A.reduce((s,x)=>s+x,0)/A.length,meanB=B.reduce((s,x)=>s+x,0)/B.length,cap=epsilon>0?u.uCloudMoisture.value*smooth(0,.052,(epsilon+2e-6)/H):0;
      edges.push({epsilonMetres:epsilon,maximumA,maximumB,meanA,meanB,mathematicalUpperWith2MicrometreCoordinateAllowance:cap});
      check(`${profile.name}_base_${epsilon}m_continuity_bound`,maximumB<=cap*(1+1e-6)+1e-14,{maximumB,cap});
      if(epsilon===.001)check(`${profile.name}_actual_saved_jump_removed_not_just_zero_probes`,maximumA>.001&&maximumB<1e-7,{maximumA,maximumB});
    }
    check(`${profile.name}_upper_inner_outer_remain_zero`,columns.every(([x,z])=>a.cloudDensityAt(point(x,top-.001,z))===0&&a.cloudDensityAt(point(x,top+.001,z))===0));
    // Same shadow integration/positions. A lower density cannot darken its
    // Beer transmittance; this need not visibly change the coarse3tap shadow.
    const ground=columns.filter((_,i)=>i%8===0).map(([x,z])=>[x,1,z]);a.setCloudBaseContinuity(0);const shadowA=ground.map(p=>a.cloudShadowAt(p));a.setCloudBaseContinuity(1);const shadowB=ground.map(p=>a.cloudShadowAt(p));
    check(`${profile.name}_shared_CPU_shadow_does_not_darken`,shadowB.every((v,i)=>v>=shadowA[i]-1e-12&&v<=1+1e-12));
    // Independent coarse maximum-support interval vs fine candidate density.
    const cam=[-60,8,-51],observer=[cam[0],R+cam[1],cam[2]],mips=u.uCloudSupport.value.mipmaps,mod=(x,n)=>((x%n)+n)%n;let supportSamples=0,positive=0,falseRejections=0;
    for(let ray=0;ray<128;ray++){
      const az=rand()*Math.PI*2,el=(.5+rand()*55)*Math.PI/180,rd=[Math.sin(az)*Math.cos(el),Math.sin(el),Math.cos(az)*Math.cos(el)],r=Math.hypot(...observer),b=observer[0]*rd[0]+observer[1]*rd[1]+observer[2]*rd[2],exitSphere=radius=>-b+Math.sqrt(Math.max(0,b*b-(r-radius)*(r+radius))),entry=Math.max(0,exitSphere(R+base)),exit=Math.min(60000,exitSphere(R+top));if(exit<=entry)continue;
      const ds=(exit-entry)/32,shear=u.uCloudShearOffset.value,footprint=ds*Math.max(Math.abs(rd[0])+Math.abs(shear.x)*.001,Math.abs(rd[2])+Math.abs(shear.y)*.001),level=Math.max(0,Math.min(9,Math.ceil(Math.log2(Math.max(1,footprint/125))))),mip=mips[level];let lo=exit,hi=entry;
      for(let i=0;i<32;i++){const distance=entry+(i+.5)*ds,p=cam.map((v,c)=>v+rd[c]*distance),above=Math.hypot(p[0],R+p[1],p[2])-R-base,wx=(p[0]-u.uCloudOffset.value.x-shear.x*above/1000)/64000+u.uCloudWeatherOrigin.value.x,wz=(p[2]-u.uCloudOffset.value.y-shear.y*above/1000)/64000+u.uCloudWeatherOrigin.value.y,possible=mip.data[(mod(Math.floor(wz*mip.width),mip.width)*mip.width+mod(Math.floor(wx*mip.width),mip.width))*4]/255;if(possible>=.44-.4*u.uCloudCoverage.value){lo=Math.min(lo,entry+i*ds);hi=Math.max(hi,entry+(i+1)*ds);}}
      for(let i=0;i<256;i++){const d=entry+(i+.5)/256*(exit-entry),rho=a.cloudDensityAt(cam.map((v,c)=>v+rd[c]*d));supportSamples++;if(rho>1e-6){positive++;if(d<lo-ds-1e-6||d>hi+ds+1e-6)falseRejections++;}}
    }
    check(`${profile.name}_candidate_stays_inside_conservative_weather_support`,positive>0&&falseRejections===0,{supportSamples,positive,falseRejections});
    observations.push({name:profile.name,base,top,columns:columns.length,edges});
  }
  a.setCloudShape(2);a.setCloudBaseContinuity(0);const A=a.captureSnapshot();a.setCloudBaseContinuity(1);const B=a.captureSnapshot();
  check('snapshot_contains_candidate_uniform_and_distinct_density_key',A.uniforms.uCloudBaseContinuity===0&&B.uniforms.uCloudBaseContinuity===1&&A.cloudDensityKey!==B.cloudDensityKey,{A:A.cloudDensityKey,B:B.cloudDensityKey});
  let inner=false;a.withSnapshot(A,()=>{a.lighting();inner=a.uniforms.uCloudBaseContinuity.value===0;a.withSnapshot(B,()=>{inner&&=a.uniforms.uCloudBaseContinuity.value===1;});inner&&=a.uniforms.uCloudBaseContinuity.value===0;});
  check('nested_snapshot_restores_uniform_key_and_original_state',inner&&a.diagnostics().cloudBaseContinuity===1&&a.captureSnapshot().cloudDensityKey===B.cloudDensityKey);
  let threw=false;try{a.withSnapshot(A,()=>{a.lighting();throw new Error('intentional QA');});}catch{threw=true;}
  check('throwing_snapshot_restores_candidate_atomically',threw&&a.uniforms.uCloudBaseContinuity.value===1);
  let protectedMutation=false;try{a.withSnapshot(A,()=>a.setCloudBaseContinuity(1));}catch{protectedMutation=true;}
  check('setter_rejects_mutation_inside_frozen_snapshot',protectedMutation&&a.uniforms.uCloudBaseContinuity.value===1);
  let invalid=false;try{a.setCloudBaseContinuity(.5);}catch{invalid=true;}check('setter_only_accepts0_or1_without_partial_mutation',invalid&&a.uniforms.uCloudBaseContinuity.value===1);
  let asyncRejected=false;try{a.withSnapshot(A,()=>Promise.resolve(1));}catch{asyncRejected=true;}check('async_snapshot_is_rejected_and_restored',asyncRejected&&a.uniforms.uCloudBaseContinuity.value===1);
  check('material_uses_the_same_candidate_uniform',a.mesh.material.uniforms.uCloudBaseContinuity===a.uniforms.uCloudBaseContinuity);
  check('cloud_formula_added_no_sampler_or_quadrature',((saved.match(/uniform highp sampler/g)||[]).length===((await readFile(new URL('../sky.js',import.meta.url),'utf8')).match(/uniform highp sampler/g)||[]).length)&&a.diagnostics().cloudSteps===64);
}finally{a.dispose();old.dispose();}
const sourceSHA256=createHash('sha256').update(await readFile(new URL('../sky.js',import.meta.url))).digest('hex'),baselineSHA256=createHash('sha256').update(saved).digest('hex');
const report={date:new Date().toISOString(),passed:checks.every(c=>c.passed),passedCount:checks.filter(c=>c.passed).length,total:checks.length,sourceSHA256,baselineSHA256,checks,observations,limits:'CPU production closure and saved64ed baseline; no GPU compilation/view/whole-scene performance or visual acceptance'};
await writeFile(new URL('./cloud-base-continuity-check.json',import.meta.url),JSON.stringify(report,null,2));console.log(JSON.stringify({passed:report.passed,passedCount:report.passedCount,total:report.total,sourceSHA256,baselineSHA256,failed:checks.filter(c=>!c.passed),edges:observations.map(o=>({name:o.name,oneMillimetre:o.edges.find(e=>e.epsilonMetres===.001)}))},null,2));if(!report.passed)process.exitCode=1;
