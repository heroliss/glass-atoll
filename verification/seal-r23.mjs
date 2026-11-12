import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
const root=path.resolve(import.meta.dirname,'..'),v=path.join(root,'verification');
const hash=file=>{const b=fs.readFileSync(file);return{sha256:crypto.createHash('sha256').update(b).digest('hex'),bytes:b.length};};
const old=JSON.parse(fs.readFileSync(path.join(v,'r22-final-manifest.json'),'utf8'));
const names=new Set([...Object.keys(old.source),'smoke-transmission-layout.js','pyro-smoke-transmission-gpu.js','pyro-smoke-transmission-pack.js','smoke-transmission-admission.js','package.json','README.md','verification/plans/PROGRESS.md']);
const source=Object.fromEntries([...names].sort().filter(n=>fs.existsSync(path.join(root,n))).map(n=>[n,hash(path.join(root,n))]));
function walk(d){return fs.readdirSync(d,{withFileTypes:true}).flatMap(e=>e.isDirectory()?walk(path.join(d,e.name)):[path.join(d,e.name)]);}
const selected=walk(v).filter(f=>/r23/i.test(path.basename(f))&&!/^r24/i.test(path.basename(f))&&path.basename(f)!=='r23-final-manifest.json');
const artifacts=Object.fromEntries(selected.sort().map(f=>[path.relative(root,f).replaceAll('\\','/'),hash(f)]));
const audio='4e5ede41813249f062e50b212553e5e1821c27feaead8416b68ab51ba1b8ec31';
if(source['fireworks-audio.js']?.sha256!==audio)throw new Error('Approved audio changed');
const report={schema:'glass-atoll.r23-final-manifest.v1',sealedUTC:new Date().toISOString(),goalStatus:'active',defaultLayout:'active-count',candidateUIAdmission:'powered candidate remains withheld',source,artifacts,
  validation:{syntax:'passed; final QA-only main catch also node --check passed',layoutCPU:[8,6,7,5],independentFixtureCPU:'8/8 after VM receipt fixture binding fix; original7/8 preserved',nativePairPreflightCPU:'6/6',finalSourceReviewCPU:'6/6',tinyGPU:[{phase:'first',checks:11,draws:4},{phase:'row-wrap',checks:11,draws:4},{phase:'empty-shrink',checks:47,draws:18}],nativeGPU:{warmupChecks:4,warmupDraws:4,pairChecks:6,pairDraws:8,rows:1740,packets:500},startupSanityGPU:'4/4',restoration:{intent:28,exact:27,derivedAutomaticPeak:[700,1270]},consoleErrors:0},
  limitations:['No complete density-overflow GPU route or evolving/multi-firework/60FPS acceptance.','1048576 remains a per-request pair cap; no joint frame governor exists.','Whole-frame ABBA has an HDR-calibration cross-block confound; no full causal FPS claim.','Historical R16 failed source/layout identity assertions are preserved, not relabeled passed.','SDR original view decoded identical; second main+mirror view differs by one blue code value at one pixel.']};
fs.writeFileSync(path.join(v,'r23-final-manifest.json'),JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({sealed:true,sources:Object.keys(source).length,artifacts:Object.keys(artifacts).length,audioUnchanged:true,goalStatus:'active'},null,2));
