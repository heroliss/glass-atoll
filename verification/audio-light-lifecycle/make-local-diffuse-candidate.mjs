import fs from 'node:fs';
const root=new URL('../../',import.meta.url),original=fs.readFileSync(new URL('local-lights.js',root),'utf8');
const native='for(let i=4;i<LOCAL_LIGHT_COUNT;i++){const light=new THREE.PointLight(\'#fff\',0,FIREWORK_LIGHT_RANGE,2);light.layers.enable(1);scene.add(light);';
if(!original.includes(native))throw Error('Native proxy seam changed');
let candidate=original.replace(native,`for(let i=4;i<LOCAL_LIGHT_COUNT;i++){const light=new THREE.PointLight('#fff',0,FIREWORK_LIGHT_RANGE,2);light.layers.enable(1);light.visible=false;/* Shader-only diffuse proxy: retain a compatibility light mirror without registering it with the scene. */`);
const vertex=".replace('#include <worldpos_vertex>','#include <worldpos_vertex>\\nvLocalWorld=(modelMatrix*vec4(transformed,1.)).xyz;')";
if(!candidate.includes(vertex))throw Error('World-position seam changed');
candidate=candidate.replace(vertex,`.replace('#include <worldpos_vertex>',\`#include <worldpos_vertex>
        vec4 localWorld=vec4(transformed,1.);
        #ifdef USE_BATCHING
          localWorld=batchingMatrix*localWorld;
        #endif
        #ifdef USE_INSTANCING
          localWorld=instanceMatrix*localWorld;
        #endif
        vLocalWorld=(modelMatrix*localWorld).xyz;\`)`);
const applySeam="if(thin)shader.fragmentShader=shader.fragmentShader.replace('#include <opaque_fragment>',";
if(!candidate.includes(applySeam))throw Error('Opaque insertion seam changed');
const diffuse=`shader.fragmentShader=shader.fragmentShader.replace('#include <opaque_fragment>',\`
      // Firework receiver records are diffuse-only; ground lamps and torch
      // remain native PBR lights, including their specular response.
      vec3 fireworkDiffuseNormal=inverseTransformDirection(normal,viewMatrix);
      vec3 fireworkDiffuseIncident=vec3(0.);
      for(int fireworkId=4;fireworkId<\${LOCAL_LIGHT_COUNT};fireworkId++){
        if(max(max(uLocalColour[fireworkId].r,uLocalColour[fireworkId].g),uLocalColour[fireworkId].b)<1e-12)continue;
        vec3 fireworkL;
        vec3 fireworkE=localIncident(vLocalWorld,fireworkId,fireworkL);
        fireworkDiffuseIncident+=fireworkE*max(0.,dot(fireworkDiffuseNormal,fireworkL));
      }
      outgoingLight+=fireworkDiffuseIncident*diffuseColor.rgb*(1.-metalnessFactor)*RECIPROCAL_PI;
      #include <opaque_fragment>\`);`;
candidate=candidate.replace(applySeam,diffuse+applySeam).replace("'-local-receiver-response-v1'","'-local-receiver-diffuse-only-v2'");
candidate=candidate.replace("'burst lighting uses up to '+FIREWORK_RECEIVER_LIGHT_COUNT+' conservative receiver-selected punctual proxies'", "'fireworks use up to '+FIREWORK_RECEIVER_LIGHT_COUNT+' source-I/RGB conserving diffuse-only shader proxies; no native firework specular'");
candidate=candidate.replace("id:i,type:r.light.isSpotLight?'spot':'point',", "id:i,type:r.light.isSpotLight?'spot':'point',receiverPath:i<4?'native-PBR':'diffuse-shader',nativeSceneLight:i<4,");
fs.writeFileSync(new URL('local-lights-diffuse-candidate.js',import.meta.url),candidate);
console.log('Written route-only /local-lights.js candidate. Production not modified.');
