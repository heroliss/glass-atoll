const wait=ms=>new Promise(r=>setTimeout(r,ms));
export async function runPauseTargetSceneCheck(a){
  const saved={paused:a.state.parameters.paused,clock:a.celestial()},checks=[],check=(name,passed,evidence={})=>checks.push({name,passed:!!passed,evidence});
  try{
    await a.setTime({running:false});a.pause(true);
    for(const length of [.137,.091]){
      const target=a.state.time+length;a.pauseAtPhysicalTime(target);a.pause(false);const deadline=performance.now()+4000;
      while(!a.state.parameters.paused&&performance.now()<deadline)await wait(8);
      check(`physical frame truncates exactly at target after${length}s`,a.state.parameters.paused&&a.state.time===target,{target,actual:a.state.time});
      check(`source and smoke request share that exact physical time after${length}s`,a.fireworks().time===target&&a.smoke().requestedPhysicalTime===target,{fireworks:a.fireworks().time,smoke:a.smoke().requestedPhysicalTime});
      check('astronomical UTC remains independent',a.celestial().utcMs===saved.clock.utcMs);
    }
    a.pauseAtPhysicalTime(a.state.time+.08);a.pause(true);a.pause(false);await wait(180);check('manual pause cancels an armed target',!a.state.parameters.paused);a.pause(true);
    const t=a.state.time;let rejected=0;for(const target of [t-1,NaN,Infinity]){try{a.pauseAtPhysicalTime(target);}catch{rejected++;}}
    check('past and nonfinite targets are rejected',rejected===3&&a.state.time===t);
    a.pause(false);a.pauseAtPhysicalTime(t);check('target equal to current time pauses immediately',a.state.parameters.paused&&a.state.time===t);
    return{date:new Date().toISOString(),passed:checks.every(c=>c.passed),passedCount:checks.filter(c=>c.passed).length,total:checks.length,checks,limits:['Actual main-loop QA aid for reproducible captures; does not rewind or retime event births.','Physical time advances during this test; UTC/paused preference are restored.']};
  }finally{a.pause(true);await a.setTime({utcMs:saved.clock.utcMs,...saved.clock.observer,mode:saved.clock.mode,rate:saved.clock.rate,running:saved.clock.running});a.pause(saved.paused);}
}
