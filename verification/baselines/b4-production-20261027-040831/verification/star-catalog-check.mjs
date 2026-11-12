import fs from 'node:fs';
import * as THREE from '../vendor/three.module.js';
const base=new URL('../assets/night/catalog/',import.meta.url),manifest=JSON.parse(fs.readFileSync(new URL('manifest.json',base))),checks=[];
const add=(id,passed,evidence={})=>checks.push({id,passed:!!passed,...evidence});
const readFloat=name=>{const b=fs.readFileSync(new URL(name,base));return new Float32Array(b.buffer,b.byteOffset,b.byteLength/4);};
const p=readFloat('stars-float32.bin'),n=manifest.pointCount,ids=JSON.parse(fs.readFileSync(new URL('point-identifiers.json',base)));
add('full_sources_have_expected_counts',manifest.counts.hip_input===118218&&manifest.counts.tycho_input===2539913&&manifest.counts.suppl_input===17588,{counts:manifest.counts});
add('point_and_diffuse_are_complementary_master_partition',n+manifest.counts.diffuse===manifest.counts.master,{points:n,diffuse:manifest.counts.diffuse,master:manifest.counts.master});
add('point_record_layout_is_complete_and_finite',p.length===n*12&&p.every(Number.isFinite));
add('stable_point_identifiers_are_unique',new Set(ids.map(v=>v[0]+':'+v[1])).size===n);
let maxNorm=0,maxMagnitude=-Infinity,minMagnitude=Infinity;
for(let i=0;i<n;i++){const k=i*12;maxNorm=Math.max(maxNorm,Math.abs(Math.hypot(p[k],p[k+1],p[k+2])-1));maxMagnitude=Math.max(maxMagnitude,p[k+7]);minMagnitude=Math.min(minMagnitude,p[k+7]);}
add('point_directions_are_unit_vectors',maxNorm<1e-6,{maxNorm});
add('m7_m8_stars_are_point_sources_not_diffuse_blobs',manifest.pointLimitMagnitude>=8.5&&maxMagnitude<=manifest.pointLimitMagnitude+1e-5,{split:manifest.pointLimitMagnitude,maxMagnitude,minMagnitude});
const sum=[0,0,0];for(let i=0;i<n;i++)for(let c=0;c<3;c++)sum[c]+=10**(-.4*p[i*12+7])*p[i*12+8+c];
const err=sum.map((v,c)=>Math.abs((v+manifest.diffuseRGBIntegralUnitF0[c])/manifest.masterRGBFluxUnitF0[c]-1));
add('catalogue_integrated_flux_survives_partition',Math.max(...err)<1e-6,{relativeErrors:err});
const reconciliation=JSON.parse(fs.readFileSync(new URL('system-reconciliation.json',base))),retired=reconciliation.records.flatMap(r=>r.retiredIdentifiers),idSet=new Set(ids.map(v=>v[0]+':'+v[1]));
add('retired_system_aliases_have_source_mapping_and_are_not_rendered_twice',retired.length===manifest.counts.TYC_aliases_retired_for_HIP_system&&retired.every(v=>!idSet.has(v[0]+':'+v[1]))&&reconciliation.records.filter(r=>r.retiredIdentifiers.length).every(r=>r.candidateTYC.length===r.retiredIdentifiers.length),{reconciledSystems:reconciliation.records.filter(r=>r.retiredIdentifiers.length).length,retiredAliases:retired.length});
for(const [hip,expectedMagnitude]of [['31067',6.18],['55203',3.79],['78727',4.16]]){
  const index=ids.findIndex(v=>v[0]==='HIP'&&v[1]===hip),k=index*12,expected=10**(-.4*expectedMagnitude);let sum=0,count=0;
  for(let i=0;i<n;i++){const j=i*12;if(Math.hypot(p[j]-p[k],p[j+1]-p[k+1],p[j+2]-p[k+2])<2*Math.sin(10/3600*Math.PI/180/2)){sum+=10**(-.4*p[j+7])*(.2126*p[j+8]+.7152*p[j+9]+.0722*p[j+10]);count++;}}
  add(`HIP_${hip}_same_object_system_flux_is_not_added_to_TYC_components`,index>=0&&count===1&&Math.abs(sum/expected-1)<1e-6,{expectedMagnitude,renderedSystemMagnitude:-2.5*Math.log10(sum),pointCountWithin10Arcsec:count,relativeFluxError:Math.abs(sum/expected-1)});
}
let seed=17289;const rand=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
const norm=v=>{const l=Math.hypot(...v);return v.map(x=>x/l);};
const cubeCell=(v,N)=>{const a=v.map(Math.abs);let f=0,u=0,w=0;if(a[0]>=a[1]&&a[0]>=a[2]){if(v[0]>=0){f=0;u=-v[2]/a[0];w=v[1]/a[0];}else{f=1;u=v[2]/a[0];w=v[1]/a[0];}}else if(a[1]>=a[2]){if(v[1]>=0){f=2;u=v[0]/a[1];w=-v[2]/a[1];}else{f=3;u=v[0]/a[1];w=v[2]/a[1];}}else if(v[2]>=0){f=4;u=v[0]/a[2];w=v[1]/a[2];}else{f=5;u=-v[0]/a[2];w=v[1]/a[2];}return(f*N+Math.max(0,Math.min(N-1,Math.floor((w*.5+.5)*N))))*N+Math.max(0,Math.min(N-1,Math.floor((u*.5+.5)*N)));};
for(const table of manifest.tables){
  const lookup=readFloat(`lookup-${table.name}-float32.bin`),headerCount=6*manifest.tileResolution**2;
  let invalid=0,maxCount=0;for(let i=0;i<headerCount;i++){const offset=lookup[i*4],count=lookup[i*4+1];maxCount=Math.max(maxCount,count);if(offset<headerCount||offset+count>lookup.length/4||offset%1||count%1)invalid++;for(let j=0;j<count;j++){const index=lookup[(offset+j)*4];if(index<0||index>=n||index%1)invalid++;}}
  add(`${table.name}_headers_entries_are_bounded_and_no_loop_overflow`,invalid===0&&maxCount<=256,{invalid,maxCount});
  let missing=0;const count=8000;
  for(let test=0;test<count;test++){
    const index=Math.floor(rand()*n),k=index*12,year=[-200,0,200][test%3];const d=norm([0,1,2].map(c=>p[k+c]+p[k+4+c]*year));
    const tangent=norm(Math.abs(d[1])<.8?[d[2],0,-d[0]]:[0,d[2],-d[1]]),other=[d[1]*tangent[2]-d[2]*tangent[1],d[2]*tangent[0]-d[0]*tangent[2],d[0]*tangent[1]-d[1]*tangent[0]],angle=rand()*table.supportDegrees*Math.PI/180,phase=rand()*Math.PI*2;
    const ray=d.map((v,c)=>v*Math.cos(angle)+(tangent[c]*Math.cos(phase)+other[c]*Math.sin(phase))*Math.sin(angle));
    const cell=cubeCell(ray,manifest.tileResolution),start=lookup[cell*4],len=lookup[cell*4+1];let found=false;for(let j=0;j<len;j++)if(lookup[(start+j)*4]===index){found=true;break;}if(!found)missing++;
  }
  add(`${table.name}_conservative_support_includes_moving_stars_across_faces`,missing===0,{randomConeTests:count,epochYears:[1800,2000,2200],missing});
}
const binary=fs.readFileSync(new URL('diffuse-rgba16f.bin',base)),halves=new Uint16Array(binary.buffer,binary.byteOffset,binary.byteLength/2),mipErrors=[];
for(const level of manifest.diffuseLevels){
  const total=[0,0,0],start=level.offsetBytes/2;
  for(let y=0;y<level.height;y++){
    const omega=2*Math.PI/level.width*(Math.sin(Math.PI/2-y*Math.PI/level.height)-Math.sin(Math.PI/2-(y+1)*Math.PI/level.height));
    for(let x=0;x<level.width;x++)for(let c=0;c<3;c++)total[c]+=THREE.DataUtils.fromHalfFloat(halves[start+(y*level.width+x)*4+c])*omega*manifest.photometry.NASAbackgroundScale/manifest.photometry.defaultF0Physical;
  }
  mipErrors.push({width:level.width,height:level.height,relativeErrors:total.map((v,c)=>Math.abs(v/manifest.diffuseRGBIntegralUnitF0[c]-1))});
}
add('all_half_float_mips_preserve_spherical_flux',mipErrors.every(m=>m.relativeErrors.every(e=>e<.001)),{mips:mipErrors});
const erf=x=>{const a=Math.abs(x),t=1/(1+.3275911*a),p=(((((1.061405429*t-1.453152027)*t)+1.421413741)*t-.284496736)*t+.254829592)*t;return Math.sign(x)*(1-p*Math.exp(-a*a));};
const kernel=x=>.5*(erf((x+.5)/(.35*Math.SQRT2))-erf((x-.5)/(.35*Math.SQRT2)));
let maxFluxError=0;for(const phaseX of [0,.11,.25,.49])for(const phaseY of [0,.23,.49]){let f=0;for(let y=-5;y<=5;y++)for(let x=-5;x<=5;x++)if(Math.hypot(x-phaseX,y-phaseY)<=2.5)f+=kernel(x-phaseX)*kernel(y-phaseY);maxFluxError=Math.max(maxFluxError,Math.abs(f-1));}
add('pixel_integrated_point_kernel_has_stable_flux_through_subpixel_phases',maxFluxError<1e-6,{maxFluxError});
add('five_magnitudes_are_one_hundred_times_flux',Math.abs(10**(-.4*1)/10**(-.4*6)-100)<1e-10);
const scint=(time,phase,T)=>1+[[.025,.625,1],[.027,1.875,2.713],[.022,5.25,4.137]].reduce((s,[a,f,p])=>{const x=Math.PI*f*T,sinc=Math.abs(x)<1e-5?1:Math.sin(x)/x;return s+a*sinc*Math.sin(2*Math.PI*f*time+phase*p);},0);
let mean=0,small=0,long=0,maxStep=0;for(let i=0;i<4096;i++){const t=i/32,v=scint(t,1.236,1/120);mean+=v/4096;small+=(v-1)**2;long+=(scint(t,1.236,1)-1)**2;maxStep=Math.max(maxStep,Math.abs(scint(t+.0001,1.236,1/120)-v));}
add('weak_scintillation_has_unit_mean_positive_bounded_flux',Math.abs(mean-1)<1e-6&&small/4096<.002,{mean,rms:Math.sqrt(small/4096),max100MicrosecondStep:maxStep});
add('physical_exposure_averages_fast_scintillation',long<small*.4,{ratio:long/small});
add('wrapped_physical_time_has_no_4096_second_phase_jump',Math.abs(scint(4096,2,1/120)-scint(0,2,1/120))<1e-10);
const report={date:new Date().toISOString(),status:checks.every(c=>c.passed)?'passed':'failed',summary:{passed:checks.filter(c=>c.passed).length,total:checks.length},checks,limits:['CPU source/texture/PSF integrity; actual shader Float readback, main/reflection/cube seams, cloud occlusion and performance still require GPU acceptance','Magnitude/colour and NASA background are effective relative photometry, not a complete instrument-spectrum model']};
fs.writeFileSync(new URL('./star-catalog-check.json',import.meta.url),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({status:report.status,...report.summary,failures:checks.filter(c=>!c.passed)},null,2));if(report.status!=='passed')process.exitCode=1;
