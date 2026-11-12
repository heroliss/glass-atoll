import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import zlib from 'node:zlib';
import assert from 'node:assert/strict';
const dir=path.resolve('verification'),input=process.argv[2]??'r31-native-scene-actual-gpu.json',output=process.argv[3]??'r31-fresh-scene-native.png';
for(const n of [input,output])assert(n===path.basename(n),'Named verification artifacts only');
const bytes=fs.readFileSync(path.join(dir,input)),report=JSON.parse(bytes),image=report.image;
assert(report.passed&&report.actualGPU&&image,'Passing actual complete scene capture required');
assert.equal(image.width,1209);assert.equal(image.height,1292);assert.equal(image.rowOrder,'bottom-up');assert.equal(image.readType,'UNSIGNED_BYTE');
const raw=Buffer.from(image.rgbaBase64,'base64'),width=image.width,height=image.height,stride=width*4;
assert.equal(raw.length,6248112);assert.equal(raw.length,image.bytes);
const rows=Buffer.alloc(height*(1+stride));let min=255,max=0,sum=0,nonblack=0,opaque=0;
for(let y=0;y<height;y++){
 const from=(height-1-y)*stride,to=y*(1+stride)+1;raw.copy(rows,to,from,from+stride);
 for(let x=0;x<width;x++){const p=from+x*4;opaque+=Number(raw[p+3]===255);for(let c=0;c<3;c++){const v=raw[p+c];min=Math.min(min,v);max=Math.max(max,v);sum+=v;nonblack+=Number(v>0);}}
}
const table=Array.from({length:256},(_,i)=>{let n=i;for(let k=0;k<8;k++)n=n&1?0xedb88320^(n>>>1):n>>>1;return n>>>0;});
function crc32(b){let n=0xffffffff;for(const v of b)n=table[(n^v)&255]^(n>>>8);return(n^0xffffffff)>>>0;}
function chunk(name,data){const type=Buffer.from(name),length=Buffer.alloc(4),crc=Buffer.alloc(4);length.writeUInt32BE(data.length);crc.writeUInt32BE(crc32(Buffer.concat([type,data])));return Buffer.concat([length,type,data,crc]);}
const header=Buffer.alloc(13);header.writeUInt32BE(width);header.writeUInt32BE(height,4);header[8]=8;header[9]=6;
const png=Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]),chunk('IHDR',header),chunk('sRGB',Buffer.from([0])),chunk('IDAT',zlib.deflateSync(rows,{level:9})),chunk('IEND',Buffer.alloc(0))]);
// Independently decode the compressed PNG rows and compare every stored byte
// with the original framebuffer row, not a recoloured/re-rendered substitute.
let offset=8,payload=[];while(offset<png.length){const n=png.readUInt32BE(offset),name=png.subarray(offset+4,offset+8).toString();if(name==='IDAT')payload.push(png.subarray(offset+8,offset+8+n));offset+=12+n;}
const decoded=zlib.inflateSync(Buffer.concat(payload));assert.deepEqual(decoded,rows);
for(let y=0;y<height;y++){assert.equal(decoded[y*(stride+1)],0);assert.deepEqual(decoded.subarray(y*(stride+1)+1,(y+1)*(stride+1)),raw.subarray((height-1-y)*stride,(height-y)*stride));}
fs.writeFileSync(path.join(dir,output),png);
const sha=b=>crypto.createHash('sha256').update(b).digest('hex'),metadata={schema:'glass-atoll.r31-exact-native-sdr-png.v1',passed:true,actualGPU:true,input,inputSHA256:sha(bytes),rawCaptureSHA256:sha(raw),output,outputSHA256:sha(png),width,height,readType:image.readType,rawBytes:raw.length,decodedAllRowsByteExact:true,statistics:{units:'encoded sRGB normalized0..1',minimumRGB:min/255,maximumRGB:max/255,meanRGB:sum/(width*height*3*255),nonblackChannels:nonblack,opaquePixels:opaque},operation:'Losslessly encode the actual owned RGBA8 SDR capture, only flipping bottom-up rows; no resize, relighting, gamma change or enhancement',captureScope:'The reviewed GPU FLOAT-to-UNORM blit already clamps/quantizes composed SDR. This PNG preserves those8bit values, not scene-linear HDR radiance or Float32 identity.'};
fs.writeFileSync(path.join(dir,output.replace(/\.png$/i,'')+'-encoding.json'),JSON.stringify(metadata,null,2)+'\n');console.log(JSON.stringify(metadata,null,2));
