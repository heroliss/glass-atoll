/** Verify the actual thin-lens CPU helper without importing browser-only passes.
 * Run: node verification/lens-math-check.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {fileURLToPath} from 'node:url';
const directory=path.dirname(fileURLToPath(import.meta.url)),project=path.dirname(directory);
const source=fs.readFileSync(path.join(project,'lens.js'),'utf8');
const declaration=source.match(/export function circleOfConfusion\(\{[\s\S]*?\n\}/)?.[0];
if(!declaration)throw new Error('The actual circleOfConfusion function could not be extracted.');
const circleOfConfusion=new Function(declaration.replace(/^export /,'')+'; return circleOfConfusion;')();
const p={focalMm:35,aperture:8,focusMetres:10,sensorHeightMm:24,pixels:1080};
const c=distanceMetres=>circleOfConfusion({...p,distanceMetres});
const infinityLimit=p.focalMm**2/(p.aperture*(p.focusMetres*1000-p.focalMm))/p.sensorHeightMm*p.pixels;
const checks=[];
const close=(id,actual,expected,tolerance=1e-10)=>checks.push({id,actual,expected,tolerance,passed:Number.isFinite(actual)&&Math.abs(actual-expected)<=tolerance});
close('focus_plane_is_sharp',c(10),0);
close('infinite_distance_matches_independent_thin_lens_limit',c(1e10),infinityLimit,1e-8);
close('doubling_f_number_halves_blur',circleOfConfusion({...p,distanceMetres:5,aperture:16}),c(5)/2);
close('doubling_pixel_count_doubles_blur',circleOfConfusion({...p,distanceMetres:5,pixels:2160}),c(5)*2);
close('half_focus_distance_matches_infinite_limit',c(5),infinityLimit);
checks.push({id:'guarded_near_lens_input_is_finite_and_nonnegative',actual:c(.01),passed:Number.isFinite(c(.01))&&c(.01)>=0,notes:'Numerical guard only; the model is not physically accurate inside the lens.'});
const result={generatedAt:new Date().toISOString(),kind:'actual CPU thin-lens helper versus analytic limits',sourceHashes:{'lens.js':crypto.createHash('sha256').update(source).digest('hex'),'verification/lens-math-check.mjs':crypto.createHash('sha256').update(fs.readFileSync(fileURLToPath(import.meta.url))).digest('hex')},passed:checks.every(x=>x.passed),passedCount:checks.filter(x=>x.passed).length,total:checks.length,parameters:p,infinityLimitPixels:infinityLimit,checks,limitations:['Does not validate GPU depth reconstruction, blur visibility, occlusion halos or color output.','No absolute ISO/lux calibration or physical shutter integration is implied.']};
fs.writeFileSync(path.join(directory,'lens-math-check.json'),JSON.stringify(result,null,2)+'\n');
console.log(JSON.stringify({passed:result.passed,passedCount:result.passedCount,total:result.total,failures:checks.filter(x=>!x.passed)},null,2));
if(!result.passed)process.exitCode=1;
