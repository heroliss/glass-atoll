// Reproducible source transaction. This script is QA tooling, not imported by runtime.
import fs from 'node:fs';
import crypto from 'node:crypto';
const path=new URL('../aces2-output.js',import.meta.url),baseline=new URL('./baselines/aces2-output-before-generated-peaks/aces2-output.js',import.meta.url);
const hash=x=>crypto.createHash('sha256').update(x).digest('hex'),old=fs.readFileSync(baseline,'utf8'),edits=[];
if(hash(old)!=='8888e2dc0d48ba507b876075391dc58f7f8b260b7bb512f07a0afd7e3ec36cd2')throw Error('Frozen888 baseline required');
let source=old;
const change=(name,from,to)=>{to=to.replace(/\r?\n/g,'\r\n');if(source.split(from).length-1!==1)throw Error('Nonunique edit '+name);source=source.replace(from,to);edits.push({name,from,to});};
change('supported-integer-range',"export const ACES2_OUTPUT_TARGETS=Object.freeze([100,700,1270]);",`export const ACES2_OUTPUT_TARGETS=Object.freeze([100,700,1270]);
export const ACES2_OUTPUT_PEAK_RANGE=Object.freeze({min:100,max:10000,integerOnly:true});
const GENERATED_CACHE_LIMIT=12,GENERATED_MAX_FILE=8*1024*1024,GENERATED_MAX_PACKAGE=16*1024*1024;
const GENERATED_PINS=Object.freeze({exporter:'4f4d6331e0bd280558259bbdce15d27bc3c9bbf3f5f97dd96d86cca5c9de75ea',core:'f0fcdd7629964d612b4805604bbbd9559b0fcf04129a104040ffccb7cf230a2c',input:'fa82b382df34da9b22805bb823c446dd56f6f9e4cd06d02b77d6286ad3184474',atan:'565860bc7bbb5a1f9b4cce3e53609a311fe260e14dd2968ef28533dfbfa30d19',prefix:'49dd358bfdf956aa14aa14dcff89775c4e662e4024bcbe7e71bb5df178c40552',fixtureInput:'9aa238a027e45d80d6e9d6f246bc24c07fa0780a871a90da904876e7a0e7d158',license:'8850b0c83cd41d26ad0e080861d47ee00afb685386a459a1cbe8c347555621a7'});
const inPeakRange=peak=>peak>=ACES2_OUTPUT_PEAK_RANGE.min&&peak<=ACES2_OUTPUT_PEAK_RANGE.max;`);
change('generic-exact-function-name',"requireThat(typeof source==='string'&&/^aces2Display(100|700|1270)$/.test(functionName),'invalid colour source/function');",`const match=typeof functionName==='string'?/^aces2Display([1-9][0-9]*)$/.exec(functionName):null;
  requireThat(typeof source==='string'&&match&&inPeakRange(Number(match[1])),'invalid colour source/function');`);
const helpers=fs.readFileSync(new URL('./aces2-generated-output-runtime-fragment.txt',import.meta.url),'utf8');
change('generated-package-validation',"function compileAndValidate(g,entry,source,tables,anchor){",helpers+"\nfunction compileAndValidate(g,entry,source,tables,anchor){");
change('validation-texture-geometry',"const input=new Float32Array(anchor.rows.length*4);anchor.rows.forEach((row,i)=>input.set([...row.inputFloat32,1],i*4));const inputTexture=uploadTexture(g,0,anchor.rows.length,1,input);temporary.push(['texture',inputTexture]);const colour=uploadTexture(g,0,anchor.rows.length,1,null);",`const validationWidth=anchor.width??anchor.rows.length,validationHeight=anchor.height??1;
    const input=new Float32Array(anchor.rows.length*4);anchor.rows.forEach((row,i)=>input.set([...row.inputFloat32,1],i*4));const inputTexture=uploadTexture(g,0,validationWidth,validationHeight,input);temporary.push(['texture',inputTexture]);const colour=uploadTexture(g,0,validationWidth,validationHeight,null);`);
