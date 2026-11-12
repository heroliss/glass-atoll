import {PYRO_SMOKE_LIMITS as LIMITS} from './pyro-smoke-state.js';

// CPU source-path extinction only. Immutable snapshot cache, no state mutation,
// renderer/P/C, emission, scattering, halfspace, deposition or density truncation.
// All Gaussians remain unbounded; a missed 5-sigma box is NOT absence of smoke.
const PI=Math.PI,EPS=Number.EPSILON,K=5,TAIL=Math.exp(-K*K/2)*(1+128*EPS),GAUSS3=(2*PI)**1.5,INV_SQRT_PI=1/Math.sqrt(PI);
const clock=()=>globalThis.performance?.now?.()??Date.now();
const bits=new DataView(new ArrayBuffer(8));
function nextUp(value){
  if(value===0)return Number.MIN_VALUE;bits.setFloat64(0,value,false);
  const low=bits.getUint32(4,false);bits.setUint32(4,(low+1)>>>0,false);if(low===0xffffffff)bits.setUint32(0,bits.getUint32(0,false)+1,false);
  return bits.getFloat64(0,false);
}
function positiveUpper(value,name){if(!Number.isFinite(value)||value<0)throw new RangeError(`${name} exceeded finite nonnegative arithmetic.`);return value>0?nextUp(value):0;}
function addUpper(a,b){return a===0&&b===0?0:positiveUpper(a+b,'bound sum');}
function multiplyUpper(a,b){if(a===0||b===0)return 0;const value=a*b;return value===0?Number.MIN_VALUE:positiveUpper(value,'bound product');}
function finite(value,name,limit=Infinity){if(typeof value!=='number'||!Number.isFinite(value)||Math.abs(value)>limit)throw new RangeError(`${name} must be finite within ±${limit}.`);return value;}
function nonnegative(value,name,limit=Infinity){finite(value,name,limit);if(value<0)throw new RangeError(`${name} must be nonnegative.`);return value;}
function vector(value,name,limit=Infinity){if(!value||value.length!==3)throw new TypeError(`${name} requires three components.`);return Array.from(value,(v,c)=>finite(v,`${name}[${c}]`,limit));}
const dot=(a,b)=>a[0]*b[0]+a[1]*b[1]+a[2]*b[2];

function cholesky(value){
  if(!value||value.length!==9)throw new TypeError('covariance requires row-major 3x3.');
  const c=Array.from(value,(v,i)=>finite(v,`covariance[${i}]`,LIMITS.covarianceElement)),scale=Math.max(c[0],c[4],c[8]);
  if(!(scale>0))throw new RangeError('covariance must be SPD.');
  for(const [a,b]of [[1,3],[2,6],[5,7]]){if(Math.abs(c[a]-c[b])>64*EPS*scale)throw new RangeError('covariance must be symmetric.');c[a]=c[b]=(c[a]+c[b])*.5;}
  const a=Math.sqrt(c[0]),b=c[3]/a,cv=c[4]-b*b;
  if(!(c[0]>=LIMITS.minimumCholeskyVariance&&cv>=LIMITS.minimumCholeskyVariance))throw new RangeError('covariance must have Cholesky variances >=1e-24 m2.');
  const d=Math.sqrt(cv),e=c[6]/a,f=(c[7]-e*b)/d,gv=c[8]-e*e-f*f;
  if(!(gv>=LIMITS.minimumCholeskyVariance))throw new RangeError('covariance must be SPD with Cholesky variances >=1e-24 m2.');
  const g=Math.sqrt(gv),L=[a,b,d,e,f,g],detRoot=a*d*g;
  if(!(detRoot>0)||!Number.isFinite(detRoot))throw new RangeError('covariance determinant exceeded numeric domain.');
  return{c,L,detRoot};
}
function whiten(L,x,y,z){const a=x/L[0],b=(y-L[1]*a)/L[2];return[a,b,(z-L[3]*a-L[4]*b)/L[5]];}

