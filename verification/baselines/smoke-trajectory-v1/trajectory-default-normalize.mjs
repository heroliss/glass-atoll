// QA ONLY: inverse exact reviewed edits; fail closed, never normalize runtime.
export const fireworksTrajectoryProviderEdits=Object.freeze([
  [
    "read-only smoke source provider",
    "  // Read-only kinematic view for an optional bounded smoke source adapter.\n  // This never samples a future point, advances simulation/RNG, or reads light I.\n  const smokeDescriptorCache=new WeakMap();let smokeDescribeCalls=0,smokeSampleCalls=0,smokeReleases=0;\n  const smokeVector=value=>Object.freeze(Array.from(value));\n  function smokeActiveEvent(id){const event=simulation.active.find(e=>e.id===id);if(!event)throw new RangeError('Smoke source descriptor is no longer active: '+id);const first=simulation.windTimeline[0];if(first&&first.time>event.time+1e-10)throw new RangeError('Smoke source wind history was pruned before its causal launch');return event;}\n  const smokeSourceProvider=Object.freeze({\n    get time(){return simulation.time;},\n    describe(eventId){\n      const event=smokeActiveEvent(eventId);smokeDescribeCalls++;let descriptor=smokeDescriptorCache.get(event);if(descriptor)return descriptor;\n      const roots=event.heads.filter(b=>!b.parentBody).map(b=>Object.freeze({id:b.id,birth:b.birth,life:b.life,baseVelocity:smokeVector(b.baseVelocity),patternPart:b.patternPart??null}));\n      const frame=event.patternFrame?Object.freeze({kind:event.patternFrame.kind,right:smokeVector(event.patternFrame.right),up:smokeVector(event.patternFrame.up),normal:smokeVector(event.patternFrame.normal)}):null;\n      descriptor=Object.freeze({schema:'glass-atoll.smoke-kinematic-descriptor.v1',id:event.id,type:event.type,seed:event.seed,ground:!!event.definition.ground,time:event.time,burstTime:event.burstTime,endTime:event.endTime,baselineVelocity:smokeVector(event.baselineBurst.velocity),shapeFrame:frame,roots:Object.freeze(roots),sourceEvents:Object.freeze(event.events.map(e=>Object.freeze({kind:e.kind,time:e.time,seed:e.seed}))) });\n      smokeDescriptorCache.set(event,descriptor);return descriptor;\n    },\n    sample(eventId,{kind,time,bodyId,eventKind,seed}={}){\n      if(!Number.isFinite(time)||time>simulation.time)throw new RangeError('Smoke source sample must be finite and already born at the current simulation time');\n      const event=smokeActiveEvent(eventId);if(time<event.time)throw new RangeError('Smoke source sample predates its causal launch');let position;\n      if(kind==='root'){const body=event.heads.find(b=>!b.parentBody&&b.id===bodyId);if(!body||time<body.birth||time>=body.birth+body.life)throw new RangeError('Smoke source requires an existing burning root at the requested birth time');position=sampleBody(body,time,simulation.windTimeline).position;}\n      else if(kind==='event'){const source=event.events.find(e=>e.kind===eventKind&&e.time===time&&(seed===undefined||seed===e.seed));if(!source)throw new RangeError('Smoke source event clock/seed does not match its active descriptor');position=source.position;}\n      else throw new RangeError('Smoke source sample kind must be root or event');\n      if(!position.every(Number.isFinite))throw new RangeError('Smoke source point is not finite');smokeSampleCalls++;return Object.freeze({eventId,time,position:smokeVector(position)});\n    },\n    release(eventId){const event=simulation.active.find(e=>e.id===eventId);if(event)smokeDescriptorCache.delete(event);smokeReleases++;},\n    diagnostics(){return{describeCalls:smokeDescribeCalls,sampleCalls:smokeSampleCalls,releases:smokeReleases,strongEventArchives:0,positionPolicy:'past/current exact physical time only; active event plus unpruned causal wind required'};}\n  });\n  const api={rig,effectsScene,types:FIREWORK_TYPES,smokeSourceProvider,",
    "  const api={rig,effectsScene,types:FIREWORK_TYPES,"
  ]
].map(e=>Object.freeze(e)));
export const trajectoryEventExport="\n// Optional trajectory adapter reuses the exact legacy source geometry/RNG.\nexport {sourcePackets as createPyroSmokeEventPackets};\n";
export function normalizeFireworksTrajectoryProviderSource(source){if(typeof source!=='string')throw new TypeError('Source text required');let result=source;for(const [label,from,to]of fireworksTrajectoryProviderEdits){const count=result.split(from).length-1;if(count!==1)throw new Error('Trajectory provider scope drift: '+label+' count '+count);result=result.replace(from,to);}return result;}
export function normalizeTrajectoryEventExport(source){if(source.split(trajectoryEventExport).length-1!==1)throw new Error('Trajectory source export scope drift');return source.replace(trajectoryEventExport,'');}

