// Actual DOM handlers and actual scene uniforms; no duplicated UI callback logic.
export async function runFinalControlsRuntimeCheck(a){
  const wait=ms=>new Promise(r=>setTimeout(r,ms)),checks=[],add=(name,passed,detail)=>checks.push({name,passed:!!passed,detail});
  const saved={clock:a.celestial(),sun:{...a.state.parameters.sun},lights:a.localLights(),exposure:document.querySelector('#night-exposure').checked,quality:a.state.parameters.qualityPreset};
  const event=(id,value,type='change',checked=false)=>{const e=document.querySelector(id);if(checked)e.checked=value;else e.value=value;e.dispatchEvent(new Event(type,{bubbles:true}));};
  try{
    a.pause(true);await a.setTime({running:false});a.setSun({azimuth:110,elevation:48,intensity:1});
    const before=a.celestial();event('#night-exposure',!saved.exposure,'change',true);await wait(100);const after=a.celestial();
    add('DOM night exposure preserves artistic solar mode and UTC',after.mode==='artistic'&&after.utcMs===before.utcMs,{before:{mode:before.mode,utcMs:before.utcMs},after:{mode:after.mode,utcMs:after.utcMs}});
    event('#lamp-linked',true,'change',true);event('#lamp-brightness',.42,'input');await wait(50);event('#lamp-brightness',.63,'input');await wait(50);
    const lamps=a.localLights().lamps;add('DOM linked lamps remain linked after two slider inputs',document.querySelector('#lamp-linked').checked&&lamps.every(l=>l.brightness===.63),{linked:document.querySelector('#lamp-linked').checked,brightness:lamps.map(l=>l.brightness)});
    const samples=[];for(const intensity of [0,.5,1,2]){a.setSun({intensity});await wait(35);const p=a.photometry(),w=a.waterDiagnostics().lighting,expected=a.atmosphere().lighting.skyTintPhysical.toArray().map(v=>v*1.7);samples.push({intensity,P:p.storageEV,multiplier:w.ambientIntensity,rawSky:w.skyColourStored.map(v=>v/2**p.storageEV),expected});}
    add('water receives shared sky tint with solar intensity exactly once',samples.every(s=>s.multiplier===1&&s.rawSky.every((v,i)=>Math.abs(v-s.expected[i])<1e-10)),samples);
    const linearError=Math.max(...[0,1,2].map(c=>Math.abs((samples[3].rawSky[c]-samples[0].rawSky[c])-2*(samples[2].rawSky[c]-samples[0].rawSky[c]))));
    add('artistic water ambient responds linearly instead of intensity squared',linearError<1e-8,{linearError});
    await a.setGraphics({shadows:'soft',waveResolution:256});await wait(80);const q=a.state.parameters.renderSampling,actual={shadow:a.graphics().shadows.mapSize[0],wave:a.spectrum().resolution};
    add('custom quality effective values reflect committed resources',q.shadowSize===actual.shadow&&q.waveResolution===actual.wave&&actual.shadow===2048&&actual.wave===256,{effective:q,actual});
    return{date:new Date().toISOString(),passed:checks.every(c=>c.passed),passedCount:checks.filter(c=>c.passed).length,total:checks.length,checks,limits:['Programmatic DOM input/change events with real production handlers; native pointer/keyboard acceptance is reported separately','Uniform propagation and source linearity check, not a calibrated photographic material measurement']};
  }finally{
    event('#night-exposure',saved.exposure,'change',true);event('#lamp-linked',false,'change',true);a.setLocalLights(saved.lights);await a.setQuality(saved.quality);await a.setTime({utcMs:saved.clock.utcMs,...saved.clock.observer,rate:saved.clock.rate,running:saved.clock.running,mode:saved.clock.mode});if(saved.clock.mode==='artistic')a.setSun(saved.sun);a.pause(true);
  }
}
