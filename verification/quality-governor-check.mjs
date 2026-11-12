/** Deterministic workload/response checks of the actual pure governor module.
 * Run: node verification/quality-governor-check.mjs
 * This tests controller behavior, not hardware performance or a 60 fps promise.
 */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {createQualityGovernor} from '../quality-governor.js';

const directory=path.dirname(fileURLToPath(import.meta.url));
const project=path.dirname(directory);
const checks=[],dt=1/60;
const add=(id,passed,details={})=>checks.push({id,passed:Boolean(passed),...details});
const close=(a,b,tolerance=1e-10)=>Number.isFinite(a)&&Math.abs(a-b)<=tolerance;
function fixture(options={}) {
  const events=[];let age=0;
  const governor=createQualityGovernor({...options,onScale:scale=>events.push({age,scale})});
  function frame(sample={}) {
    const delta=sample.delta??dt;age+=Number.isFinite(delta)&&delta>0?delta:0;
    governor.update({delta,gpuMs:8,cpuMs:1,frameMs:1000/60,...sample});
  }
  function run(seconds,sample={}) {
    const count=Math.round(seconds/dt);
    for(let i=0;i<count;i++)frame(typeof sample==='function'?sample(governor.state,i):sample);
  }
  return {governor,events,frame,run,get age(){return age;}};
}

// Shader warm-up may be expensive while the settled scene is fast.
{
  const f=fixture();f.run(5.9,{gpuMs:80,cpuMs:120});
  add('initial_shader_warmup_does_not_reduce_resolution',f.governor.state.scale===1&&f.events.length===0,{state:f.governor.state});
  f.run(12);
  add('warmup_samples_do_not_poison_settled_ewma',f.events.length===0&&close(f.governor.state.smoothedCostMs,8),{state:f.governor.state});
}

// delta was measured before frame work, so a compilation stall's cpuMs can be
// very large while this frame's input delta is still the preceding 1/60 s.
for(const cpuMs of [250,1000,2000,5000]) {
  const f=fixture();f.run(10);f.frame({cpuMs});f.run(10);
  add(`isolated_${cpuMs}ms_cpu_stall_does_not_reduce_resolution`,f.events.length===0&&f.governor.state.scale===1,{events:f.events,finalCostMs:f.governor.state.smoothedCostMs});
}
{
  const f=fixture();f.run(10);f.frame({gpuMs:2000});f.run(10);
  add('isolated_gpu_timer_outlier_does_not_reduce_resolution',f.events.length===0,{events:f.events});
}

// An independent physical workload model: fragment cost follows pixel count,
// i.e. square of linear resolution scale. Closed-loop feedback must settle.
const closedLoop=[];
for(const nativeCostMs of [20,24,32,38]) {
  const f=fixture();
  f.run(60,state=>({gpuMs:nativeCostMs*state.scale**2}));
  const final=f.governor.state,cost=nativeCostMs*final.scale**2;
  const monotone=f.events.every((event,i)=>event.scale<(i?f.events[i-1].scale:1));
  add(`pixel_cost_${nativeCostMs}ms_settles_within_budget`,f.events.length>0&&cost<=15.1&&final.scale>=.6&&final.scale<=1&&monotone,{finalScale:final.scale,finalCostMs:cost,events:f.events});
  const before=f.events.length;f.run(30,state=>({gpuMs:nativeCostMs*state.scale**2}));
  add(`pixel_cost_${nativeCostMs}ms_has_no_settled_oscillation`,f.events.length===before,{finalScale:f.governor.state.scale,eventCount:f.events.length});
  closedLoop.push({nativeCostMs,finalScale:final.scale,finalCostMs:cost});
}
{
  const f=fixture();f.run(50,{gpuMs:120});
  add('unsatisfiable_load_stops_at_minimum_scale',f.governor.state.scale===.6&&f.events.every(e=>e.scale>=.6),{state:f.governor.state,events:f.events,notes:'Resolution alone cannot satisfy this fixed-cost workload; reaching the minimum is not a 60 fps guarantee.'});
}
{
  const f=fixture({minScale:.45});f.run(60,state=>({gpuMs:70*state.scale**2}));
  add('configured_minimum_is_respected',f.governor.state.scale>=.45&&70*f.governor.state.scale**2<=15.1,{state:f.governor.state});
}
{
  const f=fixture();f.run(10);f.run(1.6,{gpuMs:40});
  add('short_overload_does_not_trigger_a_downshift',f.events.length===0,{events:f.events});
  f.run(4,{gpuMs:40});
  add('sustained_overload_eventually_triggers_a_downshift',f.events.length>0&&f.governor.state.scale<1,{events:f.events});
}

