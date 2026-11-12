import assert from 'node:assert/strict';
import fs from 'node:fs';
import crypto from 'node:crypto';
import vm from 'node:vm';
import {initQuickExperience} from '../../ui-quick-experience.js';
const base=new URL('../../',import.meta.url),read=file=>fs.readFileSync(new URL(file,base),'utf8');
const hash=text=>crypto.createHash('sha256').update(text).digest('hex');
const ui=read('ui.js'),html=read('index.html'),css=read('style.css');
const results=[];
async function check(name,fn){try{await fn();results.push({name,passed:true});}catch(error){results.push({name,passed:false,error:error.stack});}}
class Element{
  constructor(id,value=''){this.id=id;this.value=value;this.dataset={};this.attributes={};this.listeners={};this.options=[];this.textContent='';this.disabled=false;this.selectedIndex=0;this.hidden=false;this.classes=new Set();this.classList={toggle:(name,on)=>on?this.classes.add(name):this.classes.delete(name)};}
  setAttribute(key,value){this.attributes[key]=value;}
  addEventListener(type,fn){(this.listeners[type]??=[]).push(fn);}
  async fire(type){await Promise.all((this.listeners[type]??=[]).map(fn=>fn({target:this})));}
  contains(element){return element?.owner===this;}
  focus(){document.activeElement=this;}
}
const nodeIds=['quick-time-status','quick-firework-type','quick-launch','quick-random','quick-auto','quick-stop','quick-firework-settings','quick-firework-status','quick-time-content','time-panel-toggle','time-panel','fireworks-content','fireworks-toggle','experience-dock'];
const nodes=Object.fromEntries(nodeIds.map(id=>[id,new Element(id)]));
const timeButtons=['day','sunset','moon','stars'].map(id=>{const el=new Element(id);el.dataset.quickTime=id;return el;});
const selection=nodes['quick-firework-type'];
selection.options=['peony','chrysanthemum','willow','palm','smiley','heart','crossette','strobe','comet','bouquet'].map(type=>({value:`type:${type}`}));
selection.options.push(...['three-heart-v1','three-heart-radiant120-v1','two-colour-v1'].map(id=>({value:`profile:${id}`})));
globalThis.document={getElementById:id=>nodes[id],querySelectorAll:()=>timeButtons,activeElement:null,body:new Element('body')};
const state={paused:true,time:{preset:'day'},fireworks:{type:'peony',effectProfile:'legacy',autoLaunch:false,smokeQuality:'light',active:2,queued:0},timePanelOpen:true,fireworksOpen:true};
const calls=[],notices=[];
let resume=0,opened=null,timeAction=async id=>{state.time.preset=id;return{name:id};},launchFails=false;
const callbacks={onQuickTimePreset:id=>timeAction(id),onFireworksChange(){},onLaunchFirework(){if(launchFails)throw new Error('fixture launch failure');calls.push('launch');},onRandomFirework(){calls.push('random');},onStopFireworks(){state.fireworks.autoLaunch=false;calls.push('stop');},onShowcase(){throw new Error('Removed combined showcase called');},onView(){throw new Error('Time preset moved camera');},onSound(){throw new Error('Time preset enabled sound');}};
const api=initQuickExperience({state,callbacks,submitFireworks(patch){calls.push({...patch});Object.assign(state.fireworks,patch);if(patch.autoLaunch)state.fireworks.effectProfile='legacy';},invoke:key=>callbacks[key](),togglePause(){resume++;state.paused=!state.paused;},openSettings:key=>{opened=key;},notify:text=>notices.push(text)});
await check('Shared firework actions retain explicit aliases and single-shot normalization input',async()=>{
  selection.value='type:smiley';await selection.fire('change');assert.deepEqual(calls.at(-1),{type:'ring',effectProfile:'legacy'});
  selection.value='type:comet';await selection.fire('change');assert.deepEqual(calls.at(-1),{type:'fan',effectProfile:'legacy'});
  selection.value='profile:three-heart-radiant120-v1';await selection.fire('change');assert.deepEqual(calls.at(-1),{effectProfile:'three-heart-radiant120-v1'});
  assert.equal(nodes['quick-auto'].disabled,false);assert.match(nodes['quick-firework-status'].textContent,/持续随机会切换/);
  await nodes['quick-auto'].fire('click');assert.deepEqual(calls.at(-1),{autoLaunch:true});assert.equal(resume,1);assert.equal(state.paused,false);
  await nodes['quick-stop'].fire('click');assert.equal(calls.at(-1),'stop');assert.equal(nodes['quick-stop'].disabled,true);
  await nodes['quick-firework-settings'].fire('click');assert.equal(opened,'fireworks');
});
await check('Firework rejection releases busy and unknown deep profile is never relabeled',async()=>{
  launchFails=true;const previous=console.error;console.error=()=>{};try{await nodes['quick-launch'].fire('click');}finally{console.error=previous;}
  assert.equal(nodes['quick-launch'].disabled,false);assert.equal(nodes['quick-launch'].attributes['aria-busy'],'false');assert.ok(notices.length);
  state.fireworks.effectProfile='three-heart-scale120-v1';api.syncFireworks();assert.equal(selection.selectedIndex,-1);assert.match(nodes['quick-firework-status'].textContent,/其他实验样式/);
});
await check('Independent time awaits real result and never invokes camera/showcase/sound/launch',async()=>{
  let resolve;timeAction=id=>new Promise(r=>{resolve=()=>{state.time.preset=id;r({name:id});};});const count=calls.length;
  const pending=timeButtons[1].fire('click');assert.ok(timeButtons.every(button=>button.disabled));assert.equal(timeButtons[0].attributes['aria-pressed'],'true');
  resolve();await pending;assert.ok(timeButtons.every(button=>!button.disabled));assert.equal(timeButtons[1].attributes['aria-pressed'],'true');assert.match(nodes['quick-time-status'].textContent,/机位保持/);assert.equal(calls.length,count);
});
await check('False, undefined and thrown time failures retain real prior clock and unlock',async()=>{
  for(const failure of [false,undefined,'throw']){
    timeAction=async()=>{if(failure==='throw')throw new Error('fixture clock failure');return failure;};
    const previous=console.error;console.error=()=>{};try{await timeButtons[2].fire('click');}finally{console.error=previous;}
    assert.equal(state.time.preset,'sunset');assert.equal(timeButtons[1].attributes['aria-pressed'],'true');assert.ok(timeButtons.every(button=>!button.disabled&&button.attributes['aria-busy']==='false'));assert.doesNotMatch(nodes['quick-time-status'].textContent,/已应用/);
  }
});
await check('Manual clock cancellation wins; camera compatibility call leaves independent time selected',async()=>{
  let resolve;timeAction=()=>new Promise(r=>{resolve=r;});const pending=timeButtons[3].fire('click');state.time.preset=null;api.cancelTimePreset();resolve({name:'stars'});await pending;
  assert.ok(timeButtons.every(button=>button.attributes['aria-pressed']==='false'));assert.doesNotMatch(nodes['quick-time-status'].textContent,/已应用/);
  state.time.preset='moon';api.syncTime();api.clearShowcase();assert.equal(timeButtons[2].attributes['aria-pressed'],'true');assert.equal(api.setShowcase('starry-night'),false);
});
await check('Existing time-preset callback remains a direct failure-aware fallback',async()=>{
  const preferred=callbacks.onQuickTimePreset;delete callbacks.onQuickTimePreset;
  callbacks.onTimePreset=async id=>{state.time.preset=id;return{name:id};};api.syncTime();
  await timeButtons[0].fire('click');assert.equal(state.time.preset,'day');assert.equal(timeButtons[0].attributes['aria-pressed'],'true');
  callbacks.onTimePreset=async()=>false;await timeButtons[1].fire('click');assert.equal(state.time.preset,'day');assert.doesNotMatch(nodes['quick-time-status'].textContent,/已应用/);
  callbacks.onQuickTimePreset=preferred;delete callbacks.onTimePreset;
});
await check('Actual panel helpers restore focus, maintain ARIA and collapse independently',()=>{
  const start=ui.indexOf('  const compactLowLayout='),end=ui.indexOf('  function setCategory',start);assert.ok(start>0&&end>start);
  let low=false;const context=vm.createContext({state,document,$:selector=>nodes[selector.slice(1)],window:{matchMedia:()=>({matches:low})}});
  const helpers=vm.runInContext(`(()=>{${ui.slice(start,end)}return{setTimePanel,setFireworksPanel};})()`,context);
  document.activeElement={owner:nodes['quick-time-content']};helpers.setTimePanel(false);assert.equal(document.activeElement,nodes['time-panel-toggle']);assert.equal(nodes['quick-time-content'].hidden,true);assert.equal(nodes['time-panel-toggle'].attributes['aria-expanded'],'false');
  helpers.setTimePanel(true);helpers.setFireworksPanel(false);assert.equal(state.timePanelOpen,true);assert.equal(state.fireworksOpen,false);
  low=true;helpers.setFireworksPanel(true);assert.equal(state.timePanelOpen,false);assert.equal(state.fireworksOpen,true);helpers.setTimePanel(true);assert.equal(state.timePanelOpen,true);assert.equal(state.fireworksOpen,false);
});
await check('Actual submit smoke modes and old checkbox remain coherent without changing other fields',async()=>{
  const start=ui.indexOf('  async function submitFireworks('),end=ui.indexOf('  function setupNewControls',start);const forwarded=[];
  const context=vm.createContext({state,fireworkSubmitSequence:0,updateFireworksUI(){},callbacks:{onFireworksChange:async value=>forwarded.push({key:'onFireworksChange',value})}});
  const submit=vm.runInContext(`(()=>{${ui.slice(start,end)}return submitFireworks;})()`,context);
  for(const mode of ['light','full','off']){await submit({smokeQuality:mode});assert.equal(state.fireworks.persistentSmoke,mode==='full');assert.equal(forwarded.at(-1).value.smokeQuality,mode);}
  await submit({persistentSmoke:true});assert.equal(state.fireworks.smokeQuality,'full');await submit({persistentSmoke:false});assert.equal(state.fireworks.smokeQuality,'off');assert.equal(forwarded.at(-1).key,'onFireworksChange');
});
await check('Detailed settings preserved; only requested obsolete controls removed; ARIA references close',()=>{
  const before=fs.readFileSync(new URL('before/index.html',import.meta.url),'utf8'),ids=text=>[...text.matchAll(/\bid="([^"]+)"/g)].map(x=>x[1]);
  const old=ids(before),now=ids(html);assert.equal(now.length,new Set(now).size);
  assert.deepEqual(old.filter(id=>!now.includes(id)).sort(),['drop-stone','showcase-heading','showcase-status']);
  const settings=text=>text.slice(text.indexOf('<aside class="control-panel'),text.indexOf('</aside>',text.indexOf('<aside class="control-panel')));
  const originalSettingsIds=ids(settings(before));for(const id of originalSettingsIds)assert.ok(ids(settings(html)).includes(id),`Detailed control removed: ${id}`);
  for(const match of html.matchAll(/aria-(?:controls|labelledby|describedby)="([^"]+)"/g))for(const id of match[1].split(/\s+/))assert.ok(now.includes(id),`Missing ARIA target ${id}`);
  assert.equal((html.match(/data-quick-time=/g)||[]).length,4);assert.ok(!html.includes('data-showcase='));assert.match(html,/data-view="fireworks-close"/);assert.match(html,/<option value="fireworks-close">/);
  assert.ok(!ui.includes("$('#drop-stone')"));assert.match(html,/按住左键蓄力，松开投石/);assert.match(html,/<span id="throw-charge-label">投石力度<\/span>/);assert.match(ui,/textContent=\x60投石力度/);
  assert.match(css,/#throw-charge\{width:164px;padding:8px 10px/);assert.ok(!css.includes('.showcase-panel'));
});
const pins=Object.fromEntries(['index.html','style.css','ui.js','ui-quick-experience.js'].map(file=>[file,hash(read(file))]));
const report={schema:'glass-atoll.ui-r2-cpu-check.v1',passed:results.every(r=>r.passed),counts:{passed:results.filter(r=>r.passed).length,total:results.length},actualGPU:false,browserUsed:false,scope:'Actual quick module plus extracted actual UI panel/submit helpers with tiny DOM stubs; static original detailed-controls and ARIA inventory. No real browser/layout or rendering claim.',sourcePins:pins,results};
fs.writeFileSync(new URL('check.json',import.meta.url),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({passed:report.passed,counts:report.counts}));if(!report.passed)process.exitCode=1;
