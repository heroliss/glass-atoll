const fs=require('node:fs');
const path=require('node:path');
const http=require('node:http');
const crypto=require('node:crypto');
const {chromium}=require('playwright');
const root=path.resolve(__dirname,'../..');
const types={'.html':'text/html','.js':'text/javascript','.mjs':'text/javascript','.json':'application/json','.ogg':'audio/ogg'};
(async()=>{
  const server=http.createServer((req,res)=>{
    const pathname=decodeURIComponent(new URL(req.url,'http://127.0.0.1').pathname),file=path.resolve(root,'.'+pathname);
    if(!file.startsWith(root+path.sep)){res.writeHead(403);res.end();return;}
    fs.readFile(file,(error,data)=>{if(error){res.writeHead(404);res.end();return;}res.writeHead(200,{'Content-Type':types[path.extname(file)]||'application/octet-stream'});res.end(data);});
  });
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  let browser;
  try{
    browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_PATH||'C:/Program Files/Google/Chrome/Application/chrome.exe'});
    const page=await browser.newPage(),errors=[];
    page.on('pageerror',error=>errors.push(error.message));
    await page.goto('http://127.0.0.1:'+server.address().port+'/assets/audio/credits.html',{waitUntil:'domcontentloaded'});
    const baselineOnly=process.argv.includes('--baseline-only');
    const report=await page.evaluate(async baselineOnly=>{const module=await import('/verification/fireworks/audio-palette-check.js');return module.runAudioPaletteCheck({capture:!baselineOnly,baselineOnly});},baselineOnly);
    report.browser={version:await browser.version(),pageErrors:errors};
    const captureReports=[];
    for(const [id,base64]of Object.entries(report.captures)){
      const data=Buffer.from(base64,'base64'),file='audio-palette-'+id+'.wav';fs.writeFileSync(path.join(__dirname,file),data);captureReports.push({file,bytes:data.length,sha256:crypto.createHash('sha256').update(data).digest('hex')});
    }
    delete report.captures;report.captureFiles=captureReports;
    report.passed=report.passed&&errors.length===0;
    fs.writeFileSync(path.join(__dirname,baselineOnly?'audio-palette-protected-baseline-stress.json':'audio-palette-check.json'),JSON.stringify(report,null,2)+'\n');
    console.log(JSON.stringify({passed:report.passed,passedCount:report.passedCount,total:report.total,pageErrors:errors,failed:report.checks.filter(c=>!c.passed),scenarios:report.reports.map(r=>({id:r.scenario.id,peak:r.peak,clipped:r.clippedSamples,voices:r.audio.activeVoices,discarded:r.audio.discarded})),baselineStress:report.baselineStress.map(r=>({id:r.scenario.id,peak:r.peak,clipped:r.clippedSamples,voices:r.audio.activeVoices})),captureFiles:captureReports},null,2));
    if(!report.passed)process.exitCode=1;
  }finally{if(browser)await browser.close();await new Promise(resolve=>server.close(resolve));}
})().catch(error=>{console.error(error);process.exitCode=1;});
