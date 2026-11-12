// QA-only existing-material toggles. Root owns the small main-scene adapter.
// renderFrame MUST reset temporal history, render water captures and then
// present SDR at the SAME paused physical time under the main QA render lock.
export async function runSplashLayerSceneProbe(THREE,renderer,{scene,camera,getFrameState,renderFrame,includeImages=true}={}){
 if(!scene||!camera||typeof getFrameState!=='function'||typeof renderFrame!=='function')throw new TypeError('Scene/camera and guarded fixed-phase callbacks required');
 const start=structuredClone(getFrameState());if(!start.paused||!Number.isFinite(start.time))throw new Error('Pause at a real splash phase before probing');
 const roots=[];scene.traverse(o=>{if(o.name==='Metric stone-water splashes')roots.push(o);});const meshes=roots.flatMap(r=>r.children.flatMap(e=>e.children)).filter(o=>o.isMesh);
 const crowns=meshes.filter(o=>/crown/i.test(o.name)),drops=meshes.filter(o=>/drop/i.test(o.name));if(!crowns.length||!drops.length)throw new Error('Need live metric crown and droplets; no synthetic replacement is created');
 const visibility=new Map(meshes.map(m=>[m,m.visible])),frames={},images={},checks=[];
 const canvas=document.createElement('canvas');canvas.width=renderer.domElement.width;canvas.height=renderer.domElement.height;const ctx=canvas.getContext('2d',{willReadFrequently:true});
 const first=meshes[0].material.uniforms,origin=first.uOrigin.value,base=first.uBaseHeight.value,scale=first.uScale.value,centre=new THREE.Vector3(origin.x,base+.03*scale,origin.y).project(camera),eye=new THREE.Vector3(origin.x,base,origin.y).applyMatrix4(camera.matrixWorldInverse),radius=Math.ceil(.18*scale*camera.projectionMatrix.elements[5]*canvas.height/(2*Math.max(.03,-eye.z))),cx=(centre.x*.5+.5)*canvas.width,cy=(-centre.y*.5+.5)*canvas.height,roi={x:Math.max(0,Math.floor(cx-radius)),y:Math.max(0,Math.floor(cy-radius)),width:Math.min(canvas.width,Math.ceil(2*radius)),height:Math.min(canvas.height,Math.ceil(2*radius))};roi.width=Math.min(roi.width,canvas.width-roi.x);roi.height=Math.min(roi.height,canvas.height-roi.y);
 const same=()=>{const now=getFrameState();if(JSON.stringify(now)!==JSON.stringify(start))throw new Error('Physical time/camera/P/C changed during fixed-phase layer probe');};
 try{
  for(const mode of ['none','all','crown','drops']){
   for(const m of meshes)m.visible=mode==='all'||(mode==='crown'&&crowns.includes(m))||(mode==='drops'&&drops.includes(m));
   await renderFrame({reason:'fixed-phase splash layer '+mode,mode});same();ctx.clearRect(0,0,canvas.width,canvas.height);ctx.drawImage(renderer.domElement,0,0);frames[mode]=ctx.getImageData(roi.x,roi.y,roi.width,roi.height).data;if(includeImages)images[mode]=canvas.toDataURL('image/png');
  }
  const deltas={};for(const mode of ['all','crown','drops']){let darkened=0,brightened=0,min=0,max=0,sum=0;for(let i=0;i<frames.none.length;i+=4){const delta=(.2126*(frames[mode][i]-frames.none[i])+.7152*(frames[mode][i+1]-frames.none[i+1])+.0722*(frames[mode][i+2]-frames.none[i+2]))/255;if(delta<-2/255)darkened++;if(delta>2/255)brightened++;min=Math.min(min,delta);max=Math.max(max,delta);sum+=delta;}deltas[mode]={darkenedPixels:darkened,brightenedPixels:brightened,maximumDarkening:-min,maximumBrightening:max,meanSignedSDRLumaDelta:sum/(frames.none.length/4)};}
  checks.push({name:'All four captures retain exact paused frame metadata',passed:true},{name:'Both existing layers remain present without geometry/material substitution',passed:crowns.length>0&&drops.length>0});
  return{schema:'glass-atoll.r13-splash-native-layer-probe.v1',frame:start,roi,layers:{crowns:crowns.length,drops:drops.length},checks,deltas,images,limits:['Actual existing-material visibility toggles only; no alternate material is promoted.','Signed differences are presented SDR luma, not raw optical-radiance error bounds.','Requires root QA lock/history reset callback; not safe to call while ordinary simulation advances.','No shape/photographic/FPS pass is inferred from object presence.']};
 }finally{for(const [m,v]of visibility)m.visible=v;await renderFrame({reason:'restore fixed-phase splash layers',mode:'restore'});same();}
}
