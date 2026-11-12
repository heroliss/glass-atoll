const {chromium}=require('playwright');
const fs=require('node:fs/promises');
const path=require('node:path');
(async()=>{
  const browser=await chromium.launch({headless:true,executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe'});
  const context=await browser.newContext({viewport:{width:960,height:720},deviceScaleFactor:1});
  const page=await context.newPage(),issues=[];
  page.on('pageerror',e=>issues.push(String(e.stack||e)));
  try{
    await page.goto('http://127.0.0.1:5186/');
    await page.waitForFunction(()=>window.__ATOLL__?.state.ready,null,{timeout:120000});
    await page.evaluate(async()=>{
      const a=window.__ATOLL__;a.pause(true);await a.setQuality('medium');await a.setGraphics({hdrMode:'sdr'});
      await a.timePreset('stars');await a.setTime({running:false});
      a.setFireworks({type:'display-flower',effectProfile:'legacy',autoLaunch:false,autoFrame:false,autoDirection:false,azimuth:110,elevation:80,launchSpreadDegrees:0,burstTiltDegrees:0,burstRollDegrees:0,smokeQuality:'light',persistentSmoke:false,resolvedSmokeLighting:false});
      a.setLens({focal:16,dof:false});
      a.setCamera([-55,8,95],[25,85,-10],{expandFramingLimits:true});
      a.setLocalLights({mode:'off'});
      const launch=a.launchFirework({type:'display-flower',seed:619});a.pauseAtPhysicalTime(launch.burstTime+1.1);a.pause(false);
    });
    await page.waitForFunction(()=>window.__ATOLL__.state.parameters.paused,null,{timeout:60000});
    await page.evaluate(()=>new Promise(resolve=>window.__ATOLL__.setFrameProbe(()=>{window.__ATOLL__.setFrameProbe(null);resolve();})));
    await page.evaluate(()=>{document.activeElement?.blur();});await page.keyboard.press('h');
    await page.addStyleTag({content:'#restore-ui,#toast{display:none!important}'});
    await page.screenshot({path:path.join(__dirname,'composition-pilot.png')});
    const data=await page.evaluate(()=>({time:window.__ATOLL__.state.time,lights:window.__ATOLL__.localLights(),clusters:window.__ATOLL__.fireworkReceiverClusters(),photometry:window.__ATOLL__.photometry(),gl:window.__ATOLL__.readGLErrors('composition')}));
    await fs.writeFile(path.join(__dirname,'composition-pilot.json'),JSON.stringify({issues,...data},null,2));
    console.log(JSON.stringify({issues,lights:data.lights.lights.slice(4),gl:data.gl}));
  }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
