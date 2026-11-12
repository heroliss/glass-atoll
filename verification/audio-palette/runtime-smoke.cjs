const {chromium}=require('playwright');
const fs=require('node:fs');
const path=require('node:path');
const out=__dirname;
(async()=>{
  fs.mkdirSync(out,{recursive:true});
  const browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_PATH,args:['--autoplay-policy=no-user-gesture-required']});
  const page=await browser.newPage({viewport:{width:960,height:720},deviceScaleFactor:1});
  const messages=[],failures=[];
  page.on('console',m=>{if(['error','warning'].includes(m.type()))messages.push({type:m.type(),text:m.text(),location:m.location()});});
  page.on('response',r=>{if(r.status()>=400)messages.push({type:'http',status:r.status(),url:r.url()});});
  page.on('pageerror',e=>failures.push(e.stack||String(e)));
  const report={schema:'glass-atoll.audio-palette.runtime-smoke.v1',date:new Date().toISOString(),isolatedBrowser:true,messages,failures};
  try{
    await page.goto('http://127.0.0.1:5186/',{waitUntil:'domcontentloaded'});
    await page.waitForFunction(()=>!!window.__ATOLL__?.state.ready,null,{timeout:120000});
    report.initial=await page.evaluate(()=>({state:window.__ATOLL__.state,gl:window.__ATOLL__.readGLErrors('initial')}));
    await page.locator('#sound').click();
    await page.waitForFunction(()=>window.__ATOLL__.audio.enabled&&window.__ATOLL__.fireworks().audio.variantsLoaded.length===5,null,{timeout:30000});
    report.capture=await page.evaluate(()=>{const a=window.__ATOLL__,stream=a.captureAudio(),tracks=stream.getAudioTracks(),active=a.audio.captureActive;a.stopAudioCapture();return{tracks:tracks.length,active,stopped:tracks.every(track=>track.readyState==='ended'),inactive:!a.audio.captureActive};});
    await page.evaluate(async()=>{const a=window.__ATOLL__;await a.setQuality('low');await a.timePreset('stars');a.setFireworks({type:'display-double',autoLaunch:false,persistentSmoke:false,smokeQuality:'light',autoFrame:true});a.setView('fireworks-close');});
    report.before=await page.evaluate(()=>({sound:window.__ATOLL__.audio,fireworks:window.__ATOLL__.fireworks()}));
    report.launch=await page.evaluate(()=>window.__ATOLL__.launchFirework({type:'display-double',seed:314159}));
    await page.waitForFunction(()=>window.__ATOLL__.fireworks().audio.recordedPlays>0,null,{timeout:90000});
    await page.screenshot({path:path.join(out,'runtime-smoke.png'),fullPage:true});
    await page.waitForFunction(()=>window.__ATOLL__.fireworks().audio.accentPlays>0&&window.__ATOLL__.fireworks().audio.scheduled>=4,null,{timeout:90000});
    report.after=await page.evaluate(()=>({sound:window.__ATOLL__.audio,fireworks:window.__ATOLL__.fireworks(),gl:window.__ATOLL__.readGLErrors('after-bursts'),state:window.__ATOLL__.state}));
    report.passed=failures.length===0&&messages.filter(m=>m.type==='error').length===0&&report.after.gl.errors.length===0&&report.after.fireworks.audio.variantsLoaded.length===5&&report.after.fireworks.audio.recordedPlays>0&&report.after.fireworks.audio.accentPlays>0&&report.after.sound.peakGuard?.mode==='linked-stereo-lookahead';
  }catch(e){report.error=e.stack||String(e);report.passed=false;await page.screenshot({path:path.join(out,'runtime-smoke-failure.png'),fullPage:true}).catch(()=>{});}
  finally{fs.writeFileSync(path.join(out,'runtime-smoke.json'),JSON.stringify(report,null,2)+'\n');await browser.close();}
  console.log(JSON.stringify({passed:report.passed,error:report.error,failures:failures.length,messages}));if(!report.passed)process.exitCode=1;
})().catch(e=>{console.error(e);process.exitCode=1;});
