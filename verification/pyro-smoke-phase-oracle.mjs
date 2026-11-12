// Physical propagation-direction oracle, using the actual production closure.
// It may fail before the reviewed sign repair; no runtime source is modified.
import fs from 'node:fs';
import crypto from 'node:crypto';
import {fileURLToPath} from 'node:url';
const sourceURL=new URL('../fireworks.js',import.meta.url),source=fs.readFileSync(sourceURL,'utf8');
const start=source.indexOf('function smokeLighting(');if(start<0)throw new Error('Production smokeLighting closure not found.');
let depth=0,end=-1;
for(let i=source.indexOf('{',start);i<source.length;i++){if(source[i]==='{')depth++;if(source[i]==='}'&&--depth===0){end=i+1;break;}}
if(end<0)throw new Error('Unbalanced production closure.');
const closure=source.slice(start,end),candidateClosure=closure.replace('mu=delta.reduce','mu=-delta.reduce');
if(!closure.includes('mu=delta.reduce')&&!closure.includes('mu=-delta.reduce'))throw new Error('Phase expression drift; inspect rather than silently testing another function.');
const rgbArray=x=>Array.isArray(x)?x:[0,0,0],build=text=>new Function('rgbArray',`return (${text});`)(rgbArray);
const actual=build(closure),candidate=build(candidateClosure),g=.32;
const p={position:[0,0,0],colour:[1,1,1]},air={ambientIrradianceRGB:[0,0,0],rawSunRGB:[0,0,0]};
const dot=(a,b)=>a.reduce((s,v,i)=>s+v*b[i],0),unit=v=>v.map(x=>x/Math.hypot(...v)),sub=(a,b)=>a.map((x,i)=>x-b[i]);
const phase=mu=>(1-g*g)/(4*Math.PI*(1+g*g-2*g*mu)**1.5);
const pbrtPhase=outwardCosine=>(1-g*g)/(4*Math.PI*(1+g*g+2*g*outwardCosine)**1.5);
function measure(fn,S,E){const distance=Math.hypot(...S),I=100,raw=1;return fn(p,E,air,raw,[{position:S,color:[1,1,1],referenceCandela:I,radius:1}])[0]/(.72*I*raw/(distance*distance));}
function fixture(name,S,E){const incoming=unit(sub(p.position,S)),outgoing=unit(sub(E,p.position)),mu=dot(incoming,outgoing);return{name,source:S,eye:E,incomingPropagation:incoming,outgoingPropagation:outgoing,physicalCosine:mu,expected:phase(mu),pbrtOutward: pbrtPhase(dot(unit(S),unit(E))),actual:measure(actual,S,E),candidate:measure(candidate,S,E)};}
const cases=[fixture('forward_source_behind_smoke_opposite_eye',[0,0,-10],[0,0,10]),fixture('side',[10,0,0],[0,0,10]),fixture('back_source_and_eye_same_side',[0,0,10],[0,0,10])];
const checks=[],check=(name,passed,evidence)=>checks.push({name,passed:!!passed,evidence}),near=(a,b,tol=1e-10)=>Math.abs(a-b)<tol;
check('independent_propagation_HG_equals_PBRT_both_outward_plus_sign',cases.every(c=>near(c.expected,c.pbrtOutward)),{cases:cases.map(c=>({name:c.name,physicalCosine:c.physicalCosine,expected:c.expected,pbrtOutward:c.pbrtOutward}))});
check('production_positive_g_is_forward_not_back_scattering',cases[0].actual>cases[2].actual,{actualForward:cases[0].actual,actualBack:cases[2].actual,expectedForwardToBackRatio:((1+g)/(1-g))**3});
check('production_directional_values_match_physical_geometry',cases.every(c=>near(c.actual,c.expected)),{maximumAbsoluteError:Math.max(...cases.map(c=>Math.abs(c.actual-c.expected)))});
check('proposed_sign_only_variant_matches_physical_geometry',cases.every(c=>near(c.candidate,c.expected)),{maximumAbsoluteError:Math.max(...cases.map(c=>Math.abs(c.candidate-c.expected))),variantIsRuntime:!closure.includes('mu=delta.reduce')});
check('production_and_candidate_probes_are_finite_positive',cases.every(c=>[c.actual,c.candidate,c.expected].every(v=>Number.isFinite(v)&&v>0)));
function integrate(fn){let mass=0,moment=0;const n=8192,d=2/n,E=[0,0,10];for(let i=0;i<=n;i++){const mu=-1+i*d,S=[10*Math.sqrt(Math.max(0,1-mu*mu)),0,-10*mu],w=i===0||i===n?1:i%2?4:2,v=measure(fn,S,E);mass+=w*v;moment+=w*v*mu;}return{mass:mass*d/3*2*Math.PI,meanCosine:moment*d/3*2*Math.PI};}
const integralActual=integrate(actual),integralCandidate=integrate(candidate);
check('production_phase_retains_unit_solid_angle_integral',near(integralActual.mass,1,1e-9),integralActual);
check('production_mean_propagation_cosine_equals_positive_g',near(integralActual.meanCosine,g,1e-9),{g,...integralActual});
check('candidate_unit_integral_and_positive_mean_cosine',near(integralCandidate.mass,1,1e-9)&&near(integralCandidate.meanCosine,g,1e-9),{g,...integralCandidate});
const S=[3,4,-Math.sqrt(75)],E=[-6,8,0];
check('production_and_candidate_are_reciprocal',near(measure(actual,S,E),measure(actual,E,S))&&near(measure(candidate,S,E),measure(candidate,E,S)));
// Orthogonal permutation has determinant+1 and preserves the independent dot.
const rotate=v=>[v[1],v[2],v[0]];
check('candidate_is_rotation_invariant',near(measure(candidate,S,E),measure(candidate,rotate(S),rotate(E))));
const report={date:new Date().toISOString(),source:'fireworks.js',sourceSHA256:crypto.createHash('sha256').update(source).digest('hex'),passed:checks.every(c=>c.passed),passedCount:checks.filter(c=>c.passed).length,total:checks.length,checks,cases,integrals:{actual:integralActual,candidate:integralCandidate},
  scope:'Extracted actual production smokeLighting closure; compare against independent photon propagation vectors and PBRT outward-vector convention',
  limits:['CPU geometry/phase oracle, not browser render, persistent smoke model or measured aerosol g','Candidate is an in-memory sign-only replacement, never a runtime source edit','Probes use equal10m distances outside the finite cluster radius; this isolates angular sign from spatial approximations'],
  primarySource:'https://pbr-book.org/4ed/Volume_Scattering/Phase_Functions'};
const output=process.argv[2];if(output)fs.writeFileSync(output,JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({passed:report.passed,passedCount:report.passedCount,total:report.total,sourceSHA256:report.sourceSHA256,failed:checks.filter(c=>!c.passed).map(c=>c.name),cases,integrals:report.integrals},null,2));
if(!report.passed)process.exitCode=1;
