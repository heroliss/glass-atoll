import {strict as assert} from 'node:assert';
import {readFileSync,writeFileSync} from 'node:fs';
const source=readFileSync(new URL('../ui.js',import.meta.url),'utf8'),checks=[];
const formatterStart=source.indexOf('function formatDisplayTransformStatus('),formatterEnd=source.indexOf('export function initUI(',formatterStart);
assert(formatterStart>=0&&formatterEnd>formatterStart);
const formatDisplayTransformStatus=new Function(source.slice(formatterStart,formatterEnd)+';return formatDisplayTransformStatus;')();
function check(name,fn){try{fn();checks.push({name,passed:true});}catch(error){checks.push({name,passed:false,error:String(error.stack)});}}

// Execute the actual handler registration and actual syncLamps method source,
// with tiny dependency seams. No mirror of their event/merge logic is tested.
const nightHandler=source.split('\n').find(line=>line.includes("$('#night-exposure').addEventListener('change'"));
assert(nightHandler,'Actual night exposure event registration not found');
const lampStart=source.indexOf('syncLamps(info={}){'),lampEnd=source.indexOf('    syncFlashlight(',lampStart);
assert(lampStart>=0&&lampEnd>lampStart,'Actual lamp sync method not found');
const lampMethod=source.slice(lampStart,lampEnd).trim().replace(/,$/,'');
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));

check('actual exposure callback sends only photographic preference, never old civil date',()=>{
  let handler=null;const calls=[],state={night:{date:'2026-08-13T22:00:00',autoExposure:true},time:{mode:'artistic',utcMs:12345}};
  new Function('$','state','invoke',nightHandler)(selector=>{assert.equal(selector,'#night-exposure');return{addEventListener(name,fn){assert.equal(name,'change');handler=fn;}};},state,(name,value)=>calls.push({name,value}));
  handler({target:{checked:false}});handler({target:{checked:true}});
  assert.deepEqual(calls,[{name:'onNightChange',value:{autoExposure:false}},{name:'onNightChange',value:{autoExposure:true}}]);
  assert.equal(state.night.date,'2026-08-13T22:00:00');assert.equal(state.time.mode,'artistic');assert.equal(state.time.utcMs,12345);
});
check('actual full lamp snapshots preserve linked editing across repeated slider-style updates',()=>{
  const state={lamps:{linked:true,selected:1,mode:'night',lamps:Array.from({length:3},()=>({enabled:true,brightness:.4,color:'#ffdfa5'}))}};let updates=0;
  const sync=new Function('state','clamp','updateLampUI',`return({${lampMethod}}).syncLamps;`)(state,clamp,()=>updates++);
  for(const value of [.41,.42,.5,.8])sync({mode:'night',linked:false,lamps:[0,1,2].map(()=>({enabled:true,brightness:value,color:'#aabbcc'}))});
  assert.equal(state.lamps.linked,true);assert.equal(state.lamps.selected,1);assert.equal(updates,4);assert(state.lamps.lamps.every(lamp=>lamp.brightness===.8&&lamp.color==='#aabbcc'));
});
check('explicit editor-only unlink patch and legacy array sync remain supported',()=>{
  const state={lamps:{linked:true,selected:0,mode:'night',lamps:Array.from({length:3},()=>({enabled:true,brightness:.4,color:'#ffdfa5'}))}};
  const sync=new Function('state','clamp','updateLampUI',`return({${lampMethod}}).syncLamps;`)(state,clamp,()=>{});
  sync([{enabled:false,brightness:.2,color:'#ffffff'}]);assert.equal(state.lamps.linked,true);assert.equal(state.lamps.lamps[0].enabled,false);
  sync({linked:false});assert.equal(state.lamps.linked,false);
});
const hdrStart=source.indexOf('setHDRSupport(info){'),hdrEnd=source.indexOf('    setStats(',hdrStart);
assert(hdrStart>=0&&hdrEnd>hdrStart);const hdrMethod=source.slice(hdrStart,hdrEnd).trim().replace(/,$/,'');
check('actual HDR status distinguishes automatic fallback reasons from user-selected SDR',()=>{
  const state={graphics:{hdrMode:'auto'}},status={textContent:''};
  const sync=new Function('state','$','displayStatus','formatDisplayTransformStatus',`return({${hdrMethod}}).setHDRSupport;`)(state,selector=>{assert.equal(selector,'#hdr-status');return status;},{textContent:''},formatDisplayTransformStatus);
  sync({enabled:false,available:true,apiAvailable:true,displayHDR:true,calibrationSource:'unverified-fallback'});assert(status.textContent.includes('缺少完整系统亮度数据'));assert(status.textContent.includes('自动使用 SDR'));assert(!status.textContent.includes('已选择'));
  sync({enabled:false,apiAvailable:true,displayHDR:false});assert(status.textContent.includes('显示环境未报告 HDR'));
  sync({enabled:false,apiAvailable:false,displayHDR:true});assert(status.textContent.includes('浏览器尚不支持'));
  state.graphics.hdrMode='sdr';sync({enabled:false,available:true});assert.equal(status.textContent,'已选择 SDR');
});
check('actual requested-HDR failure keeps error and never claims user selected SDR',()=>{
  const state={graphics:{hdrMode:'hdr'}},status={textContent:''};const sync=new Function('state','$','displayStatus','formatDisplayTransformStatus',`return({${hdrMethod}}).setHDRSupport;`)(state,()=>status,{textContent:''},formatDisplayTransformStatus);
  sync({enabled:false,available:true,errors:['GPU 初始化失败']});assert(status.textContent.includes('HDR 未能开启'));assert(status.textContent.includes('GPU 初始化失败'));assert(!status.textContent.includes('已选择 SDR'));
  sync({enabled:true,calibrationSource:'windows-dxgi'});assert.equal(state.graphics.hdr,true);assert.equal(status.textContent,'HDR 已开启 · 按亮度参数映射');
});
const report={date:new Date().toISOString(),passed:checks.every(c=>c.passed),count:checks.length,checks,limits:['Actual extracted UI handler/method logic with tiny dependencies; not a DOM layout or browser interaction acceptance test.']};
writeFileSync(new URL('r15-ui-isolation-regression.json',import.meta.url),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report,null,2));if(!report.passed)process.exitCode=1;
