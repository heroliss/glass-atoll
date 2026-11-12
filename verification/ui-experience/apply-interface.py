from pathlib import Path
import hashlib,json,shutil
root=Path(__file__).resolve().parents[2]
backup=root/'verification/ui-experience/before'
backup.mkdir(parents=True,exist_ok=False)
pins={}
for name in ['index.html','style.css','ui.js','main.js','package.json']:
 p=root/name; shutil.copy2(p,backup/name);pins[name]=hashlib.sha256(p.read_bytes()).hexdigest()
(backup/'pins.json').write_text(json.dumps(pins,indent=2)+'\n',encoding='utf-8')
def edit(name,changes):
 p=root/name;s=p.read_text(encoding='utf-8')
 for old,new in changes:
  assert s.count(old)==1,(name,old[:80],s.count(old));s=s.replace(old,new)
 p.write_text(s,encoding='utf-8')
presets='''    <section class="showcase-panel chrome" aria-labelledby="showcase-heading">
      <div class="showcase-heading"><h2 id="showcase-heading">海岛时刻</h2><span>时间 ＋ 机位</span></div>
      <div class="showcase-options" role="group" aria-label="风景组合预设">
        <button type="button" data-showcase="glass-day" aria-pressed="false"><span>玻璃晴昼</span><small>浅海 · 日光</small></button>
        <button type="button" data-showcase="sunset" aria-pressed="false"><span>海上日落</span><small>面朝落日</small></button>
        <button type="button" data-showcase="blue-hour" aria-pressed="false"><span>蓝调烟花</span><small>暮光 · 离岛全景</small></button>
        <button type="button" data-showcase="starry-night" aria-pressed="false"><span>星河与海</span><small>无月夜示例</small></button>
      </div>
      <p id="showcase-status" role="status" aria-live="polite">选择一个时刻，去海边看看。</p>
    </section>

'''
quick='''    <section id="experience-dock" class="experience-dock chrome" aria-label="常用操作">
      <div class="fireworks-quick">
        <div class="quick-heading"><h2>海岛烟花</h2><button type="button" id="quick-firework-settings" class="text-action">详细设置 <span aria-hidden="true">↗</span></button></div>
        <div class="quick-firework-controls">
          <label class="sr-only" for="quick-firework-type">快捷烟花样式</label>
          <select id="quick-firework-type">
            <optgroup label="常用样式"><option value="type:peony">牡丹</option><option value="type:chrysanthemum">菊</option><option value="type:willow">垂柳</option><option value="type:palm">棕榈</option><option value="type:smiley">笑脸</option><option value="type:heart">爱心</option><option value="type:crossette">分裂十字</option><option value="type:strobe">闪星</option><option value="type:comet">扇形彗星</option><option value="type:bouquet">近地花束</option></optgroup>
            <optgroup label="单发实验样式"><option value="profile:three-heart-v1">三层芯 · 菊（实验）</option><option value="profile:three-heart-radiant120-v1">三层菊 · 长金尾（实验）</option><option value="profile:two-colour-v1">红转绿 · 菊（实验）</option></optgroup>
          </select>
          <button type="button" id="quick-launch" class="quick-primary">放一枚烟花</button>
          <button type="button" id="quick-random" class="quick-secondary">随机一发</button>
          <button type="button" id="quick-auto" class="quick-secondary" aria-pressed="false">持续随机</button>
          <button type="button" id="quick-stop" class="quick-secondary">停止后续</button>
        </div>
        <p id="quick-firework-status" role="status" aria-live="polite">选择样式，立即发射。</p>
      </div>
PLAYBACK
    </section>'''
