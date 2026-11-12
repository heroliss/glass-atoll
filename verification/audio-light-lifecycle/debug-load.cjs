const {chromium}=require('playwright');
const fs=require('node:fs/promises');
(async()=>{
const browser=await chromium.launch({headless:true,executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe'}),errors=[],logs=[];
try{
 const page=await browser.newPage({viewport:{width:960,height:720}});
 page.on('pageerror',e=>{errors.push(String(e.stack||e));console.log('PAGEERROR',String(e.stack||e));});
 page.on('console',m=>{if(m.type()==='error'||m.type()==='warning'){logs.push(m.text());console.log(m.type(),m.text().slice(0,1800));}});
 page.on('requestfailed',r=>console.log('REQUESTFAILED',r.url(),r.failure()?.errorText));
 await page.goto('http://127.0.0.1:5186/');
 try{await page.waitForFunction(()=>window.__ATOLL__?.state.ready||document.body.innerText.includes("这片海暂时没有加载成功"),null,{timeout:60000});}catch(e){errors.push(String(e));}
 const state=await page.evaluate(()=>({ready:window.__ATOLL__?.state.ready,text:document.body.innerText.slice(0,6000),atollKeys:Object.keys(window.__ATOLL__??{})}));
 console.log(JSON.stringify(state,null,2));await fs.writeFile(__dirname+'/debug-load.json',JSON.stringify({errors,logs,state},null,2));await page.screenshot({path:__dirname+'/debug-load.png'});
}finally{await browser.close();}
})().catch(e=>{console.error(e.stack||e);process.exitCode=1;});
