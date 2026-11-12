// Same fixed day/camera for five profiles. Real rAF/CPU/GPU times include the
// current browser/HDR path. Not a guarantee for another viewport or device.
export async function runQualityBenchmarks(a,{seconds=6,warmupMs=1200,ids=['low','balanced','medium','high','ultra']}={}){
  const reports=[],sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
  const saved={celestial:a.celestial(),camera:a.state.camera,target:a.state.target,quality:a.state.parameters.qualityPreset};
  try{
    a.pause(false);await a.setTime({running:false,rate:1});await a.timePreset('day');
    a.setCamera([-48,12,-40],[0,2.5,0]);
    for(const id of ids){await a.setQuality(id);await sleep(warmupMs);const report=await a.benchmark(seconds);reports.push({id,...report});}
  }finally{a.pause(true);await a.setQuality(saved.quality);await a.setTime({utcMs:saved.celestial.utcMs,...saved.celestial.observer,rate:saved.celestial.rate,running:saved.celestial.running,mode:saved.celestial.mode});a.setCamera(saved.camera,saved.target);}
  return {date:new Date().toISOString(),scenario:'fixed shore view, local solar noon, astronomical clock stopped, waves/wind/weather active, no active fireworks, existing native HDR configuration',reports,limits:['One desktop viewport, not all devices or mobile','Timer queries and present bridge are included; browser/thermal scheduling can vary','No all-scene60fps guarantee; night fireworks and high-cost indirect light need separate scenarios']};
}
