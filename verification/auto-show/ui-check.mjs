import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import {initQuickExperience} from '../../ui-quick-experience.js';
const root=new URL('../../',import.meta.url),read=file=>fs.readFileSync(new URL(file,root),'utf8');
const source=read('ui.js'),html=read('index.html'),results=[];
const sha=bytes=>crypto.createHash('sha256').update(bytes).digest('hex');
async function check(name,fn){try{await fn();results.push({name,passed:true});}catch(error){results.push({name,passed:false,error:error.stack});}}
class Element{
  constructor(id){this.id=id;this.value='';this.textContent='';this.checked=false;this.disabled=false;this.title='';this.attributes={};this.options=[];this.listeners={};this.dataset={};this.selectedIndex=0;}
  setAttribute(key,value){this.attributes[key]=value;}
  addEventListener(type,fn){(this.listeners[type]??=[]).push(fn);}
  async fire(type){await Promise.all((this.listeners[type]??[]).map(fn=>fn({target:this})));}
}
const nodes=Object.fromEntries([...html.matchAll(/\bid="([^"]+)"/g)].map(match=>[match[1],new Element(match[1])]));
const quickSelect=nodes['quick-firework-type'];quickSelect.options=[...html.match(/<select id="quick-firework-type">([\s\S]*?)<\/select>/)[1].matchAll(/value="([^"]+)"/g)].map(match=>({value:match[1]}));
const timeButtons=['day','sunset','moon','stars'].map(id=>{const node=new Element(id);node.dataset.quickTime=id;return node;});
globalThis.document={getElementById:id=>nodes[id],querySelectorAll:()=>timeButtons,activeElement:null};
const received=[],notices=[];
let handler=async payload=>({settings:{...payload}}),quick;
const callbacks={onFireworksChange:async payload=>{received.push({...payload});return handler(payload);},onLaunchFirework(){},onRandomFirework(){},onStopFireworks(){},onQuickTimePreset:async id=>({name:id})};
const context=vm.createContext({DEFAULT_QUALITY:'medium',document,console:{error(){}},callbacks,FIREWORK_TYPES:[{id:'peony',height:120},{id:'chrysanthemum',height:170}],lastNonZeroFireworkIntensity:1,quickExperience:null,fireworkSubmitSequence:0,$:selector=>nodes[selector.slice(1)],fillRange(){},setInput(id,value){if(document.activeElement!==nodes[id])nodes[id].value=String(value);},notify:message=>notices.push(message)});
const stateStart=source.indexOf('  const state = {'),stateEnd=source.indexOf('  let quickExperience',stateStart);
const state=vm.runInContext(`(()=>{${source.slice(stateStart,stateEnd)}return state;})()`,context);context.state=state;
const updateStart=source.indexOf('  function updateFireworksUI()'),submitStart=source.indexOf('  async function submitFireworks('),submitEnd=source.indexOf('  function setupNewControls',submitStart);
const api=vm.runInContext(`(()=>{${source.slice(updateStart,submitEnd)}return{updateFireworksUI,submitFireworks};})()`,context);
await check('Actual UI defaults expose independent automatic ranges and preserve manual settings',()=>{
  assert.equal(state.fireworks.randomIntervals,true);assert.equal(state.fireworks.intervalMinSeconds,1);assert.equal(state.fireworks.intervalMaxSeconds,5);
  assert.equal(state.fireworks.randomLaunchTilt,true);assert.equal(state.fireworks.automaticTiltMinDegrees,-40);assert.equal(state.fireworks.automaticTiltMaxDegrees,40);
  assert.equal(state.fireworks.intervalSeconds,7.5);assert.equal(state.fireworks.elevation,78);assert.equal(state.fireworks.launchSpreadDegrees,3);assert.equal(state.fireworks.maxActive,undefined);
  api.updateFireworksUI();assert.equal(nodes['firework-interval'].disabled,true);assert.equal(nodes['firework-interval-min'].disabled,false);assert.equal(nodes['firework-auto-tilt-min'].disabled,false);
});
await check('Turning off each random mode disables its range and retains fixed/manual values',async()=>{
  await api.submitFireworks({randomIntervals:false});assert.equal(nodes['firework-interval'].disabled,false);assert.equal(nodes['firework-interval-min'].disabled,true);assert.equal(nodes['firework-interval-max'].disabled,true);
  await api.submitFireworks({randomLaunchTilt:false});assert.equal(nodes['firework-auto-tilt-min'].disabled,true);assert.equal(nodes['firework-auto-tilt-max'].disabled,true);assert.equal(state.fireworks.elevation,78);
  await api.submitFireworks({randomIntervals:true,randomLaunchTilt:true});
});
await check('Actual numeric handlers forward both original bounds without sorting or sign loss',async()=>{
  const first=source.indexOf("    for(const [id,key]of [['firework-random-intervals'"),last=source.indexOf("    for(const [id,key]of [['firework-auto','autoLaunch']",first);
  context.submitFireworks=api.submitFireworks;vm.runInContext(source.slice(first,last),context);
  nodes['firework-interval-min'].value='1.25';nodes['firework-interval-max'].value='3.75';await nodes['firework-interval-min'].fire('change');assert.equal(received.at(-1).intervalMinSeconds,1.25);assert.equal(received.at(-1).intervalMaxSeconds,3.75);
  nodes['firework-auto-tilt-min'].value='-35';nodes['firework-auto-tilt-max'].value='12';await nodes['firework-auto-tilt-max'].fire('change');assert.equal(received.at(-1).automaticTiltMinDegrees,-35);assert.equal(received.at(-1).automaticTiltMaxDegrees,12);
});
await check('Callback rejection restores state and the still-focused invalid range input',async()=>{
  const before=[state.fireworks.intervalMinSeconds,state.fireworks.intervalMaxSeconds];handler=async payload=>{assert.equal(payload.intervalMinSeconds,9);assert.equal(payload.intervalMaxSeconds,1);throw new RangeError('minimum exceeds maximum');};
  document.activeElement=nodes['firework-interval-min'];nodes['firework-interval-min'].value='9';nodes['firework-interval-max'].value='1';await nodes['firework-interval-min'].fire('change');
  assert.equal(state.fireworks.intervalMinSeconds,before[0]);assert.equal(state.fireworks.intervalMaxSeconds,before[1]);assert.equal(nodes['firework-interval-min'].value,String(before[0]));assert.equal(nodes['firework-interval-max'].value,String(before[1]));assert.match(notices.at(-1),/最短间隔不能大于最长/);document.activeElement=null;
});
await check('Signed-angle, nonfinite and explicit declined edits revert without changing unrelated diagnostics',async()=>{
  const before=[state.fireworks.automaticTiltMinDegrees,state.fireworks.automaticTiltMaxDegrees];state.fireworks.active=7;
  handler=async()=>{throw new RangeError('tilt rejected');};let result=await api.submitFireworks({automaticTiltMinDegrees:25,automaticTiltMaxDegrees:-20});assert.equal(result.accepted,false);assert.equal(state.fireworks.automaticTiltMinDegrees,before[0]);assert.equal(state.fireworks.automaticTiltMaxDegrees,before[1]);assert.match(notices.at(-1),/最小倾角不能大于最大/);
  handler=async payload=>{assert.ok(Number.isNaN(payload.intervalMinSeconds));throw new RangeError('finite interval required');};result=await api.submitFireworks({intervalMinSeconds:NaN});assert.equal(result.accepted,false);assert.ok(Number.isFinite(state.fireworks.intervalMinSeconds));
  handler=async()=>({accepted:false,reason:'not admitted'});result=await api.submitFireworks({intervalMinSeconds:2});assert.equal(result.accepted,false);assert.equal(state.fireworks.active,7);
});
await check('An older asynchronous failure cannot overwrite a newer accepted edit',async()=>{
  let rejectOld;handler=()=>new Promise((resolve,reject)=>{rejectOld=reject;});const old=api.submitFireworks({intervalMinSeconds:2});
  handler=async()=>({accepted:true});await api.submitFireworks({intervalMinSeconds:3});state.fireworks.active=9;rejectOld(new RangeError('old request'));const result=await old;assert.equal(result.accepted,false);assert.equal(state.fireworks.intervalMinSeconds,3);assert.equal(state.fireworks.active,9);
});
await check('Existing source/profile/smoke edits remain shared; rejected auto leaves paused playback',async()=>{
  handler=async payload=>({settings:{...payload}});await api.submitFireworks({effectProfile:'three-heart-radiant120-v1',smokeQuality:'full'});assert.equal(state.fireworks.type,'chrysanthemum');assert.equal(state.fireworks.persistentSmoke,true);assert.equal(state.fireworks.intensityScale,1);
  let resumes=0;state.paused=true;
  quick=initQuickExperience({state,callbacks,submitFireworks:api.submitFireworks,invoke:key=>callbacks[key](),togglePause(){resumes++;state.paused=!state.paused;},openSettings(){},notify:message=>notices.push(message)});context.quickExperience=quick;
  handler=async()=>{throw new RangeError('auto denied');};await nodes['quick-auto'].fire('click');assert.equal(resumes,0);assert.equal(state.paused,true);assert.equal(state.fireworks.effectProfile,'three-heart-radiant120-v1');assert.equal(state.fireworks.autoLaunch,false);assert.equal(nodes['quick-auto'].disabled,false);
  handler=async()=>({accepted:true});await nodes['quick-auto'].fire('click');assert.equal(resumes,1);assert.equal(state.fireworks.effectProfile,'legacy');assert.equal(state.fireworks.smokeQuality,'full');
});
await check('Real sync metadata determines capacity; quick status reports interval and signed tilt',()=>{
  const start=source.indexOf('    syncFireworks(info={}){'),end=source.indexOf('    setQualityState',start);
  const sync=vm.runInContext(`({${source.slice(start,end)}}).syncFireworks`,context);context.updateFireworksUI=api.updateFireworksUI;
  sync({autoLaunch:true,active:9,queued:0,maxActive:32,randomIntervals:true,intervalMinSeconds:1,intervalMaxSeconds:5,randomLaunchTilt:true,automaticTiltMinDegrees:-40,automaticTiltMaxDegrees:40});
  assert.equal(state.fireworks.maxActive,32);assert.match(nodes['firework-capacity-hint'].textContent,/最多32发/);assert.match(nodes['quick-firework-status'].textContent,/空中 9 \/ 32 发/);assert.match(nodes['quick-firework-status'].textContent,/每 1–5 秒/);assert.match(nodes['quick-firework-status'].textContent,/-40°…\+40°（0°竖直）/);
  sync({randomIntervals:false,intervalSeconds:7.5,randomLaunchTilt:false});assert.match(nodes['quick-firework-status'].textContent,/每 7.5 秒/);assert.doesNotMatch(nodes['quick-firework-status'].textContent,/自动倾角/);
});
await check('All prior controls and closed numeric domains are preserved with accessible labels',()=>{
  const before=fs.readFileSync(new URL('before/index.html',import.meta.url),'utf8');const ids=text=>[...text.matchAll(/\bid="([^"]+)"/g)].map(match=>match[1]);const previous=ids(before),current=ids(html);assert.equal(current.length,new Set(current).size);assert.deepEqual(previous.filter(id=>!current.includes(id)),[]);
  for(const match of html.matchAll(/<label[^>]*\bfor="([^"]+)"/g))assert.ok(current.includes(match[1]));
  for(const id of ['firework-interval-min','firework-interval-max'])assert.match(html.match(new RegExp(`<input[^>]*id="${id}"[^>]*>`))[0],/min="0.35" max="30"/);
  for(const id of ['firework-auto-tilt-min','firework-auto-tilt-max'])assert.match(html.match(new RegExp(`<input[^>]*id="${id}"[^>]*>`))[0],/min="-65" max="65"/);
  assert.match(html,/0°为竖直/);assert.match(html,/只影响自动燃放/);assert.ok(!html.includes('最多4发'));assert.match(html,/id="firework-elevation" min="25" max="90"/);
});
const report={schema:'glass-atoll.automatic-show-ui-cpu-check.v1',passed:results.every(result=>result.passed),counts:{passed:results.filter(result=>result.passed).length,total:results.length},actualGPU:false,browserUsed:false,scope:'Actual UI submit/update/event/sync functions and quick module with tiny callback/DOM stubs, plus static control preservation. No physics scheduler, rendered layout, GPU or FPS claim.',sourcePins:Object.fromEntries(['index.html','style.css','ui.js','ui-quick-experience.js'].map(file=>[file,sha(read(file))])),results};
fs.writeFileSync(new URL('ui-check.json',import.meta.url),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({passed:report.passed,counts:report.counts,failed:results.filter(result=>!result.passed)},null,2));if(!report.passed)process.exitCode=1;
