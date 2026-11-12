// Temporary, explicit development capture. Consumes GL error flags and must
// never be used for acceptance/performance. Same existing context only.
export function traceFirstGLFault(gl){
  const old=new Map(),getError=gl.getError.bind(gl),getParameter=gl.getParameter.bind(gl);
  const restore=()=>{for(const [key,value]of old){if(value===undefined)delete gl[key];else gl[key]=value;}old.clear();};
  window.__r17RestoreGLTrace=restore;
  const entry=getError();if(entry){window.__r17FirstGLFault={method:'constructor-entry',error:entry};return;}
  for(let p=Object.getPrototypeOf(gl);p&&p!==Object.prototype;p=Object.getPrototypeOf(p))for(const key of Object.getOwnPropertyNames(p)){
    const descriptor=Object.getOwnPropertyDescriptor(p,key);
    if(typeof descriptor.value!=='function'||key==='getError'||key==='constructor'||old.has(key))continue;
    const fn=gl[key];old.set(key,Object.hasOwn(gl,key)?fn:undefined);
    gl[key]=function(...args){const result=fn.apply(this,args),error=getError();if(error&&!window.__r17FirstGLFault){window.__r17FirstGLFault={method:key,error,args:args.map(v=>Array.isArray(v)?v:typeof v==='number'||typeof v==='string'?v:typeof v),drawIsDefault:getParameter(gl.DRAW_FRAMEBUFFER_BINDING)===null,currentDrawBuffers:Array.from({length:getParameter(gl.MAX_DRAW_BUFFERS)},(_,i)=>getParameter(gl.DRAW_BUFFER0+i)),stack:new Error().stack};restore();}return result;};
  }
  setTimeout(restore,20000);
}
