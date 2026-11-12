// RESEARCH ONLY: relative-mass CPU Gaussian reservoir. Not production runtime.
// No renderer, old active-event/life import, source-mass calibration or asset.
import fs from 'node:fs';
import crypto from 'node:crypto';
const PI=Math.PI,G=9.81,ROOT2=Math.sqrt(2),GAUSS3=(2*PI)**1.5;
const hash=value=>crypto.createHash('sha256').update(typeof value==='string'?value:JSON.stringify(value)).digest('hex');
const clone=p=>({...p,mean:[...p.mean],cov:[...p.cov]});
const dot=(a,b)=>a[0]*b[0]+a[1]*b[1]+a[2]*b[2],length=a=>Math.hypot(...a);
const maxAbs=a=>Math.max(0,...a.map(Math.abs));
const addOuter=(out,v,weight)=>{for(let i=0;i<3;i++)for(let j=0;j<3;j++)out[i*3+j]+=weight*v[i]*v[j];};

export function factorCovariance(cov){
  if(cov.length!==9||!cov.every(Number.isFinite))throw new TypeError('Finite 3x3 covariance required');
  if(Math.abs(cov[1]-cov[3])+Math.abs(cov[2]-cov[6])+Math.abs(cov[5]-cov[7])>1e-10)throw new RangeError('Symmetric covariance required');
  const L=Array(9).fill(0);
  for(let i=0;i<3;i++)for(let j=0;j<=i;j++){
    let s=cov[i*3+j];for(let k=0;k<j;k++)s-=L[i*3+k]*L[j*3+k];
    if(i===j){if(!(s>1e-12))throw new RangeError('Strictly positive definite covariance required');L[i*3+j]=Math.sqrt(s);}
    else L[i*3+j]=s/L[j*3+j];
  }
  return {L,detRoot:L[0]*L[4]*L[8]};
}
const whiten=(L,v)=>{const x=v[0]/L[0],y=(v[1]-L[3]*x)/L[4],z=(v[2]-L[6]*x-L[7]*y)/L[8];return[x,y,z];};
export function prepareGaussian(packet){
  const {L,detRoot}=factorCovariance(packet.cov),normalization=packet.mass/(GAUSS3*detRoot);
  return {density(point){const q=whiten(L,point.map((v,i)=>v-packet.mean[i]));return normalization*Math.exp(-.5*dot(q,q));},L,detRoot,normalization};
}
function erf(x){if(!Number.isFinite(x))return Math.sign(x);const sign=x<0?-1:1,a=Math.abs(x),t=1/(1+.3275911*a);return sign*(1-(((((1.061405429*t-1.453152027)*t)+1.421413741)*t-.284496736)*t+.254829592)*t*Math.exp(-a*a));}
// Integral of relative mass per area along a finite ray; not extinction until
// multiplied by a separately specified, uncalibrated optical coefficient.
export function gaussianColumn(packet,origin,direction,start=0,end=Infinity){
  if(!(end>=start)||Math.abs(length(direction)-1)>1e-9)throw new RangeError('Ordered ray segment and unit direction required');
  const {L,detRoot}=factorCovariance(packet.cov),q=whiten(L,origin.map((v,i)=>v-packet.mean[i])),v=whiten(L,direction),A=dot(v,v),b=dot(q,v)/A;
  const perpendicular=q.map((x,i)=>x-v[i]*b),s=Math.sqrt(A/2),deltaErf=erf(s*(end+b))-erf(s*(start+b));
  return packet.mass/(GAUSS3*detRoot)*Math.exp(-.5*dot(perpendicular,perpendicular))*Math.sqrt(PI/(2*A))*deltaErf;
}
export function mergePackets(packets,id='merged'){
  const mass=packets.reduce((s,p)=>s+p.mass,0);if(!(mass>0))throw new RangeError('Positive total relative mass required');
  const mean=[0,0,0],cov=Array(9).fill(0);let thermal=0,vertical=0,birth=Infinity,sourceCount=0;
  for(const p of packets){for(let i=0;i<3;i++)mean[i]+=p.mass*p.mean[i]/mass;thermal+=p.mass*p.temperatureExcess/mass;vertical+=p.mass*p.buoyantVelocity/mass;birth=Math.min(birth,p.birth);sourceCount+=p.sourceCount||1;}
  for(const p of packets){const delta=p.mean.map((v,i)=>v-mean[i]),w=p.mass/mass;for(let k=0;k<9;k++)cov[k]+=w*p.cov[k];addOuter(cov,delta,w);}
  return {id,mass,mean,cov,temperatureExcess:thermal,buoyantVelocity:vertical,birth,sourceCount};
}
function moments(packets){
  let mass=0,thermalMoment=0,verticalMoment=0;const first=[0,0,0],second=Array(9).fill(0);
  for(const p of packets){mass+=p.mass;thermalMoment+=p.mass*p.temperatureExcess;verticalMoment+=p.mass*p.buoyantVelocity;for(let i=0;i<3;i++)first[i]+=p.mass*p.mean[i];for(let i=0;i<3;i++)for(let j=0;j<3;j++)second[i*3+j]+=p.mass*(p.cov[i*3+j]+p.mean[i]*p.mean[j]);}
  return {mass,first,second,thermalMoment,verticalMoment};
}
function momentError(a,b){return {mass:Math.abs(a.mass-b.mass),first:maxAbs(a.first.map((v,i)=>v-b.first[i])),second:maxAbs(a.second.map((v,i)=>v-b.second[i])),thermal:Math.abs(a.thermalMoment-b.thermalMoment),vertical:Math.abs(a.verticalMoment-b.verticalMoment)};}

