// QA ONLY: one Array descriptor-preflight site, no numerical changes.
export const edits=Object.freeze([
  [
    "inherited output descriptor preflight",
    "    if(Array.isArray(out)&&(Object.isFrozen(out)||[0,1,2].some(i=>{const key=String(i),own=Object.getOwnPropertyDescriptor(out,key);if(own)return!('value'in own)||own.writable===false;if(!Object.isExtensible(out))return true;for(let p=Object.getPrototypeOf(out);p;p=Object.getPrototypeOf(p)){const d=Object.getOwnPropertyDescriptor(p,key);if(d)return!('value'in d)||d.writable===false;}return false;})))throw new TypeError('Transmission output must be writable.');",
    "    if(Array.isArray(out)&&(Object.isFrozen(out)||[0,1,2].some(i=>{const d=Object.getOwnPropertyDescriptor(out,String(i));return d?d.writable===false||!!d.get||!!d.set:!Object.isExtensible(out);})))throw new TypeError('Transmission output must be writable.');"
  ]
].map(Object.freeze));
export function normalize(source,{required=false}={}){if(!required&&!source.includes("for(let p=Object.getPrototypeOf(out)"))return source;let out=source;for(const [name,from,to]of edits){const n=out.split(from).length-1;if(n!==1)throw Error('Transmission out inverse '+name+' count '+n);out=out.replace(from,to);}return out;}
