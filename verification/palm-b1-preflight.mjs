// CPU-only B1 experiment. Does not write or import a modified runtime file.
// A source adapter records already-generated latent parameters, consumes no RNG,
// and is accepted only after every resulting B0 buffer matches production bytes.
import fs from 'node:fs';
import crypto from 'node:crypto';
import * as THREE from '../vendor/three.module.js';
import {createVegetation} from '../vegetation.js';
import {completePalmGeometryFrame} from '../palm-frame.js';

const bytes=a=>Buffer.from(a.buffer,a.byteOffset,a.byteLength);
const hash=a=>crypto.createHash('sha256').update(a).digest('hex');
const sourceURL=new URL('../vegetation.js',import.meta.url),frameURL=new URL('../palm-frame.js',import.meta.url);
const source=fs.readFileSync(sourceURL,'utf8'),sourceHash=hash(source),frameHash=hash(fs.readFileSync(frameURL));
const checkpoint=JSON.parse(fs.readFileSync(new URL('./baselines/b4-production-20261027-040831/sha256.json',import.meta.url)));
const checks=[],check=(id,passed,details={})=>checks.push({id,passed,...details});
check('runtime_sources_match_sealed_B4',checkpoint.runtimeDefaults.palmFrame==='transport'&&['vegetation.js','palm-frame.js'].every(path=>checkpoint.filesCopied.find(r=>r.path===path)?.sha256===(path==='vegetation.js'?sourceHash:frameHash)));
const replaceOnce=(s,from,to)=>{if(s.split(from).length!==2)throw new Error(`Source adapter ambiguous anchor: ${from.slice(0,60)}`);return s.replace(from,to);};
let adapted=replaceOnce(source,"from './palm-frame.js'",`from ${JSON.stringify(frameURL.href)}`);
adapted='export const __qaFronds=[]; export const __qaLeaves=[];\n'+adapted;
adapted=replaceOnce(adapted,'const uvScale=range(0.84,1),uvOffset=range(0,1-uvScale),edgePhase=range(0,6.28);',`const uvScale=range(0.84,1),uvOffset=range(0,1-uvScale),edgePhase=range(0,6.28);
    if(d===pinnae&&transportNormal!==undefined)__qaLeaves.push({start,steps,root:root.clone(),forward:forward.clone(),side:side.clone(),up:up.clone(),length,halfWidth,droop,curl,edgePhase,branchRoot:ctx.branchRoot.clone(),st:ctx.branchS,sectionRoll});`);
adapted=replaceOnce(adapted,'const frameStamp=performance.now(),transport=createFrondTransport(THREE,curve,lateral);',`const frameStamp=performance.now(),transport=createFrondTransport(THREE,curve,lateral);
      __qaFronds.push({tree:index,frond:f,young,dead,root:root.clone(),length,rise,drop,twist,forward:forward.clone(),lateral:lateral.clone(),curve});`);
