import {runPlaygroundRuntimeCheck} from './playground-runtime-check.js';

export async function checkB4Production(a){
  const saved={clock:a.celestial(),camera:a.state.camera,target:a.state.target},wait=ms=>new Promise(r=>setTimeout(r,ms));
  const settle=async()=>{for(let i=0;i<32;i++)await new Promise(r=>requestAnimationFrame(r));};
  const defaults=()=>({palm:a.palmFrameDiagnostics().mode,cloudBase:a.atmosphere().diagnostics.cloudBaseContinuity,quality:a.state.parameters.qualityPreset,shadows:a.graphics().shadows.mapSize,waves:a.spectrum().resolution,GI:a.state.parameters.graphics.indirect,samples:a.state.lens.samples});
  const report={date:new Date().toISOString(),initial:defaults()};
  try{
    a.pause(true);report.runtime=await runPlaygroundRuntimeCheck(a);report.afterRuntime=defaults();
    document.querySelector('#stop-fireworks')?.click();a.pause(false);
    for(let i=0;i<240&&(a.fireworks().active||a.fireworks().queued);i++)await wait(100);
    if(a.fireworks().active||a.fireworks().queued)throw new Error('Unfinished firework workload prevents a no-firework day benchmark');
    await a.setTime({running:false});await a.timePreset('day');a.setCamera([-48,12,-40],[0,2.5,0]);a.pause(false);await wait(3200);
    report.dayBenchmark=await a.benchmark(4);a.pause(true);await settle();
    report.day={image:a.screenshot(),range:await a.inspectRadiance(),photometry:a.photometry(),sky:a.atmosphere().diagnostics,geometry:a.palmFrameDiagnostics()};
    await a.timePreset('moon');await settle();report.night={image:a.screenshot(),range:await a.inspectRadiance(),photometry:a.photometry(),lighting:a.localLights(),sky:a.atmosphere().diagnostics};
    report.final=defaults();report.samplers=a.shaderSamplers();
    report.checks=[{name:'new production geometry selected before GI/shadow creation',passed:report.initial.palm==='transport'&&report.initial.GI==='low'},
      {name:'production cloud base is continuous C2',passed:report.initial.cloudBase===1},
      {name:'independent controls preserve new source defaults',passed:report.runtime.passed&&report.afterRuntime.palm==='transport'&&report.afterRuntime.cloudBase===1},
      {name:'recommended sampling remains medium4096/512',passed:report.final.quality==='medium'&&report.final.shadows[0]===4096&&report.final.waves===512},
      ...['day','night'].map(key=>({name:key+' all actual RGB textures finite/nonnegative',passed:['opaque','composed','reflection'].every(k=>report[key].range[k].countNaN===0&&report[key].range[k].countInf===0&&report[key].range[k].countNegative===0)}))];
    report.passed=report.checks.every(c=>c.passed);report.limits=['Actual production defaults including rebuilt GI and shadows; API controls checked by the existing runtime fixture','Four-second warmed day benchmark, one viewport/device/session; not a universal60fps guarantee or a dense-fireworks benchmark','PNG output is SDR; absolute HDR panel nits and photographic realism are not established by finite-value checks'];
    return report;
  }finally{
    a.pause(true);await a.setTime({utcMs:saved.clock.utcMs,...saved.clock.observer,mode:saved.clock.mode,rate:saved.clock.rate,running:saved.clock.running});a.setCamera(saved.camera,saved.target);a.pause(false);
  }
}