// Piecewise-held input winds; only crossings within the current physical tick
// are integrated. A birth-to-now query is never made for an old packet.
export function windIntegral(timeline,start,end){
  let lo=0,hi=timeline.length;while(lo<hi){const m=(lo+hi)>>>1;if(timeline[m].time<=start)lo=m+1;else hi=m;}let index=Math.max(0,lo-1),at=start;const integral=[0,0,0];
  while(at<end){const stop=Math.min(end,timeline[index+1]?.time??Infinity),dt=stop-at;for(let c=0;c<3;c++)integral[c]+=timeline[index].wind[c]*dt;at=stop;if(at<end)index++;}
  return integral;
}
function thermalFactors(dt,coolSeconds,dragSeconds,ambientKelvin){
  const a=1/coolSeconds,b=1/dragSeconds,ea=Math.exp(-a*dt),eb=Math.exp(-b*dt),Aa=-Math.expm1(-a*dt)/a,Ab=-Math.expm1(-b*dt)/b,c=G/ambientKelvin;
  if(Math.abs(a-b)<1e-10)return {ea,eb,Ab,velocityPerK:c*dt*eb,positionPerK:c*(Ab-dt*eb)/b};
  return {ea,eb,Ab,velocityPerK:c*(ea-eb)/(b-a),positionPerK:c*(Aa-Ab)/(b-a)};
}
export function createPrototypeReservoir({step=1/20,windTimeline=[{time:0,wind:[0,0,0]}],diffusivity=[.6,.12,.6],coolSeconds=12,dragSeconds=2,ambientKelvin=300,capacity=64,sourceDriver=null}={}){
  if(![step,coolSeconds,dragSeconds,ambientKelvin].every(v=>Number.isFinite(v)&&v>0)||!Number.isInteger(capacity)||capacity<1||diffusivity.length!==3||diffusivity.some(v=>v<0||!Number.isFinite(v)))throw new RangeError('Finite positive time/temperature/capacity and nonnegative diffusivity required');
  if(!windTimeline.length||windTimeline[0].time>0||windTimeline.some((v,i)=>!Number.isFinite(v.time)||v.wind.length!==3||!v.wind.every(Number.isFinite)||(i>0&&v.time<=windTimeline[i-1].time)))throw new RangeError('Finite ordered wind knots covering time zero required');
  let tick=0,merges=0,emitted=0,acceptedSources=0,peakCount=0,maxMassError=0,maxMeanMomentError=0,maxSecondMomentError=0;
  const packets=[],recentIds=new Map(),MAX_RECENT_IDS=256;
  function compact(){
    let cell=8;
    while(packets.length>capacity){
      const bins=new Map();for(let i=0;i<packets.length;i++){const p=packets[i],key=p.mean.map(x=>Math.floor(x/cell)).join(','),list=bins.get(key)||[];list.push(i);bins.set(key,list);}
      const candidate=Array.from(bins.values()).find(v=>v.length>1);
      if(!candidate){cell*=2;if(!Number.isFinite(cell))throw new Error('Cannot bound prototype state');continue;}
      const list=candidate.map(i=>packets[i]),before=moments(list),p=mergePackets(list,`merge-${++merges}`),error=momentError(before,moments([p]));
      maxMassError=Math.max(maxMassError,error.mass);maxMeanMomentError=Math.max(maxMeanMomentError,error.first);maxSecondMomentError=Math.max(maxSecondMomentError,error.second);
      const removed=new Set(candidate);for(let i=packets.length-1;i>=0;i--)if(removed.has(i))packets.splice(i,1);packets.push(p);
    }
  }
  function emit(source){
    // A bounded recent-ID guard, not an unbounded archive of all events.
    if(recentIds.has(source.id))return false;
    if(typeof source.id!=='string'||!source.id||!(source.mass>0)||!Number.isFinite(source.mass)||source.mean.length!==3||!source.mean.every(Number.isFinite)||![source.birth,source.temperatureExcess??0,source.buoyantVelocity??0].every(Number.isFinite))throw new TypeError('Source ID and finite positive relative mass / position / birth / thermal state required');
    factorCovariance(source.cov);const p=clone({...source,temperatureExcess:source.temperatureExcess||0,buoyantVelocity:source.buoyantVelocity||0,sourceCount:1});
    packets.push(p);emitted+=p.mass;acceptedSources++;recentIds.set(source.id,true);if(recentIds.size>MAX_RECENT_IDS)recentIds.delete(recentIds.keys().next().value);
    compact();peakCount=Math.max(peakCount,packets.length);return true;
  }
  function evolve(start,end){
    const dt=end-start;if(!(dt>0))return;
    const travel=windIntegral(windTimeline,start,end),f=thermalFactors(dt,coolSeconds,dragSeconds,ambientKelvin);
    for(const p of packets){
      for(let c=0;c<3;c++)p.mean[c]+=travel[c];
      p.mean[1]+=p.buoyantVelocity*f.Ab+p.temperatureExcess*f.positionPerK;
      p.buoyantVelocity=p.buoyantVelocity*f.eb+p.temperatureExcess*f.velocityPerK;p.temperatureExcess*=f.ea;
      for(let c=0;c<3;c++)p.cov[c*3+c]+=2*diffusivity[c]*dt;
    }
  }
  return {
    emit,
    advanceTo(time){
      if(!Number.isFinite(time)||time<tick*step-1e-8)throw new RangeError('No implicit rewind; physical seconds must be nondecreasing');
      const goal=Math.floor((time+1e-9)/step);
      while(tick<goal){
        const start=tick*step,end=(tick+1)*step,sources=sourceDriver?.(start,end)||[];let at=start;
        for(const source of sources){if(source.birth<at-1e-9||source.birth>end+1e-9)throw new RangeError('Driver must emit ordered physical source times inside the tick');evolve(at,source.birth);emit(source);at=source.birth;}
        evolve(at,end);tick++;
      }
    },
    snapshot(){return {time:tick*step,tick,packets:packets.map(clone),ledger:{emitted,airborne:packets.reduce((s,p)=>s+p.mass,0),deposited:0,escaped:0,removed:0},acceptedSources,merges};},
    diagnostics(){return {tick,time:tick*step,packetCount:packets.length,capacity,peakPacketCount:peakCount,recentIdCount:recentIds.size,merges,acceptedSources,maxMergeMassError:maxMassError,maxMergeFirstMomentError:maxMeanMomentError,maxMergeSecondMomentError:maxSecondMomentError,units:'relative dry mass, metres, physical seconds; NOT measured kg',limits:['no render/GPU/photometry','isotropic-axis diffusion only; no resolved shear/turbulent eddies','thermal state is a prescribed linear surrogate, not gas enthalpy','spatial capacity compaction may smear optical structure; no acceptance of its image quality','sourceDriver is external QA schedule, not retained live event history','recent-ID guard only covers last256 source IDs; production needs monotonic source contract','no sinks enabled; no deposition / precipitation / domain model claimed']};}
  };
}

