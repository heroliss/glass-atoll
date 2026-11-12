import fs from 'node:fs';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import * as THREE from '../../vendor/three.module.js';

const root=new URL('../../',import.meta.url),folder=new URL('dynamic-local-loop/',import.meta.url);
const manifest=JSON.parse(fs.readFileSync(new URL('manifest.json',folder),'utf8'));
const read=name=>fs.readFileSync(new URL(name,folder),'utf8');
const checks=[];
const sha=text=>crypto.createHash('sha256').update(text).digest('hex');
function check(name,fn){try{checks.push({name,passed:true,evidence:fn()});}catch(e){checks.push({name,passed:false,error:e.stack});}}
async function loadLocal(name){const source=read(name),loaded=source.replace(/from (['"])(\.\/[^'"\s]+)\1/g,(_,q,p)=>`from '${new URL(p.slice(2),root).href}'`);return import('data:text/javascript;base64,'+Buffer.from(loaded).toString('base64'));}
const native=await loadLocal('local-lights.js'),diffuse=await loadLocal('local-lights-diffuse-chunk.js');

check('all candidate JavaScript modules parse and production source pins are unchanged',()=>{
  for(const entry of manifest.files){const input=fs.readFileSync(new URL(entry.input,root),'utf8'),candidate=read(entry.output);assert.equal(sha(input),entry.sourceSHA256);assert.equal(sha(candidate),entry.candidateSHA256);execFileSync(process.execPath,['--check',fileURLToPath(new URL(entry.output,folder))],{stdio:'pipe'});}
  return {files:manifest.files.length,productionHashesUnchanged:true};
});
check('native20 and diffuse4 keep fixed arrays20 and a genuine uniform upper loop bound',()=>{
  for(const module of [native,diffuse]){assert.equal(module.LOCAL_LIGHT_COUNT,20);assert(module.localLightGLSL.includes('uniform int uLocalSourceCount;'));for(const name of ['uLocalPosition','uLocalColour','uLocalDirection','uLocalCone'])assert(module.localLightGLSL.includes(name+'[20]'));assert(module.localLightGLSL.includes('for(int i=0;i<uLocalSourceCount;i++)'));assert(module.localLightGLSL.includes('for(int i=4;i<uLocalSourceCount;i++)'));assert(!/for\(int i=[04];i<20;i\+\+\)/.test(module.localLightGLSL));}
  return {uniformUpperBound:true,fixedArrayLength:20};
});
check('real local factories retain 16 firework slots, shared values and exact extinction',()=>{
  const evidence=[];
  for(const [name,module,nativeCount]of [['native20',native,20],['diffuse4',diffuse,4]]){
    const scene=new THREE.Scene(),camera=new THREE.PerspectiveCamera(),local=module.createLocalLights(THREE,{scene});
    try{assert.equal(local.uniforms.uLocalSourceCount.value,20);assert.equal(local.records.length,20);for(const uniform of ['uLocalPosition','uLocalColour','uLocalDirection','uLocalCone'])assert.equal(local.uniforms[uniform].value.length,20);assert.equal(scene.children.filter(x=>x.isLight).length,nativeCount);local.configure({mode:'off'});const clusters=Array.from({length:16},(_,i)=>({position:[i,20+i,10],radius:.1,color:[.2,.6,1],referenceCandela:100+i}));local.update({frame:{time:0,dt:1/60,sceneScale:.5,rawPerCandela:3.6e-5},camera,clusters});for(let i=4;i<20;i++)for(let c=0;c<3;c++)assert.equal(local.uniforms.uLocalColour.value[i].getComponent(c),local.records[i].rawRGB[c]*.5);local.update({frame:{time:1,dt:1/60,sceneScale:.5,rawPerCandela:3.6e-5},camera,clusters:[]});assert(local.records.slice(4).every(r=>r.candela===0&&r.rawRGB.every(v=>v===0)));assert.equal(local.uniforms.uLocalSourceCount.value,20);evidence.push({variant:name,nativeCount,fireworkSlots:16,extinctionZero:true});}finally{local.dispose();}
  }
  return evidence;
});
check('real Standard shader hooks share the uniform and use dynamic thin/diffuse loops',()=>{
  const evidence=[];
  for(const [name,module,isDiffuse]of [['native20',native,false],['diffuse4',diffuse,true]]){
    const scene=new THREE.Scene(),local=module.createLocalLights(THREE,{scene}),material=new THREE.MeshStandardMaterial(),shader={uniforms:{},vertexShader:THREE.ShaderLib.standard.vertexShader,fragmentShader:'uniform float uGroveTransmissionBudget;\n'+THREE.ShaderLib.standard.fragmentShader};
    try{local.apply(material);material.onBeforeCompile(shader,{});assert.equal(shader.uniforms.uLocalSourceCount,local.uniforms.uLocalSourceCount);assert(shader.fragmentShader.includes('for(int localId=0;localId<uLocalSourceCount;localId++)'));if(isDiffuse)assert(shader.fragmentShader.includes('for(int fireworkId=4;fireworkId<uLocalSourceCount;fireworkId++)'));evidence.push({variant:name,dynamicThinTransmission:true,dynamicDiffuse:isDiffuse});}finally{material.dispose();local.dispose();}
  }
  return evidence;
});
check('water only changes the shared local source loop and still borrows its uniform',()=>{
  const source=read('water.js'),original=fs.readFileSync(new URL('water.js',root),'utf8');
  assert.equal(source.replace('for(int i=0;i<uLocalSourceCount;i++)','for(int i=0;i<${LOCAL_LIGHT_COUNT};i++)'),original);
  assert(source.includes('if(localLights)Object.assign(uniforms,localLights.uniforms)'));
  assert(source.includes('for(int k=0;k<3;k++)'));
  return {changedLoops:1,newtonIterations:3,borrowedUniform:true};
});
check('aerial changes exactly three local loops and retains eight-cell integration',()=>{
  const source=read('aerial-perspective.js'),original=fs.readFileSync(new URL('aerial-perspective.js',root),'utf8');
  assert.equal(source.split('for(int i=0;i<uLocalSourceCount;i++)').length-1,3);
  assert.equal(source.split('for(int i=0;i<uLocalSourceCount;i++)').join('for(int i=0;i<${LOCAL_LIGHT_COUNT};i++)'),original);
  assert(source.includes('...(hasLocalLights?localLights.uniforms:{})'));
  assert.equal(source.split('for(int i=0;i<8;i++)').length-1,2);
  return {changedLoops:3,integrationLoops:2,cells:8,borrowedUniform:true};
});
check('smoke borrows/defaults count20 while the resolved field remains exactly four sources',()=>{
  const source=read('pyro-smoke-renderer.js');
  assert(source.includes("const localUniformNames=['uLocalSourceCount','uLocalPosition'"));
  assert(source.includes('const localDefaults={uLocalSourceCount:{value:LOCAL_LIGHT_COUNT},'));
  assert.equal(source.split('for(int i=0;i<uLocalSourceCount;i++){vec3 L;').length-1,2);
  assert(source.includes(".replace(`for(int i=0;i<uLocalSourceCount;i++){vec3 L;`,'for(int i=0;i<4;i++){vec3 L;')"));
  let restored=source.replace("const localUniformNames=['uLocalSourceCount','uLocalPosition'","const localUniformNames=['uLocalPosition'").replace('const localDefaults={uLocalSourceCount:{value:LOCAL_LIGHT_COUNT},','const localDefaults={').split('for(int i=0;i<uLocalSourceCount;i++){vec3 L;').join('for(int i=0;i<${LOCAL_LIGHT_COUNT};i++){vec3 L;');
  assert.equal(restored,fs.readFileSync(new URL('pyro-smoke-renderer.js',root),'utf8'));
  return {defaultSources:20,resolvedSources:4,borrowedUniform:true,defaultUniform:true};
});

const report={schema:'glass-atoll.dynamic-local-loop-preflight.v1',passed:checks.every(x=>x.passed),checks,actualGPU:false,routeVariants:manifest.variants,limits:['Production is unchanged.','These checks cover source assembly, real CPU factories, shared uniform values and existing semantics; they do not establish ANGLE behavior, shader compile time, frame time, pixels or audio quality.','Dynamic upper bounds remain exactly20; source count and physical receiver proxy values are preserved.']};
fs.writeFileSync(new URL('dynamic-local-loop-preflight.json',import.meta.url),JSON.stringify(report,null,2));
console.log(JSON.stringify(report,null,2));
if(!report.passed)process.exitCode=1;