// Independent high-precision erf: convergent Taylor series below 1.5 and the
// upper incomplete-gamma continued fraction above it (a=1/2). This is not the
// state's ~1.5e-7 A&S approximation. No lookup table or library dependency.
function erfPositive(x){
  if(x>=1.5)return 1-erfcPositive(x);
  let term=x,sum=x;
  for(let n=1;n<=128;n++){term*=-x*x/n;const add=term/(2*n+1);sum+=add;if(Math.abs(add)<=EPS*Math.abs(sum))return 2*INV_SQRT_PI*sum;}
  throw new Error('erf series did not converge.');
}
function erfcPositive(x){
  if(x===Infinity)return 0;if(x<1.5)return 1-erfPositive(x);
  const xx=x*x,attenuation=Math.exp(-xx);if(attenuation===0)return 0;
  let b=xx+.5,c=1e300,d=1/b,h=d;
  for(let i=1;i<=256;i++){
    const an=-i*(i-.5);b+=2;
    let denominator=an*d+b;if(Math.abs(denominator)<1e-300)denominator=denominator<0?-1e-300:1e-300;
    c=b+an/c;if(Math.abs(c)<1e-300)c=c<0?-1e-300:1e-300;
    d=1/denominator;const change=d*c;h*=change;
    if(Math.abs(change-1)<=4*EPS)return attenuation*x*INV_SQRT_PI*h;
  }
  throw new Error('erfc continued fraction did not converge.');
}
function erfDifference(a,b,width=b-a){
  if(width===0)return 0;
  if(Number.isFinite(width)&&width<.01/(1+Math.max(Math.abs(a),Math.abs(b)))){
    // Four-node Gauss quadrature of erf' for nearly equal endpoints. No
    // subtraction of nearly equal erfc tails; errors are tested independently.
    const h=width/2,m=a+h,q1=h*.8611363115940526,q2=h*.3399810435848563;
    return 2*INV_SQRT_PI*h*(.34785484513745385*(Math.exp(-((m-q1)**2))+Math.exp(-((m+q1)**2)))+.6521451548625461*(Math.exp(-((m-q2)**2))+Math.exp(-((m+q2)**2))));
  }
  if(a>=0)return Math.max(0,erfcPositive(a)-erfcPositive(b));
  if(b<=0)return Math.max(0,erfcPositive(-b)-erfcPositive(-a));
  return erfPositive(-a)+erfPositive(b);
}
function finiteColumn(packet,origin,direction,start,end){
  const q=whiten(packet.L,origin[0]-packet.mean[0],origin[1]-packet.mean[1],origin[2]-packet.mean[2]),v=whiten(packet.L,...direction),A=dot(v,v),b=dot(q,v)/A;
  // Project in whitened space instead of C-B^2/A (catastrophic cancellation
  // for a long ray nearly through the centre). Still ordinary binary64, not
  // exact arithmetic for arbitrarily ill-conditioned SPD or huge coordinates.
  const x=q[0]-v[0]*b,y=q[1]-v[1]*b,z=q[2]-v[2]*b,s=Math.sqrt(A/2);
  // Preserve the physical interval before scaling: subtracting s*end-s*start
  // can lose relative precision for a nanometre segment far along a metre ray.
  const value=packet.normalization*Math.exp(-.5*(x*x+y*y+z*z))*Math.sqrt(PI/(2*A))*erfDifference(s*(start+b),s*(end+b),s*(end-start));
  if(!Number.isFinite(value)||value<0)throw new RangeError('Gaussian column exceeded finite nonnegative arithmetic.');
  return value;
}
function preparePacket(packet,profiles){
  const mass=nonnegative(packet.mass,'packet.mass',LIMITS.referenceMass);if(!(mass>0))throw new RangeError('packet.mass must be positive.');
  const mean=vector(packet.mean,'packet.mean',LIMITS.worldCoordinate),profile=profiles.get(packet.profileId);
  if(!profile)throw new RangeError(`Unknown smoke profile: ${packet.profileId}`);
  const {c,L,detRoot}=cholesky(packet.covariance),normalization=mass/(GAUSS3*detRoot);
  if(!(normalization>0)||!Number.isFinite(normalization))throw new RangeError('Gaussian normalization exceeded numeric domain.');
  const i00=1/L[0],i10=-L[1]*i00/L[2],i20=-(L[3]*i00+L[4]*i10)/L[5],i11=1/L[2],i21=-L[4]*i11/L[5],i22=1/L[5];
  const traceInverse=(i00*i00+i10*i10+i20*i20+i11*i11+i21*i21+i22*i22)*(1+512*EPS);
  const lineBound=multiplyUpper(multiplyUpper(mass,traceInverse),(1/(2*PI))*(1+4*EPS)),boundRGB=profile.map(coefficient=>multiplyUpper(lineBound,coefficient)),bound=Math.max(...boundRGB);
  const min=[],max=[];
  for(let axis=0;axis<3;axis++){
    const radius=K*Math.sqrt(c[axis*3+axis]),padding=16*EPS*Math.max(1,Math.abs(mean[axis]),radius);
    min[axis]=mean[axis]-radius-padding;max[axis]=mean[axis]+radius+padding;
  }
  return{id:packet.id,mean,L,mass,profile:[...profile],normalization,min,max,boundRGB,bound,tailBound:multiplyUpper(bound,TAIL),tailBoundRGB:boundRGB.map(v=>multiplyUpper(v,TAIL))};
}
// Same Cholesky operations/validation domain as above, writing a spare buffer.
// Avoids allocating covariance/L/mean/bounds arrays for every coherent update.
function choleskyInto(value,c,L){
  if(!value||value.length!==9)throw new TypeError('covariance requires row-major 3x3.');
  for(let i=0;i<9;i++){const v=value[i];if(typeof v!=='number'||!Number.isFinite(v)||Math.abs(v)>LIMITS.covarianceElement)finite(v,`covariance[${i}]`,LIMITS.covarianceElement);c[i]=v;}
  const scale=Math.max(c[0],c[4],c[8]);if(!(scale>0))throw new RangeError('covariance must be SPD.');
  for(let i=0;i<3;i++){const a=i===0?1:i===1?2:5,b=i===0?3:i===1?6:7;if(Math.abs(c[a]-c[b])>64*EPS*scale)throw new RangeError('covariance must be symmetric.');c[a]=c[b]=(c[a]+c[b])*.5;}
  const a=Math.sqrt(c[0]),b=c[3]/a,cv=c[4]-b*b;
  if(!(c[0]>=LIMITS.minimumCholeskyVariance&&cv>=LIMITS.minimumCholeskyVariance))throw new RangeError('covariance must have Cholesky variances >=1e-24 m2.');
  const d=Math.sqrt(cv),e=c[6]/a,f=(c[7]-e*b)/d,gv=c[8]-e*e-f*f;
  if(!(gv>=LIMITS.minimumCholeskyVariance))throw new RangeError('covariance must be SPD with Cholesky variances >=1e-24 m2.');
  const g=Math.sqrt(gv),detRoot=a*d*g;if(!(detRoot>0)||!Number.isFinite(detRoot))throw new RangeError('covariance determinant exceeded numeric domain.');
  L[0]=a;L[1]=b;L[2]=d;L[3]=e;L[4]=f;L[5]=g;return detRoot;
}
function sparePacket(){return{mean:Array(3),L:Array(6),profile:Array(3),min:Array(3),max:Array(3),boundRGB:Array(3),tailBoundRGB:Array(3),_covariance:Array(9)};}
function preparePacketInto(packet,profiles,out){
  const mass=nonnegative(packet.mass,'packet.mass',LIMITS.referenceMass);if(!(mass>0))throw new RangeError('packet.mass must be positive.');
  if(!packet.mean||packet.mean.length!==3)throw new TypeError('packet.mean requires three components.');
  for(let c=0;c<3;c++){const v=packet.mean[c];if(typeof v!=='number'||!Number.isFinite(v)||Math.abs(v)>LIMITS.worldCoordinate)finite(v,`packet.mean[${c}]`,LIMITS.worldCoordinate);out.mean[c]=v;}
  const profile=profiles.get(packet.profileId);if(!profile)throw new RangeError(`Unknown smoke profile: ${packet.profileId}`);
  const c=out._covariance??(out._covariance=Array(9)),L=out.L,detRoot=choleskyInto(packet.covariance,c,L),normalization=mass/(GAUSS3*detRoot);
  if(!(normalization>0)||!Number.isFinite(normalization))throw new RangeError('Gaussian normalization exceeded numeric domain.');
  const i00=1/L[0],i10=-L[1]*i00/L[2],i20=-(L[3]*i00+L[4]*i10)/L[5],i11=1/L[2],i21=-L[4]*i11/L[5],i22=1/L[5];
  const traceInverse=(i00*i00+i10*i10+i20*i20+i11*i11+i21*i21+i22*i22)*(1+512*EPS),lineBound=multiplyUpper(multiplyUpper(mass,traceInverse),(1/(2*PI))*(1+4*EPS));
  out.id=packet.id;out.mass=mass;out.normalization=normalization;out.bound=0;
  for(let axis=0;axis<3;axis++){
    out.profile[axis]=profile[axis];out.boundRGB[axis]=multiplyUpper(lineBound,profile[axis]);out.bound=Math.max(out.bound,out.boundRGB[axis]);out.tailBoundRGB[axis]=multiplyUpper(out.boundRGB[axis],TAIL);
    const radius=K*Math.sqrt(c[axis*3+axis]),padding=16*EPS*Math.max(1,Math.abs(out.mean[axis]),radius);out.min[axis]=out.mean[axis]-radius-padding;out.max[axis]=out.mean[axis]+radius+padding;
  }
  out.tailBound=multiplyUpper(out.bound,TAIL);return out;
}
function treeQuality(nodes,count){
  if(!count)return 0;const area=node=>{const x=node.max[0]-node.min[0],y=node.max[1]-node.min[1],z=node.max[2]-node.min[2];return 2*(x*y+x*z+y*z);};
  const rootArea=area(nodes[0]);return rootArea>0?nodes.reduce((sum,node)=>sum+area(node)*node.count,0)/(rootArea*count):1;
}
function addNodeItem(node,item){
  for(let c=0;c<3;c++){node.min[c]=Math.min(node.min[c],item.min[c]);node.max[c]=Math.max(node.max[c],item.max[c]);node.boundRGB[c]=addUpper(node.boundRGB[c],item.boundRGB[c]);}node.bound=addUpper(node.bound,item.bound);
}
function aggregateNode(node,packets,nodes){
  node.min.fill(Infinity);node.max.fill(-Infinity);node.bound=0;node.boundRGB.fill(0);
  if(node.left<0)for(let i=node.start;i<node.end;i++)addNodeItem(node,packets[i]);
  else{addNodeItem(node,nodes[node.left]);addNodeItem(node,nodes[node.right]);}
  node.tailBound=multiplyUpper(node.bound,TAIL);for(let c=0;c<3;c++)node.tailBoundRGB[c]=multiplyUpper(node.boundRGB[c],TAIL);
}
function prepareSnapshot(snapshot,leafSize,previous,refitRebuildThreshold){
  if(!snapshot||!Array.isArray(snapshot.packets))throw new TypeError('A smoke snapshot with packets[] is required.');
  if(snapshot.packets.length>LIMITS.maxCapacity)throw new RangeError('Snapshot exceeds published smoke-state capacity; nothing was dropped.');
  const profiles=new Map(),items=Array.isArray(snapshot.profiles)?snapshot.profiles:Object.entries(snapshot.profiles??{}).map(([id,p])=>({id,...p}));
  if(items.length>LIMITS.maxProfiles)throw new RangeError('Snapshot exceeds published profile count.');
  for(const profile of items){
    if(typeof profile.id!=='string'||!profile.id||profiles.has(profile.id))throw new RangeError('Profile IDs must be unique nonempty strings.');
    const coefficients=vector(profile.extinctionPerMassRGB,'profile.extinctionPerMassRGB',LIMITS.opticalCoefficient);if(coefficients.some(v=>v<0))throw new RangeError('Extinction coefficients must be nonnegative.');profiles.set(profile.id,coefficients);
  }
  let packets;
  const metadata={time:snapshot.time??null,revision:snapshot.revision??null,profileCount:profiles.size};
  // ID set, not array identity/order. Negative merge IDs are ordinary keys.
  // Duplicate/missing IDs retain every packet and simply use the rebuild path.
  let sameIds=!!previous?.idIndex&&snapshot.packets.length===previous.packets.length;
  if(sameIds){const seen=new Set();for(const packet of snapshot.packets){if(!previous.idIndex.has(packet.id)||seen.has(packet.id)){sameIds=false;break;}seen.add(packet.id);}}
  let fallbackGrowth=null;
  if(sameIds&&snapshot.packets.length){
    const newPacketRecords=previous.sparePackets?0:snapshot.packets.length,ordered=previous.sparePackets??Array.from({length:snapshot.packets.length},sparePacket);
    for(const packet of snapshot.packets)preparePacketInto(packet,profiles,ordered[previous.idIndex.get(packet.id)]);
    const newNodeRecords=previous.spareNodes?0:previous.nodes.length,refitNodes=previous.spareNodes??previous.nodes.map(node=>({...node,min:[...node.min],max:[...node.max],boundRGB:[...node.boundRGB],tailBoundRGB:[...node.tailBoundRGB]}));
    for(let i=refitNodes.length-1;i>=0;i--)aggregateNode(refitNodes[i],ordered,refitNodes);
    const quality=treeQuality(refitNodes,ordered.length),growth=quality/previous.rebuildQuality;
    if(growth<=refitRebuildThreshold)return{...metadata,packets:ordered,nodes:refitNodes,sparePackets:previous.packets,spareNodes:previous.nodes,idIndex:previous.idIndex,leafCount:previous.leafCount,rebuildQuality:previous.rebuildQuality,quality,qualityGrowth:growth,updateKind:'refit',trackedNewPacketRecords:newPacketRecords,trackedNewNodeRecords:newNodeRecords};
    fallbackGrowth=growth;packets=ordered;
  }
  if(!packets)packets=snapshot.packets.map(packet=>preparePacket(packet,profiles));
  const nodes=[];
  function build(start,end){
    const node={min:[Infinity,Infinity,Infinity],max:[-Infinity,-Infinity,-Infinity],bound:0,boundRGB:[0,0,0],start,end,left:-1,right:-1,count:end-start};
    for(let i=start;i<end;i++){
      const p=packets[i];for(let c=0;c<3;c++){node.min[c]=Math.min(node.min[c],p.min[c]);node.max[c]=Math.max(node.max[c],p.max[c]);node.boundRGB[c]=addUpper(node.boundRGB[c],p.boundRGB[c]);}node.bound=addUpper(node.bound,p.bound);
    }
    node.tailBound=multiplyUpper(node.bound,TAIL);node.tailBoundRGB=node.boundRGB.map(v=>multiplyUpper(v,TAIL));
    const index=nodes.length;nodes.push(node);
    if(end-start>leafSize){
      let axis=0;for(let c=1;c<3;c++)if(node.max[c]-node.min[c]>node.max[axis]-node.min[axis])axis=c;
      const sorted=packets.slice(start,end).sort((a,b)=>a.mean[axis]-b.mean[axis]);for(let i=0;i<sorted.length;i++)packets[start+i]=sorted[i];
      const mid=(start+end)>>>1;node.left=build(start,mid);node.right=build(mid,end);
    }
    return index;
  }
  if(packets.length)build(0,packets.length);
  const idIndex=new Map();let unique=true;for(let i=0;i<packets.length;i++){const id=packets[i].id;if(id===undefined||idIndex.has(id)){unique=false;break;}idIndex.set(id,i);}
  const quality=treeQuality(nodes,packets.length);
  return{...metadata,packets,nodes,idIndex:unique?idIndex:null,leafCount:nodes.filter(node=>node.left<0).length,rebuildQuality:quality,quality,qualityGrowth:1,updateKind:fallbackGrowth===null?'structural-rebuild':'quality-rebuild',fallbackGrowth,trackedNewPacketRecords:packets.length,trackedNewNodeRecords:nodes.length};
}
function intersects(box,origin,direction,start,end){
  let near=start,far=end;
  for(let c=0;c<3;c++){
    if(direction[c]===0){if(origin[c]<box.min[c]||origin[c]>box.max[c])return false;continue;}
    let a=(box.min[c]-origin[c])/direction[c],b=(box.max[c]-origin[c])/direction[c];if(a>b)[a,b]=[b,a];
    near=Math.max(near,a);far=Math.min(far,b);if(near>far)return false;
  }
  return true;
}