const checks=[],check=(id,passed,details={})=>checks.push({id,passed,...details});
const diag=(x,y,z)=>[x,0,0,0,y,0,0,0,z];
const packet=(id,options={})=>({id,birth:0,mass:1,mean:[0,100,0],cov:diag(4,2,3),temperatureExcess:0,buoyantVelocity:0,...options});
const frames=(r,fps,seconds)=>{const n=Math.round(fps*seconds);for(let i=1;i<=n;i++)r.advanceTo(i/fps);return r.snapshot();};
const scheduleDriver=schedule=>{let cursor=0;return(start,end)=>{const list=[];while(cursor<schedule.length&&schedule[cursor].birth<=end+1e-10){const p=schedule[cursor++];if(p.birth>=start-1e-10)list.push(p);}return list;};};
const numericColumn=(p,origin,direction,start,end,steps=4096)=>{const d=prepareGaussian(p).density,at=t=>d(origin.map((v,i)=>v+direction[i]*t));let s=at(start)+at(end);for(let i=1;i<steps;i++)s+=(i%2?4:2)*at(start+(end-start)*i/steps);return s*(end-start)/steps/3;};

const now=performance.now();
const general=packet('normalization',{mass:2.75,mean:[13,27,-8],cov:[9,1.2,.7,1.2,4,.3,.7,.3,2]});
const prepared=prepareGaussian(general),n=64,R=6,h=2*R/n;let integral=0;
for(let i=0;i<=n;i++)for(let j=0;j<=n;j++)for(let k=0;k<=n;k++){
  const q=[-R+i*h,-R+j*h,-R+k*h],L=prepared.L,x=general.mean.map((v,row)=>v+L[row*3]*q[0]+L[row*3+1]*q[1]+L[row*3+2]*q[2]),weight=[i,j,k].reduce((w,s)=>w*(s===0||s===n?1:s%2?4:2),1);
  integral+=weight*prepared.density(x)*prepared.detRoot;
}
integral*=h*h*h/27;
check('normalized_general_SPD_Gaussian_integrates_to_relative_mass',Math.abs(integral/general.mass-1)<1e-7,{mass:general.mass,numericalMassInWhitenedSixSigmaBox:integral,relativeError:integral/general.mass-1});
check('density_peak_has_analytic_normalization',Math.abs(prepared.density(general.mean)-general.mass/(GAUSS3*prepared.detRoot))<1e-15);

