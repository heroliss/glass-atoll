// Independent reference integration in physical distance s, not production's
// theta/Gauss rule. Pure numerical fixture; no renderer, scene or source edits.
const dot=(a,b)=>a[0]*b[0]+a[1]*b[1]+a[2]*b[2];
function opticalLength(y,dy,s,H){
  if(s<=0)return 0;if(Math.abs(dy)<1e-12)return s*Math.exp(-Math.max(0,y)/H);
  const end=y+dy*s;if(y<=0&&end<=0)return s;
  let start=0,stop=s,below=0;
  if(y<0){start=-y/dy;below=start;}else if(end<0){stop=-y/dy;below=s-stop;}
  const ya=Math.max(0,y+dy*start),length=stop-start,x=dy*length/H;
  return below+Math.exp(-ya/H)*length*(x===0?1:-Math.expm1(-x)/x);
}
export function integrateLocalSupportReference({eye,direction,distance,sources,coefficients,absoluteTolerance=1e-14,relativeTolerance=1e-7,maxDepth=24}){
  const beta=coefficients,g=beta.asymmetry,rgb=[0,0,0];let evaluations=0,depthLimitCount=0,estimatedError=[0,0,0];
  for(let id=0;id<sources.length;id++){
    const source=sources[id],colour=source.rawRGB,range=source.range;if(!colour.some(v=>v>0))continue;
    const centre=source.position.map((v,c)=>v-eye[c]),closest=dot(centre,direction),perp2=Math.max(0,dot(centre,centre)-closest*closest),disc=range*range-perp2;if(disc<=0)continue;
    const reach=Math.sqrt(disc),lo=Math.max(0,closest-reach),hi=Math.min(distance,closest+reach);if(!(hi>lo))continue;
    const radius=Math.max(source.radius,id<3?.1:0),core=Math.sqrt(Math.max(0,radius*radius-perp2));
    const cuts=[lo,...[closest-core,closest,closest+core].filter(x=>x>lo&&x<hi),hi].sort((a,b)=>a-b).filter((v,i,a)=>i===0||v!==a[i-1]);
    const integrand=s=>{
      evaluations++;const p=eye.map((v,c)=>v+direction[c]*s),delta=source.position.map((v,c)=>v-p[c]),d2=dot(delta,delta),den=Math.max(d2,radius*radius),cutDistance=id<3?Math.sqrt(d2):Math.sqrt(den),cut=Math.max(0,1-(cutDistance/range)**4)**2,mu=Math.max(-1,Math.min(1,dot(delta,direction)/Math.sqrt(Math.max(d2,1e-10)))),pr=3/(16*Math.PI)*(1+mu*mu),pm=(1-g*g)/(4*Math.PI*(1+g*g-2*g*mu)**1.5),alt=Math.max(0,p[1]),r=Math.exp(-alt/beta.rayleighHeight),m=Math.exp(-alt/beta.aerosolHeight),R=opticalLength(eye[1],direction[1],s,beta.rayleighHeight),M=opticalLength(eye[1],direction[1],s,beta.aerosolHeight);
      return colour.map((v,c)=>v*cut/den*(beta.betaRayleighRGB[c]*r*pr+beta.betaMieScatteringRGB[c]*m*pm)*Math.exp(-beta.betaRayleighRGB[c]*R-beta.betaMieExtinctionRGB[c]*M));
    };
    const simpson=(a,b,fa,fm,fb)=>fa.map((v,c)=>(b-a)/6*(v+4*fm[c]+fb[c]));
    function recurse(a,b,fa,fm,fb,whole,epsilon,depth){
      const middle=(a+b)/2,leftMid=(a+middle)/2,rightMid=(middle+b)/2,fl=integrand(leftMid),fr=integrand(rightMid),left=simpson(a,middle,fa,fl,fm),right=simpson(middle,b,fm,fr,fb),sum=left.map((v,c)=>v+right[c]),delta=sum.map((v,c)=>v-whole[c]);
      const good=delta.every((v,c)=>Math.abs(v)/15<=epsilon+relativeTolerance*Math.abs(sum[c]));
      if(good||depth>=maxDepth){if(!good)depthLimitCount++;for(let c=0;c<3;c++)estimatedError[c]+=Math.abs(delta[c])/15;return sum.map((v,c)=>v+delta[c]/15);}
      const l=recurse(a,middle,fa,fl,fm,left,epsilon/2,depth+1),r=recurse(middle,b,fm,fr,fb,right,epsilon/2,depth+1);return l.map((v,c)=>v+r[c]);
    }
    for(let k=0;k<cuts.length-1;k++){const a=cuts[k],b=cuts[k+1],fa=integrand(a),fm=integrand((a+b)/2),fb=integrand(b),sum=recurse(a,b,fa,fm,fb,simpson(a,b,fa,fm,fb),absoluteTolerance/(cuts.length-1),0);for(let c=0;c<3;c++)rgb[c]+=sum[c];}
  }
  return{rgb,evaluations,depthLimitCount,estimatedError,method:'adaptive Simpson in physical distance, split at source closest/core boundaries; independent from production theta Gauss'};
}
