// QA only. Caller supplies an already PAUSED actual production event/view.
// No launch, physical-time change, clearSmoke, camera change or forcedP.
const raf=()=>new Promise(resolve=>requestAnimationFrame(resolve));
const clone=x=>structuredClone(x),same=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
async function pixels(url){const i=new Image();i.src=url;await i.decode();const c=document.createElement('canvas');c.width=i.width;c.height=i.height;const ctx=c.getContext('2d',{colorSpace:'srgb',willReadFrequently:true});if(!ctx)throw new Error('2D PNG decoder unavailable');ctx.drawImage(i,0,0);return{width:c.width,height:c.height,data:ctx.getImageData(0,0,c.width,c.height).data};}
async function difference(a,b){const x=await pixels(a),y=await pixels(b);if(x.width!==y.width||x.height!==y.height)throw new Error('Snapshot dimensions changed');let changed=0,squared=0,maximum=0,positive=0,negative=0;for(let i=0;i<x.data.length;i+=4){let d=0;for(let c=0;c<3;c++){const q=y.data[i+c]-x.data[i+c];d=Math.max(d,Math.abs(q));squared+=q*q;positive+=Math.max(0,q);negative+=Math.max(0,-q);}changed+=Number(d>0);maximum=Math.max(maximum,d);}return{width:x.width,height:x.height,changedPixels:changed,maximumByteDifference:maximum,rmsByteDifference:Math.sqrt(squared/(x.width*x.height*3)),positiveByteSum:positive,negativeByteSum:negative};}
function probes(a){const p=clone(a.indirectProbeState());return{...p,bits:Object.fromEntries(['red','green','blue'].map(k=>[k,Array.from(new Uint32Array(Float32Array.from(p[k]).buffer))]))};}
function probeDiff(a,b){const rows=[];let different=0,maximum=0;for(const c of ['red','green','blue'])for(let i=0;i<a[c].length;i++)if(a.bits[c][i]!==b.bits[c][i]){different++;const d=Math.abs(a[c][i]-b[c][i]);maximum=Math.max(maximum,d);if(rows.length<16)rows.push({channel:c,index:i,before:a[c][i],after:b[c][i],beforeBits:a.bits[c][i],afterBits:b.bits[c][i]});}return{bitIdentical:different===0,differentCoefficients:different,maximumAbsoluteDifference:maximum,samePScale:a.exposure===b.exposure,exposureBefore:a.exposure,exposureAfter:b.exposure,firstDifferences:rows};}
const history=a=>{const l=clone(a.state.lens);return{storageEV:l.storageEV,historyEV:l.historyEV,dynamicLighting:l.dynamicLighting,temporal:l.temporal};};
const direct=a=>a.localLights().lights.map(l=>({id:l.id,position:l.position,direction:l.direction,candela:l.candela,rawRGB:l.rawRGB,radius:l.radius}));
const finite=r=>['opaque','composed','reflection'].every(k=>r[k].countNaN===0&&r[k].countInf===0&&r[k].countNegative===0&&r[k].stateRestored&&r[k].counterConsistency);