const staticReservoir=createPrototypeReservoir({diffusivity:[0,0,0]});staticReservoir.emit(packet('static'));const staticStart=staticReservoir.snapshot();staticReservoir.advanceTo(1800);const staticEnd=staticReservoir.snapshot();
check('world_zero_wind_cold_no_diffusion_stays_static_after_1800s',JSON.stringify(staticStart.packets)===JSON.stringify(staticEnd.packets));
check('no_uniform_30minute_age_deletion',staticEnd.packets.length===1&&staticEnd.packets[0].mass===1&&staticEnd.time===1800);
const diffuse=createPrototypeReservoir();diffuse.emit(packet('diffuse'));const peakBefore=prepareGaussian(diffuse.snapshot().packets[0]).density([0,100,0]);diffuse.advanceTo(1800);const diffuseEnd=diffuse.snapshot(),peakAfter=prepareGaussian(diffuseEnd.packets[0]).density([0,100,0]);
check('zero_mean_wind_diffusion_reduces_peak_without_mass_loss',diffuseEnd.ledger.airborne===1&&peakAfter<peakBefore*.001&&diffuseEnd.packets[0].mean.every((v,i)=>v===[0,100,0][i]),{peakBefore,peakAfter,finalCovariance:diffuseEnd.packets[0].cov});
const coldWind=[{time:0,wind:[1.8,0,.35]}],windR=createPrototypeReservoir({windTimeline:coldWind,diffusivity:[0,0,0]});windR.emit(packet('wind'));windR.advanceTo(1800);const windFinal=windR.snapshot().packets[0];
check('constant_1p8mps_wind_displaces_3240m_in_1800s',length(windFinal.mean.map((v,i)=>v-[3240,100,630][i]))<2e-8,{finalMean:windFinal.mean});
const timeline=[{time:0,wind:[1.8,0,.35]},{time:123.4567,wind:[-.4,0,1.2]},{time:720.123,wind:[0,0,0]},{time:1333.019,wind:[.6,0,-.8]}];
const variable=createPrototypeReservoir({windTimeline:timeline,diffusivity:[0,0,0]});variable.emit(packet('changing'));variable.advanceTo(1800);const variableEnd=variable.snapshot().packets[0],expectedTravel=windIntegral(timeline,0,1800);
check('off_tick_variable_wind_accumulates_each_past_segment',length(variableEnd.mean.map((v,i)=>v-[expectedTravel[0],100,expectedTravel[2]][i]))<2e-8,{expectedTravel,finalMean:variableEnd.mean});
check('variable_wind_is_not_final_wind_times_age',length(expectedTravel.map((v,i)=>v-timeline.at(-1).wind[i]*1800))>100);
const thermal=createPrototypeReservoir({diffusivity:[0,0,0]});thermal.emit(packet('warm',{temperatureExcess:12}));thermal.advanceTo(1800);const thermalEnd=thermal.snapshot().packets[0],expectedRise=G/300*12*12*2;
check('world_down_gravity_buoyancy_is_vertical_and_decays',thermalEnd.mean[0]===0&&thermalEnd.mean[2]===0&&Math.abs(thermalEnd.mean[1]-100-expectedRise)<1e-9&&thermalEnd.temperatureExcess<1e-50&&Math.abs(thermalEnd.buoyantVelocity)<1e-50,{expectedFiniteRiseMetres:expectedRise,finalPacket:thermalEnd});
const equalRates=createPrototypeReservoir({coolSeconds:4,dragSeconds:4,diffusivity:[0,0,0]});equalRates.emit(packet('equal-rates',{temperatureExcess:8}));equalRates.advanceTo(1800);
check('equal_cooling_drag_rate_limit_is_finite_and_correct',Math.abs(equalRates.snapshot().packets[0].mean[1]-100-G/300*8*4*4)<1e-9);

