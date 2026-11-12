import assert from 'node:assert/strict';
import fs from 'node:fs';
import crypto from 'node:crypto';
import {
  homogeneousSegment,combineMedia,sumSources,composeTransfers,applyTransfer,
  scatteringCoefficients,scatteringSource,hgPhase,hgPhaseMax,rayleighPhase,
  scatteringCosine,scaleTransferRadiance,radiativeTransferGLSL,
} from '../radiative-transfer.js';

const checks=[];
function test(name,fn){try{checks.push({name,passed:true,detail:fn()??null});}catch(error){checks.push({name,passed:false,error:String(error.stack)});}}
function near(a,b,{relative=2e-12,absolute=2e-13}={}){
  assert(Number.isFinite(a)&&Number.isFinite(b),`nonfinite comparison ${a}, ${b}`);
  const error=Math.abs(a-b),limit=absolute+relative*Math.max(Math.abs(a),Math.abs(b));
  assert(error<=limit,JSON.stringify({a,b,error,limit}));return error;
}
const rgbNear=(a,b,tol)=>Math.max(...a.map((v,c)=>near(v,b[c],tol)));
const transferNear=(a,b,tol)=>Math.max(rgbNear(a.T,b.T,tol),rgbNear(a.S,b.S,tol));
const identity={T:[1,1,1],S:[0,0,0]};
let randomState=0x0b9e2103;
const random=()=>{randomState=(Math.imul(1664525,randomState)+1013904223)>>>0;return randomState/4294967296;};

// Independent ODE oracle, not the segment's exponential/integral formula.
// s increases front->back: dT/ds=-beta*T, dS/ds=j*T. RK4 carries its state
// through all segment boundaries; it never calls a runtime transfer function.
function numericalTransfer(segments,steps=4096){
  const T=[1,1,1],S=[0,0,0];
  for(const {extinctionRGB:beta,sourceRGB:j,length} of segments){
    const h=length/steps;
    for(let i=0;i<steps;i++)for(let c=0;c<3;c++){
      const k1T=-beta[c]*T[c],k1S=j[c]*T[c];
      const q2=T[c]+h*.5*k1T,k2T=-beta[c]*q2,k2S=j[c]*q2;
      const q3=T[c]+h*.5*k2T,k3T=-beta[c]*q3,k3S=j[c]*q3;
      const q4=T[c]+h*k3T,k4T=-beta[c]*q4,k4S=j[c]*q4;
      T[c]+=h/6*(k1T+2*k2T+2*k3T+k4T);
      S[c]+=h/6*(k1S+2*k2S+2*k3S+k4S);
    }
  }
  return{T,S};
}
function simpson(fn,a,b,steps=65536){
  assert.equal(steps%2,0);const h=(b-a)/steps;let sum=fn(a)+fn(b),compensation=0;
  for(let i=1;i<steps;i++){
    const term=(i%2?4:2)*fn(a+i*h)-compensation,next=sum+term;
    compensation=(next-sum)-term;sum=next;
  }
  return sum*h/3;
}
const sourceHash=crypto.createHash('sha256').update(fs.readFileSync(new URL('../radiative-transfer.js',import.meta.url))).digest('hex');

