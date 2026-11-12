// QA ONLY. Historical feature/default compatibility comparisons use the exact
// authorized inverse, never a hand-maintained alternate emitter. Actual default
// ascent behavior is tested separately by ascent-envelope-runtime-check.mjs.
import fs from 'node:fs';
import assert from 'node:assert/strict';
import {normalizeAscentPhysicsSource,normalizeAscentFireworksSource} from './ascent-default-normalize.mjs';
const root=new URL('../../',import.meta.url),read=p=>fs.readFileSync(new URL(p,root),'utf8');
const physics=normalizeAscentPhysicsSource(read('fireworks-physics.js'));
assert.equal(physics,read('verification/baselines/fireworks-before-ascent-envelope/fireworks-physics.js'));
export const legacyAscentPhysicsURL='data:text/javascript;base64,'+Buffer.from(physics.replace("from './wind-response.js'",'from '+JSON.stringify(new URL('wind-response.js',root).href))).toString('base64');
export function legacyAscentFactorySource(source){return normalizeAscentFireworksSource(source).replace("from './fireworks-physics.js'",'from '+JSON.stringify(legacyAscentPhysicsURL));}
const source=read('fireworks.js'),normalized=normalizeAscentFireworksSource(source);
assert.equal(normalized,read('verification/baselines/fireworks-before-ascent-envelope/fireworks.js'));
const legacy=await import('data:text/javascript;base64,'+Buffer.from(legacyAscentFactorySource(source)).toString('base64'));
export const createFireworks=legacy.createFireworks;
export const describeFireworkCombustion=legacy.describeFireworkCombustion;
