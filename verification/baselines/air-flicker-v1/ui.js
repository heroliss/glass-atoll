import {deriveWeather} from './weather.js';
const viewLabels = { shore: '沙滩视角', lagoon: '浅海视角', aerial: '俯瞰视角' };

export function initUI(callbacks = {}) {
  const $ = (selector) => document.querySelector(selector);
  const state = {
    sun: { azimuth: 100, elevation: 48, intensity: 1 },
    view: 'shore', quality: 'high', paused: false, sound: false, hidden: false,
    wind: 1.8, current: .16,
    weather:{humidity:.68,temperature:29,cloudBase:'auto',thickness:950,coverage:.35,shear:1.1},
    lens: { focal:28, aperture:8, exposure:0, dof:false, vignette:true, antialias:'smaa', automatic:true,temporal:true,glintAA:true },
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
    state.wind = 1.8;
    state.current = .16;
    state.weather={humidity:.68,temperature:29,cloudBase:'auto',thickness:950,coverage:.35,shear:1.1};
    state.lens={focal:28,aperture:8,exposure:0,dof:false,vignette:true,antialias:'smaa',automatic:true,temporal:true,glintAA:true};
    updateSunUI();
    updateWaterUI();
    updateLensUI();
    updateWeatherUI();
    setView('shore');
    invoke('onSunChange', { ...state.sun });
    invoke('onWind', state.wind);
    invoke('onCurrent', state.current);
    invoke('onWeatherChange',{...state.weather});
    invoke('onLensChange', {...state.lens});
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
  }
  for(const key of ['focal','exposure'])$(`#lens-${key}`).addEventListener('input',event=>{state.lens[key]=Number(event.target.value);updateLensUI();invoke('onLensChange',{...state.lens});});
  $('#lens-dof').addEventListener('change',event=>{state.lens.dof=event.target.checked;updateLensUI();invoke('onLensChange',{...state.lens});});
  $('#lens-aperture').addEventListener('change',event=>{state.lens.aperture=Number(event.target.value);invoke('onLensChange',{...state.lens});});
  $('#antialias').addEventListener('change',event=>{state.lens.antialias=event.target.value;invoke('onLensChange',{...state.lens});});
  $('#automatic-quality').addEventListener('change',event=>{state.lens.automatic=event.target.checked;invoke('onLensChange',{...state.lens});});
  $('#temporal-aa').addEventListener('change',event=>{state.lens.temporal=event.target.checked;invoke('onLensChange',{...state.lens});});
  $('#glint-aa').addEventListener('change',event=>{state.lens.glintAA=event.target.checked;invoke('onLensChange',{...state.lens});});
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
    else if (event.target.tagName === 'BUTTON') return;
    else if (event.code === 'Space') { event.preventDefault(); togglePause(); }
    else if (event.key.toLowerCase() === 'r') { reset(); }
    else if (['1','2','3'].includes(event.key)) {
      setView(['shore','lagoon','aerial'][Number(event.key) - 1]);
      invoke('onView', state.view);
    } else if (event.key === 'Escape' && window.matchMedia('(max-width: 600px)').matches) setPanel(false);
  });
  setPanel(state.panelOpen);
  updateSunUI();
  updateWaterUI();
  updateLensUI();
  updateWeatherUI();

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
    setStats(info = {}) {
      if (info.message) $('#scene-status').textContent = info.message;
      if (info.loading) { const detail = $('.loading-detail'); if (detail) detail.textContent = info.loading; }
      if (info.error) {
        $('#error-detail').textContent = info.error;
        $('#error').hidden = false;
      }
    },
  };
}
