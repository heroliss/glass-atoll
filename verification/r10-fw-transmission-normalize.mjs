// QA ONLY: exact authorized FW transmission layer; no broad regex stripping.
export const edits=Object.freeze([
  [
    "private caller scratch",
    "  const sourceTransmissionScratch=new Float64Array(3);\n",
    ""
  ],
  [
    "optional T writer with old method fallback",
    "      if(medium&&!smoke){const T=typeof medium.writeTransmission==='function'?medium.writeTransmission(eye,p.position,sourceTransmissionScratch,{reflection,planeY}):medium.transmission(eye,p.position,{reflection,planeY});for(let c=0;c<3;c++)arrays.colour[i*3+c]*=T[c];}",
    "      if(medium&&!smoke){const T=medium.transmission(eye,p.position,{reflection,planeY});for(let c=0;c<3;c++)arrays.colour[i*3+c]*=T[c];}"
  ]
].map(Object.freeze));
export function normalize(source,{required=false}={}){if(!required&&!source.includes("sourceTransmissionScratch"))return source;let out=source;for(const [name,from,to]of edits){const n=out.split(from).length-1;if(n!==1)throw Error("FW transmission inverse "+name+' count '+n);out=out.replace(from,to);}return out;}
