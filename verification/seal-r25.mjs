import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
const root=path.resolve(import.meta.dirname,'..'),v=path.join(root,'verification');
const read=n=>JSON.parse(fs.readFileSync(path.join(v,n),'utf8'));
const hash=file=>{const b=fs.readFileSync(file);return{sha256:crypto.createHash('sha256').update(b).digest('hex'),bytes:b.length};};
const prior=read('r24-final-manifest.json'),source={},changes=[];
// R24's task-scoped manifest did not list the unchanged volume renderer.
// Add the exact pre-edit R25 copy and the independent vendor audit pin.
const rendererBaseline=hash(path.join(v,'baselines/r25-before-prefix/pyro-smoke-renderer.js'));
if(rendererBaseline.sha256!==read('r25-vendor-attribute-prefix-independent-check.json').checks[0].evidence.baselineSHA256)throw new Error('Renderer baseline pin mismatch');
const previousSources={...prior.productionSource,'pyro-smoke-renderer.js':rendererBaseline};
for(const[n,pin]of Object.entries(previousSources)){const current=hash(path.join(root,n));source[n]=current;if(current.sha256!==pin.sha256)changes.push(n);}
if(JSON.stringify(changes.sort())!==JSON.stringify(['main.js','pyro-smoke-renderer.js']))throw new Error('Unexpected runtime change set: '+changes.join(','));
if(source['fireworks-audio.js'].sha256!=='4e5ede41813249f062e50b212553e5e1821c27feaead8416b68ab51ba1b8ec31')throw new Error('Approved audio changed');
const checks=Object.fromEntries(['r25-smoke-prefix-independent-check.json','r25-vendor-attribute-prefix-independent-check.json','r25-smoke-prefix-gpu-preflight.json','r25-smoke-prefix-independent-preflight.json','r25-smoke-prefix-actual-gpu-final.json','r25-actual-upload-audit.json','r25-user-restoration-check.json'].map(n=>{const p=read(n);if(!p.passed)throw new Error('Final scoped check failed: '+n);return[n,{passed:p.passed,counts:p.counts}];}));
const gpu=read('r25-smoke-prefix-actual-gpu-final.json');if(gpu.helperRevision!=='r25-shader-single-pass-v2'||gpu.actualDraws!==2||gpu.readbackBytes!==1152)throw new Error('Actual hardware receipt scope changed');
const failed=read('r25-smoke-prefix-actual-gpu.json');if(failed.passed||failed.actualDraws!==1)throw new Error('Original failed hardware receipt was replaced');
if(read('r25-final-console.json').length)throw new Error('Final console is not empty');if(!read('r25-final-service-readonly.json').passed)throw new Error('Expected sole local server not confirmed');
function walk(d){return fs.readdirSync(d,{withFileTypes:true}).flatMap(e=>e.isDirectory()?walk(path.join(d,e.name)):[path.join(d,e.name)]);}
const files=walk(v).filter(f=>/r25/i.test(path.relative(v,f))&&path.basename(f)!=='r25-final-manifest.json');
const artifacts=Object.fromEntries(files.sort().map(f=>[path.relative(root,f).replaceAll('\\','/'),hash(f)]));
const report={schema:'glass-atoll.r25-final-manifest.v1',sealedUTC:new Date().toISOString(),goalStatus:'active',source,changedRuntimeFiles:changes,artifacts,checks,syntax:{command:'npm run check',exitCode:0,scope:'Root verified completion of exec session32845; runtime sources unchanged afterward'},rendererMath:{command:'node verification/pyro-smoke-renderer-math-check.mjs',passed:18,total:18},actualGPU:{revision:gpu.helperRevision,draws:gpu.actualDraws,renders:gpu.smokeRenders,readbackBytes:gpu.readbackBytes,firstAllocationBytes:576,warmMirrorUpdateBytes:144},historicalViewport:'Blocked before assertions by pre-existing normalizer scope drift; exact pre-R25 source also fails. Assertions remain unmodified.',documents:{README:hash(path.join(root,'README.md')),progress:hash(path.join(v,'plans/PROGRESS.md'))},limits:['No image-equivalence, real SH1 bake, native-density, evolving-scene or whole-frame FPS acceptance in this tiny VBO gate.','First buffer allocation remains complete capacity; pending updates may still upload during a zero-instance visit after an interrupted draw.','Original actual failed2/3/1draw receipt and superseded CPU two-pass model remain separate archived evidence.','Automatic HDR calibration intent remains; derived peak1270→700 means28 restored intents but27 exact numeric checks.','Complete smoke source-pair CPU fallback and overall photoreal goal remain incomplete; powered UI candidate withheld.']};
fs.writeFileSync(path.join(v,'r25-final-manifest.json'),JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({sealed:true,goalStatus:'active',sources:Object.keys(source).length,artifacts:Object.keys(artifacts).length,changedRuntimeFiles:changes,actualGPU:report.actualGPU,audioUnchanged:true},null,2));
