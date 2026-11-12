import {strict as assert} from 'node:assert';
import {readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';

// The public Freesound downloads are HQ MP3 previews, not the original WAVs.
// Keep their exact bytes alongside each independently processed runtime clip.
const license='CC0 1.0';
const licenseURL='https://creativecommons.org/publicdomain/zero/1.0/';
const sources=[
  {id:'firecracker',title:'Firecracker - Single in Ground',author:'iliyabylich04',page:'https://freesound.org/people/iliyabylich04/sounds/651332/',previewURL:'https://cdn.freesound.org/previews/651/651332_14128260-hq.mp3',original:'originals/firecracker-single-hq-preview.mp3',expectedOriginalSHA256:'aee91779c6620dc1acdc82c8ed6446d72f03011c9b61d9a208bb6515668b9151',derived:[{file:'firecracker-iliyabylich04-mono.ogg',rangeSeconds:[0,.38],processing:'mono 48 kHz; highpass 90 Hz; lowpass 14.5 kHz; fade 0.28-0.38 s; Vorbis q6'}]},
  {id:'bang',title:'Loud Firewords Bang Cut Off',author:'qubodup',page:'https://freesound.org/people/qubodup/sounds/840510/',previewURL:'https://cdn.freesound.org/previews/840/840510_71257-hq.mp3',original:'originals/loud-bang-cutoff-hq-preview.mp3',expectedOriginalSHA256:'ea8e52fe1fb54c0b4eda224902df7397afb40d2bf19231306c343f64a7a7cfa3',derived:[{file:'bang-qubodup-mono.ogg',rangeSeconds:[0,1.10],processing:'mono 48 kHz; highpass 75 Hz; lowpass 14.5 kHz; -2 dB; fade 0.99-1.10 s; Vorbis q6'}]},
  {id:'booms',title:'NYE Loud Booms',author:'LOVEBURD',page:'https://freesound.org/people/LOVEBURD/sounds/376662/',previewURL:'https://cdn.freesound.org/previews/376/376662_5735740-hq.mp3',original:'originals/nye-loud-booms-hq-preview.mp3',expectedOriginalSHA256:'a76bc35e03459b0ca20abc01293161e9052d0a406a2293666f013c7c9706533f',derived:[{file:'boom-lovebird-a-mono.ogg',rangeSeconds:[.98,1.52],processing:'mono 48 kHz; highpass 40 Hz; lowpass 11 kHz; -8 dB; fade 0.46-0.54 s; Vorbis q6'},{file:'boom-lovebird-b-mono.ogg',rangeSeconds:[1.53,2.15],processing:'mono 48 kHz; highpass 40 Hz; lowpass 11 kHz; -8 dB; fade 0.52-0.62 s; Vorbis q6'}]},
  {id:'crackle',title:'Fireworks Crackle',author:'16FThumaF',page:'https://freesound.org/people/16FThumaF/sounds/505264/',previewURL:'https://cdn.freesound.org/previews/505/505264_10791958-hq.mp3',original:'originals/fireworks-crackle-hq-preview.mp3',expectedOriginalSHA256:'766b8c07556014415f8e34165bd90c1955e68ba0d2618d65b668b32e67a6aae0',derived:[{file:'crackle-16fthumaf-mono.ogg',rangeSeconds:[38,41.25],processing:'mono 48 kHz; highpass 650 Hz; lowpass 13 kHz; +2 dB; fade 3.05-3.25 s; Vorbis q6'}]},
];
const base=new URL('../../assets/audio/fireworks/',import.meta.url);
async function details(path){const bytes=await readFile(new URL(path,base));return{file:path,bytes:bytes.length,sha256:createHash('sha256').update(bytes).digest('hex')};}
const result=[];
for(const source of sources){
  const original=await details(source.original);
  assert.equal(original.sha256,source.expectedOriginalSHA256,'Source preview changed: '+source.id);
  const derived=[];
  for(const item of source.derived)derived.push({...item,...await details(item.file)});
  const {expectedOriginalSHA256,...publicInfo}=source;
  result.push({...publicInfo,license,licenseURL,downloadedKind:'public compressed HQ MP3 preview, NOT original WAV',original,derived});
}
const manifest={verifiedDate:'2026-10-31',sourceLicenseEvidence:'Freesound source pages display Creative Commons 0; source URLs and byte hashes retained',subjectiveListening:'not performed; waveform/English ASR checks do not prove absence of speech or music',sources:result};
const manifestURL=new URL('palette-source.json',base),writing=process.argv.includes('--write');
if(writing)await writeFile(manifestURL,JSON.stringify(manifest,null,2)+'\n');
else{
  const stored=JSON.parse(await readFile(manifestURL));
  assert.equal(stored.sources.length,result.length);
  for(const source of result){
    const expected=stored.sources.find(item=>item.id===source.id);assert.ok(expected);
    assert.equal(source.original.sha256,expected.original.sha256);
    for(const item of source.derived){
      const receipt=expected.derived.find(entry=>entry.file===item.file);assert.ok(receipt);
      assert.equal(item.sha256,receipt.sha256,'Derived clip differs from its retained receipt: '+item.file);
      assert.equal(item.bytes,receipt.bytes);
    }
  }
}
console.log(JSON.stringify({passed:true,mode:writing?'write-receipt':'verify-retained-receipt',sources:result.length,derived:result.reduce((n,x)=>n+x.derived.length,0)},null,2));
