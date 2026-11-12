// Verification-only proposed scaled kick study. No renderer, host, browser or GPU.
import fs from 'node:fs';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import {createFireworkEvent,sampleBody,sampleBodyEmission,sampleFireworkEvent} from '../fireworks-physics.js';
import {createFireworkContactSupport} from '../firework-contact-support.js';
import {createTailReleaseFieldNode,sampleTailReleaseFieldNode} from '../firework-tail-field.js';
import {resolveFireworkExposure} from '../firework-exposure-window.js';
const root=new URL('../',import.meta.url),checks=[],sha=b=>crypto.createHash('sha256').update(b).digest('hex');
const check=(name,fn)=>{try{checks.push({name,passed:true,evidence:fn()});}catch(e){checks.push({name,passed:false,error:String(e.stack??e)});}};
const K=9.81/16,T=2.5,F=-Math.expm1(-K*T)/K,Y=v=>.2126*v[0]+.7152*v[1]+.0722*v[2],dot=(a,b)=>a.reduce((n,x,c)=>n+x*b[c],0);
const timeline=[{time:-Infinity,wind:[0,0,0]}];
const sourcePins=Object.fromEntries(['fireworks-physics.js','firework-layer-profile.js','firework-burn-profile.js','firework-contact-support.js','firework-air-support.js','firework-tail-field.js'].map(p=>[p,sha(fs.readFileSync(new URL(p,root)))]));
function width(bodies,t){let maximum=0,pair=null;const q=bodies.filter(b=>b.layerId==='outer'&&sampleBodyEmission(b,t).envelope>=.1);for(let i=0;i<q.length;i++)for(let j=0;j<i;j++){const d=Math.hypot(q[i].baseVelocity[0]-q[j].baseVelocity[0],q[i].baseVelocity[2]-q[j].baseVelocity[2])*F;if(d>maximum){maximum=d;pair=[q[i].id,q[j].id];}}return{metres:maximum,pair,heads:q.length};}
function proposed({seed=341070,elevation=78,burstOrientation=null,intensityScale=1}={}){
 const event=createFireworkEvent({type:'chrysanthemum',effectProfile:'three-heart-v1',origin:[29,.5,7],seed,elevation,burstOrientation,intensityScale,starDragModel:'bounded-descent'}),reference=width(event.heads,T),alpha=120/reference.metres;
 assert(reference.heads===64&&alpha>0&&alpha<=4);
 const oldHeads=event.heads;event.heads=oldHeads.map(b=>{const velocity=b.baseVelocity.map((v,c)=>event.baselineBurst.velocity[c]+alpha*(v-event.baselineBurst.velocity[c]));return{...b,position:[...b.position],basePosition:[...b.basePosition],velocity,baseVelocity:[...velocity]};});
 return{event,alpha,reference,oldHeads};
}
let coverage=null,phaseCases=[];
check('All native seed/rotation kick directions admit alpha<4 by a finite spherical net and a real-arithmetic Lipschitz enclosure',()=>{
 const points=Array.from({length:64},(_,j)=>{const i=j*3,y=1-2*(i+.5)/192,a=i*2.399963229728653+.04,r=Math.sqrt(1-y*y);return[r*Math.cos(a),y,r*Math.sin(a)];});
 const pairs=[];for(let i=0;i<64;i++)for(let j=0;j<i;j++){const a=points[i],b=points[j],v=a.map((x,c)=>x-b[c]);pairs.push({a,b,v,n2:dot(v,v),ab:dot(a,b)});}
 const N=128,netRadius=Math.PI/N,jitterChord=2*Math.sin(.02),dotPerturbation=2*jitterChord+Math.sin(netRadius);let min=2,witness=null,minSelected=64;
 for(let j=0;j<=N;j++){const theta=Math.PI*j/N,y=Math.cos(theta),r=Math.sin(theta);for(let i=0;i<2*N;i++){const phi=Math.PI*i/N,n=[r*Math.cos(phi),y,r*Math.sin(phi)];let max=0,selected=0;for(const p of pairs){const an=dot(p.a,n),bn=dot(p.b,n);if(p.ab-an*bn>-.2)continue;selected++;const vn=dot(p.v,n);max=Math.max(max,Math.sqrt(Math.max(0,p.n2-vn*vn)));}minSelected=Math.min(minSelected,selected);if(max<min){min=max;witness=n;}}}
 // Each actual direction differs from its fixed midpoint by <=jitterChord.
 // Every sphere normal is <=pi/N from a net node. Projection-operator norm
 // changes by <=sin(angle). The selected pair's actual projected dot remains
 // negative, hence its distance is monotone in both native speeds >=13.
 assert(dotPerturbation<.2);const unitLower=min-2*netRadius-2*jitterChord-1e-10,widthLower=13*F*unitLower,alphaUpper=120/widthLower;
 assert(minSelected>0&&unitLower>0&&alphaUpper<4);
 coverage={nativeOuterIDs:'0,3,...189',nativeSpeedRange:[13,19],azimuthJitterRadians:[0,.08],midpointJitterRadians:.04,thetaSteps:N,phiSteps:2*N,normalNetNodes:(N+1)*2*N,minimumEligiblePairs:minSelected,minimumNetProjectedDiameter:min,witnessNormal:witness,netAngularRadiusUpper:netRadius,jitterChordUpper:jitterChord,projectedDotPerturbationUpper:dotPerturbation,gridPairDotAtMost:-.2,unitProjectedDiameterLower:unitLower,nativeWidthAt2p5LowerMetres:widthLower,alphaUpper,arithmeticMargin:1e-10,formalFloatingPointCertificate:false};return coverage;
});
check('The outer authored burn curve exceeds the10% gate at2.5s for the complete allowed lifetime interval',()=>{
 const minimumLife=3.4*.94,maximumLife=3.4*1.06,minimumYFraction=(2/3)*(minimumLife-T)/(.35*minimumLife);assert(minimumYFraction>.1);return{age:T,lifetimeRange:[minimumLife,maximumLife],minimumYFraction,proof:'Peak=6 at .04*timeScale; Y=4 at .65*life and 0 at life. At2.5 the shortest life is the minimum normalized intensity. Independent of I0 including an optically-dark normalization branch.'};
});
check('Real old event producers plus proposed3D kick scaling preserve target width, native head/body/life/burn/material identity across25..90deg and arbitrary admitted orientations',()=>{
 const orientations=[null,{yawDegrees:113.5,tiltDegrees:-4.2,rollDegrees:-6.3},{yawDegrees:90,tiltDegrees:45,rollDegrees:30},{yawDegrees:-360,tiltDegrees:90,rollDegrees:180}];
 const seeds=[0,1,42,341070,4294967295],elevations=[25,30,45,63,78,90];let alphaMin=Infinity,alphaMax=0,maximumWidthError=0,minimumAirYForDefaultCone=Infinity;const low=[];
 for(const seed of seeds)for(const elevation of elevations)for(const burstOrientation of orientations){const p=proposed({seed,elevation,burstOrientation}),{event,oldHeads}=p,w=width(event.heads,T);maximumWidthError=Math.max(maximumWidthError,Math.abs(w.metres-120));assert(Math.abs(w.metres-120)<1e-10);for(let i=0;i<192;i++){const a=oldHeads[i],b=event.heads[i];assert.equal(b.id,a.id);assert.equal(b.burnProfile,a.burnProfile);assert.equal(b.trailProfile,a.trailProfile);assert.equal(b.intensity,a.intensity);assert.equal(b.life,a.life);assert.equal(b.drag,K);assert.equal(b.birth,a.birth);assert.equal(b.radius,a.radius);}
 const poses=event.heads.map(b=>sampleBody(b,b.birth+T,timeline)),endY=event.heads.map(b=>sampleBody(b,b.birth+b.life,timeline).position[1]),below=poses.filter(v=>v.position[1]<=.03).length,minLifeY=Math.min(...endY,event.burstPosition[1]);if(elevation>=63)minimumAirYForDefaultCone=Math.min(minimumAirYForDefaultCone,minLifeY);
 const row={seed,elevation,orientation:burstOrientation,alpha:p.alpha,burstY:event.burstPosition[1],headsBelowSeaAt2p5:below,minimumHeadYOverOwnLifetime:minLifeY};phaseCases.push(row);if(elevation<=30&&low.length<12)low.push(row);alphaMin=Math.min(alphaMin,p.alpha);alphaMax=Math.max(alphaMax,p.alpha);
 }
 assert(minimumAirYForDefaultCone>.03);return{cases:phaseCases.length,alphaMin,alphaMax,maximumWidthError,minimumHeadYOverLifetimeInSampled63to90Cone:minimumAirYForDefaultCone,lowAngleExamples:low,scope:'120m is authored free-flight/pre-contact burning-head geometry. No claim that contact-clipped visible width remains120m or that finite samples prove all orientations stay airborne.'};
});
const sea={schema:'r35-verification-static-mean-sea',minimumHeight:0,maximumHeight:0,maximumSpatialSlope:0,maximumTimeRate:0,clearanceMetres:.03,heightAt:()=>0,boundAtHorizontalRegion:()=>({minimumHeight:0,maximumHeight:0,maximumSpatialSlope:0,maximumTimeRate:0,heightErrorMetres:0,certifiedSeaOnly:true,planeHeight:0})};
const raised={...sea,schema:'r35-verification-raised-plane',minimumHeight:.5,maximumHeight:.5,heightAt:()=>.5,boundAtHorizontalRegion:()=>({minimumHeight:.5,maximumHeight:.5,maximumSpatialSlope:0,maximumTimeRate:0,heightErrorMetres:0,certifiedSeaOnly:false})};
const bisect=(g,lo,hi)=>{assert(g(lo)>0&&g(hi)<0);for(let i=0;i<80;i++){const mid=(lo+hi)*.5;if(!(mid>lo&&mid<hi))break;if(g(mid)>0)lo=mid;else hi=mid;}return(lo+hi)*.5;};
check('Unmodified actual contact adapter handles faster head and fixed-lag tail crossings at low elevations with causal finite support',()=>{
 let cases=0,maxRootError=0,maxUnresolved=0,maxEvals=0;for(const seed of[0,42,341070])for(const elevation of[25,30])for(const surface of[sea,raised]){const{event}=proposed({seed,elevation});const bodies=event.heads.filter(b=>sampleBody(b,b.birth+b.life,timeline).position[1]<surface.minimumHeight+.03).slice(0,3);assert(bodies.length);
 for(const body of bodies)for(const lag of[0,.1,.3]){const node=lag?createTailReleaseFieldNode(body,lag):body,pose=t=>lag?sampleTailReleaseFieldNode(node,t,timeline):sampleBody(node,t,timeline),end=body.birth+body.life+lag,g=t=>pose(t).position[1]-surface.heightAt(0,0)-.03,hit=bisect(g,node.birth,end),now=hit+.001;
 for(const S of[1/120,.1,.5,1]){const support=createFireworkContactSupport(surface);support.begin({physicalNow:now,windTimeline:timeline});const state=pose(now),p={sourceBody:body,position:state.position,...(lag?{tailFieldNode:node}:{})},r=support.resolve(p,resolveFireworkExposure({physicalNow:now,shutterSeconds:S}));assert(r&&r.intervals.length===1&&r.currentActive===false);const to=r.intervals[0].to;assert(to<=hit+1e-14&&hit-to<1e-8);assert(pose(r.intervals[0].anchorTime).position[1]>surface.minimumHeight+.03);assert(r.totalUnresolvedSeconds<=1e-7);maxRootError=Math.max(maxRootError,hit-to);maxUnresolved=Math.max(maxUnresolved,r.totalUnresolvedSeconds);maxEvals=Math.max(maxEvals,support.diagnostics().evaluations);cases++;}
 }}return{cases,maxRootErrorSeconds:maxRootError,maxUnresolvedSeconds:maxUnresolved,maximumAdapterEvaluations:maxEvals,actualAdapterUnmodified:true};
});
check('Existing resolveBurst carries scaled baseVelocity through committed wind once and leaves calibration width unchanged',()=>{
 const {event}=proposed({seed:341070,elevation:63,burstOrientation:{yawDegrees:90,tiltDegrees:45,rollDegrees:30}}),at=event.burstTime+T,wind=[{time:-Infinity,wind:[1,0,-2]},{time:event.burstTime-.5,wind:[4,.2,1]},{time:event.burstTime+.4,wind:[-3,-.1,2]}];
 const before=event.heads.map(b=>[...b.baseVelocity]);sampleFireworkEvent(event,at,{windTimeline:wind,smoke:false,stars:false});const positions=event.heads.filter(b=>b.layerId==='outer').map(b=>sampleBody(b,at,wind).position);let d=0;for(let i=0;i<positions.length;i++)for(let j=0;j<i;j++)d=Math.max(d,Math.hypot(positions[i][0]-positions[j][0],positions[i][2]-positions[j][2]));assert(Math.abs(d-120)<1e-10);assert.deepEqual(event.heads.map(b=>b.baseVelocity),before);const once=event.heads.map(b=>[...b.velocity]);sampleFireworkEvent(event,at,{windTimeline:wind,smoke:false,stars:false});assert.deepEqual(event.heads.map(b=>b.velocity),once);return{width:d,repeatExact:true,source:'actual sampleFireworkEvent→resolveBurst→sampleBody; proposed velocity patches only'};
});
const report={schema:'glass-atoll.r35-scale-contact-independent-study.v1',passed:checks.every(c=>c.passed),actualGPU:false,browserActions:0,rendererCalls:0,productionEdits:0,proposedProfile:'three-heart-scale120-v1',scope:'Independent verification-only cloned existing three-heart producer with common relative kick factor; not new production compiler integration acceptance.',sourcePins,counts:{passed:checks.filter(c=>c.passed).length,total:checks.length},checks,phaseCases,limitations:['Finite spherical net bound uses analytic real-arithmetic Lipschitz reasoning with a generous numerical margin, not a formal directed-rounding certificate.','Sampled angle/seed lifetime and contact tests are falsification evidence, not a global all-seed terrain/visibility guarantee.','Shell-carrier velocity is unchanged; finite-point kick centroid can be nonzero and scales. No measured particle-mass COM conservation is asserted.','No visual, performance, GPU capacity, photometry, chemical fuel or supplier time-curve calibration acceptance.']};
fs.writeFileSync(new URL('./r35-scale-contact-independent-study.json',import.meta.url),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({passed:report.passed,counts:report.counts,checks:checks.map(c=>({name:c.name,passed:c.passed,evidence:c.evidence,error:c.error}))},null,2));if(!report.passed)process.exitCode=1;
