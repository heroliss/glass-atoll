// Real single-burst recording (CC0 compressed preview, not original WAV) plus
// explicitly synthesized launch/crackle. User gesture/context belongs to root.
export const FIREWORK_AUDIO_SOURCE=Object.freeze({title:'Single Firework',author:'richwise',source:'https://freesound.org/people/richwise/sounds/455453/',license:'CC0 1.0',licenseURL:'https://creativecommons.org/publicdomain/zero/1.0/',file:'./assets/audio/fireworks/burst-richwise-preview-mono.ogg',kind:'real recording, trimmed mono from compressed public HQ preview',subjectiveReview:'not performed by agent; listening acceptance pending'});
export function soundSpeed(temperature=29){return Math.sqrt(1.4*287.05*(273.15+Math.max(-30,Math.min(50,temperature))));}
export function acousticArrival(event,listener=[0,0,0],temperature=29){const distance=Math.hypot(...event.position.map((v,i)=>v-listener[i]));return{distance,delay:distance/soundSpeed(temperature),arrival:event.time+distance/soundSpeed(temperature)};}
function random(seed){let s=seed>>>0;return()=>{s=(Math.imul(s,1664525)+1013904223)>>>0;return s/4294967296;};}
export function synthFireworkPCM(kind='launch',sampleRate=48000,seed=1){
  const duration=kind==='burst'?1.45:kind==='crackle'?.48:.62,n=Math.ceil(duration*sampleRate),data=new Float32Array(n),rng=random(seed);let low=0,mid=0,peak=0;
  const pops=Array.from({length:6},()=>({at:rng()*.3,frequency:1200+rng()*2000}));
  for(let i=0;i<n;i++){const t=i/sampleRate,w=rng()*2-1;low=.965*low+.035*w;mid=.66*mid+.34*w;let value;
    if(kind==='burst')value=(low*3+mid*.8+w*.12)*(1-Math.exp(-t*1400))*Math.exp(-t*7)+.12*Math.sin(t*2*Math.PI*51)*Math.exp(-t*12);
    else if(kind==='crackle'){value=0;for(const p of pops){const a=t-p.at;if(a>0)value+=(mid*.7+w*.3)*Math.exp(-a*130)*Math.sin(a*p.frequency*2*Math.PI);}}
    else value=(low*2.1+mid*.22)*(1-Math.exp(-t*240))*Math.exp(-t*18)+mid*.11*Math.sin(Math.PI*Math.min(1,t/.5))**2;
    value*=Math.min(1,(duration-t)/.025);data[i]=value;peak=Math.max(peak,Math.abs(value));
  }
  for(let i=0;i<n;i++)data[i]=data[i]/Math.max(peak,1e-9)*.78;
  return{data,sampleRate,duration,kind:'acoustic synthesis; not a real explosion recording'};
}
const positionArray=v=>Array.isArray(v)?v:[v?.x||0,v?.y||0,v?.z||0];
export function createFireworksAudio({getContext=()=>null,getOutput=()=>null,isEnabled=()=>false,getListenerPosition=()=>[0,0,0],assetURL=new URL(FIREWORK_AUDIO_SOURCE.file,import.meta.url),onWarning=()=>{}}={}){
  let context=null,input=null,compressor=null,headroom=null,outputNode=null,loading=null,recording=null,epoch=0,paused=false,enabledLast=false,disposed=false;
  let scheduled=0,discarded=0,recordedPlays=0,synthesizedPlays=0,lastArrival=null,loadError=null;const voices=new Set(),synthBuffers=new Map();
  async function prepare(){
    if(disposed||!isEnabled())return false;
    const ctx=await getContext(),output=getOutput();
    // Root enables/resumes its context before asynchronously building its
    // ambience graph. Do not commit a half-initialized helper while its aux
    // output is still null, or later calls would see the same context and
    // never attach this bus. A ready output is part of initialization.
    if(!ctx||!output||!isEnabled()||disposed)return false;
    // Actual coherent near/zero-distance double-burst offline QA exposed
    // six/eight >fullscale samples after the first +12dB candidate. A linear
    // post-compressor reserve fixes that before the shared master; no clip,
    // waveshaping or added lookahead. Far SFX also lose1.94dB, explicitly.
    if(context!==ctx){input?.disconnect();compressor?.disconnect();headroom?.disconnect();context=ctx;recording=null;loading=null;synthBuffers.clear();input=context.createGain();input.gain.value=.64;compressor=context.createDynamicsCompressor();compressor.threshold.value=-7;compressor.knee.value=7;compressor.ratio.value=5;compressor.attack.value=.002;compressor.release.value=.17;headroom=context.createGain();headroom.gain.value=.80;input.connect(compressor);compressor.connect(headroom);headroom.connect(output);outputNode=output;}
    else if(outputNode!==output){headroom.disconnect();headroom.connect(output);outputNode=output;}
    if(recording)return true;if(loading)return loading;
    loading=fetch(assetURL).then(r=>{if(!r.ok)throw new Error(`Fireworks recording HTTP ${r.status}`);return r.arrayBuffer();}).then(b=>context.decodeAudioData(b)).then(b=>{recording=b;return true;}).catch(error=>{loadError=error.message;onWarning(`烟花录音未载入，使用明确标记的合成暂态：${error.message}`);return false;});
    return loading;
  }
  function synthesized(kind,seed){const key=kind+':'+(seed%7);if(synthBuffers.has(key))return synthBuffers.get(key);const pcm=synthFireworkPCM(kind,context.sampleRate,seed),buffer=context.createBuffer(1,pcm.data.length,pcm.sampleRate);buffer.copyToChannel(pcm.data,0);synthBuffers.set(key,buffer);return buffer;}
  function cancel(){epoch++;for(const voice of voices){try{voice.gain.gain.cancelScheduledValues(context.currentTime);voice.gain.gain.setTargetAtTime(0,context.currentTime,.008);voice.source.stop(context.currentTime+.04);}catch{}}voices.clear();}
  async function enqueue(events,{time=0,listenerPosition=getListenerPosition(),temperature=29,paused:framePaused=false}={}){
    if(!Array.isArray(events))events=[events];if(events.length===0)return;if(disposed||framePaused||!isEnabled()){discarded+=events.length;return;}
    const token=epoch,entered=globalThis.performance?.now?.()??Date.now();await prepare();if(!context||disposed||token!==epoch||!isEnabled()||paused){discarded+=events.length;return;}
    const elapsed=((globalThis.performance?.now?.()??Date.now())-entered)/1000,listener=positionArray(listenerPosition);
    for(const event of events){
      if(!event?.position||!Number.isFinite(event.time)){discarded++;continue;}
      const arrival=acousticArrival(event,listener,temperature),remaining=arrival.arrival-time-elapsed;
      // Never replay old events in a batch after loading/unmuting/resuming.
      if(remaining<-.12||voices.size>=24){discarded++;continue;}
      const kind=event.kind==='burst'?'burst':event.kind==='crackle'?'crackle':'launch',useRecording=kind==='burst'&&recording;
      const source=context.createBufferSource();source.buffer=useRecording?recording:synthesized(kind,event.seed||1);
      const filter=context.createBiquadFilter();filter.type='lowpass';filter.frequency.value=Math.max(1100,18000/(1+arrival.distance/280));filter.Q.value=.45;
      const gain=context.createGain(),panner=context.createPanner();panner.panningModel='HRTF';panner.distanceModel='inverse';panner.refDistance=24;panner.rolloffFactor=1;panner.maxDistance=5000;
      if(panner.positionX){panner.positionX.value=event.position[0];panner.positionY.value=event.position[1];panner.positionZ.value=event.position[2];}else panner.setPosition(...event.position);
      // Relative mix correction after the actual318m capture: the real clip
      // already contains bass and an intact attack. Raise only its burst bus
      // reference by12.04dB; retain source distance, HRTF and travel delay.
      const when=context.currentTime+Math.max(.008,remaining-(useRecording?.015:0));gain.gain.value=(kind==='burst'?3.60:kind==='crackle'?.31:.26)*Math.sqrt(Math.max(.05,Math.min(2,event.energy||1)));
      source.connect(filter);filter.connect(gain);gain.connect(panner);panner.connect(input);
      const voice={source,filter,gain,panner};voices.add(voice);source.onended=()=>{voices.delete(voice);source.disconnect();filter.disconnect();gain.disconnect();panner.disconnect();};source.start(when);scheduled++;if(useRecording)recordedPlays++;else synthesizedPlays++;lastArrival={kind,distance:arrival.distance,soundSpeed:soundSpeed(temperature),delay:arrival.delay,physicalEventTime:event.time,expectedArrival:arrival.arrival,audioTime:when,source:useRecording?'CC0 recorded preview trim':'explicit acoustic synthesis'};
    }
  }
  return{prepare,enqueue,consume:enqueue,cancel,
    update({paused:nextPaused=false}={}){const enabled=!!isEnabled();if(nextPaused&&!paused||!enabled&&enabledLast)cancel();paused=!!nextPaused;enabledLast=enabled;},
    diagnostics(){return{scheduled,discarded,recordedPlays,synthesizedPlays,activeVoices:voices.size,outputReady:!!outputNode,recordingLoaded:!!recording,recordingDuration:recording?.duration||0,relativeBurstGain:3.6,postCompressorHeadroomGain:.8,source:FIREWORK_AUDIO_SOURCE,loadError,lastArrival,spatial:'HRTF; inverse pressure-distance once in PannerNode; temperature-dependent propagation delay',limits:['real compressed preview recording; subjective background/timbre listening pending','launch/crackle and failed-load burst explicitly synthesized','fixed listener at emission scheduling; moving receiver sound-cone not solved','distance lowpass is an approximation; no absolute sound-pressure calibration','linear post-compressor headroom lowers all pyro SFX1.94dB; not an arbitrary-source peak limiter']};},
    dispose(){disposed=true;cancel();input?.disconnect();compressor?.disconnect();headroom?.disconnect();},
  };
}