const original=[packet('a',{mass:2,mean:[-1,99,2],cov:[3,.2,0,.2,2,.1,0,.1,4],temperatureExcess:7,buoyantVelocity:.3}),packet('b',{mass:.7,mean:[2,103,-1],cov:diag(2,3,1),temperatureExcess:2,buoyantVelocity:-.1}),packet('c',{mass:1.1,mean:[.2,98,.5],cov:diag(1,2,3),temperatureExcess:0,buoyantVelocity:.1})];
const merged=mergePackets(original),mergeError=momentError(moments(original),moments([merged]));
check('merge_preserves_relative_mass',mergeError.mass<1e-14,mergeError);
check('merge_preserves_first_and_second_raw_spatial_moments',mergeError.first<1e-12&&mergeError.second<1e-10,mergeError);
check('merge_preserves_mass_weighted_thermal_surrogate_not_enthalpy',mergeError.thermal<1e-13&&mergeError.vertical<1e-13);
const alternate=mergePackets([mergePackets(original.slice(0,2)),original[2]]),associative=momentError(moments([merged]),moments([alternate]));
check('sequential_merge_is_associative_within_float_precision',associative.first<1e-12&&associative.second<1e-10,{error:associative});
let positive=true;for(const p of [general,...original,merged,...diffuseEnd.packets,thermalEnd])try{factorCovariance(p.cov);}catch{positive=false;}
check('general_and_evolved_covariances_are_finite_positive_definite',positive);
let badCovRejected=false;try{factorCovariance([1,2,0,2,1,0,0,0,1]);}catch{badCovRejected=true;}
check('non_positive_definite_covariance_rejected',badCovRejected);
let negativeKRejected=false;try{createPrototypeReservoir({diffusivity:[1,-1,1]});}catch{negativeKRejected=true;}
check('negative_diffusivity_rejected',negativeKRejected);
let nonFiniteThermalRejected=false;try{createPrototypeReservoir().emit(packet('bad-temperature',{temperatureExcess:Infinity}));}catch{nonFiniteThermalRejected=true;}
check('nonfinite_thermal_source_is_rejected_before_state_mutation',nonFiniteThermalRejected);
let invalidStepRejected=false;try{createPrototypeReservoir({step:Infinity});}catch{invalidStepRejected=true;}
check('nonfinite_physical_step_is_rejected',invalidStepRejected);
let badWindRejected=false;try{createPrototypeReservoir({windTimeline:[{time:0,wind:[0,0,0]},{time:1,wind:[NaN,0,0]}]});}catch{badWindRejected=true;}
check('nonfinite_wind_timeline_is_rejected',badWindRejected);

