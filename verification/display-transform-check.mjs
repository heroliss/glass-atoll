// Real controller policy with an injected resource/draw boundary. No GL or
// numerical colour result is simulated or claimed. Factory GPU tests are separate.
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync} from 'node:fs';
import crypto from 'node:crypto';
import {createDisplayTransform} from '../display-transform.js';
import {ACES2_OUTPUT_TARGETS,ACES2_OUTPUT_VARIANT} from '../aces2-output.js';
import {renderDisplayTransformAdapter} from '../hdr-output.js';

const sourcePath=new URL('../display-transform.js',import.meta.url),source=readFileSync(sourcePath),
  sha=x=>crypto.createHash('sha256').update(x).digest('hex'),checks=[];
const wait=()=>new Promise(resolve=>setImmediate(resolve));
function deferred(){let resolve;const promise=new Promise(r=>resolve=r);return{promise,resolve};}
function boundary({hold=[],failures={},throwFactory=false}={}){
  const gates=new Map(hold.map(n=>[n,deferred()])),ready=new Set(),prepares=[],draws=[],notices=[];
  let allocations=0,disposeCalls=0,dead=false,renderError=null;
  const controller=createDisplayTransform({}, {tag:'no-GL-renderer'}, {
    onStateChange(info){notices.push(info);},
    createOutput(){
      allocations++;if(throwFactory)throw Error('boundary factory failure');
      return {
        async prepareTarget({peakNits}){
          prepares.push(peakNits);if(gates.has(peakNits))await gates.get(peakNits).promise;
          if(dead)return{ready:false,reason:'disposed'};
          if(!ACES2_OUTPUT_TARGETS.includes(peakNits))return{ready:false,supported:false,reason:'unsupported-target',peakNits};
          const failure=failures[peakNits];
          if(failure==='throw')throw Error('boundary prepare throw');
          if(failure)return{ready:false,supported:true,reason:'validation-failed',error:String(failure),peakNits};
          ready.add(peakNits);return{ready:true,supported:true,peakNits};
        },
        isReady(peakNits){return !dead&&ready.has(peakNits);},
        render(args){draws.push({...args});if(renderError)throw Error(renderError);return{rendered:true};},
        dispose(){disposeCalls++;dead=true;ready.clear();},
        get state(){return{boundaryOnly:true,readyTargets:[...ready],disposed:dead};}
      };
    }
  });
  return{controller,prepares,draws,notices,failures,gates,release(n){gates.get(n)?.resolve();},
    setRenderError(v){renderError=v;},get allocations(){return allocations;},get disposeCalls(){return disposeCalls;}};
}
async function check(name,fn){try{checks.push({name,passed:true,evidence:await fn()});}catch(error){checks.push({name,passed:false,error:String(error.stack||error)});}}
const draw=(controller,kind='hdr',options={})=>controller.render({kind,input:{tag:'same-float-master'},exposure:3.125,
  ...(kind==='hdr'?{peakNits:700,sdrWhiteNits:280}:{}),...options});

