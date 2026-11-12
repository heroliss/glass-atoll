import {strict as assert} from 'node:assert';
import fs from 'node:fs';
import crypto from 'node:crypto';
import * as current from '../../fireworks-physics.js';
import * as baseline from '../baselines/b4-production-20261027-040831/fireworks-physics.js';
import * as denseBaseline from '../baselines/fireworks-before-smiley-layouts-8c147ee/fireworks-physics.js';
const {FIREWORK_TYPES,EMISSION_PROFILES,createFireworkEvent,sampleBody,sampleFireworkEvent,createFireworksSimulation}=current;
const checks=[],check=(name,fn)=>{try{checks.push({name,passed:true,evidence:fn()});}catch(error){checks.push({name,passed:false,error:error.stack});}};
const near=(a,b,t=1e-9)=>assert(Math.abs(a-b)<=t,`${a} vs ${b}; tolerance${t}`),dot=(a,b)=>a.reduce((s,x,i)=>s+x*b[i],0),sub=(a,b)=>a.map((x,i)=>x-b[i]),distance=(a,b)=>Math.hypot(...sub(a,b));
const groups={90:['peony','ring','crossette'],120:['chrysanthemum','heart','strobe'],150:['willow','palm']},expectedHeights={90:120,120:160,150:190};
const metrics={heightCases:[],groundCases:[],projectedAreaRatios:[],layouts:[]};
check('ten_ids_preserved_ring_request_explicitly_identifies_smiley',()=>{
  assert.deepEqual(FIREWORK_TYPES.map(d=>d.id),['peony','chrysanthemum','willow','palm','ring','heart','crossette','strobe','fan','bouquet']);
  const d=FIREWORK_TYPES.find(d=>d.id==='ring'),e=createFireworkEvent({type:'ring'});assert.equal(d.label,'笑脸');assert.equal(d.pattern,'smiley');assert.equal(e.type,'ring');assert.equal(e.pattern,'smiley');
  assert.equal(e.patternFrame.kind,'fixed-world-plane-from-launch-azimuth');assert(Object.isFrozen(e.patternFrame.normal));
});
check('three_supplier_profiles_separate_height_reference_from_uncalibrated_width',()=>{
  for(const [calibre,types]of Object.entries(groups))for(const type of types){const d=FIREWORK_TYPES.find(d=>d.id===type);assert.equal(d.calibreMm,+calibre);assert.equal(d.height,expectedHeights[calibre]);assert.equal(d.heightMeaning,'reference-rise-above-launch-at80deg');assert.equal(d.heightReference.riseMetres,d.height);assert.equal(d.heightReference.widthCalibrated,false);assert(d.heightReference.source.startsWith('https://'));}
});
for(const type of Object.values(groups).flat())check(`${type}_default_is_rise_above_launch_and_explicit_height_remains_worldY`,()=>{
  const d=FIREWORK_TYPES.find(d=>d.id===type);
  for(const y of [0,.7,7.25]){
    const a=createFireworkEvent({type,origin:[4,y,-2],elevation:80,seed:11}),b=createFireworkEvent({type,origin:[4,y,-2],height:132.25,elevation:80,seed:11});
    near(a.burstPosition[1]-y,d.height,2e-9);near(a.heightInfo.actualBurstRiseMetres,d.height,2e-9);assert.equal(a.heightInfo.inputMode,'definition-rise');assert.equal(a.heightInfo.explicitWorldHeight,null);
    near(b.burstPosition[1],132.25,2e-9);assert.equal(b.heightInfo.inputMode,'explicit-worldY');near(b.heightInfo.calibratedRiseMetres,132.25-y);assert.equal(b.heightInfo.explicitWorldHeight,132.25);
    metrics.heightCases.push({type,calibreMm:a.calibreMm,originY:y,defaultBurstY:a.burstPosition[1],defaultRise:a.heightInfo.actualBurstRiseMetres,explicitWorldY:b.burstPosition[1]});
  }
});
check('all_air_types_keep_muzzle_energy_fixed_over25_80_90degrees',()=>{
  for(const type of Object.values(groups).flat()){
    const e=[25,80,90].map(elevation=>createFireworkEvent({type,elevation,seed:88})),speed=e.map(x=>Math.hypot(...x.rocket.velocity));near(speed[0],speed[1]);near(speed[2],speed[1]);
    assert(e[0].burstPosition[1]<e[1].burstPosition[1]);assert(e[2].burstPosition[1]>e[1].burstPosition[1]);
  }
});
// Explicit dense retains the original144-star causal geometry tests even now
// that the selected production default is reference120. Defaults are tested below.
const smile=createFireworkEvent({type:'ring',azimuth:23,elevation:80,seed:42,smileyLayout:'dense'}),parts={};for(const p of smile.heads)(parts[p.patternPart]??=[]).push(p);
const basis=smile.patternFrame,point=b=>{const v=sub(b.velocity,smile.baselineBurst.velocity);return[dot(v,basis.right),dot(v,basis.up),dot(v,basis.normal)];};
check('144_stars_have72_outline12_each_eye48_mouth_and_one_drag',()=>{
  assert.equal(smile.heads.length,144);for(const [part,n]of Object.entries({outline:72,'left-eye':12,'right-eye':12,mouth:48}))assert.equal(parts[part].length,n);
  assert(smile.heads.every(p=>p.drag===.16&&!p.trail));assert(smile.heads.every(b=>Math.abs(point(b)[2])<2e-14));
});
check('smiley_outline_is_closed_circle_and_features_lie_inside_above_below_correctly',()=>{
  const outline=parts.outline.map(point),left=parts['left-eye'].map(point),right=parts['right-eye'].map(point),mouth=parts.mouth.map(point);
  for(const q of outline)near(Math.hypot(q[0],q[1]),21,1e-12);
  for(const p of [...left,...right,...mouth])assert(Math.hypot(p[0],p[1])<21*.85);
  assert(left.every(q=>q[0]<0&&q[1]>0));assert(right.every(q=>q[0]>0&&q[1]>0));assert(mouth.every(q=>q[1]<0));
  near(left.reduce((s,p)=>s+p[0],0)/left.length,-right.reduce((s,p)=>s+p[0],0)/right.length,1e-12);
  assert(mouth[Math.floor(mouth.length/2)][1]<mouth[0][1]);near(mouth[0][1],mouth.at(-1)[1],1e-12);
});
check('mouth_equal_chords_and_constant_curvature_prove_uniform_circular_arc_length',()=>{
  const m=parts.mouth.map(point),lengths=m.slice(1).map((p,i)=>distance(p,m[i])),mean=lengths.reduce((s,x)=>s+x,0)/lengths.length;
  const curvature=[];for(let i=1;i<m.length-1;i++){
    const a=m[i-1],b=m[i],c=m[i+1],cross=Math.abs((b[0]-a[0])*(c[1]-a[1])-(b[1]-a[1])*(c[0]-a[0]));
    curvature.push(2*cross/(distance(a,b)*distance(b,c)*distance(a,c)));
  }
  const spread=(Math.max(...lengths)-Math.min(...lengths))/mean;assert(spread<1e-12);
  assert(Math.max(...curvature)-Math.min(...curvature)<1e-12);near(curvature[0],1/(.54*21),1e-12);
  return{maximumRelativeChordSpread:spread,curvatureMean:curvature.reduce((s,x)=>s+x,0)/curvature.length};
});
check('default_two_tone_is_authored_yellow_outline_green_features',()=>{
  assert.equal(smile.paletteMode,'yellow-outline-green-features');for(const b of smile.heads)assert.deepEqual(b.colour,EMISSION_PROFILES[b.patternPart==='outline'?'yellow':'green']);
});
check('every_explicit_palette_is_single_colour_without_changing_particle_kinematics',()=>{
  for(const palette of Object.keys(EMISSION_PROFILES)){
    const e=createFireworkEvent({type:'ring',azimuth:23,elevation:80,seed:42,palette,smileyLayout:'dense'});assert.equal(e.paletteMode,'single-colour');
    for(let i=0;i<144;i++){assert.deepEqual(e.heads[i].colour,EMISSION_PROFILES[palette]);assert.deepEqual(e.heads[i].velocity,smile.heads[i].velocity);assert.equal(e.heads[i].intensity,smile.heads[i].intensity);assert.equal(e.heads[i].life,smile.heads[i].life);}
  }
});
check('colour_part_change_does_not_duplicate_authored_photopic_source_intensity',()=>{
  const coloured=smile.heads.reduce((s,b)=>s+b.intensity*dot(b.colour,[.2126,.7152,.0722]),0),I=smile.heads.reduce((s,b)=>s+b.intensity,0);near(coloured,I,1e-10);
  return{sumAuthoredCandela:I,sumPhotopicColourWeighted:coloured,calibratedAbsolutePhotometry:false};
});
check('new_smiley_retains_B4_rng_intensity_radius_life_and144_budget',()=>{
  const old=baseline.createFireworkEvent({type:'ring',height:120.5,origin:[29,.5,7],azimuth:23,elevation:80,seed:42,palette:'yellow'});
  for(let i=0;i<144;i++)for(const k of ['intensity','radius','life','seed','drag'])assert.equal(smile.heads[i][k],old.heads[i][k]);
});
check('other_air_morphologies_are_B4_bitwise_identical_at_the_same_explicit_height',()=>{
  for(const type of Object.values(groups).flat().filter(x=>x!=='ring')){
    const options={type,height:180.25,origin:[3,5.25,-2],seed:811,elevation:80},a=createFireworkEvent(options),b=baseline.createFireworkEvent(options);
    assert.deepEqual(a.heads,b.heads);assert.deepEqual(a.rocket,b.rocket);assert.deepEqual(a.burstPosition,b.burstPosition);
  }
});
check('ground_fan_and_bouquet_heads_remain_B4_bitwise_identical_at_all_angles',()=>{
  for(const type of ['fan','bouquet'])for(const seed of [1,11,987])for(const elevation of [25,80,90]){
    const options={type,seed,elevation,origin:[3,.7,4]},a=createFireworkEvent(options),b=baseline.createFireworkEvent(options);
    assert.deepEqual(a.heads,b.heads);assert.equal(a.burstTime,0);near(a.burstPosition[1],.7);assert.equal(a.rocket,null);assert.equal(a.calibreMm,null);assert.equal(a.heightInfo.inputMode,'fixed-ground-kinematics');assert.equal(a.definition.heightMeaning,'nominal-visible-apex-above-launch');
  }
});
// Independent numerical integration of dy/dt=v, dv/dt=-g-kv; no production
// flightSegment/apex helper is used to check the reported per-star apex.
function numericApex(b){let y=b.position[1],v=b.velocity[1],peak=y;const n=Math.ceil(b.life/.002),dt=b.life/n,k=b.drag??.2,g=b.gravity??9.81;
  for(let i=0;i<n;i++){const a=-g-k*v,bv=v+a*dt*.5,ba=-g-k*bv,cv=v+ba*dt*.5,ca=-g-k*cv,dv=v+ca*dt,da=-g-k*dv;y+=dt/6*(v+2*bv+2*cv+dv);v+=dt/6*(a+2*ba+2*ca+da);peak=Math.max(peak,y);}return peak;
}
check('ground_apex_metadata_matches_independent_RK4_and_is_not_burst_height',()=>{
  let maxError=0;for(const type of ['fan','bouquet'])for(const seed of [1,11])for(const elevation of [25,80,90]){
    const e=createFireworkEvent({type,origin:[0,.7,0],seed,elevation}),apices=e.heads.map(numericApex),m=e.heightInfo.visibleApex;
    const error=Math.max(Math.abs(Math.max(...apices)-m.maximumWorldY),Math.abs(Math.min(...apices)-.7-m.minimumRiseMetres));maxError=Math.max(maxError,error);assert(error<1e-5);assert.equal(m.heightIsBurst,false);
    metrics.groundCases.push({type,seed,elevation,burstWorldY:e.burstPosition[1],minimumRise:m.minimumRiseMetres,maximumRise:m.maximumRiseMetres,numericMaximumWorldY:Math.max(...apices)});
  }return{maximumMetresError:maxError};
});
function polygonArea(points){const sorted=points.map(p=>[...p]).sort((a,b)=>a[0]-b[0]||a[1]-b[1]),cross=(o,a,b)=>(a[0]-o[0])*(b[1]-o[1])-(a[1]-o[1])*(b[0]-o[0]);
  const h=[];for(const p of sorted){while(h.length>1&&cross(h.at(-2),h.at(-1),p)<=0)h.pop();h.push(p);}const lower=h.length;for(let i=sorted.length-2;i>=0;i--){const p=sorted[i];while(h.length>lower&&cross(h.at(-2),h.at(-1),p)<=0)h.pop();h.push(p);}h.pop();return Math.abs(h.reduce((s,p,i)=>s+p[0]*h[(i+1)%h.length][1]-p[1]*h[(i+1)%h.length][0],0))*.5;
}
check('world_plane_side_views_follow_cosine_compression_not_billboard',()=>{
  for(const azimuth of [0,23,119,281]){
    const e=createFireworkEvent({type:'ring',azimuth,seed:8}),f=e.patternFrame,vs=e.heads.map(b=>sub(b.velocity,e.baselineBurst.velocity)),base=polygonArea(vs.map(v=>[dot(v,f.right),dot(v,f.up)]));
    for(const degrees of [0,30,60,85,180]){const t=degrees*Math.PI/180,right=f.right.map((x,i)=>x*Math.cos(t)-f.normal[i]*Math.sin(t)),area=polygonArea(vs.map(v=>[dot(v,right),dot(v,f.up)])),ratio=area/base;near(ratio,Math.abs(Math.cos(t)),2e-14);metrics.projectedAreaRatios.push({azimuth,viewAngle:degrees,ratio});}
  }
});
check('shared_piecewise_wind_preserves_the_same_world_plane_up_to_common_translation',()=>{
  const e=createFireworkEvent({type:'ring',azimuth:61,seed:18}),timeline=[{time:-Infinity,wind:[2,0,1]},{time:e.burstTime+.3,wind:[-5,.2,3]}];
  const particles=sampleFireworkEvent(e,e.burstTime+1.4,{windTimeline:timeline,smoke:false}),mean=particles[0].position.map((_,i)=>particles.reduce((s,p)=>s+p.position[i],0)/particles.length);
  assert.equal(e.smileyLayout,'reference');assert.equal(particles.length,120);assert(particles.every(p=>Math.abs(dot(sub(p.position,mean),e.patternFrame.normal))<2e-12));
  near(e.heightInfo.actualBurstWorldY,e.burstPosition[1]);near(e.heightInfo.actualBurstRiseMetres,e.burstPosition[1]-e.origin[1]);
});
check('smiley_physical_state_is_30_60_120Hz_invariant',()=>{
  const a=[];for(const fps of [30,60,120]){const s=createFireworksSimulation({seed:781});s.update({time:0,windVector:[2,0,.5]});s.launch({type:'ring'});for(let i=1;i<=fps*6;i++)s.update({time:i/fps,windVector:[2,0,.5]});a.push(s.particles({smoke:false}).map(p=>({position:p.position,colour:p.colour,emission:p.emission})));}
  assert.deepEqual(a[0],a[1]);assert.deepEqual(a[0],a[2]);
});
check('public_active_event_diagnostics_report_pattern_height_mode_and_reference',()=>{
  const s=createFireworksSimulation({origin:[0,7.25,0]});s.launch({type:'ring'});const d=s.state.activeEvents[0];assert.equal(d.pattern,'smiley');assert.equal(d.calibreMm,90);assert.equal(d.heightInfo.inputMode,'definition-rise');near(d.heightInfo.actualBurstWorldY,127.25);assert.equal(d.heightInfo.productReference.widthCalibrated,false);
});
const layouts=['dense','spaced-mouth','compact-eyes','reference'],layoutCount={dense:144,'spaced-mouth':120,'compact-eyes':144,reference:120};
const sameOldFields=(a,b,{allowRingDefaultCountMetadata=false}={})=>{for(const key of Object.keys(b)){
  if(key==='definition'&&allowRingDefaultCountMetadata){
    assert.equal(a.type,'ring');assert.equal(b.type,'ring');assert.equal(a.definition.count,120);assert.equal(b.definition.count,144);
    const {count:countA,...restA}=a.definition,{count:countB,...restB}=b.definition;assert.deepEqual(restA,restB,'all definition metadata except intentional default count120 vs144');
  }else assert.deepEqual(a[key],b[key],key);
}};
const layoutEvent=(layout,extra={})=>createFireworkEvent({type:'ring',origin:[3,7.25,-2],azimuth:23,elevation:80,seed:42,smileyLayout:layout,...extra});
const localPoint=(e,b)=>{const v=sub(b.velocity,e.baselineBurst.velocity);return[dot(v,e.patternFrame.right),dot(v,e.patternFrame.up),dot(v,e.patternFrame.normal)];};
check('explicit_dense_matches_all_8c_fields_except_declared_default_count_metadata',()=>{
  assert.deepEqual(current.SMILEY_LAYOUTS,layouts);
  for(const seed of [0,1,42,4294967295])for(const azimuth of [0,23,119,281])for(const elevation of [25,80,90])for(const palette of [undefined,'yellow','blue']){
    const options={type:'ring',origin:[3,7.25,-2],time:1.125,seed,azimuth,elevation,palette},old=denseBaseline.createFireworkEvent(options),dense=createFireworkEvent({...options,smileyLayout:'dense'}),defaultEvent=createFireworkEvent(options),reference=createFireworkEvent({...options,smileyLayout:'reference'});
    sameOldFields(dense,old,{allowRingDefaultCountMetadata:true});assert.equal(dense.smileyLayout,'dense');assert.equal(dense.actualStarCount,144);assert.deepEqual(defaultEvent,reference);assert.equal(defaultEvent.actualStarCount,120);
  }return{cases:4*4*3*3,comparison:'strict equality of all pre-A2 event fields/body inputs/endTime except exactly definition.count144 to120; default event strictly equals explicit reference120'};
});
check('other_nine_types_and_ground_ignore_layout_and_preserve_all_8c_fields',()=>{
  for(const type of FIREWORK_TYPES.map(x=>x.id).filter(x=>x!=='ring'))for(const smileyLayout of layouts)for(const seed of [1,17,811]){
    const options={type,origin:[3,7.25,-2],azimuth:119,elevation:80,seed},a=createFireworkEvent({...options,smileyLayout}),b=denseBaseline.createFireworkEvent(options);sameOldFields(a,b);assert.equal(a.smileyLayout,null);assert.equal(a.actualStarCount,a.heads.length);
  }return{cases:9*4*3,groundPhysicsUnchanged:true};
});
check('layout_default_and_invalid_input_select_reference_without_mutating_existing_event',()=>{
  for(const value of [undefined,null,'unknown',0,{},['reference']]){const a=layoutEvent(value),b=layoutEvent('reference');assert.deepEqual(a,b);}
  const s=createFireworksSimulation();assert.equal(s.settings.smileyLayout,'reference');s.launch({type:'ring'});const first=s.active[0];assert.equal(first.smileyLayout,'reference');assert.equal(first.heads.length,120);s.configure({smileyLayout:'compact-eyes'});assert.equal(first.smileyLayout,'reference');assert.equal(first.heads.length,120);assert.equal(s.configure({smileyLayout:'bad'}).smileyLayout,'reference');
});
check('four_layouts_preserve72_12_12_features_and_only_reduce_mouth_to24',()=>{
  for(const layout of layouts){const e=layoutEvent(layout),partCounts={};for(const b of e.heads)partCounts[b.patternPart]=(partCounts[b.patternPart]||0)+1;
    assert.deepEqual(partCounts,{outline:72,'left-eye':12,'right-eye':12,mouth:layoutCount[layout]-96});assert.equal(e.actualStarCount,layoutCount[layout]);assert.equal(e.definition.count,120);assert.equal(e.smileyLayout,layout);assert(e.heads.every(b=>b.drag===.16&&!b.trail));
    assert(e.heads.every(b=>Math.abs(localPoint(e,b)[2])<2e-14));
  }
});
check('retained_stars_keep_original_RNG_lifetime_radius_intensity_seed_and_birth',()=>{
  for(const seed of [0,1,42,811]){const dense=layoutEvent('dense',{seed});for(const layout of layouts){const e=layoutEvent(layout,{seed});
    for(let i=0;i<e.heads.length;i++)for(const field of ['id','event','birth','life','radius','intensity','seed','drag','trail','colour','basePosition'])assert.deepEqual(e.heads[i][field],dense.heads[i][field],`${layout}/${i}/${field}`);
    assert.deepEqual(e.rocket,dense.rocket);assert.equal(e.burstTime,dense.burstTime);assert.equal(e.endTime,dense.endTime);assert.deepEqual(e.patternFrame,dense.patternFrame);
  }}
});
check('outline_geometry_and_non_target_features_are_identical_for_causal_AB',()=>{
  const events=Object.fromEntries(layouts.map(l=>[l,layoutEvent(l)]));
  for(const layout of layouts)for(let i=0;i<72;i++)assert.deepEqual(events[layout].heads[i],events.dense.heads[i]);
  for(let i=72;i<96;i++){assert.deepEqual(events['spaced-mouth'].heads[i],events.dense.heads[i]);assert.deepEqual(events.reference.heads[i],events['compact-eyes'].heads[i]);}
  for(let i=96;i<144;i++)assert.deepEqual(events['compact-eyes'].heads[i],events.dense.heads[i]);
  for(let i=96;i<120;i++)assert.deepEqual(events.reference.heads[i],events['spaced-mouth'].heads[i]);
});
check('filled_eyes_sample_equal_area_radial_quantiles_with_fixed_original_support',()=>{
  const e=layoutEvent('compact-eyes');for(const part of ['left-eye','right-eye']){
    const centre=[part==='left-eye'?-.34*21:.34*21,.32*21],points=e.heads.filter(b=>b.patternPart===part).map(b=>localPoint(e,b).map((v,i)=>v-(centre[i]??0))),r2=points.map(p=>(p[0]*p[0]+p[1]*p[1])/(.105*21)**2);
    for(let j=0;j<12;j++)near(r2[j],j/11,3e-15);near(r2.reduce((s,v)=>s+v,0)/12,.5,1e-15);near(Math.max(...r2),1,3e-15);
    assert.equal(points.filter(p=>Math.hypot(p[0],p[1])<1e-12).length,1);
    for(let j=2;j<12;j++){const a=points[j-1],b=points[j],angle=Math.atan2(a[0]*b[1]-a[1]*b[0],a[0]*b[0]+a[1]*b[1]);near(angle,Math.PI*(3-Math.sqrt(5)),4e-15);}
  }return{starsPerEye:12,supportRadiusVelocityMetresPerSecond:.105*21,meanNormalisedRadiusSquared:.5,method:'deterministic golden-angle; equal-area radial quantiles including0 and1; no new RNG'};
});
check('both_mouth_counts_keep_the_same_complete_U_arc_and_equal_arc_spacing',()=>{
  for(const layout of layouts){const e=layoutEvent(layout),m=e.heads.filter(b=>b.patternPart==='mouth').map(b=>localPoint(e,b)),r=.54*21;
    near(m[0][0],-r);near(m.at(-1)[0],r);near(m[0][1],-.10*21);near(m.at(-1)[1],-.10*21);
    const chords=m.slice(1).map((p,i)=>distance(p,m[i]));for(const chord of chords)near(chord,2*r*Math.sin(Math.PI/(2*(m.length-1))),4e-14);
    for(const p of m)near(Math.hypot(p[0],p[1]+.10*21),r,4e-14);
    metrics.layouts.push({layout,actualStarCount:e.actualStarCount,mouthStars:m.length,mouthAdjacentChordVelocityMetresPerSecond:chords[0],sumAuthoredCandela:e.heads.reduce((s,b)=>s+b.intensity,0),eyeLayout:layout==='compact-eyes'||layout==='reference'?'filled':'circle'});
  }
});
check('each_layout_respects_every_explicit_single_colour_palette_without_motion_change',()=>{
  for(const layout of layouts){const e=layoutEvent(layout);for(const palette of Object.keys(EMISSION_PROFILES)){const mono=layoutEvent(layout,{palette});assert.equal(mono.paletteMode,'single-colour');for(let i=0;i<e.heads.length;i++){assert.deepEqual(mono.heads[i].colour,EMISSION_PROFILES[palette]);assert.deepEqual(mono.heads[i].velocity,e.heads[i].velocity);for(const k of ['life','intensity','radius','seed'])assert.equal(mono.heads[i][k],e.heads[i][k]);}}}
});
check('reduced_mouth_removes_exactly_24_authored_sources_without_makeup_gain',()=>{
  for(const seed of [1,42,811]){const dense=layoutEvent('dense',{seed}),reference=layoutEvent('reference',{seed}),spaced=layoutEvent('spaced-mouth',{seed}),I=e=>e.heads.reduce((s,b)=>s+b.intensity,0),removed=dense.heads.slice(120).reduce((s,b)=>s+b.intensity,0);
    near(I(dense)-I(reference),removed,2e-12);near(I(dense)-I(spaced),removed,2e-12);assert(I(reference)<I(dense));
    for(const e of [dense,reference,spaced])near(e.heads.reduce((s,b)=>s+b.intensity*dot(b.colour,[.2126,.7152,.0722]),0),I(e),2e-12);
  }
});
check('layout_metadata_survives_explicit_launch_queue_and_diagnostics',()=>{
  const s=createFireworksSimulation({maxActive:2});s.configure({smileyLayout:'reference'});const a=s.launch({type:'ring'}),b=s.launch({type:'ring',smileyLayout:'compact-eyes'});s.launch({type:'ring',smileyLayout:'spaced-mouth'});
  assert.equal(a.smileyLayout,'reference');assert.equal(a.actualStarCount,120);assert.equal(b.smileyLayout,'compact-eyes');assert.equal(b.actualStarCount,144);
  assert.deepEqual(s.state.activeEvents.map(e=>[e.smileyLayout,e.actualStarCount]),[['reference',120],['compact-eyes',144]]);
  s.configure({smileyLayout:'dense'});s.update({time:Math.max(...s.active.map(e=>e.endTime))+.01});assert(s.state.activeEvents.some(e=>e.smileyLayout==='spaced-mouth'&&e.actualStarCount===120));
});
check('all_layouts_stay_on_frozen_world_plane_under_piecewise_wind',()=>{
  for(const layout of layouts){const e=layoutEvent(layout),timeline=[{time:-Infinity,wind:[2,0,1]},{time:e.burstTime+.3,wind:[-5,.2,3]}],particles=sampleFireworkEvent(e,e.burstTime+1.4,{windTimeline:timeline,smoke:false}),mean=particles[0].position.map((_,i)=>particles.reduce((s,p)=>s+p.position[i],0)/particles.length);
    assert.equal(particles.length,layoutCount[layout]);assert(particles.every(p=>Math.abs(dot(sub(p.position,mean),e.patternFrame.normal))<2e-12));
  }
});
const hash=url=>crypto.createHash('sha256').update(fs.readFileSync(url)).digest('hex'),report={date:new Date().toISOString(),passed:checks.every(c=>c.passed),passedCount:checks.filter(c=>c.passed).length,total:checks.length,checks,metrics,
  sourceSHA256:hash(new URL('../../fireworks-physics.js',import.meta.url)),baselineSHA256:hash(new URL('../baselines/b4-production-20261027-040831/fireworks-physics.js',import.meta.url)),helperSHA256:hash(new URL(import.meta.url)),
  denseBaselineSHA256:hash(new URL('../baselines/fireworks-before-smiley-layouts-8c147ee/fireworks-physics.js',import.meta.url)),
  scope:'independent geometry/projection, numerical vertical dynamics, metadata and same-input B4 mechanics regression; no browser acceptance',
  limits:['Supplier height examples, not every product or a measured full-shell simulation','Widths remain reference-only; expansion velocities are unchanged','Two-tone palette is authored; not an absolute spectrum/photometry calibration','Ground apex reference assumes no vertical wind; horizontal wind does not change linear-drag Y','No actual GPU legibility, reflection, source-storage budget or whole-island performance acceptance']};
fs.writeFileSync(new URL('./smiley-height-check.json',import.meta.url),JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({passed:report.passed,passedCount:report.passedCount,total:report.total,sourceSHA256:report.sourceSHA256,failed:checks.filter(c=>!c.passed)},null,2));if(!report.passed)process.exitCode=1;
