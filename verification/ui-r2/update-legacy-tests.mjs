import fs from 'node:fs';
const file=new URL('../fireworks/intensity-scale-check.mjs',import.meta.url);
let source=fs.readFileSync(file,'utf8');
const original="check('configure_only_changes_future_events_and_explicit_queued_scale_survives',()=>{const s=createFireworksSimulation(),";
if(!source.includes(original))throw new Error('Exact original queue test anchor missing');
source=source.replace(original,"check('configure_only_changes_future_events_and_explicit_queued_scale_survives',()=>{const s=createFireworksSimulation({launchPolicy:'legacy-queue',maxActive:2}),");
fs.writeFileSync(file,source);
