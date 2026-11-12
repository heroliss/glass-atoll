// Deterministic display simulation, metres/seconds and authored reference cd.
// Linear drag is an explicit approximation to the speed-dependent drag of a
// burning star. No chemical construction, recipes or pyrotechnic CFD.
import {windResponse} from './wind-response.js';
const PI=Math.PI,TAU=2*PI,G=9.81;
// Supplier examples define a nominal rise at80deg, not a universal rule for
// every shell of this calibre. Burst width is reference-only in this stage.
export const FIREWORK_HEIGHT_PROFILES=Object.freeze({
  90:Object.freeze({calibreMm:90,riseMetres:120,referenceWidthMetres:60,source:'https://san-en-fireworks.com/index/products/productse/',evidence:'supplier product-scale example',widthCalibrated:false}),
  120:Object.freeze({calibreMm:120,riseMetres:160,referenceWidthMetres:120,source:'https://ojiyaenka.base.shop/items/34029650',evidence:'supplier product-scale example',widthCalibrated:false}),
  150:Object.freeze({calibreMm:150,riseMetres:190,referenceWidthMetres:150,source:'https://san-en-fireworks.com/index/products/productse/',evidence:'supplier product-scale example',widthCalibrated:false})
});
export const FIREWORK_TYPES=Object.freeze([
  {id:'peony',label:'牡丹',calibreMm:90,height:120,burn:3.1,count:224,trail:false},
  {id:'chrysanthemum',label:'菊',calibreMm:120,height:160,burn:4.3,count:192,trail:true},
  {id:'willow',label:'垂柳',calibreMm:150,height:190,burn:11.8,count:160,trail:true},
  {id:'palm',label:'棕榈',calibreMm:150,height:190,burn:6.2,count:12,trail:true},
  // Keep the legacy request/queue ID; the visible pattern is now a smiley.
  {id:'ring',label:'笑脸',pattern:'smiley',calibreMm:90,height:120,burn:3.6,count:120,trail:false},
  {id:'heart',label:'爱心',calibreMm:120,height:160,burn:3.8,count:144,trail:false},
  {id:'crossette',label:'分裂十字',calibreMm:90,height:120,burn:4.3,count:36,trail:true},
  {id:'strobe',label:'闪星',calibreMm:120,height:160,burn:6.2,count:160,trail:false},
  {id:'fan',label:'扇形彗星',height:44,burn:3.6,count:9,trail:true,ground:true},
  {id:'bouquet',label:'近地花束',height:32,burn:2.8,count:104,trail:true,ground:true},
].map(o=>Object.freeze({...o,pattern:o.pattern||o.id,calibreMm:o.calibreMm??null,
  heightMeaning:o.ground?'nominal-visible-apex-above-launch':'reference-rise-above-launch-at80deg',
  heightReference:o.ground?null:FIREWORK_HEIGHT_PROFILES[o.calibreMm],reference:'https://www.optimum-fireworks.co.uk/glossary.html'})));
