// Source-only R9 domain-fixture audit. No wrapper/facade or GPU execution.
import {readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
const sha=b=>createHash('sha256').update(b).digest('hex');
const originalURL=new URL('./aces2-output-gpu-check.js',import.meta.url),cloneURL=new URL('./r9-aces2-pinned-output-gpu-check.js',import.meta.url),original=await readFile(originalURL),clone=await readFile(cloneURL);
const oldLines=original.toString('utf8').split('\n'),newLines=clone.toString('utf8').split('\n'),expected=[135,136],changed=[];
for(let i=0;i<Math.max(oldLines.length,newLines.length);i++)if(oldLines[i]!==newLines[i])changed.push(i);
const onlyDomain=changed.length===2&&changed.every((i,k)=>i===expected[k])&&changed.every(i=>newLines[i]===oldLines[i].replaceAll('1200','99'));
const strip=lines=>Buffer.from(lines.filter((_,i)=>!expected.includes(i)).join('\n'));
const strippedOriginal=strip(oldLines),strippedClone=strip(newLines),inverse=[...newLines];for(const i of expected)inverse[i]=oldLines[i];
const report={schema:'glass-atoll.r9-pinned-helper-domain-fixture-source-check.v1',dateUTC:new Date().toISOString(),actualGPU:false,originalSHA256:sha(original),cloneSHA256:sha(clone),changedLines:changed.map(i=>i+1),checks:[
 {name:'frozen old helper878a remains byteexact',passed:sha(original)==='878a426c79d9cf14ef6c71cc7f8beefd622f03e53a54d3ab021a306accb7e84b'},
 {name:'only two authorized domain lines replace1200 with99 and updated names',passed:onlyDomain},
 {name:'strip only those two wholelines yields byteexact other source',passed:strippedOriginal.equals(strippedClone),strippedSHA256:sha(strippedClone)},
 {name:'inverse only domainlines restores complete original bytes',passed:Buffer.from(inverse.join('\n')).equals(original)},
 {name:'real exported factory entry unchanged; no facade/substitute rejection',passed:original.toString('utf8').includes('export async function runACES2OutputGPUCheck(THREE,renderer,{createOutput}={})')&&clone.toString('utf8').includes('export async function runACES2OutputGPUCheck(THREE,renderer,{createOutput}={})')&&onlyDomain}
 ],limits:['Source equality proves other135 assertion code is unmodified; actual execution still needs a new137 GPU run.','Original first135/137 with now-obsolete1200unsupported gates remains preserved.','Invoke the clone real factory; never facade a false1200 result.']};
report.counts={passed:report.checks.filter(c=>c.passed).length,total:report.checks.length};report.passed=report.checks.every(c=>c.passed);await writeFile(new URL('./r9-aces2-pinned-clone-check.json',import.meta.url),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report,null,2));process.exitCode=report.passed?0:1;
