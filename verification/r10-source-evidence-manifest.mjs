// R10 inventory seal. Capture versions remain explicit; hashes are not acceptance.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {fileURLToPath} from 'node:url';
const root=fileURLToPath(new URL('../',import.meta.url));
const read=p=>fs.readFileSync(path.join(root,p));
const sha=p=>crypto.createHash('sha256').update(read(p)).digest('hex');
const names=dir=>fs.readdirSync(path.join(root,dir),{withFileTypes:true}).filter(x=>x.isFile()).map(x=>(dir?dir+'/':'')+x.name);
const expected={
 'main.js':'b2fe468c216b8fe89839f168a3c4b6ae7a21272d4f73277356f27b69f7e885a8',
 'fireworks.js':'b37ea388471b6f50a307327fab95ccc10d7f9aaa1dc46ed921fc1abd9c890e43',
 'pyro-smoke-columns.js':'d44a897ab8c7c9f58e0c7f974d07d1206b374d44dbb228bf05ebbe71131afad6',
 'pyro-smoke.js':'01c4c66e15579f429e472a0089fda9f5ba1f17d782d3cd63d69a226b30225a89',
 'pyro-smoke-state.js':'1aa90d24f42adbf6416bd871e8de56d26c4841535e7f0d7f80e591286c6a2cba',
 'pyro-smoke-logical-burn.js':'235dff6244215b5a599d3d80ea93321ccacefb8d690a07813f0c25b827800a15',
 'pyro-smoke-logical-events.js':'5f7bf8b0d311f9cdac938b18612b9ff16b5c80fa26330a20d79e9e44661a1837',
 'fireworks-audio.js':'4e5ede41813249f062e50b212553e5e1821c27feaead8416b68ab51ba1b8ec31'
};
for(const [p,h]of Object.entries(expected))if(sha(p)!==h)throw Error('Reviewed R10 source changed: '+p+'; do not reseal a later revision as R10');
const runtime=names('').filter(p=>/\.(?:js|mjs|json|html)$/.test(p));
const top=names('verification').filter(p=>/\/(?:r10-|R10-|logical-burn|logical-events|LOGICAL-|smoke-transmission|SMOKE-TRANSMISSION|PERFORMANCE-SOURCES-R10)/.test(p)&&!p.endsWith('r10-source-evidence-manifest.json'));
const nested=names('verification/fireworks').filter(p=>/r10-final-independent|body-sampler/.test(p));
const docs=['README.md','verification/plans/PROGRESS.md','verification/PLAYGROUND-ACCEPTANCE.md','verification/plans/R10-ALL-SOURCE-CONTINUOUS-SMOKE-CONTRACT.md','verification/plans/R10-CLOUD-SINGLE-PARAMETER-HOLD.md'];
const all=[...new Set([...runtime,...top,...nested,...docs])].sort();
const entries=all.map(p=>({path:p,bytes:read(p).length,sha256:sha(p)}));
const oldFW='927b044a20fd6497ee052a84a70e73b4a1d4bfaf5193f6cde12943ba89db2a0d',oldColumns='cad9b4f1fc01e47fc2f961274cb56f441cb12070af1b8dd83f7b6145114641a4',oldMain='d9181b476d93b5e5f5eb35b720823a961de13c550c101bc226dec46e942b3908';
const current={...expected};
const report={schema:'glass-atoll.r10-source-evidence-manifest.v1',dateUTC:new Date().toISOString(),goalStatus:'active',classification:'progress-not-overall-visual-acceptance',currentRuntime:current,entries,captureVersions:{
 'r10-hot-fireworks-cpu.cpuprofile':{fireworks:oldFW,columns:oldColumns,main:oldMain,scope:'203s profile; analysis only attributes conservative common hot intersection, not all samples'},
 'r10-transmission-gpu-scene.json':{fireworks:expected['fireworks.js'],columns:'0c2a14e9b8bd4181c022a70eb0fc34d04b65f25bce8e28d20201eef6c3a11e7d',host:expected['pyro-smoke.js'],scope:'GPU10/10; scene7/7; complete SDR PNG byte-exact; HDR extrema, not full HDR image hash'},
 'r10-transmission-scene-performance.json':{...current,scope:'final d44 preflight guard; actual257 interleaved queries, CPU elapsed benefit, whole GPU essentially flat; not same-phase paired FPS'},
 'r10-logical-crossette-scene.json':{...current,scope:'actual4096, three phases,14/14; visualAccepted:false'},
 'r10-logical-bouquet-scene.json':{...current,scope:'actual4096, three phases,14/14; visualAccepted:false'},
 'r10-restored-default-state.json':{...current,scope:'fresh native1209x1292 defaultday, medium, audioOFF, no cameraEV override, productionpoint smoke, GL[]'}
},limits:[
 'File hashes record this checkpoint, not automatic proof of GPU execution or appearance. Old failed fixtures and corrected preparation remain separate.',
 'Original Array validation failure6/7 and typed-scratch regression are preserved. Final targeted rerun reports have independent filenames and unchanged assertions.',
 'All-ten source correctness used65536 CPU capacity; actual4096 evidence is two representative single events, not willow/long accumulation acceptance.',
 'Production trajectory point/.20/12/two-births remains default; all-logical continuous source is QA opt-in. Audio gain remains accepted4e5.',
 'No measured photochemical yield, absolute panel/source photometry, universal60FPS, complete cloud lighting, or overall photoreal acceptance is claimed.'
]};
fs.writeFileSync(path.join(root,'verification/r10-source-evidence-manifest.json'),JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({entries:entries.length,currentRuntime:current,goalStatus:report.goalStatus}));
