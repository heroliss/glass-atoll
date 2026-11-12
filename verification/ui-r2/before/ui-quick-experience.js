const SHOWCASES=Object.freeze({
  'glass-day':'玻璃海晴昼',sunset:'海上日落',
  'blue-hour':'暮色烟花','starry-night':'星河与海',
});
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
  const showcaseButtons=[...document.querySelectorAll('button[data-showcase]')].filter(button=>Object.hasOwn(SHOWCASES,button.dataset.showcase));
  const showcaseStatus=element('showcase-status'),selection=element('quick-firework-type');
  const launch=element('quick-launch'),random=element('quick-random'),auto=element('quick-auto');
  const stop=element('quick-stop'),settings=element('quick-firework-settings'),status=element('quick-firework-status');
  const busy=new Set();
  let showcaseEpoch=0,showcaseBusy=0;
  const hasCallback=name=>typeof callbacks[name]==='function';

  function paintShowcase(id){
    for(const button of showcaseButtons)button.setAttribute('aria-pressed',String(button.dataset.showcase===id));
  }
  function clearShowcase(){
    showcaseEpoch++;
    paintShowcase(null);
    showcaseStatus.textContent='自由调整 · 选择风景组合可再次应用。';
  }
  function setShowcase(id){
    if(!Object.hasOwn(SHOWCASES,id))return false;
    showcaseEpoch++;
    paintShowcase(id);
    showcaseStatus.textContent=`${SHOWCASES[id]} · 已应用，可继续自由调整。`;
    return true;
  }
  function paintShowcaseBusy(){
    const pending=showcaseBusy!==0;
    for(const button of showcaseButtons){
      button.disabled=pending||!hasCallback('onShowcase');
      button.setAttribute('aria-busy',String(pending));
    }
    showcaseStatus.setAttribute('aria-busy',String(pending));
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
  for(const button of showcaseButtons)button.addEventListener('click',async()=>{
    if(showcaseBusy||!hasCallback('onShowcase'))return;
    const id=button.dataset.showcase,ticket=++showcaseEpoch;
    showcaseBusy=ticket;paintShowcaseBusy();
    showcaseStatus.textContent=`正在应用${SHOWCASES[id]}…`;
    try{
      // A combined preset must propagate failure; invoke intentionally swallows
      // errors for individual controls and is unsuitable for this sequence.
      const result=await callbacks.onShowcase(id);
      if(ticket===showcaseEpoch&&result!==false)setShowcase(id);
      else if(ticket===showcaseEpoch){paintShowcase(null);showcaseStatus.textContent='组合未完成，当前设置保留。';}
    }catch(error){
      console.error('Atoll showcase:',error);
      if(ticket===showcaseEpoch){paintShowcase(null);showcaseStatus.textContent='组合未完成，请重试或继续自由调整。';notify?.('风景组合暂时没有完成，请再试一次');}
    }finally{
      if(showcaseBusy===ticket)showcaseBusy=0;
      paintShowcaseBusy();
    }
  });
  paintShowcaseBusy();syncFireworks();
  return {syncFireworks,clearShowcase,setShowcase};
}
