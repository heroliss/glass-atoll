// Executes the actual UI formatter/updated methods with small DOM seams;
// no parallel formatter, controller, GPU or browser-layout implementation.
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync} from 'node:fs';
import crypto from 'node:crypto';
const source=readFileSync(new URL('../ui.js',import.meta.url),'utf8'),checks=[];
const start=source.indexOf('function formatDisplayTransformStatus('),end=source.indexOf('export function initUI(',start);
assert(start>=0&&end>start);const format=new Function(source.slice(start,end)+';return formatDisplayTransformStatus;')();
function check(name,fn){try{const evidence=fn();checks.push({name,passed:true,evidence});}catch(error){checks.push({name,passed:false,error:String(error.stack||error)});}}
const snapshot={requested:'aces2',preparation:{status:'ready',reason:'exact-target-ready',peakNits:700},
  sdr:{effective:'aces2',peakNits:100,reason:'exact-target-rendered'},hdr:{effective:'aces2',peakNits:700,reason:'exact-target-rendered'}};
check('ready surface labels are explicitly lastframe with precise independent targets',()=>{
  const text=format(snapshot,'aces2',true);assert(text.includes('SDR 最近一帧：ACES 2 · 精确目标 100 nit'));assert(text.includes('HDR 最近一帧：ACES 2 · 精确目标 700 nit'));
  assert(text.includes('已绘制确认'));assert(text.includes('不是官方认证'));assert(!text.includes('exact-target-rendered'));return{targets:[100,700]};
});
check('closedHDR cannot mistake a previousACES2 frame for currently enabledHDR',()=>{
  const text=format(snapshot,'aces2',false);assert(text.includes('HDR：当前关闭；最近一帧：ACES 2 · 精确目标 700 nit'));assert(!text.includes('HDR 已开启'));
});
check('HDR target preparation never implies the independentSDR100 result is unsupported',()=>{
  const cases=[['unsupported','unsupported-target','HDR 目标暂不支持'],['pending','preparing-exact-target','HDR 目标资源准备中'],['failed','preparation-failed','HDR 目标准备失败']];
  for(const [status,reason,label]of cases){
    const text=format({...snapshot,preparation:{status,reason,peakNits:1200},hdr:{effective:'legacy',peakNits:1200,reason}},'aces2',false);
    assert(text.includes(label+'（目标 1200 nit）'));assert(text.includes('SDR 最近一帧：ACES 2 · 精确目标 100 nit（已绘制确认）'));
    assert(text.includes('HDR：当前关闭；最近一帧：原有色彩呈现'));assert(!text.includes('当前不支持（目标 1200 nit）'));
  }
  return{HDRPreparationBranches:cases.map(c=>c[0]),SDRTargetNits:100,selectedHDRTargetNits:1200};
});
check('none and stale snapshots always wait for actual drawing confirmation',()=>{
  const fresh={requested:'aces2',preparation:{status:'pending',reason:'preparing-exact-target',peakNits:1270},sdr:{effective:'none',reason:'awaiting-render'},hdr:{effective:'none',reason:'not-presented'}};
  const text=format(fresh,'aces2',true);assert(text.includes('尚未确认新目标生效'));assert(text.includes('SDR 最近一帧：等待绘制确认'));assert(text.includes('HDR 最近一帧：等待绘制确认'));assert(!text.includes('未启用'));assert(!text.includes('精确目标 1270'));
  assert(!format(snapshot,'legacy',true).includes('精确目标'));assert(format(null,'legacy',false).includes('等待绘制确认'));
});
check('fixed known internal reason codes are Chinese without leaking identifiers',()=>{
  const codes=['awaiting-render','not-presented','selected-legacy','preparing-exact-target','exact-target-ready','exact-target-rendered','unsupported-target','validation-failed','sdr-target-validation-failed','preparation-failed','output-render-failed','calibration-target-changed','browser-white-unavailable','pbo-legacy-only','bridge-fallback','sdr-target-initialization-failed','render-declined','non-boolean-render-result','adapter-error','disabled','hdr-disabled','disposed','stale-request','loading','ready','rendered','not-requested'];
  for(const reason of codes){const text=format({requested:'aces2',sdr:{effective:'legacy',reason}},'aces2',true);assert(!text.includes(reason),reason);assert(!text.includes('详见诊断'),reason);}
  return{mappedCodes:codes.length};
});
check('unknown technical strings and error details use bounded diagnostic wording',()=>{
  const secret='UNRECOGNIZED_'+('long-stack-at-shader-line-177/'.repeat(30));
  const text=format({requested:'aces2',preparation:{status:'failed',reason:'validation-failed',error:secret},hdr:{effective:'legacy',reason:secret,error:secret},lastError:secret},'aces2',true);
  assert(text.includes('校验失败，已回退'));assert(text.includes('详见诊断'));assert(!text.includes(secret));assert(text.length<260);
  for(const reason of ['constructor','__proto__','<script>alert(1)</script>'])assert(format({requested:'aces2',hdr:{effective:'legacy',reason}},'aces2',true).includes('详见诊断'));
  return{technicalDetailNotRendered:true};
});
check('realHDR support sync immediately updates closed and reopened colourstatus',()=>{
  const a=source.indexOf('    setHDRSupport(info){'),b=source.indexOf('    setStats(',a),state={graphics:{hdrMode:'auto',displayTransform:'aces2'},displayTransformState:structuredClone(snapshot)},status={textContent:''},displayStatus={textContent:''};
  const sync=new Function('state','$','displayStatus','formatDisplayTransformStatus',`return({${source.slice(a,b)}}).setHDRSupport;`)(state,()=>status,displayStatus,format);
  sync({enabled:false,apiAvailable:true,displayHDR:false});assert.equal(state.graphics.hdr,false);assert(displayStatus.textContent.includes('HDR：当前关闭；最近一帧'));
  sync({enabled:true,calibrationSource:'windows-dxgi'});assert.equal(state.graphics.hdr,true);assert(displayStatus.textContent.includes('HDR 最近一帧'));assert(!displayStatus.textContent.includes('当前关闭'));
});
check('paperwhite request-disable and manualpeak policy remain unchanged',()=>{
  const a=source.indexOf('  function updateGraphicsUI(){'),b=source.indexOf("  for(const [id,key]of [['swell-height'",a),nodes=new Map(),$=id=>{if(!nodes.has(id))nodes.set(id,{});return nodes.get(id);};
  const state={graphics:{displayTransform:'aces2',systemCalibration:false,hdr:false},displayTransformState:snapshot},whiteNote={hidden:true},displayStatus={textContent:''};
  const update=new Function('$','state','whiteNote','displayStatus','formatDisplayTransformStatus',source.slice(a,b)+';return updateGraphicsUI;')($,state,whiteNote,displayStatus,format);
  update();assert.equal($('#hdr-white').disabled,true);assert.equal($('#hdr-peak').disabled,false);assert.equal(whiteNote.hidden,false);
  state.graphics.displayTransform='legacy';update();assert.equal($('#hdr-white').disabled,false);assert.equal(whiteNote.hidden,true);
  state.graphics.systemCalibration=true;update();assert.equal($('#hdr-white').disabled,true);assert.equal($('#hdr-peak').disabled,true);
  assert(source.includes('ACES 2 生效时自带中调映射，不使用纸白增益；回退状态见下。'));
});
check('formatter is pure and makes no exposure or controller calls',()=>{
  const before=JSON.stringify(snapshot);format(snapshot,'aces2',true);assert.equal(JSON.stringify(snapshot),before);
  const code=source.slice(start,end);for(const forbidden of ['invoke(','callbacks.','renderer.','onGraphicsChange','innerHTML'])assert(!code.includes(forbidden));
});
const report={schema:'glass-atoll.display-transform-UI-formatter-CPU.v1',dateUTC:new Date().toISOString(),passed:checks.every(c=>c.passed),counts:{passed:checks.filter(c=>c.passed).length,total:checks.length},checks,
  uiSHA256:crypto.createHash('sha256').update(source).digest('hex'),actualGPU:false,actualNativeUI:false,
  limits:['Actual extracted UI logic with small DOM seams only; native layout and interaction are owned by root acceptance.','No controller, renderer, calibration, paperwhite gain or output pixels altered by formatter.']};
writeFileSync(new URL('./ui-display-transform-check.json',import.meta.url),JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({passed:report.passed,counts:report.counts,uiSHA256:report.uiSHA256,failed:checks.filter(c=>!c.passed)},null,2));if(!report.passed)process.exitCode=1;