await check('default and explicitlegacy are lazy and never allocate or admit targets',async()=>{
  const b=boundary(),a=b.controller;assert.equal(a.state.requested,'legacy');assert.equal(b.allocations,0);
  assert.equal(draw(a,'sdr'),false);await a.configure({mode:'legacy',peakNits:700});
  assert.equal(a.state.sdr.effective,'none');assert.equal(a.state.hdr.effective,'none');
  assert.equal(a.state.sdr.reason,'awaiting-render');assert.equal(a.state.hdr.reason,'awaiting-render');
  assert.equal(draw(a,'sdr'),false);assert.equal(a.state.sdr.effective,'legacy');assert.equal(a.state.hdr.effective,'none');
  assert.equal(draw(a),false);
  assert.equal(b.allocations,0);assert.equal(b.prepares.length,0);assert.equal(b.draws.length,0);
  assert.equal(a.state.sdr.effective,'legacy');assert.equal(a.state.hdr.effective,'legacy');a.dispose();
  assert.equal(b.disposeCalls,0);return{allocations:0,prepares:0,draws:0,newSelectionRequiresEachSurfaceDraw:true};
});
await check('prepared resources never claim a presented surface before an actual draw',async()=>{
  const b=boundary(),a=b.controller;await a.configure({mode:'aces2',peakNits:700});
  assert.deepEqual(b.prepares,[100,700]);assert.equal(a.state.preparation.status,'ready');
  assert.equal(a.state.sdr.effective,'none');assert.equal(a.state.hdr.effective,'none');assert.equal(a.state.variant,ACES2_OUTPUT_VARIANT);
  assert.equal(draw(a),true);assert.equal(a.state.hdr.effective,'aces2');assert.equal(a.state.hdr.peakNits,700);a.dispose();
  return{targetAdmissionOrder:[100,700],claimsOnlyAfterDraw:true};
});
await check('SDR HDR forward unchanged input exposure and exact single units encoding contract',async()=>{
  const b=boundary(),a=b.controller;await a.configure({mode:'aces2',peakNits:700});
  const input={tag:'physical-float-master',pixels:new Float32Array([.2,1,15])},target={tag:'encoded-output'},viewport=[0,0,1920,1080],exposure=.76*2**(16.5-10.5);
  const before=Array.from(input.pixels);assert.equal(draw(a,'sdr',{input,target,viewport,exposure}),true);
  assert.equal(draw(a,'hdr',{input,viewport,exposure}),true);assert.equal(b.draws.length,2);
  for(const args of b.draws){assert.equal(args.input,input);assert.equal(args.exposure,exposure);assert.equal(args.viewport,viewport);assert.equal(args.encodeSRGB,true);assert(!Object.hasOwn(args,'paperWhiteNits'));assert(!Object.hasOwn(args,'sceneScale'));}
  assert.equal(b.draws[0].peakNits,100);assert.equal(b.draws[0].nitsToLinear,1);assert.equal(b.draws[0].target,target);
  assert.equal(b.draws[1].peakNits,700);assert.equal(b.draws[1].nitsToLinear,100/280);assert.equal(b.draws[1].target,null);assert.deepEqual(Array.from(input.pixels),before);
  a.dispose();return{SDRTarget:100,HDRTarget:700,SDRScale:1,HDRScale:100/280,unchangedExposure:exposure,drawCalls:2,numericalGPU:false};
});
await check('unsupported1200 cannot reuse700 while cached100 remains usable forSDR',async()=>{
  const b=boundary(),a=b.controller;await a.configure({mode:'aces2',peakNits:700});assert.equal(draw(a),true);
  await a.configure({mode:'aces2',peakNits:1200});assert.equal(a.state.preparation.status,'unsupported');
  const before=b.draws.length;assert.equal(draw(a,'hdr',{peakNits:1200}),false);assert.equal(b.draws.length,before);
  assert.equal(a.state.hdr.effective,'legacy');assert.equal(a.state.hdr.peakNits,1200);assert.equal(a.state.hdr.reason,'unsupported-target');
  assert.equal(draw(a,'hdr',{peakNits:700}),false);assert.equal(a.state.hdr.reason,'calibration-target-changed');
  assert.equal(draw(a,'sdr'),true);assert.equal(b.draws.at(-1).peakNits,100);assert.equal(a.state.sdr.effective,'aces2');a.dispose();
  return{unsupportedTarget:1200,noNearest700Substitution:true,cachedSDR100:true};
});
await check('pending exactHDR keeps SDR cache and does not draw old700 fornew1270',async()=>{
  const b=boundary({hold:[1270]}),a=b.controller;await a.configure({mode:'aces2',peakNits:700});draw(a);
  const work=a.configure({mode:'aces2',peakNits:1270});await wait();assert.equal(a.state.preparation.status,'pending');
  assert.equal(draw(a,'hdr',{peakNits:1270}),false);assert.equal(draw(a,'sdr'),true);b.release(1270);await work;
  assert.equal(draw(a,'hdr',{peakNits:1270}),true);assert.equal(b.draws.at(-1).peakNits,1270);a.dispose();return{pendingDoesNotSubstitute:true};
});
await check('mode cancellation rejects delayed firstenable continuation',async()=>{
  const b=boundary({hold:[100]}),a=b.controller,p=a.configure({mode:'aces2',peakNits:700});
  await a.configure({mode:'legacy',peakNits:1270});b.release(100);await p;
  assert.equal(a.state.requested,'legacy');assert.equal(a.state.preparation.reason,'selected-legacy');assert.deepEqual(b.prepares,[100]);assert.equal(draw(a,'sdr'),false);a.dispose();
  return{noStaleHDRPrepareAfterLegacy:true};
});
await check('latest peak and mode win when olderHDR preparation resolves last',async()=>{
  const b=boundary({hold:[700,1270]}),a=b.controller,old=a.configure({mode:'aces2',peakNits:700});await wait();
  const current=a.configure({mode:'aces2',peakNits:1270});await wait();b.release(1270);await current;
  b.release(700);await old;assert.equal(a.state.requested,'aces2');assert.equal(a.state.preparation.status,'ready');assert.equal(a.state.preparation.peakNits,1270);
  assert.equal(draw(a,'hdr',{peakNits:1270}),true);assert.equal(draw(a,'hdr',{peakNits:700}),false);a.dispose();return{latestExactPeak:1270,oldCompletionCannotRelabel:true};
});
await check('same pending configuration deduplicates controller work',async()=>{
  const b=boundary({hold:[100]}),a=b.controller,p=a.configure({mode:'aces2',peakNits:700}),q=a.configure({mode:'aces2',peakNits:700});assert.equal(p,q);assert.deepEqual(b.prepares,[100]);
  b.release(100);await p;const count=b.prepares.length;await a.configure({mode:'aces2',peakNits:700});assert.equal(b.prepares.length,count);a.dispose();return{samePromise:true,admissions:count};
});
await check('invalid mode and nonnumeric outofrange peak reject without revision change',()=>{
  const b=boundary(),a=b.controller,initial=JSON.stringify(a.state);
  for(const mode of ['ACES2','aces',null,0,{}])assert.throws(()=>a.configure({mode}),/Unknown display transform/);
  for(const peakNits of [NaN,Infinity,-Infinity,39,10001,'700',null,true])assert.throws(()=>a.configure({peakNits}),/finite within/);
  assert.equal(JSON.stringify(a.state),initial);assert.equal(b.allocations,0);assert.throws(()=>a.render({kind:'other'}),/Unknown output surface/);assert.throws(()=>a.noteFallback({kind:'other'}),/Unknown output surface/);a.dispose();return{invalidModes:5,invalidPeaks:8,noAllocation:true};
});
await check('documented calibration rounding is explicit and unsupportedrounded target stays unsupported',async()=>{
  const b=boundary(),a=b.controller;await a.configure({mode:'aces2',peakNits:700.4});assert.equal(a.state.preparation.peakNits,700);
  assert.equal(draw(a,'hdr',{peakNits:700.4}),true);assert.equal(b.draws.at(-1).peakNits,700);
  await a.configure({mode:'aces2',peakNits:1200.4});assert.equal(a.state.preparation.peakNits,1200);assert.equal(a.state.preparation.status,'unsupported');a.dispose();
  return{finite40to10000CalibrationRoundsToInteger:true,notAnArbitraryPeakGPUClaim:true};
});
await check('missing invalid browser white falls back before draw and cannot borrow paperwhite',async()=>{
  const b=boundary(),a=b.controller;await a.configure({mode:'aces2',peakNits:700});
  for(const sdrWhiteNits of [undefined,0,-1,NaN,Infinity]){assert.equal(draw(a,'hdr',{sdrWhiteNits,paperWhiteNits:280}),false);assert.equal(a.state.hdr.reason,'browser-white-unavailable');}
  assert.equal(b.draws.length,0);a.dispose();return{invalidWhiteCases:5,noCandidateDraw:true};
});
await check('factory exception and failedSDR admission close safely without HDR work',async()=>{
  for(const options of [{throwFactory:true},{failures:{100:'asset SHA mismatch'}},{failures:{100:'throw'}}]){
    const b=boundary(options),a=b.controller;await a.configure({mode:'aces2',peakNits:700});assert.equal(a.state.preparation.status,'failed');assert(a.state.lastError);assert.equal(draw(a,'sdr'),false);assert.equal(draw(a),false);assert(!b.prepares.includes(700));assert.equal(b.draws.length,0);a.dispose();
  }return{factoryAndHashAndPrepareThrows:3,noFailedCandidateClaims:true};
});
await check('HDR validation failure preserves SDR and explicitretry recovers same target',async()=>{
  const b=boundary({failures:{700:'gamut table SHA mismatch'}}),a=b.controller;await a.configure({mode:'aces2',peakNits:700});
  assert.equal(a.state.preparation.status,'failed');assert.equal(draw(a),false);assert.equal(draw(a,'sdr'),true);const count=b.prepares.length;
  delete b.failures[700];await a.configure({mode:'aces2',peakNits:700});assert.equal(b.prepares.length,count);
  await a.configure({mode:'aces2',peakNits:700,retry:true});assert.equal(a.state.preparation.status,'ready');assert.equal(draw(a),true);assert.equal(a.state.lastError,null);a.dispose();return{noImplicitRetryLoop:true,explicitRetryRecovers:true};
});
await check('draw exception returns false records fallback and later valid draw clears lastError',async()=>{
  const b=boundary(),a=b.controller;await a.configure({mode:'aces2',peakNits:700});b.setRenderError('GL boundary draw rejected');
  assert.equal(draw(a),false);assert.equal(a.state.hdr.reason,'output-render-failed');assert.equal(a.state.hdr.effective,'legacy');assert(a.state.lastError.includes('draw rejected'));assert.equal(a.state.frames.hdr,0);
  b.setRenderError(null);assert.equal(draw(a),true);assert.equal(a.state.frames.hdr,1);assert.equal(a.state.lastError,null);a.dispose();return{exceptionIsNeverSuccessfulDraw:true};
});
await check('separate SDRexport and bridgefallback never relabel other surface',async()=>{
  const b=boundary(),a=b.controller;await a.configure({mode:'aces2',peakNits:700});draw(a);const hdr={...a.state.hdr};draw(a,'sdr');assert.deepEqual(a.state.hdr,hdr);
  a.noteFallback({kind:'hdr',reason:'PBO legacy only'});assert.equal(a.state.hdr.effective,'legacy');assert.equal(a.state.hdr.reason,'PBO legacy only');assert.equal(a.state.sdr.effective,'aces2');a.dispose();return{surfacesIndependent:true};
});
await check('HDR preparation error survives successful cachedSDR draw',async()=>{
  const b=boundary({failures:{700:'HDR gamut table SHA mismatch'}}),a=b.controller;
  await a.configure({mode:'aces2',peakNits:700});assert.equal(a.state.preparation.status,'failed');
  assert.equal(a.state.preparation.error,'HDR gamut table SHA mismatch');assert.equal(draw(a,'sdr'),true);
  assert.equal(a.state.sdr.effective,'aces2');assert.equal(a.state.preparation.error,'HDR gamut table SHA mismatch');
  assert.equal(a.state.lastError,'HDR gamut table SHA mismatch');a.dispose();return{successfulSDRDoesNotEraseHDRPreparationError:true};
});
await check('surface render errors are independently retained and cleared including noteFallback',async()=>{
  const b=boundary(),a=b.controller;await a.configure({mode:'aces2',peakNits:700});
  b.setRenderError('HDR native draw failed');
  const declined=renderDisplayTransformAdapter(a,{kind:'hdr',input:{tag:'same-float-master'},exposure:3.125,peakNits:700,sdrWhiteNits:280});
  assert.equal(declined.effective,'legacy');assert.equal(a.state.hdr.reason,'output-render-failed');assert.equal(a.state.hdr.error,'HDR native draw failed');b.setRenderError(null);
  assert.equal(draw(a,'sdr'),true);assert.equal(a.state.hdr.error,'HDR native draw failed');assert.equal(a.state.lastError,'HDR native draw failed');
  a.noteFallback({kind:'sdr',reason:'SDR destination rejected',error:'SDR incomplete FBO'});
  assert.equal(a.state.sdr.error,'SDR incomplete FBO');assert.equal(a.state.hdr.error,'HDR native draw failed');
  assert.equal(draw(a),true);assert.equal(a.state.hdr.error,null);assert.equal(a.state.sdr.error,'SDR incomplete FBO');assert.equal(a.state.lastError,'SDR incomplete FBO');
  a.noteFallback({kind:'hdr',reason:'PBO bridge'});assert.equal(a.state.sdr.error,'SDR incomplete FBO');
  a.noteFallback({kind:'sdr',reason:'selected legacy'});assert.equal(a.state.sdr.error,null);assert.equal(a.state.lastError,null);a.dispose();
  return{SDRAndHDRSuccessClearOnlyOwnDrawError:true,noteFallbackClearOnlyOwnSurface:true};
});
await check('explicitlegacy selection clears preparation and bothsurface faults without drawing',async()=>{
  const b=boundary(),a=b.controller;await a.configure({mode:'aces2',peakNits:700});
  a.noteFallback({kind:'hdr',reason:'native rejected',error:'HDR old fault'});a.noteFallback({kind:'sdr',reason:'SDR rejected',error:'SDR old fault'});
  await a.configure({mode:'legacy',peakNits:700});assert.equal(a.state.lastError,null);assert.equal(a.state.preparation.error,null);
  assert.equal(a.state.sdr.error??null,null);assert.equal(a.state.hdr.error??null,null);assert.equal(a.state.requested,'legacy');assert.equal(b.draws.length,0);
  b.failures[700]='new HDR prepare fault';await a.configure({mode:'aces2',peakNits:700,retry:true});assert.equal(a.state.preparation.error,'new HDR prepare fault');
  await a.configure({mode:'legacy',peakNits:700});assert.equal(a.state.preparation.error,null);assert.equal(a.state.lastError,null);a.dispose();return{explicitSelectionResetsAllDiagnosticDomains:true};
});
await check('dispose pending invalidates continuations and releases boundary once',async()=>{
  const b=boundary({hold:[100]}),a=b.controller,p=a.configure({mode:'aces2',peakNits:700});a.dispose();a.dispose();b.release(100);await p;
  assert.equal(a.state.disposed,true);assert.equal(a.state.preparation.reason,'disposed');assert.equal(b.disposeCalls,1);assert.deepEqual(b.prepares,[100]);assert.throws(()=>a.configure({mode:'aces2'}),/disposed/);
  assert.equal(draw(a,'sdr'),false);assert.equal(a.state.sdr.reason,'disposed');assert.equal(b.draws.length,0);return{noLateHDRAdmission:true,disposeCalls:1};
});
assert.equal(sha(readFileSync(sourcePath)),sha(source),'controller changed during bounded run; repeat against a frozen source');
const report={schema:'glass-atoll.display-transform-policy-CPU.v1',dateUTC:new Date().toISOString(),passed:checks.every(c=>c.passed),
  counts:{passed:checks.filter(c=>c.passed).length,total:checks.length},checks,sourceSHA256:sha(source),adapterSourceSHA256:sha(readFileSync(new URL('../hdr-output.js',import.meta.url))),actualGPU:false,
  boundary:'Injected createOutput models only admission/readiness/draw success or exceptions; no GL calls, colour pixels, shader validation or HDR bridge results generated',
  limits:['Actual imported controller is exercised, not a second implementation of its state machine.','One exposure/unit/OETF forwarding is verified as arguments; shader arithmetic and visible HDR need separate actualGPU evidence.','40..10000 finite calibration rounds to integer by current policy; arbitrary target resources remain explicit unsupported.','No UI/native browser acceptance or performance claim.']};
writeFileSync(new URL('./display-transform-check.json',import.meta.url),JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({passed:report.passed,counts:report.counts,sourceSHA256:report.sourceSHA256,failed:checks.filter(c=>!c.passed)},null,2));
if(!report.passed)process.exitCode=1;