test('zero geometric length is exact identity even with finite nonzero beta/j',()=>{
  assert.deepEqual(homogeneousSegment({extinctionRGB:[1e308,.1,1],sourceRGB:[1e308,4,8],length:0}),identity);
});
test('vacuum and black source preserve any nonnegative background',()=>{
  const v=homogeneousSegment({length:12000});assert.deepEqual(v,identity);
  assert.deepEqual(applyTransfer(v,[.2,40,60000]),[.2,40,60000]);
  assert.deepEqual(applyTransfer(homogeneousSegment({extinctionRGB:[.01,.4,10],length:50}),[0,0,0]),[0,0,0]);
});
test('zero extinction has stable j*length without an artificial epsilon',()=>{
  const value=homogeneousSegment({sourceRGB:[.125,2,7],length:12});
  assert.deepEqual(value,{T:[1,1,1],S:[1.5,24,84]});
});
test('pure absorption agrees with Beer transmittance and cannot create light',()=>{
  const beta=[.01,.03,.2],length=19,background=[80,20,.5],v=homogeneousSegment({extinctionRGB:beta,length});
  rgbNear(v.T,beta.map(b=>Math.exp(-b*length)));assert.deepEqual(v.S,[0,0,0]);
  const result=applyTransfer(v,background);assert(result.every((x,c)=>x<=background[c]));return{result};
});
test('tiny optical depths and both sides of polynomial boundary retain double precision',()=>{
  let maxRelative=0;const samples=[0,Number.MIN_VALUE,1e-310,1e-200,1e-20,1e-16,1e-12,1e-8,1e-4,.1,.249999999,.25,.250000001,1,12,1000];
  for(const x of samples){
    const v=homogeneousSegment({extinctionRGB:[x,x,x],sourceRGB:[1,1,1],length:1});
    const expected=x===0?1:-Math.expm1(-x)/x;
    near(v.S[0],expected,{relative:2e-15,absolute:1e-320});
    maxRelative=Math.max(maxRelative,Math.abs(v.S[0]-expected)/expected);
  }
  return{sampleCount:samples.length,maxRelativeError:maxRelative,polynomialFirstOmittedTermAtBoundary:.25**11/479001600};
});
test('strong extinction including finite-input optical-depth overflow stays finite',()=>{
  const v=homogeneousSegment({extinctionRGB:[1e308,1e100,1e-100],sourceRGB:[1e308,3,2],length:1e308});
  assert.deepEqual(v.T,[0,0,0]);rgbNear(v.S,[1,3e-100,2e100],{relative:2e-15,absolute:1e-115});return v;
});
test('subnormal beta does not erase a representable integrated source',()=>{
  const v=homogeneousSegment({extinctionRGB:[1e-320,0,1e-309],sourceRGB:[1e-300,2e-300,1e-300],length:1e300});
  rgbNear(v.S,[1,2,1-.5e-9],{relative:3e-15,absolute:1e-15});return v;
});
test('48 seeded RGB spectra agree with independent RK4 transport ODE',()=>{
  let maxRelative=0,maxAbsolute=0;
  for(let i=0;i<48;i++){
    const length=.1+1000*random(),extinctionRGB=[0,0,0].map(()=>8*random()/length),sourceRGB=[0,0,0].map(()=>50*random()/length);
    const expected=numericalTransfer([{extinctionRGB,sourceRGB,length}]),actual=homogeneousSegment({extinctionRGB,sourceRGB,length});
    transferNear(actual,expected,{relative:4e-11,absolute:2e-11});
    for(const key of ['T','S'])for(let c=0;c<3;c++){const e=Math.abs(actual[key][c]-expected[key][c]);maxAbsolute=Math.max(maxAbsolute,e);maxRelative=Math.max(maxRelative,e/Math.max(1e-16,Math.abs(expected[key][c])));}
  }
  return{cases:48,stepsPerSegment:4096,maxAbsoluteError:maxAbsolute,maxRelativeError:maxRelative};
});
test('source integral independently agrees with Simpson quadrature',()=>{
  const beta=[.003,.047,.21],j=[.17,9.2,.003],length=83;
  const expected=j.map((v,c)=>simpson(s=>v*Math.exp(-beta[c]*s),0,length,32768));
  const actual=homogeneousSegment({extinctionRGB:beta,sourceRGB:j,length});
  return{maximumAbsoluteError:rgbNear(actual.S,expected,{relative:4e-13,absolute:1e-12}),expected};
});
test('nonuniform geometric subdivision is invariant at fixed coefficients',()=>{
  const medium={extinctionRGB:[.007,.00001,.037],sourceRGB:[.08,2,.07]},parts=[.001,.02,1.3,7,23,80,400];
  const segments=parts.map(length=>homogeneousSegment({...medium,length}));
  const composed=segments.reduce((front,back)=>composeTransfers(front,back),identity),whole=homogeneousSegment({...medium,length:parts.reduce((s,x)=>s+x,0)});
  return{maximumAbsoluteError:transferNear(composed,whole),parts:parts.length};
});
test('front/back ordering matches the independently integrated piecewise ray',()=>{
  const segments=[
    {extinctionRGB:[.14,.03,.01],sourceRGB:[3,.02,.001],length:7},
    {extinctionRGB:[.003,.2,.04],sourceRGB:[.001,4,.3],length:12},
    {extinctionRGB:[.04,.06,.11],sourceRGB:[.1,.01,5],length:8},
  ];
  const composed=segments.map(homogeneousSegment).reduce((a,b)=>composeTransfers(a,b),identity),expected=numericalTransfer(segments);
  return{maximumAbsoluteError:transferNear(composed,expected,{relative:2e-11,absolute:3e-11}),composed};
});
test('serial composition is not commutative for different illuminated layers',()=>{
  const front=homogeneousSegment({extinctionRGB:[.8,.1,.2],sourceRGB:[1,0,0],length:2}),back=homogeneousSegment({extinctionRGB:[.1,.8,.05],sourceRGB:[0,2,3],length:3});
  const ab=composeTransfers(front,back),ba=composeTransfers(back,front);
  rgbNear(ab.T,ba.T);assert(ab.S.some((v,c)=>Math.abs(v-ba.S[c])>.5));
  rgbNear(applyTransfer(ab,[2,3,4]),applyTransfer(front,applyTransfer(back,[2,3,4])));
  return{frontThenBack:ab.S,backThenFront:ba.S};
});
test('composition is associative, including a zero-transmission foreground',()=>{
  const a={T:[0,.2,.9],S:[3,1,.4]},b={T:[.5,.8,1],S:[1,2,5]},c={T:[.9,.1,.3],S:[0,9,2]};
  transferNear(composeTransfers(composeTransfers(a,b),c),composeTransfers(a,composeTransfers(b,c)));
  assert.deepEqual(composeTransfers(identity,a),a);assert.deepEqual(composeTransfers(a,identity),a);
});
test('co-spatial air+smoke adds beta and source before one integration',()=>{
  const air={extinctionRGB:[.001,.002,.004],sourceRGB:[.03,.06,.04]},smoke={extinctionRGB:[.03,.04,.05],sourceRGB:[1,.3,.1]},length=40;
  const combined=combineMedia(air,smoke);
  rgbNear(combined.extinctionRGB,[.031,.042,.054]);rgbNear(combined.sourceRGB,[1.03,.36,.14]);
  const actual=homogeneousSegment({...combined,length}),expected=numericalTransfer([{...combined,length}]);
  const serial=composeTransfers(homogeneousSegment({...air,length}),homogeneousSegment({...smoke,length}));
  transferNear(actual,expected,{relative:2e-11,absolute:2e-11});assert(actual.S.some((v,c)=>Math.abs(v-serial.S[c])>.05));
  return{correctSharedSegment:actual.S,incorrectAdjacentLayers:serial.S};
});
test('co-spatial addition is order invariant and zero media is neutral',()=>{
  const a={extinctionRGB:[.01,.02,.03],sourceRGB:[1,2,3]},b={extinctionRGB:[.1,.2,.3],sourceRGB:[4,5,6]},empty=combineMedia();
  assert.deepEqual(empty,{extinctionRGB:[0,0,0],sourceRGB:[0,0,0]});assert.deepEqual(combineMedia(a,b),combineMedia(b,a));assert.deepEqual(combineMedia(a,empty),a);
});
test('multiple lamps add j without adding the same medium extinction twice',()=>{
  const beta=[.02,.03,.04],sigma=scatteringCoefficients(beta,.8);
  const a=scatteringSource({scatteringRGB:sigma,incidentRGB:[2,1,.5],cosine:.7,g:.32}),b=scatteringSource({scatteringRGB:sigma,incidentRGB:[.2,3,4],cosine:-.4,g:.76}),length=35;
  const actual=homogeneousSegment({extinctionRGB:beta,sourceRGB:sumSources(a,b),length});
  const independentA=homogeneousSegment({extinctionRGB:beta,sourceRGB:a,length}),independentB=homogeneousSegment({extinctionRGB:beta,sourceRGB:b,length});
  rgbNear(actual.S,sumSources(independentA.S,independentB.S));
  const wrong=homogeneousSegment({...combineMedia({extinctionRGB:beta,sourceRGB:a},{extinctionRGB:beta,sourceRGB:b}),length});
  assert(wrong.S.every((v,c)=>v<actual.S[c]));assert.deepEqual(sumSources(),[0,0,0]);
  return{correct:actual.S,negativeControlDuplicatedExtinction:wrong.S};
});
test('SSA zero/one and RGB fractions constrain scattering by extinction',()=>{
  const beta=[.01,.2,4];assert.deepEqual(scatteringCoefficients(beta,0),[0,0,0]);assert.deepEqual(scatteringCoefficients(beta,1),beta);
  assert.deepEqual(scatteringCoefficients(beta,[0,.25,1]),[0,.05,4]);
});
test('HG actual g=.32 and .76 integrate to one over solid angle',()=>{
  const result=[];
  for(const g of [.32,.76]){const integral=2*Math.PI*simpson(mu=>hgPhase(mu,g),-1,1,131072);near(integral,1,{relative:0,absolute:2e-12});result.push({g,solidAngleIntegral:integral,phaseMaxPerSteradian:hgPhaseMax(g),forwardBackRatio:hgPhase(1,g)/hgPhase(-1,g)});}
  return result;
});
test('HG isotropic and negative-g profiles are normalized, not clamped to forward',()=>{
  const result=[];
  for(const g of [0,-.32,-.76]){const integral=2*Math.PI*simpson(mu=>hgPhase(mu,g),-1,1,131072);near(integral,1,{relative:0,absolute:2e-12});for(const mu of [-1,-.7,0,.6,1])near(hgPhase(mu,g),hgPhase(-mu,-g));result.push({g,integral});}
  near(hgPhase(.42,0),1/(4*Math.PI));return result;
});
test('HG phaseMax is an all-direction bound for actual and strongly anisotropic g',()=>{
  const maxima=[];
  for(const g of [-.999,-.76,-.32,0,.32,.76,.999]){
    const bound=hgPhaseMax(g);let measured=0;
    for(let i=0;i<=8192;i++){const p=hgPhase(-1+2*i/8192,g);assert(p<=bound*(1+2e-15));measured=Math.max(measured,p);}
    near(measured,bound,{relative:3e-15,absolute:1e-14});maxima.push({g,bound,measured});
  }
  return maxima;
});
test('HG forward/back ratio independently matches (1+g)^3/(1-g)^3',()=>{
  const ratios=[];for(const g of [.32,.76]){const ratio=hgPhase(1,g)/hgPhase(-1,g),expected=((1+g)/(1-g))**3;near(ratio,expected);assert(ratio>1);ratios.push({g,ratio,expected});}return ratios;
});
test('Rayleigh phase integrates to one and has its correct endpoint maximum',()=>{
  const integral=2*Math.PI*simpson(rayleighPhase,-1,1);near(integral,1);near(rayleighPhase(1),3/(8*Math.PI));near(rayleighPhase(0),3/(16*Math.PI));return{solidAngleIntegral:integral};
});
test('propagation convention distinguishes physical forward and back scattering',()=>{
  // Source at z=-1, scatter at origin, eye at z=+1: photons continue forward.
  const forward=scatteringCosine([0,0,1],[0,0,1]),back=scatteringCosine([0,0,1],[0,0,-1]);
  assert.equal(forward,1);assert.equal(back,-1);assert(hgPhase(forward,.32)>hgPhase(back,.32));
  near(scatteringCosine([1e300,2e300,-3e300],[1e-300,2e-300,-3e-300]),1);
  assert.equal(scatteringCosine([0,2,0],[3,0,0]),0);return{forward,back};
});
test('source units contain sigma_s*irradiance*phase and no extra Lambert factor',()=>{
  const sigma=[.004,.005,.009],incident=[20,5,2],g=.32,mu=.5;
  const actual=scatteringSource({scatteringRGB:sigma,incidentRGB:incident,cosine:mu,g});
  const phase=(1-g*g)/(4*Math.PI*Math.pow(1+g*g-2*g*mu,1.5));
  rgbNear(actual,sigma.map((v,c)=>v*incident[c]*phase));return{sourcePerMetrePerSteradian:actual};
});
test('integrated scattering obeys SSA/phaseMax/incident bound without summing puffs blindly',()=>{
  let worstRatio=0;
  for(const g of [.32,.76])for(const length of [0,.001,1,50,12000]){
    const beta=[.0008,.003,.02],ssa=[.8,.95,.6],incident=[40,18,3],sigma=scatteringCoefficients(beta,ssa);
    const j=scatteringSource({scatteringRGB:sigma,incidentRGB:incident,cosine:.93,g}),v=homogeneousSegment({extinctionRGB:beta,sourceRGB:j,length});
    for(let c=0;c<3;c++){
      // expm1 retains the very thin-segment bound independently of rounded T.
      const bound=ssa[c]*incident[c]*hgPhaseMax(g)*(-Math.expm1(-beta[c]*length));
      assert(v.S[c]<=bound+1e-13);if(bound>0)worstRatio=Math.max(worstRatio,v.S[c]/bound);
    }
  }
  return{maximumSourceToAllDirectionBoundRatio:worstRatio};
});
test('storage P scales S and background once while T stays dimensionless',()=>{
  const medium={extinctionRGB:[.003,.007,.04],sourceRGB:[.2,.7,1.1],length:47},background=[2,8,.4],physical=homogeneousSegment(medium),P=18,scale=2**P;
  const scaled=scaleTransferRadiance(physical,scale),fromScaledJ=homogeneousSegment({...medium,sourceRGB:medium.sourceRGB.map(v=>v*scale)});
  assert.deepEqual(scaled.T,physical.T);transferNear(scaled,fromScaledJ);
  const expected=applyTransfer(physical,background).map(v=>v*scale),actual=applyTransfer(scaled,background.map(v=>v*scale));rgbNear(actual,expected);
  const doubleScaled=applyTransfer(scaleTransferRadiance(scaled,scale),background.map(v=>v*scale));assert(doubleScaled.some((v,c)=>v>actual[c]*100));
  return{P,scaledResult:actual,doublePRejectedByNegativeControl:true};
});
test('serial and co-spatial composition commute with a consistent single storage scale',()=>{
  const m1={extinctionRGB:[.01,.03,.05],sourceRGB:[.1,.2,.3]},m2={extinctionRGB:[.02,.001,.04],sourceRGB:[.4,.5,.6]},q=2**-8;
  const a=homogeneousSegment({...m1,length:30}),b=homogeneousSegment({...m2,length:11});
  transferNear(composeTransfers(scaleTransferRadiance(a,q),scaleTransferRadiance(b,q)),scaleTransferRadiance(composeTransfers(a,b),q));
  const combined=combineMedia(m1,m2),scaledCombined=combineMedia({...m1,sourceRGB:m1.sourceRGB.map(v=>v*q)},{...m2,sourceRGB:m2.sourceRGB.map(v=>v*q)});
  transferNear(homogeneousSegment({...scaledCombined,length:30}),scaleTransferRadiance(homogeneousSegment({...combined,length:30}),q));
});
test('public inputs reject NaN/Infinity/negative beta,j,length and malformed RGB',()=>{
  const bad=[];
  for(const value of [NaN,Infinity,-Infinity,-.01]){
    bad.push(()=>homogeneousSegment({extinctionRGB:[value,1,1],length:2}),()=>homogeneousSegment({sourceRGB:[value,1,1],length:2}),()=>homogeneousSegment({length:value}));
  }
  bad.push(()=>homogeneousSegment({extinctionRGB:[1,2]}),()=>applyTransfer(identity,[1,2,'3']),()=>combineMedia({extinctionRGB:[1,1,1]}),()=>sumSources([1,-1,2]));
  for(const call of bad)assert.throws(call);return{invalidCases:bad.length};
});
test('SSA/g/cosine domains and zero direction fail instead of being silently sanitized',()=>{
  const bad=[()=>scatteringCoefficients([1,2,3],-.1),()=>scatteringCoefficients([1,2,3],1.01),()=>scatteringCoefficients([1,2,3],[1,.2,NaN]),()=>hgPhase(0,1),()=>hgPhase(0,-1),()=>hgPhase(0,NaN),()=>hgPhase(1.01,.32),()=>rayleighPhase(Infinity),()=>scatteringCosine([0,0,0],[1,0,0]),()=>scatteringSource({scatteringRGB:[1,2,3],incidentRGB:[1,-1,2],cosine:0})];
  for(const call of bad)assert.throws(call);near(hgPhase(1+1e-14,.76),hgPhase(1,.76));return{invalidCases:bad.length,permittedDotRoundoff:1e-12};
});
test('invalid transfer coefficients and unrepresentable radiance throw, never clamp',()=>{
  const bad=[()=>applyTransfer({T:[1.01,1,1],S:[0,0,0]},[1,1,1]),()=>composeTransfers({T:[1,1,1],S:[-1,0,0]},identity),()=>scaleTransferRadiance(identity,-1),()=>homogeneousSegment({sourceRGB:[1e308,1,1],length:100}),()=>sumSources([1e308,0,0],[1e308,0,0]),()=>applyTransfer({T:[1,1,1],S:[1e308,0,0]},[1e308,0,0])];
  for(const call of bad)assert.throws(call);return{invalidCases:bad.length};
});
test('functions accept typed RGB arrays without mutating inputs or aliasing outputs',()=>{
  const beta=new Float64Array([.01,.02,.03]),j=new Float32Array([1,2,3]),input={extinctionRGB:beta,sourceRGB:j,length:4},before=[...beta,...j],v=homogeneousSegment(input);
  assert.deepEqual([...beta,...j],before);const copy=scaleTransferRadiance(v,1);copy.T[0]=0;copy.S[0]=0;assert(v.T[0]>0&&v.S[0]>0);
  const merged=combineMedia(input);merged.sourceRGB[0]=7;assert.equal(j[0],1);
});
test('RGB T stays in [0,1], S>=0, and total intensity is monotone in independent sources',()=>{
  for(let i=0;i<128;i++){
    const beta=[0,0,0].map(()=>random()*.1),j=[0,0,0].map(()=>random()*30),length=random()*300;
    const a=homogeneousSegment({extinctionRGB:beta,sourceRGB:j,length}),b=homogeneousSegment({extinctionRGB:beta,sourceRGB:j.map(v=>v*2),length});
    assert(a.T.every(v=>v>=0&&v<=1&&Number.isFinite(v)));assert(a.S.every(v=>v>=0&&Number.isFinite(v)));assert.deepEqual(a.T,b.T);rgbNear(b.S,a.S.map(v=>v*2));
  }
  return{cases:128};
});
test('shared GLSL exposes homologous highp segment/phase/algebra without samplers or automatic exposure',()=>{
  for(const signature of ['precision highp float;','struct RTTransfer','rtSegment(','rtCompose(','rtCombineMedia(','rtApply(','rtHG(','rtHGMax(','rtRayleigh(','rtScatteringCosine(','rtScatteringSource(','rtScaleRadiance('])assert(radiativeTransferGLSL.includes(signature),signature);
  for(const forbidden of ['sampler','uniform','gl_FragColor','uSceneScale','toneMapping','/T_air','/ T_air'])assert(!radiativeTransferGLSL.includes(forbidden),forbidden);
  assert(radiativeTransferGLSL.includes('if(beta==0.)return distance;'));assert(radiativeTransferGLSL.includes('if(x<.25)'));
  return{glslCharacterCount:radiativeTransferGLSL.length,scope:'structural CPU/GLSL contract only; not a shader compile or GPU precision claim'};
});

