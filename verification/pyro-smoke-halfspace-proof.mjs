// Read-only mathematical/CPU proof. Does NOT change production smoke queries.
import fs from 'node:fs';
import crypto from 'node:crypto';
import {createPyroSmokeState} from '../pyro-smoke-state.js';
const hash=x=>crypto.createHash('sha256').update(x).digest('hex'),runtimeURL=new URL('../pyro-smoke-state.js',import.meta.url),runtimeHash=hash(fs.readFileSync(runtimeURL));
const checks=[],check=(id,passed,details={})=>checks.push({id,passed,...details});
const mirror=v=>[v[0],-v[1],v[2]],R=[1,-1,1],mirrorCov=c=>c.map((v,i)=>v*R[Math.floor(i/3)]*R[i%3]);
const base={time:0,emissionId:0,mass:1,mean:[.3,.2,-.5],covariance:[4,.8,.2,.8,1,.3,.2,.3,2]};
function gaussian(p){const m=p.covariance,d=m[0]*(m[4]*m[8]-m[5]*m[7])-m[1]*(m[3]*m[8]-m[5]*m[6])+m[2]*(m[3]*m[7]-m[4]*m[6]),a=[m[4]*m[8]-m[5]*m[7],m[2]*m[7]-m[1]*m[8],m[1]*m[5]-m[2]*m[4],m[5]*m[6]-m[3]*m[8],m[0]*m[8]-m[2]*m[6],m[2]*m[3]-m[0]*m[5],m[3]*m[7]-m[4]*m[6],m[1]*m[6]-m[0]*m[7],m[0]*m[4]-m[1]*m[3]].map(v=>v/d),normalization=p.mass/((2*Math.PI)**1.5*Math.sqrt(d));return x=>{const q=x.map((v,i)=>v-p.mean[i]);let e=0;for(let i=0;i<3;i++)for(let j=0;j<3;j++)e+=q[i]*a[i*3+j]*q[j];return normalization*Math.exp(-.5*e);};}
const densityG=gaussian(base),image={...base,mean:mirror(base.mean),covariance:mirrorCov(base.covariance)},densityImage=gaussian(image),densityWrongImage=gaussian({...base,mean:mirror(base.mean)});
const folded=x=>x[1]<0?0:densityG(x)+densityG(mirror(x));
function clipHalfSpace({origin,direction,start=0,end}){let a=start,b=end;const oy=origin[1],dy=direction[1];if(dy===0)return oy<0?null:{start:a,end:b};const crossing=-oy/dy;if(dy>0)a=Math.max(a,crossing);else b=Math.min(b,crossing);return b<=a?null:{start:a,end:b};}
const state=createPyroSmokeState();state.queueEmission(base);
function halfColumn(ray){const clipped=clipHalfSpace(ray);if(!clipped)return 0;return state.columnOpticalDepth({...ray,...clipped}).columnMass+state.columnOpticalDepth({...ray,origin:mirror(ray.origin),direction:mirror(ray.direction),...clipped}).columnMass;}
function simpson(fn,a,b,n=4096){if(!(b>a))return 0;let s=fn(a)+fn(b);for(let i=1;i<n;i++)s+=(i%2?4:2)*fn(a+(b-a)*i/n);return s*(b-a)/n/3;}
function numericColumn(ray){const c=clipHalfSpace(ray);return c?simpson(t=>folded(ray.origin.map((v,i)=>v+ray.direction[i]*t)),c.start,c.end):0;}
function erfSeries(x){let term=x,sum=x;for(let n=1;n<100;n++){term*=(-x*x/n)*(2*n-1)/(2*n+1);sum+=term;if(Math.abs(term)<1e-17)break;}return 2/Math.sqrt(Math.PI)*sum;}
function actualFoldMeanY(mu,sigma){return sigma*Math.sqrt(2/Math.PI)*Math.exp(-mu*mu/(2*sigma*sigma))+mu*erfSeries(mu/(Math.SQRT2*sigma));}

