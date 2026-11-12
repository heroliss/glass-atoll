import fs from 'node:fs';
const read=file=>fs.readFileSync(file,'utf8').replaceAll('\r\n','\n');
const write=(file,source)=>fs.writeFileSync(file,source.replaceAll('\n','\r\n'));
let html=read('index.html');
const timeStart=html.indexOf('    <section class="showcase-panel chrome"');
const timeEnd=html.indexOf('    <aside id="view-drawer"',timeStart);
if(timeStart<0||timeEnd<0)throw new Error('Original time/showcase section missing');
html=html.slice(0,timeStart)+`    <section id="time-panel" class="time-panel chrome" aria-label="时间选择">
      <button type="button" id="time-panel-toggle" class="drawer-heading" aria-expanded="true" aria-controls="quick-time-content"><span>一天中的时刻</span><svg class="chevron" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.4" aria-hidden="true"><path d="m4 10 4-4 4 4"/></svg></button>
      <div id="quick-time-content">
        <p class="panel-caption">只改变时间，机位由你选择。</p>
        <div class="quick-time-options" role="group" aria-label="时间预设">
          <button type="button" data-quick-time="day" aria-pressed="false"><span>白昼</span><small>日光与玻璃海</small></button>
          <button type="button" data-quick-time="sunset" aria-pressed="false"><span>日落</span><small>当地落日时刻</small></button>
          <button type="button" data-quick-time="moon" aria-pressed="false"><span>月夜</span><small>有月夜示例</small></button>
          <button type="button" data-quick-time="stars" aria-pressed="false"><span>星空</span><small>无月夜示例</small></button>
        </div>
        <p id="quick-time-status" role="status" aria-live="polite">时间与机位独立，可分别切换。</p>
      </div>
    </section>

`+html.slice(timeEnd);
const wide='<button type="button" class="view-card view-card-compact" data-view="fireworks"';
const wideStart=html.indexOf(wide);
if(wideStart<0)throw new Error('Wide fireworks view missing');
const wideEnd=html.indexOf('</button>',wideStart)+9;
html=html.slice(0,wideEnd)+`<button type="button" class="view-card view-card-compact" data-view="fireworks-close" aria-pressed="false"><span class="view-card-name">岛边观烟花</span><span class="view-card-caption">靠近小岛，抬头看花火</span></button>`+html.slice(wideEnd);
html=html.replace('<option value="fireworks">烟花与离岛</option>','<option value="fireworks">烟花与离岛</option><option value="fireworks-close">岛边观烟花</option>');
const dockStart=html.indexOf('    <section id="experience-dock"');
const dockEnd=html.indexOf('    <div id="performance-hud"',dockStart);
if(dockStart<0||dockEnd<0)throw new Error('Original experience dock missing');
const oldDock=html.slice(dockStart,dockEnd);
const controlsStart=oldDock.indexOf('        <div class="quick-firework-controls">');
const controlsEnd=oldDock.indexOf('      </div>\n    <div class="playback-actions"');
const pause=oldDock.match(/          <button type="button" id="pause"[^\n]+/)[0].trim();
const reset=oldDock.match(/          <button type="button" id="reset"[^\n]+/)[0].trim();
if(controlsStart<0||controlsEnd<0)throw new Error('Firework controls missing');
html=html.slice(0,dockStart)+`    <section id="experience-dock" class="experience-dock chrome" aria-label="烟花与常用操作">
      <div class="experience-heading">
        <button type="button" id="fireworks-toggle" class="drawer-heading" aria-expanded="true" aria-controls="fireworks-content"><span>海岛烟花</span><svg class="chevron" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.4" aria-hidden="true"><path d="m4 10 4-4 4 4"/></svg></button>
        <div class="playback-actions" aria-label="场景操作">${pause}${reset}</div>
      </div>
      <div id="fireworks-content" class="fireworks-quick">
        <div class="quick-heading"><button type="button" id="quick-firework-settings" class="text-action">详细烟花设置 <span aria-hidden="true">↗</span></button></div>
${oldDock.slice(controlsStart,controlsEnd)}
      </div>
      <p id="throw-control-hint" class="control-hint">按住左键蓄力，松开投石</p>
    </section>

`+html.slice(dockEnd);
html=html.replace('aria-label="投石蓄力"','aria-label="投石力度"').replace('<span id="throw-charge-label" hidden>投石蓄力</span>','<span id="throw-charge-label">投石力度</span>');
html=html.replace('左拖环绕，右拖环顾，滚轮前后移动，按住左键蓄力投石。','左拖环绕，右拖环顾，滚轮前后移动。按住左键蓄力，松开投石。');
write('index.html',html);

