import {strict as assert} from 'node:assert';
import {writeFile} from 'node:fs/promises';
import {AudioPeakKernel} from '../../audio-peak-kernel.js';
import {createAudioPeakGuard} from '../../audio-peak-guard.js';
const checks=[];
function check(name,fn){try{const detail=fn();checks.push({name,passed:true,detail});}catch(error){checks.push({name,passed:false,error:error.message});}}
function render(input,options={},blockSize=128){
  const kernel=new AudioPeakKernel(options),output=input.map(a=>new Float32Array(a.length));
  for(let at=0;at<input[0].length;at+=blockSize)kernel.process(input.map(a=>a.subarray(at,at+blockSize)),output.map(a=>a.subarray(at,at+blockSize)));
  return{kernel,output};
}
check('below_ceiling_audio_is_bit_exact_after_declared_delay',()=>{
  const input=Array.from({length:2},(_,c)=>Float32Array.from({length:24000},(_,i)=>.4*Math.sin(i*.031+c)));
  const {kernel,output}=render(input);
  for(let c=0;c<2;c++)for(let i=0;i<output[c].length;i++)assert.equal(output[c][i],i<kernel.delayFrames?0:input[c][i-kernel.delayFrames]);
  assert.equal(kernel.reductions,0);return{delayFrames:kernel.delayFrames};
});
check('isolated_impulse_and_alternating_full_scale_are_bounded',()=>{
  const input=Array.from({length:2},()=>new Float32Array(96000));
  input[0][1000]=4;input[1][1000]=-2;
  for(let i=2000;i<4000;i++)input[0][i]=(i%2?1:-1)*8;
  const {kernel,output}=render(input);
  let peak=0;for(const channel of output)for(const value of channel){assert.ok(Number.isFinite(value));peak=Math.max(peak,Math.abs(value));}
  assert.ok(peak<=.975001);assert.equal(output[0][1000+kernel.delayFrames]/output[1][1000+kernel.delayFrames],-2);
  assert.ok(kernel.gain>.99999);return{peak,releaseGain:kernel.gain};
});
check('linked_stereo_gain_preserves_pan_balance',()=>{
  const left=Float32Array.from({length:48000},(_,i)=>2.5*Math.sin(i*.04)),right=left.map(v=>v*.25);
  const {output}=render([left,right]);for(let i=0;i<left.length;i++)assert.ok(Math.abs(output[1][i]-output[0][i]*.25)<1e-7);
});
check('extreme_random_peaks_and_block_partitions_match',()=>{
  let seed=12345;const random=()=>((seed=Math.imul(seed,1664525)+1013904223>>>0)/4294967296-.5)*12;
  const input=Array.from({length:2},()=>Float32Array.from({length:48000},random));
  const a=render(input,{},128),b=render(input,{},317);assert.deepEqual(a.output,b.output);
  for(const channel of a.output)for(const value of channel)assert.ok(Number.isFinite(value)&&Math.abs(value)<=.975001);
});
check('non_finite_upstream_is_silenced_without_poisoning_future_audio',()=>{
  const a=new Float32Array(1000);a[0]=NaN;a[1]=Infinity;a[2]=-Infinity;a[3]=.4;
  const {output,kernel}=render([a,a]);for(const channel of output)assert.ok(channel.every(Number.isFinite));
  assert.equal(output[0][3+kernel.delayFrames],a[3]);
});
check('all_supported_sample_rates_and_monotone_peak_queue_wraps',()=>{
  const details=[];for(const sampleRate of [22050,44100,48000,96000]){
    const input=Array.from({length:2},(_,c)=>Float32Array.from({length:sampleRate},(_,i)=>((i+c)%1000)/150));
    const {output,kernel}=render(input,{sampleRate});let peak=0;
    for(const channel of output)for(const v of channel)peak=Math.max(peak,Math.abs(v));
    assert.ok(peak<=.975001);details.push({sampleRate,delayFrames:kernel.delayFrames,peak});
  }return details;
});
const fallback=await createAudioPeakGuard({createWaveShaper:()=>({})});
check('compatibility_soft_guard_curve_is_finite_odd_monotone_and_bounded',()=>{
  assert.equal(fallback.mode,'soft-peak-fallback');assert.equal(fallback.lookaheadSeconds,0);
  const curve=fallback.node.curve;assert.equal(curve[(curve.length-1)/2],0);
  for(let i=0;i<curve.length;i++){
    const x=i/(curve.length-1)*2-1;
    assert.ok(Number.isFinite(curve[i])&&Math.abs(curve[i])<.975);
    if(i)assert.ok(curve[i]>=curve[i-1]);
    assert.ok(Math.abs(curve[i]+curve[curve.length-i-1])<1e-7);
    if(Math.abs(x)<.79)assert.ok(Math.abs(curve[i]-x)<1e-7);
  }
});
const report={date:new Date().toISOString(),passed:checks.every(c=>c.passed),total:checks.length,passedCount:checks.filter(c=>c.passed).length,checks,limits:'CPU kernel correctness; browser AudioWorklet and actual graph are checked separately'};
await writeFile(new URL('./peak-kernel-check.json',import.meta.url),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report,null,2));if(!report.passed)process.exitCode=1;