const scripted=[packet('s0',{birth:0,mass:.8,temperatureExcess:12}),packet('s1',{birth:73.0123,mass:.6,mean:[4,95,3],temperatureExcess:6}),packet('s2',{birth:600.025,mass:1.2,mean:[-3,125,1]}),packet('s3',{birth:1200.123,mass:.4,mean:[7,110,-4],temperatureExcess:3})];
const replay=[];
for(const fps of [30,60,120]){const r=createPrototypeReservoir({windTimeline:timeline,sourceDriver:scheduleDriver(scripted)}),t=performance.now(),state=frames(r,fps,1800);replay.push({fps,nodeMilliseconds:performance.now()-t,hash:hash(state),state,diagnostics:r.diagnostics()});}
check('1800s_30_60_120Hz_states_are_byte_reproducible',new Set(replay.map(r=>r.hash)).size===1,{hashes:replay.map(({fps,hash})=>({fps,hash}))});
check('subtick_sources_inject_once_at_physical_birth',replay.every(r=>r.state.acceptedSources===4&&Math.abs(r.state.ledger.airborne-3)<1e-14));
const stopped=createPrototypeReservoir();stopped.emit(packet('paused'));stopped.advanceTo(10);const stoppedHash=hash(stopped.snapshot());for(let i=0;i<150;i++)stopped.advanceTo(10);
check('pause_same_physical_time_does_not_advance_state',stoppedHash===hash(stopped.snapshot()));
let rewindRejected=false;try{stopped.advanceTo(9);}catch{rewindRejected=true;}
check('backward_physical_clock_requires_explicit_restore',rewindRejected);
const sameId=packet('idempotent');const identity=createPrototypeReservoir();identity.emit(sameId);identity.emit(sameId);
check('recent_duplicate_source_does_not_double_mass',identity.snapshot().ledger.airborne===1&&identity.snapshot().acceptedSources===1);

