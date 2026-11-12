import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const output='verification/navigation-night-manifest.json';
const names=new Set();
for(const name of await fs.readdir(root))if(/\.(?:js|mjs|ps1|html|css|json|cmd|md)$/.test(name))names.add(name);
for(const name of await fs.readdir(path.join(root,'verification'))){
  if(name.startsWith('navigation-night-')&&name!=='navigation-night-manifest.json')names.add('verification/'+name);
}
for(const name of ['NAVIGATION-NIGHT-VERIFY.md','CURRENT-HDR-SUMMARY.md','HDR-CALIBRATION.md','HDR-OUTPUT.md','NIGHT-SKY.md','DOF-VERIFY.md','VEGETATION-STABILITY-NOTES.md',
  'hdr-output-math-check.json','display-hdr-native.json','display-hdr-endpoint.json','camera-navigation-check.mjs','camera-navigation-check.json',
  'vegetation-motion-check.mjs','vegetation-motion-check.json','night-sky-math-check.mjs','night-sky-math-check.json','weather-math-check.json','weather-support-check.json',
  'quality-governor-check.json','dof-offline-check.json','dof-comparison.jpg','paused-difference.json','seal-navigation-night.mjs'])names.add('verification/'+name);
for(const name of await fs.readdir(path.join(root,'assets/night')))names.add('assets/night/'+name);

const files=[];
for(const name of [...names].sort()){
  const absolute=path.join(root,name),stat=await fs.stat(absolute);if(!stat.isFile())continue;
  const buffer=await fs.readFile(absolute);
  files.push({path:name,bytes:buffer.length,sha256:createHash('sha256').update(buffer).digest('hex')});
}
const documents=['README.md','verification/NAVIGATION-NIGHT-VERIFY.md','verification/CURRENT-HDR-SUMMARY.md','verification/NIGHT-SKY.md','verification/DOF-VERIFY.md'];
const broken=[];
for(const name of documents){
  const text=await fs.readFile(path.join(root,name),'utf8');
  for(const match of text.matchAll(/\]\(([^)]+)\)/g)){
    let target=match[1].replace(/^<|>$/g,'');if(/^(?:[a-z]+:|#)/i.test(target))continue;
    target=decodeURIComponent(target.split('#')[0]);if(!target||path.resolve(root,path.dirname(name),target)===path.join(root,output))continue;
    try{await fs.access(path.resolve(root,path.dirname(name),target));}catch{broken.push({document:name,target});}
  }
}
if(broken.length)throw new Error('Broken local documentation links: '+JSON.stringify(broken));
const checks={};
for(const [name,location]of Object.entries({finalGPU:'verification/navigation-night-final-gpu.json',hdrGPU:'verification/navigation-night-first-gpu.json',navigation:'verification/camera-navigation-check.json',console:'verification/navigation-night-final-console.json'}))checks[name]=JSON.parse(await fs.readFile(path.join(root,location),'utf8'));
const manifest={generatedAt:new Date().toISOString(),kind:'Current local source and bounded acceptance evidence seal',fileCount:files.length,files,documentationLinks:{checkedDocuments:documents,broken},
  acceptance:{spectrum:checks.finalGPU.spectrum.passed,vegetationMotion:checks.finalGPU.motion.passed,nightSky:checks.finalGPU.night.summary,navigation:checks.navigation.summary??{passed:checks.navigation.passed,total:checks.navigation.total},latestConsoleMessages:checks.console.current.length},
  limits:['Hashes and link checks do not rerun visual/GPU/performance acceptance.','Historical failures and intermediate captures are deliberately retained.','Read the acceptance report for tested conditions, timing and remaining visual limitations.']};
await fs.writeFile(path.join(root,output),JSON.stringify(manifest,null,2)+'\n','utf8');
console.log(JSON.stringify({file:output,files:files.length,brokenLinks:broken.length,acceptance:manifest.acceptance}));
