import fs from 'node:fs';
import crypto from 'node:crypto';
import * as THREE from '../vendor/three.module.js';
import {createVegetation as createBaseline,vegetationWindGLSL as baselineWind} from './baselines/vegetation-before-palm-B0.js';
import {createVegetation,vegetationWindGLSL} from '../vegetation.js';
import {sectionRotation,rotatePinnaEdges,fallbackDegeneratePinnae} from '../palm-frame.js';
const bytes=a=>Buffer.from(a.buffer,a.byteOffset,a.byteLength),hash=a=>crypto.createHash('sha256').update(a).digest('hex');
const terrainSource=fs.readFileSync(new URL('../main.js',import.meta.url),'utf8').match(/export function terrainHeight\(x,z\)\{([\s\S]*?)\n\}/);
if(!terrainSource)throw new Error('Actual terrain unavailable');
const options={terrainHeight:new Function('x','z',terrainSource[1]),seed:40219},started=performance.now(),old=createBaseline(THREE,options),grove=createVegetation(THREE,options),checks=[];
const check=(id,passed,details={})=>checks.push({id,passed,...details});
const legacy=grove.children.find(m=>m.name==='Folded coconut pinnae').geometry;
const baselineHash=hash(fs.readFileSync(new URL('./baselines/vegetation-before-palm-B0.js',import.meta.url)));
check('baseline_is_the_accepted_f81_source',baselineHash==='f81f4dfe20fa737d9498e5124d14a66c577db37e36e9cd08f8cf8c60fcad7ef0');
check('default_mode_is_legacy',grove.userData.palmFrameMode==='legacy');
const mismatches=[];
for(let i=0;i<old.children.length;i++){
  const a=old.children[i].geometry,b=grove.children[i].geometry;
  for(const name of Object.keys(a.attributes))if(!bytes(a.attributes[name].array).equals(bytes(b.attributes[name].array)))mismatches.push(`${i}.${name}`);
  if(!bytes(a.index.array).equals(bytes(b.index.array)))mismatches.push(`${i}.index`);
}
check('all_six_legacy_mesh_attributes_and_indices_bit_identical',mismatches.length===0,{mismatches});
const textureMismatches=[];
for(const species of Object.keys(old.userData.proceduralTextures))for(const name of ['albedo','normal','roughness','thickness','bump']){
  const a=old.userData.proceduralTextures[species][name],b=grove.userData.proceduralTextures[species][name];if(a&&!bytes(a.image.data).equals(bytes(b.image.data)))textureMismatches.push(`${species}.${name}`);
}
check('all_procedural_texture_bytes_and_rng_flow_preserved',textureMismatches.length===0&&JSON.stringify(old.userData.counts)===JSON.stringify(grove.userData.counts));
const originalGeometries=grove.children.map(m=>m.geometry),modeResult=grove.userData.setPalmFrameMode('transport'),candidate=grove.children.find(m=>m.name==='Folded coconut pinnae').geometry;
check('only_pinna_geometry_changes_and_api_reports_cache_invalidation',modeResult.changed&&modeResult.resetRequired.length===3&&grove.children.every((m,i)=>m.name==='Folded coconut pinnae'||m.geometry===originalGeometries[i]));
const lockedNames=Object.keys(legacy.attributes).filter(n=>!['position','normal','tangent'].includes(n));
check('locked_attributes_and_indices_shared_without_copy',candidate.index===legacy.index&&lockedNames.every(n=>candidate.attributes[n]===legacy.attributes[n]));
const a=legacy.attributes.position.array,b=candidate.attributes.position.array,ai=new Uint32Array(a.buffer,a.byteOffset,a.length),bi=new Uint32Array(b.buffer,b.byteOffset,b.length),motion=legacy.attributes.aGroveMotion.array;
let middle=0,endpoints=0,changedMiddle=0,changedEndpoints=0,changedEdges=0,maxSectionRadiusDifference=0;
for(let i=0;i<legacy.attributes.position.count;i++){
  const equal=ai[i*3]===bi[i*3]&&ai[i*3+1]===bi[i*3+1]&&ai[i*3+2]===bi[i*3+2];
  if(motion[i*4+3]===0){middle++;if(!equal)changedMiddle++;}
  else if(!equal)changedEdges++;
  if(motion[i*4+2]===0||motion[i*4+2]===1){endpoints++;if(!equal)changedEndpoints++;}
  if(i%3!==1){const mid=(Math.floor(i/3)*3+1)*3,k=i*3,ra=Math.hypot(a[k]-a[mid],a[k+1]-a[mid+1],a[k+2]-a[mid+2]),rb=Math.hypot(b[k]-b[mid],b[k+1]-b[mid+1],b[k+2]-b[mid+2]);maxSectionRadiusDifference=Math.max(maxSectionRadiusDifference,Math.abs(ra-rb));}
}
check('whole_uploaded_midrib_is_bit_identical',changedMiddle===0,{vertices:middle});
check('all_root_and_tip_vertices_are_bit_identical',changedEndpoints===0,{vertices:endpoints});
check('only_edges_move_and_section_size_preserved_with_float_roundoff',changedEdges>0&&maxSectionRadiusDifference<3e-6,{changedEdges,maxSectionRadiusDifferenceMetres:maxSectionRadiusDifference});
check('wind_shader_and_all_wind_attributes_unchanged',vegetationWindGLSL===baselineWind&&lockedNames.filter(n=>n.startsWith('a')).every(n=>bytes(candidate.attributes[n].array).equals(bytes(legacy.attributes[n].array))));
const shaderDifferences=[];
for(let i=0;i<old.children.length;i++)for(const pass of ['material','customDepthMaterial']){
  const library=THREE.ShaderLib[pass==='material'?'standard':'depth'],make=material=>{const shader={uniforms:{},vertexShader:library.vertexShader,fragmentShader:library.fragmentShader};material.onBeforeCompile(shader);return shader;};
  const baselineShader=make(old.children[i][pass]),currentShader=make(grove.children[i][pass]);
  if(baselineShader.vertexShader!==currentShader.vertexShader||baselineShader.fragmentShader!==currentShader.fragmentShader)shaderDifferences.push(`${i}.${pass}`);
}
check('all_visible_and_depth_shader_sources_unchanged',shaderDifferences.length===0,{shaderDifferences});
function frameStats(g){
  const n=g.attributes.normal.array,t=g.attributes.tangent.array;let nonFinite=0,maxNormalError=0,maxTangentError=0,maxDot=0,badHandedness=0;
  for(let i=0,j=0;i<n.length;i+=3,j+=4){const nx=n[i],ny=n[i+1],nz=n[i+2],tx=t[j],ty=t[j+1],tz=t[j+2];for(const v of [nx,ny,nz,tx,ty,tz])if(!Number.isFinite(v))nonFinite++;maxNormalError=Math.max(maxNormalError,Math.abs(Math.hypot(nx,ny,nz)-1));maxTangentError=Math.max(maxTangentError,Math.abs(Math.hypot(tx,ty,tz)-1));maxDot=Math.max(maxDot,Math.abs(nx*tx+ny*ty+nz*tz));if(Math.abs(t[j+3])!==1)badHandedness++;}
  return {nonFinite,maxNormalError,maxTangentError,maxDot,badHandedness};
}
const frames=frameStats(candidate);check('candidate_normals_tangents_are_finite_unit_orthogonal',frames.nonFinite===0&&frames.badHandedness===0&&frames.maxNormalError<1e-6&&frames.maxTangentError<1e-6&&frames.maxDot<1e-6,frames);
let badTriangles=0,surfaceLegacy=0,surfaceTransport=0;
for(let i=0;i<legacy.index.array.length;i+=3){
  const indices=[legacy.index.array[i],legacy.index.array[i+1],legacy.index.array[i+2]];
  for(const [mode,p]of [[0,a],[1,b]]){const ia=indices[0]*3,ib=indices[1]*3,ic=indices[2]*3,x=p[ib]-p[ia],y=p[ib+1]-p[ia+1],z=p[ib+2]-p[ia+2],u=p[ic]-p[ia],v=p[ic+1]-p[ia+1],w=p[ic+2]-p[ia+2],cx=y*w-z*v,cy=z*u-x*w,cz=x*v-y*u,cross2=cx*cx+cy*cy+cz*cz,edges=(x*x+y*y+z*z)*(u*u+v*v+w*w);if(mode===1&&!(cross2>Math.max(1e-18,edges*1e-12)))badTriangles++;if(mode===0)surfaceLegacy+=Math.sqrt(cross2)*.5;else surfaceTransport+=Math.sqrt(cross2)*.5;}
}
check('unchanged_topology_has_no_new_degenerate_faces',badTriangles===0,{badTriangles,surfaceAreaLegacyMetres2:surfaceLegacy,surfaceAreaTransportMetres2:surfaceTransport,areaChangePercent:100*(surfaceTransport/surfaceLegacy-1)});
const syntheticFallback=sectionRotation(THREE,new THREE.Vector3(1,0,0),new THREE.Vector3(1,0,0),0,new THREE.Vector3(0,0,1),new THREE.Vector3(0,1,0));
check('parallel_projection_uses_explicit_fallback',syntheticFallback.valid===false&&syntheticFallback.reason.includes('parallel'));
const originalTriangle=new Float32Array([0,0,0,1,0,0,0,0,1]),invalidTriangle=new Float32Array(9),syntheticRecords=[0,3,1,0,0,0,1,0,0,0,1];
const fallback=fallbackDegeneratePinnae(invalidTriangle,originalTriangle,new Uint16Array([0,1,2]),syntheticRecords);
check('bad_float32_triangle_falls_back_whole_leaf_without_index_edit',fallback.degenerateFallbackLeaves===1&&bytes(invalidTriangle).equals(bytes(originalTriangle)));
grove.userData.setPalmFrameMode('legacy');check('legacy_rollback_restores_original_buffer_objects',grove.children.find(m=>m.name==='Folded coconut pinnae').geometry===legacy&&grove.userData.palmFrameMode==='legacy');
let invalidModeRejected=false;try{grove.userData.setPalmFrameMode('full-botany');}catch{invalidModeRejected=true;}check('invalid_mode_rejected',invalidModeRejected);

