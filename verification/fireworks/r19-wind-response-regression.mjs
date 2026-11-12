import {strict as assert} from 'node:assert';
import {writeFileSync} from 'node:fs';
import * as current from '../../fireworks-physics.js';
import * as legacy from '../baselines/fireworks-before-wind-prefix/fireworks-physics.js';
import {invalidateWindResponse,windResponseDiagnostics} from '../../wind-response.js';
const tests=[];function test(name,fn){try{tests.push({name,passed:true,detail:fn()});}catch(error){tests.push({name,passed:false,error:String(error.stack)});}}
const distance=(a,b)=>Math.hypot(...a.map((v,i)=>v-b[i]));
function compare(body,time,timeline,tolerance=2e-8){
  const a=current.sampleBody(body,time,timeline),b=legacy.sampleBody(body,time,timeline);if(a===null||b===null){assert.equal(a,b);return{position:0,velocity:0};}
  const error={position:distance(a.position,b.position),velocity:distance(a.velocity,b.velocity)};
  assert(error.position<=tolerance&&error.velocity<=tolerance,JSON.stringify({time,birth:body.birth,drag:body.drag,error,a,b}));return error;
}
let seed=97321;const rng=()=>((seed=Math.imul(seed,1664525)+1013904223>>>0)/4294967296);
const body=(birth=0,drag=.22)=>({birth,position:[1,80,-3],velocity:[12,21,-5],drag});
const timeline=[{time:-Infinity,wind:[1.8,0,.4]}];for(let i=0;i<250;i++)timeline.push({time:i*.071,wind:[5*Math.sin(i*.19),.2*Math.sin(i*.02),3*Math.cos(i*.17)]});

test('all authored drag classes match the saved sequential implementation',()=>{
  let p=0,v=0,queries=0;
  for(const k of [.075,.15,.16,.2,.22,.25,.28,.74,.8,1.35])for(let i=0;i<50;i++){
    const birth=-2+rng()*18,time=birth+rng()*10,error=compare(body(birth,k),time,timeline);p=Math.max(p,error.position);v=Math.max(v,error.velocity);queries++;
  }return{queries,maximumPositionErrorMetres:p,maximumVelocityErrorMps:v};
});
test('zero/vanishing drag retains the original ballistic branch',()=>{
  for(const k of [0,1e-12,1e-9])compare(body(0,k),8,timeline);compare(body(0,1e-7),2,timeline,3e-6);
  const defaultBody=body(0);delete defaultBody.drag;compare(defaultBody,6,timeline);
});
test('past/future reverse-order queries do not depend on a mutable time cursor',()=>{
  for(const t of [25,2,19,.01,8,35,1,19.4,0])compare(body(0,.8),t,timeline);
});
test('before-birth and exact-birth limits',()=>{
  assert.equal(current.sampleBody(body(6),5,timeline),null);const sample=current.sampleBody(body(6),6,timeline);assert.deepEqual(sample.position,[1,80,-3]);assert.deepEqual(sample.velocity,[12,21,-5]);
});
test('near-birth tiny duration does not subtract large prefix positions',()=>{
  for(const birth of [0,3.55,8.032,20])for(const dt of [1e-10,1e-8,1e-6,.0001])compare(body(birth),birth+dt,timeline,1e-9);
});
test('future beyond final knot holds the final wind exactly',()=>{
  for(const t of [18,22,50,200])compare(body(10,.075),t,timeline,1e-7);
});
test('initial finite knot extends backwards as the legacy model does',()=>{
  const t=[{time:40,wind:[3,0,-1]},{time:42,wind:[-2,1,4]},{time:45,wind:[1,0,1]}];for(const q of [[39,41],[30,44],[41,70],[0,38]])compare(body(q[0],.22),q[1],t);
});
test('append and front pruning reuse checkpoints without changing retained semantics',()=>{
  const t=[{time:-Infinity,wind:[0,0,0]}];let maximum=0;
  for(let i=0;i<180;i++){
    const now=i*.07;t.push({time:now,wind:[Math.sin(i*.2)*5,0,Math.cos(i*.11)*3]});
    while(t.length>2&&t[1].time<now-3)t.shift();
    const e=compare(body(Math.max(0,now-.6)),now+.3,t);maximum=Math.max(maximum,e.position);
    compare(body(Number.isFinite(t[0].time)?t[0].time-1:-1),now+.3,t); // also enforce changed pruned-history semantics
  }
  const diagnostics=windResponseDiagnostics(t);assert(diagnostics.rebuilds<5,JSON.stringify(diagnostics));return {maximumPositionErrorMetres:maximum,diagnostics};
});
test('same-time wind changes and zero-duration segments',()=>{
  const t=[{time:-Infinity,wind:[0,0,0]},{time:1,wind:[2,0,0]},{time:1,wind:[5,0,0]},{time:1.5,wind:[-3,0,2]}];for(const q of [1,1.000001,1.5,2,4])compare(body(.1),q,t);
});
test('replacing/truncating timeline then explicit historical edit invalidation',()=>{
  const t=timeline.map(segment=>({...segment,wind:[...segment.wind]}));compare(body(2),19,t);t.splice(120);compare(body(2),19,t);t.push({time:20,wind:[2,0,4]});compare(body(2),25,t);
  t[40].wind=[-4,0,3];invalidateWindResponse(t);compare(body(2),25,t);
});
test('multi-hour absolute clocks never exponentiate absolute time',()=>{
  let maximum=0;
  for(const epoch of [30000,172800,1e9]){
    const t=[{time:-Infinity,wind:[1,0,1]},...timeline.slice(1).map(s=>({time:epoch+s.time,wind:s.wind}))];
    for(const k of [.075,.22,.8,1.35])for(const dt of [.00001,.4,4,18]){const e=compare(body(epoch+1.234,k),epoch+1.234+dt,t,1e-7);maximum=Math.max(maximum,e.position);}
  }return{maximumPositionErrorMetres:maximum};
});
test('parent/split inheritance and changing future previews remain current',()=>{
  const event=current.createFireworkEvent({type:'crossette',seed:183}),children=event.heads.filter(b=>b.parentBody),t=[{time:-Infinity,wind:[1,0,1]}];
  for(const at of [1,2,4,6]){t.push({time:at,wind:[at,0,-at*.2]});current.sampleFireworkEvent(event,at,{windTimeline:t});for(const child of children.slice(0,12))compare(child,child.birth+1,t);}
});
test('pose edits are not hidden by parent/body state caching',()=>{
  const b=body(2);compare(b,8,timeline);b.position[0]+=4;b.velocity[2]-=3;compare(b,8,timeline);
});

