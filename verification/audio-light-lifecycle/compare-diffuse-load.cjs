const {chromium}=require('playwright');
const fs=require('node:fs/promises'),{createHash}=require('node:crypto');
(async()=>{
 const source=await fs.readFile(__dirname+'/local-lights-diffuse-chunk-candidate.js','utf8');
 const browser=await chromium.launch({headless:true,executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe'}),issues=[],warnings=[];
 const report={variant:'routed diffuse-chunk candidate',sourceSHA256:createHash('sha256').update(source).digest('hex'),passed:false};
 try{
 const page=await browser.newPage({viewport:{width:960,height:720}});
 page.on('pageerror',e=>{issues.push(String(e.stack||e));console.log('ERROR',String(e));});page.on('console',m=>{if(m.type()==='error')issues.push(m.text());if(m.type()==='warning')warnings.push(m.text());});
 await page.route('**/local-lights.js',r=>r.fulfill({status:200,contentType:'text/javascript',body:source}));
 const start=Date.now();await page.goto('http://127.0.0.1:5186/');
 console.log('DOM loaded',Date.now()-start);
 await page.waitForFunction(()=>window.__ATOLL__?.state.ready||document.querySelector('#error')?.hidden===false,null,{timeout:60000});
 report.readyMs=Date.now()-start;
 report.state=await page.evaluate(()=>({ready:window.__ATOLL__?.state.ready,error:document.querySelector('#error-detail')?.textContent,lights:window.__ATOLL__?.localLights(),gl:window.__ATOLL__?.readGLErrors('diffuse-chunk-load')}));
 report.passed=report.state.ready&&issues.length===0&&report.state.gl.errors.length===0;
 await page.screenshot({path:__dirname+'/diffuse-chunk-load.png'});
 }catch(e){report.exception=String(e.stack||e);console.error(report.exception);}
 finally{report.issues=issues;report.warnings=warnings;await fs.writeFile(__dirname+'/diffuse-chunk-load.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));await browser.close();}
 if(!report.passed)process.exitCode=1;
})().catch(e=>{console.error(e);process.exitCode=1;});
