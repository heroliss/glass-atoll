// Checkpoint inventory. A hash seal is not visual acceptance or a GPU test.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {fileURLToPath} from 'node:url';
const root=fileURLToPath(new URL('../',import.meta.url)),verify=path.join(root,'verification');
const sha=p=>crypto.createHash('sha256').update(fs.readFileSync(path.join(root,p))).digest('hex');
const names=dir=>fs.readdirSync(path.join(root,dir),{withFileTypes:true}).filter(x=>x.isFile()).map(x=>dir?dir+'/'+x.name:x.name);
const runtime=names('').filter(p=>/\.(?:js|mjs|json|html)$/.test(p));
const helperNames=['adaptive-tail-scene-check.js','adaptive-tail-scene-performance.js','adaptive-tail-dense-scene-performance.js','adaptive-tail-high-count-scene.js','palm-fan-burn-scene-check.js','record-adaptive-tail-motion.js','record-adaptive-tail-motion-check.mjs','r9-tail-motion-media-check.mjs','r9-application-default-check.mjs','r9-aces2-pinned-output-gpu-check.js','r9-aces2-pinned-clone-check.mjs','r9-aces2-target-http-check.mjs','r9-radiance-default-buffer-gpu-check.js','r9-hdr-scene-presentation.js','aces2-generated-output-gpu-check.js','radiance-range-gpu-check.js','tail-optics-review.html','r9-source-evidence-manifest.mjs'];
const helpers=helperNames.map(p=>'verification/'+p).concat(names('verification/fireworks').filter(p=>/adaptive-tail|gaussian-streak/.test(p)&&/\.(?:js|mjs|py)$/.test(p)));
const docs=['README.md','verification/HDR-TAIL-R9-CHECKPOINT.md','verification/R9-REQUIREMENT-AUDIT-DRAFT.md','verification/ADAPTIVE-TAIL-SCENE-PERFORMANCE.md','verification/ADAPTIVE-TAIL-DENSE-SCENE-PERFORMANCE.md','verification/fireworks/ADAPTIVE-TAIL-CANDIDATE.md','verification/PLAYGROUND-ACCEPTANCE.md','verification/plans/PROGRESS.md'];
const artifacts=names('verification').filter(p=>/\/(?:r9-|pyro-r9-)/.test(p)&&/\.(?:json|png|mp4|webm|log)$/.test(p)&&!p.includes('source-evidence-manifest'));
const sources=[...new Set([...runtime,...helpers,...docs])].sort(),entries=list=>list.map(p=>({path:p,bytes:fs.statSync(path.join(root,p)).size,sha256:sha(p)}));
const f0c='f0c6251c3125a5aa3355b9f9a02907f1546aaffa9443ce1a1447ed027590bf03',endpoint='d28067d70690c0d9ca076735b57701e1c0c88b41cc15469ffcc3e4f036b95f9b',final='927b044a20fd6497ee052a84a70e73b4a1d4bfaf5193f6cde12943ba89db2a0d';
if(sha('fireworks.js')!==final)throw Error('Final optical source changed; review attribution before resealing');
if(sha('fireworks-audio.js')!=='4e5ede41813249f062e50b212553e5e1821c27feaead8416b68ab51ba1b8ec31')throw Error('Accepted audio source changed');
const captureVersions={
  'r9-adaptive-tail-gpu-fixed.json':{fireworks:f0c},
  'r9-adaptive-tail-scene.json':{fireworks:f0c},
  'r9-adaptive-tail-scene-performance.json':{fireworks:f0c},
  'r9-adaptive-tail-high-count-scene.json':{fireworks:f0c},
  'r9-palm-fan-source-scene-clean.json':{fireworks:f0c},
  'pyro-r9-tail-motion.json':{fireworks:f0c,kind:'Independent real recording before zero-weight dispatch optimization; no new927 recording claimed'},
  'r9-adaptive-tail-endpoint-gpu.json':{fireworks:endpoint,counts:'9/10 preserved failure, w1 optimization withdrawn'},
  'r9-adaptive-tail-zero-only-gpu.json':{fireworks:final,counts:'10/10; all nine frozen f0c float image comparisons bitexact'},
  'r9-adaptive-tail-dense-scene-performance.json':{fireworks:final,kind:'209 actual interleaved main-loop queries; one evolving event pair'},
  'r9-application-default-scene.json':{fireworks:final,main:sha('main.js'),kind:'Actual reload after single constructor choice; no QA cameraEV or smoke profile override'}
};
const report={schema:'glass-atoll.r9-source-evidence-manifest.v1',dateUTC:new Date().toISOString(),goalStatus:'active',classification:'progress-checkpoint-not-overall-photoreal-acceptance',sources:entries(sources),artifacts:entries(artifacts.sort()),captureVersions,limits:['Current file hashes are a provenance inventory, not proof every artifact was captured with final source bytes; explicit version mapping records the changing optical shader.','Original failed GPU, startup race, GL trace and old pinned-domain results remain separate unchanged reports.','A validated numerical/shader/encoding gate is not user acceptance, panel/source photometry, a guarantee of no flicker or60fps.','Production smoke remains point/.2/12/two-births; continuous Taylor source clips are explicit QA. Display transformation remains legacy by default.']};
fs.writeFileSync(path.join(verify,'r9-source-evidence-manifest.json'),JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({sources:report.sources.length,artifacts:report.artifacts.length,currentMain:sha('main.js'),currentFireworks:sha('fireworks.js'),goalStatus:report.goalStatus},null,2));
