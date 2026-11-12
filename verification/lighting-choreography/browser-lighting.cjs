const {chromium}=require('playwright');
const fs=require('node:fs/promises');
const path=require('node:path');
const {createHash}=require('node:crypto');
const sha=data=>createHash('sha256').update(data).digest('hex');
const root=path.resolve(__dirname,'../..');
(async()=>{
  const browser=await chromium.launch({headless:true,executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe'});
  const reports={};
  try{
    for(const arm of ['baseline','current']){
      const context=await browser.newContext({viewport:{width:960,height:720},deviceScaleFactor:1});
      if(arm==='baseline'){
        let source=await fs.readFile(path.join(__dirname,'before/fireworks.js'),'utf8');
        const seam='api.configure({});return api;';
        if(source.split(seam).length!==2)throw Error('Baseline factory seam changed');
        source=source.replace(seam,'api.getReceiverLightClusters=api.getLightClusters;'+seam);
        await context.route('**/fireworks.js',route=>route.fulfill({status:200,contentType:'text/javascript',body:source}));
        const lamps=await fs.readFile(path.join(__dirname,'before/local-lights.js'),'utf8');
        await context.route('**/local-lights.js',route=>route.fulfill({status:200,contentType:'text/javascript',body:lamps}));
      }
      const page=await context.newPage(),issues=[];
      page.on('pageerror',e=>issues.push(String(e.stack||e)));
      page.on('console',m=>{if(m.type()==='error')issues.push(m.text());});
      try{
        await page.goto('http://127.0.0.1:5186/');
        await page.waitForFunction(()=>window.__ATOLL__?.state.ready,null,{timeout:120000});
        await page.evaluate(async()=>{const a=window.__ATOLL__;a.pause(true);await a.setQuality('medium');await a.setGraphics({hdrMode:'sdr'});});
        await page.addStyleTag({content:'body > :not(#scene){visibility:hidden!important}'});
        const report=await page.evaluate(async baseline=>window.__ATOLL__.runReceiverLightCheck({
          type:'display-flower',seed:619,phases:[.008,.08,.8,1.7,2.6],width:320,height:240,capture:true,requireColourChange:true,
          ...(baseline?{baseline,exposureEV:baseline.fixedCameraEV}:{}),
          sample:{worldPoints:[{id:'cay-centre',position:[-1.5,1.3,-1],radiusPixels:12},{id:'near-water',position:[-12,0,28],radiusPixels:12}]}
        }),arm==='current'?reports.baseline:null);
        const {images,...metadata}=report;metadata.issues=issues;metadata.arm=arm;
        metadata.baselineScope='Same current choreography/physics and shader/lens. Baseline uses the saved former fireworks optical representation and local-light range; its receiver getter aliases the original cloud clusters. Not a comparison of earlier choreography.';
        reports[arm]=metadata;
        for(const item of images){const marker=';base64,',index=item.dataURL.indexOf(marker);if(index<0)throw Error('Image payload missing');await fs.writeFile(path.join(__dirname,arm+'-'+item.name),Buffer.from(item.dataURL.slice(index+marker.length),'base64'));}
        await fs.writeFile(path.join(__dirname,arm+'-receiver-scene.json'),JSON.stringify(metadata,null,2));
        console.log(JSON.stringify({arm,passed:metadata.passed,checks:metadata.checks.length,failed:metadata.checks.filter(c=>!c.passed).map(c=>({name:c.name,evidence:c.evidence})),issues}));
      }finally{await context.close();}
    }
    const sources={};for(const file of ['main.js','lens.js','fireworks.js','fireworks-physics.js','complex-fireworks.js','complex-fireworks-style.js','complex-fireworks-motion.js','local-lights.js','firework-receiver-lighting.js'])sources[file]=sha(await fs.readFile(path.join(root,file)));
    const qaHashes={};for(const file of ['receiver-scene-check.js','before/fireworks.js','before/local-lights.js'])qaHashes[file]=sha(await fs.readFile(path.join(__dirname,file)));
    const report={schema:'glass-atoll.receiver-light-browser.v1',date:new Date().toISOString(),sourceHashes:sources,qaHashes,baselinePassed:reports.baseline.passed,currentPassed:reports.current.passed,coreReductionAccepted:reports.current.coreReductionAccepted,passed:reports.current.passed&&reports.current.coreReductionAccepted&&reports.current.issues.length===0};
    await fs.writeFile(path.join(__dirname,'browser-lighting.json'),JSON.stringify(report,null,2));
    if(!report.passed)process.exitCode=1;
  }finally{await browser.close();}
})().catch(e=>{console.error(e.stack||e);process.exitCode=1;});
