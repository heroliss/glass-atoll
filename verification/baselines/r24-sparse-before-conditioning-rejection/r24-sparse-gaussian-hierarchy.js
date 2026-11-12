// Verification-only CPU selector. No renderer, native snapshot or production imports.
// Real-arithmetic Gaussian upper bounds; margins below are numerical safeguards,
// NOT a universal IEEE-754/transcendental interval certificate.
import {createHash} from 'node:crypto';
import {performance} from 'node:perf_hooks';

const PI=Math.PI,GAUSS3=(2*PI)**1.5,EPS=Number.EPSILON;
export const SYNTHETIC_HIERARCHY_DOMAIN=Object.freeze({maxPackets:128,maxCoordinate:2048,maxRayLength:4096,minPivotVariance:1e-6,maxCovarianceElement:256,minPositiveMassOrExtinction:1e-8,maxMass:100,maxExtinction:1000,relativeMargin:1e-10,distanceMargin:1e-10});
const D=SYNTHETIC_HIERARCHY_DOMAIN;
const freeze=x=>{if(x&&typeof x==='object'&&!Object.isFrozen(x)){Object.values(x).forEach(freeze);Object.freeze(x);}return x;};
const number=(x,label)=>{if(typeof x!=='number'||!Number.isFinite(x))throw new RangeError(label+' must be finite');return x;};
const nonnegative=(x,label,maximum=Infinity)=>{number(x,label);if(x<0||x>maximum)throw new RangeError(label+' outside nonnegative domain');return x;};
const vector=(x,label,limit=D.maxCoordinate)=>{if(!Array.isArray(x)||x.length!==3)throw new TypeError(label+' requires three values');return x.map((v,i)=>{number(v,label+i);if(Math.abs(v)>limit)throw new RangeError(label+' outside coordinate domain');return v;});};
const dot=(a,b)=>a[0]*b[0]+a[1]*b[1]+a[2]*b[2];
const length=x=>Math.hypot(...x);
const subtract=(a,b)=>a.map((v,i)=>v-b[i]);
const nextBits=new DataView(new ArrayBuffer(8));
function up(x){if(!(x>=0)||!Number.isFinite(x))throw new RangeError('nonnegative upper bound overflow');if(x===0)return 0;nextBits.setFloat64(0,x);nextBits.setBigUint64(0,nextBits.getBigUint64(0)+1n);return nextBits.getFloat64(0);}
function upper(x){return x===0?0:up(x*(1+D.relativeMargin));}
function add(a,b){return a===0&&b===0?0:up(a+b);}
function positiveExp(logValue){if(logValue===-Infinity)return 0;if(!Number.isFinite(logValue))throw new RangeError('bound exponential domain');const value=Math.exp(logValue);return value===0?Number.MIN_VALUE:upper(value);}
function shape(c){
  if(!Array.isArray(c)||c.length!==9)throw new TypeError('covariance needs nine values');
  c.forEach(x=>{number(x,'covariance');if(Math.abs(x)>D.maxCovarianceElement)throw new RangeError('covariance outside synthetic domain');});
  for(const [a,b]of [[1,3],[2,6],[5,7]])if(c[a]!==c[b])throw new RangeError('covariance must be symmetric');
  const l0=Math.sqrt(c[0]),l1=c[3]/l0,p1=c[4]-l1*l1,l2=Math.sqrt(p1),l3=c[6]/l0,l4=(c[7]-l3*l1)/l2,p2=c[8]-l3*l3-l4*l4;
  if(!(c[0]>=D.minPivotVariance&&p1>=D.minPivotVariance&&p2>=D.minPivotVariance))throw new RangeError('covariance outside SPD pivot domain');
  const determinantRoot=l0*l2*Math.sqrt(p2),trace=c[0]+c[4]+c[8];
  if(!(determinantRoot>0&&Number.isFinite(determinantRoot)&&Number.isFinite(trace)))throw new RangeError('covariance determinant/trace domain');
  return{determinantRoot,lambda:upper(trace)};
}
const hash=x=>createHash('sha256').update(JSON.stringify(x)).digest('hex');

