// QA ONLY: exact inverse of the optional ring burn-life profile edits.
import {normalizePalmFanBurnAdapterSource} from './palm-fan-burn-normalize.mjs';
export const ringBurnAdapterEdits=Object.freeze([
  [
    "optional pure ring source schedule import",
    "import {parseSmokeDispersion} from './pyro-smoke-dispersion.js';\nimport {createRingBurnCells,RING_BURN_PROFILE} from './pyro-smoke-ring-burn.js';",
    "import {parseSmokeDispersion} from './pyro-smoke-dispersion.js';"
  ],
  [
    "profile argument in private material plan",
    "function makeEntry(d,serial,areas,centralFraction,kernelModel,trajectorySlots,emissionProfile){",
    "function makeEntry(d,serial,areas,centralFraction,kernelModel,trajectorySlots){"
  ],
  [
    "ring-only causal cells or byte-equivalent old root loop",
    "const roots=chooseRoots(d,trajectorySlots);if(emissionProfile===RING_BURN_PROFILE&&d.type==='ring'){const schedule=createRingBurnCells({descriptor:d,selected:roots,totalMass:trajectory});for(const cell of schedule.cells)add({time:cell.time},'root',cell.bodyId,cell.mass,{bodyId:cell.bodyId,cellIndex:cell.cellIndex,rootLife:cell.rootLife,segmentStart:cell.segmentStart,segmentEnd:cell.segmentEnd,key:JSON.stringify([d.id,RING_BURN_PROFILE,'root',cell.bodyId,cell.cellIndex]),sourceId:'ts-'+serial+'-root-'+cell.bodyId});}else{assigned=0;for(let i=0;i<roots.length;i++){const r=roots[i],mass=i===roots.length-1?trajectory-assigned:trajectory*r.represented/r.total;assigned+=mass;add({time:r.birth+r.age},'root',r.bodyId,mass,{bodyId:r.bodyId,...(kernelModel==='past-segment-v2'?{segmentStart:r.birth+(r.age===.35?.05:.35),segmentEnd:r.birth+r.age}:{})});}}}",
    "const roots=chooseRoots(d,trajectorySlots);assigned=0;for(let i=0;i<roots.length;i++){const r=roots[i],mass=i===roots.length-1?trajectory-assigned:trajectory*r.represented/r.total;assigned+=mass;add({time:r.birth+r.age},'root',r.bodyId,mass,{bodyId:r.bodyId,...(kernelModel==='past-segment-v2'?{segmentStart:r.birth+(r.age===.35?.05:.35),segmentEnd:r.birth+r.age}:{})});}}\r"
  ],
  [
    "optional source profile factory argument",
    "trajectorySlots=12,emissionProfile='two-births',dispersionModel='brownian',lagrangianSeconds=10,transport=SMOKE_SOURCE_TRANSPORT}",
    "trajectorySlots=12,dispersionModel='brownian',lagrangianSeconds=10,transport=SMOKE_SOURCE_TRANSPORT}"
  ],
  [
    "new profile preflight only",
    "  if(emissionProfile!=='two-births'&&emissionProfile!==RING_BURN_PROFILE)throw new RangeError('emissionProfile must be two-births or ring-uniform-burn-v1');\n  if(emissionProfile===RING_BURN_PROFILE&&(kernelModel!=='past-segment-v2'||trajectorySlots!==48||centralFraction!==.05||burstArea!==20||launchArea!==.35))throw new RangeError('Ring burn requires past-segment-v2,48 representatives,centralFraction.05 and unchanged20+.35 material budget');\n  if(trajectorySlots!==12&&trajectorySlots!==48)throw new RangeError('trajectorySlots must be12 or48');",
    "  if(trajectorySlots!==12&&trajectorySlots!==48)throw new RangeError('trajectorySlots must be12 or48');"
  ],
  [
    "profile forwarded into reservation",
    "entry=makeEntry(d,serial++,areas,centralFraction,kernelModel,trajectorySlots,emissionProfile);",
    "entry=makeEntry(d,serial++,areas,centralFraction,kernelModel,trajectorySlots);"
  ],
  [
    "explicit opt-in per-event profile diagnostics",
    "parameters:{...areas,centralFraction,...(emissionProfile==='two-births'?{}:{emissionProfile,ringBurn:{rootCount:120,representatives:48,maximumCellSeconds:.3,firstCellRange:[.1,.3],maximumEventPackets:684,otherTypes:'two-births unchanged; ring profile not applicable'}}),",
    "parameters:{...areas,centralFraction,"
  ],
  [
    "explicit per-event opt-in applicability only",
    "mass:e.mass,position:[...e.mean],...(emissionProfile==='two-births'?{}:{sourceProfile:{requested:emissionProfile,effective:tx.ready[i].descriptor.type==='ring'?RING_BURN_PROFILE:'two-births',reason:tx.ready[i].descriptor.type==='ring'?'native-ring-burn-life':'non-ring-not-applicable',...(p.cellIndex===undefined?{}:{cellIndex:p.cellIndex,rootLife:p.rootLife})}}),...(e.dispersionQ",
    "mass:e.mass,position:[...e.mean],...(e.dispersionQ"
  ],
  [
    "truthful dynamic-profile segment windows",
    "segmentWindows:emissionProfile==='two-births'?[[.05,.35],[.35,.65]]:'ring: deterministic first .1..3 then<=.3 through root life; other types retain two windows',futureCovarianceCrossTermsDiscarded:true",
    "segmentWindows:[[.05,.35],[.35,.65]],futureCovarianceCrossTermsDiscarded:true"
  ],
  [
    "truthful dynamic profile release clocks",
    "trajectorySlots,releaseAges:emissionProfile==='two-births'?[.35,.65]:null,centrePackets:3",
    "trajectorySlots,releaseAges:[.35,.65],centrePackets:3"
  ],
  [
    "truthful opt-in packet limits",
    "emissionProfile===RING_BURN_PROFILE?'ring<=684 causal cells; other types retain two-births; fan81/bouquet9':trajectorySlots===12?'3centre+12root+9launch=24 aerial kernels; fan retains81 and bouquet9':'3centre+48root+9launch=60 aerial kernels when roots>=48; fewer roots cap selected count; fan retains81 and bouquet9'",
    "trajectorySlots===12?'3centre+12root+9launch=24 aerial kernels; fan retains81 and bouquet9':'3centre+48root+9launch=60 aerial kernels when roots>=48; fewer roots cap selected count; fan retains81 and bouquet9'"
  ],
  [
    "truthful authored rate limit",
    "emissionProfile===RING_BURN_PROFILE?'ring-only uniform authored root-life material with<=.30s causal batch delay; no chemistry/child/ground extension':'root-only sparse deposition0.35/0.65s; no child/long-burn continuous source solve'",
    "'root-only sparse deposition0.35/0.65s; no child/long-burn continuous source solve'"
  ]
].map(e=>Object.freeze(e)));
export function normalizeRingBurnAdapterSource(source){if(typeof source!=='string')throw new TypeError('Source text required');let result=normalizePalmFanBurnAdapterSource(source);for(const [label,from,to]of ringBurnAdapterEdits){const count=result.split(from).length-1;if(count!==1)throw new Error('Ring burn adapter scope drift: '+label+' count '+count);result=result.replace(from,to);}return result;}
