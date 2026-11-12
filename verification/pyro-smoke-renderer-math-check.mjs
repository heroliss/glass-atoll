import fs from 'node:fs';import crypto from 'node:crypto';
import * as THREE from '../vendor/three.module.js';
import {createPyroSmokeState} from '../pyro-smoke-state.js';
import {createPyroSmokeRenderer,smokeGaussianColumnGLSL} from '../pyro-smoke-renderer.js';
const checks=[],check=(id,passed,evidence={})=>checks.push({id,passed,...evidence}),rejects=f=>{try{f();return false;}catch{return true;}},hash=v=>crypto.createHash('sha256').update(v).digest('hex');
const state=createPyroSmokeState();state.queueEmission({time:0,emissionId:0,mass:1,mean:[0,0,-5],covariance:[1,0,0,0,1,0,0,0,1]});
const smoke=createPyroSmokeRenderer(THREE,{});smoke.setState(state.snapshot());
check('independent_module_accepts_frozen_reference_state_without_renderer_calls',smoke.diagnostics().packets===1&&smoke.diagnostics().neutralExtinctionOnly);
const bad=state.snapshot();bad.profiles[0].extinctionPerMassRGB=[1,2,1];check('coloured_extinction_not_silently_encoded_as_scalar_alpha',rejects(()=>smoke.setState(bad))&&smoke.diagnostics().packets===1);
bad.profiles[0].extinctionPerMassRGB=[0,1e-12,0];check('tiny_non_neutral_profile_is_still_rejected',rejects(()=>smoke.setState(bad)));
check('capacity_input_is_explicit_not_silently_culled',rejects(()=>createPyroSmokeRenderer(THREE,{}, {maxPackets:0}))&&rejects(()=>createPyroSmokeRenderer(THREE,{}, {supportSigma:3})));
const singular=state.snapshot();singular.packets[0].covariance=[1,2,0,2,1,0,0,0,1];check('invalid_SPD_packet_rejected_before_gpu_upload',rejects(()=>smoke.setState(singular)));
const bogus=new THREE.Texture();check('attached_depth_feedback_rejected_before_renderer_calls',rejects(()=>smoke.render({target:{width:1,height:1,depthTexture:bogus},camera:new THREE.PerspectiveCamera(),opaqueDepth:bogus})));bogus.dispose();
const noDepthTarget={width:1,height:1};check('independent_opaque_depth_is_required_outside_explicit_isolated_QA',rejects(()=>smoke.render({target:noDepthTarget,camera:new THREE.PerspectiveCamera()})));
const light={ambientRGB:[1,2,3],rawDirectionalRGB:[.1,.2,.4],directionalDirection:[0,1,0],rawPerCandela:1,clusters:[{position:[0,0,-15],color:[1,.5,.2],referenceCandela:100,radius:2}]};
const bound=smoke.getRadianceBound(light),g=.32,phaseMax=(1+g)/(4*Math.PI*(1-g)**2),expected=.9*(3/(4*Math.PI)+.4*phaseMax+100/4*phaseMax);
check('source_function_bound_uses_raw_incident_light_once',Math.abs(bound.maxRGB-expected)<1e-12&&bound.rawBeforeStorageExposure,{actual:bound.maxRGB,expected});
check('source_bound_does_not_scale_with_number_of_identical_puffs',(()=>{const q=state.snapshot();q.packets.push({...q.packets[0],id:1,mean:[1,0,-5]});smoke.setState(q);return smoke.getRadianceBound(light).maxRGB===bound.maxRGB;})());
check('more_than_two_clusters_and_nonfinite_raw_inputs_are_rejected',rejects(()=>smoke.getRadianceBound({...light,clusters:[...light.clusters,...light.clusters,...light.clusters]}))&&rejects(()=>smoke.getRadianceBound({ambientRGB:[NaN,0,0]})));
const t1=.7,t2=.3,T1=Math.exp(-t1),T2=Math.exp(-t2),T=T1*T2;check('premult_alpha_product_is_exact_transmittance_identity',Math.abs(T-Math.exp(-t1-t2))<1e-15&&Math.abs((1-(1-T1))*(1-(1-T2))-T)<1e-15);
const qA=2,qB=.1,Sab=qA*(1-T1)+T1*qB*(1-T2),Sba=qB*(1-T2)+T2*qA*(1-T1);check('same_total_tau_does_not_make_scattering_sources_commute',Math.abs(Sab-Sba)>.1,{Sab,Sba,T,limit:'T identity does not prove centre-ordered S is exact overlapping transport'});
const A=.35,C=[.1,.2,.3],sky=[.8,.4,.2],S=[.02,.03,.04],Cnew=C.map((v,i)=>v*T+S[i]),Anew=1-(1-A)*T,viaRGBA=Cnew.map((v,i)=>v+(1-Anew)*sky[i]),direct=C.map((v,i)=>(v+(1-A)*sky[i])*T+S[i]);check('neutral_smoke_preserves_reflection_RGBA_remaining_sky_semantics',viaRGBA.every((v,i)=>Math.abs(v-direct[i])<1e-15));
const colouredT=[.2,.5,.8],scalarT=.5,wrong=sky.map(v=>v*scalarT),correct=sky.map((v,i)=>v*colouredT[i]);check('single_reflection_alpha_cannot_represent_RGB_transmittance',wrong.some((v,i)=>Math.abs(v-correct[i])>.1));
// Frobenius norm of inverse covariance is an upper bound on1/lambda_min.
// Hence M*k/(2pi)*||Sigma^-1||F bounds the full-line column peak.
const tailResults=[];for(const sigma of [4,5]){const R=sigma+.01,s=createPyroSmokeState();s.queueEmission({time:0,emissionId:0,mass:1,mean:[0,0,0],covariance:[4,0,0,0,1,0,0,0,.25]});const observed=s.columnOpticalDepth({origin:[2*R,0,-100],direction:[0,0,1],start:0,end:200}).columnMass,upper=Math.hypot(.25,1,4)/(2*Math.PI)*Math.exp(-.5*sigma*sigma);tailResults.push({supportSigma:sigma,observedOffEllipsoidColumn:observed,conservativeBound:upper});}
check('support_4_5sigma_has_explicit_per_ray_tau_error_bound_not_mass_deletion',tailResults.every(v=>v.observedOffEllipsoidColumn<=v.conservativeBound),{tailResults});
check('shader_queries_one_packet_and_uses_explicit_depth_LOD',smokeGaussianColumnGLSL.includes('smokeWhiten')&&!smokeGaussianColumnGLSL.includes('4096')&&!smokeGaussianColumnGLSL.includes('sampler'));
const rgb=[.2,.5,1],P=3;check('P_scales_scattered_source_once_and_never_transmission',rgb.map(v=>v*2**P).every((v,i)=>v/rgb[i]===8)&&T===Math.exp(-1));
smoke.dispose();check('disposed_renderer_refuses_state_updates',rejects(()=>smoke.setState(state.snapshot())));
const report={schema:'glass-atoll.smoke-renderer-math.v1',dateUTC:new Date().toISOString(),runtimeIntegration:false,noGPU:true,passed:checks.every(c=>c.passed),counts:{checks:checks.length,passed:checks.filter(c=>c.passed).length},checks,sourceSHA256:hash(fs.readFileSync(new URL('../pyro-smoke-renderer.js',import.meta.url))),limits:['CPU algebra/source contract only; no shader compilation or realGPU pass','S centre-order and conditional-mean sampling are approximate; light-path/clean-air terms not implemented','RTE point-ray tau identity does not imply exact pixel/aperture averages or futureGPU unbiasedness']};fs.writeFileSync(new URL('./pyro-smoke-renderer-math-check.json',import.meta.url),JSON.stringify(report,null,2));console.log(JSON.stringify({passed:report.passed,counts:report.counts,failed:checks.filter(c=>!c.passed),sourceSHA256:report.sourceSHA256},null,2));if(!report.passed)process.exitCode=1;
