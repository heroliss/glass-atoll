// Verification-only transcription of the bounded scalar-head integration.
// No GL, gameplay records, source scheduling, or production imports.
export const NEAR_HEAD_CASES=Object.freeze([
  Object.freeze({name:'axis-constant',motion:Object.freeze([32,0]),taps:Object.freeze([1,1,1,1,1,1,1,1])}),
  Object.freeze({name:'axis-varying',motion:Object.freeze([32,0]),taps:Object.freeze([0,.125,.5,1,.8,.4,.15,0])}),
  Object.freeze({name:'diagonal-constant',motion:Object.freeze([24,24]),taps:Object.freeze([1,1,1,1,1,1,1,1])}),
  Object.freeze({name:'oblique-varying',motion:Object.freeze([29,-13]),taps:Object.freeze([.1,.3,.8,1,.6,.4,.2,.05])}),
]);
export function planNearHeadShutter(motion,sigma,adaptive=true){
  const L=Math.hypot(...motion),x=L/(4*Math.max(1,sigma)),old=Object.freeze({adaptive:false,n0:8,n1:8,blend:0,maxLocal:8});
  if(!adaptive||!(x>1))return old;
  const n0=8*Math.floor(x),n1=n0+8,f=x-Math.floor(x),blend=Math.max(0,Math.min(1,f*f*f*(f*(f*6-15)+10))),axis=motion.map(v=>v/L),support=.5*(Math.abs(axis[0])+Math.abs(axis[1]))+6*sigma+.02,maxLocal=Math.min(n1,Math.ceil(2*support*n1/L)+4);
  return n1<=65536&&maxLocal<=128?Object.freeze({adaptive:true,n0,n1,blend,maxLocal}):old;
}
export function nearHeadGaussian(x,y,sigma){
  function erf(q){const sign=Math.sign(q);q=Math.abs(q);const t=1/(1+.3275911*q);return sign*(1-(((((1.061405429*t-1.453152027)*t)+1.421413741)*t-.284496736)*t+.254829592)*t*Math.exp(-q*q));}
  const s=sigma*1.41421356237;return Math.max(0,.25*(erf((x+.5)/s)-erf((x-.5)/s))*(erf((y+.5)/s)-erf((y-.5)/s)));
}
export function nearHeadLevel(offset,motion,sigma,taps,n,local=true){
  const L=Math.hypot(...motion);let lo=0,hi=n-1;
  if(local&&L>0){const axis=motion.map(v=>v/L),support=.5*(Math.abs(axis[0])+Math.abs(axis[1]))+6*sigma+.02,along=offset[0]*axis[0]+offset[1]*axis[1];lo=Math.max(0,Math.min(n,Math.ceil(n*(.5+(along-support)/L)-.5)));hi=Math.max(-1,Math.min(n-1,Math.floor(n*(.5+(along+support)/L)-.5)));}
  let value=0,visited=0;for(let i=lo;i<=hi;i++){const t=(i+.5)/n-.5,weight=taps[Math.floor(i/(n/8))];value+=nearHeadGaussian(offset[0]-motion[0]*t,offset[1]-motion[1]*t,sigma)*weight;visited++;}return{value:value/n,visited};
}
export function nearHeadPixel(offset,motion,sigma,taps,plan=planNearHeadShutter(motion,sigma),local=true){
  if(!plan.adaptive){let value=0;for(let i=0;i<8;i++){const t=(i+.5)/8-.5;value+=nearHeadGaussian(offset[0]-motion[0]*t,offset[1]-motion[1]*t,sigma)*taps[i]*.125;}return{value,visited:8};}
  const a=nearHeadLevel(offset,motion,sigma,taps,plan.n0,local);if(plan.blend===0)return a;const b=nearHeadLevel(offset,motion,sigma,taps,plan.n1,local);return{value:a.value*(1-plan.blend)+b.value*plan.blend,visited:Math.max(a.visited,b.visited)};
}