const adapter=await import('data:text/javascript;base64,'+Buffer.from(adapted).toString('base64'));
const terrainMatch=fs.readFileSync(new URL('../main.js',import.meta.url),'utf8').match(/export function terrainHeight\(x,z\)\{([\s\S]*?)\n\}/);
if(!terrainMatch)throw new Error('Missing terrain');
const options={terrainHeight:new Function('x','z',terrainMatch[1]),seed:40219},started=performance.now();
const live=createVegetation(THREE,options),grove=adapter.createVegetation(THREE,options);
live.userData.setPalmFrameMode('transport');grove.userData.setPalmFrameMode('transport');
const differences=[];
for(let j=0;j<live.children.length;j++){
  const a=live.children[j].geometry,b=grove.children[j].geometry;
  for(const n of Object.keys(a.attributes))if(!bytes(a.attributes[n].array).equals(bytes(b.attributes[n].array)))differences.push(`${j}.${n}`);
  if(!bytes(a.index.array).equals(bytes(b.index.array)))differences.push(`${j}.index`);
}
check('instrumented_adapter_B0_all_six_mesh_buffers_byte_identical',differences.length===0,{differences});
if(differences.length)throw new Error('Latent adapter changed production geometry');
const base=grove.children.find(m=>m.name==='Folded coconut pinnae').geometry;
const pos=base.attributes.position.array,indices=base.index.array,axis=base.attributes.aLeafAxis.array;
const V=(a,i)=>new THREE.Vector3(a[i],a[i+1],a[i+2]),put=(a,i,v)=>{a[i]=v.x;a[i+1]=v.y;a[i+2]=v.z;};
const rootKey=v=>v.toArray().join(','),fronds=adapter.__qaFronds,leaves=adapter.__qaLeaves;
const byRoot=new Map(fronds.map(f=>[rootKey(f.root),f]));
const summary=values=>{const a=values.filter(Number.isFinite).sort((a,b)=>a-b),q=t=>a[Math.floor((a.length-1)*t)];return {count:a.length,min:a[0],p05:q(.05),median:q(.5),p95:q(.95),max:a.at(-1),mean:a.reduce((s,v)=>s+v,0)/a.length};};
const angle=(a,b)=>Math.acos(Math.max(-1,Math.min(1,a.dot(b)/(a.length()*b.length()))))*180/Math.PI;
const smooth=x=>(x=Math.max(0,Math.min(1,x)),x*x*(3-2*x));
function arc(f,t,steps=128){
  const speed=s=>Math.hypot(f.length+Math.PI*f.twist*Math.cos(Math.PI*s)*f.lateral.dot(f.forward),f.rise*Math.PI*.86*Math.cos(Math.PI*.86*s)-2*f.drop*s,Math.PI*f.twist*Math.cos(Math.PI*s));
  // forward/lateral are horizontal orthonormal; first term simplifies to L.
  let total=speed(0)+speed(t);for(let j=1;j<steps;j++)total+=(j%2?4:2)*speed(t*j/steps);return total*t/steps/3;
}
for(const f of fronds){f.leaves=[];f.totalArc=arc(f,1);}
for(const [leafId,l] of leaves.entries()){l.id=leafId;l.frond=byRoot.get(rootKey(l.branchRoot));if(!l.frond)throw new Error('Unmatched leaf');l.frond.leaves.push(l);}
for(const f of fronds){f.bareEndParameter=Math.min(...f.leaves.map(l=>l.st));f.bareArc=arc(f,f.bareEndParameter);f.startArc=f.bareArc+(f.totalArc-f.bareArc)*.5;}
let reconstructionMismatch=0,reconstructionMax=0;
for(const l of leaves){
  l.healthy=!l.frond.young&&!l.frond.dead;l.arc=arc(l.frond,l.st);l.torsionGain=l.healthy?smooth((l.arc-l.frond.startArc)/(l.frond.totalArc-l.frond.startArc)):0;
  l.tangent=l.frond.curve(Math.min(1,l.st+.006)).sub(l.frond.curve(Math.max(0,l.st-.006))).normalize();
  l.midrib=[];l.section=[];l.originalSegments=[];
  for(let j=0;j<=l.steps;j++){
    const i=(l.start+j*3+1)*3,s=j/l.steps,profile=.98+Math.sin(l.edgePhase)*.12;
    const shape=j===0||j===l.steps?0:Math.sin(Math.PI*s**profile)**.62*(1-s*.065);
    const center=l.root.clone().addScaledVector(l.forward,l.length*s).addScaledVector(l.side,Math.sin(Math.PI*s)*l.curl);center.y-=l.droop*s*s;center.addScaledVector(l.up,.0028*shape);
    const f32=new Float32Array(center.toArray()),M=V(pos,i);reconstructionMax=Math.max(reconstructionMax,M.distanceTo(V(f32,0)));if(!bytes(f32).equals(bytes(pos.subarray(i,i+3))))reconstructionMismatch++;
    l.midrib.push(M);l.section.push([-1,1].map(e=>V(pos,i+e*3).sub(M)));
    if(j)l.originalSegments.push(M.distanceTo(l.midrib[j-1]));
  }
  l.originalArc=l.originalSegments.reduce((a,b)=>a+b,0);
}
check('latent_formula_reconstructs_every_uploaded_B0_midrib_byte',reconstructionMismatch===0,{mismatchRows:reconstructionMismatch,maxErrorMetres:reconstructionMax});
const healthyFronds=fronds.filter(f=>!f.young&&!f.dead),healthyLeaves=leaves.filter(l=>l.healthy),activeLeaves=healthyLeaves.filter(l=>l.torsionGain>0);
check('scope_is_exactly_175_healthy_mature_fronds',healthyFronds.length===175&&fronds.length===198&&leaves.length===31162,{fronds:fronds.length,healthyFronds:healthyFronds.length,leaflets:leaves.length,healthyLeaflets:healthyLeaves.length,nonzeroTorsionLeaflets:activeLeaves.length});
const arcMidpointFormError=Math.max(...healthyFronds.map(f=>Math.abs(f.startArc-(f.bareArc+f.totalArc)*.5)));
check('torsion_arc_half_support_is_fixed_monotone_and_C1_at_start',arcMidpointFormError<1e-14&&smooth(-1)===0&&smooth(0)===0&&smooth(1)===1&&smooth(2)===1&&Array.from({length:100},(_,i)=>smooth((i+1)/100)-smooth(i/100)).every(d=>d>=0)&&3*(1e-6)**2-2*(1e-6)**3<4e-12,{arcMidpointEquivalentFormulaRoundoffMetres:arcMidpointFormError});
const rowTangent=(points,j)=>j===0?points[1].clone().sub(points[0]).normalize():j===points.length-1?points[j].clone().sub(points[j-1]).normalize():points[j].clone().sub(points[j-1]).normalize().add(points[j+1].clone().sub(points[j]).normalize()).normalize();

