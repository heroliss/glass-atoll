import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
const root=path.resolve(import.meta.dirname,'..'),read=p=>fs.readFileSync(path.join(root,p)),sha=p=>crypto.createHash('sha256').update(read(p)).digest('hex');
const sources={
 'fireworks.js':'bb6a0080f34d714379eb860a45f1e595c2d82241fb62cd04dfb4cb2b601b949b',
 'fireworks-audio.js':'4e5ede41813249f062e50b212553e5e1821c27feaead8416b68ab51ba1b8ec31',
 'fireworks-physics.js':'dc5de6b1a11a3e1a70d7342d3bdacc5813ab0f66e426f622d6e287991b4af87a',
 'fireworks-thermal-photometry.js':'518925e388b638db38518b8f143670fc541f929ffbca09a08735150f167ae3e8',
 'luminous-framing.js':'a628f7e69e9ec08338feeb383e6aab2b09aff595f1943096460989f46d2589ce',
 'pyro-smoke-state.js':'67fa049f11928d23edf7b57798fd899fdbacb8956c3d939a479839642b429172',
 'pyro-smoke-tick-state.js':'bcd8ed7ef9cf57a8bf16ffd9ee3c44b438e63c9315a91b774e9e074461178143',
 'pyro-smoke-tick-math.js':'6e3555048c9fe43aa0815f60e27ce3968ebbce877b7379f3f2432c02591ad46a',
 'pyro-smoke-merge-graph.js':'15ab4a6e6789ff1b4352146b70ac5259dff13c70aabc774aaae1f1893e28f0e7',
 'aerial-perspective.js':'b552bd2fbe54d347649f6fde422c18e02645827f90d34b7429b26cc4e2089a81'};
for(const[p,h]of Object.entries(sources))if(sha(p)!==h)throw Error('R12 source changed: '+p);
const files=dir=>fs.existsSync(path.join(root,dir))?fs.readdirSync(path.join(root,dir),{withFileTypes:true}).flatMap(e=>e.isDirectory()?files(dir+'/'+e.name):[dir+'/'+e.name]):[];
const paths=[...new Set([...Object.keys(sources),...files('verification').filter(p=>/^verification\/r12-[^/]+$/.test(p)&&!p.endsWith('r12-source-evidence-manifest.json')),...files('verification/baselines').filter(p=>/\/r12-/.test(p)),...files('verification/references/r12-cie-photopic'),...files('verification/plans').filter(p=>/\/R12-/.test(p)),'verification/R12-CHECKPOINT.md'])].sort();
const report={schema:'glass-atoll.r12-source-evidence-manifest.v1',dateUTC:new Date().toISOString(),classification:'progress-not-goal-complete',goalStatus:'active',sources,entries:paths.map(p=>({path:p,bytes:read(p).length,sha256:sha(p)})),captureVersions:{
 'r12-thermal-scene.json':{main:sha('verification/baselines/r12-main-thermal-scene.js'),fireworks:sources['fireworks.js'],actual:'29/29; SDR A/B/A, three HDR buffers; emitting-area proxy only'},
 'r12-background-air-scene.json':{main:sha('verification/baselines/r12-main-first-background.js'),aerial:sources['aerial-perspective.js'],actual:'19/19 numeric; horizon seam visually remains, not promoted'},
 'r12-background-air-gpu-first.json':{aerial:sources['aerial-perspective.js'],actual:'10/11; invalid quantized-baseline exposure extrapolation gate retained'},
 'r12-background-air-gpu-diagnostic.json':{aerial:sources['aerial-perspective.js'],actual:'positive equal-path S; original exposure gate still fails; independent quantization audit supplied'},
 'r12-background-air-support-load-failure.json':{main:sha('verification/baselines/r12-main-final-before-water.js'),aerial:sha('verification/baselines/r12-background-air-support-runtime.js'),actual:'context interrupted at initial full-app load; fixture did not run; candidate withdrawn'},
 'r12-tick-summary.json':{state:sources['pyro-smoke-tick-state.js'],math:sources['pyro-smoke-tick-math.js'],graph:sources['pyro-smoke-merge-graph.js'],actual:'24/24 CPU + independent18/18; no host import, GPU or visual acceptance'}
},limits:['Source hashes and inventory are provenance, not automatic validity of each evidence item.','Support9bb remains preserved only as an unaccepted experiment; graphics failure cause is not established.','R13 main/water/stone/splash and shoreline work are separate and deliberately not described as R12 captures.','Default smoke host, reference photometry and flag0 air remain; no goal completion or photographic acceptance.']};
fs.writeFileSync(path.join(root,'verification/r12-source-evidence-manifest.json'),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({entries:report.entries.length,sourceMismatches:0,goalStatus:report.goalStatus}));
