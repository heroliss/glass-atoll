import fs from 'node:fs';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
const dir=new URL('./',import.meta.url),read=name=>JSON.parse(fs.readFileSync(new URL(name,dir),'utf8'));
const before=read('r32-user-state-before.json'),after=read('r32-user-state-after.json'),checks=[];
function same(name,a,b){try{assert.deepEqual(b,a);checks.push({name,passed:true,exact:true});}catch(error){checks.push({name,passed:false,exact:false,error:error.message});}}
for(const key of ['sun','qualityPreset','quality','paused','sound','wind','current','lens','weather','air','graphics','sea','director','qualityCustom','renderSampling']){
 if(key==='graphics'&&before.state.parameters.graphics.systemCalibration&&after.state.parameters.graphics.systemCalibration){
  const a=structuredClone(before.state.parameters.graphics),b=structuredClone(after.state.parameters.graphics),derived={before:a.peakNits,after:b.peakNits};
  delete a.peakNits;delete b.peakNits;same('parameters.graphics (automatic calibration intent)',a,b);
  Object.assign(checks.at(-1),{exact:derived.before===derived.after,derivedPeakNits:derived,note:'Automatic read-only display calibration remains enabled; no OS/display setting was changed.'});
 }else same('parameters.'+key,before.state.parameters[key],after.state.parameters[key]);
}
for(const key of ['camera','target'])same(key,before.state[key],after.state[key]);
for(const key of ['mode','utcMs','running','rate','observer'])same('celestial.'+key,before.celestial[key],after.celestial[key]);
for(const key of ['mode','linked','lamps','flashlight'])same('localLights.'+key,before.localLights[key],after.localLights[key]);
same('fireworks.settings',before.fireworks.settings,after.fireworks.settings);
const uiKeys=['panelOpen','viewsOpen','activeCategory','hidden','statsVisible'];
same('interface.selectedCategoryPanelViews',Object.fromEntries(uiKeys.map(k=>[k,before.interface[k]])),Object.fromEntries(uiKeys.map(k=>[k,after.interface[k]])));
checks.push({name:'noTransientActiveAndGLFault',exact:true,passed:after.fireworks.active===0&&after.fireworks.queued===0&&after.smoke.state.packetCount===0&&!after.state.graphicsContextInterrupted&&after.gl.errors.length===0&&after.gl.programLive&&after.gl.vertexArrayLive&&after.bodyInert===false,evidence:{active:after.fireworks.active,queued:after.fireworks.queued,packets:after.smoke.state.packetCount,gl:after.gl,bodyInert:after.bodyInert}});
const warnings=read('r32-console-after.json');
const expectedPins={
  '../water.js':'d7d5b76dadf35e2e507b640b8975fb3819821b29d113ceeebf195080fd88b045',
  '../main.js':'920e5045c0eaf5cc0c4113fcb3f331c8a3d755bb7f45a4d91f39ab08562d2ad9',
  '../fireworks-audio.js':'4e5ede41813249f062e50b212553e5e1821c27feaead8416b68ab51ba1b8ec31'
};
const integrityEntries=Object.entries(expectedPins).map(([path,expected])=>{const actual=crypto.createHash('sha256').update(fs.readFileSync(new URL(path,dir))).digest('hex');return{path,expected,actual,passed:actual===expected};});
const integrity={passed:integrityEntries.every(x=>x.passed),entries:integrityEntries,scope:'Production water remains unpromoted, main changes are QA only, approved audio preserved.'};
const report={schema:'glass-atoll.r32-user-restoration.v1',passed:checks.every(c=>c.passed)&&integrity.passed,integrity,counts:{passed:checks.filter(c=>c.passed).length,total:checks.length,exact:checks.filter(c=>c.passed&&c.exact).length},checks,console:{errors:warnings.filter(x=>x.level==='error').length,warnings:warnings.filter(x=>x.level==='warn').length,source:'r32-console-after.json',scope:'Saved R32 console snapshot; no claim about earlier retained receipts.'},limits:['Normal reload and successful semantic restoration preserve user settings, not the original instantaneous ocean/cloud/physical clock or bitwise histories.','Automatic peakNits derives from the current display report; it is not a fixed manual user override.']};
fs.writeFileSync(new URL('r32-user-restoration-check.json',dir),JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({passed:report.passed,counts:report.counts,failed:checks.filter(c=>!c.passed),derived:checks.find(c=>c.derivedPeakNits)?.derivedPeakNits,console:report.console,integrity:report.integrity},null,2));
if(!report.passed)process.exitCode=1;