function build(amplitudeDegrees,method){
  // Identity is a buffer copy, not trig arithmetic or regenerated normals.
  if(amplitudeDegrees===0)return {geometry:base,identity:true,metadata:{method,amplitudeDegrees}};
  const p=pos.slice(),a=axis.slice(),segmentPreQuantizationErrors=[],gravityResiduals=[],frameRotationErrors=[],constraintCorrections=[],constraintHorizontalCorrections=[],alignmentAngles=[],sectionAdjacentAngleChanges=[];
  let maximumSectionDeterminantError=0,antiparallelAlignmentCases=0;
  for(const l of activeLeaves){
    const theta=amplitudeDegrees*Math.PI/180*l.torsionGain,Q=new THREE.Quaternion().setFromAxisAngle(l.tangent,theta),F=l.forward.clone().applyQuaternion(Q),natural=[];
    let previousSectionQ=null;
    for(let j=0;j<=l.steps;j++){
      const s=j/l.steps,profile=.98+Math.sin(l.edgePhase)*.12,shape=j===0||j===l.steps?0:Math.sin(Math.PI*s**profile)**.62*(1-s*.065);
      const nongravity=l.forward.clone().multiplyScalar(l.length*s).addScaledVector(l.side,Math.sin(Math.PI*s)*l.curl).addScaledVector(l.up,.0028*shape).applyQuaternion(Q);
      const M=l.root.clone().add(nongravity);M.y-=l.droop*s*s;natural.push(M);
      const recovered=M.clone().sub(l.root).sub(nongravity);gravityResiduals.push(recovered.distanceTo(new THREE.Vector3(0,-l.droop*s*s,0)));
    }
    // The root remains its original uploaded Float32 value.
    natural[0]=l.midrib[0].clone();
    const C=method==='natural'?natural:[l.midrib[0].clone()];
    if(method==='segment-constrained')for(let j=1;j<=l.steps;j++){
      const direction=natural[j].clone().sub(natural[j-1]).normalize();
      C.push(C[j-1].clone().addScaledVector(direction,l.originalSegments[j-1]));
      segmentPreQuantizationErrors.push(Math.abs(C[j].distanceTo(C[j-1])-l.originalSegments[j-1]));
    }
    if(method==='segment-constrained')for(let j=0;j<=l.steps;j++){const delta=C[j].clone().sub(natural[j]);constraintCorrections.push(delta.length());constraintHorizontalCorrections.push(Math.hypot(delta.x,delta.z));}
    for(let j=0;j<=l.steps;j++){
      const mid=(l.start+j*3+1)*3;
      // Constrained variant transfers each cross-section with an SO(3) rotation.
      // Align Q*old centreline tangent with the new tangent; retain Q's torsion.
      let R=Q;
      if(method==='segment-constrained'){
        const from=rowTangent(l.midrib,j).applyQuaternion(Q),to=rowTangent(C,j);if(from.dot(to)<-1+1e-8)antiparallelAlignmentCases++;
        alignmentAngles.push(angle(from,to));const align=new THREE.Quaternion().setFromUnitVectors(from,to);R=align.multiply(Q.clone());
        frameRotationErrors.push(Math.abs(R.length()-1));
      }
      const X=new THREE.Vector3(1,0,0).applyQuaternion(R),Y=new THREE.Vector3(0,1,0).applyQuaternion(R),Z=new THREE.Vector3(0,0,1).applyQuaternion(R);
      maximumSectionDeterminantError=Math.max(maximumSectionDeterminantError,Math.abs(X.dot(Y.cross(Z))-1));
      if(previousSectionQ)sectionAdjacentAngleChanges.push(previousSectionQ.angleTo(R)*180/Math.PI);previousSectionQ=R.clone();
      put(p,mid,C[j]);
      for(let e=0;e<2;e++)put(p,mid+(e===0?-3:3),C[j].clone().add(l.section[j][e].clone().applyQuaternion(R)));
      for(let k=-1;k<=1;k++)put(a,mid+k*3,F);
    }
  }
  const g=new THREE.BufferGeometry();for(const [n,v]of Object.entries(base.attributes))if(!['position','normal','tangent','aLeafAxis'].includes(n))g.setAttribute(n,v);
  g.setAttribute('position',new THREE.BufferAttribute(p,3));g.setAttribute('aLeafAxis',new THREE.BufferAttribute(a,3));g.setIndex(base.index);completePalmGeometryFrame(g,base.userData.frameValidation.removedDegenerateTriangles);
  return {geometry:g,identity:false,metadata:{method,amplitudeDegrees,preQuantizationSegmentMaxErrorMetres:Math.max(0,...segmentPreQuantizationErrors),worldDownSagConstructionMaxErrorMetres:Math.max(0,...gravityResiduals),sectionQuaternionUnitMaxError:Math.max(0,...frameRotationErrors),maximumSectionDeterminantError,antiparallelAlignmentCases,alignmentFromPureTorsionDegrees:summary(alignmentAngles),sectionAdjacentRowRotationDegrees:summary(sectionAdjacentAngleChanges),constraintCorrectionFromNaturalMetres:summary(constraintCorrections),constraintHorizontalCorrectionFromNaturalMetres:summary(constraintHorizontalCorrections)}};
}
function triangleCross(p,i){const a=V(p,indices[i]*3),b=V(p,indices[i+1]*3).sub(a),c=V(p,indices[i+2]*3).sub(a);return {cross:b.clone().cross(c),edgeProduct:b.lengthSq()*c.lengthSq()};}
const byVertex=new Int32Array(pos.length/3).fill(-1);for(let n=0;n<leaves.length;n++){const l=leaves[n];byVertex.fill(n,l.start,l.start+(l.steps+1)*3);}
const representativeFrond=healthyFronds.slice().sort((a,b)=>a.totalArc-b.totalArc)[Math.floor(healthyFronds.length/2)];
const baseAreas=new Float64Array(leaves.length);let baseArea=0;
const directions=[];for(const elevation of [5,25,65])for(const azimuth of [0,90,180,270]){const e=elevation*Math.PI/180,a=azimuth*Math.PI/180;directions.push({azimuth,elevation,view:new THREE.Vector3(Math.cos(e)*Math.cos(a),Math.sin(e),Math.cos(e)*Math.sin(a)),baseArea:0,representativeBaseArea:0});}
for(let i=0;i<indices.length;i+=3){const {cross}=triangleCross(pos,i),area=cross.length()*.5;baseArea+=area;const id=byVertex[indices[i]];if(id>=0)baseAreas[id]+=area;for(const d of directions){const projection=Math.abs(cross.dot(d.view))*.5;d.baseArea+=projection;if(id>=0&&leaves[id].frond===representativeFrond)d.representativeBaseArea+=projection;}}
function metrics(candidate){
  const g=candidate.geometry,p=g.attributes.position.array,a=g.attributes.aLeafAxis.array,n=g.attributes.normal.array,t=g.attributes.tangent.array;
  const arcRatios=[],segmentRatios=[],widthRatios=[],tipShifts=[],axisAngles=[],axisVsChord=[],baseAxisVsChord=[],areas=new Float64Array(leaves.length),projected=new Float64Array(directions.length),representativeProjected=new Float64Array(directions.length),normalAngles=[],tangentAngles=[];
  let rootMax=0,endpointSplitMax=0,nonFinite=0,degenerate=0,maxNormalError=0,maxTangentError=0,maxDot=0,maxAxisError=0,handednessChanges=0,negativeHandedness=0,area=0,untargetedMismatch=0;
  const pi=new Uint32Array(p.buffer,p.byteOffset,p.length),bi=new Uint32Array(pos.buffer,pos.byteOffset,pos.length);
  for(const l of leaves){
    const C=[];for(let j=0;j<=l.steps;j++){const k=(l.start+j*3+1)*3;C.push(V(p,k));for(const e of [-1,1])if(j===0||j===l.steps)endpointSplitMax=Math.max(endpointSplitMax,V(p,k+3*e).distanceTo(C[j]));}
    if(!l.healthy||l.torsionGain===0){for(let i=l.start*3;i<(l.start+(l.steps+1)*3)*3;i++)if(pi[i]!==bi[i])untargetedMismatch++;continue;}
    rootMax=Math.max(rootMax,C[0].distanceTo(l.midrib[0]));
    let len=0;for(let j=1;j<=l.steps;j++){const s=C[j].distanceTo(C[j-1]);len+=s;segmentRatios.push(s/l.originalSegments[j-1]);}
    arcRatios.push(len/l.originalArc);tipShifts.push(C.at(-1).distanceTo(l.midrib.at(-1)));
    for(let j=1;j<l.steps;j++){const k=(l.start+j*3+1)*3,w=V(p,k+3).distanceTo(V(p,k-3)),w0=V(pos,k+3).distanceTo(V(pos,k-3));widthRatios.push(w/w0);}
    const k=l.start*3,F=V(a,k),F0=V(axis,k);axisAngles.push(angle(F,F0));axisVsChord.push(angle(F,C.at(-1).clone().sub(C[0])));baseAxisVsChord.push(angle(F0,l.midrib.at(-1).clone().sub(l.midrib[0])));
  }
  for(let i=0,j=0;i<n.length;i+=3,j+=4){
    const N=V(n,i),T=new THREE.Vector3(t[j],t[j+1],t[j+2]);for(const value of [p[i],p[i+1],p[i+2],...N.toArray(),...T.toArray(),a[i],a[i+1],a[i+2]])if(!Number.isFinite(value))nonFinite++;
    maxNormalError=Math.max(maxNormalError,Math.abs(N.length()-1));maxTangentError=Math.max(maxTangentError,Math.abs(T.length()-1));maxDot=Math.max(maxDot,Math.abs(N.dot(T)));maxAxisError=Math.max(maxAxisError,Math.abs(V(a,i).length()-1));
    if(Math.abs(t[j+3])!==1)nonFinite++;if(t[j+3]!==base.attributes.tangent.array[j+3])handednessChanges++;if(t[j+3]<0)negativeHandedness++;
    if(i%51===0){normalAngles.push(angle(N,V(base.attributes.normal.array,i)));tangentAngles.push(angle(T,new THREE.Vector3(...base.attributes.tangent.array.subarray(j,j+3))));}
  }
  for(let i=0;i<indices.length;i+=3){const {cross,edgeProduct}=triangleCross(p,i),cross2=cross.lengthSq(),ar=Math.sqrt(cross2)*.5;area+=ar;const id=byVertex[indices[i]];if(id>=0)areas[id]+=ar;if(!(cross2>Math.max(1e-18,edgeProduct*1e-12)))degenerate++;for(let v=0;v<directions.length;v++){const projection=Math.abs(cross.dot(directions[v].view))*.5;projected[v]+=projection;if(id>=0&&leaves[id].frond===representativeFrond)representativeProjected[v]+=projection;}}
  const activeAreas=activeLeaves.map(l=>areas[l.id]/baseAreas[l.id]);
  const locked=Object.keys(base.attributes).filter(k=>!['position','normal','tangent','aLeafAxis'].includes(k)),lockedDifferent=locked.filter(k=>!bytes(g.attributes[k].array).equals(bytes(base.attributes[k].array)));
  const percent=s=>Object.fromEntries(Object.entries(s).map(([k,v])=>[k,k==='count'?v:(v-1)*100]));
  const m={...candidate.metadata,identity:candidate.identity,positionHash:hash(bytes(p)),axisHash:hash(bytes(a)),changedLeaflets:activeLeaves.length,actualUploadedMidribArcChangePercent:percent(summary(arcRatios)),actualUploadedSegmentLengthChangePercent:percent(summary(segmentRatios)),arcChangedOver1Percent:arcRatios.filter(v=>Math.abs(v-1)>.01).length,arcChangedOver5Percent:arcRatios.filter(v=>Math.abs(v-1)>.05).length,actualSectionWidthChangePercent:percent(summary(widthRatios)),leafTriangleAreaChangePercent:percent(summary(activeAreas)),wholePinnaMeshAreaMetres2:area,wholePinnaMeshAreaChangePercent:100*(area/baseArea-1),tipDisplacementMetres:summary(tipShifts),maximumRootDisplacementMetres:rootMax,maximumCollapsedEndpointSeparationMetres:endpointSplitMax,untargetedPositionWordMismatches:untargetedMismatch,axisDirectionChangeDegrees:summary(axisAngles),axisVsActualRootTipChordDegrees:summary(axisVsChord),B0axisVsActualRootTipChordDegrees:summary(baseAxisVsChord),TBN:{nonFinite,maxNormalError,maxTangentError,maxDot,maxAxisError,handednessChanges,negativeHandedness,sampledNormalChangeDegrees:summary(normalAngles),sampledTangentChangeDegrees:summary(tangentAngles)},degenerateIndexedTriangles:degenerate,lockedAttributeMismatches:lockedDifferent,indexByteIdentical:bytes(g.index.array).equals(bytes(base.index.array)),unoccludedProjectedTriangleArea12Directions:directions.map((d,i)=>({azimuth:d.azimuth,elevation:d.elevation,B0Metres2:d.baseArea,candidateMetres2:projected[i],ratio:projected[i]/d.baseArea})),bounds:{min:g.boundingBox.min.toArray(),max:g.boundingBox.max.toArray(),sphereRadiusIncludingExistingWindMargin:g.boundingSphere.radius}};
  m.imposedTorsionAngleDegrees=summary(activeLeaves.map(l=>candidate.metadata.amplitudeDegrees*l.torsionGain));
  m.conservationAssessment={passesOnePercentActualArcGate:arcRatios.every(v=>Math.abs(v-1)<=.01),meaning:'A valid finite mesh is not the same as a shape-only / inextensible experiment; natural candidates fail this separate gate, despite near-zero whole-crown mean.'};
  m.representativeFrond={selection:'median original whole-rachis arclength among 175 healthy fronds; chosen before comparing candidate projections',tree:representativeFrond.tree,frond:representativeFrond.frond,wholeRachisArcMetres:representativeFrond.totalArc,projected12Directions:directions.map((d,i)=>({azimuth:d.azimuth,elevation:d.elevation,B0Metres2:d.representativeBaseArea,candidateMetres2:representativeProjected[i],ratio:representativeProjected[i]/d.representativeBaseArea}))};
  check(`${m.method}_${m.amplitudeDegrees}_finite_no_degenerate_TBN`,nonFinite===0&&degenerate===0&&maxNormalError<1e-6&&maxTangentError<1e-6&&maxDot<1e-6&&maxAxisError<1e-6);
  check(`${m.method}_${m.amplitudeDegrees}_scope_topology_roots_width_endpoints`,untargetedMismatch===0&&lockedDifferent.length===0&&m.indexByteIdentical&&rootMax===0&&endpointSplitMax===0&&Math.max(Math.abs(m.actualSectionWidthChangePercent.min),Math.abs(m.actualSectionWidthChangePercent.max))<.05);
  check(`${m.method}_${m.amplitudeDegrees}_world_gravity_target_and_proper_section_rotation`,m.worldDownSagConstructionMaxErrorMetres<1e-12&&m.maximumSectionDeterminantError<1e-12&&m.antiparallelAlignmentCases===0&&m.sectionAdjacentRowRotationDegrees.max<90);
  return m;
}
const identity=build(0,'natural');
check('zero_degrees_restores_all_B0_buffer_bytes',identity.geometry===base&&Object.keys(base.attributes).every(k=>bytes(identity.geometry.attributes[k].array).equals(bytes(base.attributes[k].array)))&&bytes(identity.geometry.index.array).equals(bytes(base.index.array)));
check('constrained_zero_uses_identical_B0_objects_too',build(0,'segment-constrained').geometry===base);
const results=[];
for(const amplitude of [45,75]){const c=build(amplitude,'natural');results.push(metrics(c));c.geometry.dispose();}
const significant=results.some(r=>r.arcChangedOver1Percent>0);
if(significant)for(const amplitude of [45,75]){const c=build(amplitude,'segment-constrained'),m=metrics(c);results.push(m);check(`constrained_${amplitude}_uploaded_segments_preserved_to_float_precision`,Math.max(Math.abs(m.actualUploadedSegmentLengthChangePercent.min),Math.abs(m.actualUploadedSegmentLengthChangePercent.max))<.01&&m.preQuantizationSegmentMaxErrorMetres<1e-12);c.geometry.dispose();}
const roots=healthyFronds.map(f=>({tree:f.tree,frond:f.frond,bareEndParameter:f.bareEndParameter,bareArcMetres:f.bareArc,wholeArcMetres:f.totalArc,torsionStartsAtArcMetres:f.startArc,healthyLeaflets:f.leaves.length}));
const report={schema:'glass-atoll.palm-B1-CPU-preflight.v1',dateUTC:new Date().toISOString(),runtimeEdits:false,noGPUOrBrowser:true,sourceHashes:{vegetation:sourceHash,palmFrame:frameHash},checkpoint:'baselines/b4-production-20261027-040831/sha256.json',adapter:{method:'Read production source as data; insert no-RNG latent collectors in memory; import data URL with absolute palm-frame import; verify all six B0 mesh attributes/index bytes before experiment',hash:hash(adapted),midribReconstructionMaxErrorMetres:reconstructionMax},definition:{health:'exclude 9 young and 14 dead fronds; change 175 healthy mature fronds only',bareEndpoint:'fixed earliest original pinna root; never recompute from a candidate',arcCoordinate:'s = original analytic rachis arclength from original model root; theta=A*smoothstep((s-(bare+(total-bare)/2))/((total-bare)/2))',signedTorsion:'positive right-hand angle about original local rachis tangent, same sign on both pinna ranks; not camera-dependent',natural:'rotate initial F, original curl and ridge vectors by Q; leave -worldY*droop*s_leaf² unchanged; rotate original B0 edge offsets by Q',constrained:'separate geometric experiment, not a physics solve: normalize each natural target midrib segment and use its original uploaded B0 segment length; root fixed; do not rotate gravity into a local axis; each B0 section receives SO(3) Q plus minimal tangent alignment. Sag magnitude is allowed to respond to the geometric constraint; no claim of elastic equilibrium or exact original pointwise sag.',significanceThreshold:'any active pinna actual uploaded midrib polyline arc changes by more than 1%; test constrained independently if so',zero:'return B0 buffer object, not regenerated trigonometry'},counts:{fronds:fronds.length,healthyFronds:healthyFronds.length,leaflets:leaves.length,healthyLeaflets:healthyLeaves.length,activeLeaflets:activeLeaves.length,vertices:base.attributes.position.count,triangles:indices.length/3},B0:{positionHash:hash(bytes(pos)),axisHash:hash(bytes(axis)),areaMetres2:baseArea,midribArcMetres:summary(healthyLeaves.map(l=>l.originalArc)),maximumSectionWidthMetres:summary(healthyLeaves.map(l=>Math.max(...l.section.map(s=>s[0].distanceTo(s[1]))))),bareArcMetres:summary(healthyFronds.map(f=>f.bareArc)),wholeRachisArcMetres:summary(healthyFronds.map(f=>f.totalArc))},originalFrondCoordinates:roots,results,checks,passed:checks.every(c=>c.passed),elapsedSeconds:(performance.now()-started)/1000,retainedCandidateBytesIfOneAdditionalVariant:pos.byteLength+base.attributes.normal.array.byteLength+base.attributes.tangent.array.byteLength+axis.byteLength,limits:['No GPU, rasterized coverage, occlusion, shadows, optical response, dynamic motion or timing measurement','Projected triangle area is unoccluded geometry only; not screen pixel coverage or a quality score','Reported arclength is actual uploaded discrete midrib polyline, not an unrepresented anatomical smooth curve','All nominal length/width controls and leaf count stay fixed; this alone does not imply arc or surface-area conservation','Segment constraint preserves discrete lengths, not triangle surface area, physical beam equilibrium or exact pointwise sag','Both candidates need aLeafAxis, TBN, bounds, shadow, GI and history updates; 0 reuses exact B0','0/45/75 are experiments, not a universal botanical torsion prescription']};
check('runtime_sources_unchanged_at_end',hash(fs.readFileSync(sourceURL))===sourceHash&&hash(fs.readFileSync(frameURL))===frameHash);report.passed=checks.every(c=>c.passed);
fs.writeFileSync(new URL('./palm-b1-preflight.json',import.meta.url),JSON.stringify(report,null,2));
console.log(JSON.stringify({passed:report.passed,checks:checks.length,failed:checks.filter(c=>!c.passed),counts:report.counts,elapsedSeconds:report.elapsedSeconds,results:results.map(r=>({method:r.method,degrees:r.amplitudeDegrees,arc:r.actualUploadedMidribArcChangePercent,width:r.actualSectionWidthChangePercent,area:r.wholePinnaMeshAreaChangePercent,tip:r.tipDisplacementMetres,degenerate:r.degenerateIndexedTriangles}))},null,2));
live.userData.dispose();grove.userData.dispose();if(!report.passed)process.exitCode=1;
