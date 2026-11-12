// QA only: seven exact cache/diagnostic edits restore the first accepted field.
const zeroBlock=`      // All texels, including padding, were written zero by a completed bake.
      // Empty source generations and changing cold density cannot change that
      // field; publish current layout/state metadata without another GPU pass.
      if(ledger.count===0&&zeroTargetValid&&target&&Math.max(1,packedPackets.count)<=target.width*target.height){zeroReuses++;bakedSnapshot=snapshot;bakedSnapshotRevision=snapshot.revision;lastBound=bound;lastKey=key;effective=true;return cachedResult=lastStatus={requestedEnabled:true,enabled:true,effective:true,supported:true,reason:'ready',requiredPairs:0,maxBakePairs,version,reused:true,zeroFieldReused:true,ledgerVersion:ledger.version,packetVersion:packedPackets.version,rawBound:0};}
`;
export const zeroFieldCacheEdits=Object.freeze([
  ['private zero-cache state','cachedResult=null,zeroTargetValid=false,zeroReuses=0,version=0','cachedResult=null,version=0'],
  ['disable invalidates initialization','if(!requestedEnabled){effective=false;zeroTargetValid=false;return','if(!requestedEnabled){effective=false;return'],
  ['reenable zero must initialize',"lastKey[k])&&(ledger.count!==0||zeroTargetValid)){",'lastKey[k])){'],
  ['known complete zero reuse',zeroBlock,''],
  ['invalidate before a new GPU write','sSize=layout(ledger.count*2,maxSize);zeroTargetValid=false;ensureResources();','sSize=layout(ledger.count*2,maxSize);ensureResources();'],
  ['successful zero publication','bakes++;version++;zeroTargetValid=ledger.count===0;bakedSnapshot=','bakes++;version++;bakedSnapshot='],
  ['zero cache counters','return{...lastStatus,bakes,zeroReuses,zeroTargetValid,allocated:','return{...lastStatus,bakes,allocated:']
].map(e=>Object.freeze(e)));
export function normalizeZeroFieldCacheSource(source){let result=source;for(const [label,from,to]of zeroFieldCacheEdits){if(result.split(from).length!==2)throw new Error('Zero-cache scope drift: '+label);result=result.replace(from,to);}return result;}