p=root/'index.html';s=p.read_text(encoding='utf-8');start=s.index('    <div class="scene-actions chrome"');end=s.index('\n\n    <div id="performance-hud"',start)
playback=s[start:end].replace('class="scene-actions chrome"','class="playback-actions"').replace('class="drop-button"','class="quick-secondary"')
s=s[:start]+quick.replace('PLAYBACK',playback)+s[end:]
s=s.replace('    <aside id="view-drawer"',presets+'    <aside id="view-drawer"',1)
s=s.replace('aria-label="场景设置"','aria-label="详细场景设置"',1).replace('</svg>场景设置</span>','</svg>详细设置</span>',1)
s=s.replace('<option value="sun">朝向太阳</option>','<option value="fireworks">烟花与离岛</option><option value="stars">星河视角</option><option value="sun">朝向太阳</option>',1)
s=s.replace('</div><div class="view-extras">','</div><button type="button" class="view-card view-card-compact" data-view="fireworks" aria-pressed="false"><span class="view-card-name">烟花与离岛</span><span class="view-card-caption">留出完整夜空</span></button><div class="view-extras">',1)
p.write_text(s,encoding='utf-8')
edit('ui.js',[
 ("import {FIREWORK_TYPES} from './fireworks-physics.js';", "import {FIREWORK_TYPES} from './fireworks-physics.js';\nimport {initQuickExperience} from './ui-quick-experience.js';"),
 ("stars:'星河视角'", "stars:'星河视角',fireworks:'烟花与离岛'"),
 ('  let toastTimer;', '  let quickExperience=null;\n  let toastTimer;'),
 ('    try { return await callbacks[key]?.(...args); }', "    if(['onTimeChange','onTimePreset','onLocationChange','onNightPreset','onNightChange','onView','onDirectorChange','onSunChange','onWeatherPreset','onWeatherChange','onReset'].includes(key))quickExperience?.clearShowcase();\n    try { return await callbacks[key]?.(...args); }"),
 ("  function submitFireworks(patch) {", "  function submitFireworks(patch) {"),
 ("    invoke('onFireworksChange',{type,autoLaunch,autoDirection,azimuth,elevation,autoFrame,persistentSmoke,cloudIllumination,resolvedSmokeLighting,intensityScale,intervalSeconds,launchSpreadDegrees,burstTiltDegrees,burstRollDegrees,effectProfile});", "    return invoke('onFireworksChange',{type,autoLaunch,autoDirection,azimuth,elevation,autoFrame,persistentSmoke,cloudIllumination,resolvedSmokeLighting,intensityScale,intervalSeconds,launchSpreadDegrees,burstTiltDegrees,burstRollDegrees,effectProfile});"),
 ("  updateQualityUI();updateTimeUI();updateLampUI();updateFlashlightUI();updateFireworksUI();", "  quickExperience=initQuickExperience({state,callbacks,submitFireworks,invoke,togglePause,notify,openSettings(category){setCategory(category);setPanel(true);$('#tab-'+category).focus({preventScroll:true});}});\n  updateQualityUI();updateTimeUI();updateLampUI();updateFlashlightUI();updateFireworksUI();"),
 ('    setView,setPanel,setViews,setCategory,setHidden,', '    setView,setPanel,setViews,setCategory,setHidden,\n    clearShowcase(){quickExperience?.clearShowcase();},'),
 ("      const clock=state.time;", "      const clock=state.time;if(Object.hasOwn(info,'preset'))clock.preset=info.preset;"),
 ("      if(info.message)$('#firework-status').textContent=info.message;", "      for(const key of ['active','queued'])if(Number.isFinite(info[key]))state.fireworks[key]=info[key];\n      if(info.message)$('#firework-status').textContent=info.message;")
])
# Place the one presentation sync at the end of the existing canonical update.
p=root/'ui.js';s=p.read_text(encoding='utf-8');a=s.index('  function updateFireworksUI() {');b=s.index('  function submitFireworks',a);chunk=s[a:b];i=chunk.rfind('\n  }');assert i>0;chunk=chunk[:i]+'\n    quickExperience?.syncFireworks();'+chunk[i:];s=s[:a]+chunk+s[b:];p.write_text(s,encoding='utf-8')
edit('main.js',[
 ("let time=0,fps=0,transition=null,environmentTimer,pauseTargetTime=null,transientIndirectEnabled=true;", "let time=0,fps=0,transition=null,environmentTimer,pauseTargetTime=null,transientIndirectEnabled=true;\nlet showcaseRequest=0,showcaseCameraApplying=false;"),
 ("  onTimeChange(value){return setTime(value);},", "  onShowcase(id){return applyShowcase(id);},\n  onTimeChange(value){showcaseRequest++;return setTime(value);},"),
 ("  stars:{position:[38,2.5,-46],target:[5,26,4]},", "  stars:{position:[38,2.5,-46],target:[5,26,4]},\n  fireworks:{position:[-157,12,-367],target:[24,66,7]},"),
 ("  await setTime({utcMs:utc,mode:'astronomical'});ui.notify", "  await setTime({utcMs:utc,mode:'astronomical'});ui.syncTime({preset:name});ui.notify"),
 ("function manualCameraActivity(){\n  stopDirector", "function manualCameraActivity(){\n  if(!showcaseCameraApplying){showcaseRequest++;ui.clearShowcase?.();}\n  stopDirector")
])
showcase='''async function applyShowcase(id){
  const presets={'glass-day':{time:'day',view:'lagoon'},sunset:{time:'sunset',view:'sun'},'blue-hour':{time:'sunset',offsetMinutes:18,view:'fireworks'},'starry-night':{time:'stars',view:'stars'}};
  const preset=presets[id];if(!preset)throw new RangeError('Unknown showcase preset');
  if(!celestialController||!camera||qaRenderLock||qualityApplying||graphicsContextInterrupted)throw new Error('Scene is not ready for a showcase');
  const request=++showcaseRequest;
  // Presets compose existing time/camera operations. Sound, weather, quality,
  // physical smoke and active fireworks remain independent user choices.
  await setNightPreset(preset.time);if(request!==showcaseRequest)return false;
  await setTime({running:false,...(preset.offsetMinutes?{utcMs:celestialController.state.utcMs+preset.offsetMinutes*60000}:{})});
  if(request!==showcaseRequest)return false;
  ui.syncTime({preset:preset.offsetMinutes?null:preset.time});
  showcaseCameraApplying=true;
  try{moveTo(preset.view);}finally{showcaseCameraApplying=false;}
  return {id,view:preset.view,clockStopped:true,launched:false};
}

'''
p=root/'main.js';s=p.read_text(encoding='utf-8');key='async function setNightPreset(name){';assert s.count(key)==1;s=s.replace(key,showcase+key);p.write_text(s,encoding='utf-8')
edit('package.json',[("node --check smoke-joint-work.js", "node --check smoke-joint-work.js && node --check ui-quick-experience.js")])
print(json.dumps({'backups':str(backup),'before':pins,'after':{name:hashlib.sha256((root/name).read_bytes()).hexdigest() for name in pins}},indent=2))
