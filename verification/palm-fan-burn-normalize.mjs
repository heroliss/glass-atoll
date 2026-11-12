// QA-only exact optional palm/fan layer; composed before older ring/default guards.
export const palmFanAdapterEdits=Object.freeze([
  [
    "isolated optional profile planner",
    "// Optional native palm/fan source timing; all existing profiles bypass this block.\nconst PALM_FAN_BURN_PROFILE='palm-fan-uniform-burn-v1';\nfunction palmFanProfileInfo(d,p){const applies=d.type==='palm'||d.type==='fan';return{requested:PALM_FAN_BURN_PROFILE,effective:applies?PALM_FAN_BURN_PROFILE:'two-births',reason:applies?'native-'+d.type+'-burn-life':'palm-fan-not-applicable',...(p.cellIndex===undefined?{}:{cellIndex:p.cellIndex,rootLife:p.rootLife})};}\nfunction makePalmFanEntry(d,serial,areas,centralFraction,kernelModel,trajectorySlots){\n  const palm=d.type==='palm',expected=palm?12:9,minimum=palm?5.4:3.2,maximum=palm?6.4:3.8,maxRootCells=palm?22:14,maxEventPackets=palm?276:207;\n  if(d.ground===palm||d.roots.length!==expected)throw new RangeError('Palm/fan profile requires native12 palm or9 ground fan roots');\n  for(let i=0;i<d.roots.length;i++){const r=d.roots[i],birth=palm?d.burstTime:d.sourceEvents[i]?.time;if(r.id!==i||r.birth!==birth||r.life<minimum||r.life>maximum||r.birth+r.life>=d.endTime)throw new RangeError('Native palm/fan root clock/lifetime contract changed');}\n  const base=makeEntry(d,serial,areas,centralFraction,kernelModel,trajectorySlots,'two-births'),plans=[],rootMasses=new Map();\n  if(palm){for(const p of base.plans){if(p.component==='root')rootMasses.set(p.bodyId,p.mass);else plans.push(p);}if(rootMasses.size!==12)throw new RangeError('Palm profile must sample all12 native roots');}\n  else{\n    // Explicit authored redistribution: each existing.1 fan budget stays.1.\n    // Mouth10% + its moving comet90%; no fuel/RGB/audio-derived yield.\n    for(let si=0;si<d.sourceEvents.length;si++){const source=d.sourceEvents[si],area=areas.fanLaunchArea*.10;let assigned=0;const old=base.plans.filter(p=>p.component==='launch'&&p.source===source).sort((a,b)=>a.packetIndex-b.packetIndex);if(old.length!==9)throw new RangeError('Native fan launch packet contract changed');for(let i=0;i<old.length;i++){const mass=i===8?area-assigned:area/9;assigned+=mass;plans.push(Object.freeze({...old[i],mass,area}));}rootMasses.set(d.roots[si].id,areas.fanLaunchArea-area);}\n  }\n  for(const r of d.roots){const mass=rootMasses.get(r.id),first=.1+.2*((Math.imul(r.id,2654435761)+1013904223)>>>0)/2**32,resolution=8*Number.EPSILON*Math.max(1,Math.abs(r.birth),Math.abs(r.birth+r.life)),ages=[];if(!(mass>0)||resolution>1e-9)throw new RangeError('Palm/fan matter or clock precision is unsupported');\n    for(let k=0;k<maxRootCells;k++){const age=Math.min(r.life,first+k*.30);ages.push(age);if(age===r.life)break;}if(ages.at(-1)!==r.life)throw new RangeError('Palm/fan root cell capacity exceeded');\n    if(ages.length>1&&r.life-ages.at(-2)<=32*resolution){const start=ages.length>2?ages.at(-3):0;ages[ages.length-2]=(start+r.life)/2;}\n    let previous=0,assigned=0;for(let cellIndex=0;cellIndex<ages.length;cellIndex++){const endAge=ages[cellIndex],start=r.birth+previous,end=r.birth+endAge,width=end-start,m=cellIndex===ages.length-1?mass-assigned:mass*(endAge-previous)/r.life;if(!(width>32*resolution)||width>.30000001||!(m>0)||!Number.isFinite(m))throw new RangeError('Palm/fan causal cell is not representable');assigned+=m;plans.push(Object.freeze({key:JSON.stringify([d.id,PALM_FAN_BURN_PROFILE,'root',r.id,cellIndex]),eventId:d.id,time:end,component:'root',index:r.id,mass:m,sourceId:'ts-'+serial+'-root-'+r.id,bodyId:r.id,cellIndex,rootLife:r.life,segmentStart:start,segmentEnd:end}));previous=endAge;}\n  }\n  if(plans.length>maxEventPackets)throw new RangeError('Palm/fan complete event capacity exceeded; no source was truncated');plans.sort((a,b)=>a.time-b.time||textCompare(a.key,b.key));return{descriptor:d,plans:Object.freeze(plans),next:0,serial,lastBirth:plans.at(-1)?.time??d.time,allocated:sum(plans.map(p=>p.mass))};\n}\nconst TYPES=",
    "const TYPES="
  ],
  [
    "targeted entry dispatch only",
    "function makeEntry(d,serial,areas,centralFraction,kernelModel,trajectorySlots,emissionProfile){if(emissionProfile===PALM_FAN_BURN_PROFILE&&(d.type==='palm'||d.type==='fan'))return makePalmFanEntry(d,serial,areas,centralFraction,kernelModel,trajectorySlots);const plans=",
    "function makeEntry(d,serial,areas,centralFraction,kernelModel,trajectorySlots,emissionProfile){const plans="
  ],
  [
    "extended profile allow-list",
    "if(emissionProfile!=='two-births'&&emissionProfile!==RING_BURN_PROFILE&&emissionProfile!==PALM_FAN_BURN_PROFILE)throw new RangeError('emissionProfile must be two-births,ring-uniform-burn-v1 or palm-fan-uniform-burn-v1');",
    "if(emissionProfile!=='two-births'&&emissionProfile!==RING_BURN_PROFILE)throw new RangeError('emissionProfile must be two-births or ring-uniform-burn-v1');"
  ],
  [
    "candidate preflight only",
    "  if(emissionProfile===PALM_FAN_BURN_PROFILE&&(kernelModel!=='past-segment-v2'||trajectorySlots!==48||centralFraction!==.05||dispersionModel!=='taylor'||lagrangianSeconds!==10||burstArea!==20||launchArea!==.35||fanLaunchArea!==.1||bouquetLaunchArea!==2))throw new RangeError('Palm/fan burn requires native budgets, past-segment-v2/48/.05 and Taylor TL10');\n  if(emissionProfile===RING_BURN_PROFILE&&",
    "  if(emissionProfile===RING_BURN_PROFILE&&"
  ],
  [
    "per-event effective source diagnostic",
    "...(emissionProfile===PALM_FAN_BURN_PROFILE?{sourceProfile:palmFanProfileInfo(tx.ready[i].descriptor,p)}:(emissionProfile==='two-births'?{}:{sourceProfile:{requested:emissionProfile,effective:tx.ready[i].descriptor.type==='ring'?RING_BURN_PROFILE:'two-births',reason:tx.ready[i].descriptor.type==='ring'?'native-ring-burn-life':'non-ring-not-applicable',...(p.cellIndex===undefined?{}:{cellIndex:p.cellIndex,rootLife:p.rootLife})}}))",
    "...(emissionProfile==='two-births'?{}:{sourceProfile:{requested:emissionProfile,effective:tx.ready[i].descriptor.type==='ring'?RING_BURN_PROFILE:'two-births',reason:tx.ready[i].descriptor.type==='ring'?'native-ring-burn-life':'non-ring-not-applicable',...(p.cellIndex===undefined?{}:{cellIndex:p.cellIndex,rootLife:p.rootLife})}})"
  ],
  [
    "candidate-specific parameter diagnostics",
    "...(emissionProfile===PALM_FAN_BURN_PROFILE?{emissionProfile,palmFanBurn:{types:['palm','fan'],nativeRoots:{palm:12,fan:9},maximumEventPackets:{palm:276,fan:207},maximumCellSeconds:.30,fanMouthFraction:.10,fanCometFraction:.90,allocation:'authored redistribution within original budgets; not measured yield',otherTypes:'two-births unchanged; not applicable'}}:(emissionProfile==='two-births'?{}:{emissionProfile,ringBurn:{rootCount:120,representatives:48,maximumCellSeconds:.3,firstCellRange:[.1,.3],maximumEventPackets:684,otherTypes:'two-births unchanged; ring profile not applicable'}}))",
    "...(emissionProfile==='two-births'?{}:{emissionProfile,ringBurn:{rootCount:120,representatives:48,maximumCellSeconds:.3,firstCellRange:[.1,.3],maximumEventPackets:684,otherTypes:'two-births unchanged; ring profile not applicable'}})"
  ],
  [
    "candidate segment window diagnostic",
    "segmentWindows:emissionProfile===PALM_FAN_BURN_PROFILE?'palm/fan: deterministic first .1..3 then<=.3 through native root life; non-target types retain two windows':emissionProfile==='two-births'?",
    "segmentWindows:emissionProfile==='two-births'?"
  ],
  [
    "candidate packet capacity diagnostic",
    "emissionProfile===PALM_FAN_BURN_PROFILE?'palm<=276/fan<=207 causal cells; original event mass unchanged':emissionProfile===RING_BURN_PROFILE?'ring<=684 causal cells;",
    "emissionProfile===RING_BURN_PROFILE?'ring<=684 causal cells;"
  ],
  [
    "candidate applicability diagnostic",
    "emissionProfile===PALM_FAN_BURN_PROFILE?'native palm12/fan9 only, uniform authored root-life matter with<=.30s delay; no child/other-type extension':emissionProfile===RING_BURN_PROFILE?'ring-only uniform authored",
    "emissionProfile===RING_BURN_PROFILE?'ring-only uniform authored"
  ]
].map(e=>Object.freeze(e)));
export const palmFanHostEdits=Object.freeze([
  [
    "host profile allow-list",
    "if(emissionProfile!=='two-births'&&emissionProfile!=='ring-uniform-burn-v1'&&emissionProfile!=='palm-fan-uniform-burn-v1')throw new RangeError('emissionProfile must be two-births,ring-uniform-burn-v1 or palm-fan-uniform-burn-v1');",
    "if(emissionProfile!=='two-births'&&emissionProfile!=='ring-uniform-burn-v1')throw new RangeError('emissionProfile must be two-births or ring-uniform-burn-v1');"
  ]
].map(e=>Object.freeze(e)));
function undo(source,edits,{required=false}={}){if(!required&&!source.includes('PALM_FAN_BURN_PROFILE')&&!source.includes('palm-fan-uniform-burn-v1'))return source;let result=source;for(const [label,from,to]of edits){if(result.split(from).length!==2)throw Error('Palm/fan scope drift: '+label);result=result.replace(from,to);}return result;}
export const normalizePalmFanBurnAdapterSource=(s,o)=>undo(s,palmFanAdapterEdits,o);
export const normalizePalmFanBurnHostSource=(s,o)=>undo(s,palmFanHostEdits,o);
