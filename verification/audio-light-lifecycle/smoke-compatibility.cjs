// Root runs this after the currently active browser/GPU diagnostic completes.
const {chromium}=require('playwright');
const fs=require('node:fs/promises');
const path=require('node:path');
const {pathToFileURL}=require('node:url');
const {createHash}=require('node:crypto');
const root=path.resolve(__dirname,'../..');
const sourceFiles=['main.js','local-lights.js','firework-receiver-lighting.js','fireworks.js','water.js','indirect-lighting.js','pyro-smoke.js','pyro-smoke-renderer.js','pyro-smoke-light-field.js','pyro-smoke-state.js','verification/pyro-smoke-local-gpu-check.js','verification/pyro-smoke-resolved-field-supplement-gpu-check.js','verification/pyro-smoke-local-oracle.js','verification/pyro-smoke-light-field-oracle.js','verification/transient-gi-gpu-check.js','verification/indirect-lighting-gpu-check.js'];
async function hashes(){return Object.fromEntries(await Promise.all(sourceFiles.map(async file=>[file,createHash('sha256').update(await fs.readFile(path.join(root,file))).digest('hex')])));}
(async()=>{
  const sourceHashes=await hashes(),report={schema:'glass-atoll.smoke-current-budget-compatibility.v1',dateUTC:new Date().toISOString(),sourceHashes,checks:[],browserErrors:[],consoleErrors:[],glChecks:[],passed:false,limits:['New isolated paused medium-SDR page; local smoke, resolved field and transient indirect GPU fixtures run sequentially on one renderer.','This report verifies current-budget smoke compatibility; historical frozen byte-exact six-source fixtures are retained as separate evidence.','Twenty shared receiver-source records do not imply twenty native scene lights; detached PointLight mirrors remain diagnostic records.','One-pixel isolated volume checks and one-packet 14000-source field supplement do not establish island appearance or performance.']};
  const {runCurrentBudgetCheck}=await import(pathToFileURL(path.join(__dirname,'current-budget-check.mjs')).href);report.currentBudget=runCurrentBudgetCheck();
  await fs.writeFile(path.join(__dirname,'current-budget-check.json'),JSON.stringify(report.currentBudget,null,2)+'\n');
  const browser=await chromium.launch({headless:true,executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe'});
  try{
    const page=await browser.newPage({viewport:{width:960,height:720},deviceScaleFactor:1});
    page.on('pageerror',error=>report.browserErrors.push(String(error.stack||error)));page.on('console',message=>{if(message.type()==='error')report.consoleErrors.push(message.text());});
    await page.goto('http://127.0.0.1:5186/');await page.waitForFunction(()=>window.__ATOLL__?.state.ready,null,{timeout:120000});
    await page.evaluate(async()=>{const a=window.__ATOLL__;a.pause(true);await a.setQuality('medium');await a.setGraphics({hdrMode:'sdr'});a.pause(true);});
    report.glChecks.push(await page.evaluate(()=>window.__ATOLL__.readGLErrors('smoke-compatibility-entry')));
    for(const [name,method]of [['local','runSmokeLocalCheck'],['resolvedSupplement','runResolvedSmokeFieldSupplementCheck'],['transientIndirect','runTransientIndirectCheck']]){
      const started=Date.now();report[name]=await page.evaluate(async method=>{const a=window.__ATOLL__;if(!a.state.parameters.paused)throw Error('Smoke GPU check requires paused page');return await a[method]();},method);report[name].runnerWallMilliseconds=Date.now()-started;
      report.glChecks.push(await page.evaluate(label=>window.__ATOLL__.readGLErrors(label),name+'-compatibility-exit'));
      await fs.writeFile(path.join(__dirname,'smoke-compatibility.json'),JSON.stringify(report,null,2)+'\n');
    }
    report.pageState=await page.evaluate(()=>({ready:window.__ATOLL__.state.ready,paused:window.__ATOLL__.state.parameters.paused,graphicsContextInterrupted:window.__ATOLL__.state.graphicsContextInterrupted,localLightCount:window.__ATOLL__.localLights().lights.length,receiverLighting:structuredClone(window.__ATOLL__.localLights())}));
  }catch(error){report.error=String(error.stack||error);}
  finally{await browser.close();}
  const after=await hashes();report.changedSources=sourceFiles.filter(file=>sourceHashes[file]!==after[file]);
  report.checks=[{name:'current twenty/four contract passes independently',passed:!!report.currentBudget.passed},{name:'local smoke GPU fixture passes',passed:!!report.local?.passed},{name:'resolved field supplement GPU fixture passes',passed:!!report.resolvedSupplement?.passed},{name:'transient indirect GPU fixture covers last current light slot',passed:!!report.transientIndirect?.passed},{name:'all wrapper GL error checks clear',passed:report.glChecks.length===4&&report.glChecks.every(row=>row.errors.length===0)},{name:'no browser or shader console errors',passed:report.browserErrors.length===0&&report.consoleErrors.length===0},{name:'source and QA receipt unchanged during checks',passed:report.changedSources.length===0},{name:'paused healthy page retains all twenty shared source records',passed:!!report.pageState?.ready&&report.pageState.paused&&!report.pageState.graphicsContextInterrupted&&report.pageState.localLightCount===20}];
  report.passed=!report.error&&report.checks.every(row=>row.passed);await fs.writeFile(path.join(__dirname,'smoke-compatibility.json'),JSON.stringify(report,null,2)+'\n');
  console.log(JSON.stringify({passed:report.passed,checks:report.checks,local:report.local?.counts,resolvedSupplement:{passed:report.resolvedSupplement?.passed,count:report.resolvedSupplement?.total},error:report.error,changedSources:report.changedSources},null,2));if(!report.passed)process.exitCode=1;
})().catch(error=>{console.error(error.stack||error);process.exitCode=1;});
