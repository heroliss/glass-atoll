import assert from 'node:assert/strict';
import fs from 'node:fs';
import crypto from 'node:crypto';
import {createFireworkEvent,sampleBody} from '../fireworks-physics.js';
import {createTailReleaseFieldNode,sampleTailReleaseFieldNode} from '../firework-tail-field.js';
import {resolveFireworkExposure} from '../firework-exposure-window.js';
const sourceURL=new URL('../firework-contact-support.js',import.meta.url),source=fs.readFileSync(sourceURL,'utf8'),checks=[],started=new Date().toISOString();
let instrumented=source.replace("import {sampleBody} from './fireworks-physics.js';",`import {sampleBody as rawBody} from '${new URL('../fireworks-physics.js',import.meta.url).href}';\nexport const __qaTimes=[];const sampleBody=(body,time,timeline)=>{__qaTimes.push(time);return rawBody(body,time,timeline);};`).replace("import {sampleTailReleaseFieldNode} from './firework-tail-field.js';",`import {sampleTailReleaseFieldNode as rawField} from '${new URL('../firework-tail-field.js',import.meta.url).href}';\nconst sampleTailReleaseFieldNode=(node,time,timeline)=>{__qaTimes.push(time);return rawField(node,time,timeline);};`).replace("from './firework-air-support.js'",`from '${new URL('../firework-air-support.js',import.meta.url).href}'`);
const {createFireworkContactSupport,__qaTimes}=await import('data:text/javascript;base64,'+Buffer.from(instrumented).toString('base64'));
function check(name,fn){try{checks.push({name,passed:true,details:fn()??null});}catch(error){checks.push({name,passed:false,error:String(error.stack).replace(/data:text\/javascript;base64,[^\s)]+/g,'[instrumented actual adapter]')});}}
const surface=Object.freeze({schema:'test.flat-mean-sea',minimumHeight:0,maximumHeight:0,maximumSpatialSlope:0,maximumTimeRate:0,clearanceMetres:.03,heightAt:()=>0,boundAtHorizontalRegion:()=>({minimumHeight:0,maximumHeight:0,maximumSpatialSlope:0,maximumTimeRate:0,heightErrorMetres:0,certifiedSeaOnly:true,planeHeight:0})}),timeline=[{time:-Infinity,wind:[0,0,0]}];
const exp=(now,S)=>resolveFireworkExposure({physicalNow:now,shutterSeconds:S});
function root(g,a,b){const leftPositive=g(a)>0;for(let i=0;i<75;i++){const m=a+(b-a)*.5;if(!(m>a&&m<b))break;if((g(m)>0)===leftPositive)a=m;else b=m;}return(a+b)*.5;}
function hitBody(event){for(const body of event.heads){const end=body.birth+body.life-.01,g=t=>sampleBody(body,t,timeline).position[1]-.03;if(g(body.birth)>0&&g(end)<0)return{body,hit:root(g,body.birth,end),g};}throw new Error('No live downward crossing in fixture');}
function visibleAnchors(result,sampler){for(const p of result.intervals)assert.ok(sampler(p.anchorTime).position[1]>.03);}
check('Actual 25degree layered bodies preserve pre-contact exposure after current air light ends',()=>{
  let cases=0,maxError=0,maxUncertainty=0;for(let seed=1;seed<=8;seed++){const event=createFireworkEvent({type:'chrysanthemum',effectProfile:'three-heart-v1',seed,elevation:25,starDragModel:'bounded-descent'}),{body,hit,g}=hitBody(event);
    for(const S of [1/120,.1,.5,1]){const now=hit+.001,a=createFireworkContactSupport(surface);a.begin({physicalNow:now,windTimeline:timeline});const p={sourceBody:body,position:sampleBody(body,now,timeline).position},r=a.resolve(p,exp(now,S));assert.ok(r);assert.equal(r.status,'bounded');assert.equal(r.currentActive,false);assert.equal(a.isAboveSurface(p.position),false);assert.equal(r.intervals.length,1);const end=r.intervals[0].to;assert.ok(end<=hit&&hit-end<=1e-8);assert.ok(r.possibleIntervals[0].to>=hit);visibleAnchors(r,t=>sampleBody(body,t,timeline));maxError=Math.max(maxError,hit-end);maxUncertainty=Math.max(maxUncertainty,r.totalUnresolvedSeconds);cases++;}
  }return{cases,maxBoundaryUnderestimateSeconds:maxError,maxUncertaintySeconds:maxUncertainty};
});
check('Actual fixed-lag tail lanes use the field trajectory and retain a valid above-water history anchor',()=>{
  let cases=0,maxUncertainty=0;for(let seed=1;seed<=4;seed++){const event=createFireworkEvent({type:'chrysanthemum',effectProfile:'three-heart-v1',seed,elevation:25,starDragModel:'bounded-descent'}),{body}=hitBody(event);
    for(const lag of [.00625,.1,.31]){const node=createTailReleaseFieldNode(body,lag),q=t=>sampleTailReleaseFieldNode(node,t,timeline),hit=root(t=>q(t).position[1]-.03,node.birth,body.birth+body.life+.5),now=hit+.001,a=createFireworkContactSupport(surface);a.begin({physicalNow:now,windTimeline:timeline});const p={sourceBody:body,tailFieldNode:node,position:q(now).position},r=a.resolve(p,exp(now,.1));assert.ok(r);assert.equal(r.status,'bounded');assert.equal(r.currentActive,false);assert.equal(r.intervals.length,1);assert.ok(r.intervals[0].to<=hit&&hit-r.intervals[0].to<=1e-8);visibleAnchors(r,q);assert.ok(a.diagnostics().boundedSolves===1);maxUncertainty=Math.max(maxUncertainty,r.totalUnresolvedSeconds);cases++;}
  }return{cases,maxUncertaintySeconds:maxUncertainty};
});
check('Recommended 78degree real bodies and tails take the unchanged high-air fast path',()=>{
  const event=createFireworkEvent({type:'chrysanthemum',effectProfile:'three-heart-v1',seed:9,elevation:78,starDragModel:'bounded-descent'}),now=event.burstTime+1.5,a=createFireworkContactSupport(surface);a.begin({physicalNow:now,windTimeline:timeline});let cases=0;
  for(const body of event.heads)for(const lag of [null,.1,.31]){const node=lag===null?body:createTailReleaseFieldNode(body,lag),pose=t=>lag===null?sampleBody(body,t,timeline):sampleTailReleaseFieldNode(node,t,timeline),p={sourceBody:body,...(lag===null?{}:{tailFieldNode:node}),position:pose(now).position};assert.equal(a.resolve(p,exp(now,1)),null);for(let j=0;j<=20;j++)assert.ok(pose(now-j/20).position[1]>.03);cases++;}return{cases,diagnostics:a.diagnostics()};
});
check('No adapter sample asks for a future or unborn physical pose',()=>{
  __qaTimes.length=0;const e=createFireworkEvent({type:'chrysanthemum',effectProfile:'three-heart-v1',seed:3,elevation:25,starDragModel:'bounded-descent'}),{body,hit}=hitBody(e),now=hit+.001,a=createFireworkContactSupport(surface);a.begin({physicalNow:now,windTimeline:timeline});const node=createTailReleaseFieldNode(body,.1),q=sampleTailReleaseFieldNode(node,now,timeline);a.resolve({sourceBody:body,tailFieldNode:node,position:q.position},exp(now,.1));assert.ok(__qaTimes.length);assert.ok(__qaTimes.every(t=>Number.isFinite(t)&&t<=now));assert.ok(__qaTimes.every(t=>t>=body.birth));return{calls:__qaTimes.length,earliest:Math.min(...__qaTimes),latest:Math.max(...__qaTimes),physicalNow:now};
});
check('A near-surface newborn clipped to an instant does not enter an empty plane-piece solve',()=>{
  const body={birth:1,position:[100,.04,100],velocity:[0,1,0],drag:.2,gravity:9.81},a=createFireworkContactSupport(surface);a.begin({physicalNow:1,windTimeline:timeline});const r=a.resolve({sourceBody:body,position:[...body.position]},exp(1,.2));assert.ok(r);assert.ok(r.intervals.every(p=>p.to===p.from));assert.equal(r.totalUnresolvedSeconds,0);
});
check('Zero shutter contact and current support use a consistent strict endpoint convention',()=>{
  for(const y of [.029,.03,.031]){const body={birth:0,position:[100,y,100],velocity:[0,0,0],drag:0,gravity:0},a=createFireworkContactSupport(surface);a.begin({physicalNow:1,windTimeline:timeline});const current=a.isAboveSurface(body.position),r=a.resolve({sourceBody:body,position:[...body.position]},exp(1,0));if(r)assert.equal(r.currentActive,current);assert.equal(current,y>.03);}
});
check('Raised .003/.033 endpoint keeps the exact shared subtraction convention at S0',()=>{
  const h=.003,y=.033,raised={...surface,schema:'test.ulp-raised-contact',minimumHeight:h,maximumHeight:h,heightAt:()=>h,boundAtHorizontalRegion:()=>({minimumHeight:h,maximumHeight:h,maximumSpatialSlope:0,maximumTimeRate:0,heightErrorMetres:0,certifiedSeaOnly:false})},body={birth:0,position:[0,y,0],velocity:[0,0,0],drag:0,gravity:0},a=createFireworkContactSupport(raised);a.begin({physicalNow:1,windTimeline:timeline});
  const numericalClearance=y-h-.03,oldAdditionPredicate=y>h+.03,current=a.isAboveSurface(body.position),r=a.resolve({sourceBody:body,position:[...body.position]},exp(1,0));
  assert.equal(oldAdditionPredicate,false);assert.ok(numericalClearance>0);assert.equal(current,true);assert.ok(r);assert.equal(r.currentActive,current);assert.equal(r.currentClearance,numericalClearance);assert.equal(r.intervals.length,1);return{height:h,y,numericalClearance,oldAdditionPredicate,currentActive:current,instantaneousActive:r.currentActive};
});
check('An elevated static surface is used for both current and historical support',()=>{
  const island={...surface,schema:'test.raised-flat-land',minimumHeight:.5,maximumHeight:.5,heightAt:()=>.5,boundAtHorizontalRegion:()=>({minimumHeight:.5,maximumHeight:.5,maximumSpatialSlope:0,maximumTimeRate:0,heightErrorMetres:0,certifiedSeaOnly:false})},body={birth:0,position:[0,.54,0],velocity:[0,-1,0],drag:0,gravity:0},a=createFireworkContactSupport(island),now=.02;a.begin({physicalNow:now,windTimeline:timeline});const p={sourceBody:body,position:sampleBody(body,now,timeline).position};assert.equal(a.isAboveSurface(p.position),false);const r=a.resolve(p,exp(now,.02));assert.ok(r&&r.intervals.length===1);assert.ok(r.intervals[0].to<=.01&&.01-r.intervals[0].to<1e-8);for(const s of r.intervals)assert.ok(sampleBody(body,s.anchorTime,timeline).position[1]>.53);return{interval:r.intervals[0]};
});
check('Committed wind changes remain causal and are split into valid plane pieces',()=>{
  const body={birth:0,position:[100,1,100],velocity:[0,-2,0],drag:.2,gravity:9.81},wind=[{time:-Infinity,wind:[0,0,0]},{time:.2,wind:[0,.5,0]}],now=.3,a=createFireworkContactSupport(surface);a.begin({physicalNow:now,windTimeline:wind});const p={sourceBody:body,position:sampleBody(body,now,wind).position},r=a.resolve(p,exp(now,.3));assert.ok(r);assert.ok(r.status==='bounded'||r.status==='resolved');for(const s of r.intervals)assert.ok(sampleBody(body,s.anchorTime,wind).position[1]>.03);return{status:r.status,diagnostics:a.diagnostics()};
});
check('Future, NaN and unsorted wind histories cannot be treated as committed bounds',()=>{
  for(const bad of [[{time:-Infinity,wind:[0,0,0]},{time:2,wind:[0,50,0]}],[{time:NaN,wind:[0,0,0]}],[{time:-Infinity,wind:[0,0,0]},{time:.8,wind:[0,0,0]},{time:.5,wind:[0,0,0]}]]){const a=createFireworkContactSupport(surface);assert.throws(()=>a.begin({physicalNow:1,windTimeline:bad}));}
});
check('Same-width past windows cannot silently reuse a causal-end window cache entry',()=>{
  const body={birth:0,position:[100,1,100],velocity:[0,-1,0],drag:0,gravity:0},a=createFireworkContactSupport(surface),now=1;a.begin({physicalNow:now,windTimeline:timeline});const p={sourceBody:body,position:sampleBody(body,now,timeline).position},current=exp(now,.1);a.resolve(p,current);
  // The implementation may support arbitrary past windows with distinct cache
  // keys, or explicitly admit causal-end windows only. Both are sound.
  const older={...current,from:.5,to:.6,physicalNow:now,durationSeconds:.1};let r;try{r=a.resolve(p,older);}catch{return;}assert.ok(r===null||r.intervals.every(s=>s.from>=.5&&s.to<=.6));
});
check('Unadmitted motor forcing rejects its contact speed bound explicitly',()=>{
  const body={birth:0,position:[100,.5,100],velocity:[0,-1,0],drag:0,gravity:0,motorProfile:{}},a=createFireworkContactSupport(surface);a.begin({physicalNow:1,windTimeline:timeline});assert.throws(()=>a.resolve({sourceBody:body,position:[100,-.5,100]},exp(1,.1)),/Motor/);
});
const hash=p=>crypto.createHash('sha256').update(fs.readFileSync(new URL('../'+p,import.meta.url))).digest('hex'),report={schema:'glass-atoll.r21-contact-support-adapter-check.v1',started,completed:new Date().toISOString(),passed:checks.every(c=>c.passed),counts:{passed:checks.filter(c=>c.passed).length,total:checks.length},sources:{adapter:crypto.createHash('sha256').update(source).digest('hex'),airSupport:hash('firework-air-support.js'),physics:hash('fireworks-physics.js'),tailField:hash('firework-tail-field.js')},checks,limits:['Actual adapter imported with sampler-call tracing only; no production edits, renderer, browser or GPU.','Actual25degree/default78degree fixtures use current physics constructor and explicitly bounded mean-sea or raised-plane surfaces.','No new chemical extinction, material transfer, wave collision, general arbitrary heightfield proof or full nonlinear optical path claim.']};
fs.writeFileSync(new URL('./r21-contact-support-adapter-check.json',import.meta.url),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report,null,2));if(!report.passed)process.exitCode=1;