// Camera/C/P are deliberately outside the reservoir API. Repeated world-space
// queries at different host observation metadata must have no mutation.
const stateBefore=hash(variable.snapshot()),rhoBefore=prepareGaussian(variableEnd).density(variableEnd.mean),hostMetadata=[{camera:[0,0,0],P:-1,C:0,utcRate:1},{camera:[8000,1000,-9000],P:21,C:-15,utcRate:600}];
const observations=hostMetadata.map(meta=>({host:meta,density:prepareGaussian(variableEnd).density(variableEnd.mean)}));
check('camera_storage_camera_exposure_and_UTC_metadata_are_not_physical_inputs',observations.every(x=>x.density===rhoBefore)&&hash(variable.snapshot())===stateBefore,{limit:'CPU API exclusion / non-mutating query only; not a production/GPU exposure integration test'});

const testRay={origin:[13,27,-30],direction:[0,0,1],start:0,end:44},analytic=gaussianColumn(general,testRay.origin,testRay.direction,testRay.start,testRay.end),numeric=numericColumn(general,testRay.origin,testRay.direction,testRay.start,testRay.end);
check('finite_Gaussian_column_agrees_with_independent_quadrature',Math.abs(analytic-numeric)<2e-7,{analytic,numeric,absoluteError:Math.abs(analytic-numeric)});
const inside=gaussianColumn(general,general.mean,[0,0,1],0,15),insideNumerical=numericColumn(general,general.mean,[0,0,1],0,15);
check('camera_inside_Gaussian_integrates_forward_half_segment',Math.abs(inside-insideNumerical)<2e-7,{analytic:inside,numeric:insideNumerical});

// Counterexample: exact M/mean/cov merge may bridge an empty gap and change tau.
const pair=[packet('left',{mean:[-10,0,0],cov:diag(1,1,1)}),packet('right',{mean:[10,0,0],cov:diag(1,1,1)})],wide=mergePackets(pair);
const rays=[];for(const x of [-12,-10,-8,-4,0,4,8,10,12]){const before=pair.reduce((s,p)=>s+gaussianColumn(p,[x,0,-20],[0,0,1],0,40),0),after=gaussianColumn(wide,[x,0,-20],[0,0,1],0,40);rays.push({x,columnBefore:before,columnAfter:after,delta:after-before});}
check('moment_conservation_is_not_mistaken_for_column_conservation',rays.find(r=>r.x===0).columnAfter>.03&&rays.find(r=>r.x===10).columnAfter<rays.find(r=>r.x===10).columnBefore*.2,{rays,interpretation:'This wide merge is a deliberately unacceptable optical counterexample; production needs local/tau-error gates.'});
const tauA=.7,tauB=.3,Ta=Math.exp(-tauA),Tb=Math.exp(-tauB),Sa=2*(1-Ta),Sb=.1*(1-Tb),frontA=Sa+Ta*Sb,frontB=Sb+Tb*Sa;
check('equal_total_tau_does_not_make_different_source_terms_commute',Ta*Tb===Tb*Ta&&Math.abs(frontA-frontB)>.1,{frontA,frontB,transmission:Ta*Tb,limit:'algebraic warning, not an implemented renderer'});