const report={
  date:new Date().toISOString(),sourceSHA256:sourceHash,
  passed:checks.every(c=>c.passed),passedCount:checks.filter(c=>c.passed).length,total:checks.length,
  runtimeIntegrated:false,gpuExecuted:false,
  conventions:{front:'nearest eye',T:'dimensionless RGB transmittance',S:'RGB radiance added by segment',beta:'inverse metres',j:'radiance per metre, including normalized per-steradian phase',direction:'source->sample dot sample->eye (propagation vectors)',preExposure:'explicit scale of S and input/background radiance once; T unchanged'},
  independentOracles:['RK4 integration of dT/ds=-beta*T, dS/ds=j*T','Simpson quadrature of attenuated source along ray','Solid-angle Simpson quadrature of actual HG g=.32/.76 and Rayleigh'],
  limits:['Homogeneous segment/source coefficients; no heterogeneous quadrature policy or production ray partition yet.','Single-scattering source algebra, not multiple scattering or a full volumetric solver.','No inversion/division of an already rendered air background, no Gaussian state/column duplicate.','GLSL is shared source with validated-input contract; actual WebGL compilation/precision/FP16 overflow need separate GPU checks.','No production visuals, cloud illumination, persistent-smoke integration or performance acceptance implied.'],
  checks,
};
fs.writeFileSync(new URL('radiative-transfer-check.json',import.meta.url),JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({passed:report.passed,passedCount:report.passedCount,total:report.total,sourceSHA256:sourceHash,failed:checks.filter(c=>!c.passed)},null,2));
if(!report.passed)process.exitCode=1;