export const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
const add=(a,b)=>a.map((x,i)=>x+b[i]),scale=(a,s)=>a.map(x=>x*s);
const dot=(a,b)=>a.reduce((s,x,i)=>s+x*b[i],0),cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
const unit=v=>scale(v,1/Math.max(1e-12,Math.hypot(...v)));
export function seededRandom(seed=1){let x=seed>>>0;return()=>{x=(Math.imul(x,1664525)+1013904223)>>>0;return x/4294967296;};}
export function flightSegment(position,velocity,dt,drag=.2,wind=[0,0,0],gravity=G){
  dt=Math.max(0,dt);const acceleration=[0,-gravity,0];
  if(drag<1e-8)return {position:position.map((p,i)=>p+velocity[i]*dt+acceleration[i]*dt*dt*.5),velocity:velocity.map((v,i)=>v+acceleration[i]*dt)};
  const decay=Math.exp(-drag*dt),travel=-Math.expm1(-drag*dt)/drag;
  return {position:position.map((p,i)=>p+(wind[i]+acceleration[i]/drag)*dt+(velocity[i]-wind[i]-acceleration[i]/drag)*travel),
    velocity:velocity.map((v,i)=>wind[i]+acceleration[i]/drag+(v-wind[i]-acceleration[i]/drag)*decay)};
}
export function sampleBody(body,time,timeline=[{time:-Infinity,wind:[0,0,0]}]){
  if(time<body.birth)return null;
  const parent=body.parentBody?sampleBody(body.parentBody,body.birth,timeline):null;
  const p=parent?.position||body.position,v=parent?add(parent.velocity,body.velocityDelta):body.velocity,dt=time-body.birth,k=body.drag===undefined?.2:body.drag,gravity=body.gravity??G;
  if(k<1e-8)return flightSegment(p,v,dt,k,zeroWind,gravity);
  const first=timeline[0],last=timeline.at(-1);
  if(!last||timeline.length===1||body.birth>=last.time||time<=first.time)return flightSegment(p,v,dt,k,(body.birth>=last?.time?last:first)?.wind||zeroWind,gravity);
  const response=windResponse(timeline,k,body.birth,time);
  return {position:p.map((value,i)=>value+v[i]*response.travel+(i===1?-gravity*response.drift/k:0)+response.position[i]),
    velocity:v.map((value,i)=>value*response.decay+(i===1?-gravity*response.travel:0)+response.velocity[i])};
}
const zeroWind=[0,0,0];
export function apexLaunch(height,drag=.075,gravity=G){
  height=Math.max(1,height);let lo=0,hi=30;
  for(let i=0;i<55;i++){const t=(lo+hi)*.5,h=gravity/(drag*drag)*(Math.expm1(drag*t)-drag*t);if(h<height)lo=t;else hi=t;}
  const time=(lo+hi)*.5;return{time,verticalVelocity:gravity/drag*Math.expm1(drag*time),height};
}

// Opt-in display trajectory calibrated to a supplier example's height/fuse
// labels. It is not a measured smiley trajectory or a charge/energy recipe.
function parseFlightOptions({type='peony',flightModel='apex',burstDelaySeconds,height}={}){
  if(flightModel!=='apex'&&flightModel!=='timed-reference')throw new RangeError('flightModel must be apex or timed-reference');
  if(flightModel==='apex'){if(burstDelaySeconds!==undefined)throw new RangeError('burstDelaySeconds requires timed-reference');return null;}
  if(type!=='ring')throw new RangeError('timed-reference currently requires ring');
  if(burstDelaySeconds!==3)throw new RangeError('timed-reference requires explicit burstDelaySeconds=3');
  if(height!==undefined)throw new RangeError('timed-reference uses the definition rise120; explicit height is unsupported');
  return{model:flightModel,burstDelaySeconds};
}
function timedReferenceLaunch(height,time){
  const drag=.075,travel=-Math.expm1(-drag*time)/drag;
  return{time,verticalVelocity:(height+G*time/drag)/travel-G/drag,height};
}

