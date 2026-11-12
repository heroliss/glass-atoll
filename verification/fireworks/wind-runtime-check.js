// Reproduces the real user wind slider while two Chrysanthemums are alive.
export async function runFireworksWindRuntimeCheck(a){
  const wait=ms=>new Promise(r=>setTimeout(r,ms)),samples=[],saved={clock:a.celestial(),wind:a.state.parameters.wind,camera:a.state.camera,target:a.state.target};
  const setWind=value=>{const element=document.querySelector('#wind-speed');element.value=String(value);element.dispatchEvent(new Event('input',{bubbles:true}));};
  let interval;
  try{
    a.pause(false);await a.setTime({running:false});await a.timePreset('moon');await a.setQuality('medium');setWind(1.8);
    a.setCamera([-48,12,-40],[0,2.5,0]);a.setFireworks({type:'chrysanthemum',autoLaunch:false,autoDirection:true,autoFrame:true});a.launchFirework();a.launchFirework();
    const started=performance.now();interval=setInterval(()=>{const f=a.fireworks();samples.push({wallSeconds:(performance.now()-started)/1000,physicalTime:a.state.time,active:f.active,records:f.records,windSegments:f.windSegments,fps:a.state.fps,P:a.photometry().storageEV,storedBound:a.photometry().storedBound});},100);
    await wait(2500);setWind(5);await wait(3500);
    for(let n=0;n<100&&a.fireworks().records<2000;n++)await wait(50);
    a.pause(true);await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));
    const peakFrame={wallSeconds:(performance.now()-started)/1000,time:a.state.time,fireworks:a.fireworks(),ranges:await a.inspectRadiance()};
    a.pause(false);await wait(120);const benchmark=await a.benchmark(4);a.pause(true);
    const ranges=await a.inspectRadiance(),samplers=a.shaderSamplers();
    return {date:new Date().toISOString(),scenario:'Actual medium HDR scene, moonlit island, two Chrysanthemums; slider1.8→5m/s smoothing1.4s, peak-record range capture before4s benchmark; late-frame range also retained',benchmark,samples,peakFrame,ranges,samplers,limits:['Single desktop viewport and short workload, not all devices or every frame60fps','User wind and original piecewise-held timeline retained; no coarse input quantization','Offline CPU model benchmarks are separate files; this uses the actual render loop']};
  }finally{clearInterval(interval);a.pause(true);a.setFireworks({autoLaunch:false,autoFrame:false});setWind(saved.wind);await a.setTime({utcMs:saved.clock.utcMs,...saved.clock.observer,rate:saved.clock.rate,running:saved.clock.running,mode:saved.clock.mode});a.setCamera(saved.camera,saved.target);}
}
