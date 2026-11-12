import fs from 'node:fs';
import assert from 'node:assert/strict';
const dir=new URL('./',import.meta.url), read=name=>JSON.parse(fs.readFileSync(new URL(name,dir),'utf8'));
const before=read('r25-user-state-before.json'),after=read('r25-user-state-restored.json'),checks=[];
function same(name,a,b){try{assert.deepEqual(b,a);checks.push({name,passed:true,exact:true});}catch(error){checks.push({name,passed:false,exact:false,error:error.message});}}
for(const key of ['sun','qualityPreset','quality','paused','sound','wind','current','lens','weather','air','graphics','sea','director','qualityCustom']){
  if(key==='graphics'&&before.state.parameters.graphics.systemCalibration&&after.state.parameters.graphics.systemCalibration){
    const a=structuredClone(before.state.parameters.graphics),b=structuredClone(after.state.parameters.graphics),derived={before:a.peakNits,after:b.peakNits};
    delete a.peakNits;delete b.peakNits;same('parameters.graphics (automatic calibration intent)',a,b);
    const check=checks.at(-1);check.exact=derived.before===derived.after;check.derivedPeakNits=derived;
    check.note='System calibration stays automatic; the current read-only display report may change the derived peak. No OS/display setting was modified.';
  }else same('parameters.'+key,before.state.parameters[key],after.state.parameters[key]);
}
for(const key of ['camera','target'])same(key,before.state[key],after.state[key]);
for(const key of ['mode','utcMs','running','rate','observer'])same('celestial.'+key,before.celestial[key],after.celestial[key]);
for(const key of ['mode','linked','lamps','flashlight'])same('localLights.'+key,before.localLights[key],after.localLights[key]);
same('fireworks.settings',before.fireworks.settings,after.fireworks.settings);
const uiKeys=['panelOpen','viewsOpen','activeCategory','hidden','statsVisible'];
same('interface.selectedCategoryPanelViews',Object.fromEntries(uiKeys.map(k=>[k,before.interface[k]])),Object.fromEntries(uiKeys.map(k=>[k,after.interface[k]])));
const packets=after.smoke.state.packetCount;
const healthy=after.fireworks.active===0&&after.fireworks.queued===0&&packets===0&&!after.state.graphicsContextInterrupted&&after.gl.errors.length===0;
checks.push({name:'noTransientActiveAndGLFault',passed:healthy,exact:true,evidence:{active:after.fireworks.active,queued:after.fireworks.queued,packets,gl:after.gl.errors}});
const report={schema:'glass-atoll.r25-user-restoration.v1',passed:checks.every(c=>c.passed),counts:{passed:checks.filter(c=>c.passed).length,total:checks.length,exact:checks.filter(c=>c.passed&&c.exact).length},checks,limits:['Normal reload cleared the QA fireworks and smoke; physical simulation/cloud/wave time is not replayed to the old transient instant.','Automatic peakNits is derived from the current system report, not a fixed user override.']};
fs.writeFileSync(new URL('r25-user-restoration-check.json',dir),JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({passed:report.passed,counts:report.counts,failed:checks.filter(c=>!c.passed),derived:checks.find(c=>c.derivedPeakNits)?.derivedPeakNits},null,2));
if(!report.passed)process.exitCode=1;