const stressSources=[];for(let burst=0;burst<240;burst++)for(let j=0;j<18;j++){const a=j*2.3999632297;stressSources.push(packet(`stress-${burst}-${j}`,{birth:burst*7.5,mass:.01,mean:[Math.cos(a)*8,110+Math.sin(a*2)*3,Math.sin(a)*8],temperatureExcess:j%3===0?8:0,cov:diag(1.2,1.1,1.2)}));}
const stress=createPrototypeReservoir({capacity:64,windTimeline:timeline,sourceDriver:scheduleDriver(stressSources)}),stressStart=performance.now(),stressState=frames(stress,60,1800),stressMs=performance.now()-stressStart,stressDiagnostics=stress.diagnostics();
let allFinite=true;for(const p of stressState.packets)try{if(![p.mass,p.temperatureExcess,p.buoyantVelocity,...p.mean,...p.cov].every(Number.isFinite))allFinite=false;factorCovariance(p.cov);}catch{allFinite=false;}
check('4320_sources_1800s_state_is_bounded_without_age_deletion',stressDiagnostics.packetCount<=64&&stressDiagnostics.peakPacketCount<=64&&stressState.acceptedSources===4320&&stressDiagnostics.merges>0&&stressDiagnostics.recentIdCount<=256,stressDiagnostics);
check('stress_relative_mass_ledger_has_no_unexplained_loss',Math.abs(stressState.ledger.emitted-stressState.ledger.airborne)<1e-10&&Math.abs(stressState.ledger.airborne-43.2)<1e-10,{ledger:stressState.ledger,residual:stressState.ledger.emitted-stressState.ledger.airborne});
check('stress_covariances_and_thermal_means_remain_finite_SPD',allFinite);
const report={schema:'glass-atoll.pyro-smoke-reservoir-research.v1',dateUTC:new Date().toISOString(),productionRuntimeEdits:false,noGPUOrBrowser:true,units:'relative dry mass; metres; physical seconds; covariance m2; prescribed thermal surrogate K. NOT calibrated kg or measured emission.',definition:{density:'normalized full 3D Gaussian',motion:'exact piecewise uniform mean-wind integral per physical interval plus analytic decaying buoyancy/cooling',thermal:'Tdot=-T/tauCool; wdot=g*T/ambientK-w/tauDrag; exact affine step; no conserved gas-enthalpy claim',diffusion:'diagonal covariance increment 2*K*dt; no random display-frame jump',merge:'mass/first/second moments; scalar thermal/velocity moments only',clock:'integer fixed20Hz physical tick with source-time subdivisions; display frames only request complete ticks',capacity:'spatial bin compaction, grows bin when necessary; does not preserve local optical quality and is NOT proposed as an accepted production merge policy',lifetime:'no age deletion, no old active-event/life imports',sourceDriver:'external finite QA schedule, streamed to current ticks; driver input memory is not reservoir state'},checks,passed:checks.every(c=>c.passed),counts:{checks:checks.length,passed:checks.filter(c=>c.passed).length},normalization:{numericalMass:integral,targetMass:general.mass},replay:replay.map(({fps,nodeMilliseconds,hash,diagnostics})=>({fps,nodeMilliseconds,hash,diagnostics})),mergeError,opticalCounterexample:rays,stress:{sourceInputCount:stressSources.length,simulationSeconds:1800,nodeMilliseconds:stressMs,diagnostics:stressDiagnostics,ledger:stressState.ledger,stateHash:hash(stressState),driverInputMemoryExcluded:true},elapsedNodeMilliseconds:performance.now()-now,limits:['No GPU/visual/performance acceptance, no source radiometry/physical kg calibration','No Navier-Stokes, resolved turbulence/shear/entrainment/inversion, aerosol chemistry, humidity/Mie/deposition or domain outflow implemented','No production emitter queue, finite-air/sky/water/DOF/light integration','No claim local opacity/source illumination is conserved by moment merges; counterexample deliberately retained','No claim CPU metadata exclusion proves correct production camera/P/UTC wiring','No guaranteed recent-ID idempotence for arbitrarily old/reordered IDs','Node timings are one local CPU observation, not GPU budget or production-frame cost']};
fs.writeFileSync(new URL('./pyro-smoke-reservoir-prototype.json',import.meta.url),JSON.stringify(report,null,2));
console.log(JSON.stringify({passed:report.passed,counts:report.counts,failed:checks.filter(c=>!c.passed),elapsedNodeMilliseconds:report.elapsedNodeMilliseconds,replay:report.replay.map(({fps,nodeMilliseconds,hash})=>({fps,nodeMilliseconds,hash})),stress:report.stress},null,2));
if(!report.passed)process.exitCode=1;
