import {createPyroSmokeState} from './pyro-smoke-state.js';
import {createPyroSmokeEvents} from './pyro-smoke-events.js';
import {createPyroSmokeColumns} from './pyro-smoke-columns.js';
import {createPyroSmokeRenderer} from './pyro-smoke-renderer.js';

// Host for one physical state, source event stream and its optical consumers.
// Integration is opt-in; no camera/exposure-dependent physical mass or ageing.
export function createPyroSmoke(THREE,renderer,{time=0,wind=[0,0,0],capacity=4096}={}){
  let state=createPyroSmokeState({time,wind,capacity}),currentWind=[...wind],physicalTime=time,snapshot=state.snapshot(),revision=snapshot.revision;
  const events=createPyroSmokeEvents({state}),columns=createPyroSmokeColumns(snapshot),volume=createPyroSmokeRenderer(THREE,renderer,{maxPackets:capacity});
  volume.setState(snapshot);let explicitlyCleared=0,clears=0,lastUpdateMs=0;
  function refresh(){const d=state.diagnostics();if(d.revision===revision)return;const start=performance.now();snapshot=state.snapshot();columns.update(snapshot);volume.setState(snapshot);revision=d.revision;lastUpdateMs=performance.now()-start;}
  return{
    update({time:now,windVector=currentWind,events:sourceEvents=[]}={}){
      if(!Number.isFinite(now)||now<physicalTime)throw new RangeError('Smoke physical time cannot rewind');
      if(windVector.some((v,i)=>v!==currentWind[i])){state.setWind({time:now,velocity:windVector});currentWind=[...windVector];}
      events.consume(sourceEvents,{throughTime:now});const advanced=state.advanceTo(now);physicalTime=now;refresh();return advanced;
    },
    clear(){
      // Explicit user operation; old mass is accounted for, not an age fade.
      const old=state.diagnostics();explicitlyCleared+=old.ledger.airborne+old.ledger.pendingMass;
      const next=createPyroSmokeState({time:physicalTime,wind:currentWind,capacity});events.clearForState(next,{time:physicalTime});state=next;snapshot=state.snapshot();revision=snapshot.revision;columns.update(snapshot);volume.setState(snapshot);clears++;
    },
    transmission(origin,endpoint,{reflection=false,planeY=0}={}){
      if(!snapshot.packets.length)return[1,1,1];let start=origin;
      if(reflection){const dy=endpoint[1]-origin[1],t=(planeY-origin[1])/dy;if(!Number.isFinite(t)||t<0||t>1)return[1,1,1];start=origin.map((v,i)=>v+(endpoint[i]-v)*t);}
      return columns.between(start,endpoint).T;
    },
    render(options){return volume.render(options);},
    get packetCount(){return snapshot.packets.length;},
    getRadianceBound(lighting,options){return snapshot.packets.length?volume.getRadianceBound(lighting,options):{maxRGB:0};},
    // The render cache is keyed by density revision. Empty clocks/wind headers
    // can advance without changing that revision, so public snapshots are live.
    snapshot(){return state.snapshot();},
    diagnostics(){const physical=state.diagnostics();return{requestedPhysicalTime:physicalTime,committedPhysicalTime:physical.time,behindSeconds:Math.max(0,physicalTime-physical.time),state:physical,events:events.diagnostics(),columns:columns.diagnostics(),rendering:volume.diagnostics(),explicitlyCleared,clears,lastUpdateMs,
      limits:['Physical transport uses fixed20Hz state commits; it is not a fluid/turbulence/settling solver.','Source-path extinction is queried at emitter/tail anchors; it is not exact per-pixel convolution through a varying medium.','Whole-space neutral Gaussian medium; scattering, overlap order and clear-air folding retain the renderer StageA approximations.']};},
    dispose(){volume.dispose();}
  };
}
