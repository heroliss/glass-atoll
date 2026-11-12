// Independent known-light fixtures using the actual runtime shaders and
// instanced attributes. No source code equation is copied as the oracle.
export function runFireworksOpticsGPUCheck(THREE,renderer,createFireworks){
  const results=[],previous=renderer.getRenderTarget(),face=renderer.getActiveCubeFace(),mip=renderer.getActiveMipmapLevel(),clear=renderer.getClearColor(new THREE.Color()).clone(),alpha=renderer.getClearAlpha(),auto=renderer.autoClear,shadowAuto=renderer.shadowMap.autoUpdate,shadowDirty=renderer.shadowMap.needsUpdate;
  const effect=createFireworks(THREE,{origin:[0,0,0],terrainHeight:()=>0,seed:17}),owned=[],camera=new THREE.PerspectiveCamera(50,1,.1,1000);let main,mirror;
  const check=(name,passed,detail)=>results.push({name,passed,detail});
  function renderKnown({size=128,reflection=false,ev=0,beta=[0,0,0],sun=[0,0,0],kind=0,tau=.4,light=[.6,.3,.1],background=0,offset=0,vignette=false}={}){
    const target=new THREE.WebGLRenderTarget(size,size,{type:THREE.FloatType,depthBuffer:reflection});owned.push(target);
    const p=reflection?[0,10,-100]:[offset,0,-100];camera.position.set(0,reflection?-10:0,0);camera.lookAt(...(reflection?p:[0,0,-100]));camera.updateMatrixWorld();
    // Initialize runtime uniform wiring/material variant, then replace this
    // owned effect's one instance by an analytically known source only.
    effect.render({renderer,target,camera,reflection,frame:{storageEV:ev,rawPerCandela:1},optics:{width:size,height:size,dof:false,shutterSeconds:0,vignette},air:{enabled:false}});
    const mesh=effect.effectsScene.children[0],geometry=mesh.geometry,material=mesh.material,u=material.uniforms;
    for(const [name,data]of Object.entries({aCentre:p,aVelocity:[0,0,0],aStretch:[0,0,0],aColour:[1,1,1],aShape:[kind,kind?5:.001,100,tau],aSmokeLight:light,aTemporal0:[1,1,1,1],aTemporal1:[1,1,1,1]})){const attr=geometry.getAttribute(name);attr.array.set(data,0);attr.needsUpdate=true;}
    geometry.instanceCount=1;u.uStorageScale.value=2**ev;u.uRawPerCandela.value=1;u.uAirEnabled.value=beta.some(x=>x)?1:0;u.uBetaR.value.fromArray(beta);u.uBetaME.value.set(0,0,0);u.uBetaMS.value.set(0,0,0);u.uRawSunRGB.value.fromArray(sun);u.uSunDirection.value.set(0,0,-1);u.uHeights.value.set(1e9,1e9);u.uPlaneY.value=0;u.uDof.value=0;u.uShutter.value=0;
    renderer.setRenderTarget(target);renderer.setClearColor(new THREE.Color().setRGB(background,background,background),background?1:0);renderer.clear();renderer.render(effect.effectsScene,camera);
    const data=new Float32Array(size*size*4);renderer.readRenderTargetPixels(target,0,0,size,size,data);
    const P=camera.projectionMatrix.elements,energy=[0,0,0];let nonfinite=0,sumAlpha=0;
    for(let y=0;y<size;y++)for(let x=0;x<size;x++){const i=(y*size+x)*4,nx=(x+.5)/size*2-1,ny=(y+.5)/size*2-1,omega=4/(size*size*P[0]*P[5])/(1+(nx/P[0])**2+(ny/P[5])**2)**1.5;for(let c=0;c<3;c++){if(!Number.isFinite(data[i+c]))nonfinite++;energy[c]+=data[i+c]*omega/2**ev;}sumAlpha+=data[i+3];}
    return{energy,sumAlpha,nonfinite,centre:Array.from(data.slice(((size/2)*size+size/2)*4,((size/2)*size+size/2)*4+4)),distance:Math.hypot(...p.map((v,i)=>v-camera.position.getComponent(i)))};
  }
  try{
    renderer.autoClear=false;renderer.shadowMap.autoUpdate=false;renderer.shadowMap.needsUpdate=false;renderer.getContext().getExtension('EXT_float_blend');
    effect.update({time:0});effect.launch();effect.update({time:2});
    const a=renderKnown(),b=renderKnown({size:256}),expected=.01;
    check('pixel_integrated_PSF_preserves_known_inverse_square_source_flux',a.nonfinite===0&&a.energy.every(e=>Math.abs(e/expected-1)<.006),{expected,actual:a});
    check('resolution_change_preserves_solid_angle_integral',b.energy.every((e,c)=>Math.abs(e/a.energy[c]-1)<.003),{a:a.energy,b:b.energy});
    const high=renderKnown({ev:11});check('storageP_changes_not_physical_flux',high.energy.every((e,c)=>Math.abs(e/a.energy[c]-1)<.0001),{a:a.energy,P11:high.energy});
    const air=renderKnown({beta:[.001,.002,.003],sun:[9,8,7]});const expectedAir=[.001,.002,.003].map(v=>expected*Math.exp(-v*100));check('emission_gets_finite_transmission_without_double_added_air_scatter',air.energy.every((e,c)=>Math.abs(e/expectedAir[c]-1)<.006),{expected:expectedAir,actual:air.energy});
    const reflected=renderKnown({reflection:true,beta:[.002,.002,.002]});const d=Math.hypot(100,20),half=d/2,want=100/(d*d)*Math.exp(-.002*half);check('reflection_air_starts_at_water_hit_not_virtual_camera',reflected.energy.every(e=>Math.abs(e/want-1)<.008),{path:half,fullVirtualDistance:d,expected:want,actual:reflected.energy});
    const smoke=renderKnown({kind:1,background:.5}),centre=smoke.centre;check('grey_smoke_premult_over_does_not_square_its_opacity',centre[0]>.5&&centre[1]<.5&&centre[2]<.5&&Math.abs(centre[3]-1)<1e-5,{centre});
    const edgeOff=renderKnown({offset:30}),edgeOn=renderKnown({offset:30,vignette:true}),sensorX=camera.projectionMatrix.elements[0]*.3*.5*24,wantV=.7+.3/(1+sensorX*sensorX/(28*28))**2;
    check('finite_source_gets_same_lens_vignette_once_without_alpha_change',Math.abs(edgeOn.energy[0]/edgeOff.energy[0]-wantV)<.001&&Math.abs(edgeOn.sumAlpha-edgeOff.sumAlpha)<1e-9,{expected:wantV,actual:edgeOn.energy[0]/edgeOff.energy[0],alphaOff:edgeOff.sumAlpha,alphaOn:edgeOn.sumAlpha});
    return{date:new Date().toISOString(),passed:results.every(t=>t.passed),total:results.length,passedCount:results.filter(t=>t.passed).length,results,scope:'actual isolated runtime shader; known photometric energy, finite air, reflection path and premult smoke; no scene FPS/visual claim'};
  }finally{owned.forEach(t=>t.dispose());effect.dispose();renderer.setRenderTarget(previous,face,mip);renderer.setClearColor(clear,alpha);renderer.autoClear=auto;renderer.shadowMap.autoUpdate=shadowAuto;renderer.shadowMap.needsUpdate=shadowDirty;}
}
