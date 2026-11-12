function stats(values){
  if(!values.length)return null;
  const sorted=[...values].sort((a,b)=>a-b),q=p=>sorted[Math.min(sorted.length-1,Math.floor(p*(sorted.length-1)))];
  return {count:values.length,minimum:q(0),median:q(.5),mean:values.reduce((a,b)=>a+b,0)/values.length,p95:q(.95),p99:q(.99),maximum:q(1)};
}

export function createRenderBenchmark(snapshot){
  let run=null;
  return {
    get active(){return !!run;},
    start(seconds=12){
      if(run)throw new Error('A rendering benchmark is already active.');
      return new Promise(resolve=>{
        run={start:performance.now(),previous:null,frameIntervals:[],gpuTimes:[],cpuTimes:[],initial:snapshot()};
        setTimeout(()=>{
          const finished=run;run=null;
          const elapsed=(performance.now()-finished.start)/1000;
          resolve({date:new Date().toISOString(),elapsedSeconds:elapsed,initial:finished.initial,final:snapshot(),
            frames:finished.frameIntervals.length,averageFps:finished.frameIntervals.length/elapsed,
            frameMs:stats(finished.frameIntervals),gpuMs:stats(finished.gpuTimes),cpuMs:stats(finished.cpuTimes),
            framesOver16_67ms:finished.frameIntervals.filter(t=>t>1000/60).length,
            raw:finished});
        },Math.max(3,Math.min(seconds,60))*1000);
      });
    },
    frame(now,cpuMs){if(!run)return;if(run.previous!==null)run.frameIntervals.push(now-run.previous);run.previous=now;run.cpuTimes.push(cpuMs);},
    gpu(ms){if(run&&Number.isFinite(ms))run.gpuTimes.push(ms);}
  };
}
