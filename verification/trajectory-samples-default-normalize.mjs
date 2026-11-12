// QA ONLY. Exact inverse of the optional12/48 source-count extension.
// Never used by runtime; every authorized replacement must occur exactly once.
import {normalizeTaylorAdapterSource,normalizeTaylorHostSource} from './taylor-default-normalize.mjs';
export const trajectorySamplesAdapterEdits=Object.freeze([
  ['selection argument','function chooseRoots(d,trajectorySlots){','function chooseRoots(d){'],
  ['strata limit','if(selected.length>trajectorySlots)throw','if(selected.length>12)throw'],
  ['bounded maximin count','Math.min(trajectorySlots,roots.length)','Math.min(12,roots.length)'],
  ['recipe argument','function makeEntry(d,serial,areas,centralFraction,kernelModel,trajectorySlots){','function makeEntry(d,serial,areas,centralFraction,kernelModel){'],
  ['selection forwarding','const roots=chooseRoots(d,trajectorySlots);','const roots=chooseRoots(d);'],
  ['factory option',"centralFraction=.20,trajectorySlots=12,transport=SMOKE_SOURCE_TRANSPORT}","centralFraction=.20,transport=SMOKE_SOURCE_TRANSPORT}"],
  ['early option validation',"  if(trajectorySlots!==12&&trajectorySlots!==48)throw new RangeError('trajectorySlots must be12 or48');\n  if(kernelModel!=='point'", "  if(kernelModel!=='point'"],
  ['recipe forwarding','entry=makeEntry(d,serial++,areas,centralFraction,kernelModel,trajectorySlots);','entry=makeEntry(d,serial++,areas,centralFraction,kernelModel);'],
  ['configured count metadata','trajectorySlots,releaseAges:[.35,.65]','trajectorySlots:12,releaseAges:[.35,.65]'],
  ['explicit selected-root cap limit',"trajectorySlots===12?'3centre+12root+9launch=24 aerial kernels; fan retains81 and bouquet9':'3centre+48root+9launch=60 aerial kernels when roots>=48; fewer roots cap selected count; fan retains81 and bouquet9'","'3centre+12root+9launch=24 aerial kernels; fan retains81 and bouquet9'"]
].map(e=>Object.freeze(e)));
export const trajectorySamplesHostEdits=Object.freeze([
  ['host option',"kernelModel='point',centralFraction=.20,trajectorySlots=12}={}){","kernelModel='point',centralFraction=.20}={}){"],
  ['host early validation',"  if(trajectorySlots!==12&&trajectorySlots!==48)throw new RangeError('trajectorySlots must be12 or48');\n  if(sourceModel!=='legacy9'","  if(sourceModel!=='legacy9'"],
  ['legacy opt-in refusal',"sourceModel==='legacy9'&&(kernelModel!=='point'||centralFraction!==.20||trajectorySlots!==12)","sourceModel==='legacy9'&&(kernelModel!=='point'||centralFraction!==.20)"],
  ['adapter forwarding','queueCapacity:8192,kernelModel,centralFraction,trajectorySlots,transport:SMOKE_SOURCE_TRANSPORT','queueCapacity:8192,kernelModel,centralFraction,transport:SMOKE_SOURCE_TRANSPORT']
].map(e=>Object.freeze(e)));
function inverse(source,edits,scope){if(typeof source!=='string')throw new TypeError('Source text required');let result=source;for(const [label,from,to]of edits){const count=result.split(from).length-1;if(count!==1)throw new Error(scope+' scope drift: '+label+' count '+count);result=result.replace(from,to);}return result;}
export const normalizeTrajectorySamplesAdapterSource=source=>inverse(source.includes("dispersionModel='brownian'")?normalizeTaylorAdapterSource(source):source,trajectorySamplesAdapterEdits,'samples adapter');
export const normalizeTrajectorySamplesHostSource=source=>inverse(source.includes("dispersionModel='brownian'")?normalizeTaylorHostSource(source):source,trajectorySamplesHostEdits,'samples host');
