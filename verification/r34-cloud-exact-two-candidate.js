// Verification only. No shader admission, production edit or GPU execution.
const GPU_ANCHOR='    vec4 detail=textureLod(uCloudNoise,uvw*3.17+vec3(0.19,-time*0.00012,0.43),detailLod);';
const CPU_ANCHOR='    const detail=sampleTexture(volume,size,uv[0]*3.17+.19,uv[1]*3.17-time*.00012,uv[2]*3.17+.43,true);';
const GPU_PUFF=`    vec3 puffUV=uvw*2.6+vec3(.27,.41,.73)+(shape.gbb-.5)*.12;
    float puff=textureLod(uCloudNoise,puffUV,min(lod*1.35,1.2)).a;
    float billows=.78*puff+.22*shape.a;
    float heightPenalty=.75*h*h+.65*h*h*h*h;
    float mass=(billows-.45)*1.4+(shape.r-.5)*.28+(region-.5)*.46+.15-heightPenalty;
    float entrainment=(1.-detail.g)*.14+(1.-detail.b)*.11;
    // Continuous liquid-water amount; opacity arises through Beer integration,
    // rather than smoothstep prematurely flattening every interior to1.
    float billowBody=1.-exp(-1.7*max(0.,mass-entrainment));`;
const CPU_PUFF=`    const puffUV=uv.map((v,i)=>v*2.6+[.27,.41,.73][i]+(shape[i===0?1:2]-.5)*.12),puff=sampleTexture(volume,size,...puffUV,true)[3];
    const billows=.78*puff+.22*shape[3],heightPenalty=.75*height*height+.65*height**4,mass=(billows-.45)*1.4+(shape[0]-.5)*.28+(region-.5)*.46+.15-heightPenalty;
    const entrainment=(1-detail[1])*.14+(1-detail[2])*.11,billowBody=1-Math.exp(-1.7*Math.max(0,mass-entrainment));`;
const GPU_BASE='    float base=smoothstep(0.0,0.052,h+(shape.g-0.5)*0.018);';
const GPU_CONTINUITY=`    if(uCloudBaseContinuity>.5&&uCloudShapeBlend>1.&&shape.g>.5&&h<.052){
      float baseContinuous=smoothstep(0.,.052,h+min((shape.g-.5)*.018,0.));`;
const CPU_CONTINUITY=`    if(uniforms.uCloudBaseContinuity.value>.5&&blend>1&&shape[1]>.5&&height<.052){
      const continuousBase=smooth(0,.052,height+Math.min((shape[1]-.5)*.018,0));`;
const GPU_BLOCK=`
    // R34 EXACT_TWO_GPU: private finite-domain candidate; endpoint bits require actual GPU validation.
    if(uCloudShapeBlend==2.0){
${GPU_BASE.replace(/^    /gm,'      ')}
${GPU_PUFF.replace(/^    /gm,'      ')}
${GPU_CONTINUITY.replace(/^    /gm,'      ')}
        float applied=billowBody*baseContinuous;
        return applied*region*uCloudMoisture*smoothstep(0.0,0.07,uCloudCoverage);
      }
      return billowBody*base*region*uCloudMoisture*smoothstep(0.0,0.07,uCloudCoverage);
    }`;
const CPU_BLOCK=`
    // R34 EXACT_TWO_CPU: raw exact2 only; all original clamped-blend fallback remains below.
    if(uniforms.uCloudShapeBlend.value===2){
      const base=smooth(0,.052,height+(shape[1]-.5)*.018);
${CPU_PUFF.replace(/^    /gm,'      ')}
      if(uniforms.uCloudBaseContinuity.value>.5&&shape[1]>.5&&height<.052){
        const continuousBase=smooth(0,.052,height+Math.min((shape[1]-.5)*.018,0));
        const applied=billowBody*continuousBase;
        return applied*region*uniforms.uCloudMoisture.value*smooth(0,.07,uniforms.uCloudCoverage.value);
      }
      return billowBody*base*region*uniforms.uCloudMoisture.value*smooth(0,.07,uniforms.uCloudCoverage.value);
    }`;
const REQUIRED=[GPU_ANCHOR,CPU_ANCHOR,GPU_PUFF,CPU_PUFF,GPU_BASE,GPU_CONTINUITY,CPU_CONTINUITY,
 'float selected=uCloudShapeBlend<=1.?mix(legacyBody,thermalBody,clamp(uCloudShapeBlend,0.,1.)):mix(thermalBody,billowBody,clamp(uCloudShapeBlend-1.,0.,1.));',
 'const selected=blend<=1?legacyBody*(1-blend)+thermalBody*blend:thermalBody*(2-blend)+billowBody*(blend-1);'];
const count=(s,x)=>s.split(x).length-1,demand=(v,m)=>{if(!v)throw Error(m);};
function format(source){demand(typeof source==='string'&&source.length<262144,'One bounded sky source string required');const crlf=source.includes('\r\n');demand(!source.includes('\r')||crlf&&!source.replaceAll('\r\n','').includes('\n')&&!source.replaceAll('\r\n','').includes('\r'),'Uniform LF or CRLF source required');const eol=crlf?'\r\n':'\n';return{lf:source.replaceAll('\r\n','\n'),eol};}
function validate(lf){demand(!lf.includes('R34 EXACT_TWO_'),'Already transformed or unexpected R34 marker');for(const x of REQUIRED)demand(count(lf,x)===1,'Expected one unchanged cloud expression: '+x.slice(0,72));}
export function createCloudExactTwoCandidate(source){const{lf,eol}=format(source);validate(lf);return lf.replace(GPU_ANCHOR,GPU_ANCHOR+GPU_BLOCK).replace(CPU_ANCHOR,CPU_ANCHOR+CPU_BLOCK).replaceAll('\n',eol);}
export function restoreCloudExactTwoCandidate(source){const{lf,eol}=format(source);demand(count(lf,GPU_BLOCK)===1&&count(lf,CPU_BLOCK)===1,'Exact complete R34 blocks required for inverse');const original=lf.replace(GPU_BLOCK,'').replace(CPU_BLOCK,'');validate(original);return original.replaceAll('\n',eol);}
export const R34_CLOUD_EXACT_TWO_CANDIDATE=Object.freeze({revision:'r34-cloud-exact-two-private-v1',expectedSkySHA256:'51db558ead3dea10d4c74633c2a8eb5bedf20952c136e0668b97de0a5ffc8eee',gpuGuard:'uCloudShapeBlend==2.0',cpuGuard:'uniforms.uCloudShapeBlend.value===2',sampleOrder:Object.freeze(['weather@LOD0','shape@lod','detail@detailLod','puff@min(lod*1.35,1.2)']),gpuBitwiseEquivalent:false,productionAdmitted:false,finiteDomain:'Normalized finite noise/weather, finite bounded positions/time/LOD/uniforms, positive layer thickness and an interior altitude; no NaN/Inf/overflow claim'});
