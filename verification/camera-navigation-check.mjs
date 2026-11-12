import fs from 'node:fs';
import * as THREE from '../vendor/three.module.js';
import {createCameraNavigation} from '../camera-navigation.js';
const checks=[],check=(id,passed,details={})=>checks.push({id,passed:!!passed,...details});
class FakeTarget{
  constructor(){this.listeners=new Map();this.captured=new Set();this.hidden=false;}
  addEventListener(type,fn){if(!this.listeners.has(type))this.listeners.set(type,new Set());this.listeners.get(type).add(fn);}
  removeEventListener(type,fn){this.listeners.get(type)?.delete(fn);}
  dispatch(type,fields={}){const e={target:this,preventDefault(){this.defaultPrevented=true;},stopImmediatePropagation(){this.immediateStopped=true;},...fields};for(const fn of this.listeners.get(type)||[]){fn(e);if(e.immediateStopped)break;}return e;}
  focus(){this.focused=true;}
  setPointerCapture(id){this.captured.add(id);}
  hasPointerCapture(id){return this.captured.has(id);}
  releasePointerCapture(id){this.captured.delete(id);}
  get listenerCount(){return [...this.listeners.values()].reduce((sum,s)=>sum+s.size,0);}
}
function fixture(run){
  const previousDocument=globalThis.document,previousWindow=globalThis.window,document=new FakeTarget(),window=new FakeTarget(),canvas=new FakeTarget();
  globalThis.document=document;globalThis.window=window;
  const camera=new THREE.PerspectiveCamera(45,1.6,.15,24000);camera.position.set(10,6,12);
  const controls={target:new THREE.Vector3(0,2,0),enableDamping:true,maxDistance:230,maxTargetRadius:65,update(){
    // Minimal OrbitControls clamp contract; the 1 km fixture would teleport
    // if setPivot failed to expand maxDistance or flush changed public pose.
    const offset=camera.position.clone().sub(this.target),distance=offset.length();
    if(distance>this.maxDistance)camera.position.copy(this.target).addScaledVector(offset,this.maxDistance/distance);
    camera.lookAt(this.target);
  }};
  camera.lookAt(controls.target);camera.updateMatrixWorld();
  let activities=0;const navigation=createCameraNavigation(THREE,{camera,controls,canvas,onActivity(){activities++;}});
  try{return run({camera,controls,canvas,document,window,navigation,activities:()=>activities});}
  finally{navigation.dispose();if(previousDocument===undefined)delete globalThis.document;else globalThis.document=previousDocument;if(previousWindow===undefined)delete globalThis.window;else globalThis.window=previousWindow;}
}
fixture(({camera,controls,document,navigation})=>{
  const cp=camera.position.clone(),tp=controls.target.clone(),offset=cp.clone().sub(tp);document.dispatch('keydown',{code:'KeyW'});for(let i=0;i<60;i++)navigation.update(1/60);
  const dc=camera.position.clone().sub(cp),dt=controls.target.clone().sub(tp);
  check('translation_moves_camera_and_pivot_by_same_world_displacement',dc.length()>1&&dc.distanceTo(dt)<1e-10&&camera.position.clone().sub(controls.target).distanceTo(offset)<1e-10,{cameraDisplacement:dc.toArray(),targetDisplacement:dt.toArray()});
});
for(const code of ['KeyQ','KeyE','KeyR','KeyF'])fixture(({camera,controls,document,navigation})=>{
  const cp=camera.position.clone(),tp=controls.target.clone(),q=camera.quaternion.clone(),distance=cp.distanceTo(tp);document.dispatch('keydown',{code});navigation.update(.04);
  check('in_place_look_'+code,camera.position.distanceTo(cp)<1e-12&&controls.target.distanceTo(tp)>.01&&camera.quaternion.angleTo(q)>.01&&Math.abs(camera.position.distanceTo(controls.target)-distance)<1e-10);
});
function travel(boost,diagonal=false){return fixture(({camera,document,navigation})=>{const p=camera.position.clone();if(boost)document.dispatch('keydown',{code:'ShiftLeft'});document.dispatch('keydown',{code:'KeyW'});if(diagonal)document.dispatch('keydown',{code:'KeyD'});for(let i=0;i<120;i++)navigation.update(1/60);return camera.position.distanceTo(p);});}
const base=travel(false),boost=travel(true);check('sustained_shift_boost_is_four_times_same_duration_travel',Math.abs(boost/base-4)<1e-10,{baseMetres:base,boostMetres:boost,ratio:boost/base});
const diagonal=travel(false,true);check('diagonal_translation_does_not_exceed_straight_speed',Math.abs(diagonal/base-1)<1e-10,{straightMetres:base,diagonalMetres:diagonal});
fixture(({camera,controls,canvas,navigation})=>{
  const cp=camera.position.clone(),tp=controls.target.clone(),distance=cp.distanceTo(tp);
  const down=canvas.dispatch('pointerdown',{button:2,clientX:50,clientY:50,pointerId:7});canvas.dispatch('pointermove',{clientX:160,clientY:90,pointerId:7});canvas.dispatch('pointerup',{button:2,pointerId:7});
  for(let i=0;i<12;i++)navigation.update(1/60);
  check('right_drag_turns_target_without_translating_camera',camera.position.distanceTo(cp)<1e-12&&controls.target.distanceTo(tp)>.1&&Math.abs(camera.position.distanceTo(controls.target)-distance)<1e-10&&down.defaultPrevented&&down.immediateStopped&&canvas.focused&&!canvas.hasPointerCapture(7));
});
fixture(({camera,document,navigation})=>{
  const cp=camera.position.clone();let intercepted=0;
  for(const target of [{tagName:'INPUT'},{tagName:'SELECT'},{tagName:'TEXTAREA'},{tagName:'DIV',isContentEditable:true}]){const e=document.dispatch('keydown',{code:'KeyW',target});if(e.defaultPrevented)intercepted++;navigation.update(.04);}
  check('editable_controls_keep_keyboard_input',intercepted===0&&navigation.state.keys.length===0&&camera.position.distanceTo(cp)<1e-12);
  const events=[document.dispatch('keydown',{code:'KeyW',ctrlKey:true}),document.dispatch('keydown',{code:'KeyQ',altKey:true}),document.dispatch('keydown',{code:'KeyR',metaKey:true})];
  check('system_modifier_shortcuts_are_not_intercepted',events.every(e=>!e.defaultPrevented)&&navigation.state.keys.length===0);
});
fixture(({camera,document,window,navigation})=>{
  document.dispatch('keydown',{code:'KeyW'});navigation.update(.05);window.dispatch('blur');const p=camera.position.clone();navigation.update(.05);
  check('blur_clears_keys_and_velocity',navigation.state.keys.length===0&&navigation.state.velocity.every(v=>v===0)&&camera.position.distanceTo(p)<1e-12);
  document.dispatch('keydown',{code:'KeyD'});navigation.update(.03);document.hidden=true;document.dispatch('visibilitychange');const after=camera.position.clone();navigation.update(.05);
  check('hidden_document_clears_motion',navigation.state.keys.length===0&&camera.position.distanceTo(after)<1e-12);
});
fixture(({camera,controls,navigation})=>{
  camera.position.set(1000,20,-40);camera.lookAt(controls.target);const position=camera.position.clone(),pivot=new THREE.Vector3(0,2.5,0);navigation.setPivot(pivot);controls.update();
  check('one_kilometre_pivot_change_does_not_teleport_camera',camera.position.distanceTo(position)<1e-10&&controls.target.distanceTo(pivot)<1e-12&&controls.maxDistance>=position.distanceTo(pivot),{position:camera.position.toArray(),maxDistance:controls.maxDistance});
});
fixture(({camera,document,navigation})=>{
  const p=camera.position.clone();document.dispatch('keydown',{code:'KeyW'});navigation.update(10);
  check('long_frame_has_bounded_translation',camera.position.distanceTo(p)<.31,{displacementMetres:camera.position.distanceTo(p)});
});
fixture(({camera,document,window,canvas,navigation})=>{
  navigation.dispose();const before=camera.position.clone();document.dispatch('keydown',{code:'KeyW'});navigation.update(.05);
  check('dispose_removes_owned_listeners',document.listenerCount+window.listenerCount+canvas.listenerCount===0&&camera.position.distanceTo(before)<1e-12);
});
const report={date:new Date().toISOString(),status:checks.every(c=>c.passed)?'passed':'failed',summary:{passed:checks.filter(c=>c.passed).length,total:checks.length},checks,scope:'Node + vendored Three geometric/navigation invariants with fake event targets; no renderer or browser',limits:['Fake EventTarget does not validate native DOM pointer capture ordering or keyboard delivery','Minimal OrbitControls distance-clamp contract, not the full damping internals','Actual keyboard, right-drag, Home/Alt and UI focus acceptance remain the scene owner browser tests']};
fs.writeFileSync(new URL('./camera-navigation-check.json',import.meta.url),JSON.stringify(report,null,2));console.log(JSON.stringify({status:report.status,...report.summary,failed:checks.filter(c=>!c.passed)}));if(report.status!=='passed')process.exitCode=1;
