// A bounded observer of the existing public application API. No simulation
// clock jumps or invented frame timings: every sample comes from a live frame.
export function observeAutomaticShow(a,{durationSeconds=32,maxWallSeconds=60,benchmarkAtSeconds=null}={}){
  const start=a.state.time,startWall=performance.now(),initial=a.fireworks();
  const launches=[],samples=[];let seen=initial.launches,lastSample=-Infinity,missedLaunches=0,benchmark=null,benchmarkStarted=false;
  return new Promise(resolve=>{
    function frame(){
      const wall=(performance.now()-startWall)/1000,time=a.state.time;
      if(benchmarkAtSeconds!==null&&!benchmarkStarted&&time-start>=benchmarkAtSeconds){
        benchmarkStarted=true;
        try{const active=a.fireworks().active;a.profileFrames(5);a.benchmark(5).then(result=>{benchmark={activeAtStart:active,activeAtEnd:a.fireworks().active,result,profile:a.frameProfile()};}).catch(error=>{benchmark={error:String(error)};});}
        catch(error){benchmark={error:String(error)};}
      }
      if(time-lastSample>=.075){
        lastSample=time;const f=a.fireworks();
        if(f.launches!==seen){
          missedLaunches+=Math.max(0,f.launches-seen-1);seen=f.launches;
          launches.push({...f.lastLaunch});
        }
        samples.push({time,wall,active:f.active,queued:f.queued,records:f.records,instances:f.lastRender?.instances,opticalCapacity:f.opticalCapacity,ledgerCapacity:f.physicalLedgerCapacity,fps:a.state.fps,gpuMs:a.state.gpuMs});
      }
      const interrupted=!!a.state.graphicsContextInterrupted;
      if(time-start>=durationSeconds||wall>=maxWallSeconds||interrupted){
        a.setFireworks({autoLaunch:false});a.pause(true);
        resolve({schema:'glass-atoll.automatic-show-live.v1',status:!interrupted&&time-start>=durationSeconds?'passed':'incomplete',initial:{time:start,settings:initial.settings,maxActive:initial.maxActive},endTime:time,wallSeconds:wall,missedLaunches,launches,samples,benchmark,peakActive:Math.max(0,...samples.map(x=>x.active)),peakRecords:Math.max(0,...samples.map(x=>x.records)),gl:a.readGLErrors('automatic-show-live')});
        return;
      }
      requestAnimationFrame(frame);
    }
    requestAnimationFrame(frame);
  });
}
