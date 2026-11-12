import {createAerialPerspective} from '../aerial-perspective.js';
import {createAerialPerspective as createBaselineAerial} from './r12-background-air-baseline-aerial-perspective.js';
import {createLocalLights} from '../local-lights.js';
import {createSceneRadiometry} from '../scene-radiometry.js';
import {checkHalfSampleExposure,checkBlackSkyComposite} from './r12-background-air-quantization-oracle.mjs';
import {integrateLocalSupportReference} from './r12-background-air-support-oracle.js';

// Small, deterministic fixtures on the application's actual renderer. A caller
// can inject both factories; this helper owns no application sources or clock.
export async function runBackgroundAirGPUCheck(THREE,renderer,{createAerial=createAerialPerspective,createBaseline=createBaselineAerial}={}){
  const report={kind:'R12 background-only finite local-air scattering / actual WebGL2',passed:false,checks:[],glErrors:[],cleanup:false},checks=report.checks;
  const add=(name,passed,details={})=>checks.push({name,passed:!!passed,...details}),W=32,H=24,gl=renderer.getContext(),owned=[];
  const saved={target:renderer.getRenderTarget(),face:renderer.getActiveCubeFace(),mip:renderer.getActiveMipmapLevel(),viewport:renderer.getCurrentViewport(new THREE.Vector4()),scissor:Array.from(gl.getParameter(gl.SCISSOR_BOX)),scissorTest:gl.isEnabled(gl.SCISSOR_TEST),autoClear:renderer.autoClear,xr:renderer.xr.enabled,shadowAuto:renderer.shadowMap.autoUpdate,shadowNeeds:renderer.shadowMap.needsUpdate};
  let air,legacy,local;
  const maxDifference=(a,b)=>{let maximum=0,different=0,nonFinite=0;for(let i=0;i<a.length;i++){if(!Number.isFinite(a[i])||!Number.isFinite(b[i]))nonFinite++;const d=Math.abs(a[i]-b[i]);maximum=Math.max(maximum,d);if(d!==0)different++;}return{maximum,different,nonFinite};};
  try{
    const camera=new THREE.PerspectiveCamera(40,W/H,.15,24000);camera.position.set(0,2,0);camera.lookAt(0,2,-1);camera.updateMatrixWorld();
    const lightScene=new THREE.Scene();local=createLocalLights(THREE,{scene:lightScene});local.uniforms.uLocalShadowEnabled.value=0;
    const source=new Uint16Array(W*H*4),depthValues=new Float32Array(W*H);
    const colour=new THREE.DataTexture(source,W,H,THREE.RGBAFormat,THREE.HalfFloatType),depth=new THREE.DataTexture(depthValues,W,H,THREE.RedFormat,THREE.FloatType);
    for(const t of [colour,depth]){t.minFilter=t.magFilter=THREE.NearestFilter;t.generateMipmaps=false;t.colorSpace=THREE.NoColorSpace;t.needsUpdate=true;owned.push(t);}
    air=createAerial(THREE,renderer,{camera,localLights:local});legacy=createBaseline(THREE,renderer,{camera,localLights:local});air.setSize(W,H);legacy.setSize(W,H);
    const common={shadows:false,aerosolScale:8,humidity:.68,rayleighScale:1,maxDistance:12000};
    air.configure(common);legacy.configure(common);
    const draw=a=>a.render({colour,depth,width:W,height:H});
    function read(target,index=0){renderer.setRenderTarget(target);const previous=gl.getParameter(gl.READ_BUFFER);gl.readBuffer(gl.COLOR_ATTACHMENT0+index);const data=new Float32Array(target.width*target.height*4);gl.readPixels(0,0,target.width,target.height,gl.RGBA,gl.FLOAT,data);gl.readBuffer(previous);return data;}
    function fill({kind='mixed',rgb=null}={}){for(let y=0;y<H;y++)for(let x=0;x<W;x++){const i=y*W+x;depthValues[i]=kind==='sky'?1:kind==='far'?1-2**-22:kind==='checker'?(x%2===0?1-2**-22:1):y>=H/2?1:camera.far/(camera.far-camera.near)-camera.far*camera.near/((camera.far-camera.near)*70);for(let c=0;c<4;c++)source[4*i+c]=THREE.DataUtils.toHalfFloat(c===3?.75:rgb?rgb[c]:[.125+(x%4)*.125,.5,2+(y%3)*.5][c]);}colour.needsUpdate=true;depth.needsUpdate=true;}
    function sources(active=true,P=0,{radius=12,rawRGB=[6,12,24],position=[5,2,-90],range=280}={}){
      for(let i=0;i<6;i++){const r=local.records[i];r.rawRGB=i===4&&active?[...rawRGB]:[0,0,0];if(i===4){r.radius=radius;r.position.fromArray(position);r.range=range;}local.uniforms.uLocalPosition.value[i].set(...r.position.toArray(),r.radius);local.uniforms.uLocalCone.value[i].set(-1,1,r.range,i>=4?1:0);local.uniforms.uLocalDirection.value[i].set(0,0,0,0);}
      local.setSceneExposure(P);local.uniforms.uLocalShadowEnabled.value=0;
    }
    function sun(value){air.uniforms.uSunRGB.value.setScalar(value);legacy.uniforms.uSunRGB.value.setScalar(value);}
    let legacyCases=0,legacyMax=0,legacyDifferent=0,legacyNonFinite=0;
    for(const active of [false,true])for(const kind of ['mixed','sky','far'])for(const P of [-2,0,8]){
      sources(active,P);fill({kind});sun(3.6);air.setBackgroundLocalScattering(0);draw(legacy);const old=[read(legacy.target),read(legacy.volumeTarget,0),read(legacy.volumeTarget,1)];draw(air);const candidate=[read(air.target),read(air.volumeTarget,0),read(air.volumeTarget,1)];
      for(let n=0;n<old.length;n++){const difference=maxDifference(old[n],candidate[n]);legacyMax=Math.max(legacyMax,difference.maximum);legacyDifferent+=difference.different;legacyNonFinite+=difference.nonFinite;}legacyCases++;
    }
    add('Default flag0 matches pre-edit opaque/sky RGB, T and S byte-for-byte',legacyDifferent===0&&legacyNonFinite===0,{cases:legacyCases,maximumDifference:legacyMax,differentChannels:legacyDifferent,nonFinite:legacyNonFinite});
    sources(false);fill({kind:'sky'});sun(30);air.setBackgroundLocalScattering(1);draw(air);const noLocal=read(air.target);let noLocalDifference=0;
    for(let i=0;i<noLocal.length;i++)noLocalDifference=Math.max(noLocalDifference,Math.abs(noLocal[i]-THREE.DataUtils.fromHalfFloat(source[i])));
    add('Flag1 with zero local sources retains exact existing sky including nonzero sun',noLocalDifference===0&&air.getRadianceBound().maxRGB===0,{maximumDifference:noLocalDifference,rawBound:air.getRadianceBound().maxRGB});
    sources(true);fill({kind:'sky',rgb:[.125,.5,2]});sun(0);draw(air);const skyDarkSun=read(air.target),skyS=read(air.volumeTarget,0),skyT=read(air.volumeTarget,1);sun(30);draw(air);const skyBrightSun=read(air.target),solarDifference=maxDifference(skyDarkSun,skyBrightSun);let maxLocalS=0,transmissionError=0,alphaError=0;
    for(let i=0;i<skyS.length;i+=4){for(let c=0;c<3;c++){maxLocalS=Math.max(maxLocalS,skyS[i+c]);transmissionError=Math.max(transmissionError,Math.abs(skyT[i+c]-1));}alphaError=Math.max(alphaError,Math.abs(skyS[i+3]+2));}
    add('Active sky adds positive local S, with unit T and valid local-only marker',maxLocalS>0&&transmissionError===0&&alphaError===0,{maximumLocalS:maxLocalS,maximumTransmissionError:transmissionError,markerError:alphaError});
    add('Background local source is independent of sun: no second global S or T',solarDifference.different===0&&solarDifference.nonFinite===0,solarDifference);
    // At both depths the same ray reaches the same capped 12km path. Isolate
    // source S by setting incoming colour and sunlight to zero; do not compare
    // sky's intentionally-unit final T against the opaque physical T.
    fill({kind:'sky',rgb:[0,0,0]});sun(0);draw(air);const skyPathS=read(air.volumeTarget,0);fill({kind:'far',rgb:[0,0,0]});draw(air);const farPathS=read(air.volumeTarget,0);let maximumContinuityRatio=0,maximumContinuityError=0,continuityNonFinite=0;
    let maximumSkyPathS=0,maximumOpaquePathS=0,positiveMatchedChannels=0;
    for(let i=0;i<skyPathS.length;i+=4)for(let c=0;c<3;c++){const a=skyPathS[i+c],b=farPathS[i+c],d=Math.abs(a-b);maximumSkyPathS=Math.max(maximumSkyPathS,a);maximumOpaquePathS=Math.max(maximumOpaquePathS,b);if(a>0&&b>0)positiveMatchedChannels++;maximumContinuityError=Math.max(maximumContinuityError,d);maximumContinuityRatio=Math.max(maximumContinuityRatio,d/(2e-5+.005*Math.abs(b)));if(!Number.isFinite(a)||!Number.isFinite(b))continuityNonFinite++;}
    add('Equal far paths have continuous sky/opaque local S when global terms isolated',maximumContinuityRatio<=1&&continuityNonFinite===0&&maximumSkyPathS>0&&maximumOpaquePathS>0&&positiveMatchedChannels>0,{maximumError:maximumContinuityError,maximumBoundRatio:maximumContinuityRatio,nonFinite:continuityNonFinite,maximumSkyPathS,maximumOpaquePathS,positiveMatchedChannels,tolerance:'2e-5 + 0.5% allows FP16 and separate inverse-projection rounding'});
    fill({kind:'checker',rgb:[0,0,0]});sun(0);draw(air);const edge=read(air.target),beta=air.diagnostics().coefficients,steps=air.diagnostics().steps;
    const oracle=(x,y)=>{
      const endpoint=new THREE.Vector3((x+.5)/W*2-1,(y+.5)/H*2-1,1).applyMatrix4(camera.projectionMatrixInverse).applyMatrix4(camera.matrixWorld),ray=endpoint.sub(camera.position),D=Math.min(ray.length(),12000),direction=ray.normalize(),T=[1,1,1],S=[0,0,0];
      for(let k=0;k<steps;k++){
        const a=k/steps,b=(k+1)/steps,start=a*a*D,end=b*b*D,ds=end-start,p=camera.position.clone().addScaledVector(direction,(start+end)/2),h=Math.max(0,p.y),R=beta.betaRayleighRGB.map(v=>v*Math.exp(-h/beta.rayleighHeight)),ME=beta.betaMieExtinctionRGB.map(v=>v*Math.exp(-h/beta.aerosolHeight)),MS=beta.betaMieScatteringRGB.map(v=>v*Math.exp(-h/beta.aerosolHeight)),J=[0,0,0];
        for(let i=0;i<6;i++){
          const r=local.records[i];if(!r.rawRGB.some(v=>v>0))continue;const d=r.position.clone().sub(p),d2=d.lengthSq();if(d2>=r.range*r.range)continue;const distance=Math.sqrt(d2),den=Math.max(d2,r.radius*r.radius,i<3?.01:0),cutDistance=i<3?distance:Math.sqrt(den),cut=Math.max(0,1-(cutDistance/Math.max(r.range,.01))**4)**2,mu=Math.max(-1,Math.min(1,d.multiplyScalar(1/Math.sqrt(Math.max(d2,1e-10))).dot(direction))),pr=3/(16*Math.PI)*(1+mu*mu),g=beta.asymmetry,pm=(1-g*g)/(4*Math.PI*Math.max(1e-5,1+g*g-2*g*mu)**1.5);
          for(let c=0;c<3;c++)J[c]+=r.rawRGB[c]*cut/den*(R[c]*pr+MS[c]*pm);
        }
        for(let c=0;c<3;c++){const sigma=R[c]+ME[c],integral=sigma>0?-Math.expm1(-sigma*ds)/sigma:ds;S[c]+=T[c]*J[c]*integral;T[c]*=Math.exp(-sigma*ds);}
      }return S;
    };
    let oracleMaxRatio=0,oracleMaxError=0,edgePixels=0,edgeNonFinite=0;
    for(let y=0;y<H;y++)for(let x=1;x<W;x+=2){const expected=oracle(x,y);for(let c=0;c<3;c++){const actual=edge[4*(y*W+x)+c],d=Math.abs(actual-expected[c]);oracleMaxError=Math.max(oracleMaxError,d);oracleMaxRatio=Math.max(oracleMaxRatio,d/(2e-5+.01*Math.abs(expected[c])));if(!Number.isFinite(actual))edgeNonFinite++;}edgePixels++;}
    add('Mixed 2x2 depth edges use local-only full-ray fallback without solar leak',oracleMaxRatio<=1&&edgeNonFinite===0,{skyPixels:edgePixels,maximumError:oracleMaxError,maximumBoundRatio:oracleMaxRatio,nonFinite:edgeNonFinite,tolerance:'2e-5 + 1% includes FP16 transfer and float shader integration'});
    const frozen=[];for(let n=0;n<4;n++){draw(air);frozen.push(read(air.target));}let pausedDifferences=0;for(let n=1;n<frozen.length;n++)pausedDifferences+=maxDifference(frozen[0],frozen[n]).different;
    add('Repeated frozen physical inputs produce identical output, no stochastic flicker',pausedDifferences===0,{frames:frozen.length,differentChannels:pausedDifferences});
    // Extreme accepted medium and source radii, all RGB primaries, P chosen
    // from the raw added budget, then scan the actual half-float targets.
    const radiometry=createSceneRadiometry();let hdrCases=0,hdrNonFinite=0,hdrOverflow=0,maximumStored=0,maximumBoundRatio=0;const boundRows=[];
    for(const g of [0,.76,.9])for(const humidity of [0,.95])for(const radius of [.1,2,12])for(const primary of [[24,0,0],[0,24,0],[0,0,24]]){
      air.configure({asymmetry:g,humidity,aerosolScale:48,rayleighScale:8});sources(true,0,{radius,rawRGB:primary,position:[0,2,-96]});fill({kind:'sky',rgb:[0,0,0]});sun(0);const bound=air.getRadianceBound(),frame=radiometry.update({recommendedEV:21,bounds:{medium:bound},force:true});local.setSceneExposure(frame.storageEV);draw(air);const out=read(air.target),scatter=read(air.volumeTarget,0),rawScaledBound=bound.maxRGB*frame.sceneScale;
      for(const data of [out,scatter])for(let i=0;i<data.length;i+=4)for(let c=0;c<3;c++){const v=data[i+c];if(!Number.isFinite(v))hdrNonFinite++;if(v>65504||v<0)hdrOverflow++;maximumStored=Math.max(maximumStored,v);maximumBoundRatio=Math.max(maximumBoundRatio,v/(rawScaledBound||1));}
      boundRows.push({g,humidity,radius,primary,P:frame.storageEV,rawBound:bound.maxRGB,storedBound:rawScaledBound});hdrCases++;
    }
    add('Conservative raw budget keeps extreme accepted local sky RGB finite in actual FP16',hdrNonFinite===0&&hdrOverflow===0&&maximumBoundRatio<=1.005,{cases:hdrCases,nonFinite:hdrNonFinite,overflow:hdrOverflow,maximumStored,maximumBoundRatio,rows:boundRows});
    air.configure(common);sources(true);fill({kind:'sky',rgb:[0,0,0]});sun(0);draw(air);const baseBound=air.getRadianceBound();let exposureMaxRatio=0;
    const base=read(air.target),baseScatter=read(air.volumeTarget,0),exposureRows=[],exposureFrames=[{P:0,width:W,height:H,scatter:baseScatter,composite:base}];
    for(const P of [-8,4,8]){local.setSceneExposure(P);draw(air);const result=read(air.target),scatter=read(air.volumeTarget,0),bound=air.getRadianceBound(),row={P,maximumBoundRatio:0,worst:null,rawBoundUnchanged:bound.maxRGB===baseBound.maxRGB};if(!row.rawBoundUnchanged)exposureMaxRatio=Infinity;
      for(let i=0;i<base.length;i+=4)for(let c=0;c<3;c++){const b=base[i+c],actual=result[i+c],expected=b*2**P,difference=Math.abs(actual-expected),tolerance=2e-5+.003*Math.abs(expected),ratio=difference/tolerance;if(ratio>row.maximumBoundRatio){row.maximumBoundRatio=ratio;row.worst={x:(i/4)%W,y:Math.floor(i/4/W),channel:c,base:b,actual,expected,difference,tolerance};}exposureMaxRatio=Math.max(exposureMaxRatio,ratio);}
      let scatterMaximum=0,scatterWorst=null;for(let i=0;i<baseScatter.length;i+=4)for(let c=0;c<3;c++){const expected=baseScatter[i+c]*2**P,difference=Math.abs(scatter[i+c]-expected);if(difference>scatterMaximum){scatterMaximum=difference;scatterWorst={x:(i/4)%(W/2),y:Math.floor(i/4/(W/2)),channel:c,base:baseScatter[i+c],actual:scatter[i+c],expected,difference};}}row.scatterMaximumError=scatterMaximum;row.scatterWorst=scatterWorst;exposureRows.push(row);exposureFrames.push({P,width:W,height:H,scatter,composite:result});
    }
    const sourceIntervals=checkHalfSampleExposure(exposureFrames),reconstruction=exposureFrames.map(frame=>({P:frame.P,...checkBlackSkyComposite(frame,{fp32OperationBudget:32})}));
    add('Local S scales with storage exposure once; measured FP16 cells and reconstruction agree',sourceIntervals.passed&&reconstruction.every(r=>r.passed)&&exposureRows.every(r=>r.rawBoundUnchanged),{storageEVs:[-8,0,4,8],sourceIntervals,reconstruction,oldInvalidFinalP0Extrapolation:{maximumBoundRatio:exposureMaxRatio,rows:exposureRows,acceptance:false,reason:'Scaling a twice-quantized subnormal P0 image magnifies its two FP16 storage errors; preserved diagnostic, not a valid linearity gate'}});
    let masterFlagDifferent=0;air.configure({localScatteringModel:'support',backgroundLocalScattering:0});sources(true);sun(3.6);
    for(const kind of ['mixed','sky','far']){fill({kind});draw(legacy);const old=[read(legacy.target),read(legacy.volumeTarget,0),read(legacy.volumeTarget,1)];draw(air);const current=[read(air.target),read(air.volumeTarget,0),read(air.volumeTarget,1)];for(let i=0;i<3;i++)masterFlagDifferent+=maxDifference(old[i],current[i]).different;}
    add('Master flag0 remains byte-exact legacy with support model stored',masterFlagDifferent===0&&air.getRadianceBound().maxRGB===0,{differentChannels:masterFlagDifferent,rawBound:air.getRadianceBound().maxRGB});
    const beforeBadModel=air.diagnostics();let invalidModels=0;for(const model of ['SUPPORT','',null,1,{},NaN]){try{air.configure({backgroundLocalScattering:1,aerosolScale:48,localScatteringModel:model});}catch(e){if(e instanceof RangeError)invalidModels++;}}
    add('Invalid model patches cannot partially enable or change the medium',invalidModels===6&&air.diagnostics().backgroundLocalScattering===0&&air.diagnostics().coefficients.aerosolScale===beforeBadModel.coefficients.aerosolScale,{rejected:invalidModels});
    air.configure({...common,asymmetry:.76,localScatteringModel:'support',backgroundLocalScattering:1});sources(true);sun(0);let supportEndpointRatio=0,supportMax=0,supportNonFinite=0;const supportRows=[];
    for(const nodes of [6,8]){
      air.setSampling({steps:nodes});fill({kind:'sky',rgb:[0,0,0]});draw(air);const skySupport=read(air.volumeTarget,0);let positive=0;
      for(let i=0;i<skySupport.length;i+=4)for(let c=0;c<3;c++){supportMax=Math.max(supportMax,skySupport[i+c]);if(skySupport[i+c]>0)positive++;}
      for(const D of [500,4000,10000,12000]){fill({kind:'far',rgb:[0,0,0]});depthValues.fill(camera.far/(camera.far-camera.near)-camera.far*camera.near/((camera.far-camera.near)*D));depth.needsUpdate=true;draw(air);const opaqueSupport=read(air.volumeTarget,0);let ratio=0;for(let i=0;i<skySupport.length;i+=4)for(let c=0;c<3;c++){const a=skySupport[i+c],b=opaqueSupport[i+c];ratio=Math.max(ratio,Math.abs(a-b)/(2**-24+.002*Math.abs(a)));if(!Number.isFinite(a)||!Number.isFinite(b))supportNonFinite++;}supportEndpointRatio=Math.max(supportEndpointRatio,ratio);supportRows.push({nodesPerPanel:nodes,totalNodesPerIntersectedLight:2*nodes,D,maximumBoundRatio:ratio,positiveChannels:positive});}
    }
    add('Shared support local S is positive and invariant beyond finite light support on sky/opaque rays',supportEndpointRatio<=1&&supportMax>0&&supportNonFinite===0&&supportRows.every(r=>r.positiveChannels>0),{maximumS:supportMax,maximumBoundRatio:supportEndpointRatio,nonFinite:supportNonFinite,rows:supportRows,tolerance:'One FP16 subnormal plus0.2% for separate projection arithmetic'});
    let referenceRatio=0,referenceAbsolute=0,referenceEvaluations=0,referenceDepthLimits=0;const oracleRows=[];
    for(const nodes of [6,8]){
      air.setSampling({steps:nodes});fill({kind:'sky',rgb:[0,0,0]});draw(air);const actual=read(air.volumeTarget,0),rows=[];
      for(const hx of [4,8,12])for(const hy of [3,6,9]){const x=2*hx,y=2*hy,direction=new THREE.Vector3((x+.5)/W*2-1,(y+.5)/H*2-1,1).applyMatrix4(camera.projectionMatrixInverse).applyMatrix4(camera.matrixWorld).sub(camera.position).normalize(),reference=integrateLocalSupportReference({eye:camera.position.toArray(),direction:direction.toArray(),distance:12000,sources:local.records.map(r=>({position:r.position.toArray(),radius:r.radius,range:r.range,rawRGB:[...r.rawRGB]})),coefficients:air.diagnostics().coefficients});referenceEvaluations+=reference.evaluations;referenceDepthLimits+=reference.depthLimitCount;const value=Array.from(actual.slice(4*(hy*W/2+hx),4*(hy*W/2+hx)+3));let ratio=0;for(let c=0;c<3;c++){const error=Math.abs(value[c]-reference.rgb[c]);referenceAbsolute=Math.max(referenceAbsolute,error);ratio=Math.max(ratio,error/(2**-24+.03*Math.abs(reference.rgb[c])));}referenceRatio=Math.max(referenceRatio,ratio);rows.push({hx,hy,actual:value,reference:reference.rgb,maximumBoundRatio:ratio});}oracleRows.push({nodesPerPanel:nodes,rows});
    }
    add('Support quadrature agrees with independent adaptive Simpson in physical distance',referenceRatio<=1&&referenceDepthLimits===0,{maximumAbsoluteError:referenceAbsolute,maximumBoundRatio:referenceRatio,evaluations:referenceEvaluations,depthLimitCount:referenceDepthLimits,rows:oracleRows,tolerance:'One FP16 subnormal+3% single-scatter quadrature on stated fixtures; not a universal error guarantee'});
    air.setSampling({steps:8});const supportExposure=[];for(const P of [-8,0,4,8]){sources(true,P);fill({kind:'sky',rgb:[0,0,0]});sun(0);draw(air);supportExposure.push({P,width:W,height:H,scatter:read(air.volumeTarget,0),composite:read(air.target)});}const supportCells=checkHalfSampleExposure(supportExposure),supportReconstruction=supportExposure.map(f=>({P:f.P,...checkBlackSkyComposite(f,{fp32OperationBudget:32})}));
    add('Support local S preserves one exposure scale through both measured FP16 stages',supportCells.passed&&supportReconstruction.every(r=>r.passed),{sourceIntervals:supportCells,reconstruction:supportReconstruction});
    sources(false);fill({kind:'sky'});sun(30);draw(air);const supportNoSource=read(air.target);let supportIdentity=0;for(let i=0;i<supportNoSource.length;i++)supportIdentity=Math.max(supportIdentity,Math.abs(supportNoSource[i]-THREE.DataUtils.fromHalfFloat(source[i])));
    add('Support model with no local sources retains exact original sky',supportIdentity===0&&air.getRadianceBound().maxRGB===0,{maximumDifference:supportIdentity,rawBound:air.getRadianceBound().maxRGB});
    let supportHDRNonFinite=0,supportHDROverflow=0,supportHDRMax=0,supportHDRRatio=0,supportHDRCases=0;
    for(const g of [0,.9])for(const humidity of [0,.95])for(const radius of [.1,2,12])for(const primary of [[24,0,0],[0,24,0],[0,0,24]]){air.configure({asymmetry:g,humidity,aerosolScale:48,rayleighScale:8});sources(true,0,{radius,rawRGB:primary,position:[0,2,-96]});fill({kind:'sky',rgb:[0,0,0]});sun(0);const bound=air.getRadianceBound(),frame=radiometry.update({recommendedEV:21,bounds:{medium:bound},force:true});local.setSceneExposure(frame.storageEV);draw(air);const output=read(air.target),scatter=read(air.volumeTarget,0);for(const data of [output,scatter])for(let i=0;i<data.length;i+=4)for(let c=0;c<3;c++){const value=data[i+c];if(!Number.isFinite(value))supportHDRNonFinite++;if(value<0||value>65504)supportHDROverflow++;supportHDRMax=Math.max(supportHDRMax,value);supportHDRRatio=Math.max(supportHDRRatio,value/(bound.maxRGB*frame.sceneScale||1));}supportHDRCases++;}
    add('Positive support-quadrature raw budget covers extreme actual FP16 output',supportHDRNonFinite===0&&supportHDROverflow===0&&supportHDRRatio<=1.005,{cases:supportHDRCases,nonFinite:supportHDRNonFinite,overflow:supportHDROverflow,maximumStored:supportHDRMax,maximumBoundRatio:supportHDRRatio});
    // A centre nearly collinear with a 10km ray previously produced false
    // perp^2=16 from subtracting large squares. Use a tiny source and high
    // aerosol height so the actual linked shader must handle this geometry.
    air.configure({...common,asymmetry:.9,aerosolHeight:1e9,rayleighHeight:1e9});camera.fov=.00001;camera.updateProjectionMatrix();camera.lookAt(camera.position.clone().add(new THREE.Vector3(.27724868059158325,.09560299664735794,-.9560299515724182)));camera.updateMatrixWorld();sources(true,0,{radius:.1,rawRGB:[1,1,1],position:camera.position.clone().addScaledVector(new THREE.Vector3(.27724868059158325,.09560299664735794,-.9560299515724182),10000).toArray(),range:280});fill({kind:'sky',rgb:[0,0,0]});sun(0);const farBound=air.getRadianceBound(),farFrame=radiometry.update({recommendedEV:21,bounds:{medium:farBound},force:true});local.setSceneExposure(farFrame.storageEV);draw(air);const farOut=read(air.target),farScatter=read(air.volumeTarget,0);let farMax=0,farBad=0;for(const data of [farOut,farScatter])for(let i=0;i<data.length;i+=4)for(let c=0;c<3;c++){const value=data[i+c];farMax=Math.max(farMax,value);if(!Number.isFinite(value)||value<0||value>farBound.maxRGB*farFrame.sceneScale*1.005)farBad++;}
    add('Far nearly-collinear source remains positive finite and inside its raw support budget',farBad===0&&farMax>0,{maximumStored:farMax,storedBound:farBound.maxRGB*farFrame.sceneScale,invalidOrOverBudget:farBad,geometry:'10km centre,0.1m radius,stable perpendicular-vector residual'});
    const viewportBefore=renderer.getCurrentViewport(new THREE.Vector4()).toArray(),targetBefore=renderer.getRenderTarget(),scissorBefore=Array.from(gl.getParameter(gl.SCISSOR_BOX)),scissorTestBefore=gl.isEnabled(gl.SCISSOR_TEST),flagsBefore=[renderer.autoClear,renderer.xr.enabled,renderer.shadowMap.autoUpdate,renderer.shadowMap.needsUpdate];draw(air);
    const viewportAfter=renderer.getCurrentViewport(new THREE.Vector4()).toArray(),scissorAfter=Array.from(gl.getParameter(gl.SCISSOR_BOX)),flagsAfter=[renderer.autoClear,renderer.xr.enabled,renderer.shadowMap.autoUpdate,renderer.shadowMap.needsUpdate];
    add('Pass preserves renderer target, physical viewport/scissor and frame flags',renderer.getRenderTarget()===targetBefore&&JSON.stringify(viewportBefore)===JSON.stringify(viewportAfter)&&JSON.stringify(scissorBefore)===JSON.stringify(scissorAfter)&&scissorTestBefore===gl.isEnabled(gl.SCISSOR_TEST)&&JSON.stringify(flagsBefore)===JSON.stringify(flagsAfter),{viewportBefore,viewportAfter,flagsBefore,flagsAfter});
    const samplerTypes=new Set([gl.SAMPLER_2D,gl.SAMPLER_CUBE,gl.SAMPLER_3D,gl.SAMPLER_2D_ARRAY,gl.INT_SAMPLER_2D,gl.UNSIGNED_INT_SAMPLER_2D]),samplers=[];
    for(const p of renderer.info.programs||[]){const shaders=gl.getAttachedShaders(p.program)||[];if(!shaders.some(s=>(gl.getShaderSource(s)||'').includes('void integrateAir(vec3 endpoint,int steps,out vec3 T,out vec3 S)')))continue;const n=gl.getProgramParameter(p.program,gl.ACTIVE_UNIFORMS);let count=0,names=[];for(let i=0;i<n;i++){const u=gl.getActiveUniform(p.program,i);if(samplerTypes.has(u.type)){count+=u.size;names.push(u.name);}}samplers.push({programId:p.id,count,names});}
    add('Actual linked programs remain within existing 8-sampler composite budget',samplers.length>=4&&samplers.every(p=>p.count<=8),{programs:samplers,hardwareLimit:gl.getParameter(gl.MAX_TEXTURE_IMAGE_UNITS),declaredBudget:air.diagnostics().declaredSamplerBudget});
    report.diagnostics=air.diagnostics();
    for(let i=0;i<16;i++){const e=gl.getError();if(e===gl.NO_ERROR)break;report.glErrors.push('0x'+e.toString(16));}
  }catch(error){report.error=String(error?.stack||error);}
  finally{
    try{air?.dispose();legacy?.dispose();local?.dispose();owned.forEach(t=>t.dispose());report.cleanup=true;}catch(error){report.cleanupError=String(error);}
    const oldViewport=saved.target?.viewport.clone(),oldScissor=saved.target?.scissor.clone(),oldScissorTest=saved.target?.scissorTest;
    if(saved.target){saved.target.viewport.copy(saved.viewport);saved.target.scissor.fromArray(saved.scissor);saved.target.scissorTest=saved.scissorTest;}
    try{renderer.setRenderTarget(saved.target,saved.face,saved.mip);}finally{if(saved.target){saved.target.viewport.copy(oldViewport);saved.target.scissor.copy(oldScissor);saved.target.scissorTest=oldScissorTest;}}
    renderer.autoClear=saved.autoClear;renderer.xr.enabled=saved.xr;renderer.shadowMap.autoUpdate=saved.shadowAuto;renderer.shadowMap.needsUpdate=saved.shadowNeeds;
  }
  report.passed=!report.error&&report.cleanup&&report.glErrors.length===0&&checks.length>=10&&checks.every(c=>c.passed);
  report.limits=['Numerical fixture, not full-scene visual acceptance or GPU performance/FPS measurement.','Same 1..8 quadratic midpoint integration and finite radius/range/cone source approximation as opaque air; source-to-sample air extinction remains omitted.','Sky retains its existing globally integrated atmosphere: final sky T=1, added S contains local sources only.','New raw budget is intentionally conservative; storage exposure is separate from photographic exposure.'];return report;
}