export function createSyntheticGaussianHierarchy(snapshot,{leafSize=4}={}){
  if(!Number.isSafeInteger(leafSize)||leafSize<1||leafSize>16)throw new RangeError('leafSize outside synthetic domain');
  if(!snapshot||!Array.isArray(snapshot.packets)||snapshot.packets.length>D.maxPackets||!Array.isArray(snapshot.profiles))throw new RangeError('bounded synthetic snapshot required');
  const start=performance.now(),physical=structuredClone(snapshot),profiles=new Map(),ids=new Set();
  for(const profile of physical.profiles){if(typeof profile.id!=='string'||profiles.has(profile.id))throw new RangeError('unique profile IDs required');const rgb=vector(profile.extinctionPerMassRGB,'extinction',D.maxExtinction);rgb.forEach(v=>{nonnegative(v,'extinction',D.maxExtinction);if(v>0&&v<D.minPositiveMassOrExtinction)throw new RangeError('positive extinction below synthetic domain');});profiles.set(profile.id,rgb);}
  const items=physical.packets.map((p,index)=>{
    if(!(['number','string'].includes(typeof p.id))||(typeof p.id==='number'&&!Number.isSafeInteger(p.id))||ids.has(p.id))throw new RangeError('unique primitive packet IDs required');ids.add(p.id);
    const mean=vector(p.mean,'mean'),mass=nonnegative(p.mass,'mass',D.maxMass),k=profiles.get(p.profileId);if(!k)throw new RangeError('unknown extinction profile');if(mass>0&&mass<D.minPositiveMassOrExtinction)throw new RangeError('positive mass below synthetic domain');
    const s=shape(p.covariance),amplitude=k.map(x=>upper(mass*x/(GAUSS3*s.determinantRoot)));
    return{index,id:p.id,mean,lambda:s.lambda,amplitude};
  });
  const order=items.map((_,i)=>i),nodes=[],build={nodeCount:0,leafCount:0,aggregateItemVisits:0,sortComparisons:0,maxDepth:0};
  function buildNode(begin,end,depth){
    const node={begin,end,count:end-begin,min:[Infinity,Infinity,Infinity],max:[-Infinity,-Infinity,-Infinity],lambda:0,amplitude:[0,0,0],left:-1,right:-1};
    for(let j=begin;j<end;j++){const p=items[order[j]];build.aggregateItemVisits++;for(let c=0;c<3;c++){node.min[c]=Math.min(node.min[c],p.mean[c]);node.max[c]=Math.max(node.max[c],p.mean[c]);node.amplitude[c]=add(node.amplitude[c],p.amplitude[c]);}node.lambda=Math.max(node.lambda,p.lambda);}
    for(let c=0;c<3;c++){const pad=D.distanceMargin+64*EPS*Math.max(1,Math.abs(node.min[c]),Math.abs(node.max[c]));node.min[c]-=pad;node.max[c]+=pad;}
    const index=nodes.length;nodes.push(node);build.maxDepth=Math.max(build.maxDepth,depth);
    if(end-begin>leafSize){let axis=0;for(let c=1;c<3;c++)if(node.max[c]-node.min[c]>node.max[axis]-node.min[axis])axis=c;const sorted=order.slice(begin,end).sort((a,b)=>{build.sortComparisons++;return items[a].mean[axis]-items[b].mean[axis]||a-b;});order.splice(begin,sorted.length,...sorted);const middle=(begin+end)>>>1;node.left=buildNode(begin,middle,depth+1);node.right=buildNode(middle,end,depth+1);}else build.leafCount++;
    return index;
  }
  if(items.length)buildNode(0,items.length,0);build.nodeCount=nodes.length;
  const physicalKey=hash(physical),buildMs=performance.now()-start;
  freeze(physical);freeze(items);freeze(nodes);freeze(order);freeze(build);
  function query({origin,end,budgetRGB=[1e-5,1e-5,1e-5],maxNodeVisits=nodes.length,maxRetainedLeaves=items.length,consumer='synthetic'}={}){
    const began=performance.now(),o=vector(origin,'ray origin'),e=vector(end,'ray end'),budget=vector(budgetRGB,'budget',1);budget.forEach(v=>nonnegative(v,'budget',1));
    for(const [x,label,max]of [[maxNodeVisits,'maxNodeVisits',nodes.length],[maxRetainedLeaves,'maxRetainedLeaves',items.length]])if(!Number.isSafeInteger(x)||x<0||x>max)throw new RangeError(label+' outside bounded capacity');
    if(typeof consumer!=='string')throw new TypeError('consumer tag required');
    const delta=subtract(e,o),L=length(delta);if(L>D.maxRayLength)throw new RangeError('ray outside length domain');const d=L?delta.map(v=>v/L):[0,0,0],kept=[],omitted=[],omittedBoundRGB=[0,0,0],stats={visitedNodes:0,boundEvaluations:0,retainedLeaves:0,omittedPackets:0,skippedNodes:0,structuralZeroNodes:0};
    const key=hash({physicalKey,o,e,consumer}),stack=items.length?[0]:[];
    const finish=()=>freeze({supported:true,reason:'synthetic-selection-ready',numericCertificate:false,physicalKey,queryKey:key,consumer,origin:o,end:e,length:L,budgetRGB:budget,keptPacketIndices:kept.sort((a,b)=>a-b),keptIDs:kept.map(i=>items[i].id),omittedPacketIndices:omitted.sort((a,b)=>a-b),omittedIDs:omitted.map(i=>items[i].id),omittedBoundRGB,stats:{...stats,retainedLeaves:kept.length,omittedPackets:omitted.length,elapsedMs:performance.now()-began}});
    if(L===0){omitted.push(...items.map(p=>p.index));stats.structuralZeroNodes=nodes.length?1:0;return finish();}
    function lowerDistances(node){
      let segmentAABBSquared=0;for(let c=0;c<3;c++){const rayMin=Math.min(o[c],e[c]),rayMax=Math.max(o[c],e[c]),gap=Math.max(0,node.min[c]-rayMax,rayMin-node.max[c]);segmentAABBSquared+=gap*gap;}
      const center=node.min.map((v,c)=>(v+node.max[c])*.5),radius=length(node.min.map((v,c)=>(node.max[c]-v)*.5)),r=subtract(center,o),t=dot(r,d),perp=r.map((v,c)=>v-t*d[c]),ts=Math.max(0,Math.min(L,t)),near=r.map((v,c)=>v-ts*d[c]);
      const numericalPad=D.distanceMargin+256*EPS*Math.max(1,L,length(o),length(e),length(center),radius);
      return{segment:Math.max(0,Math.sqrt(segmentAABBSquared)-numericalPad,length(near)-radius-numericalPad),line:Math.max(0,length(perp)-radius-numericalPad)};
    }
    function bound(node){
      stats.boundEvaluations++;if(node.amplitude.every(x=>x===0))return[0,0,0];const distances=lowerDistances(node),logSegment=Math.log(L)-distances.segment*distances.segment/(2*node.lambda),logLine=.5*Math.log(2*PI*node.lambda)-distances.line*distances.line/(2*node.lambda),factor=Math.min(logSegment,logLine);
      return node.amplitude.map(a=>a===0?0:positiveExp(Math.log(a)+factor));
    }
    while(stack.length){
      if(stats.visitedNodes>=maxNodeVisits)return freeze({supported:false,reason:'node-work-capacity',numericCertificate:false,physicalKey,queryKey:key,stats:{...stats,elapsedMs:performance.now()-began}});
      const node=nodes[stack.pop()];stats.visitedNodes++;const U=bound(node),next=U.map((v,c)=>add(omittedBoundRGB[c],v));
      if(next.every((v,c)=>v<=budget[c])){for(let j=node.begin;j<node.end;j++)omitted.push(order[j]);for(let c=0;c<3;c++)omittedBoundRGB[c]=next[c];stats.skippedNodes++;if(U.every(x=>x===0))stats.structuralZeroNodes++;}
      else if(node.left<0){if(kept.length+node.count>maxRetainedLeaves)return freeze({supported:false,reason:'retained-pair-capacity',numericCertificate:false,physicalKey,queryKey:key,stats:{...stats,elapsedMs:performance.now()-began}});for(let j=node.begin;j<node.end;j++)kept.push(order[j]);}
      else{stack.push(node.right,node.left);}
    }
    return finish();
  }
  return freeze({physical,physicalKey,items,nodes,order,build:{...build,buildMs},query,limits:{...D,actualGPU:false,numericCertificate:false,scope:'Synthetic selector only; current physical copies retained; finite-domain numerical falsification needed before GPU use'}});
}
