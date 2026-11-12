import assert from 'node:assert/strict';
import fs from 'node:fs';
import crypto from 'node:crypto';
import {resolveBoundedAirSupport,resolvePlaneAirSupport,createBoundedAirClearance,AirSupportCapacityError} from '../firework-air-support.js';
import {flightSegment} from '../fireworks-physics.js';
const checks=[],started=new Date().toISOString(),TOL=1e-8;
function check(name,fn){try{checks.push({name,passed:true,details:fn()??null});}catch(error){checks.push({name,passed:false,error:String(error.stack)});}}
const close=(a,b,t=1e-10)=>assert.ok(Math.abs(a-b)<=t,`${a} != ${b}; error ${Math.abs(a-b)}`);
function polynomialBounds(a,b){const g=t=>(t-.3)*(t-.7),v=[g(a),g(b)];if(a<=.5&&b>=.5)v.push(g(.5));return{lower:Math.min(...v),upper:Math.max(...v)};}
function polynomial(options={}){return resolveBoundedAirSupport({physicalNow:1,from:0,to:1,sampleClearanceAt:t=>(t-.3)*(t-.7),boundInterval:({from,to})=>polynomialBounds(from,to),...options});}
function root(g,a,b){let left=g(a);for(let i=0;i<70;i++){const m=a+(b-a)*.5;if(!(m>a&&m<b))break;const mid=g(m);if((mid>0)===(left>0)){a=m;left=mid;}else b=m;}return(a+b)*.5;}
function verifyPartition(r,g){
  for(const p of r.intervals){assert.ok(p.anchorTime>=p.from&&p.anchorTime<=p.to);assert.ok(p.anchorClearanceLowerBound>0);assert.ok(g(p.anchorTime)>0);for(let i=0;i<=20;i++)assert.ok(g(p.from+(p.to-p.from)*i/20)>0);}
  for(const p of r.negativeIntervals)for(let i=0;i<=20;i++)assert.ok(g(p.from+(p.to-p.from)*i/20)<=1e-12);
  const coverage=[...r.intervals,...r.negativeIntervals,...r.unresolvedBrackets].sort((a,b)=>a.from-b.from);let at=r.from;for(const p of coverage){close(p.from,at,1e-14);assert.ok(p.to>=p.from);at=p.to;}close(at,r.to,1e-14);
}
check('Disconnected positive intervals remain distinct, with complete certain/possible/uncertain coverage',()=>{
  const r=polynomial();assert.equal(r.status,'bounded');assert.equal(r.intervals.length,2);assert.equal(r.possibleIntervals.length,2);assert.equal(r.currentActive,true);assert.ok(r.intervals[0].to<=.3&&.3-r.intervals[0].to<TOL);assert.ok(r.intervals[1].from>=.7&&r.intervals[1].from-.7<TOL);assert.ok(r.unresolvedBrackets.every(p=>p.to-p.from<=TOL));verifyPartition(r,t=>(t-.3)*(t-.7));return{intervals:r.intervals,uncertainty:r.totalUnresolvedSeconds,evaluations:r.evaluations};
});
check('Endpoint and instantaneous support use the same strict clearance >0 rule',()=>{
  for(const value of [-1,0,1]){const r=resolveBoundedAirSupport({physicalNow:3,from:3,to:3,sampleClearanceAt:()=>value,boundInterval:()=>{throw new Error('No interval bound needed for S0');}});assert.equal(r.currentActive,value>0);assert.equal(r.intervals.length,value>0?1:0);assert.equal(r.evaluations.bounds,0);assert.equal(r.totalUnresolvedSeconds,0);}const r=polynomial({from:.3,to:.3,physicalNow:.3});assert.equal(r.currentActive,false);
});
check('Every external sample and interval-bound query is causal and inside the requested exposure',()=>{
  const samples=[],bounds=[],r=polynomial({physicalNow:.9,from:.2,to:.9,sampleClearanceAt:t=>{samples.push(t);return(t-.3)*(t-.7);},boundInterval:q=>{bounds.push(q);return polynomialBounds(q.from,q.to);}});assert.ok(samples.length>0);assert.ok(samples.every(t=>t>=.2&&t<=.9));assert.ok(bounds.every(p=>p.from>=.2&&p.to<=.9));assert.equal(r.physicalNow,.9);return{samples:samples.length,bounds:bounds.length,maximumSample:Math.max(...samples)};
});
check('Certified high altitude uses the surface/trajectory bound without sampling either function',()=>{
  let bounds=0;const contract=createBoundedAirClearance({sampleAt:()=>{throw new Error('High-altitude sample should not run');},trajectoryBounds:()=>{bounds++;return{minimumY:90,maximumY:100,maximumAbsVerticalSpeed:20,maximumHorizontalSpeed:10};},surface:{heightAt:()=>{throw new Error('High-altitude height query should not run');},minimumHeight:0,maximumHeight:1.327,maximumSpatialSlope:.26,maximumTimeRate:0}}),r=resolveBoundedAirSupport({physicalNow:4,from:3,to:4,...contract});assert.equal(r.status,'resolved');assert.equal(r.intervals.length,1);assert.equal(r.currentActive,true);assert.equal(r.currentClearance,null);assert.equal(r.evaluations.samples,0);assert.equal(bounds,1);assert.ok(r.intervals[0].anchorClearanceLowerBound>88);return{bounds,samples:r.evaluations.samples,anchorLowerClearance:r.intervals[0].anchorClearanceLowerBound};
});
check('A bounded continuous ridge crossing cannot be missed by positive endpoint samples',()=>{
  const centre=.505,halfWidth=.02,peak=.2,slope=peak/halfWidth,height=t=>Math.max(0,peak-slope*Math.abs(t-centre));
  const contract=createBoundedAirClearance({sampleAt:t=>({position:[t,.15,0]}),trajectoryBounds:()=>({minimumY:.15,maximumY:.15,maximumAbsVerticalSpeed:0,maximumHorizontalSpeed:1}),surface:{heightAt:x=>height(x),minimumHeight:0,maximumHeight:peak,maximumSpatialSlope:slope,maximumTimeRate:0}}),r=resolveBoundedAirSupport({physicalNow:1,from:0,to:1,...contract,maxEvaluations:20000});assert.equal(r.status,'bounded');assert.equal(r.intervals.length,2);const a=centre-(peak-.12)/slope,b=centre+(peak-.12)/slope;assert.ok(r.intervals[0].to<=a&&a-r.intervals[0].to<TOL);assert.ok(r.intervals[1].from>=b&&r.intervals[1].from-b<TOL);verifyPartition(r,t=>.15-height(t)-.03);return{analyticCrossings:[a,b],intervals:r.intervals,evaluations:r.evaluations};
});
check('A narrow positive island between ordinary coarse-grid samples is retained in possible and inner support',()=>{
  const c=.500731,e=1e-5,g=t=>e*e-(t-c)**2;
  const r=resolveBoundedAirSupport({physicalNow:1,from:0,to:1,sampleClearanceAt:g,clearanceToleranceMetres:0,boundInterval:({from,to})=>({lower:Math.min(g(from),g(to)),upper:from<=c&&to>=c?e*e:Math.max(g(from),g(to))})});assert.ok([0,.25,.5,.75,1].every(t=>g(t)<0));assert.equal(r.intervals.length,1);assert.ok(r.intervals[0].from>=c-e&&r.intervals[0].to<=c+e);assert.ok(r.intervals[0].to-r.intervals[0].from>1.9e-5);assert.equal(r.status,'bounded');verifyPartition(r,g);return{inner:r.intervals[0],possible:r.possibleIntervals[0],unresolvedSeconds:r.totalUnresolvedSeconds};
});
check('Tangency and large unresolved intervals are reported rather than filled or silently dropped',()=>{
  const tangent=resolveBoundedAirSupport({physicalNow:1,from:0,to:1,sampleClearanceAt:t=>(-((t-.5)**2)),boundInterval:({from,to})=>({lower:Math.min((-((from-.5)**2)),(-((to-.5)**2))),upper:from<=.5&&to>=.5?0:Math.max((-((from-.5)**2)),(-((to-.5)**2)))})});assert.equal(tangent.status,'resolved');assert.equal(tangent.intervals.length,0);
  const unresolved=polynomial({maxDepth:0});assert.equal(unresolved.status,'uncertain');assert.equal(unresolved.intervals.length,0);assert.deepEqual(unresolved.possibleIntervals,[{from:0,to:1}]);assert.equal(unresolved.totalUnresolvedSeconds,1);assert.equal(unresolved.currentActive,true);return{unresolved};
});
check('Interval and evaluation overflow reject atomically, retaining no partial public result or input mutation',()=>{
  let returned=null;assert.throws(()=>returned=polynomial({maxIntervals:1}),e=>e instanceof AirSupportCapacityError&&e.code==='AIR_SUPPORT_CAPACITY');assert.equal(returned,null);assert.throws(()=>polynomial({maxEvaluations:1}),e=>e instanceof AirSupportCapacityError&&e.limit==='evaluations');const cuts=Object.freeze([.1,.8]);const r=polynomial({partitionTimes:cuts});assert.deepEqual(cuts,[.1,.8]);assert.ok(Object.isFrozen(r)&&Object.isFrozen(r.intervals)&&Object.isFrozen(r.intervals[0]));
});
check('Invalid domains, callbacks, contradictory bounds and asynchronous results are rejected',()=>{
  for(const patch of [{physicalNow:.5},{from:2},{to:Infinity},{timeToleranceSeconds:0},{maxDepth:65},{maxIntervals:0}])assert.throws(()=>polynomial(patch));assert.throws(()=>polynomial({sampleClearanceAt:async()=>1}),TypeError);assert.throws(()=>polynomial({boundInterval:()=>Promise.resolve({lower:0,upper:1})}),TypeError);
  assert.throws(()=>polynomial({boundInterval:({from,to})=>from===0&&to===1?{lower:-1,upper:1}:{lower:2,upper:3}}),/contradicts/);
  const contract=createBoundedAirClearance({sampleAt:()=>({position:[0,0,0]}),trajectoryBounds:()=>({minimumY:0,maximumY:0,maximumAbsVerticalSpeed:0,maximumHorizontalSpeed:0}),surface:{heightAt:()=>2,minimumHeight:0,maximumHeight:1,maximumSpatialSlope:0,maximumTimeRate:0}});assert.throws(()=>contract.sampleClearanceAt(0),/exceeds/);
});
check('Ballistic and tiny-drag plane roots match an independent quadratic solution',()=>{
  const y=1,vy=10,g=9.81,contact=(vy+Math.sqrt(vy*vy+2*g*(y-.03)))/g,out=[];
  for(const drag of [0,1e-10]){const r=resolvePlaneAirSupport({physicalNow:4,from:0,to:4,segments:[{from:0,to:4,y,vy,drag,gravity:g,windY:100}]});assert.equal(r.status,'bounded');assert.equal(r.intervals.length,1);assert.equal(r.currentActive,false);assert.ok(r.intervals[0].to<=contact&&contact-r.intervals[0].to<TOL);assert.ok(r.possibleIntervals[0].to>=contact);assert.ok(r.unresolvedBrackets.some(p=>p.from<=contact&&p.to>=contact));verifyPartition(r,t=>y+vy*t-.5*g*t*t-.03);out.push({drag,contact,innerEnd:r.intervals[0].to,uncertainty:r.totalUnresolvedSeconds});}return out;
});
check('Positive-drag flat-plane contact agrees with independent production ODE samples and brackets',()=>{
  const rows=[];for(const drag of [.075,.613125,1.35])for(const windY of [-.5,0,.8]){const s={from:0,to:6,y:34,vy:-4,drag,gravity:9.81,windY},g=t=>flightSegment([0,s.y,0],[0,s.vy,0],t,s.drag,[0,windY,0],s.gravity).position[1]-.03,contact=root(g,0,6),r=resolvePlaneAirSupport({physicalNow:6,from:0,to:6,segments:[s]});assert.equal(r.status,'bounded');assert.equal(r.intervals.length,1);assert.ok(r.intervals[0].to<=contact&&contact-r.intervals[0].to<2*TOL);assert.ok(r.unresolvedBrackets.some(p=>p.from<=contact&&p.to>=contact));verifyPartition(r,g);rows.push({drag,windY,errorSeconds:contact-r.intervals[0].to,bracket:r.maximumUnresolvedBracketSeconds});}return rows;
});
check('Held-wind changes and a vertical minimum preserve disconnected visible intervals',()=>{
  const first={from:0,to:1,y:1,vy:-3,drag:1,windY:0,gravity:0},p=flightSegment([0,first.y,0],[0,first.vy,0],1,1,[0,0,0],0),second={from:1,to:3,y:p.position[1],vy:p.velocity[1],drag:1,windY:5,gravity:0};
  const g=t=>{const s=t<1?first:second;return flightSegment([0,s.y,0],[0,s.vy,0],t-s.from,1,[0,s.windY,0],0).position[1]-.03;},r=resolvePlaneAirSupport({physicalNow:3,from:0,to:3,segments:[first,second]});assert.equal(r.status,'bounded');assert.equal(r.intervals.length,2);assert.equal(r.currentActive,true);const contacts=[root(g,0,1),root(g,1.5,3)];assert.ok(r.intervals[0].to<=contacts[0]&&contacts[0]-r.intervals[0].to<TOL);assert.ok(r.intervals[1].from>=contacts[1]&&r.intervals[1].from-contacts[1]<TOL);verifyPartition(r,g);return{contacts,intervals:r.intervals,uncertainty:r.totalUnresolvedSeconds};
});
check('Plane endpoints, constant surface equality and near-surface uncertainty follow declared conventions',()=>{
  const on=resolvePlaneAirSupport({physicalNow:1,from:0,to:1,segments:[{from:0,to:1,y:.03,vy:0,gravity:0,drag:0}]});assert.equal(on.status,'resolved');assert.equal(on.currentActive,false);assert.equal(on.intervals.length,0);
  const instant=resolvePlaneAirSupport({physicalNow:2,from:2,to:2,segments:[{from:0,to:2,y:10,vy:0,gravity:0,drag:0}]});assert.equal(instant.currentActive,true);assert.equal(instant.intervals[0].anchorTime,2);
  const near=resolvePlaneAirSupport({physicalNow:1,from:0,to:1,numericPaddingMetres:1e-9,segments:[{from:0,to:1,y:.0300000001,vy:0,gravity:0,drag:0}]});assert.equal(near.status,'uncertain');assert.equal(near.totalUnresolvedSeconds,1);assert.equal(near.currentActive,true);return{nearStatus:near.status,possible:near.possibleIntervals};
});
check('Plane piece gaps, discontinuity and future endpoints are rejected before publishing support',()=>{
  const a={from:0,to:1,y:10,vy:0,gravity:0,drag:0};for(const segments of [[a,{...a,from:1.1,to:2}],[a,{...a,from:1,to:2,y:11}],[{...a,to:3}]])assert.throws(()=>resolvePlaneAirSupport({physicalNow:2,from:0,to:2,segments}));
});
check('An admitted tiny pose seam cannot hide positive support immediately before a piece boundary',()=>{
  const segments=[{from:0,to:1,y:.03-1e-9,vy:2e-9,drag:0,gravity:0},{from:1,to:2,y:.03-1e-9,vy:2e-9,drag:0,gravity:0}],r=resolvePlaneAirSupport({physicalNow:2,from:0,to:1,segments,clearanceToleranceMetres:0,numericPaddingMetres:0});
  // Both right-hand endpoint clearances are negative, yet the first piece is
  // above sea from about0.5 until its left limit at1. The permitted tiny seam
  // must not make the complete interval falsely classify as nonpositive.
  assert.ok(r.intervals.some(p=>p.from<.75&&p.to>.75));assert.ok(r.possibleIntervals.some(p=>p.from<=.75&&p.to>=.75));assert.notEqual(r.status,'resolved');assert.ok(r.totalUnresolvedSeconds>0);return{status:r.status,intervals:r.intervals,uncertainty:r.totalUnresolvedSeconds};
});
check('Unrepresentable root precision remains uncertain instead of claiming a narrower time bracket',()=>{
  const epoch=1e9,g=t=>epoch+.5-t,r=resolveBoundedAirSupport({physicalNow:epoch+1,from:epoch,to:epoch+1,timeToleranceSeconds:1e-8,clearanceToleranceMetres:0,sampleClearanceAt:g,boundInterval:({from,to})=>({lower:g(to)-1e-12,upper:g(from)+1e-12})});assert.equal(r.status,'uncertain');assert.ok(r.maximumUnresolvedBracketSeconds>r.timeToleranceSeconds);assert.ok(r.unresolvedBrackets.some(p=>p.from<=epoch+.5&&p.to>=epoch+.5));return{bracket:r.maximumUnresolvedBracketSeconds,tolerance:r.timeToleranceSeconds};
});
check('Constant light keeps original full-exposure normalization and strictly positive local anchors',()=>{
  const r=polynomial(),S=r.durationSeconds,I=7,inner=r.intervals.reduce((sum,p)=>sum+(p.to-p.from)/S*I,0),analytic=.6*I;assert.ok(inner<=analytic);assert.ok(analytic-inner<=r.totalUnresolvedSeconds/S*I+1e-13);for(const p of r.intervals){const d=p.to-p.from,physicalVelocity=3,uploadedVelocity=physicalVelocity*d/S;close(uploadedVelocity*S,physicalVelocity*d);assert.ok((p.anchorTime-.3)*(p.anchorTime-.7)>0);}return{innerMean:inner,analyticMean:analytic,errorBound:r.totalUnresolvedSeconds/S*I};
});
const source=fs.readFileSync(new URL('../firework-air-support.js',import.meta.url),'utf8'),report={schema:'glass-atoll.r21-air-support-check.v1',started,completed:new Date().toISOString(),passed:checks.every(c=>c.passed),counts:{passed:checks.filter(c=>c.passed).length,total:checks.length},sourceSHA256:crypto.createHash('sha256').update(source).digest('hex'),checks,limits:['CPU pure support primitive only; no production wiring, GPU or browser.','Generic proof is conditional on caller-supplied continuous clearance/trajectory/surface bounds.','Intervals are inner positive support; every ambiguous root interval remains explicit with finite width. Status uncertain requires caller handling.','No material extinction, smoke deletion, terrain-bound discovery, powered-force solve or nonlinear shutter-image claim.']};
fs.writeFileSync(new URL('./r21-air-support-check.json',import.meta.url),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report,null,2));if(!report.passed)process.exitCode=1;
