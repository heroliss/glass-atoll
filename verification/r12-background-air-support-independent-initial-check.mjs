import assert from 'node:assert/strict';
import {readFileSync,writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import * as THREE from '../vendor/three.module.js';
import {AERIAL_DEFAULTS,exponentialHeightIntegral,supportLocalAirRadianceBound,marineAirCoefficients,createAerialPerspective} from '../aerial-perspective.js';
import {createLocalLights} from '../local-lights.js';

const runtime=readFileSync(new URL('../aerial-perspective.js',import.meta.url),'utf8');
const checks=[],check=(name,fn)=>{try{checks.push({name,passed:true,evidence:fn()});}catch(error){checks.push({name,passed:false,error:String(error.stack||error)});}};
let seed=0x126a8f9c;
const random=()=>{seed=(Math.imul(1664525,seed)+1013904223)>>>0;return seed/2**32;};
const logRandom=(a,b)=>10**(a+(b-a)*random());

// Independent formula uses the LESS attenuated endpoint and expm1, with no
// subtraction of endpoint densities and no small-x Taylor branch.
function stableReference(y,dy,s,H){
  if(s===0)return 0;
  if(dy===0)return s*Math.exp(-Math.max(y,0)/H);
  const end=y+dy*s;
  if(y<=0&&end<=0)return s;
  let ground=0,aboveS=s,minimumHeight=Math.min(y,end);
  if(y<0){ground=-y/dy;aboveS=s-ground;minimumHeight=0;}
  else if(end<0){aboveS=-y/dy;ground=s-aboveS;minimumHeight=0;}
  const x=Math.abs(dy)*aboveS/H;
  const above=x===Infinity?Math.exp(-minimumHeight/H)*H/Math.abs(dy):aboveS*Math.exp(-minimumHeight/H)*(-Math.expm1(-x)/x);
  return ground+above;
}

function adaptiveSimpson(f,a,b,absolute=1e-9,depth=26){
  const m=(a+b)/2,fa=f(a),fm=f(m),fb=f(b),whole=(b-a)*(fa+4*fm+fb)/6;
  function walk(a,b,fa,fm,fb,whole,tolerance,left){
    const m=(a+b)/2,l=(a+m)/2,r=(m+b)/2,fl=f(l),fr=f(r);
    const first=(m-a)*(fa+4*fl+fm)/6,second=(b-m)*(fm+4*fr+fb)/6,delta=first+second-whole;
    if(left<=0||Math.abs(delta)<=15*tolerance)return first+second+delta/15;
    return walk(a,m,fa,fl,fm,first,tolerance/2,left-1)+walk(m,b,fm,fr,fb,second,tolerance/2,left-1);
  }
  return walk(a,b,fa,fm,fb,whole,absolute,depth);
}

check('Height integral matches independent stable endpoint formula over fixed and logarithmic extremes',()=>{
  const cases=[];
  for(const y of [-1000,-1,0,1e-9,2,1200,1e5,1e6])for(const dy of [-1,-.1,-1e-12,0,1e-12,.1,1])for(const s of [0,1,50,12000,24000])for(const H of [50,1200,8000])cases.push([y,dy,s,H]);
  for(let i=0;i<12000;i++)cases.push([(random()<.2?-1:1)*logRandom(-12,7),(random()<.5?-1:1)*logRandom(-16,0),logRandom(-10,7),logRandom(-3,7)]);
  cases.push([1e300,-1,1e300,1200],[0,1e-300,1e300,1200],[0,1,1e300,.001],[1e300,0,1e300,1200]);
  let maximumRatio=0,worst=null;
  for(const [y,dy,s,H] of cases){
    const actual=exponentialHeightIntegral(y,dy,s,H),expected=stableReference(y,dy,s,H);
    const tolerance=1e-10+2e-11*Math.abs(expected),ratio=Math.abs(actual-expected)/tolerance;
    if(ratio>maximumRatio){maximumRatio=ratio;worst={y,dy,s,H,actual,expected,tolerance};}
    assert(Number.isFinite(actual)&&actual>=0&&actual<=s*(1+1e-12)+1e-12,JSON.stringify({y,dy,s,H,actual}));
    assert(ratio<=1,JSON.stringify(worst));
  }
  return {cases:cases.length,maximumRatio,worst};
});

check('Height integral matches piecewise adaptive quadrature across ground and near-horizontal cases',()=>{
  const cases=[[-10,.01,24000,50],[100,-.01,24000,50],[0,0,24000,50],[1,1e-12,24000,1200],[1,-1e-12,24000,1200],[1e6,-1,24000,50],[-1e-8,1e-12,24000,8000],[100,-1,100,50],[0,1,24000,50]];
  for(let i=0;i<600;i++)cases.push([-500+random()*3000,random()*2-1,random()*24000,logRandom(Math.log10(50),Math.log10(8000))]);
  let maximumRatio=0,worst=null;
  for(const [y,dy,s,H] of cases){
    const crossings=[0,s],crossing=-y/dy;if(crossing>0&&crossing<s)crossings.splice(1,0,crossing);
    // Normalize the integrand by its maximum density on each segment. This
    // prevents a small absolute stopping threshold from accepting a poor
    // relative estimate of a very thin high-altitude optical column.
    let expected=0;for(let i=1;i<crossings.length;i++){
      const lo=crossings[i-1],hi=crossings[i],minimumHeight=Math.max(0,Math.min(y+dy*lo,y+dy*hi));
      const normalized=adaptiveSimpson(t=>Math.exp(-(Math.max(0,y+dy*t)-minimumHeight)/H),lo,hi,1e-10,28);
      expected+=Math.exp(-minimumHeight/H)*normalized;
    }
    const actual=exponentialHeightIntegral(y,dy,s,H),tolerance=1e-12+2e-10*Math.abs(expected),ratio=Math.abs(actual-expected)/tolerance;
    if(ratio>maximumRatio){maximumRatio=ratio;worst={y,dy,s,H,actual,expected,tolerance};}assert(ratio<=1,JSON.stringify(worst));
  }
  return {cases:cases.length,maximumRatio,worst};
});

const gauss={};
for(const name of ['GL6X','GL6W','GL8X','GL8W'])gauss[name]=runtime.match(new RegExp('const float '+name+'\\[8\\]=float\\[8\\]\\(([^)]*)\\)'))[1].split(',').map(Number);

check('Actual Gauss arrays have positive used weights, unit panel measure, and 12/16 node budgets',()=>{
  const rows=[];
  for(const n of [6,8]){
    const x=gauss['GL'+n+'X'].slice(0,n),w=gauss['GL'+n+'W'].slice(0,n),sum=w.reduce((a,b)=>a+b,0);
    assert(x.every(v=>Math.abs(v)<1));assert(w.every(v=>v>0));assert(Math.abs(sum-2)<1e-14);
    for(let i=0;i<n;i++){assert(Math.abs(x[i]+x[n-1-i])<1e-14);assert.equal(w[i],w[n-1-i]);}
    rows.push({nodesPerPanel:n,maximumNodesPerLight:2*n,weightSum:sum,minimumWeight:Math.min(...w)});
  }
  return rows;
});

check('Independent Jacobian/denominator inequality and positive quadrature obey source bound',()=>{
  let trials=0,maximumJacobianRatio=0,maximumQuadratureRatio=0;
  for(let trial=0;trial<30000;trial++){
    const radius=logRandom(-4,3),perpendicular=logRandom(-6,5),h=Math.max(radius,perpendicular),t=(random()<.5?-1:1)*logRandom(-8,8);
    const denominator=Math.max(radius*radius,perpendicular*perpendicular+h*h*t*t),ratio=h*(1+t*t)/denominator/(2/h);
    assert(ratio<=1+2e-14);maximumJacobianRatio=Math.max(maximumJacobianRatio,ratio);
    const a=-Math.PI/2+Math.PI*random(),b=a+(Math.PI/2-a)*random(),middle=Math.max(a,Math.min(b,0)),n=trial%2?6:8;
    let integrated=0,angularMeasure=0;
    for(const [lo,hi]of [[a,middle],[middle,b]]){
      const half=(hi-lo)/2,mid=(hi+lo)/2;
      for(let k=0;k<n;k++){
        const theta=mid+half*gauss['GL'+n+'X'][k],tan=Math.tan(theta),weight=half*gauss['GL'+n+'W'][k];
        integrated+=weight*h*(1+tan*tan)/Math.max(radius*radius,perpendicular*perpendicular+h*h*tan*tan);angularMeasure+=weight;
      }
    }
    assert(angularMeasure<=Math.PI*(1+1e-14));const boundRatio=integrated/(2*Math.PI/radius);assert(boundRatio<=1+1e-13);maximumQuadratureRatio=Math.max(maximumQuadratureRatio,boundRatio);trials++;
  }
  return {trials,maximumJacobianRatio,maximumQuadratureRatio,proof:'h=perp>=r: J/den=1/h. h=r>=perp: max_t J/den=(2-perp^2/r^2)/r<=2/h. Positive angular quadrature measure <=pi.'};
});

check('Support raw bound matches independent RGB formula, effective ground radii, and source admission',()=>{
  const sources=Array.from({length:6},(_,i)=>({rawRGB:[i+1,(i+1)*.3,(7-i)*2],radius:[.065,.1,12,.025,.1,12][i],range:280}));
  let cases=0;
  for(const g of [0,.76,.9])for(const humidity of [0,.68,.95])for(const aerosolScale of [0,8,48])for(const rayleighScale of [0,1,8]){
    const coefficients=marineAirCoefficients({asymmetry:g,humidity,aerosolScale,rayleighScale}),bound=supportLocalAirRadianceBound({sources,coefficients});
    for(let c=0;c<3;c++){
      const phaseR=3/(8*Math.PI),phaseM=(1+g)/(4*Math.PI*(1-g)**2),scatter=coefficients.betaRayleighRGB[c]*phaseR+coefficients.betaMieScatteringRGB[c]*phaseM;
      const expected=sources.reduce((sum,s,i)=>sum+s.rawRGB[c]*2*Math.PI/(i<3?Math.max(.1,s.radius):s.radius)*scatter,0);
      assert(Math.abs(bound.maximumRGB[c]-expected)<=1e-12+1e-13*Math.abs(expected));assert(Number.isFinite(bound.maximumRGB[c]));
    }assert.equal(bound.activeSources,6);cases++;
  }
  const valid=sources[0];for(const invalid of [{...valid,radius:0},{...valid,range:0},{...valid,radius:Infinity},{...valid,rawRGB:[NaN,1,1]},{...valid,rawRGB:[0,0,0]}])assert.equal(supportLocalAirRadianceBound({sources:[invalid]}).maxRGB,0);
  assert.equal(supportLocalAirRadianceBound({sources:[valid],coefficients:marineAirCoefficients({aerosolScale:0,rayleighScale:0})}).maxRGB,0);
  const extreme=Array.from({length:6},()=>({...valid,rawRGB:[Number.MAX_VALUE,Number.MAX_VALUE,Number.MAX_VALUE],radius:1e-200}));assert(supportLocalAirRadianceBound({sources:extreme}).maximumRGB.every(Number.isFinite));
  return {cases,effectiveRadii:sources.map((s,i)=>i<3?Math.max(.1,s.radius):s.radius),invalidSources:5,overflowBoundFinite:true};
});

check('Actual module defaults quadratic, rejects mixed invalid patches atomically, persists opt-in and budgets',()=>{
  const camera=new THREE.PerspectiveCamera(40,1,.15,24000),scene=new THREE.Scene(),local=createLocalLights(THREE,{scene}),air=createAerialPerspective(THREE,{capabilities:{maxTextureSize:16384}},{camera,localLights:local});
  try{
    assert.equal(AERIAL_DEFAULTS.localScatteringModel,'quadratic');assert.equal(air.diagnostics().localScatteringModel,'quadratic');assert.equal(air.uniforms.uLocalScatteringModel.value,0);
    const snapshot=()=>JSON.stringify({diagnostics:air.diagnostics(),model:air.uniforms.uLocalScatteringModel.value,beta:air.uniforms.uBetaR.value.toArray()});
    const before=snapshot();
    const invalid=[NaN,Infinity,-1,0,1,null,undefined,{},[],true,'Support',''];
    for(const value of invalid){assert.throws(()=>air.configure({aerosolScale:48,quality:'balanced',localScatteringModel:value}),RangeError);assert.equal(snapshot(),before);assert.throws(()=>air.setLocalScatteringModel(value),RangeError);assert.equal(snapshot(),before);}
    assert.throws(()=>air.configure({localScatteringModel:'support',backgroundLocalScattering:2,aerosolScale:48}),TypeError);assert.equal(snapshot(),before);
    assert.throws(()=>air.setSampling({steps:6,shadowTaps:'bad'}),TypeError);assert.equal(snapshot(),before);
    air.setLocalScatteringModel('support');local.records[4].rawRGB=[6,12,24];local.records[4].radius=2;local.records[4].range=280;
    for(let i=0;i<10;i++){air.configure({quality:i%2?'balanced':'high',aerosolScale:8});air.update({time:i,weather:{humidity:.68}});assert.equal(air.diagnostics().localScatteringModel,'support');assert.equal(air.uniforms.uLocalScatteringModel.value,1);assert.equal(air.diagnostics().supportSamplesPerIntersectedLight,i%2?12:16);}
    const base=air.getRadianceBound();assert(base.maxRGB>0);for(const P of [-16,-8,0,4,8,16]){local.setSceneExposure(P);assert.deepEqual(air.getRadianceBound(),base);}
    air.setLocalScatteringModel('quadratic');assert.equal(air.getRadianceBound().maxRGB,0);assert.equal(air.diagnostics().supportSamplesPerIntersectedLight,0);assert.deepEqual(air.diagnostics().declaredSamplerBudget,{integration:5,composite:8});
    return {invalidModels:invalid.length,invalidMixedFlag:true,invalidMixedSampling:true,persistentUpdates:10,storageEVs:[-16,-8,0,4,8,16],rawSupportBound:base.maxRGB};
  }finally{air.dispose();local.dispose();}
});

check('Support shader consumes shared E once and leaves legacy integration functions unchanged',()=>{
  function glslFunction(source,name){const start=source.indexOf('    '+name),open=source.indexOf('{',start);assert(start>=0&&open>=0);let balance=1,i=open+1;while(balance&&i<source.length){balance+=(source[i]==='{')-(source[i]==='}');i++;}return source.slice(start,i);}
  const support=glslFunction(runtime,'void integrateSupportLocalAir('),transmission=glslFunction(runtime,'vec3 localViewTransmission(');
  assert(support.includes('localIncident(p,light,localL)'));assert(!support.includes('sceneScale'));assert(!support.includes('storageEV'));assert(!support.includes('uSunRGB'));assert(support.includes('localViewTransmission(s,direction)*E*'));assert(transmission.includes('exp(-uBetaR*r-uBetaME*m)'));
  const baseline=readFileSync(new URL('./r12-background-air-baseline-aerial-perspective.js',import.meta.url),'utf8');
  const names=['vec3 sourceAt(','void integrateAir(','void coefficientsAt(','vec3 segmentIntegral('];for(const name of names)assert.equal(glslFunction(runtime,name),glslFunction(baseline,name));
  return {legacyFunctionsUnchanged:names,additionalStorageExposureApplications:0,sourceUnits:'stored local incident RGB / m^2; beta in1/m; theta Jacobian in m; phase in1/sr; result stored local scattered radiance'};
});

const f32=Math.fround,mul32=(a,b)=>f32(f32(a)*f32(b)),add32=(a,b)=>f32(f32(a)+f32(b));
const dot32=(a,b)=>add32(add32(mul32(a[0],b[0]),mul32(a[1],b[1])),mul32(a[2],b[2]));
const direction=[.27724868059158325,.09560299664735794,-.9560299515724182],centre=[2772.48681640625,956.0299682617188,-9560.2998046875],closest=dot32(centre,direction);
const naivePerpendicularSquared=Math.max(0,f32(dot32(centre,centre)-mul32(closest,closest))),delta=centre.map((v,i)=>f32(v-mul32(direction[i],closest))),stablePerpendicularSquared=dot32(delta,delta),radius=.1;
const naiveH=Math.sqrt(Math.max(naivePerpendicularSquared,radius*radius)),actualFiniteDenominator=Math.max(stablePerpendicularSquared,radius*radius);
const finding={severity:'Requires GPU fixture or stable geometry change',location:'integrateSupportLocalAir perp2=dot(centre,centre)-closest*closest',kind:'Independent IEEE FP32 arithmetic counterexample, not actual GPU execution',direction,centre,closest,naivePerpendicularSquared,stablePerpendicularSquared,naiveH,actualDeltaAtClosest:delta,claimedJacobianOverDenominatorBound:2/naiveH,actualJacobianOverDenominatorAtThetaZero:naiveH/actualFiniteDenominator,boundProofRatio:naiveH*naiveH/(2*actualFiniteDenominator),recommendation:'Compute centre-direction*closest before dotting the perpendicular residual; verify far collinear lights in actual GPU fixtures. Do not treat the exact-arithmetic bound proof as a float geometry proof.'};
const report={kind:'Independent CPU review of optional support local-air integration',passed:checks.every(c=>c.passed),count:checks.length,checks,findings:[finding],runtimeSHA256:createHash('sha256').update(runtime).digest('hex'),limits:['CPU arithmetic, module state, bound proof and shader-source review only; no GPU or scene acceptance claimed.','GLSL float perpendicular-distance cancellation and analytic-height float errors require actual GPU cases.','Source-to-sample extinction remains intentionally omitted; finite quadrature is not exact radiative transfer.']};
writeFileSync(new URL('./r12-background-air-support-independent-check.json',import.meta.url),JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify(report,null,2));if(!report.passed)process.exitCode=1;
