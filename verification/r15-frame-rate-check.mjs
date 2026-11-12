import assert from 'node:assert/strict';
import {writeFileSync} from 'node:fs';
import {createFrameRateMeter} from '../frame-rate-meter.js';
const checks=[];
const check=(name,fn)=>{try{fn();checks.push({name,passed:true});}catch(e){checks.push({name,passed:false,error:e.message});}};
check('60 actual draws over one wall-clock second report60',()=>{const m=createFrameRateMeter();m.tick(0);let r;for(let i=1;i<=60;i++)r=m.tick(i*1000/60,{rendered:true});assert.equal(r.fps,60);assert.equal(r.renderedFrames,60);});
check('idle callbacks are not scene frames',()=>{const m=createFrameRateMeter();m.tick(0);let r;for(let i=1;i<=120;i++)r=m.tick(i*1000/120,{rendered:i%2===0});assert.equal(r.fps,60);});
check('pause and resume clear previous-window frames',()=>{const m=createFrameRateMeter();m.tick(0);m.tick(500,{rendered:true});assert.equal(m.tick(600,{paused:true}).fps,0);assert.equal(m.tick(1700,{paused:true,rendered:true}).fps,0);assert.equal(m.tick(1800,{paused:false}).warmingUp,true);assert.equal(m.tick(2800,{rendered:true}).fps,1);});
check('hidden or diagnostic reset does not include inactive time',()=>{const m=createFrameRateMeter();m.tick(0);m.tick(500,{rendered:true});m.reset(60000);assert.equal(m.tick(60001).warmingUp,true);assert.equal(m.tick(61001,{rendered:true}).fps,1);});
check('slow rendering and rejected invalid configuration are explicit',()=>{const m=createFrameRateMeter();m.tick(0);let r;for(let i=1;i<=20;i++)r=m.tick(i*50,{rendered:true});assert.equal(r.fps,20);assert.throws(()=>createFrameRateMeter({windowMs:0}));assert.throws(()=>m.tick(NaN));});
const result={schema:'glass-atoll.r15-frame-rate-check.v1',checks,passed:checks.every(c=>c.passed),counts:{passed:checks.filter(c=>c.passed).length,total:checks.length},limits:['Wall-clock draw-rate meter, not GPU benchmark, display scanout or per-frame60fps guarantee.']};
writeFileSync(new URL('./r15-frame-rate-check.json',import.meta.url),JSON.stringify(result,null,2));console.log(JSON.stringify(result));if(!result.passed)process.exitCode=1;

