// Offline supplement only: re-evaluate the accepted-pose contract from saved
// live witnesses. This never edits the original report, images or runtime.
import fs from 'node:fs';
import crypto from 'node:crypto';
import path from 'node:path';
const sourcePath='verification/pyro-smoke-kernel-scene-first.json';
const outputPath='verification/pyro-smoke-kernel-scene-offline-recheck.json';
const hash=b=>crypto.createHash('sha256').update(b).digest('hex');
const input=fs.readFileSync(sourcePath),r=JSON.parse(input),checks=[];
const check=(id,passed,evidence={})=>checks.push({id,passed:!!passed,...evidence});
const same=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
const near=(a,b,t=1e-8)=>Number.isFinite(a)&&Number.isFinite(b)&&Math.abs(a-b)<=t;
const distance=(a,b)=>Math.hypot(...a.map((x,i)=>x-b[i]));
const ids=['point20','segment20','point05','segment05'];
const angles=['front','oblique','detail'];
const expectedFailed=angles.slice(0,2).flatMap(angle=>ids.map(id=>angle+'_'+id+': same I raw clusters camera C and quality'));
const originalFailed=r.checks.filter(c=>!c.passed).map(c=>c.id);
check('original48of56_preserved_and_only_eight_requested_pose_gates_failed',r.passed===false&&r.technicalPassed===false&&r.passedCount===48&&r.total===56&&r.checks.length===56&&same(originalFailed,expectedFailed),{originalPassed:r.passedCount,originalTotal:r.total,originalFailed});
check('exact_twelve_unique_actual_capture_rows_and_images',r.captures.length===12&&angles.every(angle=>ids.every(id=>r.captures.filter(c=>c.angle===angle&&c.id===id).length===1))&&Object.keys(r.images).length===12);
const first=r.captures[0],poses={},images={};
for(const angle of angles){
  const rows=r.captures.filter(c=>c.angle===angle),accepted={camera:rows[0].camera,target:rows[0].target},requested=r.controls[angle],offset=requested.camera.map((x,i)=>x-requested.target[i]),requestedDistance=Math.hypot(...offset),scale=Math.min(1,230/requestedDistance),expectedCamera=requested.target.map((x,i)=>x+offset[i]*scale);
  poses[angle]={requested,accepted,requestedDistance,acceptedDistance:distance(accepted.camera,accepted.target),cameraOffsetMetres:distance(accepted.camera,requested.camera),clampOracleMaximumError:distance(accepted.camera,expectedCamera),maximumInterVariantCameraDistance:Math.max(...rows.map(c=>distance(c.camera,accepted.camera))),maximumInterVariantTargetDistance:Math.max(...rows.map(c=>distance(c.target,accepted.target)))};
  check(angle+': all_four_actual_camera_and_target_arrays_are_bit_identical',rows.length===4&&rows.every(c=>same(c.camera,accepted.camera)&&same(c.target,accepted.target)),poses[angle]);
  check(angle+': requested_to_actual_difference_is_230m_radial_OrbitControls_clamp',distance(accepted.camera,expectedCamera)<1e-8&&distance(accepted.target,requested.target)<1e-8,{distanceToleranceMetres:1e-8,oracleMaximumError:poses[angle].clampOracleMaximumError,sourceEvidence:'main.js controls.maxDistance=230; this is the observed first-run limit, not a new runtime setting'});
  for(const c of rows){
    const correctedGate=same(c.clusters,first.clusters)&&near(c.photometry.cameraEV,16.5)&&same(c.quality,first.quality)&&distance(c.camera,accepted.camera)<1e-8&&distance(c.target,accepted.target)<1e-8&&r.launch.intensityScale===16&&r.launch.id===c.clusters[0]?.eventId;
    check(angle+'_'+c.id+': accepted_pose_I_raw_clusters_C_quality_gate',correctedGate,{distanceToleranceMetres:1e-8,cameraEV:c.photometry.cameraEV,intensityScale:r.launch.intensityScale,eventId:r.launch.id});
    const key=angle+'_'+c.id,file=path.resolve(r.images[key]),buffer=fs.readFileSync(file),width=buffer.readUInt32BE(16),height=buffer.readUInt32BE(20);
    images[key]={file,bytes:buffer.length,sha256:hash(buffer),width,height};
    check(key+': saved_PNG_matches_recorded_actual_render_size',buffer.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10]))&&width===c.quality.outputWidth&&height===c.quality.outputHeight);
  }
}
check('one_physical_event_phase_C_and_28mm_lens_for_all_twelve',r.controls.physicalEventCount===1&&r.launch.accepted&&!r.launch.queued&&near(r.actualTime,r.launch.burstTime+1.1)&&r.captures.every(c=>c.time===r.actualTime&&c.photometry.cameraEV===16.5&&c.lens.focalMm===28),{actualTime:r.actualTime,phaseSeconds:r.actualTime-r.launch.burstTime});
check('all_twelve_original_live_full_snapshot_freeze_witnesses_pass',angles.every(angle=>ids.every(id=>r.checks.find(c=>c.id===angle+'_'+id+': exact same paused physical snapshot across all hosts')?.passed===true)),{scope:'This consumes the saved live exact-equality witness; no offline rerender or new GPU run is claimed.'});
check('all_four_density_snapshots_share24_M20_35_clock_and_no_merge',ids.every(id=>{const s=r.frozenSnapshots[id],d=r.frozenDiagnostics[id];return s.packets.length===24&&near(s.ledger.airborne,20.35,2e-10)&&s.time===r.frozenSnapshots.point20.time&&s.requestedTime===r.actualTime&&s.pendingEmissions===0&&d.state.forcedMerges===0;}),{committedTimes:r.committedTimes});
check('storage_P_stable_within_each_angle_and_compensation_correct',angles.every(angle=>{const rows=r.captures.filter(c=>c.angle===angle);return rows.every(c=>near(c.photometry.storageEV,rows[0].photometry.storageEV,1e-10)&&near(c.range.storageEV,c.photometry.storageEV,1e-10)&&Math.abs(c.photometry.outputExposureScale/(.76*2**(c.photometry.cameraEV-c.photometry.storageEV))-1)<1e-12);}),{PbyAngle:Object.fromEntries(angles.map(angle=>[angle,r.captures.find(c=>c.angle===angle).photometry.storageEV])),scope:'P differs by viewing bound; C remains16.5. No P is overridden.'});
const envSignature=c=>{const e=c.photometry.environment;return{cubeTag:e.cubeTag,environmentTag:e.environmentTag,revision:e.revision,pmremRevision:e.pmremRevision,jobFace:e.job?.face};};
check('raw_cube_PMREM_capture_tags_and_revisions_fixed_across_all_twelve',r.captures.every(c=>same(envSignature(c),envSignature(first))),{environment:envSignature(first),scope:'Scene-EV/ratio metadata can differ when safe P changes; raw capture radiance and tags do not.'});
check('all_saved_actual_main_composed_reflection_ranges_finite_nonnegative_bounded',r.captures.every(c=>['opaque','composed','reflection'].every(k=>{const v=c.range[k];return v.countNaN===0&&v.countInf===0&&v.countNegative===0&&v.counterConsistency&&v.stateRestored&&Number.isFinite(v.globalMax)&&v.globalMax<=c.photometry.safeMaximum*(1+1e-4);})));
check('runtime_sources_and_audio_gain_witnesses_unchanged_and_no_live_errors',same(r.sourceSHA256Before,r.sourceSHA256After)&&same(r.audioBefore,r.audioAfter)&&r.runtimeErrors.length===0&&!r.failure);
const baselinePath='verification/baselines/smoke-kernel-helper-before-accepted-pose/pyro-smoke-kernel-scene-check.js';
const baselineHash=hash(fs.readFileSync(baselinePath));
check('pre_fix_helper_baseline_matches_actual_run_version',baselineHash==='da4c675b0a429ae26a86de0d8db0a8b0bb943b41586a61cd906836ab45245f65',{baselinePath,sha256:baselineHash});
check('original_report_bytes_were_not_modified',hash(fs.readFileSync(sourcePath))===hash(input));
const passed=checks.every(c=>c.passed),report={schema:'glass-atoll.smoke-kernel-saved-evidence-recheck.v1',dateUTC:new Date().toISOString(),passed,technicalComparisonSupported:passed,visualAcceptance:'pending_root_review',checks,counts:{passed:checks.filter(c=>c.passed).length,total:checks.length},original:{path:sourcePath,sha256:hash(input),passed:r.passed,technicalPassed:r.technicalPassed,passedCount:r.passedCount,total:r.total},correctedGateInterpretation:{originalLivePassedGates:48,offlineAcceptedPoseGatesSupported:passed?8:null,totalSupported:passed?56:null,newGPUChecksRun:0,newRenders:0,toleranceMetres:1e-8},poses,images,helper:{baselinePath,baselineSHA256:baselineHash,currentPath:'verification/pyro-smoke-kernel-scene-check.js',currentSHA256:hash(fs.readFileSync('verification/pyro-smoke-kernel-scene-check.js'))},limits:['Original first48/56 JSON and twelve PNGs remain unchanged; this is a separately hashed offline supplement, not replacement of failed evidence.','All four actual positions/targets per angle are bit identical, although front/oblique requested positions were radially clamped to230m.','Saved live snapshots, range scans and source records are evidence consumed here, not re-executed GPU tests or cryptographic image-time attestation.','No visual approval, frame-time claim, density/radiance model accuracy or production-default source selection follows from these technical gates.']};
fs.writeFileSync(outputPath,JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({passed,counts:report.counts,failed:checks.filter(c=>!c.passed),original:report.original,poses,outputPath},null,2));
if(!passed)process.exitCode=1;
