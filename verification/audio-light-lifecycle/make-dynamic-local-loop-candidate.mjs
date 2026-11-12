import fs from 'node:fs';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';

const root = new URL('../../', import.meta.url);
const output = new URL('dynamic-local-loop/', import.meta.url);
fs.mkdirSync(output, {recursive: true});
const changes = [];
const sha = text => crypto.createHash('sha256').update(text).digest('hex');
const read = name => fs.readFileSync(new URL(name, root), 'utf8');

function replaceExactly(source, from, to, count, label) {
  assert.equal(source.split(from).length - 1, count, label);
  return source.split(from).join(to);
}

function localCandidate(source, diffuse) {
  source = replaceExactly(source,
    '  uniform vec4 uLocalPosition[${LOCAL_LIGHT_COUNT}]',
    '  uniform int uLocalSourceCount;\n  uniform vec4 uLocalPosition[${LOCAL_LIGHT_COUNT}]',
    1, 'shared GLSL declaration');
  source = replaceExactly(source,
    '  const uniforms={uLocalPosition:',
    '  const uniforms={uLocalSourceCount:{value:LOCAL_LIGHT_COUNT},uLocalPosition:',
    1, 'shared uniform initialization');
  source = replaceExactly(source,
    'for(int i=0;i<${LOCAL_LIGHT_COUNT};i++)',
    'for(int i=0;i<uLocalSourceCount;i++)',
    1, 'shared localIrradiance loop');
  source = replaceExactly(source,
    'for(int i=4;i<${LOCAL_LIGHT_COUNT};i++)',
    'for(int i=4;i<uLocalSourceCount;i++)',
    1, 'shared reactive activity loop');
  source = replaceExactly(source,
    'for(int localId=0;localId<${LOCAL_LIGHT_COUNT};localId++)',
    'for(int localId=0;localId<uLocalSourceCount;localId++)',
    1, 'thin leaf transmission loop');
  if (diffuse) source = replaceExactly(source,
    'for(int fireworkId=4;fireworkId<${LOCAL_LIGHT_COUNT};fireworkId++)',
    'for(int fireworkId=4;fireworkId<uLocalSourceCount;fireworkId++)',
    1, 'diffuse firework loop');
  source = replaceExactly(source,
    diffuse ? "+'-local-receiver-diffuse-only-v3-lights-chunk'" : "+'-local-receiver-response-v1'",
    diffuse ? "+'-local-receiver-diffuse-only-v3-lights-chunk-dynamic20'" : "+'-local-receiver-response-v1-dynamic20'",
    1, 'material program key');
  return source;
}

function write(inputName, outputName, source, candidate, description) {
  fs.writeFileSync(new URL(outputName, output), candidate);
  changes.push({input:inputName, output:outputName, sourceSHA256:sha(source), candidateSHA256:sha(candidate), description});
}

const local = read('local-lights.js');
write('local-lights.js', 'local-lights.js', local, localCandidate(local, false), 'Native 20 scene lights; only custom GLSL loop upper bounds become a uniform.');
const diffuse = fs.readFileSync(new URL('local-lights-diffuse-chunk-candidate.js', import.meta.url), 'utf8');
write('verification/audio-light-lifecycle/local-lights-diffuse-chunk-candidate.js', 'local-lights-diffuse-chunk.js', diffuse, localCandidate(diffuse, true), 'Prior diffuse-only candidate with four native scene lights; custom GLSL loop upper bounds become a uniform.');

let source = read('water.js');
write('water.js', 'water.js', source, replaceExactly(source,
  'for(int i=0;i<${LOCAL_LIGHT_COUNT};i++)',
  'for(int i=0;i<uLocalSourceCount;i++)',
  1, 'water seabed local lighting loop'), 'Only the local-source seabed loop bound changes; Newton and object loops stay unchanged.');

source = read('aerial-perspective.js');
write('aerial-perspective.js', 'aerial-perspective.js', source, replaceExactly(source,
  'for(int i=0;i<${LOCAL_LIGHT_COUNT};i++)',
  'for(int i=0;i<uLocalSourceCount;i++)',
  3, 'air source/activity/background loops'), 'The three local-source loops use the borrowed shared uniform; eight-cell integration stays unchanged.');

source = read('pyro-smoke-renderer.js');
let smoke = replaceExactly(source,
  "const localUniformNames=['uLocalPosition'",
  "const localUniformNames=['uLocalSourceCount','uLocalPosition'",
  1, 'borrowed smoke uniform name');
smoke = replaceExactly(smoke,
  '  const localDefaults={uLocalPosition:',
  '  const localDefaults={uLocalSourceCount:{value:LOCAL_LIGHT_COUNT},uLocalPosition:',
  1, 'smoke default source-count uniform');
smoke = replaceExactly(smoke,
  'for(int i=0;i<${LOCAL_LIGHT_COUNT};i++){vec3 L;',
  'for(int i=0;i<uLocalSourceCount;i++){vec3 L;',
  2, 'smoke fragment and resolved replacement seam');
write('pyro-smoke-renderer.js', 'pyro-smoke-renderer.js', source, smoke, 'Default smoke borrows count=20; resolved field still replaces the loop with exactly four ordinary local lights.');

const sharedRoutes = {
  '/water.js':fileURLToPath(new URL('water.js', output)),
  '/aerial-perspective.js':fileURLToPath(new URL('aerial-perspective.js', output)),
  '/pyro-smoke-renderer.js':fileURLToPath(new URL('pyro-smoke-renderer.js', output)),
};
const manifest = {
  schema:'glass-atoll.dynamic-local-loop-candidate.v1',
  routeResponseBodyOnly:true,
  productionChanged:false,
  fixedSourceSlots:20,
  fixedFireworkProxySlots:16,
  uniform:{name:'uLocalSourceCount',value:20},
  variants:{
    native20:{...sharedRoutes,'/local-lights.js':fileURLToPath(new URL('local-lights.js',output))},
    diffuse4:{...sharedRoutes,'/local-lights.js':fileURLToPath(new URL('local-lights-diffuse-chunk.js',output))},
  },
  files:changes,
  limits:[
    'Keep all ./ imports unchanged and route these response bodies at the original production module URLs.',
    'These are CPU-generated candidates only; no WebGL compilation, performance or pixel result is claimed.',
    'Uniform count stays 20; there is no activity-based shader permutation or reduction of the 16 receiver proxies.',
    'The diffuse4 variant has the prior intentional loss of native firework specular; native20 retains it.',
  ],
};
fs.writeFileSync(new URL('manifest.json',output),JSON.stringify(manifest,null,2));
console.log(JSON.stringify({output:output.href,files:changes.map(x=>x.output),variants:Object.keys(manifest.variants)},null,2));
