// Explicit separate chronological wrapper; no production code is modified.
import fs from 'node:fs';import crypto from 'node:crypto';
const read=p=>fs.readFileSync(new URL(p,import.meta.url),'utf8'),write=(p,s)=>fs.writeFileSync(new URL(p,import.meta.url),s),sha=s=>crypto.createHash('sha256').update(s).digest('hex');
const candidate=read('./r28-complete-native-light-gpu-check.js');if(sha(candidate)!=='172cbe4568cf3df6a4962f3c2e4e90daa3dddac68541abb94a865237342b7f07')throw new Error('Frozen candidate helper drift');
const prior=JSON.parse(read('./r28-complete-native-light-pins.json')),promotion=JSON.parse(read('./r28-production-promotion-pins.json'));
const sources={
 '../pyro-smoke-light-field.js':promotion.source['pyro-smoke-light-field.js'].sha256,
 '../pyro-smoke-light-tiles.js':promotion.source['pyro-smoke-light-tiles.js'].sha256,
 '../pyro-smoke-light-native-state.js':promotion.source['pyro-smoke-light-native-state.js'].sha256,
 './r28-exact-light-field-candidate.js':prior.sources['./r28-exact-light-field-candidate.js'],
 './r28-exact-light-tiles-candidate.js':prior.sources['./r28-exact-light-tiles-candidate.js'],
 './r28-light-native-state.js':prior.sources['./r28-light-native-state.js'],
 './r28-complete-native-light-gpu-check.js':sha(candidate),
 './baselines/r28-before-native-light/pyro-smoke-light-field.js':prior.sources['../pyro-smoke-light-field.js'],
 './baselines/r28-before-native-light/pyro-smoke-light-tiles.js':prior.sources['../pyro-smoke-light-tiles.js'],
 '../pyro-smoke-light-bound.js':prior.sources['../pyro-smoke-light-bound.js'],
 '../smoke-transmission-rectangles.js':prior.sources['../smoke-transmission-rectangles.js'],
 './pyro-smoke-light-field-oracle.js':prior.sources['./pyro-smoke-light-field-oracle.js'],
 './r28-native-light-fixture.json':prior.sources['./r28-native-light-fixture.json'],
 './r28-native-light-fixture.mjs':prior.sources['./r28-native-light-fixture.mjs'],
 '../pyro-smoke.js':promotion.source['pyro-smoke.js'].sha256,
 '../pyro-smoke-renderer.js':promotion.source['pyro-smoke-renderer.js'].sha256,
 '../main.js':promotion.source['main.js'].sha256
};
for(const[p,pin]of Object.entries(sources))if(sha(read(p))!==pin)throw new Error('Promoted dependency drift: '+p);
const functions={...prior.functions,...promotion.functions};
const manifest={schema:'glass-atoll.r28-production-light-helper-pins.v1',sources,functions,artifactDigest:prior.artifactDigest,artifactSourceSHA256:prior.artifactSourceSHA256,candidateHelperSHA256:sha(candidate),constructor:{maxPackets:4096,maxSources:14000,maxBakePairs:1048576,maxRequestPairs:1400000,maxMapPairs:1000000,maxMapDraws:8,anisotropy:.32,bakeMode:'tiled64'},actualDrawCap:4};
let output=candidate.replace("// ROOT ONLY: complete owned native SH1 bake, three maps+one MRT3 reduction.","// ROOT ONLY: separately pinned DEPLOYED complete native SH1 bake; candidate remains frozen.")
 .replace("from './r28-exact-light-field-candidate.js'","from '../pyro-smoke-light-field.js'")
 .replace("from './r28-exact-light-tiles-candidate.js'","from '../pyro-smoke-light-tiles.js'")
 .replace("from './r28-light-native-state.js'","from '../pyro-smoke-light-native-state.js'")
 .replaceAll('R28_COMPLETE_NATIVE_LIGHT_GPU_REVISION','R28_PRODUCTION_NATIVE_LIGHT_GPU_REVISION')
 .replaceAll('runCompleteNativeLightGPUCheck','runProductionNativeLightGPUCheck')
 .replaceAll('r28-owned-native-sh1-v1','r28-production-native-sh1-v1')
 .replaceAll('glass-atoll.r28-owned-native-sh1-GPU.v1','glass-atoll.r28-production-native-sh1-GPU.v1')
 .replace(/const SOURCE_PINS=Object\.freeze\([^\n]+\);/,`const SOURCE_PINS=Object.freeze(${JSON.stringify(sources)});`)
 .replace(/const FUNCTION_PINS=Object\.freeze\([^\n]+\);/,`const FUNCTION_PINS=Object.freeze(${JSON.stringify(functions)});`);
write('./r28-production-native-light-gpu-check.js',output);write('./r28-production-native-light-pins.json',JSON.stringify(manifest,null,2)+'\n');console.log(JSON.stringify({helperSHA256:sha(output),manifestSHA256:sha(JSON.stringify(manifest,null,2)+'\n'),sources:Object.keys(sources).length},null,2));
