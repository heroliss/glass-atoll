import fs from 'node:fs';import crypto from 'node:crypto';import assert from 'node:assert/strict';
const root=new URL('../',import.meta.url),read=p=>fs.readFileSync(new URL(p,root),'utf8'),sha=s=>crypto.createHash('sha256').update(s).digest('hex');
const before=read('main.js'),uiBefore=read('ui.js'),candidate=read('verification/r33-hdr-screen-selection-candidate.js');
assert.equal(sha(before),'920e5045c0eaf5cc0c4113fcb3f331c8a3d755bb7f45a4d91f39ab08562d2ad9');assert.equal(sha(candidate),'05c952b43fa43c2687de2c53f47ea1f0534a16755aa24144c7b10cf0aa816dae');
const archive=new URL('verification/baselines/r33-before-hdr/',root);fs.mkdirSync(archive,{recursive:false});for(const[p,s]of[['main.js',before],['ui.js',uiBefore]])fs.writeFileSync(new URL(p,archive),s,{flag:'wx'});
const module=candidate.replace('// Verification-only, synchronous/read-only policy around the incumbent resolver.','// Conservative synchronous/read-only policy for matching the current browser screen.').replace("from '../hdr-output.js'","from './hdr-output.js'");assert.equal(module.replace('// Conservative synchronous/read-only policy for matching the current browser screen.','// Verification-only, synchronous/read-only policy around the incumbent resolver.').replace("from './hdr-output.js'","from '../hdr-output.js'"),candidate);fs.writeFileSync(new URL('hdr-screen-selection.js',root),module,{flag:'wx'});
let after=before;const once=(from,to)=>{assert.equal(after.split(from).length,2,from.slice(0,100));after=after.replace(from,to);};
once("import { createHDROutput,fetchDisplayHDR,resolveHDRCalibration } from './hdr-output.js';","import { createHDROutput,fetchDisplayHDR } from './hdr-output.js';\nimport {resolveObservedHDRCalibration} from './hdr-screen-selection.js';");
once('let cloudShadowCache,indirectLighting,shadowQuality,hdrOutput,displayTransform,displayReport=null,hdrCalibration=null,lastDisplaySignature=null,refreshingDisplay=null;','let cloudShadowCache,indirectLighting,shadowQuality,hdrOutput,displayTransform,displayReport=null,hdrCalibration=null,lastDisplaySignature=null,refreshingDisplay=null;\nlet displaySettingsApplying=false,displaySettingsPending=false,displayRefreshPending=false,lastDisplayObservationKey=null;');
once("  setInterval(()=>{if(!document.hidden&&parameters.graphics.hdrMode==='auto'&&parameters.graphics.displayName==='auto')refreshDisplay();},30000);","  setInterval(()=>{if(!document.hidden&&parameters.graphics.hdrMode==='auto'&&parameters.graphics.displayName==='auto')refreshDisplay();},30000);\n  // A window can move to another screen without resizing. This CPU-only check\n  // reuses the native report; unchanged geometry performs no display/GPU work.\n  setInterval(pollDisplayObservation,1000);");
const start=after.indexOf('async function refreshDisplay(){'),end=after.indexOf('function beginCameraTransition(',start);assert(start>=0&&end>start);const oldFunctions=after.slice(start,end);
const functions=`function captureHDRScreenObservation(){
  try{
    const s=window.screen;
    return{screen:{width:s.width,height:s.height,availLeft:s.availLeft,availTop:s.availTop,left:s.left,top:s.top,availWidth:s.availWidth,availHeight:s.availHeight},window:{screenX:window.screenX,screenY:window.screenY,outerWidth:window.outerWidth,outerHeight:window.outerHeight,devicePixelRatio:window.devicePixelRatio,visualViewportScale:window.visualViewport?.scale}};
  }catch{return null;}
}
function displaySettingsBlocked(){return qaRenderLock||qaFrozenWorkload||qualityApplying||!!renderBenchmark?.active;}
function displayRequestKey(observation){const g=parameters.graphics;return JSON.stringify([g.hdrMode,g.displayName,g.systemCalibration,g.displayTransform,...(g.systemCalibration?[]:[g.peakNits,g.paperWhiteNits]),observation]);}
function pollDisplayObservation(){
  if(document.hidden||parameters.graphics.hdrMode!=='auto'||parameters.graphics.displayName!=='auto')return;
  const key=JSON.stringify(captureHDRScreenObservation());
  if(key!==lastDisplayObservationKey)displaySettingsPending=true;
  if(displaySettingsPending&&!displaySettingsBlocked()&&!displaySettingsApplying)void applyDisplaySettings().catch(error=>console.warn('Display selection:',error.message));
}
async function refreshDisplay(){
  if(displaySettingsBlocked()){displayRefreshPending=true;return null;}
  if(refreshingDisplay)return refreshingDisplay;
  displayRefreshPending=false;
  refreshingDisplay=(async()=>{displayReport=await fetchDisplayHDR();return applyDisplaySettings();})().catch(error=>{console.warn('Display refresh:',error.message);return null;}).finally(()=>{refreshingDisplay=null;});return refreshingDisplay;
}
async function applyDisplaySettings(){
  if(!hdrOutput)return;
  if(displaySettingsBlocked()||displaySettingsApplying){displaySettingsPending=true;return hdrCalibration;}
  displaySettingsApplying=true;displaySettingsPending=false;
  const report=displayReport,observation=captureHDRScreenObservation(),request=displayRequestKey(observation),g=parameters.graphics;
  const current=()=>!displaySettingsBlocked()&&displayReport===report&&displayRequestKey(captureHDRScreenObservation())===request;
  try{
    const calibration=resolveObservedHDRCalibration(report,{deviceName:g.displayName==='auto'?undefined:g.displayName,...(g.systemCalibration?{}:{peakNits:g.peakNits,paperWhiteNits:g.paperWhiteNits})},observation);
    if(calibration.confidence==='screen-geometry')calibration.reason='已匹配当前浏览器所在屏幕';
    if(!calibration.display)calibration.reason='当前屏幕无法可靠匹配，请手动选择显示器或输入校准值';
    const nativeAllows=!calibration.display||calibration.display.advancedColorEnabled,verified=calibration.calibrationSource!=='unverified-fallback';
    const enable=g.hdrMode==='hdr'||g.hdrMode==='auto'&&hdrOutput.state.available&&nativeAllows&&verified;
    const signature=JSON.stringify([g.hdrMode,g.displayName,g.systemCalibration,calibration.display?.deviceName,calibration.confidence,calibration.observationSelection.reason,calibration.peakNits,calibration.paperWhiteNits,calibration.sdrWhiteNits,calibration.calibrationSource,nativeAllows,enable]);
    const changed=signature!==lastDisplaySignature||hdrOutput.state.enabled!==enable;
    if(changed){hdrOutput.configure({paperWhiteNits:calibration.paperWhiteNits,peakNits:calibration.peakNits,sdrWhiteNits:calibration.sdrWhiteNits,calibrationSource:calibration.calibrationSource,displayName:calibration.displayName});await hdrOutput.setEnabled(enable);}
    if(!current()){displaySettingsPending=true;return null;}
    await displayTransform?.configure({mode:g.displayTransform,peakNits:calibration.peakNits});
    if(!current()){displaySettingsPending=true;return null;}
    hdrCalibration=calibration;lastDisplaySignature=signature;lastDisplayObservationKey=JSON.stringify(observation);
    if(g.systemCalibration){g.peakNits=calibration.peakNits;g.paperWhiteNits=calibration.paperWhiteNits;}
    g.hdr=hdrOutput.state.enabled;ui.setDisplays(report,calibration);ui.setHDRSupport(hdrOutput.state);
    if(changed)lastPausedRenderKey=null;return calibration;
  }finally{displaySettingsApplying=false;}
}
`;
after=after.slice(0,start)+functions+after.slice(end);
once('  if(document.hidden||qaRenderLock||graphicsContextInterrupted){frameRateMeter.reset(frameStart);return;}','  if(document.hidden||qaRenderLock||graphicsContextInterrupted){frameRateMeter.reset(frameStart);return;}\n  if(!displaySettingsBlocked()&&!displaySettingsApplying){\n    if(displayRefreshPending)void refreshDisplay();\n    else if(displaySettingsPending)void applyDisplaySettings().catch(error=>console.warn(\'Display selection:\',error.message));\n  }\n  if(displaySettingsApplying){frameRateMeter.reset(frameStart);return;}');
let uiAfter=uiBefore;const changeUI=(from,to)=>{assert.equal(uiAfter.split(from).length,2);uiAfter=uiAfter.replace(from,to);};
changeUI("new Option('自动识别（前台窗口/屏幕）','auto')","new Option('自动识别当前屏幕','auto')");
changeUI("$('#hdr-calibration').textContent=\u0060系统报告：峰值 \u0024{peak}，SDR 白 \u0024{white}。\u0024{selection.reason||''}；可手动选屏或输入校准值。\u0060;","$('#hdr-calibration').textContent=\u0060系统报告（\u0024{d.deviceName.split('\\\\').at(-1)}）：峰值 \u0024{peak}，SDR 白 \u0024{white}。\u0024{selection.reason||''}；可手动选屏或输入校准值。\u0060;");
changeUI("else $('#hdr-calibration').textContent='未取得系统亮度；可手动填写峰值与参考白。不会把示例值当成探测结果。';","else $('#hdr-calibration').textContent='当前屏幕无法可靠匹配；可明确选择显示器，或手动填写峰值与参考白。';");
fs.writeFileSync(new URL('main.js',root),after);fs.writeFileSync(new URL('ui.js',root),uiAfter);
fs.writeFileSync(new URL('verification/r33-hdr-integration.json',root),JSON.stringify({schema:'glass-atoll.r33-current-screen-hdr-integration.v1',passed:true,actualGPU:false,before:{main:sha(before),ui:sha(uiBefore)},after:{main:sha(after),ui:sha(uiAfter),module:sha(module)},pureCandidateExactExceptHeaderAndImport:true,previousDisplayFunctions:oldFunctions,scope:'Current-screen policy, direct trusted observation, coalesced/deferred refresh and stale async checks; display-only labels. No water, physics, audio or OS setting change.',limitations:['Automatic multi-display geometry currently admits only validated unit-scale contained windows; other cases need explicit screen/manual calibration.','Runtime/current-screen validation and asynchronous wiring tests remain separate next checks.']},null,2)+'\n');
console.log(JSON.stringify({passed:true,main:sha(after),ui:sha(uiAfter),module:sha(module)}));
