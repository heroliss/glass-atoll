// Read-only production source audit. Candidate functions exist only inside
// data-URL QA modules; fireworks.js and physics are never overwritten.
import * as THREE from '../../vendor/three.module.js';
import {readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {performance} from 'node:perf_hooks';
const source=await readFile(new URL('../../fireworks.js',import.meta.url),'utf8'),physicsURL=new URL('../../fireworks-physics.js',import.meta.url).href;
const start=source.indexOf('  function fillRecords('),end=source.indexOf('\n  const api=',start),original=source.slice(start,end);
if(start<0||end<0)throw new Error('Production fillRecords not found');
const temporal='for(let k=0;k<8;k++){const age=p.sourceAge+((k+.5)/8-.5)*shutter,body=p.sourceBody;const weight=!body?1:body.kind===\'rocket\'?(age>=0&&age<body.life?1:0):starEnvelope(body,age);arrays[k<4?\'temporal0\':\'temporal1\'][i*4+(k%4)]=weight;}';
if(!original.includes(temporal))throw new Error('Production temporal packing changed');
const zeroTemporal=`if(shutter===0){const body=p.sourceBody,age=p.sourceAge,weight=!body?1:body.kind==='rocket'?(age>=0&&age<body.life?1:0):starEnvelope(body,age);for(let k=0;k<4;k++){arrays.temporal0[i*4+k]=weight;arrays.temporal1[i*4+k]=weight;}}else{${temporal}}`;
const optimized=`  const qaOrder=[],qaDepth=new Float64Array(capacity);
  function fillRecords(camera,air,rawPerCandela,shutter){
    camera.updateMatrixWorld();const eye=camera.position.toArray(),V=camera.matrixWorldInverse.elements,n=records.length,clusters=getLightClusters();
    if(n>capacity)throw new Error('Finite effects instance capacity exceeded without deleting logical heads.');
    qaOrder.length=n;for(let i=0;i<n;i++){const p=records[i].position,x=p[0],y=p[1],z=p[2],w=1/(V[3]*x+V[7]*y+V[11]*z+V[15]);qaOrder[i]=i;qaDepth[i]=(V[2]*x+V[6]*y+V[10]*z+V[14])*w;}qaOrder.sort((a,b)=>qaDepth[a]-qaDepth[b]);
    for(let i=0;i<n;i++){
      const p=records[qaOrder[i]],smoke=p.kind==='smoke',j=i*3,k=i*4;arrays.centre.set(p.position,j);arrays.colour.set(p.colour,j);
      if(p.velocity)arrays.velocity.set(p.velocity,j);else{arrays.velocity[j]=0;arrays.velocity[j+1]=0;arrays.velocity[j+2]=0;}
      if(p.stretch)arrays.stretch.set(p.stretch,j);else{arrays.stretch[j]=0;arrays.stretch[j+1]=0;arrays.stretch[j+2]=0;}
      if(smoke)arrays.smokeLight.set(smokeLighting(p,eye,air,rawPerCandela,clusters),j);else{arrays.smokeLight[j]=0;arrays.smokeLight[j+1]=0;arrays.smokeLight[j+2]=0;}
      arrays.shape[k]=smoke?1:0;arrays.shape[k+1]=p.radius;arrays.shape[k+2]=p.unmodulatedIntensity??p.intensity??0;arrays.shape[k+3]=p.opticalDepth||0;
      ${zeroTemporal}
    }
    geometry.instanceCount=n;for(const name of Object.keys(attributes)){const a=geometry.getAttribute('a'+name[0].toUpperCase()+name.slice(1));a.clearUpdateRanges();a.addUpdateRange(0,n*a.itemSize);a.needsUpdate=true;}return n;
  }`;
const fakeRenderer={autoClear:false,shadowMap:{autoUpdate:false,needsUpdate:false},getRenderTarget:()=>null,getActiveCubeFace:()=>0,getActiveMipmapLevel:()=>0,setRenderTarget(){},render(){}};
const camera=new THREE.PerspectiveCamera(48,1209/1292,.1,30000),mirror=camera.clone();camera.position.set(-188,12,-126);camera.lookAt(40,130,0);camera.updateMatrixWorld();mirror.position.set(-188,-12,-126);mirror.lookAt(40,130,0);mirror.updateMatrixWorld();
const variants=[['production',original],['zeroShutterOnly',original.replace(temporal,zeroTemporal)],['zeroShutterScalarPackRange',optimized]],reports=[],snapshots=[];
for(const [name,fn]of variants){
  const code=source.slice(0,start)+fn+source.slice(end),module=await import('data:text/javascript;base64,'+Buffer.from(code.replace("'./fireworks-physics.js'",JSON.stringify(physicsURL))+'\n//'+name).toString('base64'));
  const effect=module.createFireworks(THREE,{origin:[29,0,7],terrainHeight:()=>0,seed:14271});effect.setQuality({trailSegments:8});effect.update({time:0,windVector:[1.8,0,0]});effect.launch({type:'chrysanthemum'});effect.launch({type:'chrysanthemum'});
  for(let i=0;i<=315;i++){const time=3.2+4*i/315,wind=1.8+3.2*(1-Math.exp(-(time-3.2)/1.4));effect.update({time,windVector:[wind,0,0]});}
  const draw=(reflection)=>effect.render({renderer:fakeRenderer,camera:reflection?mirror:camera,reflection,frame:{storageEV:0,rawPerCandela:3.6e-5},optics:{width:1209,height:1292,shutterSeconds:1/120},air:{enabled:false}});
  const samples=[];for(let i=0;i<180;i++){const a=performance.now();draw(true);const b=performance.now();draw(false);const c=performance.now();if(i>=40)samples.push({mirrorMs:b-a,mainMs:c-b,totalMs:c-a});}
  const snapshot=[];for(const reflection of [true,false]){draw(reflection);const g=effect.effectsScene.children[0].geometry,n=g.instanceCount;const attrs={};for(const [key,a]of Object.entries(g.attributes))if(a.isInstancedBufferAttribute)attrs[key]=a.array.slice(0,n*a.itemSize);snapshot.push(attrs);}snapshots.push(snapshot);
  const sorted=samples.map(s=>s.totalMs).sort((a,b)=>a-b),q=p=>sorted[Math.min(sorted.length-1,Math.ceil(p*sorted.length)-1)],g=effect.effectsScene.children[0].geometry,capacityBytes=Object.values(g.attributes).filter(a=>a.isInstancedBufferAttribute).reduce((s,a)=>s+a.array.byteLength,0),usedBytes=Object.values(g.attributes).filter(a=>a.isInstancedBufferAttribute).reduce((s,a)=>s+a.itemSize*4*g.instanceCount,0);
  reports.push({name,records:g.instanceCount,windSegments:effect.diagnostics().windSegments,meanMirrorMs:samples.reduce((s,x)=>s+x.mirrorMs,0)/samples.length,meanMainMs:samples.reduce((s,x)=>s+x.mainMs,0)/samples.length,meanTotalMs:samples.reduce((s,x)=>s+x.totalMs,0)/samples.length,p95TotalMs:q(.95),p99TotalMs:q(.99),capacityBytesPerCamera:capacityBytes,usedBytesPerCamera:usedBytes,scope:'Node repeated fillRecords via actual render wiring; no GL calls/uploads/GPU/frame FPS; per-physical-frame update intentionally excluded'});effect.dispose();
}
const equality=snapshots.slice(1).map((s,index)=>{let differing=0;for(let view=0;view<2;view++)for(const key of Object.keys(s[view])){const a=snapshots[0][view][key],b=s[view][key];for(let i=0;i<a.length;i++)if(!Object.is(a[i],b[i]))differing++;}return{candidate:variants[index+1][0],bitwiseDifferentFloat32Values:differing,passed:differing===0};});
const report={date:new Date().toISOString(),sourceSHA256:createHash('sha256').update(source).digest('hex'),passed:equality.every(e=>e.passed),reports,equality,limits:'read-only QA candidates, not runtime changes or browser frame profiling; partial ranges save bytes only if actual renderer performs bufferSubData ranges; camera depth order remains independently sorted'};
await writeFile(new URL('./packing-cpu-audit.json',import.meta.url),JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));