// Recovery must require a continuous healthy period, then rise by small steps.
{
  const f=fixture({scale:.7});f.run(13.8);
  add('recovery_waits_for_warmup_and_eight_healthy_seconds',f.events.length===0&&f.governor.state.scale===.7,{events:f.events});
  f.run(.5);
  add('recovery_begins_after_the_healthy_window',f.events.length===1&&close(f.events[0].scale,.725),{events:f.events});
  f.run(80);
  const separated=f.events.every((e,i)=>i===0||e.age-f.events[i-1].age>=10.9);
  const gradual=f.events.every((e,i)=>close(e.scale-(i?f.events[i-1].scale:.7),.025,1e-9));
  add('recovery_is_gradual_and_does_not_chatter',separated&&gradual,{events:f.events});
}
{
  const f=fixture({scale:.7});f.run(12,{gpuMs:8});f.run(4,{gpuMs:13});
  const splitTime=f.age;f.run(5,{gpuMs:8});
  add('interrupted_health_does_not_reuse_the_old_recovery_window',f.events.length===0,{events:f.events,splitTime});
  f.run(8,{gpuMs:8});
  add('health_recovers_after_a_new_continuous_window',f.events.length>0,{events:f.events});
}

{
  const f=fixture();f.run(30,{gpuMs:50});
  const count=f.events.length;f.governor.setEnabled(false);
  add('disabling_restores_native_resolution_once',f.governor.state.scale===1&&!f.governor.state.enabled&&f.events.length===count+1&&f.events.at(-1).scale===1,{state:f.governor.state,events:f.events});
  f.run(30,{gpuMs:80});
  add('disabled_governor_ignores_heavy_load',f.governor.state.scale===1&&f.events.length===count+1,{state:f.governor.state});
  f.governor.setEnabled(true);f.run(5.9,{gpuMs:80});
  add('reenabling_restarts_warmup',f.events.length===count+1,{state:f.governor.state});
}

{
  const f=fixture();f.run(10);const before=JSON.stringify(f.governor.state);
  for(const delta of [NaN,Infinity,-1,0,120])f.frame({delta,gpuMs:1000,cpuMs:5000});
  add('invalid_delta_and_hidden_long_gap_leave_state_unchanged',JSON.stringify(f.governor.state)===before,{state:f.governor.state});
  f.frame({gpuMs:NaN,cpuMs:NaN});f.frame({gpuMs:Infinity,cpuMs:NaN});f.run(10);
  add('nan_cost_inputs_do_not_corrupt_future_control',f.governor.state.scale===1&&Number.isFinite(f.governor.state.smoothedCostMs)&&f.events.length===0,{state:f.governor.state});
}
{
  const f=fixture();f.run(30,{gpuMs:undefined,cpuMs:20,frameMs:20});
  add('cpu_frame_fallback_operates_without_gpu_timing',f.governor.state.scale<1&&f.governor.state.scale>=.6,{state:f.governor.state});
}

