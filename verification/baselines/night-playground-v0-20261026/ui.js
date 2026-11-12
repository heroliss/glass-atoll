import {deriveWeather} from './weather.js';
const viewLabels = { shore: '沙滩视角', lagoon: '浅海视角', aerial: '俯瞰视角',stars:'星河视角',moon:'月夜视角' };

export function initUI(callbacks = {}) {
  const $ = (selector) => document.querySelector(selector);
  const state = {
    sun: { azimuth: 100, elevation: 48, intensity: 1 },
    view: 'shore', quality: 'high', paused: false, sound: false, hidden: false,
    wind: 1.8, current: .16,
    sea:{swellHeight:.16,windSea:1},
    graphics:{indirect:'low',shadows:'recommended',targetFps:60,hdr:false,hdrHeadroom:4,hdrMode:'auto',displayName:'auto',systemCalibration:true,peakNits:1000,paperWhiteNits:203,waveResolution:512},
    weather:{humidity:.68,temperature:29,cloudBase:'auto',thickness:950,coverage:.35,shear:1.1},
    air:{enabled:true,aerosolScale:8,shadows:true},
    lens: { focal:28, aperture:8, exposure:0, dof:false, vignette:true, antialias:'smaa', automatic:false,temporal:true,glintAA:true,opticalBloom:true,focusMode:'target',focusDistance:60 },
    night:{date:'2026-10-26T22:00',autoExposure:true},
    panelOpen: false,
  };
  let toastTimer;
  let ready = false;

  const notify = (message, duration = 2800) => {
    const toast = $('#toast');
    toast.textContent = message;
    toast.classList.add('visible');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toast.classList.remove('visible'), duration);
  };
  const invoke = async (key, ...args) => {
    try { return await callbacks[key]?.(...args); }
    catch (error) { console.error(`Atoll UI ${key}:`, error); notify('操作暂时没有完成，请再试一次'); }
  };

  function setPanel(open) {
    state.panelOpen = open;
    $('#panel-toggle').setAttribute('aria-expanded', String(open));
    $('#panel-content').hidden = !open;
    $('.control-panel').classList.toggle('collapsed', !open);
    document.body.classList.toggle('panel-expanded', open);
  }
  function setHidden(hidden) {
    state.hidden = hidden;
    document.body.classList.toggle('ui-hidden', hidden);
    $('#restore-ui').hidden = !hidden;
    if (hidden) $('#restore-ui').focus({ preventScroll: true });
    else $('#hide-ui').focus({ preventScroll: true });
  }
  function setView(name) {
    if (!viewLabels[name]) return;
    state.view = name;
    document.querySelectorAll('[data-view]').forEach((button) => button.setAttribute('aria-pressed', String(button.dataset.view === name)));
    $('#view-label').textContent = viewLabels[name];
  }
  function updateSunUI() {
    ['azimuth', 'elevation', 'intensity'].forEach((key) => {
      const slider = $(`#sun-${key}`);
      slider.value = state.sun[key];
      const progress = ((Number(slider.value) - Number(slider.min)) / (Number(slider.max) - Number(slider.min))) * 100;
      slider.style.setProperty('--fill', `${progress}%`);
      $(`#${key}-output`).textContent = key === 'intensity' ? `${Math.round(state.sun[key] * 100)}%` : `${Math.round(state.sun[key])}°`;
    });
  }
  function togglePause() {
    state.paused = !state.paused;
    $('#pause').setAttribute('aria-pressed', String(state.paused));
    $('#pause').setAttribute('aria-label', state.paused ? '继续波浪' : '暂停波浪');
    invoke('onPause', state.paused);
  }
  function updateWaterUI() {
    ['wind', 'current'].forEach((key) => {
      const slider = $(`#${key}-speed`);
      slider.value = state[key];
      const progress = ((Number(slider.value) - Number(slider.min)) / (Number(slider.max) - Number(slider.min))) * 100;
      slider.style.setProperty('--fill', `${progress}%`);
      const display = key === 'wind' ? state[key].toFixed(1) : String(Math.round(state[key] * 100));
      $(`#${key}-output`).textContent = `${display} ${key === 'wind' ? 'm/s' : 'cm/s'}`;
      slider.setAttribute('aria-valuetext', `${display} ${key === 'wind' ? '米每秒' : '厘米每秒'}`);
    });
  }
  function reset() {
    state.sun = { azimuth: 100, elevation: 48, intensity: 1 };
    state.sea={swellHeight:.16,windSea:1};
    state.graphics={indirect:'low',shadows:'recommended',targetFps:60,hdr:false,hdrHeadroom:4,hdrMode:'auto',displayName:'auto',systemCalibration:true,peakNits:1000,paperWhiteNits:203,waveResolution:512};
    state.wind = 1.8;
    state.current = .16;
    state.weather={humidity:.68,temperature:29,cloudBase:'auto',thickness:950,coverage:.35,shear:1.1};
    state.air={enabled:true,aerosolScale:8,shadows:true};
    state.lens={focal:28,aperture:8,exposure:0,dof:false,vignette:true,antialias:'smaa',automatic:false,temporal:true,glintAA:true,opticalBloom:true,focusMode:'target',focusDistance:60};
    updateSunUI();
    updateWaterUI();
    updateLensUI();
    updateWeatherUI();
    updateAirUI();
    setView('shore');
    invoke('onSunChange', { ...state.sun });
    invoke('onWind', state.wind);
    invoke('onCurrent', state.current);
    invoke('onWeatherChange',{...state.weather});
    invoke('onAirChange',{...state.air});
    invoke('onLensChange', {...state.lens});
    updateGraphicsUI();updateSeaUI();
    invoke('onSeaChange',{...state.sea});invoke('onGraphicsChange',{...state.graphics});
    invoke('onReset');
    notify('回到初见时的晴天');
  }

  $('#panel-toggle').addEventListener('click', () => setPanel(!state.panelOpen));
  $('#hide-ui').addEventListener('click', () => setHidden(true));
  $('#restore-ui').addEventListener('click', () => setHidden(false));
  $('#reset').addEventListener('click', reset);
  $('#pause').addEventListener('click', togglePause);
  $('#drop-stone').addEventListener('click', () => {
    if (state.paused) { togglePause(); }
    invoke('onDrop');
  });
  $('#float-leaf').addEventListener('click', async () => {
    if (state.paused) { togglePause(); }
    const placed=await invoke('onFloat');
    if(placed&&window.matchMedia('(max-width:600px)').matches)setPanel(false);
  });
  $('#find-leaf').addEventListener('click',async()=>{const found=await invoke('onFindLeaf');if(found&&window.matchMedia('(max-width:600px)').matches)setPanel(false);});
  function updateWeatherUI(){
    const derived=deriveWeather(state.weather);
    for(const key of ['humidity','temperature','coverage','thickness','shear']){
      const slider=$(`#weather-${key}`);slider.value=state.weather[key];
      slider.style.setProperty('--fill',`${(Number(slider.value)-Number(slider.min))/(Number(slider.max)-Number(slider.min))*100}%`);
      $(`#${key}-output`).textContent=key==='humidity'||key==='coverage'?`${Math.round(state.weather[key]*100)}%`:key==='temperature'?`${state.weather[key]}°C`:key==='shear'?`${state.weather[key].toFixed(1)} m/s/km`:`${state.weather[key]} m`;
    }
    $('#weather-auto-base').checked=state.weather.cloudBase==='auto';
    $('#weather-base').disabled=state.weather.cloudBase==='auto';
    $('#weather-base').value=String(derived.cloudBase);
    $('#weather-base').style.setProperty('--fill',`${(derived.cloudBase-100)/2900*100}%`);
    $('#base-output').textContent=`${Math.round(derived.cloudBase)} m`;
    $('#weather-diagnostic').textContent=`露点约 ${derived.dewPoint.toFixed(1)}°C。云随海风移动，较高处风速不同。`;
  }
  function updateAirUI(){
    $('#air-enabled').checked=state.air.enabled;$('#air-shadows').checked=state.air.shadows;
    const slider=$('#air-aerosol');slider.value=state.air.aerosolScale;
    slider.style.setProperty('--fill',`${state.air.aerosolScale/24*100}%`);
    $('#air-output').textContent=state.air.aerosolScale===0?'清澈':state.air.aerosolScale<8?'通透':state.air.aerosolScale<16?'轻霭':'薄雾';
  }
  $('#air-enabled').addEventListener('change',event=>{state.air.enabled=event.target.checked;updateAirUI();invoke('onAirChange',{...state.air});});
  $('#air-shadows').addEventListener('change',event=>{state.air.shadows=event.target.checked;updateAirUI();invoke('onAirChange',{...state.air});});
  $('#air-aerosol').addEventListener('input',event=>{state.air.aerosolScale=Number(event.target.value);updateAirUI();invoke('onAirChange',{...state.air});});
  for(const key of ['humidity','temperature','coverage','thickness','shear'])$(`#weather-${key}`).addEventListener('input',event=>{state.weather[key]=Number(event.target.value);updateWeatherUI();invoke('onWeatherChange',{...state.weather});});
  $('#weather-auto-base').addEventListener('change',event=>{state.weather.cloudBase=event.target.checked?'auto':Number($('#weather-base').value);updateWeatherUI();invoke('onWeatherChange',{...state.weather});});
  $('#weather-base').addEventListener('input',event=>{state.weather.cloudBase=Number(event.target.value);updateWeatherUI();invoke('onWeatherChange',{...state.weather});});
  ['wind', 'current'].forEach((key) => {
    $(`#${key}-speed`).addEventListener('input', (event) => {
      state[key] = Number(event.target.value);
      updateWaterUI();
      invoke(key === 'wind' ? 'onWind' : 'onCurrent', state[key]);
    });
  });
  $('#sound').addEventListener('click', async () => {
    const next=!state.sound,button=$('#sound');button.disabled=true;
    try{
      await callbacks.onSound?.(next);
      state.sound=next;button.setAttribute('aria-pressed',String(next));
      button.setAttribute('aria-label',next?'关闭环境声':'开启环境声');
      notify(next?'海浪与海风已开启':'环境声已关闭');
    }catch(error){console.error('Atoll sound:',error);notify('环境声暂时无法开启，请再试一次');}
    finally{button.disabled=false;}
  });
  function updateLensUI(){
    for(const key of ['focal','exposure']){
      const slider=$(`#lens-${key}`);slider.value=state.lens[key];
      slider.style.setProperty('--fill',`${(Number(slider.value)-Number(slider.min))/(Number(slider.max)-Number(slider.min))*100}%`);
      $(`#${key}-output`).textContent=key==='focal'?`${state.lens.focal} mm`:`${state.lens.exposure>0?'+':''}${state.lens.exposure.toFixed(1)} EV`;
    }
    $('#lens-dof').checked=state.lens.dof;$('#lens-aperture').value=String(state.lens.aperture);$('#lens-aperture').disabled=!state.lens.dof;
    $('#antialias').value=state.lens.antialias;$('#automatic-quality').checked=state.lens.automatic;
    $('#temporal-aa').checked=state.lens.temporal;
    $('#glint-aa').checked=state.lens.glintAA;
    $('#optical-bloom').checked=state.lens.opticalBloom;
    $('#focus-auto').checked=state.lens.focusMode!=='manual';$('#focus-distance').value=Number(state.lens.focusDistance).toFixed(1);
  }
  for(const key of ['focal','exposure'])$(`#lens-${key}`).addEventListener('input',event=>{state.lens[key]=Number(event.target.value);updateLensUI();invoke('onLensChange',{...state.lens});});
  $('#lens-dof').addEventListener('change',event=>{state.lens.dof=event.target.checked;updateLensUI();invoke('onLensChange',{...state.lens});});
  $('#lens-aperture').addEventListener('change',event=>{state.lens.aperture=Number(event.target.value);invoke('onLensChange',{...state.lens});});
  $('#antialias').addEventListener('change',event=>{state.lens.antialias=event.target.value;invoke('onLensChange',{...state.lens});});
  $('#automatic-quality').addEventListener('change',event=>{state.lens.automatic=event.target.checked;invoke('onLensChange',{...state.lens});});
  $('#temporal-aa').addEventListener('change',event=>{state.lens.temporal=event.target.checked;invoke('onLensChange',{...state.lens});});
  $('#glint-aa').addEventListener('change',event=>{state.lens.glintAA=event.target.checked;invoke('onLensChange',{...state.lens});});
  $('#optical-bloom').addEventListener('change',event=>{state.lens.opticalBloom=event.target.checked;invoke('onLensChange',{...state.lens});});
  $('#focus-auto').addEventListener('change',event=>{if(!event.target.checked)state.lens.focusDistance=Number($('#focus-distance').value)||60;state.lens.focusMode=event.target.checked?'target':'manual';invoke('onLensChange',{...state.lens});});
  $('#focus-distance').addEventListener('change',event=>{state.lens.focusMode='manual';state.lens.focusDistance=Math.max(.3,Number(event.target.value)||60);updateLensUI();invoke('onLensChange',{...state.lens});});
  $('#focus-pick').addEventListener('click',()=>invoke('onFocusPick'));
  $('#restore-pivot').addEventListener('click',()=>invoke('onRestorePivot'));
  document.querySelectorAll('[data-time]').forEach(button=>button.addEventListener('click',()=>invoke('onNightPreset',button.dataset.time)));
  $('#night-date').addEventListener('change',event=>{state.night.date=event.target.value;invoke('onNightChange',{...state.night});});
  $('#night-exposure').addEventListener('change',event=>{state.night.autoExposure=event.target.checked;invoke('onNightChange',{...state.night});});
  $('#screenshot').addEventListener('click', async () => {
    $('#screenshot').disabled = true;
    await invoke('onScreenshot');
    $('#screenshot').disabled = false;
  });
  $('#fullscreen').addEventListener('click', async () => {
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else if (document.documentElement.requestFullscreen) await document.documentElement.requestFullscreen();
      else notify('此浏览器暂不支持全屏');
    } catch { notify('浏览器暂时无法进入全屏'); }
  });
  document.addEventListener('fullscreenchange', () => {
    $('#fullscreen').setAttribute('aria-label', document.fullscreenElement ? '退出全屏' : '进入全屏');
    $('#fullscreen').setAttribute('aria-pressed', String(!!document.fullscreenElement));
  });
  ['azimuth', 'elevation', 'intensity'].forEach((key) => {
    $(`#sun-${key}`).addEventListener('input', (event) => {
      state.sun[key] = Number(event.target.value);
      updateSunUI();
      invoke('onSunChange', { ...state.sun });
    });
  });
  document.querySelectorAll('[data-view]').forEach((button) => button.addEventListener('click', () => {
    setView(button.dataset.view);
    invoke('onView', state.view);
  }));
  $('#quality').addEventListener('change', (event) => {
    state.quality = event.target.value;
    invoke('onQuality', state.quality);
    notify(state.quality === 'high' ? '细腻画质' : '流畅画质');
  });
  document.addEventListener('keydown', (event) => {
    if (!ready || event.ctrlKey || event.altKey || event.metaKey || event.repeat || ['INPUT','SELECT','TEXTAREA'].includes(event.target.tagName)) return;
    if (event.key.toLowerCase() === 'h') { event.preventDefault(); setHidden(!state.hidden); }
    else if (event.target.tagName === 'BUTTON'&&['Space','Enter'].includes(event.code)) return;
    else if (event.code === 'Space') { event.preventDefault(); togglePause(); }
    else if (event.key === 'Home') { event.preventDefault();setView('shore');invoke('onHome'); }
    else if (['1','2','3'].includes(event.key)) {
      setView(['shore','lagoon','aerial'][Number(event.key) - 1]);
      invoke('onView', state.view);
    } else if (event.key === 'Escape' && window.matchMedia('(max-width: 600px)').matches) setPanel(false);
  });
  function updateSeaUI(){
    $('#swell-height').value=state.sea.swellHeight;$('#wind-sea').value=state.sea.windSea;
    $('#swell-output').textContent=`${Math.round(state.sea.swellHeight*100)} cm`;
    $('#windsea-output').textContent=`${Math.round(state.sea.windSea*100)}%`;
    for(const id of ['swell-height','wind-sea']){const s=$('#'+id);s.style.setProperty('--fill',`${(s.value-s.min)/(s.max-s.min)*100}%`);}
  }
  function updateGraphicsUI(){
    $('#indirect-light').value=state.graphics.indirect;$('#shadow-quality').value=state.graphics.shadows;
    $('#frame-budget').value=state.graphics.targetFps;$('#wave-resolution').value=state.graphics.waveResolution;
    $('#hdr-mode').value=state.graphics.hdrMode;$('#hdr-display').value=state.graphics.displayName;
    $('#hdr-system').checked=state.graphics.systemCalibration;
    $('#hdr-peak').value=state.graphics.peakNits;$('#hdr-white').value=state.graphics.paperWhiteNits;
    $('#hdr-peak').disabled=$('#hdr-white').disabled=state.graphics.systemCalibration;
  }
  for(const [id,key]of [['swell-height','swellHeight'],['wind-sea','windSea']])$('#'+id).addEventListener('input',event=>{state.sea[key]=Number(event.target.value);updateSeaUI();invoke('onSeaChange',{...state.sea});});
  for(const [id,key]of [['indirect-light','indirect'],['shadow-quality','shadows'],['frame-budget','targetFps'],['wave-resolution','waveResolution'],['hdr-mode','hdrMode'],['hdr-display','displayName'],['hdr-peak','peakNits'],['hdr-white','paperWhiteNits']])$('#'+id).addEventListener('change',async event=>{state.graphics[key]=['targetFps','waveResolution','peakNits','paperWhiteNits'].includes(key)?Number(event.target.value):event.target.value;const result=await invoke('onGraphicsChange',{...state.graphics});if(result?.parameters)Object.assign(state.graphics,result.parameters);updateGraphicsUI();});
  $('#hdr-system').addEventListener('change',event=>{state.graphics.systemCalibration=event.target.checked;updateGraphicsUI();invoke('onGraphicsChange',{...state.graphics});});
  $('#hdr-refresh').addEventListener('click',async()=>{const button=$('#hdr-refresh');button.disabled=true;await invoke('onRefreshDisplay');button.disabled=false;});
  updateGraphicsUI();updateSeaUI();
  setPanel(state.panelOpen);
  updateSunUI();
  updateWaterUI();
  updateLensUI();
  updateWeatherUI();
  updateAirUI();

  return {
    state,
    notify,
    setView,
    showLeafAvailable(){ $('#find-leaf').hidden=false; },
    locateLeaf(location,show){const marker=$('#leaf-locator');marker.hidden=!(show&&location?.visible);if(!marker.hidden){marker.style.left=`${location.screen[0]}px`;marker.style.top=`${location.screen[1]}px`;}},
    setReady() {
      ready = true;
      const loading = $('#loading');
      if (loading) { loading.classList.add('leaving'); setTimeout(() => loading.remove(), 850); }
      document.body.classList.add('is-ready');
    },
    syncGraphics(value){Object.assign(state.graphics,value);updateGraphicsUI();},
    syncSun(value){Object.assign(state.sun,value);updateSunUI();},
    syncWeather(value){Object.assign(state.weather,value);updateWeatherUI();},
    syncLens(value){Object.assign(state.lens,value);updateLensUI();},
    setPaused(value){state.paused=!!value;$('#pause').setAttribute('aria-pressed',String(state.paused));$('#pause').setAttribute('aria-label',state.paused?'继续波浪':'暂停波浪');},
    locateImpact(point,visible){const marker=$('#impact-locator');marker.hidden=!visible;if(visible){marker.style.left=point[0]+'px';marker.style.top=point[1]+'px';}},
    setNight(info){if(info.label)document.querySelector('.place-name').textContent=info.label;if(info.date){state.night.date=info.date;$('#night-date').value=info.date;}if(info.autoExposure!==undefined){state.night.autoExposure=info.autoExposure;$('#night-exposure').checked=info.autoExposure;}if(info.message)$('#night-info').textContent=info.message;},
    setDisplays(report,selection){
      const select=$('#hdr-display');select.replaceChildren(new Option('自动识别（前台窗口/屏幕）','auto'));
      for(const d of report?.displays||[])select.add(new Option(`${d.friendlyName} · ${d.deviceName.split('\\').at(-1)} · ${Math.round(d.maxLuminanceNits)} nit`,d.deviceName));
      select.value=state.graphics.displayName;
      if(selection?.display){const d=selection.display;if(state.graphics.systemCalibration){state.graphics.peakNits=selection.peakNits||1000;state.graphics.paperWhiteNits=selection.paperWhiteNits||203;updateGraphicsUI();}const peak=selection.nativePeakNits>0?`${Math.round(selection.nativePeakNits)} nit`:'未读到峰值（回退值，需手动）',white=selection.nativeSDRWhiteNits>0?`${Math.round(selection.nativeSDRWhiteNits)} nit`:'未读到 SDR 白（回退203）';$('#hdr-calibration').textContent=`系统报告：峰值 ${peak}，SDR 白 ${white}。${selection.reason||''}；可手动选屏或输入校准值。`;}
      else $('#hdr-calibration').textContent='未取得系统亮度；可手动填写峰值与参考白。不会把示例值当成探测结果。';
    },
    setHDRSupport(info){
      state.graphics.hdr=!!info.enabled;
      $('#hdr-status').textContent=info.enabled?(info.calibrationSource==='unverified-fallback'?'HDR 已开启 · 回退亮度参数，需手动校准':'HDR 已开启 · 按亮度参数映射'):info.available?'当前支持 HDR，已选择 SDR':'当前显示环境使用 SDR';
      if(info.errors?.length)$('#hdr-status').textContent+=' · '+info.errors.at(-1);
    },
    setStats(info = {}) {
      if(Number.isFinite(info.focusMetres)){$('#focus-info').textContent=`当前对焦约 ${info.focusMetres.toFixed(1)} 米。广角远景景深大；靠近物体、增大光圈或焦距可观察虚化。`;if(state.lens.focusMode!=='manual'&&document.activeElement!==$('#focus-distance')){state.lens.focusDistance=info.focusMetres;$('#focus-distance').value=info.focusMetres.toFixed(1);}}
      if (info.message) $('#scene-status').textContent = info.message;
      if (info.loading) { const detail = $('.loading-detail'); if (detail) detail.textContent = info.loading; }
      if (info.error) {
        $('#error-detail').textContent = info.error;
        $('#error').hidden = false;
      }
    },
  };
}
