"""One closed append-only source change. Existing bytes are preserved exactly."""
from pathlib import Path
import hashlib,json
root=Path(__file__).resolve().parent.parent
target=root/'firework-layer-profile.js'
baseline=root/'verification/baselines/r38-before-taps-writer/firework-layer-profile.js'
old=baseline.read_bytes()
assert hashlib.sha256(old).hexdigest()=='411242962dc8681e2eb487acc7f03937ebe32331ec06414f9e78a5674778c537'
assert target.read_bytes()==old
addition=r'''
// Internal optical fast entry: caller owns all24 tap entries until its cached
// optical row is retired. No pooled buffer, average/integral or material change.
// The existing public summary sampler above remains byte-for-byte unchanged.
export function writeProfileBodyEmissionBins(body,{fromAge,toAge,bins=8,outRGB}={}){
  if(!body.burnProfile)throw new RangeError('Vector profile window is opt-in only');finite(fromAge,'Window start');finite(toAge,'Window end');
  if(!verifiedWindowProfiles.has(body.burnProfile)){sampleBurnProfile(body.burnProfile,0);verifiedWindowProfiles.add(body.burnProfile);}
  if(toAge<fromAge||!Number.isFinite(toAge-fromAge)||bins!==8)throw new RangeError('Profile window requires ordered finite ages and8 bins');
  if(!(outRGB instanceof Float64Array||outRGB instanceof Float32Array)||outRGB.length<24)throw new TypeError('outRGB requires24 Float64/Float32 entries');
  const rgbTaps=outRGB,delay=body.ignitionDelay??0,start=fromAge-delay,end=toAge-delay,width=end-start,knots=body.burnProfile.emission.knots;
  if(width===0){const v=sampleBurnProfile(body.burnProfile,start).emissionRGBReference;for(let i=0;i<8;i++)for(let c=0;c<3;c++)rgbTaps[i*3+c]=v[c];}
  else for(let bin=0;bin<8;bin++){
    const lo=start+width*bin/8,hi=bin===7?end:start+width*(bin+1)/8;if(!(hi>lo))throw new RangeError('Positive profile bins are not representable at this age');
    // Keep the public sampler's overlap, interpolation, compensation and store
    // operations in exactly the same order. Only unused summary work is absent.
    let r=0,g=0,bv=0,cr=0,cg=0,cb=0;
    for(let k=0;k<knots.length-1;k++){
      const a=knots[k],b=knots[k+1],left=Math.max(lo,a.age),right=Math.min(hi,b.age);if(!(right>left))continue;
      const u=(left-a.age)/(b.age-a.age),v=(right-a.age)/(b.age-a.age),span=right-left;
      let va=a.rgb[0]+(b.rgb[0]-a.rgb[0])*u,vb=a.rgb[0]+(b.rgb[0]-a.rgb[0])*v,x=(va+vb)*.5*span-cr,next=r+x;cr=(next-r)-x;r=next;
      va=a.rgb[1]+(b.rgb[1]-a.rgb[1])*u;vb=a.rgb[1]+(b.rgb[1]-a.rgb[1])*v;x=(va+vb)*.5*span-cg;next=g+x;cg=(next-g)-x;g=next;
      va=a.rgb[2]+(b.rgb[2]-a.rgb[2])*u;vb=a.rgb[2]+(b.rgb[2]-a.rgb[2])*v;x=(va+vb)*.5*span-cb;next=bv+x;cb=(next-bv)-x;bv=next;
    }
    rgbTaps[bin*3]=r/(width/8);rgbTaps[bin*3+1]=g/(width/8);rgbTaps[bin*3+2]=bv/(width/8);
  }
  return rgbTaps;
}
'''.encode('utf-8')
assert old.endswith(b'\n') and not b'\r' in old and addition.startswith(b'\n')
target.write_bytes(old+addition)
report={'schema':'glass-atoll.r38-taps-writer-insertion.v1','file':'firework-layer-profile.js','mode':'append only; original complete bytes remain prefix','originalSHA256':hashlib.sha256(old).hexdigest(),'candidateSHA256':hashlib.sha256(old+addition).hexdigest(),'oldBytes':len(old),'appendedBytes':len(addition),'newExport':'writeProfileBodyEmissionBins','appendedSource':addition.decode('utf-8'),'inverse':'Remove exactly appendedSource bytes and verify originalSHA256'}
(root/'verification/r38-taps-writer-insertion.json').write_text(json.dumps(report,indent=2)+'\n',encoding='utf-8')
print(json.dumps({k:v for k,v in report.items() if k!='appendedSource'},indent=2))
