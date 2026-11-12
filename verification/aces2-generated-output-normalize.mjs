// Exact inverse of the approved generated-target extension; no broad source stripping.
import fs from 'node:fs';
import crypto from 'node:crypto';
const hash=x=>crypto.createHash('sha256').update(x).digest('hex');
export function normalizeACES2GeneratedOutput(source){
  const edits=JSON.parse(fs.readFileSync(new URL('./aces2-generated-output-source-edits.json',import.meta.url)));
  if(hash(source)!==edits.candidateSHA256)throw Error('Generated-target candidate source seal changed');
  for(const edit of edits.edits.slice().reverse()){
    if(source.split(edit.to).length-1!==1)throw Error('Altered/nonunique generated-target inverse '+edit.name);
    source=source.replace(edit.to,edit.from);
  }
  if(hash(source)!==edits.baselineSHA256||edits.baselineSHA256!=='8888e2dc0d48ba507b876075391dc58f7f8b260b7bb512f07a0afd7e3ec36cd2')throw Error('Generated-target inverse does not restore frozen888');
  return source;
}
