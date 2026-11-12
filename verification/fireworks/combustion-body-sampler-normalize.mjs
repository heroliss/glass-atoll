// QA ONLY: exact authorized G1 body sampler layer; no broad regex stripping.
export const edits=Object.freeze([
  [
    "lazy native-body index slot",
    "  let smokeBodyIndexCache;\n",
    ""
  ],
  [
    "optional causal body sampler",
    "    sampleBody(eventId,{bodyId,time}={}){\n      if(disposed)throw new Error('Cannot sample disposed combustion bodies');\n      if(!Number.isSafeInteger(bodyId)||bodyId<0||!Number.isFinite(time)||time>simulation.time)throw new RangeError('Combustion body sampling requires a nonnegative native body ID and finite past/current time');\n      const event=smokeActiveEvent(eventId);let index=smokeBodyIndexCache?.get(event);\n      if(!index){index=new Map(event.heads.map(body=>[body.id,body]));(smokeBodyIndexCache??=new WeakMap()).set(event,index);}\n      const body=index.get(bodyId);if(!body||time<body.birth||time>=body.birth+body.life)throw new RangeError('Combustion source requires an existing burning native body at the requested time');\n      const position=sampleBody(body,time,simulation.windTimeline).position;if(!position.every(Number.isFinite))throw new RangeError('Combustion source point is not finite');\n      return Object.freeze({eventId,bodyId,time,position:smokeVector(position)});\n    },\n",
    ""
  ]
].map(Object.freeze));
export function normalize(source,{required=false}={}){if(!required&&!source.includes("smokeBodyIndexCache"))return source;let out=source;for(const [name,from,to]of edits){const n=out.split(from).length-1;if(n!==1)throw Error("G1 body sampler inverse "+name+' count '+n);out=out.replace(from,to);}return out;}