export const trajectoryHostEdits=Object.freeze([
  [
    "trajectory adapter import",
    "import {createPyroSmokeEvents} from './pyro-smoke-events.js';\nimport {createPyroSmokeTrajectoryEvents} from './pyro-smoke-trajectory-events.js';",
    "import {createPyroSmokeEvents} from './pyro-smoke-events.js';"
  ],
  [
    "source model options",
    "{time=0,wind=[0,0,0],capacity=4096,sourceModel='legacy9',sourceProvider=null}={}){",
    "{time=0,wind=[0,0,0],capacity=4096}={}){"
  ],
  [
    "validated model and explicit new-state queue contract",
    "  if(sourceModel!=='legacy9'&&sourceModel!=='trajectory-v1')throw new RangeError(\"sourceModel must be 'legacy9' or 'trajectory-v1'\");\n  const sourceStateOptions=sourceModel==='trajectory-v1'?{maxPendingEmissions:8192}:{};\n  let state=createPyroSmokeState({time,wind,capacity,...sourceStateOptions}),",
    "  let state=createPyroSmokeState({time,wind,capacity}),"
  ],
  [
    "exclusive source adapter",
    "const events=sourceModel==='legacy9'?createPyroSmokeEvents({state}):createPyroSmokeTrajectoryEvents({state,sourceProvider,queueCapacity:8192}),",
    "const events=createPyroSmokeEvents({state}),"
  ],
  [
    "new-mode preflight before wind mutation",
    "      let preparedSources=null;\n      if(sourceModel==='trajectory-v1'){\n        if(!Array.isArray(windVector)||windVector.length!==3||windVector.some(v=>!Number.isFinite(v)||Math.abs(v)>1e6))throw new RangeError('Trajectory wind requires3 finite physical components within1e6');\n        const committed=state.diagnostics();if(Math.floor((now-committed.time+1e-9)/committed.fixedStep)>committed.maxStepsPerAdvance)throw new RangeError('Trajectory source update exceeds bounded physical catchup; advance in causal steps');\n        preparedSources=events.prepare(sourceEvents,{throughTime:now});\n      }\n      if(windVector.some((v,i)=>v!==currentWind[i]))",
    "      if(windVector.some((v,i)=>v!==currentWind[i]))"
  ],
  [
    "exclusive prepared commit",
    "if(preparedSources)events.commit(preparedSources);else events.consume(sourceEvents,{throughTime:now});const advanced=",
    "events.consume(sourceEvents,{throughTime:now});const advanced="
  ],
  [
    "clear queue contract",
    "createPyroSmokeState({time:physicalTime,wind:currentWind,capacity,...sourceStateOptions});",
    "createPyroSmokeState({time:physicalTime,wind:currentWind,capacity});"
  ],
  [
    "new-model accounting diagnostics only",
    "state:physical,events:events.diagnostics(),...(sourceModel==='trajectory-v1'?{sourceModel,cancelledReservedArea:events.diagnostics().cancelledReservedArea}:{}),",
    "state:physical,events:events.diagnostics(),"
  ],
  [
    "release new adapter at disposal",
    "dispose(){events.dispose?.();volume.dispose();}",
    "dispose(){volume.dispose();}"
  ]
].map(e=>Object.freeze(e)));
export function normalizePyroSmokeTrajectoryHostSource(source){if(typeof source!=='string')throw new TypeError('Source text required');let result=source;for(const [label,from,to]of trajectoryHostEdits){const count=result.split(from).length-1;if(count!==1)throw new Error('Trajectory host scope drift: '+label+' count '+count);result=result.replace(from,to);}return result;}
