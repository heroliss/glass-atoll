import {strict as assert} from 'node:assert';
import fs from 'node:fs';
import crypto from 'node:crypto';
import {createPyroSmokeEvents,PYRO_SMOKE_EVENT_DEFAULTS} from '../pyro-smoke-events.js';
import {createPyroSmokeState} from '../pyro-smoke-state.js';
import {createFireworksSimulation,createFireworkEvent} from '../fireworks-physics.js';
const started=performance.now(),checks=[],metrics={};
const check=(id,fn)=>{try{const evidence=fn();checks.push({id,passed:true,...(evidence===undefined?{}:{evidence})});}catch(error){checks.push({id,passed:false,error:error.stack});}};
const near=(a,b,t=1e-10)=>assert(Math.abs(a-b)<=t,`${a} != ${b} (${t})`),hash=value=>crypto.createHash('sha256').update(typeof value==='string'||Buffer.isBuffer(value)?value:JSON.stringify(value)).digest('hex');
const burst=(patch={})=>({kind:'burst',eventId:'42-0.00000',type:'peony',seed:42,time:0,position:[4,120,-7],energy:1,...patch});
function wrappedState(options={}){const state=createPyroSmokeState(options),packets=[];return{state,packets,sink:{queueEmission(p){const r=state.queueEmission(p);packets.push(structuredClone(p));return r;},diagnostics:()=>state.diagnostics()}};}
const settle=(s,time)=>{for(let guard=0;guard<100000;guard++){const d=s.advanceTo(time);if(d.completed)return d;}throw Error('State failed to catch up');};
function simple(events,options={}){const w=wrappedState(),emitter=createPyroSmokeEvents({state:w.sink,...options});emitter.consume(events,{throughTime:Math.max(0,...events.map(e=>e.time))});return{...w,emitter};}
check('default_sources_are_nine_packets_with_explicit_uncalibrated_reference_area',()=>{
  assert.deepEqual(PYRO_SMOKE_EVENT_DEFAULTS,{burstArea:20,launchArea:.35,fanLaunchArea:.1,bouquetLaunchArea:2,packetsPerEvent:9,packetSpacingSeconds:.075});
  const s=simple([burst()]);assert.equal(s.packets.length,9);assert(s.emitter.diagnostics().units.includes('NOT measured kg/PM'));assert.equal(s.emitter.diagnostics().parameters.burstArea,20);
});
check('burst_partition_conserves_total_reference_area_and_equal_kernel_weights',()=>{
  const s=simple([burst()]),sum=s.packets.reduce((a,p)=>a+p.mass,0),weights=s.packets.map(p=>p.mass/(20/9));assert.equal(sum,20);assert(Math.max(...weights)-Math.min(...weights)<2e-15);
  assert(s.packets.every(p=>p.profileId==='reference'&&p.temperatureExcessK===12&&p.buoyantVelocity===.35));settle(s.state,1);near(s.state.diagnostics().ledger.airborne,20);near(s.state.diagnostics().ledger.residual,0);
});
check('packet_birth_times_are_event_time_not_current_display_frame',()=>{
  const s=simple([burst({time:.12345})]);for(let i=0;i<9;i++)assert.equal(s.packets[i].time,.12345+i*.075);assert.equal(s.state.snapshot().pendingEmissions,9);
  assert.deepEqual(s.packets.map(p=>p.emissionId),[0,1,2,3,4,5,6,7,8]);assert.equal(s.packets.at(-1).time,.7234499999999999);
});
check('world_source_mean_and_bounded_initial_covariances_are_valid',()=>{
  const s=simple([burst()]),centre=[0,0,0];for(const p of s.packets){for(let i=0;i<3;i++)centre[i]+=p.mass*p.mean[i]/20;const d=Math.hypot(...p.mean.map((x,i)=>x-burst().position[i]));assert(d<=2.6+1e-12);assert(p.covariance.every(Number.isFinite));assert(p.covariance[0]>0&&p.covariance[4]>0&&p.covariance[8]>0);for(const i of [1,2,3,5,6,7])assert.equal(p.covariance[i],0);}
  for(let i=0;i<3;i++)near(centre[i],burst().position[i],2e-14);return{centroid:centre,maxPacketMeanRadiusMetres:Math.max(...s.packets.map(p=>Math.hypot(...p.mean.map((x,i)=>x-burst().position[i]))))};
});
check('isolated_derived_seed_is_deterministic_and_does_not_advance_star_RNG',()=>{
  const options={type:'ring',seed:9191},before=createFireworkEvent(options),a=simple([burst()]),b=simple([burst()]),after=createFireworkEvent(options);assert.deepEqual(a.packets,b.packets);assert.deepEqual(before,after);
  const c=simple([burst({seed:43})]);assert.notDeepEqual(a.packets.map(p=>p.mean),c.packets.map(p=>p.mean));assert.deepEqual(a.packets.map(p=>p.mass),c.packets.map(p=>p.mass));
});
check('audio_energy_is_not_read_as_smoke_mass_or_explosion_yield',()=>{
  const a=simple([burst({energy:.001})]),b=simple([burst({energy:1e12})]),c=simple([burst({energy:NaN})]);assert.deepEqual(a.packets,b.packets);assert.deepEqual(a.packets,c.packets);
});
check('all_eight_air_types_have_one_tube_launch_and_one_burst_source',()=>{
  const rows=[];for(const type of ['peony','chrysanthemum','willow','palm','ring','heart','crossette','strobe']){
    const event=createFireworkEvent({type,origin:[2,.7,3],seed:9}),events=event.events.map(e=>({...e,eventId:event.id})),s=simple(events);assert.equal(events.length,2);assert.equal(s.packets.length,18);near(s.emitter.diagnostics().referenceAreaQueuedLifetime,20.35);assert.equal(s.emitter.diagnostics().injectedEvents,2);rows.push({type,eventRecords:events.length,packets:s.packets.length,referenceArea:s.emitter.diagnostics().referenceAreaQueuedLifetime});
  }metrics.airTypes=rows;
});
check('real_fan_nine_launch_records_do_not_become_nine_shell_bursts',()=>{
  const event=createFireworkEvent({type:'fan',origin:[0,.7,0],seed:9}),events=event.events.map(e=>({...e,eventId:event.id})),s=simple(events);assert.equal(events.length,9);assert(events.every(e=>e.kind==='launch'));assert.equal(s.packets.length,81);near(s.emitter.diagnostics().referenceAreaQueuedLifetime,.9,1e-15);assert.equal(new Set(s.packets.map(p=>p.sourceId)).size,9);
});
check('real_bouquet_single_ground_launch_has_its_own_authored_area',()=>{
  const event=createFireworkEvent({type:'bouquet',origin:[0,.7,0],seed:9}),events=event.events.map(e=>({...e,eventId:event.id})),s=simple(events);assert.equal(events.length,1);assert.equal(events[0].kind,'launch');assert.equal(s.packets.length,9);near(s.emitter.diagnostics().referenceAreaQueuedLifetime,2);assert(s.packets.every(p=>p.mean[1]>.7));
  assert.throws(()=>simple([burst({type:'fan'})]));assert.throws(()=>simple([burst({type:'bouquet'})]));
});
check('same_batch_and_repeated_event_keys_are_idempotent',()=>{
  const w=wrappedState(),e=createPyroSmokeEvents({state:w.sink}),b=burst();e.consume([b,b],{throughTime:0});e.consume([b,b],{throughTime:0});assert.equal(w.packets.length,9);assert.equal(e.diagnostics().duplicates,3);assert.equal(e.diagnostics().injectedEvents,1);
});
check('conflicting_world_position_for_same_key_rejects_batch_atomically',()=>{
  const w=wrappedState(),e=createPyroSmokeEvents({state:w.sink}),before=hash(e.diagnostics());assert.throws(()=>e.stage([burst(),burst({position:[999,0,0]})]));assert.equal(hash(e.diagnostics()),before);assert.equal(w.packets.length,0);
  e.consume([burst()],{throughTime:0});const accepted=hash(e.diagnostics());assert.throws(()=>e.stage([burst({seed:43})]));assert.equal(hash(e.diagnostics()),accepted);
});
check('same_physical_time_new_ID_after_flush_is_legal_not_lost_to_watermark',()=>{
  const w=wrappedState(),e=createPyroSmokeEvents({state:w.sink});e.consume([burst()],{throughTime:0});e.consume([burst({eventId:'new-same-time'})],{throughTime:0});assert.equal(w.packets.length,18);assert.deepEqual(w.packets.map(p=>p.emissionId),Array.from({length:18},(_,i)=>i));assert.equal(e.diagnostics().injectedEvents,2);
});
check('same_time_different_ids_in_one_complete_batch_sort_deterministically',()=>{
  const a=simple([burst({eventId:'z'}),burst({eventId:'a'}),burst({eventId:'m'})]),b=simple([burst({eventId:'m'}),burst({eventId:'z'}),burst({eventId:'a'})]);assert.deepEqual(a.packets,b.packets);assert.deepEqual(a.emitter.diagnostics().recentSources.map(e=>e.eventId),['a','m','z']);
});
check('stage_chunk_order_does_not_change_closed_complete_batch_output',()=>{
  const events=[burst({eventId:'b',time:2}),burst({eventId:'a',time:1}),burst({eventId:'c',time:1})],a=simple(events),w=wrappedState(),e=createPyroSmokeEvents({state:w.sink});e.stage(events.slice(0,1));e.stage(events.slice(1).reverse());e.flushThrough(2);assert.deepEqual(a.packets,w.packets);
});
check('source_packets_may_interleave_in_time_while_ids_stay_monotonic',()=>{
  const a=simple([burst({time:0,eventId:'early'}),burst({time:.065,eventId:'later'})]);assert(a.packets[8].time>a.packets[9].time);assert.deepEqual(a.packets.map(p=>p.emissionId),Array.from({length:18},(_,i)=>i));settle(a.state,1);near(a.state.snapshot().ledger.airborne,40);assert.equal(a.state.snapshot().packets.length,18);
});
check('future_staged_event_is_not_injected_before_its_event_time',()=>{
  const w=wrappedState(),e=createPyroSmokeEvents({state:w.sink});e.stage([burst({time:2})]);e.flushThrough(1);assert.equal(w.packets.length,0);assert.equal(e.diagnostics().pendingEvents,1);e.flushThrough(2);assert.equal(w.packets.length,9);assert.equal(w.packets[0].time,2);
});
check('strictly_older_unknown_event_is_rejected_without_replay_or_retiming',()=>{
  const w=wrappedState(),e=createPyroSmokeEvents({state:w.sink});e.flushThrough(2);const r=e.consume([burst({time:1,eventId:'never-seen'})],{throughTime:2});assert.equal(r.staged.stale,1);assert.equal(w.packets.length,0);assert.equal(e.diagnostics().nextEmissionId,0);
});
check('clear_discards_old_future_packets_and_same_time_duplicate_but_accepts_new_ID',()=>{
  const old=wrappedState(),e=createPyroSmokeEvents({state:old.sink});e.consume([burst()],{throughTime:0});assert.equal(old.state.snapshot().pendingEmissions,8);
  const fresh=wrappedState();e.clearForState(fresh.sink,{time:0});e.consume([burst()],{throughTime:0});assert.equal(fresh.packets.length,0);e.consume([burst({eventId:'new-after-clear'})],{throughTime:0});assert.equal(fresh.packets.length,9);assert.equal(fresh.packets[0].emissionId,9);settle(fresh.state,1);near(fresh.state.snapshot().ledger.airborne,20);assert.equal(e.diagnostics().clears,1);
});
check('clear_tombstones_pending_or_future_staged_events_instead_of_replaying_them',()=>{
  const w=wrappedState(),e=createPyroSmokeEvents({state:w.sink});e.stage([burst({time:2})]);const fresh=wrappedState();e.clearForState(fresh.sink,{time:0});e.consume([burst({time:2})],{throughTime:2});assert.equal(fresh.packets.length,0);assert.equal(e.diagnostics().clearedPendingEvents,1);e.consume([burst({time:2,eventId:'new-future-id'})],{throughTime:2});assert.equal(fresh.packets.length,9);
});
check('clear_at4000_seconds_requires_matching_origin_and_never_replays_empty_history',()=>{
  const old=wrappedState(),e=createPyroSmokeEvents({state:old.sink});e.consume([burst()],{throughTime:0});const before=hash(e.diagnostics());assert.throws(()=>e.clearForState(wrappedState().sink,{time:4000}));assert.equal(hash(e.diagnostics()),before);
  const fresh=wrappedState({time:4000});e.clearForState(fresh.sink,{time:4000});e.consume([burst()],{throughTime:4000});assert.equal(fresh.packets.length,0);e.consume([burst({time:4000,eventId:'new-at4000'})],{throughTime:4000});assert.equal(fresh.packets.length,9);const advance=fresh.state.advanceTo(4000);assert.equal(advance.steps,0);assert.equal(advance.completed,true);assert.equal(advance.behindSeconds,0);settle(fresh.state,4000.65);assert(fresh.state.diagnostics().totalTickSteps<20);near(fresh.state.diagnostics().ledger.airborne,20);
});
check('seen_capacity_never_evicts_paused_time_keys_or_silently_replays_them',()=>{
  const w=wrappedState(),e=createPyroSmokeEvents({state:w.sink,maxPendingEvents:2,maxRememberedEvents:2});e.consume([burst({eventId:'a'}),burst({eventId:'b'})],{throughTime:0});assert.throws(()=>e.consume([burst({eventId:'c'})],{throughTime:0}));e.consume([burst({eventId:'a'})],{throughTime:0});assert.equal(w.packets.length,18);assert.equal(e.diagnostics().rememberedEvents,2);
  e.flushThrough(1);assert.equal(e.diagnostics().rememberedEvents,0);e.consume([burst({eventId:'a'})],{throughTime:1});assert.equal(w.packets.length,18);e.consume([burst({eventId:'c',time:1})],{throughTime:1});assert.equal(w.packets.length,27);
});
check('pending_capacity_and_invalid_batches_are_atomic_before_any_emission',()=>{
  const w=wrappedState(),e=createPyroSmokeEvents({state:w.sink,maxPendingEvents:1,maxRememberedEvents:2}),before=hash(e.diagnostics());assert.throws(()=>e.stage([burst({eventId:'a'}),burst({eventId:'b'})]));assert.equal(hash(e.diagnostics()),before);assert.equal(w.packets.length,0);
  for(const patch of [{time:NaN},{position:[NaN,1,2]},{position:[1,2]},{eventId:''},{seed:-1},{seed:.5},{kind:'not-a-source'},{type:'not-a-type'}]){assert.throws(()=>e.stage([burst(),burst(patch)]));assert.equal(hash(e.diagnostics()),before);}
});
check('invalid_configuration_and_state_shape_rejected',()=>{
  for(const options of [{state:null},{state:{queueEmission(){}}},{state:wrappedState().sink,burstArea:-1},{state:wrappedState().sink,launchArea:Infinity},{state:wrappedState().sink,maxPendingEvents:0},{state:wrappedState().sink,maxPendingEvents:4,maxRememberedEvents:2},{state:wrappedState().sink,profileId:''}])assert.throws(()=>createPyroSmokeEvents(options));
});
check('caller_mutation_does_not_relocate_staged_source_or_expose_internal_history',()=>{
  const w=wrappedState(),e=createPyroSmokeEvents({state:w.sink}),input=burst();e.stage([input]);input.position[0]=999;e.flushThrough(0);near(w.packets.reduce((s,p)=>s+p.mass*p.mean[0],0)/20,4,1e-14);const d=e.diagnostics();d.recentSources[0].position[0]=777;d.parameters.burstArea=333;assert.equal(e.diagnostics().recentSources[0].position[0],4);assert.equal(e.diagnostics().parameters.burstArea,20);
});
check('late_source_is_not_shifted_to_current_state_clock_or_partially_injected',()=>{
  const w=wrappedState();settle(w.state,1);const e=createPyroSmokeEvents({state:w.sink});e.stage([burst({time:.5})]);const old=hash(w.state.snapshot());assert.throws(()=>e.flushThrough(1));assert.equal(w.packets.length,0);assert.equal(hash(w.state.snapshot()),old);assert.equal(e.diagnostics().nextEmissionId,0);
});
check('watermark_and_clear_refuse_rewind',()=>{
  const w=wrappedState(),e=createPyroSmokeEvents({state:w.sink});e.flushThrough(2);assert.throws(()=>e.flushThrough(1));assert.throws(()=>e.consume([],{throughTime:1}));assert.throws(()=>e.clearForState(w.sink,{time:1}));
});
check('queue_failure_is_explicit_fault_locked_and_clear_prevents_partial_source_replay',()=>{
  const old=wrappedState({maxPendingEmissions:1}),e=createPyroSmokeEvents({state:old.sink});e.stage([burst({time:1})]);assert.throws(()=>e.flushThrough(1));assert.equal(old.packets.length,1);assert.equal(e.diagnostics().fault.acceptedPackets,1);assert.equal(e.diagnostics().nextEmissionId,1);assert.throws(()=>e.flushThrough(1));assert.equal(old.packets.length,1);
  const fresh=wrappedState({time:1});e.clearForState(fresh.sink,{time:1});e.consume([burst({time:1})],{throughTime:1});assert.equal(fresh.packets.length,0);e.consume([burst({time:1,eventId:'fresh'})],{throughTime:1});assert.equal(fresh.packets[0].emissionId,1);assert.equal(fresh.packets.length,9);
});
check('binding_existing_state_continues_its_emission_id_sequence',()=>{
  const w=wrappedState();w.state.queueEmission({time:0,emissionId:7,mass:1,mean:[0,0,0],covariance:[1,0,0,0,1,0,0,0,1]});const e=createPyroSmokeEvents({state:w.sink});e.consume([burst()],{throughTime:0});assert.equal(w.packets[0].emissionId,8);assert.equal(e.diagnostics().nextEmissionId,17);
});
check('new_adapter_bound_to_existing_sources_cannot_alias_the_old_source_ID',()=>{
  const w=wrappedState(),a=createPyroSmokeEvents({state:w.sink});a.consume([burst()],{throughTime:0});const b=createPyroSmokeEvents({state:w.sink});b.consume([burst({eventId:'independent-new-source'})],{throughTime:0});assert.equal(new Set(w.packets.map(p=>p.sourceId)).size,2);assert.equal(new Set(w.packets.map(p=>p.emissionId)).size,18);assert.equal(w.packets[9].emissionId,9);
});
check('zero_authored_source_area_is_disabled_without_zero_mass_packets',()=>{
  const s=simple([burst()],{burstArea:0});assert.equal(s.packets.length,0);assert.equal(s.emitter.diagnostics().injectedEvents,1);assert.equal(s.emitter.diagnostics().referenceAreaQueuedLifetime,0);s.emitter.consume([burst()],{throughTime:0});assert.equal(s.emitter.diagnostics().duplicates,1);
});
function replay(fps){
  const sim=createFireworksSimulation({origin:[3,.7,4],seed:8123}),w=wrappedState({wind:[2,0,.5]}),emitter=createPyroSmokeEvents({state:w.sink}),events=[],duration=30;
  sim.configure({azimuth:23,elevation:80,autoDirection:false});
  for(let i=0;i<=fps*duration;i++){const time=i/fps;sim.update({time,windVector:[2,0,.5]});if(i===0)sim.launch({type:'peony',seed:17});if(i===fps/5)sim.launch({type:'fan',seed:19});if(i===4*fps/5)sim.launch({type:'ring',seed:23});const drained=sim.drainEvents();events.push(...structuredClone(drained));emitter.consume(drained,{throughTime:time});settle(w.state,time);}
  return{fps,events,packets:w.packets,state:w.state.snapshot(),source:emitter.diagnostics()};
}
const replays=[30,60,120].map(replay);
check('actual_drain_world_events_match_at_30_60_120Hz',()=>{
  assert.deepEqual(replays[0].events,replays[1].events);assert.deepEqual(replays[0].events,replays[2].events);assert(replays[0].events.some(e=>e.kind==='burst'&&Math.abs(e.position[0]-3)>1));return{events:replays[0].events.length,wind:[2,0,.5],worldPositionIncludesFlightWind:true};
});
check('actual_streamed_emission_ids_seeds_births_and_packet_fields_are_rate_invariant',()=>{
  assert.deepEqual(replays[0].packets,replays[1].packets);assert.deepEqual(replays[0].packets,replays[2].packets);metrics.replay=replays.map(r=>({fps:r.fps,eventRecords:r.events.length,sourcePackets:r.packets.length,packetsSHA256:hash(r.packets),stateSHA256:hash(r.state),referenceArea:r.source.referenceAreaQueuedLifetime}));
});
check('actual_downstream_physical_state_is_identical_for_streamed_30_60_120Hz',()=>{
  assert.deepEqual(replays[0].state,replays[1].state);assert.deepEqual(replays[0].state,replays[2].state);near(replays[0].state.ledger.airborne,41.6,1e-11);
});
check('one_off_complete_batch_equals_the_real_streamed_source_and_state',()=>{
  const w=wrappedState({wind:[2,0,.5]}),e=createPyroSmokeEvents({state:w.sink});e.stage([...replays[0].events].reverse());e.flushThrough(30);settle(w.state,30);assert.deepEqual(w.packets,replays[0].packets);assert.deepEqual(w.state.snapshot(),replays[0].state);
});
check('no_wind_30min_state_keeps_mass_without_source_age_fade_or_active_slot_extension',()=>{
  const s=simple([burst()]);settle(s.state,1800);const d=s.state.diagnostics();near(d.ledger.airborne,20);assert.equal(d.packetCount,9);assert.equal(d.acceptedSources,9);assert.equal(d.merges,0);assert.equal(s.emitter.diagnostics().injectedEvents,1);assert(s.state.snapshot().packets.every(p=>p.mass>0&&p.mean.every(Number.isFinite)&&p.covariance[0]>1000));metrics.stillAir30min={mass:d.ledger.airborne,packetCount:d.packetCount,stateTime:d.time};
});
check('long_stream_keeps_identity_and_recent_logs_bounded_without_old_replay',()=>{
  let lastEmissionId=-1,packets=0;const sink={diagnostics:()=>({time:0,lastEmissionId}),queueEmission(p){assert(p.emissionId>lastEmissionId);lastEmissionId=p.emissionId;packets++;return{accepted:true};}},e=createPyroSmokeEvents({state:sink,maxPendingEvents:4,maxRememberedEvents:8});
  for(let i=0;i<3000;i++)e.consume([burst({time:i,eventId:'stream-'+i,seed:i})],{throughTime:i});const d=e.diagnostics();assert(d.rememberedEvents<=8&&d.pendingEvents===0&&d.recentSources.length===32);assert.equal(packets,27000);e.consume([burst({eventId:'stream-0',seed:0})],{throughTime:2999});assert.equal(packets,27000);assert.equal(e.diagnostics().staleEvents,1);metrics.identityStress={events:3000,packets,rememberedEvents:d.rememberedEvents,peakRememberedAndPendingKeys:d.peakRememberedAndPendingKeys,recentLog:d.recentSources.length,note:'adapter-only counting sink, not a scene/state/GPU performance test'};
});
const files=['../pyro-smoke-events.js','../pyro-smoke-state.js','../fireworks-physics.js','./pyro-smoke-events-check.mjs'],sourceSHA256=Object.fromEntries(files.map(file=>[file,hash(fs.readFileSync(new URL(file,import.meta.url)))]));
const report={schema:'glass-atoll.pyro-smoke-events-check.v1',dateUTC:new Date().toISOString(),runtimeIntegration:false,noGPUOrBrowser:true,passed:checks.every(c=>c.passed),counts:{checks:checks.length,passed:checks.filter(c=>c.passed).length},checks,metrics,sourceSHA256,nodeMilliseconds:performance.now()-started,limits:['authored reference area/relative source units, not kg or measured PM, audio energy or explosive yield','actual production CPU events and state; no main/renderer/visual/GPU acceptance','same-time new events after a completed flush use actual arrival order; complete timestamped input batches are sorted deterministically','exactly-once memory is bounded: same-watermark overflow rejects explicitly; unknown older inputs are stale','clearForState means caller replaces cleared physical state; adapter preserves IDs/tombstones','Gaussian/thermal/diffusion and capacity-merge limits remain those of pyro-smoke-state; no CFD or settled-deposition claim']};
fs.writeFileSync(new URL('./pyro-smoke-events-check.json',import.meta.url),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({passed:report.passed,counts:report.counts,failed:checks.filter(c=>!c.passed),metrics:report.metrics,sourceSHA256,nodeMilliseconds:report.nodeMilliseconds},null,2));if(!report.passed)process.exitCode=1;
