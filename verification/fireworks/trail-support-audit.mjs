// Mathematical audit of actual CPU-uploaded runtime attributes. No GPU/video
// claim. Frozen time / camera from root's reported inspection viewpoint.
import * as THREE from '../../vendor/three.module.js';
import {createFireworks} from '../../fireworks.js';
import {readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
const effect=createFireworks(THREE,{terrainHeight:()=>0});effect.setQuality({trailSegments:8});effect.update({time:0,windVector:[5,0,1]});effect.launch({type:'chrysanthemum'});effect.update({time:7.2,windVector:[5,0,1]});
const camera=new THREE.PerspectiveCamera(48,1209/1292,.1,30000);camera.position.set(-176,155,-119);camera.lookAt(65,124,17);camera.updateMatrixWorld();let target=null;
const renderer={autoClear:true,shadowMap:{autoUpdate:true,needsUpdate:false},getRenderTarget:()=>target,getActiveCubeFace:()=>0,getActiveMipmapLevel:()=>0,setRenderTarget:t=>{target=t;},render(){}};
effect.render({renderer,target:{width:1209,height:1292},camera,frame:{sceneScale:1,rawPerCandela:3.6e-5},optics:{shutterSeconds:1/120},air:{enabled:false}});
const g=effect.effectsScene.children[0].geometry,s=g.getAttribute('aStretch').array,v=g.getAttribute('aVelocity').array,c=g.getAttribute('aCentre').array,ratios=[],screenRatios=[];let opposed=0;
const project=p=>new THREE.Vector3(...p).project(camera).multiply(new THREE.Vector3(1209/2,1292/2,0));
for(let i=0;i<g.instanceCount;i++){const j=i*3,S=[s[j],s[j+1],s[j+2]],M=[v[j]/120,v[j+1]/120,v[j+2]/120],C=[c[j],c[j+1],c[j+2]],ls=Math.hypot(...S),lm=Math.hypot(...M);if(ls<1e-7)continue;
  const cosine=S.reduce((a,x,k)=>a+x*M[k],0)/(ls*lm);if(cosine<-.5)opposed++;ratios.push(Math.hypot(...S.map((x,k)=>x+M[k]))/(ls+lm));
  const span=D=>project(C.map((x,k)=>x+D[k]/2)).distanceTo(project(C.map((x,k)=>x-D[k]/2)));
  screenRatios.push(span(S.map((x,k)=>x+M[k]))/Math.max(1e-12,span(S)+span(M)));
}
const stats=xs=>{xs.sort((a,b)=>a-b);return{min:xs[0],median:xs[Math.floor(xs.length*.5)],p90:xs[Math.floor(xs.length*.9)]};};
const report={date:new Date().toISOString(),scope:'CPU actual runtime instance attributes, no browser replay; look target approximate reported view',sourceSHA256:createHash('sha256').update(await readFile(new URL('../../fireworks.js',import.meta.url))).digest('hex'),time:7.2,trailSegments:8,camera:[-176,155,-119],target:[65,124,17],records:ratios.length,opposedVelocityDotBelowMinusHalf:opposed,worldSupportCombinedOverIndependent:stats(ratios),screenSupportCombinedOverIndependent:stats(screenRatios),interpretation:'Current spatial tail tangent and short-shutter velocity are anti-aligned. Adding vectors can shorten support; true independent convolutions do not cancel. This supports a controlled A/B, not a unique diagnosis of screenshot appearance.'};
effect.dispose();await writeFile(new URL('./trail-support-audit.json',import.meta.url),JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));
