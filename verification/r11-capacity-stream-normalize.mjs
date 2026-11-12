import assert from 'node:assert/strict';
import {boundedCapacitySelection} from './r11-capacity-top8-normalize.mjs';
export const streamEdits=Object.freeze([
 ['      const pool=[],seen=new Set();','      const seen=new Set(),same=[],other=[],scratch={i:0,j:0,sameSource:false,score:0},compareCandidate=(a,b)=>a.score-b.score||a.i-b.i||a.j-b.j;'],
 ["      function candidate(i,j,sameSource){if(i>j)[i,j]=[j,i];const key=i+','+j;if(seen.has(key))return;seen.add(key);const a=packets[i],b=packets[j],distance2=a.mean.reduce((s,v,c)=>s+(v-b.mean[c])**2,0),scale=a.covariance[0]+a.covariance[4]+a.covariance[8]+b.covariance[0]+b.covariance[4]+b.covariance[8],score=distance2/scale;pool.push({i,j,sameSource,score});}","      function candidate(i,j,sameSource){if(i>j)[i,j]=[j,i];const key=i+','+j;if(seen.has(key))return;seen.add(key);const a=packets[i],b=packets[j],distance2=a.mean.reduce((s,v,c)=>s+(v-b.mean[c])**2,0),scale=a.covariance[0]+a.covariance[4]+a.covariance[8]+b.covariance[0]+b.covariance[4]+b.covariance[8],score=distance2/scale;const list=sameSource?same:other;scratch.i=i;scratch.j=j;scratch.sameSource=sameSource;scratch.score=score;let lo=0,hi=list.length;while(lo<hi){const mid=(lo+hi)>>>1;if(compareCandidate(list[mid],scratch)<=0)lo=mid+1;else hi=mid;}if(lo<8){list.splice(lo,0,{i,j,sameSource,score});if(list.length>8)list.pop();}}"],
 [boundedCapacitySelection,'      const selected=[...same,...other];']
]);
export function buildStreamCandidate(source){for(const [before,after]of streamEdits){assert.equal(source.split(before).length,2,'one original stream edit');source=source.replace(before,after);}return source;}
export function normalizeStreamCandidate(source){for(const [before,after]of [...streamEdits].reverse()){assert.equal(source.split(after).length,2,'one candidate stream edit');source=source.replace(after,before);}return source;}