let ui=read('ui.js');
ui=ui.replace("fireworks:'烟花与离岛'","fireworks:'烟花与离岛','fireworks-close':'岛边观烟花'");
ui=ui.replace("panelOpen: false, viewsOpen: false, activeCategory:","panelOpen: false, viewsOpen: false, timePanelOpen: true, fireworksOpen: true, activeCategory:");
ui=ui.replace("    if(['onTimeChange','onTimePreset','onLocationChange','onNightPreset','onNightChange','onView','onDirectorChange','onSunChange','onWeatherPreset','onWeatherChange','onReset'].includes(key))quickExperience?.clearShowcase();",`    if(['onTimeChange','onLocationChange','onSunChange','onReset'].includes(key)||(key==='onNightChange'&&args[0]?.date)){
      state.time.preset=null;quickExperience?.cancelTimePreset();
    }`);
ui=ui.replace("    document.querySelectorAll('[data-time]').forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.time===clock.preset)));","    document.querySelectorAll('[data-time]').forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.time===clock.preset)));\n    quickExperience?.syncTime();");
const categoryAnchor='  function setCategory(category,{focus=false}={}){';
if(!ui.includes(categoryAnchor))throw new Error('Category anchor missing');
ui=ui.replace(categoryAnchor,`  const compactLowLayout=()=>window.matchMedia('(max-width: 600px) and (max-height: 600px)').matches;
  function setTimePanel(open){
    open=!!open;
    if(open&&compactLowLayout())setFireworksPanel(false);
    if(!open&&$('#quick-time-content').contains(document.activeElement))$('#time-panel-toggle').focus({preventScroll:true});
    state.timePanelOpen=open;
    $('#time-panel-toggle').setAttribute('aria-expanded',String(open));
    $('#quick-time-content').hidden=!open;$('#time-panel').classList.toggle('collapsed',!open);
    document.body.classList.toggle('time-panel-collapsed',!open);
  }
  function setFireworksPanel(open){
    open=!!open;
    if(open&&compactLowLayout())setTimePanel(false);
    if(!open&&$('#fireworks-content').contains(document.activeElement))$('#fireworks-toggle').focus({preventScroll:true});
    state.fireworksOpen=open;
    $('#fireworks-toggle').setAttribute('aria-expanded',String(open));
    $('#fireworks-content').hidden=!open;$('#experience-dock').classList.toggle('collapsed',!open);
    document.body.classList.toggle('fireworks-collapsed',!open);
  }
`+categoryAnchor);
ui=ui.replace("  $('#views-toggle').addEventListener('click',()=>setViews(!state.viewsOpen));","  $('#views-toggle').addEventListener('click',()=>setViews(!state.viewsOpen));\n  $('#time-panel-toggle').addEventListener('click',()=>setTimePanel(!state.timePanelOpen));\n  $('#fireworks-toggle').addEventListener('click',()=>setFireworksPanel(!state.fireworksOpen));");
const dropStart=ui.indexOf("  $('#drop-stone').addEventListener('click', () => {");
const dropEnd=ui.indexOf("  $('#float-leaf').addEventListener",dropStart);
if(dropStart<0||dropEnd<0)throw new Error('Drop action anchor missing');
ui=ui.slice(0,dropStart)+ui.slice(dropEnd);
ui=ui.replace("  setPanel(state.panelOpen);setViews(state.viewsOpen);setCategory(state.activeCategory);updatePerformanceUI();","  setPanel(state.panelOpen);setViews(state.viewsOpen);setCategory(state.activeCategory);updatePerformanceUI();\n  setTimePanel(compactLowLayout()?false:state.timePanelOpen);setFireworksPanel(compactLowLayout()?false:state.fireworksOpen);");
ui=ui.replace('    setView,setPanel,setViews,setCategory,setHidden,','    setView,setPanel,setViews,setCategory,setHidden,setTimePanel,setFireworksPanel,');
ui=ui.replace('    clearShowcase(){quickExperience?.clearShowcase();},','    clearShowcase(){/* Compatibility: camera changes no longer clear independent time selection. */},');
ui=ui.replace("      $('#throw-charge-label').textContent=value>=.995?'已蓄满 · 松开投掷':'松开投掷';","      $('#throw-charge-label').textContent=`投石力度 · ${Math.round(value*100)}%`; ");
write('ui.js',ui);
