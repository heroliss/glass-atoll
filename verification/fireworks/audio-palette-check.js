import {createSoundscape,audioPCMStats} from '../../audio.js';
import {createFireworksAudio,fireworkSoundChoice,FIREWORK_AUDIO_SOURCE,FIREWORK_AUDIO_VARIANTS} from '../../fireworks-audio.js';
import {createFireworksAudio as createProtectedBaseline} from '../baselines/r37-rejected-source-projection-reuse/fireworks-audio.js';

// Uses the production soundscape master, production pyro nodes and decoded
// local assets. This is a signal/runtime check, not subjective listening.
export async function runAudioPaletteCheck({capture=true,baselineOnly=false}={}){
  const Native=globalThis.OfflineAudioContext||globalThis.webkitOfflineAudioContext;
  if(!Native)throw new Error('OfflineAudioContext unavailable');
  const checks=[],reports=[],captures={},sampleRate=48000,seconds=7,temperature=29;
  const listener=[-188.28059078348676,12,-126.35772214387782],forward=[.7986368514168929,.3972994652580746,.4520313202252246];
  const check=(name,passed,detail)=>checks.push({name,passed:!!passed,detail});
  const hash=async bytes=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes)),x=>x.toString(16).padStart(2,'0')).join('');
  const sourceFiles=['../../fireworks-audio.js','../../audio.js','../../audio-peak-guard.js','../../audio-peak-worklet.js','../../audio-peak-kernel.js'];
  const initialSourceHashes={};for(const file of sourceFiles)initialSourceHashes[file]=await hash(await fetch(new URL(file,import.meta.url)).then(r=>r.arrayBuffer()));
  const decodeContext=new Native(2,sampleRate,sampleRate),assets=[];
  for(const source of [{id:'richwise',...FIREWORK_AUDIO_SOURCE},...FIREWORK_AUDIO_VARIANTS]){
    // Catalog paths are relative to runtime module, not this QA module.
    const resolved=new URL('../../'+source.file.replace(/^\.\//,''),import.meta.url);
    const bytes=await fetch(resolved).then(r=>{if(!r.ok)throw new Error(resolved+' HTTP '+r.status);return r.arrayBuffer();});
    const buffer=await decodeContext.decodeAudioData(bytes.slice(0)),stats=audioPCMStats(buffer);let fullscale=0;
    for(let channel=0;channel<buffer.numberOfChannels;channel++)for(const value of buffer.getChannelData(channel))if(Math.abs(value)>=1)fullscale++;
    assets.push({id:source.id,file:source.file,sha256:await hash(bytes),duration:buffer.duration,channels:buffer.numberOfChannels,...stats,fullscaleSamples:fullscale});
  }
  check('all_six_local_recordings_decode_non_silent_finite_without_fullscale_samples',assets.length===6&&assets.every(a=>a.duration>0&&a.nonFinite===0&&a.peak>.001&&a.peak<1&&a.fullscaleSamples===0),assets);
  const seedFor=(variant,subBurst=false,crackle=null)=>{
    for(let seed=1;seed<100000;seed++){const event={kind:'burst',type:'display-split',seed,energy:subBurst?.12:1},choice=fireworkSoundChoice(event);if(choice.variant===variant&&(crackle===null||choice.crackle===crackle))return seed;}
    throw new Error('Missing seed for '+variant);
  };
  const choices=Array.from({length:128},(_,i)=>fireworkSoundChoice({kind:'burst',type:'peony',seed:i,energy:1}));
  check('repeatable_seed_palette_covers_four_distinct_main_recordings',new Set(choices.map(c=>c.variant)).size===4&&JSON.stringify(choices)===JSON.stringify(Array.from({length:128},(_,i)=>fireworkSoundChoice({kind:'burst',type:'peony',seed:i,energy:1}))),{variants:[...new Set(choices.map(c=>c.variant))],rates:[Math.min(...choices.map(c=>c.rate)),Math.max(...choices.map(c=>c.rate))]});
  async function render(scenario){
    let helper,master,metadata,completed,starts=[],warnings=[];
    class OwnedOffline{
      constructor(...args){
        const ctx=new Native(...args),gain=ctx.createGain.bind(ctx),start=ctx.startRendering.bind(ctx);
        ctx.createGain=()=>{const node=gain();master??=node;return node;};
        ctx.startRendering=async()=>{
          const factory=scenario.protectedBaseline?createProtectedBaseline:createFireworksAudio;
          helper=factory({getContext:()=>ctx,getOutput:()=>master,isEnabled:()=>true,getListenerPosition:()=>listener,assetURL:new URL('../../assets/audio/fireworks/burst-richwise-preview-mono.ogg',import.meta.url),onWarning:w=>warnings.push(w)});
          if(!await helper.prepare())throw new Error('Production main recording did not decode');
          const sourceFactory=ctx.createBufferSource.bind(ctx);
          ctx.createBufferSource=()=>{const node=sourceFactory(),startSource=node.start.bind(node);node.start=(when,...rest)=>{starts.push({when,duration:node.buffer.duration,rate:node.playbackRate.value});return startSource(when,...rest);};return node;};
          const events=Array.from({length:scenario.count},(_,i)=>({kind:scenario.kind||'burst',type:'display-split',time:.75+(scenario.spacing||0)*i,position:listener.map((v,c)=>v+forward[c]*scenario.distance),energy:scenario.energy??1.15,seed:scenario.sameSeed?scenario.seed:scenario.seed+i,eventId:'palette-'+i}));
          if(scenario.withMain){for(const event of events)event.time+=.95;events.unshift({...events[0],time:.75,energy:1.15,seed:71,eventId:'palette-main'});}
          await helper.enqueue(events,{time:0,listenerPosition:listener,temperature});
          metadata=helper.diagnostics();
          if(scenario.cancel){helper.update({paused:true});metadata.afterCancel=helper.diagnostics();}
          const buffer=await start();completed=helper.diagnostics();return buffer;
        };
        return ctx;
      }
    }
    const soundscape=createSoundscape({assetBase:new URL('../../assets/audio/',import.meta.url).href,masterVolume:.75,proceduralAir:true,OfflineAudioContextConstructor:OwnedOffline});
    try{
      const result=await soundscape.renderOffline({seconds,sampleRate,time:15.1797,wind:1.8,cameraPosition:listener,cameraForward:forward,swellEnvelope:.5});
      let clipped=0,nonfinite=0,peak=0,sum=0;for(let c=0;c<result.buffer.numberOfChannels;c++)for(const value of result.buffer.getChannelData(c)){if(!Number.isFinite(value))nonfinite++;else{peak=Math.max(peak,Math.abs(value));sum+=value*value;if(Math.abs(value)>=1)clipped++;}}
      const expected=.75+scenario.distance/Math.sqrt(1.4*287.05*(273.15+temperature));
      return{scenario,peak,peakDBFS:20*Math.log10(Math.max(1e-20,peak)),rms:Math.sqrt(sum/(result.buffer.length*result.buffer.numberOfChannels)),clippedSamples:clipped,nonfinite,starts,audio:metadata,completed,warnings,expectedFirstArrival:expected,scheduleOffset:starts[0]?.when-expected,wav:result.wav,ambient:result.report.decoded,peakGuard:result.report.peakGuard};
    }finally{helper?.dispose();soundscape.dispose();}
  }
  const scenarios=[
    ...['firecracker','bang','boom-a','boom-b'].map(variant=>({id:'main_far_'+variant,distance:318.45,count:1,seed:seedFor(variant,false,false),sameSeed:true,expectedVariant:variant})),
    {id:'main_far_crackle',distance:318.45,count:1,seed:seedFor('boom-a',false,true),sameSeed:true,expectCrackle:true},
    ...['firecracker','bang'].map(variant=>({id:'sub_near_'+variant,distance:24,count:1,seed:seedFor(variant,true),sameSeed:true,energy:.12,expectedVariant:variant})),
    {id:'near_zero_coherent_double',distance:0,count:2,seed:seedFor('bang',false,true),sameSeed:true},
    {id:'near_24_coherent_double',distance:24,count:2,seed:seedFor('boom-b',false,true),sameSeed:true},
    {id:'selected_far_318_single_energy1',distance:318.45,count:1,seed:71,energy:1},
    {id:'selected_far_318_double_energy1',distance:318.45,count:2,seed:71,energy:1},
    {id:'selected_near_24_double_energy1',distance:24,count:2,seed:71,energy:1},
    {id:'selected_near_zero_double_energy1',distance:0,count:2,seed:71,energy:1},
    {id:'selected_near_24_double_energy1p15',distance:24,count:2,seed:71,energy:1.15},
    {id:'selected_near_zero_double_energy1p15',distance:0,count:2,seed:71,energy:1.15},
    {id:'near_zero_four_main',distance:0,count:4,seed:seedFor('bang',false,true),sameSeed:true},
    {id:'near_zero_maxenergy_double',distance:0,count:2,seed:seedFor('bang',false,true),sameSeed:true,energy:2},
    {id:'near_24_twelve_subbursts',distance:24,count:12,seed:1,energy:.12,spacing:.015},
    {id:'near_zero_main_and_twelve_subbursts',distance:0,count:12,seed:1,energy:.12,spacing:.015,withMain:true},
    {id:'near_zero_dense_48',distance:0,count:48,seed:1},
    {id:'pause_cancels_all_scheduled_layers',distance:318.45,count:4,seed:1,cancel:true},
  ];
  for(const scenario of (baselineOnly?[]:scenarios)){
    const result=await render(scenario),{wav,...report}=result;reports.push(report);
    check(scenario.id+'_finite_unclipped',result.clippedSamples===0&&result.nonfinite===0,{peak:result.peak,clippedSamples:result.clippedSamples,nonfinite:result.nonfinite});
    check(scenario.id+'_actual_worklet_ceiling',result.peakGuard?.mode==='linked-stereo-lookahead'&&result.peakGuard.ceiling===.975&&result.peakGuard.lookaheadSeconds===.005&&result.peak<=.975001,{peak:result.peak,peakGuard:result.peakGuard});
    check(scenario.id+'_all_assets_ready_and_no_fallback',(scenario.protectedBaseline||result.audio.variantsLoaded.length===5)&&result.audio.recordingLoaded&&result.audio.synthesizedPlays===0&&result.warnings.length===0,{variantsLoaded:result.audio.variantsLoaded,warnings:result.warnings});
    check(scenario.id+'_voices_bounded_and_retired',result.audio.activeVoices<=24&&result.completed.activeVoices===0,{peakScheduledVoices:result.audio.activeVoices,afterRender:result.completed.activeVoices,discarded:result.audio.discarded});
    if(scenario.expectedVariant)check(scenario.id+'_selected_expected_recording',result.audio.variantPlays[scenario.expectedVariant]>0,{variantPlays:result.audio.variantPlays,lastArrival:result.audio.lastArrival});
    if(scenario.expectCrackle)check(scenario.id+'_crackle_layer_emitted',result.audio.variantPlays.crackle===1,result.audio.variantPlays);
    if(scenario.count===1){const expectedOffset=result.audio.lastArrival.source==='richwise'?-.015:0;check(scenario.id+'_propagation_schedule_matches_distance',Math.abs(result.scheduleOffset-expectedOffset)<.01,{offsetSeconds:result.scheduleOffset,expectedOffset,expectedSeconds:result.expectedFirstArrival});}
    const firstChoice=fireworkSoundChoice({kind:scenario.kind||'burst',type:'display-split',seed:scenario.withMain?71:scenario.seed,energy:scenario.withMain?1.15:scenario.energy??1.15}),primary=result.audio.recentLayers.find(layer=>layer.role==='primary'),lowBody=result.audio.recentLayers.filter(layer=>layer.role==='low-body');
    check(scenario.id+'_selected_recording_is_primary_and_low_body_retains_original_rate',primary?.source===firstChoice.variant&&primary?.rate===firstChoice.rate&&lowBody.every(layer=>layer.source==='richwise'&&layer.rate===1),{primary,expectedVariant:firstChoice.variant,expectedPrimaryRate:firstChoice.rate,lowBody});
    if(scenario.cancel)check('pause_clears_pending_primary_and_accent_voices',result.audio.afterCancel.activeVoices===0,result.audio.afterCancel);
    if(capture&&['main_far_boom-a','main_far_crackle','sub_near_bang'].includes(scenario.id)){
      let binary='';for(let i=0;i<wav.length;i+=32768)binary+=String.fromCharCode(...wav.subarray(i,i+32768));captures[scenario.id]=btoa(binary);
    }
  }
  const baselineStress=[];
  for(const definition of [{id:'four_main',count:4,energy:1.15},{id:'double_energy2',count:2,energy:2},{id:'dense_48',count:48,energy:1.15}]){
    const {wav,...report}=await render({...definition,protectedBaseline:true,distance:0,seed:1,sameSeed:true});baselineStress.push(report);
    check('protected_baseline_'+definition.id+'_is_current_gain12_headroomPoint7',report.audio.relativeBurstGain===12&&report.audio.postCompressorHeadroomGain===.7&&report.audio.compressorAttackSeconds===.0005,{peak:report.peak,clippedSamples:report.clippedSamples,gain:report.audio.relativeBurstGain,headroom:report.audio.postCompressorHeadroomGain,attack:report.audio.compressorAttackSeconds});
  }
  const sources={};for(const file of sourceFiles)sources[file]=await hash(await fetch(new URL(file,import.meta.url)).then(r=>r.arrayBuffer()));
  check('runtime_sources_remained_stable_during_browser_run',Object.keys(initialSourceHashes).every(file=>initialSourceHashes[file]===sources[file]),{before:initialSourceHashes,after:sources});
  sources.protectedBaseline=await hash(await fetch(new URL('../baselines/r37-rejected-source-projection-reuse/fireworks-audio.js',import.meta.url)).then(r=>r.arrayBuffer()));
  return{schema:'glass-atoll.audio-palette-offline.v1',date:new Date().toISOString(),passed:checks.every(c=>c.passed),total:checks.length,passedCount:checks.filter(c=>c.passed).length,checks,reports,baselineStress,assets,sources,captures,conditions:{sampleRate,seconds,temperature,listener,forward,masterVolume:.75,graph:'actual production soundscape master + pyro buses; no copied mix equations',protectedBaseline:'Preserved pre-palette primary-only production factory, gain12/headroom.7/attack.0005; explicit unchanged main asset URL.'},limits:['Browser OfflineAudioContext verifies PCM and scheduling, not subjective listening or speaker calibration.','Sample peaks are Float32 pre-WAV, not intersample true peak.','Dense stress is bounded by current 24-source limiter; it intentionally discards excess events.']};
}
