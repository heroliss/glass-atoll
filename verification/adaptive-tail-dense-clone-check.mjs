// QA source/preflight proof only. No browser, timer query or performance run.
import {readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {runAdaptiveTailDenseScenePerformance} from './adaptive-tail-dense-scene-performance.js';
const hash=v=>createHash('sha256').update(v).digest('hex');
const oldURL=new URL('./adaptive-tail-scene-performance.js',import.meta.url),newURL=new URL('./adaptive-tail-dense-scene-performance.js',import.meta.url);
const original=await readFile(oldURL),candidate=await readFile(newURL);
const oldText=original.toString(),newText=candidate.toString(),checks=[];
const check=(name,passed,evidence={})=>checks.push({name,passed:!!passed,...evidence});
const edits=[
 ['Owner supplies the already-paused singlepalm seed42 nearview, exact burstTime,','Owner supplies two paused chrysanthemum events of192heads each, exact burstTime,'],
 ['export async function runAdaptiveTailScenePerformance(','export async function runAdaptiveTailDenseScenePerformance('],
 ['An adaptive-tail sceneobserver already owns this context','An adaptive-tail dense sceneobserver already owns this context'],
 ["if(fw.active!==1||fw.queued!==0||fw.activeEvents?.length!==1||fw.activeEvents[0].type!=='palm'||fw.settings?.autoLaunch)fail('Prepare exactlyone activepalm, no queue or autolaunch');","if(fw.active!==2||fw.queued!==0||fw.activeEvents?.length!==2||fw.activeEvents.some(event=>event.type!=='chrysanthemum'||event.actualStarCount!==192)||fw.settings?.autoLaunch)fail('Prepare exactlytwo activechrysanthemum events with192heads each, no queue or autolaunch');"],
 ['glass-atoll.adaptive-tail-dynamic-scene-interleaved-performance.v1','glass-atoll.adaptive-tail-dense-scene-interleaved-performance.v1'],
 ['Owner-declared; currentactiveEvents has no seed field','Both seeds owner-declared (42/43 fixture); currentactiveEvents has no seed field; declaredSeed42 labels the pair'],
 ['One actual8second evolvingpalm with alternatingframe modes;','Two actual evolvingchrysanthemum events over8seconds with alternatingframe modes;'],
];
check('frozen original source is unchanged',hash(original)==='b8cd721c87e11555372a946ef577999bc8aa03db4f00601cf91e9819172dee0a');
let expected=oldText,reverse=newText,unique=true;
for(const [before,after]of edits){unique&&=expected.split(before).length===2&&reverse.split(after).length===2;expected=expected.replace(before,after);reverse=reverse.replace(after,before);}
check('only seven explicit preflight and naming hunks differ',unique&&Buffer.from(expected).equals(candidate),{authorizedHunks:edits.length});
check('narrow inverse restores the entire original bytes',Buffer.from(reverse).equals(original),{inverseSHA256:hash(Buffer.from(reverse))});
const core=' const start=performance.now(),labels=new WeakMap(),pending=new Set(),rows=new Map();';
const oldCore=oldText.slice(oldText.indexOf(core)),newCore=newText.slice(newText.indexOf(core));
check('all observation timing labels statistics cleanup core bytes identical',oldText.includes(core)&&newText.includes(core)&&oldCore===newCore,{coreSHA256:hash(Buffer.from(newCore)),bytes:Buffer.byteLength(newCore)});
const threshold="if(seconds!==8||!Number.isFinite(burstTime)||declaredSeed!==42||!Number.isFinite(drainMs)||drainMs<0||drainMs>2000||minSamplesPerMode!==30)";
check('eight second minimum30 per mode drain and owner label thresholds unchanged',oldText.includes(threshold)&&newText.includes(threshold)&&newText.includes('drainMs=2000,minSamplesPerMode=30'));
const predicate=edits[3][1].slice(3,edits[3][1].indexOf(")fail("));
const accepts=Function('fw',`return !(${predicate});`),valid={active:2,queued:0,activeEvents:[{type:'chrysanthemum',actualStarCount:192},{type:'chrysanthemum',actualStarCount:192}],settings:{autoLaunch:false}};
const cases=[
 ['exact pair',valid,true],['single',{...valid,active:1,activeEvents:valid.activeEvents.slice(0,1)},false],
 ['wrong count',{...valid,activeEvents:[valid.activeEvents[0],{type:'chrysanthemum',actualStarCount:191}]},false],
 ['mixed type',{...valid,activeEvents:[valid.activeEvents[0],{type:'palm',actualStarCount:192}]},false],
 ['queue',{...valid,queued:1},false],['autolaunch',{...valid,settings:{autoLaunch:true}},false],
 ['active mismatch',{...valid,active:1},false],['extra event',{...valid,activeEvents:[...valid.activeEvents,valid.activeEvents[0]]},false],
];
check('actual preflight accepts only exact two chrysanthemum192 pair',cases.every(([,fw,want])=>accepts(fw)===want),{cases:cases.map(([name,fw,want])=>({name,expected:want,actual:accepts(fw)}))});
check('new module exports the real dense entry point',typeof runAdaptiveTailDenseScenePerformance==='function');
const report={schema:'glass-atoll.adaptive-tail-dense-narrow-clone-check.v1',dateUTC:new Date().toISOString(),actualGPU:false,actualScene:false,originalSHA256:hash(original),candidateSHA256:hash(candidate),checks,limits:['Source and actual predicate proof only; not a browser, performance or visual pass.','Only seven authorized hunks; core observer/thresholds equal original. Complete runtime protocol evidence remains the original fake-mainloop7/7.','Both physical seeds are owner-declared because production activeEvents does not expose seeds.']};
report.counts={passed:checks.filter(x=>x.passed).length,total:checks.length};report.passed=checks.every(x=>x.passed);
await writeFile(new URL('./adaptive-tail-dense-clone-check.json',import.meta.url),JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({passed:report.passed,counts:report.counts,originalSHA256:report.originalSHA256,candidateSHA256:report.candidateSHA256,failed:checks.filter(x=>!x.passed)},null,2));
process.exitCode=report.passed?0:1;
