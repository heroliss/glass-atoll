// CPU study of the existing analytic pixel integral at native source scale.
// No AA/shader mutation, GPU rasterization, screenshot or timing experiment.
import fs from 'node:fs';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import * as THREE from '../../vendor/three.module.js';
import {getFireworkSourceBound} from '../../fireworks.js';
const root=new URL('../../',import.meta.url),sha=x=>crypto.createHash('sha256').update(x).digest('hex'),source=fs.readFileSync(new URL('fireworks.js',root),'utf8'),W=1209,H=1292,D=706,phases=[0,.125,.25,.375,.5,.75,.875];
assert(source.includes('float integratedGaussian(vec2 p,float sigma){vec2 a=(p-vec2(.5))/(sigma*1.41421356237),b=(p+vec2(.5))/(sigma*1.41421356237);return max(0.,.25*(erfApprox(b.x)-erfApprox(a.x))*(erfApprox(b.y)-erfApprox(a.y)));}'));
const erf=x=>{const s=Math.sign(x);x=Math.abs(x);const t=1/(1+.3275911*x);return s*(1-(((((1.061405429*t-1.453152027)*t)+1.421413741)*t-.284496736)*t+.254829592)*t*Math.exp(-x*x));};
const integral=(x,y,s)=>Math.max(0,.25*(erf((x+.5)/(s*1.41421356237))-erf((x-.5)/(s*1.41421356237)))*(erf((y+.5)/(s*1.41421356237))-erf((y-.5)/(s*1.41421356237))));
const camera=new THREE.PerspectiveCamera(60,W/H,.1,120000);camera.updateMatrixWorld();
const profiles=[],centred=[];let maximumProjectionError=0;
for(const floor of [.28,.42,.45]){
  const samples=[];
  for(const dx of phases)for(const dy of phases){
    const cx=Math.floor(W/2)+.5+dx,cy=Math.floor(H/2)+.5+dy,p={kind:'star',position:[(2*cx/W-1)*D/camera.projectionMatrix.elements[0],(2*cy/H-1)*D/camera.projectionMatrix.elements[5],-D],velocity:[0,0,0],stretch:[0,0,0],radius:.01,intensity:1,colour:[1,1,1]};
    const bound=getFireworkSourceBound(p,camera,{width:W,height:H,dof:false,shutterSeconds:1/120});assert(bound.visible);maximumProjectionError=Math.max(maximumProjectionError,Math.abs((bound.rect[0]+bound.rect[2])*.5-cx),Math.abs((bound.rect[1]+bound.rect[3])*.5-cy));
    const sigma=Math.sqrt(floor===.28?bound.baseSigma2:Math.max(bound.baseSigma2,floor*floor)),extent=3.65*sigma+.65;
    let sum=0,peak=0,mx=0,my=0,second=0,coveredPixels=0;const tile=[];
    for(let j=-5;j<=5;j++)for(let i=-5;i<=5;i++){const x=i-dx,y=j-dy,covered=Math.abs(x)<=extent&&Math.abs(y)<=extent,value=covered?integral(x,y,sigma):0;if(covered)coveredPixels++;sum+=value;peak=Math.max(peak,value);mx+=value*x;my+=value*y;second+=value*(x*x+y*y);if(Math.abs(i)<=2&&Math.abs(j)<=2)tile.push(value);}
    assert(Number.isFinite(sum)&&Math.abs(sum-1)<2e-5);samples.push({phase:[dx,dy],sigma,sum,peak,centroidError:Math.hypot(mx,my)/sum,radialSecondMoment:second/sum,coveredPixels});if(dx===0&&dy===0)centred.push({floor,sigma,flux5x5:tile,peak,coveredPixels});
  }
  const sum=v=>v.reduce((a,b)=>a+b,0),peaks=samples.map(s=>s.peak);profiles.push({floor,phaseCount:samples.length,maximumFluxError:Math.max(...samples.map(s=>Math.abs(s.sum-1))),minimumPeak:Math.min(...peaks),maximumPeak:Math.max(...peaks),peakPhaseRatio:Math.max(...peaks)/Math.min(...peaks),meanPeak:sum(peaks)/peaks.length,maximumCentroidError:Math.max(...samples.map(s=>s.centroidError)),meanCoveredPixels:sum(samples.map(s=>s.coveredPixels))/samples.length,samples});
}
assert(maximumProjectionError<1e-10);assert(profiles[1].meanPeak<profiles[0].meanPeak);assert(profiles[1].peakPhaseRatio<profiles[0].peakPhaseRatio);
const report={schema:'glass-atoll.complex-fireworks.firelight-psf-cpu-study.v1',passed:true,actualGPU:false,productionEdits:0,viewport:[W,H],sourceDistanceMetres:D,physicalRadiusMetres:.01,phaseCountPerFloor:phases.length**2,maximumProjectionErrorPixels:maximumProjectionError,profiles,centred,sourceSHA256:sha(Buffer.from(source)),scriptSHA256:sha(fs.readFileSync(new URL(import.meta.url))),recommendation:{optionalFloor:.42,defaultFloor:.28,scope:'Only unresolved scalar non-trail heads; candidate base variance max(existing world+PSF variance, requested floor squared), DOF remains separate',expected:'Less concentrated peak and lower phase-dependent peak variation; 2x2 square sampling at exact pixel corners is still unavoidable.',cost:'More covered pixels per small head; total flux preserved approximately by the existing erf pixel integral, not extra source energy.'},limits:['CPU binary64 evaluation of the pinned shader formula, not GPU Float32 or rasterization certification.','Axis-aligned quad coverage is modelled at pixel centres; actual fixed-subpixel triangle snapping has not been executed.','Not visual acceptance or a hardware performance claim; full compositor/bloom/HDR remains untested.']};
fs.writeFileSync(new URL('./firelight-psf-study.json',import.meta.url),JSON.stringify(report,null,2));console.log(JSON.stringify({passed:true,maximumProjectionError,profiles:profiles.map(({samples,...p})=>p),centred:centred.map(({flux5x5,...p})=>p)},null,2));
