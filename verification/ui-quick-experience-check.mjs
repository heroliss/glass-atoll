import assert from 'node:assert/strict';
import fs from 'node:fs';
import crypto from 'node:crypto';
import {initQuickExperience} from '../ui-quick-experience.js';

class Element{
  constructor(id,value=''){this.id=id;this.value=value;this.dataset={};this.attributes={};this.listeners={};this.options=[];this.textContent='';this.disabled=false;this.selectedIndex=0;}
  setAttribute(key,value){this.attributes[key]=value;}
  addEventListener(type,fn){(this.listeners[type]??=[]).push(fn);}
  async fire(type){await Promise.all((this.listeners[type]??=[]).map(fn=>fn({target:this})));}
}
const ids=['showcase-status','quick-firework-type','quick-launch','quick-random','quick-auto','quick-stop','quick-firework-settings','quick-firework-status'];
const nodes=Object.fromEntries(ids.map(id=>[id,new Element(id)]));
const show=['glass-day','sunset','blue-hour','starry-night'].map(id=>{const el=new Element(id);el.dataset.showcase=id;return el;});
const selection=nodes['quick-firework-type'];
selection.options=['peony','chrysanthemum','willow','palm','smiley','heart','crossette','strobe','comet','bouquet'].map(type=>({value:`type:${type}`}));
selection.options.push(...['three-heart-v1','three-heart-radiant120-v1','two-colour-v1'].map(id=>({value:`profile:${id}`})));
globalThis.document={getElementById:id=>nodes[id],querySelectorAll:()=>show};
const state={paused:true,fireworks:{type:'peony',effectProfile:'legacy',autoLaunch:false,active:2,queued:0}};
const calls=[],notices=[];
let resume=0,open=null,showAction=async()=>{},launchFails=false;
const callbacks={onShowcase:id=>showAction(id),onFireworksChange(){},onLaunchFirework(){if(launchFails)throw new Error('fixture launch failure');calls.push('launch');},onRandomFirework(){calls.push('random');},onStopFireworks(){state.fireworks.autoLaunch=false;calls.push('stop');}};
const api=initQuickExperience({state,callbacks,submitFireworks(patch){calls.push({...patch});Object.assign(state.fireworks,patch);if(patch.autoLaunch)state.fireworks.effectProfile='legacy';},invoke:(key)=>callbacks[key](),togglePause(){resume++;state.paused=!state.paused;},openSettings:key=>{open=key;},notify:text=>notices.push(text)});
const results=[];
async function check(name,fn){try{await fn();results.push({name,passed:true});}catch(error){results.push({name,passed:false,error:error.stack});}}
await check('Selection is captured before busy sync; explicit aliases use incumbent submit',async()=>{
  selection.value='type:smiley';await selection.fire('change');assert.deepEqual(calls.at(-1),{type:'ring',effectProfile:'legacy'});
  selection.value='type:comet';await selection.fire('change');assert.deepEqual(calls.at(-1),{type:'fan',effectProfile:'legacy'});
  selection.value='profile:three-heart-radiant120-v1';await selection.fire('change');assert.deepEqual(calls.at(-1),{effectProfile:'three-heart-radiant120-v1'});
  assert.equal(nodes['quick-auto'].disabled,false);assert.match(nodes['quick-firework-status'].textContent,/持续随机会切换/);
});
await check('Auto resumes only paused playback; stop does not clear smoke',async()=>{
  await nodes['quick-auto'].fire('click');assert.deepEqual(calls.at(-1),{autoLaunch:true});assert.equal(resume,1);assert.equal(state.paused,false);assert.equal(nodes['quick-auto'].attributes['aria-pressed'],'true');
  await nodes['quick-stop'].fire('click');assert.equal(calls.at(-1),'stop');assert.equal(state.fireworks.autoLaunch,false);assert.equal(nodes['quick-stop'].disabled,true);
  await nodes['quick-firework-settings'].fire('click');assert.equal(open,'fireworks');assert.match(nodes['quick-firework-status'].textContent,/空中 2 发/);
});
await check('Action rejection releases private busy state',async()=>{
  launchFails=true;const previous=console.error;console.error=()=>{};
  try{await nodes['quick-launch'].fire('click');}finally{console.error=previous;}
  assert.equal(nodes['quick-launch'].disabled,false);assert.equal(nodes['quick-launch'].attributes['aria-busy'],'false');assert.ok(notices.length);
});
await check('Showcase success waits; all four buttons unlock without launch or audio',async()=>{
  let resolve;showAction=()=>new Promise(r=>{resolve=r;});const count=calls.length;
  const pending=show[0].fire('click');assert.ok(show.every(button=>button.disabled));assert.equal(show[0].attributes['aria-pressed'],undefined);
  resolve();await pending;assert.ok(show.every(button=>!button.disabled));assert.equal(show[0].attributes['aria-pressed'],'true');assert.match(nodes['showcase-status'].textContent,/已应用/);assert.equal(calls.length,count);
});
await check('Manual invalidation or failed showcase never marks completion; finally unlocks',async()=>{
  let resolve;showAction=()=>new Promise(r=>{resolve=r;});const pending=show[1].fire('click');api.clearShowcase();resolve();await pending;
  assert.ok(show.every(button=>button.attributes['aria-pressed']==='false'));assert.match(nodes['showcase-status'].textContent,/自由调整/);
  showAction=async()=>{throw new Error('fixture showcase failure');};const previous=console.error;console.error=()=>{};
  try{await show[2].fire('click');}finally{console.error=previous;}
  assert.ok(show.every(button=>!button.disabled&&button.attributes['aria-busy']==='false'));assert.match(nodes['showcase-status'].textContent,/未完成/);
  state.fireworks.effectProfile='three-heart-scale120-v1';api.syncFireworks();assert.equal(selection.selectedIndex,-1);assert.match(nodes['quick-firework-status'].textContent,/其他实验样式/);
});
const report={schema:'glass-atoll.quick-experience-cpu-stub-check.v1',passed:results.every(r=>r.passed),counts:{passed:results.filter(r=>r.passed).length,total:results.length},actualGPU:false,browserUsed:false,scope:'Actual new module with tiny DOM/callback stubs; not real UI integration or scene validation',sourceSHA256:crypto.createHash('sha256').update(fs.readFileSync(new URL('../ui-quick-experience.js',import.meta.url))).digest('hex'),results};
fs.writeFileSync(new URL('ui-quick-experience-check.json',import.meta.url),JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({passed:report.passed,counts:report.counts,sourceSHA256:report.sourceSHA256}));
if(!report.passed)process.exitCode=1;
