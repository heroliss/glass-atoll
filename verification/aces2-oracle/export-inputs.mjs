// Capture actual authored profiles; no simulation, rendering, or source edits.
import fs from 'node:fs';
import crypto from 'node:crypto';
import {EMISSION_PROFILES} from '../../fireworks-physics.js';
const root=new URL('../../',import.meta.url),read=file=>fs.readFileSync(new URL(file,root)),sha=value=>crypto.createHash('sha256').update(value).digest('hex');
const files=['fireworks-physics.js','fireworks.js','fireworks-audio.js','hdr-output.js','lens.js','scene-radiometry.js'];
const sourceSHA256=Object.fromEntries(files.map(file=>[file,sha(read(file))]));
const report={schema:'glass-atoll.aces2-source-inputs.v1',dateUTC:new Date().toISOString(),sourceSHA256,profiles:Object.fromEntries(Object.entries(EMISSION_PROFILES).map(([name,value])=>[name,[...value]])),profileUnits:'authored positive linear-sRGB/D65, normalized to709 Y=1; approximate author spectra, not measured SPD',inputPolicy:'oracle takes already exposed scene-linear RGB; no new source intensity/camera gain/P factor',runtimeModified:false};
fs.writeFileSync(new URL('source-inputs.json',import.meta.url),JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({profiles:Object.keys(report.profiles),sourceSHA256},null,2));