// Analytic CIE 1931 fit (Wyman et al., JCGT 2013, 2(2), 1); approximate colour
// matching functions, NOT measured fireworks SPDs. Band locations follow the
// emitter families reviewed in verification/plans/FIREWORKS-RESEARCH.md.
function cie(w){const e=(a,b,c)=>Math.exp(-.5*((w-a)*(w<a?b:c))**2);return[.362*e(442,.0624,.0374)+1.056*e(599.8,.0264,.0323)-.065*e(501.1,.049,.0382),.821*e(568.8,.0213,.0247)+.286*e(530.9,.0613,.0322),1.217*e(437,.0845,.0278)+.681*e(459,.0385,.0725)];}
function emissionColour(kind){
  const xyz=[0,0,0];
  for(let w=380;w<=780;w+=5){let s=0;
    if(kind==='thermal'){const l=w*1e-9;s=1/(l**5*Math.expm1(.01438776877/(l*2850)))*1e-29;}
    else if(kind==='red')s=Math.exp(-.5*((w-642)/15)**2)+.25*Math.exp(-.5*((w-611)/8)**2);
    else if(kind==='green')s=Math.exp(-.5*((w-533)/18)**2)+.20*Math.exp(-.5*((w-561)/8)**2);
    else if(kind==='blue')s=Math.exp(-.5*((w-454)/15)**2)+.22*Math.exp(-.5*((w-488)/8)**2);
    else s=Math.exp(-.5*((w-589.3)/2)**2);
    const cmf=cie(w);for(let c=0;c<3;c++)xyz[c]+=s*cmf[c]*5;
  }
  let rgb=[3.24096994*xyz[0]-1.53738318*xyz[1]-.49861076*xyz[2],-.96924364*xyz[0]+1.8759675*xyz[1]+.04155506*xyz[2],.05563008*xyz[0]-.20397696*xyz[1]+1.05697151*xyz[2]];
  // A documented simple gamut compression: add neutral until nonnegative.
  // This changes the spectral chromaticity; do not claim exact spectral RGB.
  const neutral=Math.max(0,-Math.min(...rgb));rgb=rgb.map(x=>x+neutral);
  const Y=dot(rgb,[.2126,.7152,.0722]);return rgb.map(x=>x/Y);
}
export const EMISSION_PROFILES=Object.freeze(Object.fromEntries(['red','green','blue','yellow','thermal'].map(k=>[k,Object.freeze(emissionColour(k))])));
const palettes=['red','green','blue','red','yellow','red','green','blue','thermal','thermal'];
function sphere(i,n,rng){const y=1-2*(i+.5)/n,a=i*2.399963229728653+rng()*.08,r=Math.sqrt(1-y*y);return[r*Math.cos(a),y,r*Math.sin(a)];}
function planeBasis(azimuth){const a=azimuth*PI/180;return{right:[Math.cos(a),0,Math.sin(a)],up:[0,1,0],normal:[Math.sin(a),0,-Math.cos(a)]};}
// Hidden production/QA variants, not a camera-facing correction. The selected
// default reference uses120 stars. Explicit dense preserves the original144
// physical stars; alternatives isolate eye/mouth placement with no new RNG.
export const SMILEY_LAYOUTS=Object.freeze(['dense','spaced-mouth','compact-eyes','reference']);
const normaliseSmileyLayout=value=>SMILEY_LAYOUTS.includes(value)?value:'reference';
const smileyPoints=Object.freeze(Object.fromEntries(SMILEY_LAYOUTS.map(layout=>{
  const filled=layout==='compact-eyes'||layout==='reference',mouthCount=layout==='spaced-mouth'||layout==='reference'?24:48;
  return [layout,Object.freeze(Array.from({length:96+mouthCount},(_,i)=>{
    if(i<72){const a=TAU*i/72;return Object.freeze({x:Math.cos(a),y:Math.sin(a),part:'outline'});}
    if(i<96){
      const left=i<84,j=i-(left?72:84),a=filled?j*2.399963229728653:TAU*j/12;
      // Equal-area radial quantiles including the centre and original support
      // radius. Golden-angle azimuth uses no event RNG;12 stars keep their own
      // original intensity/radius/lifetime rather than becoming a larger source.
      const r=filled?.105*Math.sqrt(j/11):.105;
      return Object.freeze({x:(left?-.34:.34)+r*Math.cos(a),y:.32+r*Math.sin(a),part:left?'left-eye':'right-eye'});
    }
    // Circular U: equal angles give equal arc length including both endpoints.
    // The24-star option keeps the first24 original mouth stars' RNG properties;
    // it removes the remaining24 stars and their real candela, without makeup.
    const a=PI*(i-96)/(mouthCount-1);return Object.freeze({x:-.54*Math.cos(a),y:-.10-.54*Math.sin(a),part:'mouth'});
  }))];
})));
function groundVisibleApex(heads,originY){
  const heights=heads.map(b=>{const k=b.drag??.2,g=b.gravity??G,vy=b.velocity[1];
    const apex=vy<=0?0:k>1e-8?Math.log1p(k*vy/g)/k:vy/g;
    return flightSegment(b.position,b.velocity,Math.min(apex,b.life),k,zeroWind,g).position[1]-originY;
  });
  return {minimumRiseMetres:Math.min(...heights),maximumRiseMetres:Math.max(...heights),maximumWorldY:originY+Math.max(...heights),
    model:'per-head analytic linear-drag visible apex, clipped at burn-out; zero vertical wind',heightIsBurst:false};
}
export function starEnvelope(body,age){
  if(age<0||age>=body.life)return 0;
  const enter=clamp(age/.028,0,1),end=clamp((body.life-age)/Math.max(.16,body.life*.24),0,1);
  let envelope=enter*enter*end*end*(.36+.64*Math.exp(-age/(body.life*.7)));
  if(body.strobe){const phase=age*body.frequency+body.phase,cycle=phase-Math.floor(phase),edge=.035;envelope*=clamp(cycle/edge,0,1)*clamp((body.duty-cycle)/edge,0,1);}
  return envelope;
}
// Legacy kind='rocket' is a ballistic mortar carrier with an authored attached
// ascent-light effect, not a continuously thrusting engine or a smoke-mass source.
// Source candela stays unchanged; this bounded C2 envelope is not renormalized.
export function bodyEmissionEnvelope(body,age){
  if(body.kind!=='rocket')return starEnvelope(body,age);
  if(age<=0||age>=body.life)return 0;
  const attack=Math.min(.12,body.life*.25),fade=Math.min(.40,body.life*.35);
  const enter=clamp(age/attack,0,1),end=clamp((body.life-age)/fade,0,1);
  return enter*enter*enter*(enter*(enter*6-15)+10)*end*end*end*(end*(end*6-15)+10);
}
function normaliseIntensityScale(value=1){
  if(!Number.isFinite(value)||value<0||value>64)throw new RangeError('intensityScale must be a finite number in0..64');
  return value===0?0:value;
}
export function createFireworkEvent({type='peony',origin=[29,.5,7],time=0,azimuth=104,elevation=80,seed=1,palette,height,smileyLayout='reference',intensityScale=1,flightModel='apex',burstDelaySeconds}={}){
  intensityScale=normaliseIntensityScale(intensityScale);
  const flight=parseFlightOptions({type,flightModel,burstDelaySeconds,height});
  const definition=FIREWORK_TYPES.find(o=>o.id===type)||FIREWORK_TYPES[0],rng=seededRandom(seed),basis=planeBasis(azimuth),id=`${seed>>>0}-${time.toFixed(5)}`;
  smileyLayout=type==='ring'?normaliseSmileyLayout(smileyLayout):null;
  const patternPoints=smileyLayout?smileyPoints[smileyLayout]:null;
  elevation=clamp(Number.isFinite(elevation)?elevation:80,25,90);
  const explicitWorldHeight=height!==undefined&&height!==null;
  // Defaults are rise above the launch point. The legacy explicit `height`
  // argument remains a worldY target so existing optical/GPU fixtures agree.
  const rise=explicitWorldHeight?height-origin[1]:definition.ground?definition.height-origin[1]:definition.height;
  // A type's nominal rise calibrates charge/speed at the default80deg.
  // Changing angle keeps kinetic energy fixed instead of silently increasing
  // muzzle energy to preserve the same high burst at a grazing trajectory.
  const reference=flight?timedReferenceLaunch(rise,flight.burstDelaySeconds):apexLaunch(rise),muzzleSpeed=reference.verticalVelocity/Math.sin(80*PI/180),verticalVelocity=muzzleSpeed*Math.sin(elevation*PI/180),flightTime=flight?flight.burstDelaySeconds:Math.log1p(.075*verticalVelocity/G)/.075;
  const direction=scale(basis.normal,muzzleSpeed*Math.cos(elevation*PI/180)),axis=add(scale(basis.normal,Math.cos(elevation*PI/180)),[0,Math.sin(elevation*PI/180),0]),axisUp=cross(axis,basis.right);
  const rocket={birth:time,position:[...origin],velocity:[direction[0],verticalVelocity,direction[2]],drag:.075,life:flightTime,kind:'rocket',radius:.023,intensity:18,colour:EMISSION_PROFILES.thermal};
  const burstTime=definition.ground?time:time+flightTime;
  const burstState=definition.ground?{position:[...origin],velocity:[0,0,0]}:sampleBody(rocket,burstTime);
  const selected=palette||palettes[FIREWORK_TYPES.indexOf(definition)],colour=EMISSION_PROFILES[selected]||EMISSION_PROFILES.red,heads=[];
  function body(i,p,v,options={}){return {id:heads.length,event:id,birth:burstTime,position:p,velocity:v,drag:.22,life:definition.burn*(.88+rng()*.23),kind:'star',radius:.009+rng()*.005,intensity:5+rng()*5,colour,trail:definition.trail,seed:Math.floor(rng()*4294967296),...options};}
  for(let i=0;i<(patternPoints?.length??definition.count);i++){
    let n=sphere(i,patternPoints?.length??definition.count,rng),v=scale(n,13+rng()*6),options={};
    if(type==='willow'){const a=i*2.399963229728653,y=-.05+rng()*.8,r=Math.sqrt(1-y*y);v=[Math.cos(a)*r*28,y*28,Math.sin(a)*r*28];options={drag:.74,life:10.2+rng()*2.5,intensity:2.8+rng()*2.4,colour:EMISSION_PROFILES.thermal};}
    if(type==='palm'){const a=TAU*i/definition.count,y=.15+rng()*.65,r=Math.sqrt(1-y*y);v=[Math.cos(a)*r*28,y*28,Math.sin(a)*r*28];options={drag:.20,intensity:48,life:5.4+rng(),radius:.024};}
    if(type==='ring'){
      const p=patternPoints[i];v=add(scale(basis.right,p.x*21),scale(basis.up,p.y*21));
      options={drag:.16,patternPart:p.part,colour:palette?colour:EMISSION_PROFILES[p.part==='outline'?'yellow':'green']};
    }
    if(type==='heart'){
      const a=TAU*i/definition.count;
      let x=Math.cos(a),y=Math.sin(a);
      x=16*Math.sin(a)**3/18;y=(13*Math.cos(a)-5*Math.cos(2*a)-2*Math.cos(3*a)-Math.cos(4*a))/18+.1;
      v=add(scale(basis.right,x*21),scale(basis.up,y*21));options={drag:.16};
    }
    if(type==='strobe')options={strobe:true,frequency:2.3+rng()*2.4,phase:rng(),duty:.23+rng()*.2,drag:.28};
    if(type==='fan'){
      const a=(i/(definition.count-1)-.5)*1.05,speed=34;
      v=add(scale(basis.right,Math.sin(a)*speed),scale(axis,Math.cos(a)*speed));
      options={birth:time+i*.065,drag:.15,life:3.2+rng()*.6,intensity:52,radius:.024,colour:EMISSION_PROFILES.thermal};
    }
    if(type==='bouquet'){const a=rng()*TAU,y=.66+rng()*.33,r=Math.sqrt(1-y*y),speed=21+rng()*10;v=scale(add(scale(axis,y),add(scale(basis.right,Math.cos(a)*r),scale(axisUp,Math.sin(a)*r))),speed);options={drag:.25,life:2.2+rng()*.7};}
    if(type==='crossette')options={life:.78,drag:.16,intensity:15,split:true};
    const b=body(i,[...burstState.position],add(v,burstState.velocity),options);b.basePosition=[...b.position];b.baseVelocity=[...b.velocity];heads.push(b);
    if(type==='crossette'){
      const splitTime=b.birth+b.life,split=sampleBody(b,splitTime),radial=unit(v),right=unit(cross(radial,Math.abs(radial[1])>.8?[1,0,0]:[0,1,0])),up=cross(radial,right);
      for(let k=0;k<4;k++){const a=k*PI*.5,extra=add(scale(right,Math.cos(a)*8.6),scale(up,Math.sin(a)*8.6));heads.push(body(i,split.position,add(split.velocity,extra),{birth:splitTime,life:2.5+rng()*.7,drag:.2,intensity:5.5,radius:.009,parent:b.id,parentBody:b,velocityDelta:extra}));}
    }
  }
  // Apply once after ALL parent/child options have been finalized. Never walk
  // parentBody recursively (the same parent also occurs in heads), nor rescale
  // during update/resolveBurst. Tails inherit their body's intensity naturally.
  if(intensityScale!==1){rocket.intensity*=intensityScale;for(const b of heads)b.intensity*=intensityScale;}
  const last=Math.max(...heads.map(b=>b.birth+b.life));
  const events=type==='fan'?heads.map((b,i)=>({kind:'launch',time:b.birth,position:[...origin],type:definition.id,seed:(seed+i)>>>0,energy:.18})):[{kind:'launch',time,position:[...origin],type:definition.id,seed,energy:definition.ground?.22:1},...(!definition.ground?[{kind:'burst',time:burstTime,position:[...burstState.position],type:definition.id,seed,energy:type==='palm'?1.15:1}]:[])];
  const heightInfo={inputMode:flight?'timed-reference-rise':definition.ground?'fixed-ground-kinematics':explicitWorldHeight?'explicit-worldY':'definition-rise',
    referenceRiseMetres:definition.ground?null:definition.height,referenceElevationDegrees:80,
    explicitWorldHeight:explicitWorldHeight?height:null,calibratedRiseMetres:definition.ground?null:reference.height,
    actualBurstWorldY:burstState.position[1],actualBurstRiseMetres:burstState.position[1]-origin[1],
    productReference:definition.heightReference,widthCalibrated:false,
    visibleApex:definition.ground?groundVisibleApex(heads,origin[1]):null,...(flight?{flightInfo:{model:flight.model,burstDelaySeconds:flight.burstDelaySeconds,referenceRiseMetres:120,referenceElevationDegrees:80,referenceVerticalVelocity:reference.verticalVelocity,muzzleSpeed,actualBurstVerticalVelocity:burstState.velocity[1],heightMeaning:'rise at fixed fuse, not apex; changed elevation keeps reference muzzle speed',authorApproximation:'constant linear drag .075/s; example fuse interpreted as display launch-to-burst delay; not measured smiley ballistics',sourceURL:'https://rise-hanabi.jp/fireworks/knowledge/'}}:{})};
  const patternFrame=type==='ring'||type==='heart'?Object.freeze({kind:'fixed-world-plane-from-launch-azimuth',right:Object.freeze([...basis.right]),up:Object.freeze([...basis.up]),normal:Object.freeze([...basis.normal])}):null;
  return{id,type:definition.id,pattern:definition.pattern,smileyLayout,intensityScale,actualStarCount:heads.length,calibreMm:definition.calibreMm,heightInfo,patternFrame,definition,seed:seed>>>0,time,origin:[...origin],azimuth,elevation,rocket:definition.ground?null:rocket,burstTime,burstPosition:[...burstState.position],baselineBurst:burstState,heads,endTime:Math.max(last+.95,burstTime+(definition.ground?6:17)*.075+8.5),palette:selected,paletteMode:type==='ring'&&!palette?'yellow-outline-green-features':'single-colour',events};
}
function resolveBurst(event,timeline){
  if(!event.rocket)return;
  const actual=sampleBody(event.rocket,event.burstTime,timeline),base=event.baselineBurst;
  event.burstPosition=actual.position;
  event.heightInfo.actualBurstWorldY=actual.position[1];event.heightInfo.actualBurstRiseMetres=actual.position[1]-event.origin[1];
  if(event.heightInfo.flightInfo)event.heightInfo.flightInfo.actualBurstVerticalVelocity=actual.velocity[1];
  for(const b of event.heads)if(!b.parentBody){b.position=b.basePosition.map((p,i)=>p+actual.position[i]-base.position[i]);b.velocity=b.baseVelocity.map((v,i)=>v+actual.velocity[i]-base.velocity[i]);}
  for(const e of event.events)if(e.kind==='burst')e.position=[...actual.position];
}
export function sampleFireworkEvent(event,time,{windTimeline,smoke=true}={}){
  resolveBurst(event,windTimeline);
  const particles=[];
  if(event.rocket&&time>=event.time&&time<event.burstTime){const state=sampleBody(event.rocket,time,windTimeline);particles.push({...event.rocket,...state,body:event.rocket,age:time-event.time,emission:bodyEmissionEnvelope(event.rocket,time-event.time),kind:'rocket'});}
  for(const b of event.heads){const age=time-b.birth;if(age<0||age>b.life)continue;const state=sampleBody(b,time,windTimeline);if(state.position[1]<.03)continue;const emission=starEnvelope(b,age);particles.push({...b,...state,body:b,age,emission});}
  if(smoke&&time>=event.burstTime){const rng=seededRandom(event.seed^0x9e3779b9),n=event.definition.ground?7:18;
    for(let i=0;i<n;i++){
      const birth=event.burstTime+i*.075,age=time-birth,a=TAU*rng(),r=2+rng()*9,y=(rng()-.3)*6,rise=1.2+rng();if(age<0||age>8.5)continue;
      const b={birth,position:add(event.burstPosition,[Math.cos(a)*r,y,Math.sin(a)*r]),velocity:[Math.cos(a)*2,rise,Math.sin(a)*2],drag:.8,gravity:0};
      const state=sampleBody(b,time,windTimeline),radius=1.1+age*.75;
      particles.push({...state,kind:'smoke',body:b,birth,age,life:8.5,radius,opticalDepth:.12*Math.exp(-age*.12)/(1+age*.32)*clamp((8.5-age)/1.5,0,1)**2,emission:0,colour:[.63,.65,.68],seed:event.seed+i});
    }
  }
  return particles;
}
export function eventBounds(event){
  const p=event.burstPosition,r=event.type==='willow'?47:event.type==='palm'?62:event.definition.ground?45:54;
  return {min:[Math.min(event.origin[0]-4,p[0]-r),Math.max(0,event.origin[1]),Math.min(event.origin[2]-4,p[2]-r)],max:[Math.max(event.origin[0]+4,p[0]+r),p[1]+r,Math.max(event.origin[2]+4,p[2]+r)],centre:[p[0],Math.max(25,p[1]*.6),p[2]],radius:Math.hypot(r,p[1]*.6),predicted:true};
}

