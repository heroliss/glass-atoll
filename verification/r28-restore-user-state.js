// Diagnostic restoration only. Uses the app's existing setters and controls;
// it does not replay an old cloud/wave instant or change system HDR settings.
export async function restoreR28UserState(saved){
  const a=window.__ATOLL__,p=saved.state.parameters;
  if(!a?.state.ready||a.state.graphicsContextInterrupted)throw Error('Healthy loaded scene required');
  if(a.fireworks().active||a.fireworks().queued||a.smoke().state.packetCount)throw Error('Transient content must be retired before restoring settings');
  a.pause(true);
  await a.setQuality(p.qualityPreset);
  a.setSun({...p.sun});
  await a.setTime({mode:saved.celestial.mode,utcMs:saved.celestial.utcMs,running:saved.celestial.running,rate:saved.celestial.rate,...saved.celestial.observer,refraction:saved.celestial.refraction,timeZoneOffsetMinutes:saved.celestial.timeZoneOffsetMinutes});
  a.setWeather({...p.weather});a.setAir({...p.air});a.setSea({...p.sea});
  for(const [key,id]of [['wind','wind-speed'],['current','current-speed']])if(a.state.parameters[key]!==p[key]){
    const element=document.getElementById(id);if(!element)throw Error('Missing existing control '+id);
    element.value=String(p[key]);element.dispatchEvent(new Event('input',{bubbles:true}));
  }
  await a.setGraphics({...p.graphics});a.setLens({...p.lens});
  a.setLocalLights({mode:saved.localLights.mode,linked:saved.localLights.linked,lamps:saved.localLights.lamps.map(x=>({...x})),flashlight:{...saved.localLights.flashlight}});
  a.setFireworks({...saved.fireworks.settings});
  a.setCamera(saved.state.camera,saved.state.target,{expandFramingLimits:true});a.setDirector({...p.director});
  if(a.state.parameters.sound!==p.sound)document.getElementById('sound').click();
  const ui=saved.interface;
  if(a.interfaceState().panelOpen!==ui.panelOpen)document.getElementById('panel-toggle').click();
  if(a.interfaceState().activeCategory!==ui.activeCategory)document.getElementById('tab-'+ui.activeCategory).click();
  if(a.interfaceState().viewsOpen!==ui.viewsOpen)document.getElementById('views-toggle').click();
  if(a.interfaceState().statsVisible!==ui.statsVisible)document.getElementById('stats-toggle').click();
  if(a.interfaceState().hidden!==ui.hidden)document.getElementById('hide-ui').click();
  a.pause(p.paused);
  return{ready:a.state.ready,paused:a.state.parameters.paused,active:a.fireworks().active,packets:a.smoke().state.packetCount,interface:a.interfaceState(),gl:a.readGLErrors('r28-restore')};
}
