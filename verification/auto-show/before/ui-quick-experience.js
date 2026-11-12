const TIMES=Object.freeze({day:'白昼',sunset:'日落',moon:'月夜',stars:'星空'});
const TYPE_TO_SOURCE=Object.freeze({peony:'peony',chrysanthemum:'chrysanthemum',willow:'willow',palm:'palm',smiley:'ring',heart:'heart',crossette:'crossette',strobe:'strobe',comet:'fan',bouquet:'bouquet'});
const SOURCE_TO_TYPE=Object.freeze(Object.fromEntries(Object.entries(TYPE_TO_SOURCE).map(([key,value])=>[value,key])));
const PROFILES=new Set(['three-heart-v1','three-heart-radiant120-v1','two-colour-v1']);

// Presentation and in-flight button state only. Scene values always come from
// the existing UI state, and every edit uses the incumbent action callbacks.
export function initQuickExperience({state,callbacks,submitFireworks,invoke,togglePause,openSettings,notify}){
  const element=id=>{
    const node=document.getElementById(id);
    if(!node)throw new Error(`Missing quick-experience element: ${id}`);
    return node;
  };
  const timeButtons=[...document.querySelectorAll('button[data-quick-time]')].filter(button=>Object.hasOwn(TIMES,button.dataset.quickTime));
  const timeStatus=element('quick-time-status'),selection=element('quick-firework-type');
  const launch=element('quick-launch'),random=element('quick-random'),auto=element('quick-auto');
  const stop=element('quick-stop'),settings=element('quick-firework-settings'),status=element('quick-firework-status');
  const busy=new Set();
  let timeEpoch=0,timeBusy=0,timeMessage=null;
  const hasCallback=name=>typeof callbacks[name]==='function';
  const timeCallback=()=>hasCallback('onQuickTimePreset')?'onQuickTimePreset':'onTimePreset';
  function syncTime(){
    const selected=state.time?.preset,pending=timeBusy!==0;
    for(const button of timeButtons){
      button.setAttribute('aria-pressed',String(button.dataset.quickTime===selected));
      button.disabled=pending||!hasCallback(timeCallback());
      button.setAttribute('aria-busy',String(pending));
    }
    timeStatus.setAttribute('aria-busy',String(pending));
    timeStatus.textContent=timeMessage||(Object.hasOwn(TIMES,selected)?`${TIMES[selected]} · 已应用，机位保持当前设置。`:'时间与机位独立，可分别切换。');
  }
  function cancelTimePreset(){
    timeEpoch++;timeMessage=null;syncTime();
  }

  function syncFireworks(){
    const f=state.fireworks,profile=f.effectProfile||'legacy';
    const value=profile==='legacy'?`type:${SOURCE_TO_TYPE[f.type]||''}`:`profile:${profile}`;
    const represented=[...selection.options].some(option=>option.value===value);
    if(represented)selection.value=value;
    else selection.selectedIndex=-1;
    selection.title=represented?'选择下一发的样式':'当前为详细设置中的其他实验样式；选择此处的样式可切换';
    selection.disabled=busy.has(selection)||!hasCallback('onFireworksChange');
    launch.disabled=busy.has(launch)||!hasCallback('onLaunchFirework');
    random.disabled=busy.has(random)||!hasCallback('onRandomFirework');
    auto.disabled=busy.has(auto)||!hasCallback('onFireworksChange')||!hasCallback('onStopFireworks');
    auto.setAttribute('aria-pressed',String(!!f.autoLaunch));
    auto.textContent=f.autoLaunch?'持续随机中':'持续随机';
    auto.title=f.autoLaunch?'停止后续发射，保留空中烟花与烟尘':'持续随机使用原有十种样式；开始时恢复场景播放';
    const queued=Number.isFinite(f.queued)&&f.queued>0;
    stop.disabled=busy.has(stop)||!hasCallback('onStopFireworks')||(!f.autoLaunch&&!queued);
    settings.disabled=typeof openSettings!=='function';
    const parts=[];
    if(Number.isFinite(f.active))parts.push(`空中 ${Math.max(0,Math.floor(f.active))} 发`);
    if(queued)parts.push(`等待 ${Math.floor(f.queued)} 发`);
    if(f.autoLaunch)parts.push('持续随机燃放中');
    else if(profile!=='legacy')parts.push(represented?'所选实验样式仅单次燃放':'当前使用详细设置中的其他实验样式');
    else parts.push('选择样式，立即发射');
    if(profile!=='legacy')parts.push('持续随机会切换为原有样式');
    if(f.smokeQuality==='light')parts.push('轻量短烟');
    else if(f.smokeQuality==='full')parts.push('长期体积烟 · 高开销');
    else if(f.smokeQuality==='off')parts.push('烟气已关闭');
    const text=parts.join(' · ');
    if(status.textContent!==text)status.textContent=text;
  }
  async function withBusy(button,action){
    if(busy.has(button))return;
    busy.add(button);button.setAttribute('aria-busy','true');syncFireworks();
    try{return await action();}
    catch(error){console.error('Atoll quick experience:',error);notify?.('操作暂时没有完成，请再试一次');}
    finally{busy.delete(button);button.setAttribute('aria-busy','false');syncFireworks();}
  }

  selection.addEventListener('change',()=>{
    const value=selection.value;
    return withBusy(selection,()=>{
      const [kind,id]=value.split(':');
      if(kind==='type'&&Object.hasOwn(TYPE_TO_SOURCE,id))return submitFireworks({type:TYPE_TO_SOURCE[id],effectProfile:'legacy'});
      if(kind==='profile'&&PROFILES.has(id))return submitFireworks({effectProfile:id});
      throw new RangeError('Unknown quick firework selection');
    });
  });
  launch.addEventListener('click',()=>withBusy(launch,()=>invoke('onLaunchFirework')));
  random.addEventListener('click',()=>withBusy(random,()=>invoke('onRandomFirework')));
  stop.addEventListener('click',()=>withBusy(stop,()=>invoke('onStopFireworks')));
  auto.addEventListener('click',()=>withBusy(auto,async()=>{
    if(state.fireworks.autoLaunch)return invoke('onStopFireworks');
    await submitFireworks({autoLaunch:true});
    if(state.paused)await togglePause();
  }));
  settings.addEventListener('click',()=>openSettings?.('fireworks'));
  for(const button of timeButtons)button.addEventListener('click',async()=>{
    const callback=timeCallback();
    if(timeBusy||!hasCallback(callback))return;
    const id=button.dataset.quickTime,ticket=++timeEpoch;
    timeBusy=ticket;timeMessage=`正在应用${TIMES[id]}…`;syncTime();
    try{
      // A time preset propagates failure and never invokes camera, launch or
      // sound callbacks. The scene callback publishes the real clock via syncTime.
      const result=await callbacks[callback](id);
      if(ticket===timeEpoch)timeMessage=result===false||result===undefined?'未能应用该时刻，可继续手动调节。':null;
    }catch(error){
      console.error('Atoll time preset:',error);
      if(ticket===timeEpoch){timeMessage='时间暂时未能更新，请重试。';notify?.('时间预设暂时没有完成，请再试一次');}
    }finally{
      if(timeBusy===ticket)timeBusy=0;
      syncTime();
    }
  });
  syncTime();syncFireworks();
  return {syncFireworks,syncTime,cancelTimePreset,clearShowcase(){},setShowcase(){return false;}};
}