const reset=createPyroSmokeState({time:4000,wind:[1.8,0,0]}),sameTime=reset.advanceTo(4000);reset.queueEmission({...base,time:4000});const resetPacket=reset.snapshot().packets[0];
check('existing_time_constructor_starts_at_running_app_clock_without_catchup',sameTime.steps===0&&sameTime.completed&&sameTime.time===4000&&resetPacket.birthTime===4000&&reset.snapshot().ledger.airborne===1,{advance:sameTime});
const mistaken=createPyroSmokeState(),wrongAdvance=mistaken.advanceTo(4000);
check('default_time_zero_would_require_explicit_catchup_not_an_initialTime_bug',wrongAdvance.time===10&&wrongAdvance.steps===200&&!wrongAdvance.completed&&wrongAdvance.behindSeconds===3990,{advance:wrongAdvance});
check('production_density_really_is_unbounded_below_plane',state.sampleMedium([.3,-.2,-.5]).density>0,{belowGroundDensity:state.sampleMedium([.3,-.2,-.5]).density});
const probePoints=[[1,.3,1],[-2,.8,.4],[.3,0,-.5],[4,2,-3]];const imageErrors=probePoints.map(x=>Math.abs(densityImage(x)-densityG(mirror(x))));
check('general_SPD_mirror_requires_R_covariance_R_not_mean_only',Math.max(...imageErrors)<1e-15&&Math.abs(densityWrongImage(probePoints[0])-densityImage(probePoints[0]))>1e-4,{correctMaxError:Math.max(...imageErrors),meanOnlyWrongError:Math.abs(densityWrongImage(probePoints[0])-densityImage(probePoints[0])),mirroredCovariance:image.covariance});
check('halfspace_fold_is_exactly_zero_below_plane',probePoints.every(x=>folded([x[0],-Math.abs(x[1])-1e-3,x[2]])===0));

// Independent3D quadrature, general correlated SPD, finite7sigma domain.
const n=80,xLo=base.mean[0]-7*Math.sqrt(base.covariance[0]),xHi=base.mean[0]+7*Math.sqrt(base.covariance[0]),zLo=base.mean[2]-7*Math.sqrt(base.covariance[8]),zHi=base.mean[2]+7*Math.sqrt(base.covariance[8]),yHi=Math.abs(base.mean[1])+7*Math.sqrt(base.covariance[4]),hx=(xHi-xLo)/n,hy=yHi/n,hz=(zHi-zLo)/n;
let M=0,Y=0,X=0,Z=0;
for(let i=0;i<=n;i++)for(let j=0;j<=n;j++)for(let k=0;k<=n;k++){const x=[xLo+i*hx,j*hy,zLo+k*hz],w=[i,j,k].reduce((a,t)=>a*(t===0||t===n?1:t%2?4:2),1),mass=w*folded(x);M+=mass;X+=mass*x[0];Y+=mass*x[1];Z+=mass*x[2];}
const jacobian=hx*hy*hz/27;M*=jacobian;const numericalMean=[X*jacobian/M,Y*jacobian/M,Z*jacobian/M],physicalMeanY=actualFoldMeanY(base.mean[1],Math.sqrt(base.covariance[4]));
check('folded_general_3D_density_above_ground_integrates_to_M_not_2M',Math.abs(M-base.mass)<2e-7,{numericMass:M,target:base.mass,limit:'finite7sigma Simpson volume; exact full-domain equality follows by change of variables'});
check('physical_folded_centroid_is_not_the_latent_kernel_mean',Math.abs(numericalMean[1]-physicalMeanY)<2e-6&&Math.abs(numericalMean[0]-base.mean[0])<2e-6&&Math.abs(numericalMean[2]-base.mean[2])<2e-6&&physicalMeanY>base.mean[1]+.5,{latentMean:base.mean,actualMeanFormula:[base.mean[0],physicalMeanY,base.mean[2]],numericalMean});
const onPlaneMean=Math.sqrt(2/Math.PI),onPlaneVariance=1-2/Math.PI;
check('kernel_on_plane_has_halfnormal_physical_centroid_and_variance',Math.abs(actualFoldMeanY(0,1)-onPlaneMean)<1e-15&&onPlaneVariance>0&&onPlaneVariance<1,{latentMeanY:0,physicalMeanY:onPlaneMean,latentVarianceY:1,physicalVarianceY:onPlaneVariance});

