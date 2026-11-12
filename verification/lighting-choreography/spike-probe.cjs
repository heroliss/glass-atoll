const {chromium}=require('playwright');
const fs=require('node:fs/promises');
const path=require('node:path');
(async()=>{
  const browser=await chromium.launch({headless:true,executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe'});
  const issues=[];
  try{
    const page=await browser.newPage({viewport:{width:960,height:720}});
    page.on('pageerror',e=>issues.push(String(e)));page.on('console',m=>{if(m.type()==='error')issues.push(m.text());});
    await page.goto('http://127.0.0.1:5186/');await page.waitForFunction(()=>window.__ATOLL__?.state.ready,null,{timeout:120000});
    await page.evaluate(async()=>{const a=window.__ATOLL__;a.pause(true);await a.setQuality('medium');await a.setGraphics({hdrMode:'sdr'});await a.timePreset('stars');await a.setTime({running:false});a.setFireworks({type:'display-flower',effectProfile:'legacy',autoLaunch:false,autoFrame:false,autoDirection:false,azimuth:110,elevation:80,launchSpreadDegrees:0,burstTiltDegrees:0,burstRollDegrees:0,smokeQuality:'light',persistentSmoke:false,resolvedSmokeLighting:false});a.setLens({focal:24});a.setCamera([-65,30,54],[2,3,0],{expandFramingLimits:true});});
    await page.waitForFunction(()=>!window.__ATOLL__.cameraTransition());
    await page.addStyleTag({content:'body > :not(#scene){visibility:hidden!important}'});
    const report=await page.evaluate(async()=>{
      const a=window.__ATOLL__,launch=a.launchFirework({type:'display-flower',seed:619,launchSpreadDegrees:0,burstOrientation:{yawDegrees:0,tiltDegrees:0,rollDegrees:0}}),rows=[],images=[];
      a.pause(false);
      while(a.state.time<launch.burstTime+3.4){await new Promise(r=>requestAnimationFrame(r));if(a.state.time<launch.burstTime-.2)continue;if(a.photometry().components.fireworks<100)continue;const p=a.photometry(),phase=a.state.time-launch.burstTime;rows.push({phase,cameraEV:p.cameraEV,storageEV:p.storageEV,exposure:p.outputExposureScale,photometry:p,sourceBound:a.fireworks().radianceBound,...(phase>1.4?{mainBound:a.traceMainBound(),reflectionBound:a.traceReflectionBound()}:{}),exposureState:a.cameraExposureState(),lights:a.localLights().lights.slice(4,6),clusters:a.fireworkReceiverClusters(),camera:[...a.state.camera]});
        if(false)await new Promise(resolve=>a.setFrameProbe(()=>{images.push({name:'natural-'+images.length+'.png',phase:a.state.time-launch.burstTime,dataURL:document.querySelector('#scene canvas').toDataURL('image/png')});resolve();}));
      }a.pause(true);return{launch,rows,images,gl:a.readGLErrors('natural-light-probe')};
    });
    const {images,...r}=report;for(const item of images){await fs.writeFile(path.join(__dirname,item.name),Buffer.from(item.dataURL.split(';base64,')[1],'base64'));}r.images=images.map(({dataURL,...item})=>item);r.issues=issues;await fs.writeFile(path.join(__dirname,'spike-probe.json'),JSON.stringify(r,null,2));console.log(JSON.stringify({issues,gl:r.gl,rows:r.rows.map(v=>({t:v.phase,C:v.cameraEV,P:v.storageEV,I:v.clusters.reduce((s,c)=>s+c.referenceCandela,0)}))}));
  }finally{await browser.close();}
})().catch(e=>{console.error(e.stack||e);process.exitCode=1;});
