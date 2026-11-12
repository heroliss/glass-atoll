import assert from 'node:assert/strict';
export const originalCapacitySelection="      const selected=[...pool.filter(c=>c.sameSource).sort((a,b)=>a.score-b.score||a.i-b.i||a.j-b.j).slice(0,8),...pool.filter(c=>!c.sameSource).sort((a,b)=>a.score-b.score||a.i-b.i||a.j-b.j).slice(0,8)];";
export const boundedCapacitySelection=`      // Keep the same stable top8 order without sorting the entire pair pool.
      const compareCandidate=(a,b)=>a.score-b.score||a.i-b.i||a.j-b.j,same=[],other=[];
      for(const c of pool){const list=c.sameSource?same:other;let lo=0,hi=list.length;while(lo<hi){const mid=(lo+hi)>>>1;if(compareCandidate(list[mid],c)<=0)lo=mid+1;else hi=mid;}if(lo<8){list.splice(lo,0,c);if(list.length>8)list.pop();}}
      const selected=[...same,...other];`;
export function normalizeCapacityTop8(source){assert.equal(source.split(boundedCapacitySelection).length,2,'single bounded selection required');assert(!source.includes(originalCapacitySelection),'old selection must not coexist');return source.replace(boundedCapacitySelection,originalCapacitySelection);}
