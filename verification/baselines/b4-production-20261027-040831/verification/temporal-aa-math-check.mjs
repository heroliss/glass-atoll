import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {fileURLToPath} from 'node:url';
import * as THREE from '../vendor/three.module.js';
import {createVegetation,vegetationWindGLSL} from '../vegetation.js';
import {createVegetation as beforeVegetation,vegetationWindGLSL as beforeWind} from './baselines/vegetation-before-temporal-aa.js';
const here=path.dirname(fileURLToPath(import.meta.url)),root=path.dirname(here),source=fs.readFileSync(path.join(root,'lens.js'),'utf8');
const declaration=source.match(/export function temporalJitterSample\(index\)\s*\{[\s\S]*?\n\}/)?.[0];
if(!declaration)throw Error('Actual jitter function not found');
const jitter=new Function(declaration.replace(/^export /,'')+';return temporalJitterSample;')();
const checks=[],add=(id,passed,details={})=>checks.push({id,passed:Boolean(passed),...details});
const samples=Array.from({length:8},(_,i)=>jitter(i));
const mean=[0,1].map(k=>samples.reduce((s,p)=>s+p[k],0)/samples.length);
add('finite_jitter_cycle_has_zero_mean',mean.every(v=>Math.abs(v)<1e-12),{mean,samples});
add('jitter_stays_inside_half_pixel_footprint',samples.every(p=>p.every(v=>Number.isFinite(v)&&Math.abs(v)<=.5)),{samples});
add('jitter_sequence_has_eight_unique_samples',new Set(samples.map(p=>p.join(','))).size===8);
add('jitter_sequence_repeats_exactly',samples.every((p,i)=>p.every((v,k)=>v===jitter(i+8)[k])));
// A clip-space shift j*NDC*w must become exactly j pixels after divide by w;
// the projection scale/field of view are not modified.
let maxPixelError=0;
for(const width of [640,1270,1440])for(const w of [.2,20,230])for(const p of samples){
  const clipX=.12*w,shifted=clipX+2*p[0]/width*w;
  maxPixelError=Math.max(maxPixelError,Math.abs((shifted/w-clipX/w)*width*.5-p[0]));
}
add('clip_jitter_is_pixel_sized_at_all_depths',maxPixelError<1e-10,{maxPixelError});
const camera=new THREE.PerspectiveCamera(40,1270/1292,.15,24000);camera.filmGauge=36;camera.setFocalLength(35);camera.position.set(-203.8836,98.7486,11.2666);camera.lookAt(-2.4671,-12.0603,4.0006);camera.updateMatrixWorld();
const vp=new THREE.Matrix4().multiplyMatrices(camera.projectionMatrix,camera.matrixWorldInverse),inverse=vp.clone().invert();
let maxRoundtrip=0;
for(const p of [new THREE.Vector3(0,1,0),new THREE.Vector3(-10,12,-5),new THREE.Vector3(4,8,1)]){
  const clip=new THREE.Vector4(p.x,p.y,p.z,1).applyMatrix4(vp);clip.multiplyScalar(1/clip.w);
  const restored=clip.clone().applyMatrix4(inverse);restored.multiplyScalar(1/restored.w);
  maxRoundtrip=Math.max(maxRoundtrip,p.distanceTo(new THREE.Vector3(restored.x,restored.y,restored.z)));
}
add('user_far_view_camera_depth_reprojection_roundtrip',maxRoundtrip<1e-6,{maxWorldErrorMetres:maxRoundtrip});
const baseline=beforeVegetation(THREE,{terrainHeight:()=>1.2,seed:40219}),current=createVegetation(THREE,{terrainHeight:()=>1.2,seed:40219});
const hash=a=>crypto.createHash('sha256').update(new Uint8Array(a.buffer,a.byteOffset,a.byteLength)).digest('hex');
const geometry=[];
for(let i=0;i<baseline.children.length;i++){
  const a=baseline.children[i],b=current.children[i];
  const attributes=Object.keys(a.geometry.attributes),same=attributes.every(key=>hash(a.geometry.attributes[key].array)===hash(b.geometry.attributes[key].array));
  const sameIndices=hash(a.geometry.index.array)===hash(b.geometry.index.array);
  geometry.push({mesh:a.name,attributes:attributes.length,vertices:a.geometry.attributes.position.count,triangles:a.geometry.index.count/3,attributesIdentical:same,indicesIdentical:sameIndices});
  add('geometry_unchanged_'+i,same&&sameIndices,{mesh:a.name});
}
// Motion capture parameterizes the same analytic body. Canonicalize only the
// named parameter aliases/wrapper and the pre-existing diagnostic multiplier;
// every remaining original character must match, not just a few samples.
const canonicalWind=vegetationWindGLSL
  .replace('  vec3 groveDeform(vec3 p,out mat3 rotation){\n    return groveDeformAt(p,rotation,uGroveTime,uGroveWindStrength,uGroveWindDirection);\n  }\n','')
  .replace('vec3 groveDeformAt(vec3 p,out mat3 rotation,float sampleTime,float sampleWindStrength,vec2 sampleWindDirection)','vec3 groveDeform(vec3 p,out mat3 rotation)')
  .replaceAll('sampleTime','uGroveTime').replaceAll('sampleWindStrength','uGroveWindStrength').replaceAll('sampleWindDirection','uGroveWindDirection')
  .replace('  uniform float uGroveWindDebug;\n','')
  .replace('uGroveWindStrength*uGroveWindDebug','uGroveWindStrength');
