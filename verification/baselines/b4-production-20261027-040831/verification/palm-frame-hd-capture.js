// The browser viewport is raised before this call; PNG pixels are actually
// rendered at the reported dimensions. No enlargement of an old screenshot.
export async function capturePalmHD(a){
  const saved={clock:a.celestial(),sun:{...a.state.parameters.sun},lens:{...a.state.parameters.lens},graphics:{...a.state.parameters.graphics},camera:a.state.camera,target:a.state.target,lights:a.localLights(),mode:a.palmFrameDiagnostics().mode,paused:a.state.parameters.paused},images=[];
  try{
    a.pause(true);await a.setTime({running:false});a.setSun({azimuth:100,elevation:48,intensity:1});await a.setGraphics({indirect:'off'});a.setLocalLights({mode:'off',flashlight:{enabled:false}});
    a.setLens({focal:50,exposure:0,dof:false});a.setCamera([21,14.5,6],[7.6,12.2,-1.6]);
    await new Promise(r=>setTimeout(r,240));
    for(const mode of ['legacy','transport']){
      a.setPalmFrameMode(mode==='legacy'?'transport':'legacy');a.setPalmFrameMode(mode);
      for(let n=0;n<5;n++)await new Promise(r=>requestAnimationFrame(r));
      images.push({mode,image:a.screenshot(),camera:a.state.camera,target:a.state.target,time:a.state.time,lens:a.state.parameters.lens,dimensions:[a.state.lens.outputWidth,a.state.lens.outputHeight],P:a.photometry().storageEV,C:a.photometry().cameraEV,geometry:a.palmFrameDiagnostics(),sky:a.atmosphere().diagnostics});
    }
    return{date:new Date().toISOString(),images,conditions:'Actual close-crown50mm render, same source/time/material/dimensions, GI and local lights off on both; default geometry not changed',limits:['Ordinary SDR photos, no calibrated HDR claim','Static paused view; moving aliasing and frame rate are separate checks']};
  }finally{
    a.pause(true);a.setPalmFrameMode(saved.mode);a.setLocalLights(saved.lights);a.setLens(saved.lens);await a.setGraphics(saved.graphics);await a.setTime({utcMs:saved.clock.utcMs,...saved.clock.observer,mode:saved.clock.mode,rate:saved.clock.rate,running:saved.clock.running});if(saved.clock.mode==='artistic')a.setSun(saved.sun);a.setCamera(saved.camera,saved.target);a.pause(saved.paused);
  }
}
