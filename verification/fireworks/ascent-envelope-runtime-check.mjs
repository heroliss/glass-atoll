// Real current factories/physics versus sealed pre-ascent sources. CPU only;
// the only allowed render changes are carrier I and its eight temporal weights.
import fs from 'node:fs';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import * as THREE from '../../vendor/three.module.js';
import * as currentPhysics from '../../fireworks-physics.js';
import {ascentEffectEnvelope} from './ascent-envelope-prototype.mjs';
import {ascentPhysicsEdits,ascentFireworksEdits,normalizeAscentPhysicsSource,normalizeAscentFireworksSource} from './ascent-default-normalize.mjs';
const root=new URL('../../',import.meta.url),read=p=>fs.readFileSync(new URL(p,root),'utf8'),hash=x=>crypto.createHash('sha256').update(x).digest('hex');
const physics=read('fireworks-physics.js'),source=read('fireworks.js'),oldPhysics=read('verification/baselines/fireworks-before-ascent-envelope/fireworks-physics.js'),oldSource=read('verification/baselines/fireworks-before-ascent-envelope/fireworks.js');
const url=s=>'data:text/javascript;base64,'+Buffer.from(s).toString('base64');
const oldPhysicsURL=url(oldPhysics.replace("from './wind-response.js'",'from '+JSON.stringify(new URL('wind-response.js',root).href)));
const beforePhysics=await import(oldPhysicsURL),checks=[];
async function instrument(s,p){const exact='api.configure({});return api;';assert.equal(s.split(exact).length-1,1);return(await import(url(s.replace("from './fireworks-physics.js'",'from '+JSON.stringify(p)).replace(exact,'api.configure({});Object.defineProperties(api,{__qaSimulation:{value:simulation},__qaRecords:{get:()=>records},__qaArrays:{get:()=>arrays},__qaFill:{value:fillRecords}});return api;')))).createFireworks;}
const currentFactory=await instrument(source,new URL('fireworks-physics.js',root).href),beforeFactory=await instrument(oldSource,oldPhysicsURL);
function check(name,fn){try{const evidence=fn();checks.push({name,passed:true,evidence});}catch(error){checks.push({name,passed:false,error:String(error.stack||error).slice(0,5000)});}}
const near=(a,b)=>assert(Math.abs(a-b)<=2e-12*Math.max(1,Math.abs(a),Math.abs(b)),`${a} vs ${b}`);
check('sealed preascent sources and exact twoPhysics fiveFW inverse preserve every other byte',()=>{
  assert.equal(hash(oldPhysics),'3bbac1976fccf39dbb9fefdfd04bfdb5ae7fa8e26edbbe1169373d01130486df');assert.equal(hash(oldSource),'963bc4fef5167bebebf84f1075072166f222ff4e4e1b8b4384b470ed44bb5310');
  assert.equal(normalizeAscentPhysicsSource(physics),oldPhysics);assert.equal(normalizeAscentFireworksSource(source),oldSource);return{physicsEdits:2,FWEdits:5};
});
check('missing duplicated and unrelated mutations fail closed without broadsource stripping',()=>{
  for(const [s,edits,normalize]of [[physics,ascentPhysicsEdits,normalizeAscentPhysicsSource],[source,ascentFireworksEdits,normalizeAscentFireworksSource]])for(const [,from]of edits){assert.throws(()=>normalize(s.replace(from,'')));assert.throws(()=>normalize(s+from));}
  assert.notEqual(normalizeAscentPhysicsSource(physics.replace('G=9.81','G=9.80')),oldPhysics);
  assert.notEqual(normalizeAscentFireworksSource(source.replace('vShape.z*uRawPerCandela','vShape.z*.9*uRawPerCandela')),oldSource);return{inverseNegativeCases:14,unrelatedMutationsPreserved:2};
});
check('production carrier envelope exactly matches reviewed throughburst prototype not earlycoast',()=>{
  let samples=0;for(const life of [.01,3,4.6583789583,5.3311211926,5.7750242737,10])for(let i=-2;i<=1002;i++){
    const body={kind:'rocket',life},age=life*i/1000,a=currentPhysics.bodyEmissionEnvelope(body,age),b=ascentEffectEnvelope(body,age);near(a,b);assert(a>=0&&a<=1);samples++;
  }return{samples,attackSeconds:.12,fadeSeconds:.4,coastSeconds:0};
});
check('pure events trajectories RNG I colours sound clocks and all noncarrier samples are exact',()=>{
  let events=0,particles=0;for(const type of currentPhysics.FIREWORK_TYPES)for(const intensityScale of [0,1,16]){
    const opts={type:type.id,seed:42,intensityScale,origin:[29,1.5,7],elevation:80},a=currentPhysics.createFireworkEvent(opts),b=beforePhysics.createFireworkEvent(opts);assert.deepEqual(a,b);events++;
    for(const time of [0,.03,.06,.12,.3,a.burstTime-.2,a.burstTime+.01,a.burstTime+.3,a.burstTime+1.1]){
      const x=currentPhysics.sampleFireworkEvent(a,time),y=beforePhysics.sampleFireworkEvent(b,time);assert.equal(x.length,y.length);
      for(let i=0;i<x.length;i++){if(x[i].kind==='rocket'){assert.equal(x[i].emission,currentPhysics.bodyEmissionEnvelope(a.rocket,time-a.time));assert.deepEqual({...x[i],emission:y[i].emission},y[i]);}else assert.deepEqual(x[i],y[i]);particles++;}
    }
  }return{events,particles,noncarrierTolerance:0};
});
const cam=new THREE.PerspectiveCamera(48,16/9,.15,24000);cam.position.set(-40,15,-120);cam.lookAt(29,110,7);cam.updateMatrixWorld();
function rowsOf(f){return f.__qaRecords;}
function activeArrays(f,count){return Object.fromEntries(Object.entries(f.__qaArrays).map(([key,value])=>[key,Array.from(value.subarray(0,count*(['shape','temporal0','temporal1'].includes(key)?4:3)))]));}
let pairs=0,frames=0,postburstFrames=0,carrierRows=0,temporalWeights=0,ledgerRows=0,legacySmokeLightChanged=0;
check('real FW head tail eightshutter cluster ledger sound and postburst ground comparisons',()=>{
  for(const type of currentPhysics.FIREWORK_TYPES)for(const windMode of ['constant','changing']){
    const make=factory=>{const f=factory(THREE,{terrainHeight:()=>0,origin:[29,0,7]});f.configure({autoLaunch:false,autoDirection:false,elevation:80});f.update({time:0,windVector:[0,0,0]});const launch=f.launch({type:type.id,seed:42});return{f,launch};};
    const a=make(currentFactory),b=make(beforeFactory);pairs++;try{
      assert.deepEqual(a.launch,b.launch);const life=a.launch.burstTime,tailWindow=type.id==='willow'?.88:type.id==='palm'?.62:.5;
      const times=[...new Set([0,.03,.06,.12,.3,Math.max(0,life-.41),Math.max(0,life-.2),Math.max(0,life-.001),life+.001,life+.1,life+.3,life+.51,life+.91,life+1.1,life+2])].sort((x,y)=>x-y);
      for(const time of times){const windVector=windMode==='constant'?[1.8,0,.3]:[1.8+Math.sin(time)*.3,0,Math.cos(time)*.5];for(const x of [a,b])x.f.update({time,windVector});
        const x=rowsOf(a.f),y=rowsOf(b.f);assert.equal(x.length,y.length);frames++;
        assert.deepEqual(a.f.__qaSimulation.active,b.f.__qaSimulation.active);assert.deepEqual(a.f.drainEvents(),b.f.drainEvents());
        assert.deepEqual(a.f.smokeSourceProvider.describe(a.launch.id),b.f.smokeSourceProvider.describe(b.launch.id));
        for(let i=0;i<x.length;i++){
          if(x[i].sourceBody?.kind==='rocket'){
            assert.deepEqual({...x[i],intensity:y[i].intensity},y[i]);near(x[i].intensity,(x[i].unmodulatedIntensity??0)*currentPhysics.bodyEmissionEnvelope(x[i].sourceBody,x[i].sourceAge));assert(x[i].intensity<=y[i].intensity+1e-12);carrierRows++;
          }else assert.deepEqual(x[i],y[i]);
        }
        for(const shutter of [1/120,0]){
          // Current persistent-smoke production path suppresses the legacy
          // sprites; it must not weaken unaffected emitter attribute equality.
          const countA=a.f.__qaFill(cam,null,3.6e-5,shutter,null,false),countB=b.f.__qaFill(cam,null,3.6e-5,shutter,null,false);assert.equal(countA,countB);
          const aa=activeArrays(a.f,countA),bb=activeArrays(b.f,countB);
          for(const key of Object.keys(aa))if(!key.startsWith('temporal'))assert.deepEqual(aa[key],bb[key]);
          const ordered=x.filter(p=>p.kind!=='smoke').map(p=>({p,z:new THREE.Vector3(...p.position).applyMatrix4(cam.matrixWorldInverse).z})).sort((p,q)=>p.z-q.z);
          for(let i=0;i<ordered.length;i++){const p=ordered[i].p;for(let k=0;k<8;k++){
            const key=k<4?'temporal0':'temporal1',offset=i*4+k%4;
            if(p.sourceBody?.kind==='rocket'){assert.equal(aa[key][offset],Math.fround(currentPhysics.bodyEmissionEnvelope(p.sourceBody,p.sourceAge+((k+.5)/8-.5)*shutter)));temporalWeights++;}
            else assert.equal(aa[key][offset],bb[key][offset]);
          }}
        }
        // The old smoke-only sprite path intentionally responds to its same
        // raw cluster. Before residual carrier tails expire it can change
        // derived light, but no positions, shape, source RGB or mass change.
        const legacyCount=a.f.__qaFill(cam,null,3.6e-5,0),oldLegacyCount=b.f.__qaFill(cam,null,3.6e-5,0);assert.equal(legacyCount,oldLegacyCount);
        const la=activeArrays(a.f,legacyCount),lb=activeArrays(b.f,oldLegacyCount);
        for(const key of Object.keys(la))if(!key.startsWith('temporal')&&key!=='smokeLight')assert.deepEqual(la[key],lb[key]);
        if(type.ground||time>=life+tailWindow+.01)assert.deepEqual(la,lb);
        else for(let i=0;i<la.smokeLight.length;i++){assert(Number.isFinite(la.smokeLight[i])&&la.smokeLight[i]>=0);if(la.smokeLight[i]!==lb.smokeLight[i])legacySmokeLightChanged++;}
        const ledger=a.f.getEmissionLedger(),eligible=x.filter(p=>p.kind!=='smoke'&&p.intensity>0&&Math.max(...p.colour)>0);assert.equal(ledger.count,eligible.length);
        for(let i=0;i<eligible.length;i++){const p=eligible[i];for(let c=0;c<3;c++)assert.equal(ledger.data[i*8+4+c],Math.fround(p.intensity*p.colour[c]*ledger.rawPerCandela));ledgerRows++;}
        const clusters=a.f.getLightClusters();near(clusters.reduce((n,p)=>n+p.referenceCandela,0),x.filter(p=>p.kind==='star').reduce((n,p)=>n+p.intensity,0));
        if(type.ground||time>=life+tailWindow+.01){assert.deepEqual(x,y);assert.deepEqual(a.f.getLightClusters(),b.f.getLightClusters());
          // Equal call counts preserve ledger versions; compare active rows and
          // all public metadata rather than unused borrowed backing capacity.
          const old=b.f.getEmissionLedger();assert.equal(ledger.count,old.count);assert.deepEqual(Array.from(ledger.data.subarray(0,ledger.count*8)),Array.from(old.data.subarray(0,old.count*8)));
          assert.deepEqual(a.f.getRadianceBound({camera:cam}),b.f.getRadianceBound({camera:cam}));postburstFrames++;
        }
      }
    }finally{a.f.dispose();b.f.dispose();}
  }return{pairs,frames,postburstOrGroundFrames:postburstFrames,carrierRows,temporalWeights,ledgerRows,legacySmokeLightChanged,postburstAtPlus1point1Exact:true,sourceAndNoncarrierTolerance:0};
});
check('combustion role identity hierarchy and unknownmaterial remain exact except declared light meaning',()=>{
  let graphs=0;for(const type of currentPhysics.FIREWORK_TYPES){const a=currentFactory(THREE),b=beforeFactory(THREE);try{const la=a.launch({type:type.id,seed:42}),lb=b.launch({type:type.id,seed:42});
    const x=a.smokeSourceProvider.describeCombustion(la.id),y=b.smokeSourceProvider.describeCombustion(lb.id),adjusted=structuredClone(x);
    for(const node of adjusted.nodes)if(node.role==='mortar-carrier'){assert(node.combustion.includes('no sustained propulsion'));assert(node.combustion.includes('through-burst-v1'));assert.equal(node.matter.fuel,'unknown');node.combustion=y.nodes.find(old=>old.sourceID===node.sourceID).combustion;}
    assert.deepEqual(adjusted,y);graphs++;
  }finally{a.dispose();b.dispose();}}return{graphs,onlyCarrierDescriptionChanged:true};
});
const report={schema:'glass-atoll.default-ascent-envelope-CPU.v1',dateUTC:new Date().toISOString(),passed:checks.every(c=>c.passed),counts:{passed:checks.filter(c=>c.passed).length,total:checks.length},checks,
  sourceSHA256:{physics:hash(physics),fireworks:hash(source),audio:hash(read('fireworks-audio.js'))},actualGPU:false,
  limits:['Default production source now uses through-burst-v1 decorative light; no thrust or new smoke source.','This is CPU factory/attribute/source-ledger validation, not shader pixels or visual movie acceptance.','Original optical unmodulated bound stays conservative; no temporal tightening.']};
fs.writeFileSync(new URL('./ascent-envelope-runtime-check.json',import.meta.url),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({passed:report.passed,counts:report.counts,failed:checks.filter(c=>!c.passed),metrics:{pairs,frames,postburstFrames,carrierRows,temporalWeights,ledgerRows}},null,2));if(!report.passed)process.exitCode=1;
