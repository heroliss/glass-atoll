import assert from 'node:assert/strict';
import {readFileSync,writeFileSync} from 'node:fs';
import {DEFAULT_QUALITY,QUALITY_IDS,QUALITY_PRESETS,getQualityPreset,resolveQualityPreset} from '../quality-presets.js';
import {civilToUTC,utcToCivil,formatUTCOffset} from '../ui.js';

const checks=[];
function check(name,fn){try{fn();checks.push({name,passed:true});}catch(error){checks.push({name,passed:false,error:error.message});}}
check('five distinct candidate profiles, medium default',()=>{
  assert.deepEqual(QUALITY_IDS,['low','balanced','medium','high','ultra']);assert.equal(DEFAULT_QUALITY,'medium');
  assert.equal(Object.keys(QUALITY_PRESETS).length,5);
});
check('profiles immutable; returned requests independently mutable',()=>{
  assert(Object.isFrozen(QUALITY_PRESETS.medium.request));
  const p=getQualityPreset();p.request.shadowSize=1;assert.equal(getQualityPreset().request.shadowSize,4096);
});
check('unknown profile is rejected',()=>assert.throws(()=>getQualityPreset('automatic'),RangeError));
check('profiles do not overwrite photography, display, weather, clock, or source energy',()=>{
  for(const profile of Object.values(QUALITY_PRESETS)){
    for(const key of ['exposure','cameraEV','storageEV','hdr','peakNits','paperWhiteNits','date','utcMs','wind','swellHeight','brightness','maxStars','targetFps','automatic'])assert(!(key in profile.request),key);
    assert.equal(profile.candidate,true);
  }
});
check('correctness features retained in all tiers',()=>{
  for(const p of Object.values(QUALITY_PRESETS))for(const [k,v]of Object.entries({indirect:'low',antialias:'smaa',temporal:true,glintAA:true,opticalBloom:true}))assert.equal(p.request[k],v);
});
check('major cost requests nondecreasing',()=>{
  for(const key of ['dprCap','msaaSamples','shadowSize','waveResolution','cloudSteps','causticsGrid','causticsHz','reflectionScale']){
    const values=QUALITY_IDS.map(id=>getQualityPreset(id).request[key]);assert(values.every((n,i)=>i===0||n>=values[i-1]),key);
  }
});
check('MSAA intersection handles noncontinuous attachment support',()=>{
  const p=resolveQualityPreset('medium',{maxTextureSize:16384,sampleSupport:[[8,2,1],[4,2,1],[2,1]]});
  assert.equal(p.effective.msaaSamples,2);assert(p.limits.some(s=>s.startsWith('MSAA')));assert.equal(p.capabilitiesKnown,true);
});
check('MSAA does not select unsupported in-between count',()=>{
  const p=resolveQualityPreset('balanced',{maxTextureSize:16384,sampleSupport:[[8,1],[8,1]]});assert.equal(p.effective.msaaSamples,1);
});
check('empty common sample support resolves to no multisampling',()=>{
  assert.equal(resolveQualityPreset('ultra',{maxTextureSize:16384,sampleSupport:[[8],[4]]}).effective.msaaSamples,0);
});
check('reflection independent sample list and explicit zero preserved',()=>{
  const caps={maxTextureSize:16384,sampleSupport:[8,4,2,1],reflectionSampleSupport:[1]};
  assert.equal(resolveQualityPreset('high',caps).effective.reflectionSamples,1);
  assert.equal(getQualityPreset('medium').request.reflectionSamples,0);
  assert.equal(resolveQualityPreset('medium',caps).effective.reflectionSamples,0);
  assert.equal(resolveQualityPreset('low',caps).effective.reflectionSamples,0);
});
check('texture cap limits request without mutating immutable profile',()=>{
  const p=resolveQualityPreset('ultra',{maxTextureSize:4096,sampleSupport:[8,4,2,1]});assert.equal(p.effective.shadowSize,4096);assert.equal(p.request.shadowSize,8192);
});
check('wave texture capability fallback retains power of two',()=>{
  assert.equal(resolveQualityPreset('ultra',{maxTextureSize:300,sampleSupport:[1]}).effective.waveResolution,256);
});
check('unknown caps are explicitly not verified allocation',()=>{
  const p=resolveQualityPreset();assert.equal(p.capabilitiesKnown,false);assert.equal(p.capabilityResolutionOnly,true);assert.equal(p.effective.msaaSamples,p.request.msaaSamples);
});
check('UTC+8 civil input crosses UTC date correctly',()=>assert.equal(civilToUTC('2026-10-26T02:30',480),Date.UTC(2026,9,25,18,30)));
check('western civil offset crosses UTC forward correctly',()=>assert.equal(civilToUTC('2026-10-26T23:30',-300),Date.UTC(2026,9,27,4,30)));
check('fractional offset and seconds roundtrip',()=>{
  const text='2024-02-29T00:15:30',ms=civilToUTC(text,345);assert.equal(ms,Date.UTC(2024,1,28,18,30,30));assert.equal(utcToCivil(ms,345),text);
});
check('invalid calendar and clock rejected, not silently normalized',()=>{
  for(const text of ['2023-02-29T12:00','2026-04-31T12:00','2026-10-26T24:00','2026-10-26T12:60','garbage'])assert.equal(civilToUTC(text,480),null,text);
});
check('early years are not interpreted as nineteen hundred',()=>assert.equal(utcToCivil(civilToUTC('0099-01-02T03:04',0),0),'0099-01-02T03:04:00'));
check('computer timezone does not change explicit UTC conversion',()=>{
  const previous=process.env.TZ;
  try{for(const zone of ['Pacific/Honolulu','Asia/Tokyo','America/New_York']){process.env.TZ=zone;assert.equal(civilToUTC('2026-10-26T12:00',480),Date.UTC(2026,9,26,4));}}
  finally{if(previous===undefined)delete process.env.TZ;else process.env.TZ=previous;}
});
check('offset display includes fractional civil offset',()=>{assert.equal(formatUTCOffset(765),'UTC+12:45');assert.equal(formatUTCOffset(-210),'UTC−03:30');});
check('HTML controls have unique ids and explicit label targets exist',()=>{
  const html=readFileSync(new URL('../index.html',import.meta.url),'utf8');
  const ids=[...html.matchAll(/\bid="([^"]+)"/g)].map(m=>m[1]);assert.equal(new Set(ids).size,ids.length);
  for(const ref of [...html.matchAll(/<label[^>]*\bfor="([^"]+)"/g)].map(m=>m[1]))assert(ids.includes(ref),ref);
});
check('HTML retains core views, offers close-island fireworks, and twenty-six firework types',()=>{
  const html=readFileSync(new URL('../index.html',import.meta.url),'utf8');
  const select=id=>html.match(new RegExp(`<select[^>]+id="${id}"[^>]*>([\\s\\S]*?)<\\/select>`))[1];
  const views=[...select('view-preset').matchAll(/<option\b[^>]*value="([^"]+)"/g)].map(match=>match[1]);
  for(const view of ['shore','lagoon','aerial','sandbar','palm','reef','waterline','island','sun','moon','fireworks','fireworks-close','fireworks-beach','fireworks-palms','fireworks-aerial'])assert(views.includes(view),view);
  assert.equal(views.length,new Set(views).size);
  assert.equal([...select('firework-type').matchAll(/<option\b/g)].length,26); // twenty-six firework types (README)
});
const report={date:new Date().toISOString(),scope:'Pure data/time/capability and HTML structure. No browser render, callback interaction, GPU allocation or performance claim.',passed:checks.every(c=>c.passed),count:checks.length,checks};
writeFileSync(new URL('controls-quality-check.json',import.meta.url),JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify(report,null,2));if(!report.passed)process.exitCode=1;
