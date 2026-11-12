const {chromium}=require('playwright');
const fs=require('node:fs/promises');
const path=require('node:path');
const {createHash}=require('node:crypto');
const sha=b=>createHash('sha256').update(b).digest('hex');
(async()=>{
  const browser=await chromium.launch({headless:true,executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',args:['--autoplay-policy=no-user-gesture-required']});
  const report={schema:'glass-atoll.lighting-choreography.review-ui.v1',date:new Date().toISOString(),checks:[],issues:[]};
  const check=(name,passed,evidence)=>report.checks.push({name,passed:!!passed,evidence});
  let page;
  try{
    page=await browser.newPage({viewport:{width:960,height:720}});
    page.on('pageerror',e=>report.issues.push(String(e.stack||e)));page.on('console',m=>{if(m.type()==='error')report.issues.push(m.text());});page.on('response',r=>{if(r.status()>=400)report.issues.push({url:r.url(),status:r.status()});});
    const response=await page.goto('http://127.0.0.1:5186/verification/lighting-choreography/review.html');
    check('review page HTTP',response?.status()===200,response?.status());
    await page.locator('video').evaluateAll(videos=>videos.forEach(v=>{v.preload='metadata';v.load();}));
    await page.waitForFunction(()=>[...document.querySelectorAll('video')].every(v=>v.readyState>=1&&Number.isFinite(v.duration)&&v.duration>0));
    const media=await page.locator('video').evaluateAll(videos=>videos.map(v=>({id:v.id,duration:v.duration,width:v.videoWidth,height:v.videoHeight,error:v.error?.message||null})));
    check('three seekable 960x720 videos',media.length===3&&media.every(v=>v.width===960&&v.height===720&&!v.error),media);
    const playback=[];
    for(let i=0;i<3;i++){
      const v=page.locator('video').nth(i),start=await v.evaluate(async v=>{v.currentTime=v.duration*.45;await v.play();return v.currentTime;});
      await page.waitForFunction(({i,start})=>{const v=document.querySelectorAll('video')[i];return !v.error&&!v.paused&&v.currentTime>start+.25;},{i,start},{timeout:10000});
      playback.push(await v.evaluate(v=>{v.pause();return{id:v.id,time:v.currentTime,frames:v.getVideoPlaybackQuality().totalVideoFrames,dropped:v.getVideoPlaybackQuality().droppedVideoFrames,error:v.error?.message||null};}));
    }
    check('all three clips actually play in Chrome',playback.every(v=>v.frames>1&&!v.error),playback);
    for(const id of ['vfan','waterfall']){
      const b=page.locator('[data-zoom][aria-controls="'+id+'"]');await b.click();
      const zoomed=await page.locator('#'+id).evaluate(v=>({scale:getComputedStyle(v).transform,nativeControls:v.controls,cropped:v.parentElement.classList.contains('is-zoomed')}));
      check(id+' 2x crop preserves external controls',zoomed.scale.startsWith('matrix(2,')&&!zoomed.nativeControls&&zoomed.cropped,zoomed);
      await b.click();check(id+' full frame restores',await page.locator('#'+id).evaluate(v=>v.controls&&!v.parentElement.classList.contains('is-zoomed')));
    }
    await page.locator('#sequence').click();await page.waitForFunction(()=>!document.querySelector('#vfan').paused&&document.querySelector('#vfan').currentTime>.2);
    await page.locator('#vfan').evaluate(v=>{v.currentTime=v.duration-.25;});
    await page.waitForFunction(()=>document.querySelector('#vfan').ended&&!document.querySelector('#waterfall').paused&&document.querySelector('#waterfall').currentTime>.1);
    check('sequence advances to silver waterfall',(await page.locator('#status').textContent()).includes('横空银瀑'),await page.locator('#status').textContent());
    await page.locator('#stop').click();check('stop pauses every video',await page.locator('video').evaluateAll(v=>v.every(v=>v.paused)));
    await page.evaluate(()=>scrollTo(0,0));await page.screenshot({path:path.join(__dirname,'review-desktop.png')});
    await page.setViewportSize({width:390,height:844});
    const layout=await page.evaluate(()=>({width:innerWidth,scrollWidth:document.documentElement.scrollWidth}));check('390px layout fits',layout.scrollWidth<=layout.width,layout);
    await page.screenshot({path:path.join(__dirname,'review-mobile.png')});
    for(const img of await page.locator('.comparison img').all()){await img.scrollIntoViewIfNeeded();await img.evaluate(img=>img.decode());}
    check('four receiver comparison images load',await page.locator('.comparison img').evaluateAll(imgs=>imgs.length===4&&imgs.every(i=>i.complete&&i.naturalWidth===960&&i.naturalHeight===720)));
    check('no page console or resource errors',report.issues.length===0,report.issues);
  }catch(e){check('complete review interaction flow',false,String(e.stack||e));if(page&&!page.isClosed())await page.screenshot({path:path.join(__dirname,'review-failure.png')});}
  finally{await browser.close();}
  report.reviewSha256=sha(await fs.readFile(path.join(__dirname,'review.html')));report.mediaReportSha256=sha(await fs.readFile(path.join(__dirname,'media-check.json')));report.passed=report.checks.every(c=>c.passed);
  await fs.writeFile(path.join(__dirname,'review-ui-check.json'),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({passed:report.passed,checks:report.checks.map(c=>[c.name,c.passed])}));if(!report.passed)process.exitCode=1;
})().catch(e=>{console.error(e.stack||e);process.exitCode=1;});
