const {chromium}=require('playwright');
const fs=require('node:fs/promises');
const path=require('node:path');
const output=__dirname;
(async()=>{
  const browser=await chromium.launch({headless:true,executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe'});
  const issues=[];
  try{
    const page=await browser.newPage();
    page.on('pageerror',e=>issues.push(String(e.stack||e)));
    await page.route('**/audio-layer-fixture.html',route=>route.fulfill({contentType:'text/html',body:'<!doctype html><html lang="zh"><title>烟花实际混音验证</title><p>Offline production audio fixture</p></html>'}));
    await page.goto('http://127.0.0.1:5186/verification/audio-light-lifecycle/audio-layer-fixture.html');
    const result=await page.evaluate(async()=>{
      const {runAudioLayerCheck}=await import('/verification/audio-light-lifecycle/audio-layer-check.js');
      return runAudioLayerCheck({capture:true});
    });
    for(const [id,base64]of Object.entries(result.captures))await fs.writeFile(path.join(output,id+'.wav'),Buffer.from(base64,'base64'));
    result.captureFiles=Object.keys(result.captures).map(id=>id+'.wav');delete result.captures;
    result.browserIssues=issues;result.passed&&=issues.length===0;
    await fs.writeFile(path.join(output,'audio-layer-check.json'),JSON.stringify(result,null,2));
    console.log(JSON.stringify({passed:result.passed,total:result.total,passedCount:result.passedCount,captureFiles:result.captureFiles,failed:result.checks.filter(c=>!c.passed),browserIssues:issues},null,2));
    if(!result.passed)process.exitCode=1;
  }finally{await browser.close();}
})().catch(e=>{console.error(e.stack||e);process.exitCode=1;});