const rays=[
  {name:'main-down-to-water',origin:[0,5,0],direction:[0,-1,0],start:0,end:5},
  {name:'mirror-camera-through-plane',origin:[0,-5,0],direction:[0,1,0],start:0,end:10},
  {name:'water-hit-up',origin:[0,0,0],direction:[0,1,0],start:0,end:5},
  {name:'inside-t0-zero',origin:[0,.2,0],direction:[0,1,0],start:0,end:4},
  {name:'above-horizontal',origin:[-8,.4,0],direction:[1,0,0],start:0,end:16},
  {name:'below-horizontal',origin:[-8,-.4,0],direction:[1,0,0],start:0,end:16}
].map(ray=>({...ray,analytic:halfColumn(ray),numeric:numericColumn(ray)}));
check('plane_clipped_finite_columns_match_independent_folded_density_quadrature',rays.every(r=>Math.abs(r.analytic-r.numeric)<3e-7),{rays});
check('mirror_camera_to_plume_column_equals_water_hit_air_segment',Math.abs(rays[1].analytic-rays[2].analytic)<1e-14&&rays[5].analytic===0);
check('reverse_main_air_segment_has_reciprocal_scalar_optical_depth',Math.abs(rays[0].analytic-rays[2].analytic)<1e-14);
check('mirror_image_is_a_virtual_query_not_a_second_physical_mass_emission',state.snapshot().packets.length===1&&state.snapshot().ledger.airborne===1&&state.snapshot().ledger.emitted===1);
check('runtime_state_query_source_is_unchanged',hash(fs.readFileSync(runtimeURL))===runtimeHash&&runtimeHash==='d40060da202a0c4b488986acef4afcbb64550ac97bd875b012b9bdba70a25e19');
const report={schema:'glass-atoll.pyro-smoke-halfspace-proof.v1',dateUTC:new Date().toISOString(),runtimeSHA256:runtimeHash,runtimeEdits:false,noGPUOrBrowser:true,passed:checks.every(c=>c.passed),counts:{checks:checks.length,passed:checks.filter(c=>c.passed).length},checks,interpretation:{reset:'use existing constructor {time:appPhysicalTime,wind:current}; noinitialTime alias needed',currentState:'unbounded Gaussian: ledger airborne is full mathematical reservoir mass, including below-plane tails until an explicit boundary model is selected',halfspace:'rhoPlus(x,y,z)=rhoG(x,y,z)+rhoG(x,-y,z) for y>=0, otherwise0; virtual reflected kernel mean=Rmu,cov=RSigmaR',moments:'actual constrained meanY=E|Y|, not latent meanY; kernel covariance is not the constrained physical covariance',column:'clip real ray to y>=0 then evaluate same base kernel with real and R-reflected ray. Do not add mirror packets to the mass ledger.',limits:['flat reflecting mathematical density boundary only; no deposition/terrain/wave/fluid boundary solution','mass/optical-depth proof, not single/multiple-scatter source integration or actualGPU acceptance','optical conditional mean must be ray/opacity weighted after clipping; it is not virtual kernel mean','water mirror optics and mass-method-of-images are different operations; do not double-count camera-to-water andwater-hit-to-world air']}};
fs.writeFileSync(new URL('./pyro-smoke-halfspace-proof.json',import.meta.url),JSON.stringify(report,null,2));console.log(JSON.stringify({passed:report.passed,counts:report.counts,failed:checks.filter(c=>!c.passed),mass:M,numericalMean,latentMean:base.mean,rays:rays.map(({name,analytic,numeric})=>({name,analytic,numeric}))},null,2));if(!report.passed)process.exitCode=1;
