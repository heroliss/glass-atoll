// Exact inverse of the single default-framebuffer draw-buffer cardinality repair.
import crypto from 'node:crypto';
export const ACES2_OUTPUT_BEFORE_DEFAULT_DRAWBUFFERS_SHA256='fa6f4e3336e5f00d1672d20a3ddeb50d7401dcaaded99f7ecbeeea4bf27b53e9';
export const DEFAULT_DRAWBUFFERS_FROM='const count=g.getParameter(g.MAX_DRAW_BUFFERS);for(let i=0;i<count;i++)drawBuffers.push(g.getParameter(g.DRAW_BUFFER0+i));';
export const DEFAULT_DRAWBUFFERS_TO='const count=framebuffer===null?1:g.getParameter(g.MAX_DRAW_BUFFERS);for(let i=0;i<count;i++)drawBuffers.push(g.getParameter(g.DRAW_BUFFER0+i));';
const sha=s=>crypto.createHash('sha256').update(s).digest('hex');
export function applyDefaultDrawBuffersFix(source){if(sha(source)!==ACES2_OUTPUT_BEFORE_DEFAULT_DRAWBUFFERS_SHA256||source.split(DEFAULT_DRAWBUFFERS_FROM).length-1!==1)throw Error('Exact frozen fa6 ACES2 module required');return source.replace(DEFAULT_DRAWBUFFERS_FROM,DEFAULT_DRAWBUFFERS_TO);}
export function normalizeDefaultDrawBuffersFix(source){if(source.split(DEFAULT_DRAWBUFFERS_TO).length-1!==1)throw Error('Altered or nonunique default drawBuffers repair');const original=source.replace(DEFAULT_DRAWBUFFERS_TO,DEFAULT_DRAWBUFFERS_FROM);if(sha(original)!==ACES2_OUTPUT_BEFORE_DEFAULT_DRAWBUFFERS_SHA256)throw Error('Unexpected ACES2 module difference outside default drawBuffers repair');return original;}
