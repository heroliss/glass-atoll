import fs from 'node:fs';
const input=new URL('local-lights-diffuse-candidate.js',import.meta.url),source=fs.readFileSync(input,'utf8'),begin=source.indexOf("shader.fragmentShader=shader.fragmentShader.replace('#include <opaque_fragment>',`\n      // Firework"),end=source.indexOf('`);if(thin)',begin);
if(begin<0||end<0)throw Error('Diffuse block seam changed');
const block=source.slice(begin,end).replace("replace('#include <opaque_fragment>',`", "replace('#include <lights_fragment_end>',`#include <lights_fragment_end>").replace('outgoingLight+=fireworkDiffuseIncident*diffuseColor.rgb*(1.-metalnessFactor)*RECIPROCAL_PI;', 'reflectedLight.directDiffuse+=fireworkDiffuseIncident*BRDF_Lambert(material.diffuseColor);').replace('      #include <opaque_fragment>','');
const next=(source.slice(0,begin)+block+source.slice(end)).replace('-local-receiver-diffuse-only-v2','-local-receiver-diffuse-only-v3-lights-chunk');
fs.writeFileSync(new URL('local-lights-diffuse-chunk-candidate.js',import.meta.url),next);
console.log('Written alternate lights-fragment-end diffuse candidate.');