// Independent 6D RK4, split exactly at wind knots. No legacy/new segment helper.
function rk4(b,time,t){
  let state=[...b.position,...b.velocity],at=b.birth;const bounds=[...t.map(s=>s.time).filter(s=>s>at&&s<time),time];
  for(const end of bounds){const n=Math.ceil((end-at)/.002),h=(end-at)/n,wind=t.filter(s=>s.time<=at).at(-1)?.wind??t[0]?.wind??[0,0,0];
    const f=x=>[x[3],x[4],x[5],b.drag*(wind[0]-x[3]),b.drag*(wind[1]-x[4])-(b.gravity??9.81),b.drag*(wind[2]-x[5])];
    for(let i=0;i<n;i++){const a=f(state),bb=f(state.map((v,c)=>v+h*.5*a[c])),c=f(state.map((v,j)=>v+h*.5*bb[j])),d=f(state.map((v,j)=>v+h*c[j]));state=state.map((v,j)=>v+h*(a[j]+2*bb[j]+2*c[j]+d[j])/6);}at=end;
  }return{position:state.slice(0,3),velocity:state.slice(3)};
}
test('independent RK4 agrees for multiple drag, gravity and vertical wind',()=>{
  const t=[{time:-Infinity,wind:[2,.3,-1]},{time:.7,wind:[-4,.8,2]},{time:2.15,wind:[3,-.5,4]},{time:4,wind:[1,0,-3]}];let maximum=0;
  for(const drag of [1e-7,.075,.22,.8,1.35])for(const gravity of [0,9.81]){const b={...body(.125,drag),gravity},expected=rk4(b,6.1,t),actual=current.sampleBody(b,6.1,t),e=distance(actual.position,expected.position);maximum=Math.max(maximum,e);assert(e<2e-9&&distance(actual.velocity,expected.velocity)<2e-9,JSON.stringify({drag,gravity,e}));}return{maximumPositionErrorMetres:maximum};
});
const report={date:new Date().toISOString(),passed:tests.every(t=>t.passed),passedCount:tests.filter(t=>t.passed).length,total:tests.length,tests,limits:['CPU Float64 analytic equivalence to saved sequential source and independent RK4; no GPU/render/FPS claim','Immutable timeline segments support append/prune automatically; editing an old segment in place requires explicit invalidation','Input forcing remains original piecewise-held samples, including its existing display-rate discretization']};
writeFileSync(new URL('../r19-wind-response-regression.json',import.meta.url),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report,null,2));if(!report.passed)process.exitCode=1;