export function createFireworksSimulation({origin=[29,.5,7],seed=14271,maxActive=2,maxQueued=16}={}){
  const settings={type:'peony',azimuth:104,elevation:80,autoDirection:true,autoLaunch:false,interval:7.5,smileyLayout:'reference',intensityScale:1},active=[],queue=[],pending=[],slotTimes=Array(maxActive).fill(-Infinity);
  let now=0,index=0,showIndex=0,nextAutomatic=0,launches=0,rejected=0;
  const windTimeline=[{time:-Infinity,wind:[0,0,0]}];
  function begin(request,at=now){const azimuth=settings.autoDirection?Math.atan2(origin[0],-origin[2])*180/PI:settings.azimuth;const event=createFireworkEvent({...settings,azimuth,origin,time:at,seed:(seed+Math.imul(++index,2654435761))>>>0,...request});slotTimes[slotTimes.indexOf(Math.min(...slotTimes))]=event.endTime;active.push(event);launches++;resolveBurst(event,windTimeline);for(const e of event.events)if(e.time<=now){e._delivered=true;pending.push({...e,eventId:event.id});}return event;}
  function launch(options={}){const flight=parseFlightOptions({type:settings.type,...options});if(flight)options={...options,type:'ring'};if(Object.hasOwn(options,'intensityScale'))options={...options,intensityScale:normaliseIntensityScale(options.intensityScale)};if(active.length>=maxActive){if(queue.length>=maxQueued){rejected++;return{accepted:false,reason:'queue capacity',queued:queue.length};}queue.push({...options,_requestedAt:now});return{accepted:true,queued:true,position:queue.length};}const e=begin(options);return{accepted:true,queued:false,id:e.id,type:e.type,smileyLayout:e.smileyLayout,intensityScale:e.intensityScale,actualStarCount:e.actualStarCount,burstTime:e.burstTime};}
  return{
    configure(patch={}){if(Object.hasOwn(patch,'flightModel')||Object.hasOwn(patch,'burstDelaySeconds'))throw new RangeError('Flight candidates are per-launch only; configure is unchanged');const intensityScale=Object.hasOwn(patch,'intensityScale')?normaliseIntensityScale(patch.intensityScale):settings.intensityScale,wasAutomatic=settings.autoLaunch;Object.assign(settings,patch,{intensityScale});settings.smileyLayout=normaliseSmileyLayout(settings.smileyLayout);settings.elevation=clamp(Number.isFinite(settings.elevation)?settings.elevation:80,25,90);settings.interval=clamp(settings.interval,4,30);if(!wasAutomatic&&settings.autoLaunch)nextAutomatic=now;return{...settings};},
    launch,
    update({time=now,windVector=[0,0,0]}={}){
      if(!Number.isFinite(time)||time<now)return;now=time;
      const w=Array.isArray(windVector)?windVector:[windVector.x||0,windVector.y||0,windVector.z||0],old=windTimeline.at(-1).wind;
      if(w.some((v,i)=>Math.abs(v-old[i])>1e-6))windTimeline.push({time:now,wind:w.map(x=>Number.isFinite(x)?x:0)});
      for(const event of active){resolveBurst(event,windTimeline);for(const e of event.events)if(!e._delivered&&e.time<=now){pending.push({...e,eventId:event.id});e._delivered=true;}}
      // Schedule at physical availability times, not at the next display
      // frame. Otherwise queue/show launch times drift with 30/60/120Hz.
      for(let safety=0;safety<64;safety++){
        const free=Math.min(...slotTimes),manual=queue.length?Math.max(queue[0]._requestedAt,free):Infinity,automatic=settings.autoLaunch?Math.max(nextAutomatic,free):Infinity,at=Math.min(manual,automatic);
        if(at>now)break;
        if(manual<=automatic)begin(queue.shift(),at);
        else{begin({type:FIREWORK_TYPES[showIndex++%FIREWORK_TYPES.length].id},at);nextAutomatic=at+settings.interval;}
      }
      for(let i=active.length-1;i>=0;i--)if(active[i].endTime<=now)active.splice(i,1);
      const oldest=Math.min(now-22,...active.map(e=>e.time));while(windTimeline.length>2&&windTimeline[1].time<oldest)windTimeline.shift();
    },
    particles(options){return active.flatMap(e=>sampleFireworkEvent(e,now,{windTimeline,...options}));},
    drainEvents(){return pending.splice(0);},
    stop(){settings.autoLaunch=false;queue.length=0;},
    get active(){return active;},get windTimeline(){return windTimeline;},
    get time(){return now;},get settings(){return{...settings};},
    get state(){return {time:now,active:active.length,queued:queue.length,launches,rejected,maxActive,maxQueued,settings:{...settings},windSegments:windTimeline.length,
      activeEvents:active.map(e=>({id:e.id,type:e.type,pattern:e.pattern,smileyLayout:e.smileyLayout,intensityScale:e.intensityScale,actualStarCount:e.actualStarCount,calibreMm:e.calibreMm,heightInfo:{...e.heightInfo},paletteMode:e.paletteMode})),
      model:'analytic linear-drag segments; deterministic world-space events; authored reference photometry, not CFD'};},
  };
}