change('validation-draw-read-layout',"beginDraw(g,r,inputTexture,framebuffer,[0,0,anchor.rows.length,1],1,1,false);g.drawArrays(g.TRIANGLES,0,3);const output=new Float32Array(input.length);g.readPixels(0,0,anchor.rows.length,1,g.RGBA,g.FLOAT,output);",`beginDraw(g,r,inputTexture,framebuffer,[0,0,validationWidth,validationHeight],1,1,false);g.drawArrays(g.TRIANGLES,0,3);const output=new Float32Array(input.length);g.readPixels(0,0,validationWidth,validationHeight,g.RGBA,g.FLOAT,output);
    if(anchor.generated){r.validation=Object.freeze({...validateACES2GeneratedReadback(output,anchor,entry.peakNits),actualGPU:true,logs:Object.freeze(logs.map(l=>Object.freeze({...l})))});const errors=errorList(g);requireThat(errors.length===0,'prepare produced GL errors: '+errors.join(','));completed=true;return r;}`);
const factory=fs.readFileSync(new URL('./aces2-generated-output-factory-fragment.txt',import.meta.url),'utf8');
change('generated-loader',"  function prepareTarget({peakNits}={}){",factory+"\n  function prepareTarget({peakNits}={}){");
change('dynamic-supported-range',"const request=++epoch,supported=ACES2_OUTPUT_TARGETS.includes(peak);", "const request=++epoch,supported=inPeakRange(peak);");
change('dynamic-cache-preflight',"    status.pending=true;",`    if(!ACES2_OUTPUT_TARGETS.includes(peak)&&Array.from(cache.values()).filter(r=>r.generated).length>=GENERATED_CACHE_LIMIT){status.reason='cache-full';return Promise.resolve({ready:false,supported:true,reason:'cache-full',peakNits:peak,generation:request});}
    status.pending=true;`);
change('generated-prepare-branch',"        const m=await manifest(),entry=m.targets.find(e=>e.peakNits===peak);",`        if(!ACES2_OUTPUT_TARGETS.includes(peak)){
          const loaded=await loadGenerated(peak,request);
          if(disposed||request!==epoch)return{ready:false,supported:true,stale:true,reason:disposed?'disposed':'stale-request',peakNits:peak,generation:request};
          status={...status,reason:'gpu-admission'};
          resource=compileAndValidate(context(),loaded.entry,loaded.source,loaded.tables,loaded.anchors);resource.peakNits=peak;resource.preparedEpoch=request;resource.generated=true;resource.assetHashes=loaded.assetHashes;
          if(disposed||request!==epoch){safeDestroy(resource);resource=null;return{ready:false,supported:true,stale:true,reason:disposed?'disposed':'stale-request',peakNits:peak,generation:request};}
          cache.set(peak,resource);status={...status,pending:false,effectivePeakNits:peak,reason:'ready',lastError:null};return{ready:true,supported:true,reason:'ready',peakNits:peak,generation:request,cached:false,generated:true,validation:resource.validation,assetHashes:{...resource.assetHashes}};
        }
        const m=await manifest(),entry=m.targets.find(e=>e.peakNits===peak);`);
change('specific-failure-reason',"const message=recordError(error,request);status={...status,pending:false,effectivePeakNits:null,reason:'validation-failed',lastError:message};return{ready:false,supported:true,reason:'validation-failed',peakNits:peak,generation:request,error:message};",`const message=recordError(error,request),reason=error.aces2Reason||'validation-failed';status={...status,pending:false,effectivePeakNits:null,reason,lastError:message};return{ready:false,supported:true,reason,peakNits:peak,generation:request,error:message,...(error.validation?{validation:error.validation}:{})};`);
change('ready-exact-generated-render',"requireThat(ACES2_OUTPUT_TARGETS.includes(peak)&&resource,'requested output target is not ready');","requireThat(inPeakRange(peak)&&resource,'requested output target is not ready');");
change('generated-diagnostics',"supportedTargets:[...ACES2_OUTPUT_TARGETS],...status,disposed,readyTargets:Array.from(cache.keys()),",`supportedTargets:[...ACES2_OUTPUT_TARGETS],supportedPeakRange:{...ACES2_OUTPUT_PEAK_RANGE},generatedCacheLimit:GENERATED_CACHE_LIMIT,generatedReadyTargets:Array.from(cache.values()).filter(r=>r.generated).map(r=>r.peakNits),...status,disposed,readyTargets:Array.from(cache.keys()),`);
fs.writeFileSync(path,source);
fs.writeFileSync(new URL('./aces2-generated-output-source-edits.json',import.meta.url),JSON.stringify({schema:'glass-atoll.aces2-generated-output-exact-edits.v1',baselineSHA256:hash(old),candidateSHA256:hash(source),edits},null,2)+'\n');
console.log(JSON.stringify({edits:edits.length,sourceSHA256:hash(source)}));
