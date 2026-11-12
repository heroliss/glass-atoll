// Read-only measurements of the frozen B0 geometry and authored pigment data.
import fs from 'node:fs';
import crypto from 'node:crypto';
import * as THREE from '../vendor/three.module.js';
import {createVegetation} from '../vegetation.js';
import {createFrondTransport} from '../palm-frame.js';
const src=fs.readFileSync(new URL('../main.js',import.meta.url),'utf8').match(/export function terrainHeight\(x,z\)\{([\s\S]*?)\n\}/);
const grove=createVegetation(THREE,{terrainHeight:new Function('x','z',src[1]),seed:40219});
const rachis=grove.children.find(m=>m.name==='Arched palm rachises').geometry,pinna=grove.children.find(m=>m.name==='Folded coconut pinnae').geometry;
const p=rachis.attributes.position,r=rachis.attributes.aBranchRoot,br=pinna.attributes.aBranchRoot,m=pinna.attributes.aGroveMotion,axis=pinna.attributes.aLeafAxis;
const key=(a,i)=>[a.getX(i),a.getY(i),a.getZ(i)].join(','),byRoot=new Map(),fronds=[];
function fit(points,channel,f0,f1){let aa=0,ab=0,bb=0,ay=0,by=0;const root=points[0][channel];for(let j=1;j<24;j++){const t=j/23,a=f0(t),b=f1(t),y=points[j][channel]-root;aa+=a*a;ab+=a*b;bb+=b*b;ay+=a*y;by+=b*y;}const d=aa*bb-ab*ab;return [(ay*bb-by*ab)/d,(by*aa-ay*ab)/d];}
function median(a){const b=a.slice().sort((x,y)=>x-y);return b[Math.floor(b.length/2)];}
function summary(a){const b=a.slice().sort((x,y)=>x-y);return {count:b.length,min:b[0],p10:b[Math.floor((b.length-1)*.1)],median:median(b),p90:b[Math.floor((b.length-1)*.9)],max:b.at(-1)};}
const ringVertices=6,frondVertices=24*ringVertices;
let tree=0,f=0;
for(let start=0;start<p.count;start+=frondVertices){
  const points=[];for(let j=0;j<24;j++){const c=[0,0,0];for(let k=0;k<5;k++){const i=start+j*6+k;c[0]+=p.getX(i)/5;c[1]+=p.getY(i)/5;c[2]+=p.getZ(i)/5;}points.push(c);}
  const x=fit(points,0,t=>t,t=>Math.sin(Math.PI*t)),z=fit(points,2,t=>t,t=>Math.sin(Math.PI*t)),y=fit(points,1,t=>Math.sin(Math.PI*.86*t),t=>-t*t),root=points[0];
  const evaluate=t=>new THREE.Vector3(root[0]+x[0]*t+x[1]*Math.sin(Math.PI*t),root[1]+y[0]*Math.sin(Math.PI*.86*t)-y[1]*t*t,root[2]+z[0]*t+z[1]*Math.sin(Math.PI*t));
  const derivative=t=>new THREE.Vector3(x[0]+Math.PI*x[1]*Math.cos(Math.PI*t),y[0]*Math.PI*.86*Math.cos(Math.PI*.86*t)-2*y[1]*t,z[0]+Math.PI*z[1]*Math.cos(Math.PI*t));
  const speed=t=>derivative(t).length(),arc=(limit,steps=128)=>{let sum=speed(0)+speed(limit);for(let i=1;i<steps;i++)sum+=(i%2?4:2)*speed(limit*i/steps);return sum*limit/steps/3;};
  let fitError=0;for(let j=0;j<24;j++)fitError=Math.max(fitError,evaluate(j/23).distanceTo(new THREE.Vector3(...points[j])));
  const forward=new THREE.Vector3(x[0],0,z[0]).normalize(),lateral=new THREE.Vector3(-forward.z,0,forward.x),transport=createFrondTransport(THREE,evaluate,lateral);
  const count=21+tree%3,dead=f>=count-(tree%2===0?2:1),record={tree,f,ageClass:f===0?'young':dead?'dead':'healthy',root:r.array.slice(start*4,start*4+3),leaflets:[],fitError,arc,evaluate,derivative,speed,lateral,transport};
  byRoot.set(key(r,start),record);fronds.push(record);if(++f===count){tree++;f=0;}
}
for(let i=0;i<m.count;i+=3){
  if(m.getZ(i)!==0)continue;const record=byRoot.get(key(br,i));if(!record)continue;
  const t=m.getY(i),F=new THREE.Vector3(axis.getX(i),axis.getY(i),axis.getZ(i)).normalize(),T=record.derivative(t).normalize();
  const sideSign=F.dot(record.lateral)>=0?1:-1,L=F.clone().addScaledVector(T,-F.dot(T)).multiplyScalar(sideSign).normalize(),N=new THREE.Vector3().crossVectors(L,T).normalize(),reference=record.transport.normalAt(t,T,0);
  const angle=Math.atan2(T.dot(new THREE.Vector3().crossVectors(reference,N)),reference.dot(N))*180/Math.PI;
  record.leaflets.push({t,side:sideSign,planeRollDegrees:angle});
}
const rows=fronds.map(v=>{
  const first=Math.min(...v.leaflets.map(l=>l.t)),firstArc=v.arc(first),wholeArc=v.arc(1),spacings=[];
  for(const side of [-1,1]){const leaves=v.leaflets.filter(l=>l.side===side).sort((a,b)=>a.t-b.t);for(let i=1;i<leaves.length;i++){const a=leaves[i-1].t,b=leaves[i].t;spacings.push((b-a)*v.speed((a+b)/2));}}
  const mean=spacings.reduce((s,x)=>s+x,0)/spacings.length,cv=Math.sqrt(spacings.reduce((s,x)=>s+(x-mean)**2,0)/spacings.length)/mean;
  const mid=v.leaflets.filter(l=>l.t>=.45&&l.t<=.6).map(l=>l.planeRollDegrees),tip=v.leaflets.filter(l=>l.t>=.85).map(l=>l.planeRollDegrees);
  let lo=0,hi=1;for(let k=0;k<22;k++){const t=(lo+hi)/2;if(v.arc(t,64)<.75)lo=t;else hi=t;}const threshold=(lo+hi)/2,removed=v.leaflets.filter(l=>l.t<threshold).length;
  return {tree:v.tree,frond:v.f,ageClass:v.ageClass,leafletCount:v.leaflets.length,firstPinnaParameter:first,unfoliatedRachisArcMetres:firstArc,wholeRachisArcMetres:wholeArc,bareArcFraction:firstArc/wholeArc,minimumRingFitErrorMetres:v.fitError,withinRankSpacingMetres:summary(spacings),withinRankSpacingCV:cv,distalRankPlaneRollChangeDegrees:median(tip)-median(mid),proximalDiagnostic75cm:{thresholdParameter:threshold,removedLeaflets:removed,remainingLeaflets:v.leaflets.length-removed}};
});
const srgb=v=>v<=.04045?v/12.92:((v+.055)/1.055)**2.4,map=grove.userData.proceduralTextures.palm.albedo.image.data,meanMap=[0,0,0];
for(let i=0;i<map.length;i+=4)for(let c=0;c<3;c++)meanMap[c]+=srgb(map[i+c]/255)/(map.length/4);
let area=0;const meanVertex=[0,0,0],positions=pinna.attributes.position.array,col=pinna.attributes.color.array,ix=pinna.index.array;
for(let i=0;i<ix.length;i+=3){const ia=ix[i]*3,ib=ix[i+1]*3,ic=ix[i+2]*3,ax=positions[ib]-positions[ia],ay=positions[ib+1]-positions[ia+1],az=positions[ib+2]-positions[ia+2],bx=positions[ic]-positions[ia],by=positions[ic+1]-positions[ia+1],bz=positions[ic+2]-positions[ia+2],weight=Math.hypot(ay*bz-az*by,az*bx-ax*bz,ax*by-ay*bx)*.5;area+=weight;for(let c=0;c<3;c++)meanVertex[c]+=weight*(col[ia+c]+col[ib+c]+col[ic+c])/3;}
for(let c=0;c<3;c++)meanVertex[c]/=area;
const Y=v=>v[0]*.2126+v[1]*.7152+v[2]*.0722,product=meanMap.map((v,c)=>v*meanVertex[c]);
const groups=Object.fromEntries(['all','healthy','young','dead'].map(age=>{const list=rows.filter(v=>age==='all'||v.ageClass===age);return [age,{count:list.length,unfoliatedRachisArcMetres:summary(list.map(v=>v.unfoliatedRachisArcMetres)),wholeRachisArcMetres:summary(list.map(v=>v.wholeRachisArcMetres)),withinRankSpacingCV:summary(list.map(v=>v.withinRankSpacingCV)),distalRankPlaneRollChangeDegrees:summary(list.map(v=>v.distalRankPlaneRollChangeDegrees))}];}));
const hash=path=>crypto.createHash('sha256').update(fs.readFileSync(new URL(path,import.meta.url))).digest('hex');
const report={date:new Date().toISOString(),runtimeEdits:false,sourceHashes:{vegetation:hash('../vegetation.js'),palmFrame:hash('../palm-frame.js')},method:'Real frozen grove. Fit analytic rachis curve coefficients from Float32 tube ring centres then Simpson integrate to actual earliest leaflet st; exclude sheaths because anatomical insertion is not explicitly represented.',groups,maximumFitResidualMetres:Math.max(...rows.map(v=>v.minimumRingFitErrorMetres)),rows,proximalDiagnostic75cm:{originalLeaflets:rows.reduce((s,v)=>s+v.leafletCount,0),removedLeaflets:rows.reduce((s,v)=>s+v.proximalDiagnostic75cm.removedLeaflets,0),remainingLeafletsPerHealthyFrond:summary(rows.filter(v=>v.ageClass==='healthy').map(v=>v.proximalDiagnostic75cm.remainingLeaflets))},albedo:{mapMeanLinearRGB:meanMap,mapMeanLinearY:Y(meanMap),areaWeightedVertexMeanLinearRGB:meanVertex,areaWeightedVertexY:Y(meanVertex),independentMeanProductRGB:product,independentMeanProductY:Y(product),independentMeanProductVsVertexY:Y(product)/Y(meanVertex),materialColour:grove.children.find(m=>m.name==='Folded coconut pinnae').material.color.toArray(),limit:'Product of means is a diagnostic proxy, not exact correlated UV/vertex/optics integration or measured specimen reflectance; excludes slab reservation, lighting and exposure'},limits:['Unfoliated model rachis-root arc is not a measured complete petiole from its hidden anatomical insertion','Spacing CV uses midpoint differential speed between actual same-side leaflet starts; not exact path integration per pair','Rank-plane rotation is inferred from existing leaflet axes relative to a transported local frame; no new geometry/shader modes']};
fs.writeFileSync(new URL('./palm-next-measure.json',import.meta.url),JSON.stringify(report,null,2));console.log(JSON.stringify({groups,maximumFitResidualMetres:report.maximumFitResidualMetres,albedo:report.albedo,proximalDiagnostic75cm:report.proximalDiagnostic75cm}));grove.userData.dispose();
