import assert from 'node:assert/strict';
import {readFileSync,writeFileSync} from 'node:fs';
import {FIREWORK_TYPES} from '../fireworks-physics.js';
const source=readFileSync(new URL('../ui.js',import.meta.url),'utf8'),html=readFileSync(new URL('../index.html',import.meta.url),'utf8'),old=readFileSync(new URL('r15-ui-before-index.html',import.meta.url),'utf8'),main=readFileSync(new URL('../main.js',import.meta.url),'utf8');
const checks=[];function check(name,fn){try{fn();checks.push({name,passed:true});}catch(error){checks.push({name,passed:false,error:String(error.stack)});}}
const attrs=s=>Object.fromEntries([...s.matchAll(/([\w-]+)(?:="([^"]*)")?/g)].map(m=>[m[1],m[2]??true]));
function controls(s){const map=new Map();for(const tag of s.matchAll(/<(input|select|button)\b[^>]*\bid="[^"]+"[^>]*>/g)){const a=attrs(tag[0]);map.set(a.id,{tag:tag[1],attributes:a});}return map;}
check('137 retained legacy ids are unique, charged scene-throw replacement exists, and labels resolve',()=>{
  const before=[...old.matchAll(/\bid="([^"]+)"/g)].map(m=>m[1]),after=[...html.matchAll(/\bid="([^"]+)"/g)].map(m=>m[1]);
  assert.equal(before.length,138);assert.equal(after.length,new Set(after).size);
  // The UI-r2 product change deliberately removed the prominent stone button.
  // Every other R15 ID remains required; its replacement is exercised below.
  assert.deepEqual(before.filter(id=>!after.includes(id)),['drop-stone']);
  for(const id of ['throw-control-hint','throw-charge','throw-charge-label'])assert(after.includes(id),id);
  assert.match(html,/<[^>]+id="throw-charge"[^>]+role="meter"[^>]+aria-valuemin="0"[^>]+aria-valuemax="100"/);
  for(const m of html.matchAll(/<label[^>]*\bfor="([^"]+)"/g))assert(after.includes(m[1]));
});
function options(markup,id){
  const inner=markup.match(new RegExp('<select[^>]*id="'+id+'"[^>]*>([\\s\\S]*?)<\\/select>'))?.[1];
  assert.notEqual(inner,undefined,'Missing select '+id);
  return [...inner.matchAll(/<option\b([^>]*)>([\s\S]*?)<\/option>/g)].map(match=>({attributes:attrs(match[1]),label:match[2]}));
}
check('legacy form contracts retained with explicit smoke-default, brightness, and additive option migrations',()=>{
  const before=controls(old),after=controls(html),keys=['type','min','max','step','value','disabled','checked','data-callback'];
  const migratedAttributes={'firework-brightness':{min:'0.1',step:'0.1'},'persistent-smoke':{checked:undefined}};
  for(const [id,b]of before){
    if(id==='drop-stone')continue;
    const a=after.get(id);assert(a,id);assert.equal(a.tag,b.tag,id);
    for(const key of keys){const patch=migratedAttributes[id],expected=patch&&Object.hasOwn(patch,key)?patch[key]:b.attributes[key];assert.deepEqual(a.attributes[key],expected,id+':'+key);}
    if(b.tag!=='select')continue;
    const previous=options(old,id),current=options(html,id),values=current.map(option=>option.attributes.value);
    assert.equal(values.length,new Set(values).size,id+':duplicate option');
    for(const option of previous)assert.deepEqual(current.find(now=>now.attributes.value===option.attributes.value),option,id+':'+option.attributes.value);
    if(id==='view-preset')assert.deepEqual(values.filter(value=>!previous.some(option=>option.attributes.value===value)),['fireworks','fireworks-close','stars']);
    else if(id==='firework-type')assert.deepEqual(values,FIREWORK_TYPES.map(type=>type.id),'HTML/firework registry disagreement');
    else assert.deepEqual(current,previous,id);
    assert.equal(current.find(option=>option.attributes.selected)?.attributes.value??values[0],previous.find(option=>option.attributes.selected)?.attributes.value??previous[0].attributes.value,id+':default option');
  }
});
check('eight actual static image paths and eight native tab panels with matching ids',()=>{const images=[...html.matchAll(/<img src="\.\/assets\/views\/([^"/]+)\.webp"/g)].map(m=>m[1]);assert.deepEqual(images,['shore','lagoon','aerial','sandbar','palm','reef','waterline','island']);assert.equal((html.match(/role="tabpanel"/g)||[]).length,8);assert.equal((html.match(/role="tab"/g)||[]).length,8);for(const m of html.matchAll(/aria-controls="(settings-[^"]+)"/g))assert(html.includes('id="'+m[1]+'"'));});
check('actual scene throw handlers support charged pointer release and Enter, cancelling drag and interruptions',()=>{
  const begin=main.indexOf('function bindInteraction(){'),end=main.indexOf("  canvas.addEventListener('webglcontextlost'",begin);
  assert(begin>=0&&end>begin,'Actual scene interaction registration missing');
  const canvasEvents=new Map(),documentEvents=new Map(),windowEvents=new Map(),throws=[],chargeUpdates=[];
  let tick=0,focusCalls=0;
  const sceneCanvas={addEventListener:(name,fn)=>canvasEvents.set(name,fn),focus(){focusCalls++;}};
  const pageDocument={hidden:false,addEventListener:(name,fn)=>documentEvents.set(name,fn)};
  new Function('THREE','renderer','ui','performance','document','addEventListener','throwFromCamera',
    'let throwGesture=null,focusPicking=false,pendingThrow=null;'+main.slice(begin,end)+'\n}\nbindInteraction();')(
      {MathUtils:{clamp:(value,min,max)=>Math.max(min,Math.min(max,value))}},
      {domElement:sceneCanvas},{setThrowCharge:(...args)=>chargeUpdates.push(args)},{now:()=>tick},pageDocument,
      (name,fn)=>windowEvents.set(name,fn),(point,charge)=>throws.push({point,charge}));
  const event=(patch={})=>({isPrimary:true,button:0,clientX:80,clientY:120,altKey:false,...patch});
  canvasEvents.get('pointerdown')(event());tick=600;canvasEvents.get('pointerup')(event());
  assert.deepEqual(throws,[{point:{x:80,y:120},charge:.5}]);assert.equal(focusCalls,1);
  tick=1000;canvasEvents.get('pointerdown')(event());tick=3000;canvasEvents.get('pointerup')(event());assert.equal(throws.at(-1).charge,1);
  const validThrows=throws.length;
  canvasEvents.get('pointerdown')(event());canvasEvents.get('pointermove')(event({clientX:86}));canvasEvents.get('pointerup')(event());assert.equal(throws.length,validThrows,'Dragging must not throw');
  for(const cancel of [()=>canvasEvents.get('pointercancel')(),()=>windowEvents.get('blur')(),()=>{pageDocument.hidden=true;documentEvents.get('visibilitychange')();pageDocument.hidden=false;}]){
    canvasEvents.get('pointerdown')(event());cancel();canvasEvents.get('pointerup')(event());assert.equal(throws.length,validThrows,'Cancelled gesture threw a stone');
  }
  canvasEvents.get('pointerdown')(event({isPrimary:false}));canvasEvents.get('pointerup')(event());
  canvasEvents.get('pointerdown')(event({button:2}));canvasEvents.get('pointerup')(event());assert.equal(throws.length,validThrows);
  let prevented=false;canvasEvents.get('keydown')({key:'Enter',preventDefault(){prevented=true;}});
  assert(prevented);assert.deepEqual(throws.at(-1),{point:null,charge:.45});assert.equal(throws.length,validThrows+1);
  assert(chargeUpdates.length>0&&chargeUpdates.every(update=>update[0]===0&&update[1]===false),'Interruptions clear the charge meter');
});
check('actual view selector accepts all 13 current presets and keeps cards label and select coherent',()=>{
  const begin=source.indexOf('  function setView(name)'),end=source.indexOf('  function updateSunUI()',begin),labels=source.match(/^const viewLabels = .*;$/m)?.[0];
  assert(begin>=0&&end>begin&&labels,'Actual view logic missing');
  const buttons=[...html.matchAll(/<button\b[^>]*data-view="([^"]+)"[^>]*>/g)].map(match=>({dataset:{view:match[1]},attributes:{},setAttribute(key,value){this.attributes[key]=value;}}));
  const nodes={'#view-label':{},'#view-preset':{}},viewState={view:'shore'};
  const setView=new Function('document','state','$',labels+source.slice(begin,end)+';return setView;')({querySelectorAll(selector){assert.equal(selector,'[data-view]');return buttons;}},viewState,selector=>{assert(nodes[selector],selector);return nodes[selector];});
  const presets=options(html,'view-preset');assert.equal(presets.length,13);
  for(const preset of presets){
    const name=preset.attributes.value;setView(name);assert.equal(viewState.view,name);assert.equal(nodes['#view-preset'].value,name);assert(nodes['#view-label'].textContent?.length>0);
    for(const button of buttons)assert.equal(button.attributes['aria-pressed'],String(button.dataset.view===name));
  }
  const before={...viewState};setView('unknown-view');assert.deepEqual(viewState,before,'Unknown view must not alter the selection');
});
class El{constructor(){this.hidden=false;this.attrs={};this.classList={toggle:(k,on)=>{this.attrs['class:'+k]=on}};this.tabIndex=0;this.scrollTop=100;this.descendants=[];}setAttribute(k,v){this.attrs[k]=v;}contains(x){return this.descendants.includes(x);}focus(){doc.activeElement=this;}}
const map=new Map(),$=s=>{if(!map.has(s))map.set(s,new El());return map.get(s);};let compact=false;const surfaces=[new El(),new El(),new El()],doc={activeElement:null,body:new El(),querySelectorAll:s=>{assert.equal(s,'.chrome');return surfaces;}},win={matchMedia:s=>({matches:compact})},state={panelOpen:false,viewsOpen:false,hidden:false,activeCategory:'sea',statsVisible:true,paused:false,stats:{fps:null,gpuMs:null,paused:false,status:'ready',renderScale:1}};
const start=source.indexOf('  const settingsCategories='),end=source.indexOf('  function setView(name)',start);assert(start>0&&end>start);
const api=new Function('document','window','state','$',source.slice(start,end)+';return{setPanel,setViews,setCategory,setHidden,updatePerformanceUI};')(doc,win,state,$);
check('actual category logic exposes exactly one panel and one tabbable selected tab',()=>{for(const selected of ['sea','weather','time','lighting','lamps','fireworks','camera','navigation']){api.setCategory(selected,{focus:true});for(const key of ['sea','weather','time','lighting','lamps','fireworks','camera','navigation']){assert.equal($('#settings-'+key).hidden,key!==selected);assert.equal($('#tab-'+key).attrs['aria-selected'],String(key===selected));assert.equal($('#tab-'+key).tabIndex,key===selected?0:-1);}assert.equal(doc.activeElement,$('#tab-'+selected));assert.equal($('.settings-scroll').scrollTop,0);}api.setCategory('invalid');assert.equal(state.activeCategory,'navigation');});
check('actual drawers independent desktop and mutually exclusive compact',()=>{compact=false;api.setPanel(true);api.setViews(true);assert(state.panelOpen&&state.viewsOpen);compact=true;api.setPanel(true);assert(state.panelOpen&&!state.viewsOpen);api.setViews(true);assert(state.viewsOpen&&!state.panelOpen);api.setViews(false);assert($('#views-content').hidden);assert.equal($('#views-toggle').attrs['aria-expanded'],'false');});
check('actual close returns focus before hiding controls and H preserves drawer state',()=>{compact=false;api.setPanel(true);api.setViews(true);const focus=new El();$('#panel-content').descendants=[focus];doc.activeElement=focus;api.setPanel(false);assert.equal(doc.activeElement,$('#panel-toggle'));api.setPanel(true);api.setHidden(true);assert(surfaces.every(v=>v.inert));assert.equal(doc.activeElement,$('#restore-ui'));assert(state.panelOpen&&state.viewsOpen);api.setHidden(false);assert(surfaces.every(v=>!v.inert));assert.equal(doc.activeElement,$('#hide-ui'));assert($('#restore-ui').hidden);});
check('actual FPS formatter handles normal paused interrupted unavailable and optional GPU',()=>{Object.assign(state.stats,{fps:61.6,gpuMs:7.21,paused:false,status:'ready',renderScale:.8});state.paused=false;api.updatePerformanceUI();assert.equal($('#fps-value').textContent,'62');assert.equal($('#performance-detail').textContent,'GPU 7.2 ms · 内部像素 80%');state.stats.paused=true;api.updatePerformanceUI();assert.equal($('#fps-value').textContent,'—');assert.equal($('#performance-detail').textContent,'已暂停');state.stats.paused=false;state.stats.status='interrupted';api.updatePerformanceUI();assert.equal($('#fps-value').textContent,'—');assert.equal($('#performance-detail').textContent,'画面已中断');Object.assign(state.stats,{fps:null,gpuMs:null,status:'ready',renderScale:1});api.updatePerformanceUI();assert.equal($('#performance-detail').textContent,'正在测量');state.statsVisible=false;api.updatePerformanceUI();assert($('#performance-hud').hidden);assert.equal($('#stats-toggle').attrs['aria-label'],'显示帧率');});
const report={schema:'glass-atoll.r15-ui-check.v2',date:new Date().toISOString(),passed:checks.every(c=>c.passed),checks,counts:{passed:checks.filter(c=>c.passed).length,total:checks.length},contractMigrations:[{control:'drop-stone',change:'Prominent button removed in UI-r2; actual charged pointer/Enter scene interaction now exercised',evidence:'ui-r2/REPORT.md'},{control:'view-preset',change:'Ten original options retained; fireworks, fireworks-close and stars added; actual setView checks all 13'},{control:'firework-type',change:'Ten original options retained; full option list must match production FIREWORK_TYPES',evidence:'complex-fireworks/ACCEPTANCE.md'},{control:'firework-brightness',change:'Current UI range 0.1..32 with step0.1 and default1; other legacy attributes retained'},{control:'persistent-smoke',change:'Default-off long-lived volume smoke follows recommended light-smoke policy',evidence:'ui-r2/REPORT.md'}],limits:['Control inventory and actual extracted UI/scene-interaction logic with tiny DOM seams; not CSS layout or actual-browser acceptance.','No GPU or FPS measurement made by this agent. Root verifies rendered desktop/mobile, native controls, main frame counter and screenshots.']};
writeFileSync(new URL('r15-ui-check.json',import.meta.url),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report,null,2));if(!report.passed)process.exitCode=1;
