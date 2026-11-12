import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import zlib from 'node:zlib';
import assert from 'node:assert/strict';
const dir=path.resolve('verification'),input=process.argv[2]??'r30-fresh-scene-actual-gpu.json',output=process.argv[3]??'r30-fresh-scene-small.png';
for(const n of [input,output])assert(n===path.basename(n),'Use a named verification artifact');
const bytes=fs.readFileSync(path.join(dir,input)),report=JSON.parse(bytes),image=report.image;
assert(report.actualGPU&&image,'Actual composed capture is required');assert.equal(image.width,160);assert.equal(image.height,171);assert.equal(image.rowOrder,'bottom-up');assert(['FLOAT','UNSIGNED_BYTE'].includes(image.readType));
const raw=Buffer.from(image.rgbaBase64,'base64'),sampleBytes=image.readType==='FLOAT'?4:1;
assert.equal(raw.length,image.width*image.height*4*sampleBytes);assert.equal(raw.length,image.bytes);
const rgba=Buffer.alloc(image.width*image.height*4);let clipped=0,minimum=Infinity,maximum=-Infinity;
for(let y=0;y<image.height;y++)for(let x=0;x<image.width;x++)for(let c=0;c<4;c++){
 const source=((image.height-1-y)*image.width+x)*4+c,destination=(y*image.width+x)*4+c;
 const value=image.readType==='FLOAT'?raw.readFloatLE(source*4):raw[source]/255;
 assert(Number.isFinite(value),'Nonfinite composed sample');if(c<3){minimum=Math.min(minimum,value);maximum=Math.max(maximum,value);}
 if(value<0||value>1)clipped++;rgba[destination]=Math.round(Math.min(1,Math.max(0,value))*255);
}
const table=Array.from({length:256},(_,i)=>{let n=i;for(let k=0;k<8;k++)n=n&1?0xedb88320^(n>>>1):n>>>1;return n>>>0;});
function crc32(b){let n=0xffffffff;for(const v of b)n=table[(n^v)&255]^(n>>>8);return(n^0xffffffff)>>>0;}
function chunk(name,data){const type=Buffer.from(name),length=Buffer.alloc(4),crc=Buffer.alloc(4);length.writeUInt32BE(data.length);crc.writeUInt32BE(crc32(Buffer.concat([type,data])));return Buffer.concat([length,type,data,crc]);}
const header=Buffer.alloc(13);header.writeUInt32BE(image.width,0);header.writeUInt32BE(image.height,4);header[8]=8;header[9]=6;
const rows=Buffer.alloc(image.height*(1+image.width*4));for(let y=0;y<image.height;y++)rgba.copy(rows,y*(1+image.width*4)+1,y*image.width*4,(y+1)*image.width*4);
const png=Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]),chunk('IHDR',header),chunk('sRGB',Buffer.from([0])),chunk('IDAT',zlib.deflateSync(rows,{level:9})),chunk('IEND',Buffer.alloc(0))]);
fs.writeFileSync(path.join(dir,output),png);
const sha=b=>crypto.createHash('sha256').update(b).digest('hex'),metadata={schema:'glass-atoll.r30-exact-composed-png.v1',passed:true,actualGPU:true,input,inputSHA256:sha(bytes),rawCaptureSHA256:sha(raw),output,outputSHA256:sha(png),width:image.width,height:image.height,readType:image.readType,rawBytes:raw.length,clippedSamples:clipped,minimumRGB:minimum,maximumRGB:maximum,operation:'Decode raw framebuffer bytes, vertically flip bottom-up rows, quantize existing SDR encoded-sRGB values to8bit; no relighting/enhancement/gamma/resize',sourceScope:'A floating framebuffer may contain already-tone-mapped SDR. This PNG is not an HDR radiance export or native-resolution visual acceptance.'};
fs.writeFileSync(path.join(dir,output.replace(/\.png$/i,'')+'-encoding.json'),JSON.stringify(metadata,null,2)+'\n');console.log(JSON.stringify(metadata,null,2));
