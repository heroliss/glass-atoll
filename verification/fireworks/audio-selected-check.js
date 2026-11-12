import {runFireworksAudioABCheck} from './audio-ab-check.js?selected=1';
import {createFireworksAudio as baselineFactory} from './audio-a07-baseline.js';

// Latest comparison uses the A07 version the user actually heard/rejected,
// not the much quieter original0.9/no-headroom source.
export async function runFireworksSelectedAudioCheck({candidateFactory,capture=true}={}){
  if(typeof candidateFactory!=='function')throw new Error('Pass a fresh cache-bust imported createFireworksAudio as candidateFactory');
  const report=await runFireworksAudioABCheck({candidateFactory,baselineFactory,baselineSourceURL:new URL('./audio-a07-baseline.js',import.meta.url),capture,scenarioDefinitions:[
    {id:'far_318_single',distance:318.45,count:1},
    {id:'far_318_double',distance:318.45,count:2},
    {id:'near_24_double',distance:24,count:2},
    {id:'near_0_double',distance:0,count:2},
    {id:'near_24_double_max_energy',distance:24,count:2,energy:1.15},
    {id:'near_0_double_max_energy',distance:0,count:2,energy:1.15},
  ]});
  const candidate=report.reports.filter(r=>r.variant==='candidate'),maxEnergy=candidate.filter(r=>r.eventEnergy===1.15),expected=candidate.every(r=>r.audio.relativeBurstGain===12&&r.audio.postCompressorHeadroomGain===.7&&Math.abs(r.pyroCompressor.attack-.0005)<1e-8);
  report.results.push({name:'selected_runtime_factory_is_gain12_headroomPoint7_attackPoint5ms',passed:expected,detail:candidate.map(r=>({scenario:r.scenario,gain:r.audio.relativeBurstGain,headroom:r.audio.postCompressorHeadroomGain,attack:r.pyroCompressor.attack}))});
  report.results.push({name:'maximum_legal_energy1p15_near_double_peak_belowPoint98_no_flat_top',passed:maxEnergy.length===2&&maxEnergy.every(r=>r.whole.peak<.98&&r.whole.samplesAtOrBeyondFullScale===0&&!r.whole.potentialHardFlatTop),detail:maxEnergy.map(r=>({scenario:r.scenario,peak:r.whole.peak,fullScaleSamples:r.whole.samplesAtOrBeyondFullScale,longestNearlyConstantPeakRunSamples:r.whole.longestNearlyConstantPeakRunSamples}))});
  report.total=report.results.length;report.passedCount=report.results.filter(r=>r.passed).length;report.passed=report.passedCount===report.total;report.comparisonBaseline='A07: gain3.6/postgain.8/attack2ms; user second listening rejected impact';report.scope='actual browser OfflineAudioContext, production clip/graphs, selected stronger runtime vs preserved A07; includes maximum current authored event energy1.15 coherent double';return report;
}
