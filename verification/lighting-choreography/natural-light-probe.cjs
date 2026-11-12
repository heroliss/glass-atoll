const {chromium}=require('playwright');
const fs=require('node:fs/promises');
const path=require('node:path');
const {createHash}=require('node:crypto');
const sourceFiles=['main.js','lens.js','fireworks.js','fireworks-physics.js','complex-fireworks.js','complex-fireworks-style.js','complex-fireworks-motion.js','local-lights.js','firework-receiver-lighting.js'];
(async()=>{
  const browser=await chromium.launch({headless:true,executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe'});
  const issues=[],sourceHashes={};for(const file of sourceFiles)sourceHashes[file]=createHash('sha256').update(await fs.readFile(path.join(__dirname,'../..',file))).digest('hex');
  try{
    const page=await browser.newPage({viewport:{width:960,height:720}});
    page.on('pageerror',e=>issues.push(String(e)));page.on('console',m=>{if(m.type()==='error')issues.push(m.text());});
    await page.goto('http://127.0.0.1:5186/');await page.waitForFunction(()=>window.__ATOLL__?.state.ready,null,{timeout:120000});
    await page.evaluate(async()=>{const a=window.__ATOLL__;a.pause(true);await a.setQuality('medium');await a.setGraphics({hdrMode:'sdr'});await a.timePreset('stars');await a.setTime({running:false});a.setFireworks({type:'display-flower',effectProfile:'legacy',autoLaunch:false,autoFrame:false,autoDirection:false,azimuth:110,elevation:80,launchSpreadDegrees:0,burstTiltDegrees:0,burstRollDegrees:0,smokeQuality:'light',persistentSmoke:false,resolvedSmokeLighting:false});a.setLens({focal:24});a.setCamera([-65,30,54],[2,3,0],{expandFramingLimits:true});});
    await page.waitForFunction(()=>!window.__ATOLL__.cameraTransition());
    await page.addStyleTag({content:'body > :not(#scene){visibility:hidden!important}'});
    const report=await page.evaluate(async()=>{
      const a=window.__ATOLL__,launch=a.launchFirework({type:'display-flower',seed:619,launchSpreadDegrees:0,burstOrientation:{yawDegrees:0,tiltDegrees:0,rollDegrees:0}}),rows=[],images=[],frames=[];
      a.pause(false);
      const observe=()=>{const p=a.photometry(),phase=a.state.time-launch.burstTime;frames.push({phase,storageEV:p.storageEV,maxRawRGB:p.maxRawRGB,fireworks:p.components.fireworks,...(phase>.5&&p.components.fireworks>100?{main:a.traceMainBound(),reflection:a.traceReflectionBound()}: {})});
        if(images.length<3&&phase>=[.8,1.7,2.6][images.length])images.push({name:'natural-'+images.length+'.png',phase,dataURL:document.querySelector('#scene canvas').toDataURL('image/png')});
        a.setFrameProbe(observe);};a.setFrameProbe(observe);
      while(a.state.time<launch.burstTime+3.4){await new Promise(r=>setTimeout(r,200));if(a.state.time<launch.burstTime-.2)continue;const p=a.photometry(),phase=a.state.time-launch.burstTime;rows.push({phase,cameraEV:p.cameraEV,storageEV:p.storageEV,exposure:p.outputExposureScale,photometry:p,sourceBound:a.fireworks().radianceBound,...(phase>1.4?{mainBound:a.traceMainBound(),reflectionBound:a.traceReflectionBound()}:{}),exposureState:a.cameraExposureState(),lights:a.localLights().lights.slice(4,6),clusters:a.fireworkReceiverClusters(),camera:[...a.state.camera]});

      }a.pause(true);a.setFrameProbe(null);const late=frames.filter(f=>f.phase>=.8&&f.phase<=3.4);return{launch,rows,frames,images,checks:{postBurstFrames:late.length,minimumStorageEV:Math.min(...late.map(f=>f.storageEV)),maximumSourceBudget:Math.max(...late.map(f=>f.fireworks)),passed:late.length>30&&late.every(f=>f.storageEV>8&&f.fireworks<100)&&images.length===3},gl:a.readGLErrors('natural-light-probe')};
    });
    const {images,...r}=report;for(const item of images){await fs.writeFile(path.join(__dirname,item.name),Buffer.from(item.dataURL.split(';base64,')[1],'base64'));}r.images=images.map(({dataURL,...item})=>item);r.issues=issues;r.sourceHashes=sourceHashes;r.passed=r.checks.passed&&issues.length===0&&r.gl.errors.length===0;for(const file of sourceFiles)if(createHash('sha256').update(await fs.readFile(path.join(__dirname,'../..',file))).digest('hex')!==sourceHashes[file])throw Error('Source changed during natural probe: '+file);await fs.writeFile(path.join(__dirname,'natural-light-probe.json'),JSON.stringify(r,null,2));console.log(JSON.stringify({passed:r.passed,checks:r.checks,issues,gl:r.gl,rows:r.rows.map(v=>({t:v.phase,C:v.cameraEV,P:v.storageEV,I:v.clusters.reduce((s,c)=>s+c.referenceCandela,0)}))}));
      if(!report.checks.passed)process.exitCode=1;
  }finally{await browser.close();}
})().catch(e=>{console.error(e.stack||e);process.exitCode=1;});
