const raf=()=>new Promise(requestAnimationFrame),clone=x=>structuredClone(x);
export async function prepareNativeStoneScene(a){
 a.pause(true);a.setDirector({mode:'off'});await a.timePreset('day');await a.setTime({running:false});await a.setGraphics({hdrMode:'sdr',displayTransform:'legacy'});a.setDiagnosticCameraEV(null);a.setLens({focal:28,dof:false});
 a.setCamera([43,.85,8.3],[43,-.10,7.2]);
 return {camera:a.state.camera,target:a.state.target,interactions:a.interactions(),instruction:'Native left press/release at scene centre; no synthetic throw or direct drop'};
}
export async function observeNativeStoneEntry(a,{phaseSeconds=.11,timeoutMs=15000}={}){
 const report={schema:'glass-atoll.r13-native-stone-scene.v1',dateUTC:new Date().toISOString(),actualGPU:true,input:'native pointer press/release supplied by browser controller',checks:[],images:{}};
 const check=(name,passed,evidence)=>report.checks.push({name,passed:!!passed,evidence}),initial=clone(a.interactions()),old=new Set(a.splashes.events.map(e=>e.id)),deadline=performance.now()+timeoutMs;
 a.pause(false);let found;
 while(performance.now()<deadline){found=a.splashes.events.find(e=>!old.has(e.id));if(found)break;await raf();}
 if(!found){report.error='No actual impact splash appeared before bounded deadline';check('actual stone-entry splash appears',false);return report;}
 const target=a.state.time+Math.max(0,phaseSeconds-found.age);a.pauseAtPhysicalTime(target);
 while(!a.state.parameters.paused&&performance.now()<deadline)await raf();
 report.entry={state:clone(a.state),interactions:clone(a.interactions()),splash:clone(a.splashes.events.find(e=>e.id===found.id)),gl:a.readGLErrors('native stone entry')};
 report.images.entry=a.screenshot();
 check('native launch reaches one water entry and a real splash',report.entry.interactions.stoneDiagnostics.counters.launched===initial.stoneDiagnostics.counters.launched+1&&report.entry.interactions.stoneDiagnostics.counters.waterEntries===initial.stoneDiagnostics.counters.waterEntries+1&&!!report.entry.splash);
 check('stone retained underwater or on seabed at true centimetre size',[...report.entry.interactions.underwater,...report.entry.interactions.resting.filter(s=>s.kind==='water')].some(s=>s.diameterMetres===.025));
 check('impact locator stays hidden',document.getElementById('impact-locator')?.hidden===true);
 check('actual scene remains valid',!a.state.graphicsContextInterrupted&&!report.entry.gl.errors.length);
 report.passed=report.checks.every(c=>c.passed);report.counts={passed:report.checks.filter(c=>c.passed).length,total:report.checks.length};report.limits=['Native input and source-state continuity only; retained mesh data alone does not prove through-water pixel visibility.','Entry image must be inspected; metric splash proxy is not CFD.','Paused capture is not frame-rate acceptance.'];return report;
}
export async function inspectSettledNativeStone(a){
 const target=a.state.time+2,deadline=performance.now()+10000;a.pause(false);a.pauseAtPhysicalTime(target);
 while(!a.state.parameters.paused){if(performance.now()>deadline)throw Error('Settled physical phase timeout');await raf();}
 for(let i=0;i<40;i++)await raf();
 const r={schema:'glass-atoll.r13-settled-native-stone.v1',actualGPU:true,state:clone(a.state),water:clone(a.waterDiagnostics()),interactions:clone(a.interactions()),photo:clone(a.photometry()),range:await a.inspectRadiance(),images:{normal:a.screenshot()}};
 try{for(const [key,mode]of [['mask',16],['path',17],['repeat',0]]){a.debugWater(mode);for(let i=0;i<40;i++)await raf();r.images[key]=a.screenshot();}}
 finally{a.debugWater(0);}
 r.gl=a.readGLErrors('settled native stone');return r;
}
