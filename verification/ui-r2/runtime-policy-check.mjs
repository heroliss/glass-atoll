import assert from 'node:assert/strict';
import fs from 'node:fs';
import {resolveSmokeMode,createSmokeEpochAdmission} from '../../smoke-runtime-policy.js';
import {createFireworkEvent,createFireworksSimulation,sampleBody,sampleBodyEmission} from '../../fireworks-physics.js';
import {getQualityPreset} from '../../quality-presets.js';
import * as THREE from '../../vendor/three.module.js';
import {createFireworks} from '../../fireworks.js';
const results=[];
function check(name,fn){fn();results.push({name,passed:true});}
check('Explicit smoke modes and legacy control resolve consistently; invalid modes reject',()=>{
  assert.deepEqual(resolveSmokeMode({smokeQuality:'light'}),{smokeQuality:'light',persistentSmoke:false});
  assert.deepEqual(resolveSmokeMode({persistentSmoke:true}),{smokeQuality:'full',persistentSmoke:true});
  assert.deepEqual(resolveSmokeMode({persistentSmoke:false}),{smokeQuality:'off',persistentSmoke:false});
  assert.equal(resolveSmokeMode({}, {smokeQuality:'light'}).smokeQuality,'light');
  assert.throws(()=>resolveSmokeMode({smokeQuality:'magic'}));
});
check('A fresh smoke epoch rejects orphan bursts, accepts new launch/burst, and resets',()=>{
  const gate=createSmokeEpochAdmission(),old={kind:'burst',eventId:'old',time:5},launch={kind:'launch',eventId:'new',time:6},burst={kind:'burst',eventId:'new',time:10};
  assert.deepEqual(gate.accept([old,launch,burst],10),[launch,burst]);
  gate.reset();assert.deepEqual(gate.accept([burst],10),[]);
  gate.accept([launch],11);gate.accept([],132);assert.equal(gate.size,0);
});
check('Brighter runtime reference preserves physical trajectories and scales every sampled source exactly once',()=>{
  for(const type of ['peony','chrysanthemum','willow','palm','ring','heart','fan','bouquet']){
    for(const profile of type==='chrysanthemum'?['legacy','three-heart-v1','three-heart-radiant120-v1','two-colour-v1']:['legacy']){
      const options={type,seed:14271,effectProfile:profile,starDragModel:'bounded-descent'};
      const old=createFireworkEvent(options),bright=createFireworkEvent({...options,referenceBrightnessGain:64});
      assert.equal(bright.burstTime,old.burstTime);assert.deepEqual(bright.burstPosition,old.burstPosition);
      for(let i=0;i<old.heads.length;i++){
        const a=old.heads[i],b=bright.heads[i],age=a.life*.4;
        assert.deepEqual(sampleBody(a,a.birth+age),sampleBody(b,b.birth+age));
        const x=sampleBodyEmission(a,age),y=sampleBodyEmission(b,age);
        for(let c=0;c<3;c++)assert.ok(Math.abs(y.emissionRGBReference[c]-x.emissionRGBReference[c]*64)<1e-8);
      }
    }
  }
});
check('Factory reference does not overwrite the user gain and zero still emits no light',()=>{
  const a=createFireworksSimulation({referenceBrightnessGain:64});a.launch({type:'peony',intensityScale:0});
  assert.equal(a.state.referenceBrightnessGain,64);assert.equal(a.active[0].intensityScale,0);
  assert.ok(a.active[0].heads.every(b=>b.intensity===0));
  assert.throws(()=>createFireworksSimulation({referenceBrightnessGain:Infinity}));
});
check('Recommended preset reduces actual MSAA/reflection allocations while retaining shadow/wave resolution',()=>{
  const q=getQualityPreset('medium').request;
  assert.equal(q.msaaSamples,4);assert.equal(q.reflectionScale,.75);assert.equal(q.reflectionSamples,0);
  assert.equal(q.shadowSize,4096);assert.equal(q.waveResolution,512);
});
check('Clearing short smoke preserves luminous bodies and future launches still emit smoke',()=>{
  const firework=createFireworks(THREE);firework.configure({type:'peony'});
  const event=firework.launch({seed:42});firework.update({time:event.burstTime+1,windVector:[0,0,0]});
  const count=firework.diagnostics().records,ledger=firework.getEmissionLedger().count;
  firework.clearLegacySmoke();assert.ok(firework.diagnostics().records<count);assert.equal(firework.getEmissionLedger().count,ledger);
  firework.update({time:event.burstTime+1.1,windVector:[0,0,0]});assert.equal(firework.diagnostics().records,firework.getEmissionLedger().count);
  const next=firework.launch({seed:43});firework.update({time:next.burstTime+1,windVector:[0,0,0]});
  assert.ok(firework.diagnostics().records>firework.getEmissionLedger().count);firework.dispose();
});
const report={passed:true,scope:'CPU policies, trajectories, actual emission model, preset requests; no GPU/FPS claim',results};
fs.writeFileSync(new URL('./runtime-policy-check.json',import.meta.url),JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({passed:true,total:results.length}));
