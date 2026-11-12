// This reproduces an acknowledged optical-model limit; a positive oracle with
// zero current-grid rows is NOT labelled successful history reconstruction.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import crypto from 'node:crypto';
import * as THREE from '../vendor/three.module.js';
import {createBurnProfile,sampleBurnProfile,integrateBurnEmission} from '../firework-burn-profile.js';
import {THREE_HEART_TRAIL_PROFILES} from '../firework-trail-profile.js';

const N=8,life=.6,Y=a=>a[0]*.2126+a[1]*.7152+a[2]*.0722;
const profile=createBurnProfile({id:'R19 retired-grid reference',emissionKnots:[{age:0,rgb:[0,0,0]},{age:.02,rgb:[10,10,10]},{age:.5,rgb:[10,10,10]},{age:life,rgb:[0,0,0]}],materialRateKnots:[{age:0,rate:1},{age:life,rate:1}]});
let normalization=0;for(let j=0;j<N;j++)normalization+=Math.exp(-3.5*(j+.5)/N);
const sourceI=t=>sampleBurnProfile(profile,t).intensityCdReference;
// EXACT temporal mean of the authored instantaneous N-lag quadrature's TOTAL
// photopic I, before spatial kernels, camera/medium or chromaticity effects.
// L(t)=f/sumExp * sum_j exp(-3.5 lag_j/D) I(t-lag_j).
export function currentGridHistoryMean({now,shutterSeconds,fraction,duration}){
 let I=0;for(let j=0;j<N;j++){const lag=(j+.5)/N*duration,w=fraction*Math.exp(-3.5*lag/duration)/normalization;I+=w*(shutterSeconds?Y(integrateBurnEmission(profile,now-shutterSeconds-lag,now-lag).integralRGBReferenceSeconds)/shutterSeconds:sourceI(now-lag));}return I;
}
// EXACT temporal integral of only the present snapshot's fixed-born proxies.
// Their births are u_j=now-lag_j; amplitudes I(u_j) remain fixed across shutter.
export function currentFrozenProxyMean({now,shutterSeconds,fraction,duration}){
 let I=0;for(let j=0;j<N;j++){const lag=(j+.5)/N*duration,u=now-lag;if(u<0||u>life)continue;const amplitude=sourceI(u)*fraction/normalization;if(!shutterSeconds){I+=amplitude*Math.exp(-3.5*lag/duration);continue;}const lo=Math.max(0,now-shutterSeconds-u),hi=Math.min(duration,now-u);if(hi>lo){const k=3.5/duration;I+=amplitude*Math.exp(-k*lo)*(-Math.expm1(-k*(hi-lo)))/k/shutterSeconds;}}return I;
}

const source=fs.readFileSync(new URL('../fireworks.js',import.meta.url),'utf8'),resolved=source.replace(/from (['"])(\.\/[^'"]+)\1/g,(_,q,p)=>`from '${new URL('../'+p.slice(2),import.meta.url).href}'`),instrumented=resolved.replace('const effectsScene=new THREE.Scene();','let __qaOrdered=[];const effectsScene=new THREE.Scene();').replace('geometry.instanceCount=ordered.length;','__qaOrdered=ordered.map(row=>row.p);geometry.instanceCount=ordered.length;').replace('api.configure({});return api;',`api.configure({});api.__qa={active:()=>simulation.active,records:()=>records,ordered:()=>__qaOrdered};return api;`);
const {createFireworks}=await import('data:text/javascript;base64,'+Buffer.from(instrumented).toString('base64'));
function actualTailRows(now,shutterSeconds,trailProfile){const f=createFireworks(THREE,{sourceVisibility:'none'});try{f.setQuality({trailSegments:N});const body={id:0,kind:'star',birth:0,life,position:[0,30,-100],velocity:[0,0,0],baseVelocity:[0,0,0],drag:0,gravity:0,radius:.003,intensity:10,emissionReferenceI0:10,effectProfile:'three-heart-v1',layerId:trailProfile.layerId,burnProfile:profile,trail:true,trailProfile};f.__qa.active().push({id:'history witness',type:'chrysanthemum',seed:42,time:0,burstTime:0,burstPosition:[0,30,-100],origin:[0,30,-100],definition:{ground:false},rocket:null,heads:[body],events:[],endTime:100});f.update({time:now,windVector:[0,0,0]});const currentTails=f.__qa.records().filter(p=>p.emberBody).length,camera=new THREE.PerspectiveCamera(55,1.5,.1,30000);camera.lookAt(0,30,-100);camera.updateMatrixWorld();const renderer={autoClear:true,shadowMap:{autoUpdate:true,needsUpdate:false},getRenderTarget:()=>null,getActiveCubeFace:()=>0,getActiveMipmapLevel:()=>0,setRenderTarget(){},render(){}};f.render({renderer,target:{width:1200,height:800},camera,legacySmoke:false,optics:{width:1200,height:800,shutterSeconds}});return{currentTails,viewTailRows:f.__qa.ordered().filter(p=>p.emberBody).length,currentY:30,headHistoryMean:Y(integrateBurnEmission(profile,now-shutterSeconds,now).averageRGBReference)};}finally{f.dispose();}}

const observations=[];
for(const [layerId,trail]of Object.entries(THREE_HEART_TRAIL_PROFILES))for(const shutterSeconds of [1/120,.5]){
 const D=trail.durationSeconds,now=life+(N-.5)/N*D+shutterSeconds*.25,input={now,shutterSeconds,fraction:trail.referenceIntensityFraction,duration:D},historical=currentGridHistoryMean(input),frozen=currentFrozenProxyMean(input),actual=actualTailRows(now,shutterSeconds,trail);
 assert(historical>0);assert.equal(frozen,0);assert.equal(actual.currentTails,0);assert.equal(actual.viewTailRows,0);if(shutterSeconds===1/120)assert.equal(actual.headHistoryMean,0);
 observations.push({layerId,duration:D,fraction:trail.referenceIntensityFraction,now,shutterSeconds,historicalCurrentGridMeanReferenceI:historical,presentFrozenProxyMeanReferenceI:frozen,...actual,status:'known-history-hole-reproduced',meaning:'The instantaneous grid has retired its last ember; earlier shutter times still contained positive tail I. No ground/geometry/transmission cause is involved.'});
}
// S0 is the common limit of both authored models. This is a required future
// admission condition, not a claim that they agree at finite shutter.
let zeroShutterCases=0;for(const trail of Object.values(THREE_HEART_TRAIL_PROFILES))for(const now of [.01,.1,.3,.55,.65]){const p={now,shutterSeconds:0,fraction:trail.referenceIntensityFraction,duration:trail.durationSeconds},a=currentGridHistoryMean(p),b=currentFrozenProxyMean(p);assert(Math.abs(a-b)<1e-12);zeroShutterCases++;}
const report={schema:'glass-atoll.r19-trail-history-oracle.v1',dateUTC:new Date().toISOString(),sourceSHA256:crypto.createHash('sha256').update(source).digest('hex'),oracleConsistency:{passed:true,zeroShutterCases},historyRequirementSatisfied:false,observations,limits:['Known limit reproduction, deliberately NOT a passing full-history acceptance report.','Exact aggregate photopic I for the specified N-lag source model; not a spatial image, continuous material solve or nonlinear trajectory/T(t) integral.','No browser/GPU, shader execution, readback, performance measurement or production mutation.','Long-shutter current-row RGB coupling checks elsewhere do not prove historical source completeness.']};fs.writeFileSync(new URL('./r19-trail-history-oracle.json',import.meta.url),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report,null,2));