// A deterministic presentation workload: one 23 ms interval every 12 frames,
// approximately 8.33% slow frames, with otherwise 10 ms presentation intervals.
// delta uses each actual interval, independently from the reported GPU cost.
function runPaced(f,seconds,{gpuMs=10,period=12,normalMs=10,slowMs=23,stopAfterFirstChange=false}={}) {
  const until=f.age+seconds;let frame=0;
  while(f.age<until){
    const frameMs=frame++%period===0?slowMs:normalMs;
    f.frame({delta:frameMs/1000,frameMs,gpuMs,cpuMs:1});
    if(stopAfterFirstChange&&f.events.length)break;
  }
}
const pacingScenarios=[];
{
  const f=fixture();f.run(12,{gpuMs:10});f.frame({delta:.023,frameMs:23,gpuMs:10});f.run(30,{gpuMs:10});
  add('isolated_slow_presentation_frame_does_not_reduce_resolution',f.events.length===0&&f.governor.state.scale===1,{state:f.governor.state});
}
{
  const f=fixture();f.run(12,{gpuMs:10});f.frame({delta:dt,frameMs:5000,cpuMs:5000,gpuMs:10});f.run(30,{gpuMs:10});
  add('isolated_multisecond_stall_is_not_sustained_pacing_pressure',f.events.length===0,{state:f.governor.state,events:f.events});
}
{
  const f=fixture();f.run(12,{gpuMs:10});
  // Four slow frames in a full 120-frame window remain below the >4% trigger.
  for(let i=0;i<4;i++)f.frame({delta:.023,frameMs:23,gpuMs:10});
  f.run(30,{gpuMs:10});
  add('subthreshold_slow_frame_burst_does_not_reduce_resolution',f.events.length===0,{state:f.governor.state});
}
{
  const f=fixture();runPaced(f,35,{gpuMs:10});
  const reasons=f.governor.state.changes.map(event=>event.reason);
  add('sustained_eight_percent_slow_frames_with_gpu_10ms_reduce_scale',f.events.length>0&&f.governor.state.scale<1&&reasons.every(reason=>reason==='frame pacing'),{state:f.governor.state,events:f.events,slowFractionInput:1/12});
  add('pacing_downshifts_remain_bounded_and_separated',f.events.every((event,i)=>event.scale>=.6&&event.scale<(i?f.events[i-1].scale:1)&&(i===0||event.age-f.events[i-1].age>=4.7)),{events:f.events});
  pacingScenarios.push({name:'GPU 10 ms with 8.33% slow presentation',events:f.events,final:f.governor.state});
}
{
  const f=fixture();runPaced(f,90,{gpuMs:3});
  add('os_presentation_stalls_with_gpu_3ms_do_not_blindly_reduce_scale',f.events.length===0&&f.governor.state.scale===1,{state:f.governor.state,slowFractionInput:1/12});
  pacingScenarios.push({name:'GPU 3 ms with 8.33% slow presentation',events:f.events,final:f.governor.state});
}
{
  const f=fixture();runPaced(f,20,{gpuMs:10,stopAfterFirstChange:true});
  const first=f.events[0],scale=first?.scale;
  f.run(44.8,{gpuMs:10});
  add('pacing_downshift_holds_recovery_for_45_seconds',Boolean(first)&&f.events.length===1&&f.governor.state.scale===scale,{events:f.events,state:f.governor.state});
  f.run(7.9,{gpuMs:10});
  add('pacing_recovery_still_requires_eight_healthy_seconds_after_hold',f.events.length===1,{events:f.events});
  f.run(1,{gpuMs:10});
  const recovered=f.events[1];
  add('pacing_recovery_is_small_and_has_no_immediate_oscillation',Boolean(recovered)&&f.events.length===2&&close(recovered.scale-scale,.025,1e-9)&&recovered.age-first.age>=52.9,{events:f.events,state:f.governor.state});
  pacingScenarios.push({name:'Pacing downshift then GPU 10 ms with healthy presentation',events:f.events,final:f.governor.state});
}
{
  const f=fixture();runPaced(f,20,{gpuMs:10,stopAfterFirstChange:true});
  const first=f.events[0];f.run(16,{gpuMs:3});
  const recovered=f.events[1];
  add('very_low_gpu_load_allows_gradual_recovery_before_45_second_hold',Boolean(first)&&Boolean(recovered)&&recovered.age-first.age<20&&recovered.age-first.age>=10.8&&close(recovered.scale-first.scale,.025,1e-9),{events:f.events,state:f.governor.state});
}

// Advanced image settings may spend twice the 60 Hz budget without downscaling.
{
  const f=fixture({targetFps:30});f.run(45,{gpuMs:24,frameMs:1000/30});
  add('30fps_reference_retains_native_at_24ms',f.governor.state.scale===1&&f.events.length===0,{state:f.governor.state});
  f.run(40,state=>({gpuMs:46*state.scale**2,frameMs:1000/30}));
  add('30fps_reference_controls_sustained_46ms_load',f.governor.state.scale<1&&46*f.governor.state.scale**2<=30.2,{state:f.governor.state});
  f.governor.setTargetFps(60);f.run(45,state=>({gpuMs:24*state.scale**2}));
  add('switching_reference_to_60fps_rebalances_load',24*f.governor.state.scale**2<=15.1&&f.governor.state.targetFps===60,{state:f.governor.state});
}
{
  const f=fixture({scale:.78});f.governor.setTargetFps(30);
  add('lower_reference_immediately_restores_available_pixel_budget',f.governor.state.scale===1&&f.events.length===1,{state:f.governor.state});
  f.governor.setTargetFps(60);
  add('higher_reference_does_not_guess_a_downshift_before_measurement',f.governor.state.scale===1&&f.events.length===1,{state:f.governor.state});
}
const result={
  generatedAt:new Date().toISOString(),kind:'deterministic pure-module controller checks',
  sourceHashes:Object.fromEntries(['quality-governor.js','verification/quality-governor-check.mjs'].map(name=>[name,crypto.createHash('sha256').update(fs.readFileSync(path.join(project,name))).digest('hex')])),
  passed:checks.every(x=>x.passed),passedCount:checks.filter(x=>x.passed).length,total:checks.length,
  closedLoop,pacingScenarios,checks,
  limitations:['No browser, real GPU, compositor or display timing was measured.','Continuous-load tests deliver fresh timing values each simulation frame; stale asynchronous timing reuse is an integration concern.','Resolution cannot fix all CPU, fixed-cost GPU or operating-system stalls.']
};
fs.writeFileSync(path.join(directory,'quality-governor-check.json'),JSON.stringify(result,null,2)+'\n');
console.log(JSON.stringify({passed:result.passed,passedCount:result.passedCount,total:result.total,failures:checks.filter(x=>!x.passed)},null,2));
if(!result.passed)process.exitCode=1;
