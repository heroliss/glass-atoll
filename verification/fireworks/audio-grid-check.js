import {runFireworksAudioABCheck} from './audio-ab-check.js?grid=2';

const digest=async source=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(source))),x=>x.toString(16).padStart(2,'0')).join('');
export async function makeFireworksAudioFactoryForQA({burstGain,headroom,attack},baseSource=null){
  let source=baseSource??await fetch(new URL('./audio-a07-baseline.js',import.meta.url),{cache:'no-store'}).then(r=>r.text());
  function replace(from,to){if(source.indexOf(from)<0||source.indexOf(from)!==source.lastIndexOf(from))throw new Error('QA audio source marker changed: '+from);source=source.replace(from,to);}
  replace("kind==='burst'?3.60",`kind==='burst'?${burstGain.toFixed(5)}`);
  replace('headroom.gain.value=.80;',`headroom.gain.value=${headroom.toFixed(5)};`);
  replace('compressor.attack.value=.002;',`compressor.attack.value=${attack.toFixed(6)};`);
  replace('relativeBurstGain:3.6,',`relativeBurstGain:${burstGain},`);
  replace('postCompressorHeadroomGain:.8,',`postCompressorHeadroomGain:${headroom},`);
  source=source.replace('linear post-compressor headroom lowers all pyro SFX1.94dB;',`QA-only linear post-compressor gain ${headroom};`);
  const url=URL.createObjectURL(new Blob([source],{type:'text/javascript'}));
  try{const module=await import(url);return{factory:module.createFireworksAudio,parameters:{burstGain,headroom,attack},sourceSHA256:await digest(source)};}finally{URL.revokeObjectURL(url);}
}

// Bounded, in-memory variants. No runtime file or live AudioContext mutation.
// Screen18 variants with actual far/near cases; confirm at most3 with all4.
export async function runFireworksAudioGridCheck({gains=[7.2,10.8,12],headrooms=[.6,.7,.8],attacks=[.0005,0],confirmTop=3,progress=null}={}){
  if(gains.length*headrooms.length*attacks.length>24)throw new Error('QA grid limited to24 variants');
  confirmTop=Math.max(0,Math.min(3,Math.floor(confirmTop)));
  const baseSource=await fetch(new URL('./audio-a07-baseline.js',import.meta.url),{cache:'no-store'}).then(r=>r.text()),baseSourceSHA256=await digest(baseSource),screenCases=[{id:'far_318_single',distance:318.45,count:1},{id:'near_0_double',distance:0,count:2}];
  const referenceFactory=await makeFireworksAudioFactoryForQA({burstGain:3.6,headroom:.8,attack:.002},baseSource),reference=await runFireworksAudioABCheck({candidateFactory:referenceFactory.factory,includeBaseline:false,scenarioDefinitions:screenCases,capture:false}),referenceFar=reference.reports.find(r=>r.scenario==='far_318_single');
  const variants=[];for(const burstGain of gains)for(const headroom of headrooms)for(const attack of attacks)variants.push({burstGain,headroom,attack});
  const screened=[],factories=new Map();
  for(let i=0;i<variants.length;i++){
    const params=variants[i],made=await makeFireworksAudioFactoryForQA(params,baseSource),r=await runFireworksAudioABCheck({candidateFactory:made.factory,includeBaseline:false,scenarioDefinitions:screenCases,capture:false}),far=r.reports.find(x=>x.scenario==='far_318_single'),near=r.reports.find(x=>x.scenario==='near_0_double'),relativeDB=20*Math.log10(far.differenceFromAmbientRMS/referenceFar.differenceFromAmbientRMS);
    const eligible=r.passed&&far.whole.peak>=.35&&far.whole.peak<=.55&&near.whole.peak<.98&&relativeDB>=7.5&&relativeDB<=10.8;
    const item={parameters:params,farPeak:far.whole.peak,near0DoublePeak:near.whole.peak,far20msMixedToAmbient:far.maximum20msMixedToAmbientRatio,farDifferenceRMSGainRelativeA07DB:relativeDB,near0FullScaleSamples:near.whole.samplesAtOrBeyondFullScale,near0LongestNearlyConstantPeakRunSamples:near.whole.longestNearlyConstantPeakRunSamples,farFlatTopWarning:far.whole.potentialHardFlatTop,nearFlatTopWarning:near.whole.potentialHardFlatTop,actualPyroCompressor:near.pyroCompressor,actualHeadroom:near.audio.postCompressorHeadroomGain,actualBurstGain:near.audio.relativeBurstGain,actualRecordedPlays:near.audio.recordedPlays,runtimeChecksPassed:r.passed,eligible,sourceSHA256:made.sourceSHA256,candidateFactoryFunctionSHA256:r.candidateFactoryFunctionSHA256,score:Math.abs(relativeDB-9)+8*Math.max(0,near.whole.peak-.94)+Math.abs(far.whole.peak-.45)};
    screened.push(item);factories.set(item.sourceSHA256,made.factory);progress?.({phase:'screen',index:i+1,total:variants.length,result:item});
  }
  const shortlist=screened.filter(s=>s.eligible).sort((a,b)=>a.score-b.score).slice(0,confirmTop),confirmed=[];
  for(let i=0;i<shortlist.length;i++){
    const item=shortlist[i],r=await runFireworksAudioABCheck({candidateFactory:factories.get(item.sourceSHA256),includeBaseline:false,capture:false}),allNear=r.reports.filter(x=>x.distanceMetres<=24),far=r.reports.find(x=>x.scenario==='far_318_single');
    const accepted=r.passed&&allNear.every(x=>x.whole.peak<.98&&!x.whole.potentialHardFlatTop)&&far.whole.peak>=.35&&far.whole.peak<=.55;
    confirmed.push({parameters:item.parameters,sourceSHA256:item.sourceSHA256,accepted,fullActualReport:r});progress?.({phase:'confirm',index:i+1,total:shortlist.length,parameters:item.parameters,accepted});
  }
  return{date:new Date().toISOString(),baseSourceSHA256,runtimeUnchanged:true,reference:{parameters:referenceFactory.parameters,farPeak:referenceFar.whole.peak,far20msMixedToAmbient:referenceFar.maximum20msMixedToAmbientRatio,farDifferenceFromAmbientRMS:referenceFar.differenceFromAmbientRMS,actualReport:reference},screened,confirmed,suggested:confirmed.find(c=>c.accepted)?.parameters??null,limits:['QA factories compiled only in temporary Blob modules; runtime source remains A07 until parent explicitly selects a candidate','all actual audio uses original real clip, unchanged distance/delay/ambient and actual two compressor nodes','grid screens far318m single and near0m coherent double; shortlisted candidates additionally test318m double and24m double','flat-top warning detects>=8nearly identical peak samples; it is not a subjective timbre or intersample true-peak guarantee','A07 already passed technical checks but user rejected its impact; this grid cannot replace another same-volume listening A/B']};
}
