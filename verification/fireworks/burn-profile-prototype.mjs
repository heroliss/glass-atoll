// QA-only authored matter timing. Never imported by the application.
// A logical family keeps one budget through splits; RGB/I/tails are not matter.
export const PROFILE='logical-family-uniform-burn-QA-v1';
const bodyRoles=new Set(['aerial-root','aerial-child','ground-comet']);
const types=new Set(['peony','chrysanthemum','willow','palm','ring','heart','crossette','strobe','fan','bouquet']);
const sum=values=>values.reduce((a,b)=>a+b,0);
const finite=(v,label)=>{if(!Number.isFinite(v))throw RangeError(label+' must be finite');return v;};
const fraction=(v,label)=>{finite(v,label);if(v<0||v>1)throw RangeError(label+' must be in0..1');return v;};
const firstAge=id=>.1+.2*((Math.imul(id,2654435761)+1013904223)>>>0)/2**32;
function portions(total,weights){const scale=sum(weights);if(!(scale>0))throw RangeError('Positive allocation weights required');let assigned=0;return weights.map((w,i)=>{const m=i===weights.length-1?total-assigned:total*w/scale;assigned+=m;if(!(m>0))throw RangeError('Unrepresentable positive matter allocation');return m;});}
function bodyCells(node,mass,step){
  const ends=[],resolution=8*Number.EPSILON*Math.max(1,Math.abs(node.birth),Math.abs(node.endTime));
  if(resolution>1e-9)throw RangeError('Clock cannot represent causal quadrature cells');
  for(let end=Math.min(node.life,firstAge(node.bodyId)),i=0;i<32768;i++,end=Math.min(node.life,end+step)){ends.push(end);if(end===node.life)break;}
  if(ends.at(-1)!==node.life)throw RangeError('Per-body cell capacity exceeded');
  if(ends.length>1&&node.life-ends.at(-2)<=32*resolution){const start=ends.length>2?ends.at(-3):0;ends[ends.length-2]=(start+node.life)/2;}
  let previous=0,assigned=0;const masses=ends.map((end,i)=>{const width=(node.birth+end)-(node.birth+previous);if(!(width>32*resolution)||width>step+1e-8)throw RangeError('Cell cannot provide stable interior samples');const m=i===ends.length-1?mass-assigned:mass*(end-previous)/node.life;assigned+=m;previous=end;return m;});
  return {ends:Object.freeze(ends),masses:Object.freeze(masses)};
}
export function buildBurnProfile(graph,{centralFraction=.05,groundChargeFraction=.10,maxCellSeconds=.30,maxCells=32768}={}){
  if(!graph||!types.has(graph.type)||!Array.isArray(graph.nodes)||graph.nodes.length>4096)throw TypeError('Bounded actual combustion metadata required');
  fraction(centralFraction,'centralFraction');fraction(groundChargeFraction,'groundChargeFraction');
  if(maxCellSeconds!==.30)throw RangeError('Prototype retains the existing GL5 maximum .30s cell');
  if(!Number.isSafeInteger(maxCells)||maxCells<1||maxCells>65536)throw RangeError('Invalid QA cell capacity');
  const seen=new Map(),bodies=[],lifts=[],bursts=[];
  for(const n of graph.nodes){if(!n||typeof n.sourceID!=='string'||seen.has(n.sourceID))throw RangeError('Unique source IDs required');finite(n.birth,'birth');finite(n.life,'life');if(n.life<0||n.endTime!==n.birth+n.life)throw RangeError('Invalid source lifetime');if(n.parentSourceID&&!seen.has(n.parentSourceID))throw RangeError('Topological ancestry required');seen.set(n.sourceID,n);if(bodyRoles.has(n.role)){if(!(n.life>0)||!Number.isSafeInteger(n.bodyId)||n.bodyId<0)throw RangeError('Burn body lifetime/ID invalid');bodies.push(n);}else if(n.role==='lift')lifts.push(n);else if(n.role==='burst')bursts.push(n);else if(n.role!=='mortar-carrier')throw RangeError('Unknown logical role');}
  const ground=graph.type==='fan'||graph.type==='bouquet';if(ground!==graph.ground||lifts.length!==(graph.type==='fan'?9:1)||bursts.length!==(ground?0:1)||!bodies.length)throw RangeError('Current type clock/cardinality changed');
  const total=ground?(graph.type==='fan'?.9:2):20.35,launch=ground?total*groundChargeFraction:.35,central=ground?0:20*centralFraction,bodyMass=ground?total-launch:20-central;
  const streams=[];
  function trigger(node,mass,count){if(mass===0)return;streams.push(Object.freeze({sourceID:node.sourceID,eventId:graph.id,role:node.role,bodyId:null,mode:'trigger',birth:node.birth,mass,count,interval:.075,masses:Object.freeze(portions(mass,Array(count).fill(1)))}));}
  if(launch>0){const allocations=portions(launch,lifts.map(()=>1));lifts.forEach((n,i)=>trigger(n,allocations[i],9));}
  if(central>0)trigger(bursts[0],central,3);
  const families=new Map();for(const node of bodies){const family=families.get(node.familyID)||[];family.push(node);families.set(node.familyID,family);}
  const familyValues=[...families.values()],familyMasses=bodyMass>0?portions(bodyMass,familyValues.map(()=>1)):familyValues.map(()=>0);
  familyValues.forEach((nodes,index)=>{
    const byID=new Map(nodes.map(n=>[n.sourceID,n])),children=new Map(),shares=new Map();
    for(const n of nodes)if(byID.has(n.parentSourceID)){const a=children.get(n.parentSourceID)||[];a.push(n);children.set(n.parentSourceID,a);}
    for(const n of nodes){const parent=byID.get(n.parentSourceID);if(parent){if(Math.abs(n.birth-parent.endTime)>1e-10)throw RangeError('Only current end-of-parent split is supported');shares.set(n.sourceID,shares.get(parent.sourceID)/children.get(parent.sourceID).length);}else shares.set(n.sourceID,1);}
    if(nodes.filter(n=>!byID.has(n.parentSourceID)).length!==1)throw RangeError('Family must have exactly one root');
    if(familyMasses[index]===0)return;
    const allocations=portions(familyMasses[index],nodes.map(n=>shares.get(n.sourceID)*n.life));
    nodes.forEach((n,i)=>{const mass=allocations[i],cells=bodyCells(n,mass,maxCellSeconds);streams.push(Object.freeze({sourceID:n.sourceID,eventId:graph.id,role:n.role,bodyId:n.bodyId,parentBodyId:n.parentBodyId,familyID:n.familyID,pathShare:shares.get(n.sourceID),familyMass:familyMasses[index],mode:'burn',birth:n.birth,life:n.life,endTime:n.endTime,mass,count:cells.ends.length,...cells}));});
  });
  const cellCount=sum(streams.map(s=>s.count));if(cellCount>maxCells)throw RangeError('Complete event exceeds QA capacity; no source was truncated');
  return Object.freeze({schema:PROFILE,eventId:graph.id,type:graph.type,ground,streams:Object.freeze(streams),budget:Object.freeze({total,launch,central,bodies:bodyMass,centralFraction,groundChargeFraction}),cellCount,maximumBatchDelaySeconds:maxCellSeconds,
    scope:'all logical bodies; equal authored family budgets and equal child path shares, not measured yields; no carrier/engine smoke, render tails or shutter duplication',limits:'Not an app/source-provider integration or a CFD model; ground split and child weights are explicit author candidates. Existing transport/rendering remains unchanged.'});
}
export function burnCell(profile,stream,index){
  if(!Number.isSafeInteger(index)||index<0||index>=stream.count)throw RangeError('Invalid cell index');
  const end=stream.birth+(stream.mode==='burn'?stream.ends[index]:index*stream.interval),start=stream.mode==='burn'?stream.birth+(index?stream.ends[index-1]:0):end;
  return Object.freeze({key:JSON.stringify([profile.eventId,PROFILE,stream.sourceID,index]),eventId:profile.eventId,sourceID:stream.sourceID,bodyId:stream.bodyId,role:stream.role,index,kind:stream.mode,time:end,start,end,mass:stream.masses[index]});
}
export function createBurnCursor(profile){
  let next=profile.streams.map(()=>0),through=-Infinity,materialized=0,cancelled=0,revision=0,closed=false;const tokens=new WeakMap();
  const diagnostics=()=>({allocated:profile.budget.total,materialized,cancelled,reserved:sum(profile.streams.flatMap((s,i)=>s.masses.slice(next[i]))),closed,through:Number.isFinite(through)?through:null});
  return {diagnostics,
    prepare({throughTime,sampleCell=cell=>null}={}){finite(throughTime,'throughTime');if(closed||throughTime<through)throw RangeError('Closed/rewound source cursor');const proposed=[...next],cells=[];profile.streams.forEach((s,i)=>{while(proposed[i]<s.count){const c=burnCell(profile,s,proposed[i]);if(c.time>throughTime)break;cells.push(c);proposed[i]++;}});cells.sort((a,b)=>a.time-b.time||(a.key<b.key?-1:a.key>b.key?1:0));const samples=cells.map(c=>sampleCell(c,throughTime));const token=Object.freeze({cells:Object.freeze(cells),samples:Object.freeze(samples),readyMass:sum(cells.map(c=>c.mass)),throughTime});tokens.set(token,{proposed,revision});return token;},
    commit(token){const tx=tokens.get(token);if(!tx||tx.revision!==revision||closed)throw Error('Stale/foreign preparation');tokens.delete(token);next=tx.proposed;materialized+=token.readyMass;through=token.throughTime;revision++;return diagnostics();},
    clear(time){finite(time,'clear time');if(time<through)throw RangeError('Clear cannot rewind');if(!closed){cancelled+=diagnostics().reserved;next=profile.streams.map(s=>s.count);closed=true;through=time;revision++;}return diagnostics();}
  };
}
