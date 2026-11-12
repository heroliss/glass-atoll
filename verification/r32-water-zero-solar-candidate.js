// Verification-only pure source transform. No imports, file writes or GL.
const GUARD='        bool nightSolar0=(uSunIrradiance==0.0 && uSubmergedCount==0 && uDebugMode==0.0);';
const join=lines=>lines.join('\n');
const indent=body=>body.split('\n').map(line=>'  '+line).join('\n');
const solar=join([
'        vec3 lightRay=refract(-uSun,macroNormal,1./1.333);',
'        float sunlightPath=max(.0,oceanDatum(receiver.xz)-receiver.y)/max(.15,-dot(lightRay,macroNormal));',
'        vec3 solarTransmission=exp(-extinction*sunlightPath)*(1.-fresnelDielectric(dot(uSun,macroNormal)));',
'        // Air-side occlusion must be queried at the solar ENTRY point, not',
'        // projected straight onto the sea surface or directly onto the bed.',
'        vec3 solarEntry=receiver-lightRay*sunlightPath;',
'        float bedTreeVisibility=treeSunVisibility(solarEntry);',
'        float surfaceTreeVisibility=treeSunVisibility(vWorld);',
]);
const volumePath=join([
'        float volumeSolarPath=max(0.,oceanDatum(volumePoint.xz)-volumePoint.y)/max(.15,-dot(lightRay,macroNormal));',
'        float volumeTreeVisibility=treeSunVisibility(volumePoint-lightRay*volumeSolarPath);',
]);
const cloud=join([
'        float solarCloud=getCloudShadow(vWorld,uCloudTime);',
'        float concentration=texture2D(uCaustic,bottom.xz/(2.*uCausticExtent)+.5).r;',
'        float coverage=1.-smoothstep(uCausticExtent*.9,uCausticExtent*.99,max(abs(bottom.x),abs(bottom.z)));',
'        concentration=mix(1.,max(.05,concentration),coverage*smoothstep(.08,.4,oceanDatum(bottom.xz)-bottom.y)*(1.-smoothstep(1.5,5.,oceanDatum(bottom.xz)-bottom.y)));',
]);
const volumeTransmission='        vec3 volumeSolarTransmission=exp(-extinction*volumeSolarPath)*(1.-fresnelDielectric(dot(uSun,macroNormal)));';
const glint=join([
'        vec3 H=normalize(V+uSun);',
'        float NoH=max(dot(n,H),0.),NoL=max(dot(n,uSun),0.),NoV=max(facing,.001);',
'        vec3 normalDx=dFdx(n),normalDy=dFdy(n);',
'        float pixelNormalVariance=.083333*(dot(normalDx,normalDx)+dot(normalDy,normalDy));',
'        float temporalNormalVariance=${waveStatistics.swellTemporalSlopeVariance.toFixed(14)}*uSwell*uSwell+${waveStatistics.windTemporalSlopeVariance.toFixed(14)}*windGain*windGain;',
'        float aa=.0001+unresolvedSlopeVariance+.00001081125+uGlintAA*(pixelNormalVariance+temporalNormalVariance);',
'        float nh2=max(.0001,NoH*NoH);',
'        float D=exp((nh2-1.)/(aa*nh2))/(3.14159265*aa*nh2*nh2);',
'        float av=NoV/max(.0001,sqrt(aa*(1.-NoV*NoV)));',
'        float al=NoL/max(.0001,sqrt(aa*(1.-NoL*NoL)));',
'        float Gv=av>=1.6?1.:(3.535*av+2.181*av*av)/(1.+2.276*av+2.577*av*av);',
'        float Gl=al>=1.6?1.:(3.535*al+2.181*al*al)/(1.+2.276*al+2.577*al*al);',
'        float Fsun=fresnelDielectric(max(dot(V,H),0.));',
'        vec3 solarGlint=uSunColor*uSunIrradiance*solarCloud*surfaceTreeVisibility*D*Gv*Gl*Fsun/(4.*NoV);',
]);
const assigned=(body,names)=>{
  let result=body;
  for(const [type,name] of names){const token=type+' '+name+'=';if(result.split(token).length!==2)throw new Error('Internal zero-solar declaration contract');result=result.replace(token,name+'=');}
  return result;
};
const block=(declarations,body)=>declarations+'\n        if(!nightSolar0){\n'+indent(body)+'\n        }';
const patches=Object.freeze([
  Object.freeze({id:'solar-entry-and-two-shadows',old:solar,next:GUARD+'\n'+block(join([
'        vec3 lightRay=vec3(0.0),solarTransmission=vec3(1.0);',
'        float sunlightPath=0.0,bedTreeVisibility=1.0,surfaceTreeVisibility=1.0;',
]),assigned(solar,[['vec3','lightRay'],['float','sunlightPath'],['vec3','solarTransmission'],['float','bedTreeVisibility'],['float','surfaceTreeVisibility']]))}),
  Object.freeze({id:'volume-solar-entry-and-shadow',old:volumePath,next:block('        float volumeSolarPath=0.0,volumeTreeVisibility=1.0;',assigned(volumePath,[['float','volumeSolarPath'],['float','volumeTreeVisibility']]))}),
  Object.freeze({id:'solar-cloud-and-caustic',old:cloud,next:block('        float solarCloud=1.0,concentration=1.0;',assigned(cloud,[['float','solarCloud'],['float','concentration']]))}),
  Object.freeze({id:'volume-solar-transmission',old:volumeTransmission,next:block('        vec3 volumeSolarTransmission=vec3(1.0);',assigned(volumeTransmission,[['vec3','volumeSolarTransmission']]))}),
  Object.freeze({id:'direct-solar-glint-only',old:glint,next:block(join(['        float temporalNormalVariance=0.0,aa=0.0;','        vec3 solarGlint=vec3(0.0);']),assigned(glint,[['float','temporalNormalVariance'],['float','aa'],['vec3','solarGlint']]))}),
]);
function once(source,token){if(source.split(token).length!==2)throw new Error('Zero-solar candidate source anchor drift');}
function transform(source,reverse){
  if(typeof source!=='string')throw new TypeError('Water source must be a string');
  const newline=source.includes('\r\n')?'\r\n':'\n';
  if(source.replaceAll('\r\n','').includes('\r'))throw new Error('Unsupported water source newline');
  let output=source;
  if(!reverse&&source.includes('bool nightSolar0='))throw new Error('Zero-solar candidate already applied');
  for(const patch of (reverse?[...patches].reverse():patches)){
    const from=(reverse?patch.next:patch.old).replaceAll('\n',newline),to=(reverse?patch.old:patch.next).replaceAll('\n',newline);
    once(output,from);output=output.replace(from,to);
  }
  return output;
}
export const createWaterZeroSolarCandidate=source=>transform(source,false);
export const restoreWaterZeroSolarCandidate=source=>transform(source,true);
export const WATER_ZERO_SOLAR_CANDIDATE=Object.freeze({
  revision:'r32-water-exact-zero-direct-source-v1',
  expectedProductionSHA256:'d7d5b76dadf35e2e507b640b8975fb3819821b29d113ceeebf195080fd88b045',
  guard:'uSunIrradiance==0.0 && uSubmergedCount==0 && uDebugMode==0.0',
  patches:Object.freeze(patches.map(p=>p.id)),
  changedEquations:false,qualityChanges:false,productionEdits:false,actualGPU:false,
  limitation:'Exact source inverse and CPU finite-equation evidence only; GPU compile, derivative/raster parity and speed remain unverified',
});
