const {chromium}=require('playwright');
const fs=require('node:fs/promises');
const path=require('node:path');
const {createHash}=require('node:crypto');
const root=path.resolve(__dirname,'../..');
const sha=b=>createHash('sha256').update(b).digest('hex');
const files=['main.js','ui.js','index.html','audio.js','optical-bloom.js','lens.js'];
const pins=async()=>Object.fromEntries(await Promise.all(files.map(async f=>[f,sha(await fs.readFile(path.join(root,f)))])));
(async()=>{
  const report={schema:'glass-atoll.sound-bloom-controls.browser.v1',date:new Date().toISOString(),checks:[],issues:[],sourceHashes:await pins()};
  const check=(name,passed,evidence)=>report.checks.push({name,passed:!!passed,evidence});
  const browser=await chromium.launch({headless:true,executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',args:['--autoplay-policy=document-user-activation-required']});
  let page;
  const soundState=()=>page.evaluate(()=>({pressed:document.querySelector('#sound').getAttribute('aria-pressed'),intent:window.__ATOLL__.state.parameters.sound,audio:window.__ATOLL__.audio}));
  try{
    page=await browser.newPage({viewport:{width:1280,height:900}});
    page.on('pageerror',e=>report.issues.push(String(e.stack||e)));
    page.on('console',m=>{if(m.type()==='error')report.issues.push(m.text());});
    page.on('response',r=>{if(r.status()>=400)report.issues.push({url:r.url(),status:r.status()});});
    await page.goto('http://127.0.0.1:5186/');
    await page.waitForFunction(()=>window.__ATOLL__?.state.ready,null,{timeout:120000});
    const initial=await soundState();
    check('sound defaults on without blocking scene readiness',initial.intent&&initial.pressed==='true'&&initial.audio.enabled,initial);
    await page.keyboard.press('Shift');
    await page.waitForFunction(()=>window.__ATOLL__.audio.contextState==='running'&&window.__ATOLL__.audio.loaded&&window.__ATOLL__.fireworks().audio.variantsLoaded.length===5,null,{timeout:30000});
    const recording=await page.evaluate(async()=>{
      const a=window.__ATOLL__,chunks=[],recorder=new MediaRecorder(a.captureAudio(),{mimeType:'audio/webm;codecs=opus'});
      recorder.ondataavailable=e=>{if(e.data.size)chunks.push(e.data);};
      const done=new Promise(resolve=>recorder.onstop=resolve);recorder.start();await new Promise(r=>setTimeout(r,750));recorder.stop();await done;a.stopAudioCapture();
      const data=await new Blob(chunks,{type:'audio/webm'}).arrayBuffer(),bytes=data.byteLength,offline=new OfflineAudioContext(2,48000,48000),buffer=await offline.decodeAudioData(data);
      let peak=0,sum=0,n=0;for(let c=0;c<buffer.numberOfChannels;c++)for(const v of buffer.getChannelData(c)){peak=Math.max(peak,Math.abs(v));sum+=v*v;n++;}
      return{bytes,seconds:buffer.duration,peak,rms:Math.sqrt(sum/n),audio:a.audio};
    });
    check('default sound is running and actual recording is nonsilent after ordinary interaction',recording.bytes>0&&recording.peak>1e-5&&recording.rms>1e-6&&recording.audio.contextState==='running',recording);
    report.autoplay={requestedPolicy:'document-user-activation-required',initialContext:initial.audio.contextState,limit:'This Chrome may already permit autoplay on localhost. The test does not claim that a browser-enforced initial block occurred.'};
    await page.locator('#sound').click();await page.keyboard.press('Shift');
    const muted=await soundState();check('manual mute survives subsequent interaction',!muted.intent&&!muted.audio.enabled&&muted.pressed==='false',muted);
    await page.locator('#sound').click();await page.waitForFunction(()=>window.__ATOLL__.audio.contextState==='running'&&window.__ATOLL__.audio.enabled);
    check('sound can be enabled again',true,await soundState());
    await page.locator('#panel-toggle').click();await page.locator('#tab-camera').click();
    const initialBloom=await page.evaluate(()=>({value:document.querySelector('#optical-bloom-strength').value,bloom:window.__ATOLL__.state.lens.bloom,setting:window.__ATOLL__.state.parameters.lens.opticalBloomStrength}));
    check('default bloom is 75 percent of previous full strength',initialBloom.value==='75'&&initialBloom.setting===.75&&Math.abs(initialBloom.bloom.budget.bloom-.0135)<1e-12,initialBloom);
    const samples=[];
    for(const value of [0,25,100,60]){
      await page.locator('#optical-bloom-strength').fill(String(value));
      await page.locator('#optical-bloom-strength').dispatchEvent('input');
      samples.push(await page.evaluate(()=>({value:Number(document.querySelector('#optical-bloom-strength').value),output:document.querySelector('#optical-bloom-strength-output').textContent,bloom:window.__ATOLL__.state.lens.bloom,setting:window.__ATOLL__.state.parameters.lens.opticalBloomStrength})));
    }
    check('slider updates actual lens budget continuously including zero bypass',samples.every(s=>s.output===s.value+'%'&&s.setting===s.value/100&&Math.abs(s.bloom.budget.bloom-.018*s.value/100)<1e-12&&(s.value!==0||s.bloom.passes===0)),samples);
    await page.locator('#optical-bloom').uncheck();
    const off=await page.evaluate(()=>({disabled:document.querySelector('#optical-bloom-strength').disabled,bloom:window.__ATOLL__.state.lens.bloom}));
    await page.locator('#optical-bloom').check();
    const on=await page.evaluate(()=>({disabled:document.querySelector('#optical-bloom-strength').disabled,bloom:window.__ATOLL__.state.lens.bloom}));
    check('bloom switch retains chosen intensity',off.disabled&&off.bloom.passes===0&&!on.disabled&&on.bloom.bloomStrength===.6,{off,on});
    await page.locator('#optical-bloom-strength').focus();await page.keyboard.press('ArrowRight');
    check('slider supports keyboard with accessible percent readout',await page.locator('#optical-bloom-strength').getAttribute('aria-valuetext')==='61%',await page.locator('#optical-bloom-strength-output').textContent());
    await page.locator('#optical-bloom-strength').scrollIntoViewIfNeeded();await page.screenshot({path:path.join(__dirname,'controls-desktop.png')});
    await page.setViewportSize({width:390,height:844});await page.locator('#optical-bloom-strength').scrollIntoViewIfNeeded();
    const layout=await page.evaluate(()=>{const s=document.querySelector('#optical-bloom-strength'),r=s.getBoundingClientRect();return{width:innerWidth,scroll:document.documentElement.scrollWidth,left:r.left,right:r.right,visible:r.width>0};});
    check('slider fits 390px viewport',layout.visible&&layout.scroll<=layout.width&&layout.left>=0&&layout.right<=layout.width,layout);
    await page.screenshot({path:path.join(__dirname,'controls-mobile.png')});
    await page.evaluate(()=>window.__ATOLL__.pause(true));
    report.gpu=await page.evaluate(()=>window.__ATOLL__.runBloomGaussianCheck());
    check('existing full strength Gaussian GPU contract still passes',report.gpu.passed,{actualGPU:report.gpu.actualGPU,rows:report.gpu.rows.length,errors:report.gpu.error,gl:report.gpu.glErrors,restoration:report.gpu.restoration});
    const finalHashes=await pins();check('production files stable throughout browser run',JSON.stringify(finalHashes)===JSON.stringify(report.sourceHashes));
    check('no page or resource errors',report.issues.length===0,report.issues);
  }catch(e){report.error=e.stack||String(e);check('complete browser flow',false,report.error);if(page&&!page.isClosed())await page.screenshot({path:path.join(__dirname,'failure.png')});}
  finally{await browser.close();}
  report.passed=report.checks.every(c=>c.passed);await fs.writeFile(path.join(__dirname,'browser-check.json'),JSON.stringify(report,null,2)+'\n');
  console.log(JSON.stringify({passed:report.passed,checks:report.checks.map(c=>[c.name,c.passed]),error:report.error}));if(!report.passed)process.exitCode=1;
})().catch(e=>{console.error(e.stack||e);process.exitCode=1;});
