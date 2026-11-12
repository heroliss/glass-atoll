import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import {FIREWORK_TYPES} from '../../fireworks-physics.js';
import {COMPLEX_FIREWORK_TYPES} from '../../complex-fireworks.js';
import {initQuickExperience} from '../../ui-quick-experience.js';
const root=new URL('../../',import.meta.url),read=file=>fs.readFileSync(new URL(file,root),'utf8'),sha=data=>crypto.createHash('sha256').update(data).digest('hex');
const html=read('index.html'),ui=read('ui.js'),before=read('verification/complex-fireworks/ui-before/index.html'),results=[];
async function check(name,fn){try{await fn();results.push({name,passed:true});}catch(error){results.push({name,passed:false,error:error.stack});}}
const select=(text,id)=>text.match(new RegExp(`<select[^>]*id="${id}"[^>]*>([\\s\\S]*?)<\\/select>`))[1];
const options=(text,id)=>[...select(text,id).matchAll(/<option value="([^"]+)"[^>]*>([^<]+)<\/option>/g)].map(match=>({value:match[1],label:match[2]}));
class Element{
 constructor(id){this.id=id;this.value='';this.textContent='';this.checked=false;this.disabled=false;this.hidden=false;this.title='';this.attributes={};this.listeners={};this.options=[];this.dataset={};this.selectedIndex=0;}
 setAttribute(key,value){this.attributes[key]=value;}
 addEventListener(type,fn){(this.listeners[type]??=[]).push(fn);}
 async fire(type){await Promise.all((this.listeners[type]??=[]).map(fn=>fn({target:this})));}
}
const nodes=Object.fromEntries([...html.matchAll(/\bid="([^"]+)"/g)].map(match=>[match[1],new Element(match[1])]));
for(const id of ['firework-type','quick-firework-type'])nodes[id].options=options(html,id);
const timeButtons=['day','sunset','moon','stars'].map(id=>{const node=new Element(id);node.dataset.quickTime=id;return node;});
globalThis.document={getElementById:id=>nodes[id],querySelectorAll:()=>timeButtons,activeElement:null};
const calls=[],notices=[];let handler=async payload=>({settings:{...payload}}),resumes=0;
const callbacks={onFireworksChange:async payload=>{calls.push({action:'change',payload:{...payload}});return handler(payload);},onLaunchFirework(){calls.push({action:'launch'});},onRandomFirework(){calls.push({action:'random'});},onStopFireworks(){calls.push({action:'stop'});state.fireworks.autoLaunch=false;},onQuickTimePreset:async id=>({id})};
const context=vm.createContext({DEFAULT_QUALITY:'medium',document,console:{error(){}},callbacks,FIREWORK_TYPES,lastNonZeroFireworkIntensity:1,quickExperience:null,fireworkSubmitSequence:0,$:selector=>nodes[selector.slice(1)],fillRange(){},setInput(id,value){if(document.activeElement!==nodes[id])nodes[id].value=String(value);},notify:message=>notices.push(message)});
const stateStart=ui.indexOf('  const state = {'),stateEnd=ui.indexOf('  let quickExperience',stateStart);
const state=vm.runInContext(`(()=>{${ui.slice(stateStart,stateEnd)}return state;})()`,context);context.state=state;
const updateStart=ui.indexOf('  function updateFireworksUI()'),submitEnd=ui.indexOf('  function setupNewControls',updateStart);
const api=vm.runInContext(`(()=>{${ui.slice(updateStart,submitEnd)}return{updateFireworksUI,submitFireworks};})()`,context);
const quick=initQuickExperience({state,callbacks,submitFireworks:api.submitFireworks,invoke:key=>callbacks[key](),togglePause(){resumes++;state.paused=!state.paused;},openSettings(){},notify:message=>notices.push(message)});context.quickExperience=quick;
const typeHandler=ui.match(/    \$\('#firework-type'\)\.addEventListener\('change',event=>submitFireworks\(\{type:event\.target\.value\}\)\);/)[0];context.submitFireworks=api.submitFireworks;vm.runInContext(typeHandler,context);
await check('Actual registry preserves the old10 prefix and appends all10 named new definitions',()=>{
 assert.deepEqual(FIREWORK_TYPES.slice(0,10).map(type=>type.id),['peony','chrysanthemum','willow','palm','ring','heart','crossette','strobe','fan','bouquet']);
 assert.equal(FIREWORK_TYPES.length,20);assert.equal(COMPLEX_FIREWORK_TYPES.length,10);assert.deepEqual(FIREWORK_TYPES.slice(10),COMPLEX_FIREWORK_TYPES);
 assert.equal(state.fireworks.type,'peony');assert.equal(state.fireworks.effectProfile,undefined);
});
await check('Both optgroups preserve every original option/control and expose fixed labels without experimental suffix',()=>{
 const ids=text=>[...text.matchAll(/\bid="([^"]+)"/g)].map(match=>match[1]);const all=ids(html);assert.equal(all.length,new Set(all).size);assert.deepEqual(ids(before).filter(id=>!all.includes(id)),[]);
 for(const id of ['firework-type','quick-firework-type']){
  const old=options(before,id),current=options(html,id);assert.deepEqual(current.filter(option=>old.some(prior=>prior.value===option.value)),old);
  const group=select(html,id).match(/<optgroup label="大型编排">([\s\S]*?)<\/optgroup>/)[1];
  const entries=[...group.matchAll(/<option value="([^"]+)"[^>]*>([^<]+)<\/option>/g)].map(match=>({value:match[1],label:match[2]}));
  assert.deepEqual(entries,COMPLEX_FIREWORK_TYPES.map(type=>({value:(id==='quick-firework-type'?'type:':'')+type.id,label:type.label})));
  assert.doesNotMatch(group,/实验/);assert.doesNotMatch(group,/\bselected\b/);
 }
 for(const id of ['firework-type','quick-firework-type'])assert.match(html.match(new RegExp(`<select[^>]*id="${id}"[^>]*>`))[0],/aria-describedby=/);
});
await check('All10 real quick change callbacks use identity IDs and normalize the existing deep profile',async()=>{
 await api.submitFireworks({effectProfile:'three-heart-radiant120-v1'});
 for(const type of COMPLEX_FIREWORK_TYPES){
  nodes['quick-firework-type'].value=`type:${type.id}`;await nodes['quick-firework-type'].fire('change');
  assert.equal(calls.at(-1).payload.type,type.id);assert.equal(calls.at(-1).payload.effectProfile,'legacy');assert.equal(state.fireworks.type,type.id);assert.equal(state.fireworks.autoLaunch,false);
  assert.equal(nodes['firework-type'].value,type.id);assert.equal(nodes['quick-firework-type'].value,`type:${type.id}`);assert.ok(nodes['quick-firework-type'].options.some(option=>option.value===`type:${type.id}`));
  assert.equal(nodes['quick-firework-description'].hidden,false);assert.ok(nodes['quick-firework-description'].textContent.includes(type.description));assert.ok(nodes['quick-firework-description'].textContent.includes(`${type.height}米`));assert.ok(nodes['quick-firework-description'].textContent.includes(`${type.burn}秒`));
 }
});
await check('All10 actual detailed change handlers share the same state and authoritative height/burn/description',async()=>{
 for(const type of COMPLEX_FIREWORK_TYPES){
  nodes['firework-type'].value=type.id;await nodes['firework-type'].fire('change');
  assert.equal(calls.at(-1).payload.type,type.id);assert.equal(calls.at(-1).payload.effectProfile,'legacy');assert.equal(nodes['quick-firework-type'].value,`type:${type.id}`);
  assert.equal(nodes['firework-complex-description'].hidden,false);assert.equal(nodes['firework-complex-description'].textContent,`编排约${type.burn}秒。${type.description}`);
  assert.ok(nodes['firework-height'].textContent.includes(`${type.height}米`));assert.match(nodes['firework-height'].textContent,/创作参考/);assert.doesNotMatch(nodes['firework-complex-description'].textContent,/实验/);
  if(type.ground)assert.match(nodes['firework-height'].textContent,/近地编排参考顶点/);
 }
 assert.match(nodes['firework-profile-hint'].textContent,/共20种/);assert.match(nodes['quick-auto'].title,/全部20种/);
});
await check('Old aliases, profile options and default peony retain existing callbacks and clear complex descriptions',async()=>{
 const aliases={peony:'peony',chrysanthemum:'chrysanthemum',willow:'willow',palm:'palm',smiley:'ring',heart:'heart',crossette:'crossette',strobe:'strobe',comet:'fan',bouquet:'bouquet'};
 for(const [visible,type]of Object.entries(aliases)){nodes['quick-firework-type'].value=`type:${visible}`;await nodes['quick-firework-type'].fire('change');assert.equal(calls.at(-1).payload.type,type);assert.equal(state.fireworks.effectProfile,'legacy');assert.equal(nodes['quick-firework-description'].hidden,true);assert.equal(nodes['firework-complex-description'].hidden,true);assert.equal(nodes['quick-firework-description'].textContent,'');}
 for(const profile of ['three-heart-v1','three-heart-radiant120-v1','two-colour-v1']){nodes['quick-firework-type'].value=`profile:${profile}`;await nodes['quick-firework-type'].fire('change');assert.equal(calls.at(-1).payload.effectProfile,profile);assert.equal(state.fireworks.type,'chrysanthemum');assert.equal(nodes['quick-firework-description'].hidden,true);assert.equal(nodes['firework-complex-description'].hidden,true);}
 await api.submitFireworks({type:'peony'});assert.match(nodes['firework-height'].textContent,/标准仰角约120米/);
});
await check('Declined complex edit restores shared selection, description, profile and busy state',async()=>{
 await api.submitFireworks({type:'display-saturn'});handler=async()=>({accepted:false,reason:'fixture rejection'});
 nodes['quick-firework-type'].value='type:display-vfan';await nodes['quick-firework-type'].fire('change');
 assert.equal(state.fireworks.type,'display-saturn');assert.equal(nodes['quick-firework-type'].value,'type:display-saturn');assert.equal(nodes['firework-type'].value,'display-saturn');assert.ok(nodes['quick-firework-description'].textContent.includes('流彩·星环'));assert.equal(nodes['quick-firework-type'].disabled,false);assert.equal(nodes['quick-firework-type'].attributes['aria-busy'],'false');
 handler=async payload=>({settings:{...payload}});
});
await check('Selection never launches; quick launch/random/auto retain the original action and pause semantics',async()=>{
 assert.equal(calls.filter(call=>call.action!=='change').length,0);await nodes['quick-launch'].fire('click');assert.equal(calls.at(-1).action,'launch');await nodes['quick-random'].fire('click');assert.equal(calls.at(-1).action,'random');
 state.paused=true;await nodes['quick-auto'].fire('click');assert.equal(state.fireworks.autoLaunch,true);assert.equal(state.fireworks.effectProfile,'legacy');assert.equal(resumes,1);assert.equal(state.paused,false);assert.equal(nodes['quick-auto'].attributes['aria-pressed'],'true');
 state.fireworks.active=12;state.fireworks.maxActive=32;quick.syncFireworks();assert.match(nodes['quick-firework-status'].textContent,/空中 12 \/ 32 发/);
 await nodes['quick-stop'].fire('click');assert.equal(calls.at(-1).action,'stop');assert.equal(state.fireworks.active,12);assert.equal(state.fireworks.autoLaunch,false);
});
const report={schema:'glass-atoll.complex-firework-ui-cpu-check.v1',passed:results.every(result=>result.passed),counts:{passed:results.filter(result=>result.passed).length,total:results.length},actualGPU:false,browserUsed:false,scope:'Actual quick module, real UI update/submit/type-change functions and real registry/definitions with small DOM/callback stubs. No launch simulation, renderer, layout, GPU, audio or FPS claim.',sourcePins:Object.fromEntries(['index.html','ui.js','ui-quick-experience.js','fireworks-physics.js','complex-fireworks.js'].map(file=>[file,sha(fs.readFileSync(new URL(file,root)))])),results};
fs.writeFileSync(new URL('ui-check.json',import.meta.url),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({passed:report.passed,counts:report.counts,failed:results.filter(result=>!result.passed)},null,2));if(!report.passed)process.exitCode=1;
