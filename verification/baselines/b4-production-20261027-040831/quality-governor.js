// Resolution governor: use actual GPU time when available, with slow recovery.
// It cannot guarantee a frame rate on arbitrary hardware or under OS contention.
export function createQualityGovernor({onScale,enabled=true,scale=1,minScale=.6,targetFps=60}={}) {
  let current=scale,elapsed=0,cooldown=6,healthy=0,overBudget=0,lastGpu=null,ewma=null,changes=[];
  let recentFrames=[],slowFrames=0,lastPacingChange=-Infinity;
  function reset(){elapsed=0;cooldown=3;healthy=0;overBudget=0;ewma=null;lastGpu=null;recentFrames=[];slowFrames=0;lastPacingChange=-Infinity;}
  return {
    setEnabled(value){enabled=!!value;reset();if(!enabled&&current!==1){current=1;onScale?.(current);}},
    reset,
    setTargetFps(value){
      const next=Math.max(24,Math.min(120,Number(value)||60));
      if(next!==targetFps){
        // A deliberately larger frame budget should make quality available
        // immediately. Pixel work scales with linear resolution squared.
        const restored=enabled&&next<targetFps?Math.min(1,current*Math.sqrt(targetFps/next)):current;
        targetFps=next;reset();if(restored>current){current=restored;onScale?.(current);}
      }
    },
    update({delta,gpuMs,cpuMs=0,frameMs}){
      if(!enabled||!Number.isFinite(delta)||delta<=0||delta>.08)return;
      elapsed+=delta;cooldown=Math.max(0,cooldown-delta);
      // Startup shader compilation is outside the steady rendering budget.
      if(elapsed<6){ewma=null;return;}
      const cost=Number.isFinite(gpuMs)&&gpuMs>0?Math.max(gpuMs,cpuMs):Math.max(cpuMs,frameMs||0);
      if(!Number.isFinite(cost)||cost<=0)return;
      const budgetScale=60/targetFps;
      if(Number.isFinite(frameMs)&&frameMs>0){const slow=frameMs>17.2*budgetScale?1:0;recentFrames.push(slow);slowFrames+=slow;if(recentFrames.length>120)slowFrames-=recentFrames.shift();}
      ewma=ewma===null?cost:ewma+(cost-ewma)*(1.-Math.exp(-delta/1.5));
      lastGpu=gpuMs;
      if(cooldown>0)return;
      // A fast mean can still miss the 60 Hz presentation budget. Require a
      // persistent slow-frame fraction and meaningful GPU load, not one stall.
      const pacingPressure=recentFrames.length>=90&&slowFrames/recentFrames.length>.04&&ewma>8*budgetScale;
      // The tail of a smoothed one-off stall is not sustained rendering load.
      overBudget=cost>15.1*budgetScale||pacingPressure?overBudget+delta:0;
      if((ewma>15.1*budgetScale||pacingPressure)&&current>minScale){
        if(overBudget<1.8)return;
        const next=Math.max(minScale,Math.round(Math.min(current-.04,pacingPressure?current*.92:current*Math.sqrt(13.4*budgetScale/ewma))*100)/100);
        if(next<current){current=next;if(pacingPressure)lastPacingChange=elapsed;changes.push({seconds:+elapsed.toFixed(2),scale:current,costMs:+ewma.toFixed(2),reason:pacingPressure?'frame pacing':'GPU budget'});onScale?.(current);cooldown=3;healthy=0;overBudget=0;recentFrames=[];slowFrames=0;}
      }else if(ewma<10.8*budgetScale&&current<1&&(elapsed-lastPacingChange>45||ewma<7*budgetScale)){
        healthy+=delta;
        if(healthy>8){current=Math.min(1,Math.round((current+.025)*1000)/1000);changes.push({seconds:+elapsed.toFixed(2),scale:current,costMs:+ewma.toFixed(2)});onScale?.(current);cooldown=3;healthy=0;}
      }else healthy=0;
    },
    get state(){return {enabled,targetFps,referenceBudgetMs:1000/targetFps,scale:current,minimumScale:minScale,smoothedCostMs:ewma,lastGpuMs:lastGpu,slowFrameFraction:recentFrames.length?slowFrames/recentFrames.length:0,changes:changes.slice(-12)};}
  };
}