export async function runGIHistoryRebuildCheck(a){
  const start=clone(a.state),clock=clone(a.celestial()),saved={lens:clone(start.parameters.lens),GI:a.graphics().indirect.transient.requestedEnabled};
  const report={schema:'glass-atoll.gi-history-rebuild-actual.v1',date:new Date().toISOString(),checks:[],cases:[],images:{},comparisons:{},runtimeErrors:[],restoration:{completed:false},
    controls:{time:start.time,camera:start.camera,target:start.target,UTC:clock.utcMs,initialP:a.photometry().storageEV,initialC:a.photometry().cameraEV,originalAA:{temporal:saved.lens.temporal,glintAA:saved.lens.glintAA},sourceSettings:clone(a.fireworks().settings),sequence:['savedAA off','savedAA off API reset','savedAA on','savedAA off return','disable temporal/glintAA','noTemporal off','noTemporal on','noTemporal off return']}};
  const check=(name,passed,evidence={})=>report.checks.push({name,passed:!!passed,evidence});
  const onError=e=>report.runtimeErrors.push({kind:'error',message:e.message,stack:String(e.error?.stack||'')});
  const onRejection=e=>report.runtimeErrors.push({kind:'unhandledrejection',message:String(e.reason?.message??e.reason)});
  window.addEventListener('error',onError);window.addEventListener('unhandledrejection',onRejection);
  let initialSmoke=null,initialClusters=null,initialSources=null,initialWeather=null;
  async function settle(){for(let i=0;i<45;i++)await raf();let extra=0;while(Math.abs(a.photometry().storageEV-a.photometry().targetEV)>1e-10&&extra++<420)await raf();if(Math.abs(a.photometry().storageEV-a.photometry().targetEV)>1e-10)throw new Error('Natural storage budget did not settle;P was not overridden');return{minimumRAFs:45,extra};}
  async function capture(id,enabled){
    const beforeAPI={probe:probes(a),history:history(a),photometry:clone(a.photometry())},immediate=clone(a.setTransientIndirect(enabled)),immediateProbe=probes(a),immediateHistory=history(a),settling=await settle();
    const state=clone(a.state),p=clone(a.photometry()),probe=probes(a),historyBefore=history(a),image=a.screenshot(),historyAfterImage=history(a),probeAfterImage=probes(a),range=await a.inspectRadiance(),after=clone(a.photometry());
    const row={id,enabled,settling,time:state.time,UTC:a.celestial().utcMs,camera:state.camera,target:state.target,photometry:p,afterPhotometry:after,probe,probeAfterImage,beforeAPI,immediate,immediateProbe,
      history:{immediate:immediateHistory,beforeScreenshot:historyBefore,afterScreenshot:historyAfterImage,afterRange:history(a)},ranges:range,AA:{temporal:state.parameters.lens.temporal,glintAA:state.parameters.lens.glintAA},GI:clone(a.graphics().indirect),
      smoke:clone(a.smokeSnapshot()),clusters:clone(a.fireworkClusters()),sources:direct(a),weather:clone(a.atmosphere().diagnostics.weather)};
    report.cases.push(row);report.images[id]=image;
    check(`${id}: same paused physical event,pose,UTC,C andP`,state.parameters.paused&&state.time===start.time&&row.UTC===clock.utcMs&&same(state.camera,start.camera)&&same(state.target,start.target)&&Math.abs(p.cameraEV-report.controls.initialC)<1e-8&&p.storageEV===report.controls.initialP&&range.storageEV===p.storageEV&&after.storageEV===p.storageEV,{time:state.time,P:p.storageEV,C:p.cameraEV,history:row.history});
    check(`${id}: density,raw direct sources and weather remain identical`,same(row.smoke,initialSmoke)&&same(row.clusters,initialClusters)&&same(row.sources,initialSources)&&same(row.weather,initialWeather));
    check(`${id}: requestedGI and actual HDR/headroom valid`,row.GI.transient.enabled===enabled&&row.GI.transient.requestedEnabled===enabled&&finite(range)&&p.storedBound<=p.safeMaximum*(1+1e-12)&&['opaque','composed','reflection'].every(k=>range[k].globalMax<65504),{storedBound:p.storedBound,safe:p.safeMaximum,maxima:Object.fromEntries(['opaque','composed','reflection'].map(k=>[k,range[k].globalMax]))});
    return row;
  }
  async function comparison(id,aRow,bRow,{strict=false}={}){
    const diff=await difference(report.images[aRow.id],report.images[bRow.id]),coefficients=probeDiff(aRow.probe,bRow.probe);report.comparisons[id]={from:aRow.id,to:bRow.id,image:diff,coefficients,
      rangeExtremaEqual:Object.fromEntries(['opaque','composed','reflection'].map(k=>[k,same({min:aRow.ranges[k].minRGB,max:aRow.ranges[k].maxRGB},{min:bRow.ranges[k].minRGB,max:bRow.ranges[k].maxRGB})]))};
    if(strict){check(`${id}: strict zero-pixel return`,diff.changedPixels===0,{difference:diff,noFloorSubtracted:true});check(`${id}:216 raw published Float32 coefficients andP return exactly`,coefficients.bitIdentical&&coefficients.samePScale,coefficients);}return diff;
  }
  try{
    for(const key of ['indirectProbeState','setTransientIndirect','inspectRadiance','screenshot'])if(typeof a[key]!=='function')throw new Error('Required loaded QA API missing:'+key);
    if(!start.parameters.paused)throw new Error('Prepare and pause the existing actual event first; this helper never advances physical time');
    if(a.graphics().indirect.quality==='off')throw new Error('Native GI must be low/high for a local-GI history comparison');
    initialSmoke=clone(a.smokeSnapshot());initialClusters=clone(a.fireworkClusters());initialSources=direct(a);initialWeather=clone(a.atmosphere().diagnostics.weather);
    const off=await capture('savedAA_off',false),offReset=await capture('savedAA_off_API_reset',false),on=await capture('savedAA_on',true),offReturn=await capture('savedAA_off_return',false);
    await comparison('savedAA_reset_floor',off,offReset,{strict:true});await comparison('savedAA_return',off,offReturn,{strict:true});const visible=await comparison('savedAA_signal',off,on);
    check('savedAA actualGI positive control is visible',visible.changedPixels>0&&visible.positiveByteSum>0,{difference:visible});
    a.setLens({temporal:false,glintAA:false});await settle();report.noTemporalState=clone(a.state.lens);
    const noOff=await capture('noTemporal_off',false),noOn=await capture('noTemporal_on',true),noReturn=await capture('noTemporal_off_return',false);
    check('second block actually disables both temporal paths',noOff.AA.temporal===false&&noOff.AA.glintAA===false&&!noOff.history.beforeScreenshot.temporal.enabled&&!noOff.history.beforeScreenshot.temporal.waterEnabled,{AA:noOff.AA,history:noOff.history});
    await comparison('noTemporal_return',noOff,noReturn,{strict:true});const noSignal=await comparison('noTemporal_signal',noOff,noOn);check('noTemporal actualGI positive control is visible',noSignal.changedPixels>0&&noSignal.positiveByteSum>0,{difference:noSignal});
    report.diagnostic={savedResetPixels:report.comparisons.savedAA_reset_floor.image.changedPixels,savedReturnPixels:report.comparisons.savedAA_return.image.changedPixels,noTemporalReturnPixels:report.comparisons.noTemporal_return.image.changedPixels,
      scope:'Interpretation aid only. A clean noTemporal return with stable coefficients is consistent with a history-path cause, but does not identify its exact pass. Nonzero noTemporal return refutes a solely temporal explanation. Original strict gates remain failed wherever pixels differ.'};
    check('no actual frame exceptions',report.runtimeErrors.length===0,{errors:report.runtimeErrors});
  }catch(e){report.failure={message:String(e.message??e),stack:String(e.stack??'')};check('history rebuild scenario completes without hidden fallback',false,report.failure);}
  finally{
    try{a.setLens(saved.lens);a.setTransientIndirect(saved.GI);report.restoration={completed:true,lens:clone(a.state.parameters.lens),GI:a.graphics().indirect.transient.requestedEnabled,time:a.state.time,paused:a.state.parameters.paused};
      check('originalAA/GI restored while the existing event remains paused',same(a.state.parameters.lens,saved.lens)&&a.graphics().indirect.transient.requestedEnabled===saved.GI&&a.state.parameters.paused&&a.state.time===start.time,report.restoration);
    }catch(e){report.restoration.error=String(e.stack??e);check('AA/GI restoration completes',false,{error:report.restoration.error});}
    window.removeEventListener('error',onError);window.removeEventListener('unhandledrejection',onRejection);
  }
  report.passed=report.checks.every(c=>c.passed)&&report.cases.length===7;report.passedCount=report.checks.filter(c=>c.passed).length;report.total=report.checks.length;
  report.limits=['No launch,wind,time,UTC,camera,source,mass or smoke-model edits. Caller supplies the same paused event and pose.','P is measured and checked identical, never overridden; a legitimate safety-budget change fails the fixedP scenario instead of being hidden.','The API-reset off→off deliberately repeats the exact history-reset side effect without changingGI.','Disabling temporal+glintAA changes only the second block; compare on/off within that block, not absolute AA-on vsAA-off images. MSAA/SMAA/bloom/air remain active and may still contribute rounding.','Probe bits attest raw published SH, not private base targets or whole-renderer state. HDR range extrema/counts are not sample-level image equality.','All PNGs come from explicit lens render and immediate export; no discarded-buffer paused toDataURL evidence.','Strict0pixel assertions are retained; observations are not a tolerance or a claim that visible GI/source photometry is absolutely calibrated.'];
  return report;
}