// Deterministically sample real triangles for twelve actual perspective views.
// The unoccluded projected area is a coverage diagnostic, not a raster mask.
const triCount=legacy.index.array.length/3,sampleCount=16384,projection=[];let seed=7193;
const sampleIds=Array.from({length:sampleCount},()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return Math.floor(seed/4294967296*triCount)*3;});
for(const elevation of [5,25,65])for(const azimuth of [0,90,180,270]){
  const e=elevation*Math.PI/180,z=azimuth*Math.PI/180,camera=new THREE.PerspectiveCamera(50,1209/1292,.1,24000);camera.filmGauge=36;camera.setFocalLength(28);camera.position.set(-6+60*Math.cos(e)*Math.sin(z),8+60*Math.sin(e),-4+60*Math.cos(e)*Math.cos(z));camera.lookAt(-6,8,-4);camera.updateMatrixWorld();
  const m=new THREE.Matrix4().multiplyMatrices(camera.projectionMatrix,camera.matrixWorldInverse).elements,stats=[];
  for(const p of [a,b]){let projectedArea=0,subPixel=0,screen=0;for(const j of sampleIds){const xy=[];for(let k=0;k<3;k++){const i=legacy.index.array[j+k]*3,x=p[i],y=p[i+1],q=p[i+2],w=m[3]*x+m[7]*y+m[11]*q+m[15];xy.push((m[0]*x+m[4]*y+m[8]*q+m[12])/w*604.5,(m[1]*x+m[5]*y+m[9]*q+m[13])/w*646);}
    const area=Math.abs((xy[2]-xy[0])*(xy[5]-xy[1])-(xy[3]-xy[1])*(xy[4]-xy[0]))*.5;projectedArea+=area;if(area<1)subPixel++;if(xy.every((v,k)=>Math.abs(v)<(k%2?646:604.5)))screen++;}
    stats.push({estimatedUnoccludedTriangleAreaPixels:projectedArea*triCount/sampleCount,fractionTrianglesUnderOnePixel:subPixel/sampleCount,fractionSampledTrianglesInsideViewport:screen/sampleCount});}
  projection.push({elevation,azimuth,camera:camera.position.toArray(),target:[-6,8,-4],focalMm:28,viewport:[1209,1292],sampledTriangles:sampleCount,legacy:stats[0],transport:stats[1],projectedAreaRatio:stats[1].estimatedUnoccludedTriangleAreaPixels/stats[0].estimatedUnoccludedTriangleAreaPixels});
}
check('twelve_direction_projection_preparation_finite',projection.length===12&&projection.every(v=>Number.isFinite(v.projectedAreaRatio)&&v.projectedAreaRatio>0));
const report={date:new Date().toISOString(),status:checks.every(c=>c.passed)?'passed':'failed',summary:{passed:checks.filter(c=>c.passed).length,total:checks.length},baselineHash,candidateHash:hash(fs.readFileSync(new URL('../vegetation.js',import.meta.url))),helperHash:hash(fs.readFileSync(new URL('../palm-frame.js',import.meta.url))),checks,diagnostics:grove.userData.palmFrameDiagnostics(),initializationFixtureMs:{baseline:old.userData.diagnostics().initializationMs,dualVariant:grove.userData.diagnostics().initializationMs,warning:'Single sequential constructor observations; cold/warm order differs and this is not a startup-overhead benchmark'},projectedViews:projection,totalProcessMs:performance.now()-started,limits:['CPU buffers and sampled unoccluded projected triangle area; actual raster silhouette/overdraw/beauty/GPU cost require root A/B','Candidate only changes cross-section geometry; not full botanical rachis twist and no additional distal roll','Do not infer performance from this fixture process time']};
fs.writeFileSync(new URL('./palm-frame-check.json',import.meta.url),JSON.stringify(report,null,2));console.log(JSON.stringify({status:report.status,summary:report.summary,failed:checks.filter(c=>!c.passed),diagnostics:report.diagnostics,projectedAreaRatios:projection.map(v=>({elevation:v.elevation,azimuth:v.azimuth,ratio:v.projectedAreaRatio})),candidateHash:report.candidateHash,helperHash:report.helperHash,totalProcessMs:report.totalProcessMs}));old.userData.dispose();grove.userData.dispose();if(report.status!=='passed')process.exitCode=1;
