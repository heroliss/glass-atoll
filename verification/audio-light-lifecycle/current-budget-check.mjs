// Independent current-contract check; historical byte-exact tests stay intact.
import fs from 'node:fs';
import {createHash} from 'node:crypto';
import {fileURLToPath,pathToFileURL} from 'node:url';
import * as THREE from '../../vendor/three.module.js';
import {createLocalLights,localLightGLSL,LOCAL_LIGHT_COUNT} from '../../local-lights.js';
import {FIREWORK_RECEIVER_LIGHT_COUNT} from '../../firework-receiver-lighting.js';
import {createPyroSmokeRenderer} from '../../pyro-smoke-renderer.js';
import {packSmokeLightPackets} from '../../pyro-smoke-light-field.js';
const sha=value=>createHash('sha256').update(value).digest('hex');
export function runCurrentBudgetCheck(){
  const checks=[],check=(name,passed,evidence={})=>checks.push({name,passed:!!passed,evidence});
  const renderer={autoClear:true,shadowMap:{autoUpdate:true,needsUpdate:true},material:null,geometry:null,getRenderTarget:()=>null,getActiveCubeFace:()=>0,getActiveMipmapLevel:()=>0,getViewport:o=>o.set(0,0,16,16),getScissor:o=>o.set(0,0,16,16),getScissorTest:()=>false,setRenderTarget(){},setViewport(){},setScissor(){},setScissorTest(){},render(scene){this.material=scene.children[0].material;this.geometry=scene.children[0].geometry;}};
  const camera=new THREE.PerspectiveCamera(50,1,.1,100);camera.position.set(0,2,0);camera.lookAt(0,2,-5);camera.updateMatrixWorld();
  const local=createLocalLights(THREE,{scene:new THREE.Scene()}),volume=createPyroSmokeRenderer(THREE,renderer),depth=new THREE.DataTexture(new Float32Array([1]),1,1,THREE.RedFormat,THREE.FloatType);
  const textures=Array.from({length:3},()=>new THREE.DataTexture(new Float32Array([.2,.01,.02,.03]),1,1,THREE.RGBAFormat,THREE.FloatType));
  const snapshot={revision:1,profiles:[{id:'reference',extinctionPerMassRGB:[1,1,1],singleScatteringAlbedoRGB:[1,1,1]}],packets:[{id:1,profileId:'reference',mass:.2,mean:[0,2,-5],covariance:[.0144,0,0,0,.0144,0,0,0,.0144]}]};
  const field={enabled:true,snapshot,snapshotRevision:1,packedPackets:packSmokeLightPackets(snapshot),textures,size:{width:1,height:1,count:1},getRadianceBound:()=>({maxRGB:2}),diagnostics:()=>({anisotropy:.32,version:1,effective:true,supported:true})};
  const base={target:{width:16,height:16},camera,opaqueDepth:depth,frame:{storageEV:0,sceneScale:1},lighting:{},localLighting:local};
  let defaultFragment='',resolvedFragment='',defaultMeta=null,resolvedMeta=null;
  try{
    local.configure({mode:'off'});local.update({frame:{time:0,dt:1/60,storageEV:0,sceneScale:1},camera,sunAltitude:-10,clusters:Array.from({length:FIREWORK_RECEIVER_LIGHT_COUNT},(_,i)=>({position:[i*.8-6,3,-5-i*.2],radius:.1,referenceCandela:1000+i,color:[1,.2,.1]}))});local.setSceneExposure(0);volume.setState(snapshot);
    check('current budget is four non-pyro plus sixteen firework slots',LOCAL_LIGHT_COUNT===20&&FIREWORK_RECEIVER_LIGHT_COUNT===16&&local.records.length===20,{shared:LOCAL_LIGHT_COUNT,firework:FIREWORK_RECEIVER_LIGHT_COUNT,actualRecords:local.records.length});
    const arrays=['uLocalPosition','uLocalColour','uLocalDirection','uLocalCone'];check('all actual borrowed vec4 arrays contain twenty entries',arrays.every(n=>local.uniforms[n].value.length===20),Object.fromEntries(arrays.map(n=>[n,local.uniforms[n].value.length])));
    check('shared localIncident declarations and summation use twenty',localLightGLSL.includes('uLocalPosition[20]')&&localLightGLSL.includes('uLocalColour[20]')&&localLightGLSL.includes('for(int i=0;i<20;i++){if('),{shaderSHA256:sha(localLightGLSL)});
    defaultMeta=volume.render(base);defaultFragment=renderer.material.fragmentShader;
    check('actual default smoke material uses all twenty local sources',defaultFragment.includes('if(uUseLocalLighting>.5){vec3 worldPoint=uEye+point;for(int i=0;i<20;i++){vec3 L;')&&defaultMeta.localLightingSources===20&&defaultMeta.legacyClusterSources===0,{meta:defaultMeta,fragmentSHA256:sha(defaultFragment)});
    check('last firework slot is populated in actual borrowed uniforms',local.records[19].rawRGB[0]>0&&renderer.material.uniforms.uLocalColour===local.uniforms.uLocalColour&&renderer.material.uniforms.uLocalColour.value[19].x===local.records[19].rawRGB[0],{raw:lastRaw(local),stored:local.uniforms.uLocalColour.value[19].toArray()});
    const legacyBound=volume.getRadianceBound({},{localLighting:local});
    volume.setResolvedLightingField(field);resolvedMeta=volume.render(base);resolvedFragment=renderer.material.fragmentShader;
    const resolvedBound=volume.getRadianceBound({},{localLighting:local});
    check('actual resolved material retains exactly four non-pyro direct sources',resolvedFragment.includes('if(uUseLocalLighting>.5){vec3 worldPoint=uEye+point;for(int i=0;i<4;i++){vec3 L;')&&!resolvedFragment.includes('if(uUseLocalLighting>.5){vec3 worldPoint=uEye+point;for(int i=0;i<20;i++){vec3 L;')&&resolvedMeta.localLightingSources===4,{meta:resolvedMeta,fragmentSHA256:sha(resolvedFragment)});
    check('resolved field disables legacy cluster loop and counts field once',resolvedFragment.includes('else{for(int i=0;i<0;i++){vec3 delta=')&&resolvedMeta.legacyClusterSources===0&&resolvedMeta.resolvedPyroField&&resolvedFragment.split('source+=vec3(vResolvedR.x+dot(').length===2,{meta:resolvedMeta});
    check('resolved bound excludes every pyro proxy including last slot',legacyBound.maxRGB>2&&resolvedBound.maxRGB===2&&resolvedBound.resolvedPyroField,{legacy:legacyBound,resolved:resolvedBound});
    const before=resolvedBound.maxRGB;for(let i=4;i<local.records.length;i++)local.records[i].rawRGB=local.records[i].rawRGB.map(v=>v*1e6);local.setSceneExposure(0);const hugePyroBound=volume.getRadianceBound({},{localLighting:local});
    check('millionfold increase in all pyro proxy records leaves resolved raw bound unchanged',hugePyroBound.maxRGB===before,{before,after:hugePyroBound.maxRGB,lastRaw:lastRaw(local)});
    volume.setResolvedLightingField(null);const restored=volume.render(base);check('disabling field restores exact current twenty-source material',renderer.material.fragmentShader===defaultFragment&&restored.localLightingSources===20&&restored.legacyClusterSources===0,{meta:restored});
  }catch(error){check('actual current-contract factories complete',false,{error:String(error.stack||error)});}
  finally{volume.dispose();local.dispose();depth.dispose();textures.forEach(t=>t.dispose());}
  return{schema:'glass-atoll.current-smoke-light-budget.v1',dateUTC:new Date().toISOString(),passed:checks.every(c=>c.passed),checks,noGPU:true,sourceHashes:Object.fromEntries(['local-lights.js','firework-receiver-lighting.js','pyro-smoke-renderer.js','pyro-smoke-light-field.js'].map(file=>[file,sha(fs.readFileSync(new URL('../../'+file,import.meta.url)))])),limits:['Actual production factories and selected shader materials exercised through a stub render call; no GL execution, pixels, or performance evidence.','This check verifies the current twenty/four source contract. Historical byte-exact shader snapshots and normalizers are retained and may fail their obsolete six-source baseline.']};
}
function lastRaw(local){return[...local.records.at(-1).rawRGB];}
if(process.argv[1]&&pathToFileURL(process.argv[1]).href===import.meta.url){const report=runCurrentBudgetCheck();fs.writeFileSync(fileURLToPath(new URL('current-budget-check.json',import.meta.url)),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({passed:report.passed,checks:report.checks},null,2));if(!report.passed)process.exitCode=1;}
