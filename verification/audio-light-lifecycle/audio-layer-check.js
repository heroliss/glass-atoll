import {createSoundscape,audioPCMStats} from '../../audio.js';
import {createFireworksAudio,fireworkSoundChoice,FIREWORK_AUDIO_SOURCE,FIREWORK_AUDIO_VARIANTS,FIREWORK_AUDIO_MIX} from '../../fireworks-audio.js';

// Actual OfflineAudioContext production graphs. Source loads, panning, filters,
// both compressors and the final linked peak guard all execute in the browser.
export async function runAudioLayerCheck({capture=true}={}){
  const Native=globalThis.OfflineAudioContext||globalThis.webkitOfflineAudioContext;
  if(!Native)throw Error('OfflineAudioContext unavailable');
  const runtime=new URL('../../fireworks-audio.js',import.meta.url),sampleRate=48000,seconds=8,listener=[0,0,0],position=[0,0,-318.45];
  const checks=[],reports=[],captures={},check=(name,passed,evidence)=>checks.push({name,passed:!!passed,evidence});
  const hash=async bytes=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes)),v=>v.toString(16).padStart(2,'0')).join('');
  const pinFiles=['../../fireworks-audio.js','../../audio.js','../../audio-peak-guard.js','../../audio-peak-worklet.js','../../audio-peak-kernel.js','./before/fireworks-audio.js','./audio-layer-check.js'];
  const pins=async()=>Object.fromEntries(await Promise.all(pinFiles.map(async file=>[file,await hash(await fetch(new URL(file,import.meta.url)).then(r=>r.arrayBuffer()))])));
  const sourceHashes=await pins();
  const baselineText=await fetch(new URL('./before/fireworks-audio.js',import.meta.url)).then(r=>r.text());
  const baselineURL=URL.createObjectURL(new Blob([baselineText.replaceAll('import.meta.url',JSON.stringify(runtime.href))],{type:'text/javascript'}));
  const baseline=await import(baselineURL);URL.revokeObjectURL(baselineURL);
  const decodeContext=new Native(2,sampleRate,sampleRate),assets=[];
  for(const item of [{id:'richwise',...FIREWORK_AUDIO_SOURCE},...FIREWORK_AUDIO_VARIANTS]){
    const bytes=await fetch(new URL(item.file,runtime)).then(r=>r.arrayBuffer()),buffer=await decodeContext.decodeAudioData(bytes.slice(0));
    assets.push({id:item.id,file:item.file,sha256:await hash(bytes),duration:buffer.duration,...audioPCMStats(buffer)});
  }
  check('six_recordings_decode_and_are_not_silent',assets.length===6&&assets.every(a=>a.nonFinite===0&&a.peak>.001&&a.peak<1),assets);
  function seedFor(variant,type='peony',crackle=false){for(let seed=1;seed<100000;seed++){const c=fireworkSoundChoice({kind:'burst',type,seed,energy:1});if(c.variant===variant&&c.crackle===crackle)return seed;}throw Error('No palette seed');}
  async function render(scenario,arm='current'){
    const sceneListener=scenario.listener??listener;
    let helper,master,meta,complete,starts=[],warnings=[];
    class OwnedOffline{
      constructor(...args){
        const ctx=new Native(...args),createGain=ctx.createGain.bind(ctx),start=ctx.startRendering.bind(ctx);
        ctx.createGain=()=>{const node=createGain();master??=node;return node;};
        ctx.startRendering=async()=>{
          helper=(arm==='before'?baseline.createFireworksAudio:createFireworksAudio)({getContext:()=>ctx,getOutput:()=>master,isEnabled:()=>true,getListenerPosition:()=>sceneListener,assetURL:new URL(FIREWORK_AUDIO_SOURCE.file,runtime),onWarning:w=>warnings.push(w)});
          await helper.prepare();
          const createSource=ctx.createBufferSource.bind(ctx);
          ctx.createBufferSource=()=>{const node=createSource(),startNode=node.start.bind(node);node.start=(when,...rest)=>{starts.push({when,duration:node.buffer.duration,rate:node.playbackRate.value});return startNode(when,...rest);};return node;};
          const events=scenario.events||Array.from({length:scenario.count??1},(_,i)=>({kind:scenario.kind??'burst',type:scenario.type??'peony',time:.65+(scenario.spacing??0)*i,position:scenario.position??position,energy:scenario.energy??1,seed:(scenario.seed??1)+(scenario.sameSeed?0:i),eventId:'audio-layer-'+i}));
          await helper.enqueue(events,{time:0,listenerPosition:sceneListener,temperature:29});meta=helper.diagnostics();
          if(scenario.cancel){helper.update({paused:true});meta.afterCancel=helper.diagnostics();}
          const output=await start();complete=helper.diagnostics();return output;
        };
        return ctx;
      }
    }
    const soundscape=createSoundscape({assetBase:new URL('../../assets/audio/',import.meta.url).href,masterVolume:.75,proceduralAir:true,OfflineAudioContextConstructor:OwnedOffline});
    try{
      const result=await soundscape.renderOffline({seconds,sampleRate,time:15.1797,wind:1.8,cameraPosition:sceneListener,cameraForward:[0,0,-1],swellEnvelope:.5});
      let peak=0,sum=0,clipped=0,nonfinite=0;const pcm=[];
      for(let c=0;c<result.buffer.numberOfChannels;c++){
        const data=result.buffer.getChannelData(c).slice();pcm.push(data);
        for(const v of data){if(!Number.isFinite(v))nonfinite++;else{peak=Math.max(peak,Math.abs(v));sum+=v*v;if(Math.abs(v)>=1)clipped++;}}
      }
      return{pcm,wav:result.wav,report:{id:scenario.id,arm,scenario,peak,rms:Math.sqrt(sum/(result.buffer.length*result.buffer.numberOfChannels)),clippedSamples:clipped,nonfinite,starts,audio:meta,completed:complete,warnings,peakGuard:result.report.peakGuard}};
    }finally{helper?.dispose();soundscape.dispose();}
  }
  const rms=(pcm,start=0,end=seconds)=>{let sum=0,n=0;for(const channel of pcm)for(let i=Math.floor(start*sampleRate);i<Math.min(channel.length,Math.ceil(end*sampleRate));i++){sum+=channel[i]**2;n++;}return Math.sqrt(sum/Math.max(1,n));};
  const subtract=(a,b)=>a.map((channel,c)=>channel.map((v,i)=>v-b[c][i]));
  const correlation=(a,b)=>{let aa=0,bb=0,ab=0;for(let c=0;c<a.length;c++)for(let i=0;i<a[c].length;i++){aa+=a[c][i]**2;bb+=b[c][i]**2;ab+=a[c][i]*b[c][i];}return ab/Math.sqrt(Math.max(1e-30,aa*bb));};
  function measureWindow(result,ambient,stage,start,end){
    const differenceRms=rms(subtract(result.pcm,ambient.pcm),start,end),ambientRms=rms(ambient.pcm,start,end),ratio=differenceRms/Math.max(1e-15,ambientRms);
    const measurement={stage,start,end,differenceRms,ambientRms,ratio,differenceRelativeToAmbientDb:20*Math.log10(Math.max(1e-15,ratio))};
    (result.report.audibilityWindows??=[]).push(measurement);return measurement;
  }
  function captureWav(id,wav){if(!capture)return;let binary='';for(let i=0;i<wav.length;i+=32768)binary+=String.fromCharCode(...wav.subarray(i,i+32768));captures[id]=btoa(binary);}
  const ambient=await render({id:'ambient',events:[]}),pairs=[],ambientByListener=new Map([[JSON.stringify(listener),ambient]]);
  async function ambientFor(scenario){const key=JSON.stringify(scenario.listener??listener);if(!ambientByListener.has(key))ambientByListener.set(key,await render({id:'ambient-'+key,events:[],listener:scenario.listener}));return ambientByListener.get(key);}
  for(const variant of ['firecracker','bang','boom-a','boom-b']){
    const scenario={id:'main-'+variant,seed:seedFor(variant),sameSeed:true};
    const old=await render(scenario,'before'),now=await render(scenario);
    for(const result of [old,now]){const at=result.report.audio.lastArrival.audioTime;measureWindow(result,ambient,'burst-attack-and-body',at,at+1.25);measureWindow(result,ambient,'late-body',at+1.25,at+3.6);reports.push(result.report);captureWav(result.report.arm+'-'+scenario.id,result.wav);}
    const oldSignal=subtract(old.pcm,ambient.pcm),newSignal=subtract(now.pcm,ambient.pcm);
    const measured={variant,seed:scenario.seed,beforeRms:rms(oldSignal),currentRms:rms(newSignal),differenceRms:rms(subtract(newSignal,oldSignal)),currentToBeforeRms:rms(newSignal)/rms(oldSignal),sameSeedCorrelation:correlation(oldSignal,newSignal)};
    check(variant+'_actual_output_changed_and_primary_is_selected_recording',now.report.audio.lastArrival.source===variant&&measured.differenceRms/measured.beforeRms>.2&&measured.currentRms>1e-4,{...measured,layers:now.report.audio.recentLayers});
    pairs.push({...measured,oldSignal,newSignal});
  }
  const diversity=[];
  for(let a=0;a<pairs.length;a++)for(let b=a+1;b<pairs.length;b++)diversity.push({a:pairs[a].variant,b:pairs[b].variant,before:Math.abs(correlation(pairs[a].oldSignal,pairs[b].oldSignal)),current:Math.abs(correlation(pairs[a].newSignal,pairs[b].newSignal))});
  const beforeMean=diversity.reduce((s,r)=>s+r.before,0)/diversity.length,currentMean=diversity.reduce((s,r)=>s+r.current,0)/diversity.length;
  check('four_actual_primary_mixes_have_less_shared_waveform_than_prior_near_identical_main',currentMean<beforeMean-.1&&diversity.every(r=>r.current<.95),{beforeMean,currentMean,diversity,scope:'Normalized complete decoded production PCM after subtracting the identical ambient render; sample correlation measures diversity, not subjective quality.'});
  const longScenario={id:'willow-crackle-tail',type:'willow',seed:32,sameSeed:true},longBefore=await render(longScenario,'before'),longNow=await render(longScenario),tailBefore=subtract(longBefore.pcm,ambient.pcm),tailNow=subtract(longNow.pcm,ambient.pcm);
  for(const result of [longBefore,longNow]){const at=result.report.audio.lastArrival.audioTime;measureWindow(result,ambient,'burst',at,at+1.25);measureWindow(result,ambient,'burning-crackle',at+.95,at+2.65);measureWindow(result,ambient,'late-burning-tail',5.4,7.2);reports.push(result.report);captureWav(result.report.arm+'-'+longScenario.id,result.wav);}
  // 318.45m arrival is about1.56s, before final guard lookahead. At 5.4–7.2s
  // the original3.4s body and .22s crackle offset have ended, while the new
  // explicit late crackle is still playing. This tests real output, not count.
  const late={beforeRms:rms(tailBefore,5.4,7.2),currentRms:rms(tailNow,5.4,7.2),layers:longNow.report.audio.recentLayers};
  check('long_tail_has_actual_late_output_after_the_old_sound_has_ended',late.currentRms>Math.max(1e-5,late.beforeRms*5)&&longNow.report.audio.layerPlays['late-crackle']===1,late);
  for(const stage of ['burning-crackle','late-burning-tail']){
    const measurement=longNow.report.audibilityWindows.find(window=>window.stage===stage);
    check(stage+'_incremental_output_is_15_to_50_percent_of_matching_ambient_rms',measurement.ratio>=.15&&measurement.ratio<=.5,{...measurement,targetRatio:[.15,.5],conditions:'One willow at318.45m; master.75/wind1.8 with identical ambient-only reference. This output target does not establish a psychoacoustic masking threshold.'});
  }
  const scenarios=[
    {id:'near-four-main',position:[0,0,0],count:4,seed:12,energy:2},
    {id:'near-dense-48-main',position:[0,0,0],count:48,seed:1,energy:2},
    {id:'twelve-subbursts',position:[0,0,-24],count:12,type:'display-double',seed:1,energy:.12,spacing:.015},
    {id:'launch-ascent',kind:'launch',type:'display-flower',seed:912,position:[29,1.3,7]},
    {id:'launch-ascent-island-edge',kind:'launch',type:'display-flower',seed:912,position:[29,1.3,7],listener:[-65,30,54]},
    {id:'cancel-all-layers',count:3,type:'willow',seed:51,cancel:true},
  ];
  for(const scenario of scenarios){const result=await render(scenario),reference=await ambientFor(scenario),at=result.report.audio.lastArrival?.audioTime??0;if(scenario.kind==='launch'){measureWindow(result,reference,'lift-charge',at,at+.62);measureWindow(result,reference,'ascent-after-charge',at+.62,at+1.55);measureWindow(result,reference,'complete-lift-and-ascent',at,at+1.55);}else if(!scenario.cancel)measureWindow(result,reference,'burst-batch',at,at+2);reports.push(result.report);if(['twelve-subbursts','launch-ascent','launch-ascent-island-edge'].includes(scenario.id))captureWav('current-'+scenario.id,result.wav);}
  for(const r of reports.filter(r=>r.arm==='current')){
    check(r.id+'_final_master_finite_peak_protected_and_voices_retired',r.nonfinite===0&&r.clippedSamples===0&&r.peak<=.975001&&r.peakGuard.mode==='linked-stereo-lookahead'&&r.audio.activeVoices<=24&&r.completed.activeVoices===0&&r.warnings.length===0,{peak:r.peak,guard:r.peakGuard,nonfinite:r.nonfinite,clipped:r.clippedSamples,scheduled:r.audio.activeVoices,retired:r.completed.activeVoices,warnings:r.warnings});
  }
  const dense=reports.find(r=>r.id==='near-dense-48-main'),launch=reports.find(r=>r.id==='launch-ascent'),cancel=reports.find(r=>r.id==='cancel-all-layers');
  check('dense_batch_gives_24_primaries_priority_and_reports_remaining_drops',dense.audio.scheduled===24&&dense.audio.voiceLimitDrops===24&&dense.audio.accentPlays===0,dense.audio);
  check('launch_contains_its_separate_synthesized_ascent_layer',launch.audio.layerPlays.ascent===1&&launch.starts.length===2,launch.audio);
  check('pause_cancels_pending_body_and_tail_as_well_as_primary',cancel.audio.afterCancel.activeVoices===0,cancel.audio.afterCancel);
  check('runtime_sources_stable',JSON.stringify(sourceHashes)===JSON.stringify(await pins()),sourceHashes);
  return{schema:'glass-atoll.audio-layer-output.v1',date:new Date().toISOString(),passed:checks.every(c=>c.passed),total:checks.length,passedCount:checks.filter(c=>c.passed).length,checks,reports,assets,sourceHashes,mix:FIREWORK_AUDIO_MIX,captures,conditions:{sampleRate,seconds,listener,position,masterVolume:.75,baseline:'Preserved immediate pre-change factory; only relative asset base rewritten to the original runtime URL. Same current soundscape/master/peak guard and decoded local assets.',audibilityMeasurement:'Each stage window subtracts its identical ambient-only render after the production master. RMS ratio describes the incremental output relative to that ambient and includes nonlinear master/compressor interaction; it is not an isolated linear stem or a perceptual masking threshold. Near launch uses [29,1.3,7] to [0,0,0]; island-edge listener is [-65,30,54].'},limits:['Offline production PCM verifies actual output differences, tail energy, clipping and scheduling; it does not establish subjective listening quality or speaker calibration.','Stage RMS relative to ambient is a physical output ratio, not a guarantee of perceptual audibility.','Sample peak is not intersample true peak. Maximum48-event stress is intentionally bounded by24 voices.','Sound type/seed is authored timbre selection; not a measured model of pyrotechnic chemistry.']};
}