/** Read-only prepared BVH for source->sample or sample->eye CPU rays.
 * Profiles remain authored m2/reference-mass, not calibrated kg/PM.
 * errorBudget is an L-infinity omitted optical-depth budget, NOT a packet cap.
 * Reported analytic omission bounds exclude binary64 kernel rounding, which is
 * tested independently and is not called a formally verified interval solve.
 */
export function createPyroSmokeColumns(snapshot,{errorBudget=1e-5,leafSize=8,refitRebuildThreshold=2.5}={}){
  nonnegative(errorBudget,'errorBudget');if(!Number.isInteger(leafSize)||leafSize<1||leafSize>64)throw new RangeError('leafSize must be an integer 1..64.');
  finite(refitRebuildThreshold,'refitRebuildThreshold');if(refitRebuildThreshold<1.25)throw new RangeError('refitRebuildThreshold must be >=1.25.');
  let prepared={packets:[],nodes:[],time:null,revision:null,profileCount:0,leafCount:0},builds=0,lastBuildMs=0,totalBuildMs=0;
  let refits=0,structuralRebuilds=0,qualityRebuilds=0;
  let totals={rays:0,zeroLengthRays:0,visitedNodes:0,bboxTests:0,kernelsEvaluated:0,omittedPackets:0,skippedNodes:0,zeroExtinctionPackets:0,totalQueryMs:0,maximumQueryMs:0,maximumOmittedBound:0};
  const stack=[];
  // Private synchronous scratch. Public query/between still return owned data.
  const fastOrigin=new Float64Array(3),fastDirection=new Float64Array(3),fastTau=new Float64Array(3),fastCorrection=new Float64Array(3);
  function update(next){const started=clock(),proposal=prepareSnapshot(next,leafSize,prepared,refitRebuildThreshold);prepared=proposal;lastBuildMs=clock()-started;totalBuildMs+=lastBuildMs;builds++;if(proposal.updateKind==='refit')refits++;else if(proposal.updateKind==='quality-rebuild')qualityRebuilds++;else structuralRebuilds++;return diagnostics();}
  function diagnostics(){return{sourceTime:prepared.time,sourceRevision:prepared.revision,packetCount:prepared.packets.length,profileCount:prepared.profileCount,nodeCount:prepared.nodes.length,leafCount:prepared.leafCount,leafSize,kSigma:K,errorBudget,builds,lastBuildMs,totalBuildMs,lastUpdateMs:lastBuildMs,refits,structuralRebuilds,qualityRebuilds,lastUpdateKind:prepared.updateKind,treeQuality:prepared.quality,treeQualityGrowth:prepared.qualityGrowth,refitRebuildThreshold,lastFallbackGrowth:prepared.fallbackGrowth??null,trackedNewPacketRecords:prepared.trackedNewPacketRecords??0,trackedNewNodeRecords:prepared.trackedNewNodeRecords??0,...totals,mediumDomain:'unbounded full-SPD Gaussian; no halfspace, ground absorption or physical packet deletion',omissionBound:'Each missed 5-sigma AABB: sum M*trace(invSigma)/(2pi)*max(extinctionRGB)*exp(-12.5); only omitted when cumulative upper bound <= budget.',numericMethod:'binary64 Cholesky whitening + erf series/continued fraction + close-endpoint four-node quadrature',errorBoundIncludesRoundoff:false,units:'metres, relative dry mass, authored m2/reference-mass profiles; tau dimensionless'};}
  function query({origin,direction,start=0,end,errorBudget:budget=errorBudget}={}){
    const started=clock(),o=vector(origin,'ray.origin',LIMITS.worldCoordinate),d=vector(direction,'ray.direction');nonnegative(start,'ray.start');finite(end,'ray.end');nonnegative(budget,'errorBudget');
    if(end<start)throw new RangeError('Ray must satisfy 0<=start<=end.');
    const length=end-start,size=Math.hypot(...d);
    if(length>0&&(!(size>0)||!Number.isFinite(size)||Math.abs(size-1)>1e-6))throw new RangeError('Ray direction must have unit length.');
    if(size>0)for(let c=0;c<3;c++)d[c]/=size;
    const tauRGB=[0,0,0],correction=[0,0,0],boundRGB=[0,0,0];
    let omitted=0,visitedNodes=0,bboxTests=0,kernelsEvaluated=0,omittedPackets=0,skippedNodes=0,zeroExtinctionPackets=0;
    function canOmit(value){return addUpper(omitted,value)<=budget;}
    function omit(bound,rgb,count){omitted=addUpper(omitted,bound);for(let c=0;c<3;c++)boundRGB[c]=addUpper(boundRGB[c],rgb[c]);omittedPackets+=count;}
    if(length>0&&prepared.nodes.length){
      stack.length=0;stack.push(0);
      while(stack.length){
        const node=prepared.nodes[stack.pop()];visitedNodes++;
        if(node.bound===0){zeroExtinctionPackets+=node.count;continue;}
        bboxTests++;
        if(!intersects(node,o,d,start,end)&&canOmit(node.tailBound)){omit(node.tailBound,node.tailBoundRGB,node.count);skippedNodes++;continue;}
        if(node.left>=0){stack.push(node.right,node.left);continue;}
        for(let i=node.start;i<node.end;i++){
          const packet=prepared.packets[i];if(packet.bound===0){zeroExtinctionPackets++;continue;}
          bboxTests++;
          if(!intersects(packet,o,d,start,end)&&canOmit(packet.tailBound)){omit(packet.tailBound,packet.tailBoundRGB,1);continue;}
          const column=finiteColumn(packet,o,d,start,end);kernelsEvaluated++;
          for(let c=0;c<3;c++){
            const value=column*packet.profile[c],y=value-correction[c],next=tauRGB[c]+y;correction[c]=(next-tauRGB[c])-y;tauRGB[c]=next;
            if(!Number.isFinite(next)||next<0)throw new RangeError('Optical depth exceeded numeric domain.');
          }
        }
      }
    }
    const elapsedMs=clock()-started;totals.rays++;if(length===0)totals.zeroLengthRays++;
    totals.visitedNodes+=visitedNodes;totals.bboxTests+=bboxTests;totals.kernelsEvaluated+=kernelsEvaluated;totals.omittedPackets+=omittedPackets;totals.skippedNodes+=skippedNodes;totals.zeroExtinctionPackets+=zeroExtinctionPackets;
    totals.totalQueryMs+=elapsedMs;totals.maximumQueryMs=Math.max(totals.maximumQueryMs,elapsedMs);totals.maximumOmittedBound=Math.max(totals.maximumOmittedBound,omitted);
    return{tauRGB,T:tauRGB.map(value=>Math.exp(-value)),errorBound:omitted,errorBoundRGB:boundRGB,actualOmittedBound:omitted,transmissionLowerRGB:tauRGB.map((value,c)=>Math.exp(-value-boundRGB[c])),errorBoundIncludesRoundoff:false,visitedNodes,bboxTests,kernelsEvaluated,omittedPackets,skippedNodes,zeroExtinctionPackets,elapsedMs};
  }
  function between(from,to,options={}){
    if(!options||typeof options!=='object'||Array.isArray(options))throw new TypeError('between options require {errorBudget}.');
    for(const key of Object.keys(options))if(key!=='errorBudget')throw new TypeError(`Unknown between option: ${key}`);
    const origin=vector(from,'ray.from',LIMITS.worldCoordinate),endPoint=vector(to,'ray.to',LIMITS.worldCoordinate),delta=endPoint.map((v,c)=>v-origin[c]),length=Math.hypot(...delta);
    return query({origin,direction:length>0?delta.map(v=>v/length):[0,0,0],start:0,end:length,errorBudget:options.errorBudget===undefined?errorBudget:options.errorBudget});
  }
  function writeTransmissionBetween(from,to,out,options={}){
    if(!options||typeof options!=='object'||Array.isArray(options))throw new TypeError('between options require {errorBudget}.');
    for(const key of Object.keys(options))if(key!=='errorBudget')throw new TypeError(`Unknown between option: ${key}`);
    if((!Array.isArray(out)&&!(out instanceof Float64Array))||out.length!==3)throw new TypeError('Transmission output must be a caller-owned Array or Float64Array of length3.');
    if(Array.isArray(out)&&(Object.isFrozen(out)||[0,1,2].some(i=>{const d=Object.getOwnPropertyDescriptor(out,String(i));return d?d.writable===false||!!d.get||!!d.set:!Object.isExtensible(out);})))throw new TypeError('Transmission output must be writable.');
    if(!from||from.length!==3)throw new TypeError('ray.from requires three components.');
    const ox=finite(from[0],'ray.from[0]',LIMITS.worldCoordinate),oy=finite(from[1],'ray.from[1]',LIMITS.worldCoordinate),oz=finite(from[2],'ray.from[2]',LIMITS.worldCoordinate);
    if(!to||to.length!==3)throw new TypeError('ray.to requires three components.');
    const ex=finite(to[0],'ray.to[0]',LIMITS.worldCoordinate),ey=finite(to[1],'ray.to[1]',LIMITS.worldCoordinate),ez=finite(to[2],'ray.to[2]',LIMITS.worldCoordinate),dx=ex-ox,dy=ey-oy,dz=ez-oz,length=Math.hypot(dx,dy,dz),budget=options.errorBudget===undefined?errorBudget:options.errorBudget;
    const o=fastOrigin,d=fastDirection;o[0]=ox;o[1]=oy;o[2]=oz;d[0]=length>0?dx/length:0;d[1]=length>0?dy/length:0;d[2]=length>0?dz/length:0;
    // Match query's timing boundary and its SECOND direction normalization;
    // removing the latter would subtly change the original binary64 columns.
    const started=clock();finite(length,'ray.end');nonnegative(budget,'errorBudget');
    const start=0,end=length,size=Math.hypot(d[0],d[1],d[2]);
    if(length>0&&(!(size>0)||!Number.isFinite(size)||Math.abs(size-1)>1e-6))throw new RangeError('Ray direction must have unit length.');
    if(size>0)for(let c=0;c<3;c++)d[c]/=size;
    const tauRGB=fastTau,correction=fastCorrection;tauRGB.fill(0);correction.fill(0);
    let omitted=0,visitedNodes=0,bboxTests=0,kernelsEvaluated=0,omittedPackets=0,skippedNodes=0,zeroExtinctionPackets=0;
    if(length>0&&prepared.nodes.length){
      stack.length=0;stack.push(0);
      while(stack.length){
        const node=prepared.nodes[stack.pop()];visitedNodes++;
        if(node.bound===0){zeroExtinctionPackets+=node.count;continue;}
        bboxTests++;
        if(!intersects(node,o,d,start,end)&&addUpper(omitted,node.tailBound)<=budget){omitted=addUpper(omitted,node.tailBound);omittedPackets+=node.count;skippedNodes++;continue;}
        if(node.left>=0){stack.push(node.right,node.left);continue;}
        for(let i=node.start;i<node.end;i++){
          const packet=prepared.packets[i];if(packet.bound===0){zeroExtinctionPackets++;continue;}
          bboxTests++;
          if(!intersects(packet,o,d,start,end)&&addUpper(omitted,packet.tailBound)<=budget){omitted=addUpper(omitted,packet.tailBound);omittedPackets++;continue;}
          const column=finiteColumn(packet,o,d,start,end);kernelsEvaluated++;
          for(let c=0;c<3;c++){
            const value=column*packet.profile[c],y=value-correction[c],next=tauRGB[c]+y;correction[c]=(next-tauRGB[c])-y;tauRGB[c]=next;
            if(!Number.isFinite(next)||next<0)throw new RangeError('Optical depth exceeded numeric domain.');
          }
        }
      }
    }
    const elapsedMs=clock()-started;totals.rays++;if(length===0)totals.zeroLengthRays++;
    totals.visitedNodes+=visitedNodes;totals.bboxTests+=bboxTests;totals.kernelsEvaluated+=kernelsEvaluated;totals.omittedPackets+=omittedPackets;totals.skippedNodes+=skippedNodes;totals.zeroExtinctionPackets+=zeroExtinctionPackets;
    totals.totalQueryMs+=elapsedMs;totals.maximumQueryMs=Math.max(totals.maximumQueryMs,elapsedMs);totals.maximumOmittedBound=Math.max(totals.maximumOmittedBound,omitted);
    // Only the unrequested RGB error enclosure/result object is skipped. The
    // scalar outward bound, every omission decision and all counters are kept.
    out[0]=Math.exp(-tauRGB[0]);out[1]=Math.exp(-tauRGB[1]);out[2]=Math.exp(-tauRGB[2]);return out;
  }
  if(snapshot)update(snapshot);
  return{update,query,between,writeTransmissionBetween,diagnostics,resetDiagnostics(){totals={rays:0,zeroLengthRays:0,visitedNodes:0,bboxTests:0,kernelsEvaluated:0,omittedPackets:0,skippedNodes:0,zeroExtinctionPackets:0,totalQueryMs:0,maximumQueryMs:0,maximumOmittedBound:0};return diagnostics();}};
}
