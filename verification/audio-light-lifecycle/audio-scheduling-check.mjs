import {strict as assert} from 'node:assert';
import {readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {createFireworksAudio,fireworkSoundChoice,FIREWORK_AUDIO_MIX,synthFireworkPCM,acousticArrival} from '../../fireworks-audio.js';

// Scheduling/lifecycle checks do not render sound. The separate browser PCM
// check verifies the actual graph and the shared final peak protection.
const checks=[];
async function test(name,run){try{checks.push({name,passed:true,evidence:await run()});}catch(error){checks.push({name,passed:false,error:error.stack});}}
const oldFetch=globalThis.fetch;
globalThis.fetch=async()=>({ok:true,arrayBuffer:async()=>new ArrayBuffer(8)});
function rig(){
  const sources=[],nodes=[],decoded=[],warnings=[],output={connect(){},disconnect(){}};
  let enabled=true,ready=true;
  function node(kind,extras={}){const n={kind,connections:[],connect(target){this.connections.push(target);},disconnect(){this.connections=[];},...extras};nodes.push(n);return n;}
  const context={currentTime:0,sampleRate:24000,
    createGain(){return node('gain',{gain:{value:1,cancelScheduledValues(){},setTargetAtTime(){}}});},
    createDynamicsCompressor(){return node('compressor',{threshold:{},knee:{},ratio:{},attack:{},release:{}});},
    createBufferSource(){const source=node('source',{playbackRate:{value:1},start(when){this.when=when;},stop(when){this.stopped=when;}});sources.push(source);return source;},
    createBiquadFilter(){return node('filter',{frequency:{value:0},Q:{value:0}});},
    createPanner(){return node('panner',{positionX:{value:0},positionY:{value:0},positionZ:{value:0}});},
    createBuffer(channels,length,sampleRate){return{duration:length/sampleRate,sampleRate,copyToChannel(){}};},
    async decodeAudioData(){const buffer={duration:3.4,id:decoded.length};decoded.push(buffer);return buffer;},
  };
  const helper=createFireworksAudio({getContext:()=>context,getOutput:()=>ready?output:null,isEnabled:()=>enabled,onWarning:message=>warnings.push(message)});
  return{helper,sources,nodes,decoded,warnings,context,setEnabled:value=>{enabled=value;},setReady:value=>{ready=value;},finish(){for(const source of sources)source.onended?.();}};
}
const event=(i=0,extra={})=>({eventId:'mechanic-'+i,kind:'burst',type:'peony',time:1,position:[0,0,-300],energy:1,seed:i+1,...extra});
try{
  await test('unready_output_can_initialize_later_using_same_context',async()=>{const r=rig();try{r.setReady(false);assert.equal(await r.helper.prepare(),false);assert.equal(r.nodes.length,0);r.setReady(true);assert.equal(await r.helper.prepare(),true);assert.equal(r.helper.diagnostics().outputReady,true);assert.equal(r.decoded.length,6);return{decoded:r.decoded.length,outputReady:true};}finally{r.helper.dispose();}});
  await test('batch_primary_priority_retains_24_distinct_events_and_no_accents',async()=>{const r=rig();try{await r.helper.enqueue(Array.from({length:48},(_,i)=>event(i)));const d=r.helper.diagnostics();assert.equal(d.scheduled,24);assert.equal(d.voiceLimitDrops,24);assert.equal(d.discarded,24);assert.equal(d.activeVoices,24);assert.equal(d.accentPlays,0);assert.equal(new Set(d.recentLayers.map(l=>l.eventId)).size,24);r.finish();assert.equal(r.helper.diagnostics().activeVoices,0);return{scheduled:d.scheduled,dropped:d.voiceLimitDrops,retired:r.helper.diagnostics().activeVoices};}finally{r.helper.dispose();}});
  await test('pause_stops_all_future_primary_body_and_two_tail_sources',async()=>{const r=rig();try{await r.helper.enqueue(event(0,{type:'willow'}));const d=r.helper.diagnostics();assert.equal(d.activeVoices,4);assert.deepEqual(Object.keys(d.layerPlays).sort(),['crackle-tail','late-crackle','low-body','primary']);r.helper.update({paused:true});assert.equal(r.helper.diagnostics().activeVoices,0);assert.ok(r.sources.every(s=>s.stopped===.04));return{layers:d.layerPlays,allSourcesStopped:true};}finally{r.helper.dispose();}});
  await test('selected_variant_is_the_primary_and_all_layers_share_spatial_origin',async()=>{const r=rig();try{const e=event(7,{position:[125,75,-300]});await r.helper.enqueue(e);const choice=fireworkSoundChoice(e),d=r.helper.diagnostics();assert.equal(d.lastArrival.source,choice.variant);assert.equal(d.recentLayers[0].source,choice.variant);assert.equal(d.recentLayers[0].gain,FIREWORK_AUDIO_MIX.primaryGains[choice.variant]);const panners=r.nodes.filter(n=>n.kind==='panner');assert.ok(panners.every(p=>[p.positionX.value,p.positionY.value,p.positionZ.value].every((v,i)=>v===e.position[i])));const a=acousticArrival(e);assert.ok(Math.abs(d.recentLayers[0].time-a.arrival)<.1);return{variant:choice.variant,origin:e.position,physicalArrival:a.arrival,scheduled:d.recentLayers[0].time,panners:panners.length};}finally{r.helper.dispose();}});
  await test('aerial_launch_has_ascent_and_ground_fan_does_not_add_it',async()=>{const r=rig();try{await r.helper.enqueue([event(0,{kind:'launch',type:'display-flower'}),event(1,{kind:'launch',type:'display-vfan'})]);const d=r.helper.diagnostics();assert.equal(d.synthesizedPlays,2);assert.equal(d.layerPlays.ascent,1);assert.equal(r.sources.length,3);return{primaries:d.synthesizedPlays,ascent:d.layerPlays.ascent};}finally{r.helper.dispose();}});
  await test('old_events_and_muted_events_are_discarded_without_late_replay',async()=>{const r=rig();try{await r.helper.enqueue(event(0,{time:-10}),{time:0});assert.equal(r.helper.diagnostics().staleDrops,1);r.setEnabled(false);await r.helper.enqueue(event(1));r.setEnabled(true);await r.helper.enqueue([]);assert.equal(r.sources.length,0);assert.equal(r.helper.diagnostics().discarded,2);return{sources:r.sources.length,discarded:2};}finally{r.helper.dispose();}});
  await test('all_failed_recordings_schedule_honestly_labelled_synthesized_fallbacks',async()=>{const r=rig(),savedFetch=globalThis.fetch;try{globalThis.fetch=async()=>({ok:false,status:503});await r.helper.enqueue([event(0),event(1,{kind:'crackle'})]);const d=r.helper.diagnostics();assert.equal(d.scheduled,2);assert.equal(d.recordedPlays,0);assert.equal(d.synthesizedPlays,2);assert.deepEqual(d.variantPlays,{});assert.deepEqual(d.recentLayers.map(l=>l.source),['synthesis-burst','synthesis-crackle']);assert.equal(d.lastArrival.source,'synthesis-crackle');assert.equal(r.warnings.length,6);return{sources:d.recentLayers.map(l=>l.source),recorded:d.recordedPlays,synthesized:d.synthesizedPlays,warnings:r.warnings.length};}finally{globalThis.fetch=savedFetch;r.helper.dispose();}});
  await test('four_synthesized_kinds_are_finite_repeatable_and_fade_out',()=>{const out={};for(const kind of ['launch','ascent','burst','crackle']){const a=synthFireworkPCM(kind,24000,83),b=synthFireworkPCM(kind,24000,83);assert.deepEqual(a.data,b.data);assert.ok(a.data.every(v=>Number.isFinite(v)&&Math.abs(v)<=.781));assert.ok(Math.abs(a.data.at(-1))<.004);out[kind]={duration:a.duration};}return out;});
}finally{globalThis.fetch=oldFetch;}
const sourceHash=createHash('sha256').update(await readFile(new URL('../../fireworks-audio.js',import.meta.url))).digest('hex');
const report={schema:'glass-atoll.audio-scheduling.v1',date:new Date().toISOString(),passed:checks.every(c=>c.passed),total:checks.length,passedCount:checks.filter(c=>c.passed).length,checks,sourceHash,limits:'Mock AudioNodes verify production event scheduling, priority and cancellation. Browser PCM render and human listening are separate.'};
await writeFile(new URL('./audio-scheduling-check.json',import.meta.url),JSON.stringify(report,null,2));
console.log(JSON.stringify(report,null,2));
if(!report.passed)process.exitCode=1;
