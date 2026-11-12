// Visual sky comparison only. These profiles also change other resources;
// whole-scene frame time is deliberately not used as cloud-performance evidence.
export async function compareCloudViewSampling(a){
  const saved={quality:a.state.parameters.qualityPreset,clock:a.celestial(),sun:{...a.state.parameters.sun},camera:a.state.camera,target:a.state.target},images=[];
  a.pause(true);await a.setTime({running:false});a.setSun({azimuth:100,elevation:48,intensity:1});a.setCamera([-48,12,-40],[0,2.5,0]);
  try{for(const profile of ['medium','ultra']){
    await a.setQuality(profile);for(let i=0;i<5;i++)await new Promise(r=>requestAnimationFrame(r));
    images.push({profile,image:a.screenshot(),time:a.state.time,camera:a.state.camera,target:a.state.target,sky:a.atmosphere().diagnostics,lens:{width:a.state.lens.width,height:a.state.lens.height},P:a.photometry().storageEV,C:a.photometry().cameraEV});
  }return{date:new Date().toISOString(),images,limits:['Sky visual comparison, not isolated performance: quality profiles change shadows/waves and other resources too','At DPR1 medium/ultra request64/128cloudsteps and same8atmosphere steps, same canvas size; verify metadata before comparing sky ROI','Fixed physical time, camera, weather, source direction and display photo transform; not a reference radiometric ground truth']};}
  finally{await a.setQuality(saved.quality);await a.setTime({utcMs:saved.clock.utcMs,...saved.clock.observer,mode:saved.clock.mode,rate:saved.clock.rate,running:saved.clock.running});if(saved.clock.mode==='artistic')a.setSun(saved.sun);a.setCamera(saved.camera,saved.target);a.pause(true);}
}
