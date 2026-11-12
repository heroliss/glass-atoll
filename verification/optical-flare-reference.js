// QA-only double-precision rasterization of the declared positive operators.
// Independent loops/sampler math, with no GPU or production module dependency.
// Half storage, shader rounding and hardware bilinear fractions are deliberately
// not emulated; actual GPU comparisons must include those stated error bounds.
const clamp=(value,min,max)=>Math.max(min,Math.min(max,value));
export function sampleReference(image,u,v,{zeroOutside=false}={}){
  if(zeroOutside&&(u<0||u>1||v<0||v>1))return[0,0,0];
  const x=u*image.width-.5,y=v*image.height-.5,ix=Math.floor(x),iy=Math.floor(y),fx=x-ix,fy=y-iy,out=[0,0,0];
  for(let dy=0;dy<2;dy++)for(let dx=0;dx<2;dx++){
    const offset=(clamp(iy+dy,0,image.height-1)*image.width+clamp(ix+dx,0,image.width-1))*3,weight=(dx?fx:1-fx)*(dy?fy:1-fy);
    for(let c=0;c<3;c++)out[c]+=weight*image.data[offset+c];
  }
  return out;
}
function downsampleReference(input){
  const width=Math.max(1,Math.ceil(input.width/2)),height=Math.max(1,Math.ceil(input.height/2)),data=new Float64Array(width*height*3);
  for(let y=0;y<height;y++)for(let x=0;x<width;x++){
    const result=[0,0,0];
    for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++){
      const weight=(dx===0?.5:.25)*(dy===0?.5:.25),value=sampleReference(input,(x+.5)/width+dx/input.width,(y+.5)/height+dy/input.height);
      for(let c=0;c<3;c++)result[c]+=weight*value[c];
    }
    data.set(result,(y*width+x)*3);
  }
  return{width,height,data};
}
export function referenceOpticalPSF(image,{bloom=true,flare=false}={}){
  if(!bloom&&!flare)return{width:image.width,height:image.height,data:new Float64Array(image.data)};
  const b=bloom?(flare?.013:.018):0,g=flare?.003:0,v=flare?.002:0,direct=1-b-g-v;
  const levels=[];let input=image;for(let i=0;i<4;i++){input=downsampleReference(input);levels.push(input);}
  const data=new Float64Array(image.data.length),scales=[-.72,-.48,.86],weights=[[.48,.44,.36],[.32,.36,.40],[.20,.20,.24]],bloomWeights=[.4,.3,.2,.1];
  for(let y=0;y<image.height;y++)for(let x=0;x<image.width;x++){
    const u=(x+.5)/image.width,w=(y+.5)/image.height,result=[0,0,0],original=sampleReference(image,u,w);
    for(let c=0;c<3;c++)result[c]=direct*original[c];
    if(b)for(let i=0;i<4;i++){const colour=sampleReference(levels[i],u,w);for(let c=0;c<3;c++)result[c]+=b*bloomWeights[i]*colour[c];}
    if(g)for(let i=0;i<scales.length;i++){
      const s=scales[i],colour=sampleReference(levels[1],.5+s*(u-.5),.5+s*(w-.5),{zeroOutside:true});
      for(let c=0;c<3;c++)result[c]+=g*weights[i][c]*s*s*colour[c];
    }
    if(v){const s=.24,colour=sampleReference(levels[3],.5+s*(u-.5),.5+s*(w-.5),{zeroOutside:true});for(let c=0;c<3;c++)result[c]+=v*s*s*colour[c];}
    data.set(result,(y*image.width+x)*3);
  }
  return{width:image.width,height:image.height,data};
}
export function referenceImage(width,height,pixel){
  const data=new Float64Array(width*height*3);
  for(let y=0;y<height;y++)for(let x=0;x<width;x++)data.set(pixel(x,y),(y*width+x)*3);
  return{width,height,data};
}
export function referenceStats(image){
  const sum=[0,0,0],maximum=[-Infinity,-Infinity,-Infinity],minimum=[Infinity,Infinity,Infinity];let nonFinite=0;
  for(let i=0;i<image.data.length;i++){
    const c=i%3,value=image.data[i];if(!Number.isFinite(value))nonFinite++;
    sum[c]+=value;maximum[c]=Math.max(maximum[c],value);minimum[c]=Math.min(minimum[c],value);
  }
  return{sum,maximum,minimum,nonFinite};
}
