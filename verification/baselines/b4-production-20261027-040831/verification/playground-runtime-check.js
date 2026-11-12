// Runs in the existing real browser/context through the public scene API.
// Uses short real frame waits, never replaces native-input acceptance.
export async function runPlaygroundRuntimeCheck(a){
  const checks=[],check=(name,passed,detail={})=>checks.push({name,passed:!!passed,detail});
  const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
  const same=(x,y)=>JSON.stringify(x)===JSON.stringify(y);
  const original={time:a.celestial(),camera:a.state.camera,target:a.state.target,weather:a.state.parameters.weather,lights:a.localLights(),lens:a.state.parameters.lens,graphics:a.state.parameters.graphics,quality:a.state.parameters.qualityPreset};
  try{
    a.pause(true);await a.setTime({running:false});
    const before={camera:a.state.camera,target:a.state.target,weather:a.state.parameters.weather};
    await a.timePreset('day');
    check('time preset preserves weather and camera',same(before,{camera:a.state.camera,target:a.state.target,weather:a.state.parameters.weather}));
    const time=a.celestial().utcMs;
    a.weatherPreset('humid');await sleep(80);
    check('weather preset preserves UTC and camera',a.celestial().utcMs===time&&same(before.camera,a.state.camera)&&same(before.target,a.state.target));
    const timeWeather={utcMs:a.celestial().utcMs,weather:a.state.parameters.weather,focal:a.state.parameters.lens.focal};
    await a.setQuality('medium');await sleep(80);
    check('quality profile preserves time weather focal length',same(timeWeather,{utcMs:a.celestial().utcMs,weather:a.state.parameters.weather,focal:a.state.parameters.lens.focal}));
    check('default medium has actual 4096 shadow and legal MSAA',a.graphics().shadows.mapSize[0]===4096&&a.state.lens.sampleSupport.every(s=>a.state.lens.samples===0||s.includes(a.state.lens.samples)),{shadows:a.graphics().shadows,samples:a.state.lens.samples,support:a.state.lens.sampleSupport});
    const lights=a.setLocalLights({mode:'on',linked:false,lamps:[{enabled:true,brightness:.31,color:'#f7cb88'},{enabled:true,brightness:.48,color:'#fff0d9'},{enabled:true,brightness:.64,color:'#d2e8ff'}]});
    check('three independent low fixtures retain brightness and colours',lights.lamps.length===3&&lights.lamps[0].brightness===.31&&lights.lamps[1].color==='#fff0d9'&&lights.lamps[2].brightness===.64,{positions:lights.lights.slice(0,3).map(l=>l.position)});
    a.setLocalLights({flashlight:{enabled:true,brightness:.63}});await sleep(180);
    check('flashlight enables one bounded source',a.localLights().flashlight.enabled&&a.localLights().lights[3].candela>0,{flash:a.localLights().lights[3],shadowSize:a.localLights().shadowSize});
    a.setFireworks({autoLaunch:true});const count=a.fireworks().launches;await sleep(160);
    check('global pause does not start automatic launches',a.fireworks().launches===count);a.setFireworks({autoLaunch:false});
    await a.setTime({running:true,rate:120});a.pause(false);const t0=a.celestial().utcMs,s0=a.state.time;await sleep(280);a.pause(true);
    const dSim=a.state.time-s0,dUTC=(a.celestial().utcMs-t0)/1000;
    check('accelerated astronomy uses physical seconds times rate',dSim>0&&Math.abs(dUTC-dSim*120)<.03,{physicalSeconds:dSim,utcSeconds:dUTC});
    const pausedUTC=a.celestial().utcMs,pausedTime=a.state.time;await sleep(120);
    check('global pause freezes both physical and astronomical clocks',a.state.time===pausedTime&&a.celestial().utcMs===pausedUTC);
    await a.setTime({running:false,mode:'artistic'});a.setSun({elevation:3,azimuth:240});a.setWeather({humidity:.95});const humid=a.photometry();a.setWeather({humidity:.4});await sleep(80);const dry=a.photometry();
    check('rapid humidity transition budgets the new solar source before draw',dry.storedBound<=dry.safeMaximum,{humid:{P:humid.storageEV,bound:humid.maxRawRGB},dry:{P:dry.storageEV,bound:dry.maxRawRGB,stored:dry.storedBound}});
    await a.timePreset('day');a.setCamera([48,2,30],[53,0,30]);const camera=[...a.state.camera];
    const launched=a.throwStone(null,.7);let maxFlying=0,maxSplash=0,sawRipple=false;const deadline=performance.now()+2100;
    while(performance.now()<deadline){const interaction=a.interactions();maxFlying=Math.max(maxFlying,interaction.stones.length);maxSplash=Math.max(maxSplash,interaction.splashes.active);sawRipple ||= a.state.ripples.some(r=>a.state.time-r[2]>=0&&a.state.time-r[2]<3&&r[3]>0);await sleep(35);}
    a.pause(true);check('camera-ray stone reaches actual splash and ripple',!!launched&&maxFlying>0&&maxSplash>0&&sawRipple,{maxFlying,maxSplash,sawRipple});
    check('throw never teleports the observer',same(camera,a.state.camera),{before:camera,after:a.state.camera});
  }catch(error){checks.push({name:'runtime exception',passed:false,detail:{error:error.stack}});}
  finally{
    a.pause(true);a.setFireworks({autoLaunch:false});a.setLocalLights({...original.lights,flashlight:original.lights.flashlight});
    await a.setTime({utcMs:original.time.utcMs,...original.time.observer,rate:original.time.rate,running:original.time.running,mode:original.time.mode});
    a.setWeather(original.weather);a.setCamera(original.camera,original.target);await a.setQuality(original.quality);a.setLens(original.lens);await a.setGraphics(original.graphics);
  }
  return {date:new Date().toISOString(),scope:'Actual scene API and rendering loop, not native pointer/keyboard or subjective visual/audio acceptance',passed:checks.every(c=>c.passed),passedCount:checks.filter(c=>c.passed).length,total:checks.length,checks};
}