const speedExpression=vegetationWindGLSL.match(/float speed=([^;]+);/)[1].replace('sampleWindStrength','uGroveWindStrength');
const priorSpeedExpression=beforeWind.match(/float speed=([^;]+);/)[1];
const speedAt=new Function('uGroveWindStrength','uGroveWindDebug','clamp',`return ${speedExpression};`);
const priorSpeedAt=new Function('uGroveWindStrength','clamp',`return ${priorSpeedExpression};`);
const bounded=(x,a,b)=>Math.max(a,Math.min(b,x));let debugOneError=0,debugZeroError=0;
for(let i=0;i<=1000;i++){const wind=-2+i*.012;debugOneError=Math.max(debugOneError,Math.abs(speedAt(wind,1,bounded)-priorSpeedAt(wind,bounded)));debugZeroError=Math.max(debugZeroError,Math.abs(speedAt(wind,0,bounded)));}
add('physical_wind_debug_one_preserves_complete_baseline',canonicalWind===beforeWind&&debugOneError===0&&current.userData.diagnostics().leafOptics.debug.wind===1,{debugOneError,canonicalSourceIdentical:canonicalWind===beforeWind,defaultDebugWind:current.userData.diagnostics().leafOptics.debug.wind});
add('wind_ablation_zero_has_zero_physical_speed',debugZeroError===0,{debugZeroError,samples:1001,rangeMetresPerSecond:[-2,10]});
add('raster_controls_default_to_inactive',current.userData.temporalAA.active.value===0&&current.userData.temporalAA.jitter.value.lengthSq()===0);
for(const mesh of current.children){
  const shader={uniforms:{},vertexShader:THREE.ShaderLib.standard.vertexShader,fragmentShader:THREE.ShaderLib.standard.fragmentShader};mesh.material.onBeforeCompile(shader);
  const depth={uniforms:{},vertexShader:THREE.ShaderLib.depth.vertexShader,fragmentShader:THREE.ShaderLib.depth.fragmentShader};mesh.customDepthMaterial.onBeforeCompile(depth);
  add('visible_only_jitter_'+mesh.name,shader.vertexShader.includes('gl_Position.xy+=uGroveJitter*gl_Position.w')&&!depth.vertexShader.includes('gl_Position.xy+=uGroveJitter'));
  add('debug_wind_same_in_colour_and_depth_'+mesh.name,shader.vertexShader.includes(vegetationWindGLSL)&&depth.vertexShader.includes(vegetationWindGLSL)&&shader.uniforms.uGroveWindDebug===depth.uniforms.uGroveWindDebug&&shader.uniforms.uGroveWindDebug.value===1);
}
baseline.userData.dispose();current.userData.dispose();
const result={generatedAt:new Date().toISOString(),passed:checks.every(v=>v.passed),passedCount:checks.filter(v=>v.passed).length,total:checks.length,checks,geometry,sourceHashes:Object.fromEntries(['lens.js','vegetation.js','verification/baselines/vegetation-before-temporal-aa.js'].map(name=>[name,crypto.createHash('sha256').update(fs.readFileSync(path.join(root,name))).digest('hex')])),limits:['CPU/source checks do not validate actual GPU alias reduction or absence of temporal ghosting.','Camera-only reprojection omits true moving-object motion vectors; wind response reduces reuse conservatively.','Wind ablation is an explicit diagnostic change: multiplier 1 preserves the complete prior function, multiplier 0 sends visible/depth geometry to its rest pose.']};
fs.writeFileSync(path.join(here,'temporal-aa-math-check.json'),JSON.stringify(result,null,2)+'\n');
console.log(JSON.stringify({passed:result.passed,passedCount:result.passedCount,total:result.total,failures:checks.filter(v=>!v.passed)},null,2));if(!result.passed)process.exitCode=1;
