/* Original real-time atmosphere and world-space volume cloud layer.
 * Single scattering + a bounded diffuse cloud-light approximation, not full
 * spectral/multiple-scattering transport or a fluid weather simulation.
 * https://ebruneton.github.io/precomputed_atmospheric_scattering/
 * https://www.guerrilla-games.com/read/the-real-time-volumetric-cloudscapes-of-horizon-zero-dawn
 * https://sebh.github.io/publications/
 */

const EARTH=6360000,TOP=6460000,HR=8000,HM=1200;
const BR=[5.802e-6,13.558e-6,33.1e-6],BM=3.996e-6,BO=[0.650e-6,1.881e-6,0.085e-6];
const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
const smooth=(a,b,x)=>{const t=clamp((x-a)/(b-a),0,1);return t*t*(3-2*t);};
const mod=(x,n)=>((x%n)+n)%n;
const luminance=c=>c[0]*.2126+c[1]*.7152+c[2]*.0722;
export function solarTransmittance(elevationRadians,height=2){
  const mu=Math.sin(elevationRadians),zenith=clamp(Math.acos(clamp(mu,-1,1))*180/Math.PI,0,95);
  const mass=1/(Math.max(0,mu)+.50572*Math.pow(96.07995-zenith,-1.6364));
  const h=Math.max(0,height),r=HR*Math.exp(-h/HR)*mass,m=HM*Math.exp(-h/HM)*mass;
  const ozone=h<10000?15000:h<25000?15000-(h-10000)*(h-10000)/30000:Math.pow(Math.max(0,40000-h),2)/30000;
  const horizon=-Math.sqrt(2*h/EARTH),visible=smooth(horizon-.00465,horizon+.00465,mu);
  return BR.map((b,i)=>Math.exp(-(b*r+BM*m+BO[i]*ozone*mass))*visible);
}

// This exact density function is also exported for terrain/foliage direct
// sunlight. The background, cube faces and local shadows share its uniforms.
export const cloudShadowGLSL=/* glsl */`
  uniform highp sampler3D uCloudNoise;
  uniform sampler2D uCloudWeather;
  uniform vec2 uCloudOffset,uCloudWeatherOrigin;
  uniform float uCloudTime,uCloudBase,uCloudTop,uCloudCoverage,uCloudExtinction;
  uniform vec3 sunPosition;
  const float cloudEarthRadius=6360000.0;
  float cloudAltitude(vec3 p){return length(vec3(p.x,cloudEarthRadius+p.y,p.z))-cloudEarthRadius;}
  float atmosphereCloudDensity(vec3 p,float time,float lod){
    float altitude=cloudAltitude(p);
    if(altitude<=uCloudBase||altitude>=uCloudTop||uCloudCoverage<=0.0)return 0.0;
    vec2 weatherUV=(p.xz-uCloudOffset)/64000.0+uCloudWeatherOrigin;
    vec4 weather=texture2D(uCloudWeather,weatherUV);
    if(weather.r<0.003)return 0.0;
    // Invert the unsaturated Gaussian to recover a continuous radial distance.
    // Saturating coverage and reusing it as height produced a flat plateau.
    float radius=1.10+uCloudCoverage;
    float radialSquared=-2.0*log(max(weather.r,0.0001))/(radius*radius);
    float h=(altitude-uCloudBase)/((uCloudTop-uCloudBase)*(0.65+0.20*weather.g));
    vec3 uvw=vec3((p.x-uCloudOffset.x)/4200.0,altitude/2200.0,(p.z-uCloudOffset.y)/4200.0)+vec3(0.31,time*0.0008,0.62);
    vec4 shape=textureLod(uCloudNoise,uvw,lod);
    float y=(h-0.25)/0.65;
    float distanceToShell=sqrt(max(0.0,radialSquared+y*y));
    // Large and medium rounded lobes perturb the shell, not a shared flat cap.
    // The deep interior stays positive, avoiding disconnected density shelves.
    float billow=(shape.r-0.5)*0.34+(shape.b-0.5)*0.28;
    float field=1.0-distanceToShell+billow;
    float body=smoothstep(-0.035,0.17,field)*smoothstep(0.0,0.075,h);
    float margin=1.0-smoothstep(0.05,0.38,field);
    return max(0.0,body-(1.0-shape.g)*0.10*margin)*smoothstep(0.0,0.08,uCloudCoverage);
  }
  float cloudSphereExit(vec3 origin,vec3 direction,float radius){
    float r=length(origin),b=dot(origin,direction),c=(r-radius)*(r+radius);
    return -b+sqrt(max(0.0,b*b-c));
  }
  float getCloudShadow(vec3 worldPoint,float time){
    if(sunPosition.y<=0.015||uCloudCoverage<=0.0)return 1.0;
    vec3 direction=normalize(sunPosition);
    vec3 planet=vec3(worldPoint.x,cloudEarthRadius+max(worldPoint.y,1.0),worldPoint.z);
    float start=max(0.0,cloudSphereExit(planet,direction,cloudEarthRadius+uCloudBase));
    float end=cloudSphereExit(planet,direction,cloudEarthRadius+uCloudTop);
    float ds=max(0.0,end-start)/3.0,opticalDepth=0.0;
    for(int i=0;i<3;i++)opticalDepth+=atmosphereCloudDensity(worldPoint+direction*(start+(float(i)+0.5)*ds),time,0.0)*ds;
    return exp(-uCloudExtinction*opticalDepth);
  }
  float getCloudShadow(vec2 worldXZ,float time){return getCloudShadow(vec3(worldXZ.x,1.0,worldXZ.y),time);}
`;

const atmosphereGLSL=/* glsl */`
  const float atmosphereEarth=6360000.0;
  const float atmosphereTop=6460000.0;
  const vec3 betaRayleigh=vec3(5.802e-6,13.558e-6,33.1e-6);
  const vec3 betaOzone=vec3(0.650e-6,1.881e-6,0.085e-6);
  const float betaMie=3.996e-6;
  const float pi=3.141592653589793;
  float atmosphereMass(float mu){
    float zenith=min(95.0,degrees(acos(clamp(mu,-1.0,1.0))));
    return 1.0/(max(0.0,mu)+0.50572*pow(96.07995-zenith,-1.6364));
  }
  float ozoneColumn(float h){
    if(h<10000.0)return 15000.0;
    if(h<25000.0)return 15000.0-(h-10000.0)*(h-10000.0)/30000.0;
    float r=max(0.0,40000.0-h);return r*r/30000.0;
  }
  vec3 atmosphereSunTransmission(float h,float mu){
    float mass=atmosphereMass(mu);
    vec3 tau=betaRayleigh*(8000.0*exp(-max(0.0,h)/8000.0)*mass)
      +vec3(betaMie*1200.0*exp(-max(0.0,h)/1200.0)*mass)+betaOzone*ozoneColumn(h)*mass;
    float horizon=-sqrt(max(0.0,2.0*max(h,0.0)/atmosphereEarth));
    return exp(-tau)*smoothstep(horizon-0.00465,horizon+0.00465,mu);
  }
  float atmospherePhaseHG(float mu,float g){return (1.0-g*g)/(4.0*pi*pow(max(0.0001,1.0+g*g-2.0*g*mu),1.5));}
  vec3 atmosphereRadiance(vec3 origin,vec3 direction,vec3 sun,out vec3 extinction){
    float rayLength=cloudSphereExit(origin,direction,atmosphereTop);
    float b=dot(origin,direction),r=length(origin),c=(r-atmosphereEarth)*(r+atmosphereEarth);
    float groundDiscriminant=b*b-c;
    bool hitsGround=groundDiscriminant>0.0&&b<0.0;
    if(hitsGround)rayLength=min(rayLength,max(0.0,-b-sqrt(groundDiscriminant)));
    float mu=dot(direction,sun),phaseR=3.0/(16.0*pi)*(1.0+mu*mu),phaseM=atmospherePhaseHG(mu,0.76);
    vec3 optical=vec3(0.0),radiance=vec3(0.0);
    for(int i=0;i<ATMOSPHERE_STEPS;i++){
      float a=float(i)/float(ATMOSPHERE_STEPS),z=float(i+1)/float(ATMOSPHERE_STEPS);
      float distance=0.5*(a*a+z*z)*rayLength,ds=(z*z-a*a)*rayLength;
      vec3 p=origin+direction*distance;float h=max(0.0,length(p)-atmosphereEarth);
      vec3 density=vec3(exp(-h/8000.0),exp(-h/1200.0),max(0.0,1.0-abs(h-25000.0)/15000.0));
      vec3 halfOptical=optical+density*ds*0.5;
      vec3 viewTransmission=exp(-(betaRayleigh*halfOptical.x+vec3(betaMie*halfOptical.y)+betaOzone*halfOptical.z));
      vec3 sunTransmission=atmosphereSunTransmission(h,dot(normalize(p),sun));
      vec3 scattering=betaRayleigh*density.x*phaseR+vec3(betaMie*0.90*density.y*phaseM);
      radiance+=viewTransmission*sunTransmission*scattering*ds;
      optical+=density*ds;
    }
    extinction=exp(-(betaRayleigh*optical.x+vec3(betaMie*optical.y)+betaOzone*optical.z));
    // A small bounded diffuse term approximates missing high-order air
    // scattering. It is not the Bruneton/Hillaire multiple-scattering LUT.
    vec3 diffuse=(1.0-extinction)*vec3(0.006,0.010,0.017)*max(0.0,sun.y+0.12);
    radiance=radiance*22.0+diffuse;
    if(hitsGround)radiance+=extinction*vec3(0.018,0.026,0.027)*max(0.0,sun.y+0.12);
    return radiance;
  }
`;

export function createAtmosphere(THREE,{sunDirection,seed=7183,cloudSteps=64,cloudCoverage=0.35,cloudBase=1100,cloudTop=2100,cloudExtinction=0.0028,windMultiplier=1.6}={}){
  const start=performance.now();let rng=seed>>>0;
  const random=()=>{rng+=0x6d2b79f5;let n=Math.imul(rng^(rng>>>15),1|rng);n^=n+Math.imul(n^(n>>>7),61|n);return((n^(n>>>14))>>>0)/4294967296;};
  const grid=n=>({n,data:Float32Array.from({length:n*n*n},random)}),g4=grid(4),g8=grid(8),g16=grid(16);
  function noise(g,x,y,z){
    const n=g.n,px=x*n,py=y*n,pz=z*n,ix=Math.floor(px),iy=Math.floor(py),iz=Math.floor(pz);
    const fx=smooth(0,1,px-ix),fy=smooth(0,1,py-iy),fz=smooth(0,1,pz-iz);
    const at=(a,b,c)=>g.data[(mod(c,n)*n+mod(b,n))*n+mod(a,n)];
    const mix=(a,b,t)=>a+(b-a)*t;
    return mix(mix(mix(at(ix,iy,iz),at(ix+1,iy,iz),fx),mix(at(ix,iy+1,iz),at(ix+1,iy+1,iz),fx),fy),mix(mix(at(ix,iy,iz+1),at(ix+1,iy,iz+1),fx),mix(at(ix,iy+1,iz+1),at(ix+1,iy+1,iz+1),fx),fy),fz);
  }
  function featureGrid(n){return {n,data:Float32Array.from({length:n*n*n*3},random)};}
  const f8=featureGrid(8),f16=featureGrid(16);
  function worley(g,x,y,z){
    const n=g.n,px=x*n,py=y*n,pz=z*n,ix=Math.floor(px),iy=Math.floor(py),iz=Math.floor(pz);let closest=3;
    for(let z=-1;z<=1;z++)for(let y=-1;y<=1;y++)for(let x=-1;x<=1;x++){
      const k=((mod(iz+z,n)*n+mod(iy+y,n))*n+mod(ix+x,n))*3;
      const dx=ix+x+g.data[k]-px,dy=iy+y+g.data[k+1]-py,dz=iz+z+g.data[k+2]-pz;
      closest=Math.min(closest,dx*dx+dy*dy+dz*dz);
    }
    return 1-clamp(Math.sqrt(closest)/1.15,0,1);
  }
  const size=64,volume=new Uint8Array(size*size*size*4);
  for(let z=0;z<size;z++)for(let y=0;y<size;y++)for(let x=0;x<size;x++){
    const u=(x+.5)/size,v=(y+.5)/size,w=(z+.5)/size;
    const a=noise(g4,u,v,w),b=noise(g8,u,v,w),c=noise(g16,u,v,w),cell=worley(f8,u,v,w),detail=worley(f16,u,v,w),k=((z*size+y)*size+x)*4;
    volume[k]=Math.round(clamp(((a*.6+b*.3+c*.1)*.72+cell*.28-.25)/.55,0,1)*255);
    volume[k+1]=Math.round(clamp(b*.25+c*.30+detail*.45,0,1)*255);volume[k+2]=Math.round(detail*255);volume[k+3]=255;
  }
  const noiseTexture=new THREE.Data3DTexture(volume,size,size,size);noiseTexture.format=THREE.RGBAFormat;noiseTexture.type=THREE.UnsignedByteType;
  noiseTexture.wrapS=noiseTexture.wrapT=noiseTexture.wrapR=THREE.RepeatWrapping;
  noiseTexture.minFilter=THREE.LinearMipmapLinearFilter;noiseTexture.magFilter=THREE.LinearFilter;noiseTexture.generateMipmaps=true;noiseTexture.unpackAlignment=1;noiseTexture.needsUpdate=true;
  // Sparse offset cumulus groups replace a broad fBm sheet. With the original
  // fBm weather field its median .655 exceeded the coverage thresholds, so
  // most oblique rays crossed an almost continuous overcast slab.
  const cells=8,cloudCells=Float32Array.from({length:cells*cells*5},(_,i)=>i%5<2?.15+random()*.70:i%5===2?random():i%5===3?.085+random()*.055:.45+random()*.55);
  const ws=512,weatherData=new Uint8Array(ws*ws*4);
  for(let y=0;y<ws;y++)for(let x=0;x<ws;x++){
    const px=(x+.5)/ws*cells,py=(y+.5)/ws*cells,ix=Math.floor(px),iy=Math.floor(py),k=(y*ws+x)*4;
    let coverage=0,type=.7;
    for(let j=-1;j<=1;j++)for(let i=-1;i<=1;i++){
      const c=(mod(iy+j,cells)*cells+mod(ix+i,cells))*5;
      if(cloudCells[c+2]<.12)continue;
      const dx=ix+i+cloudCells[c]-px,dz=iy+j+cloudCells[c+1]-py,sigma=cloudCells[c+3];
      const weight=Math.exp(-(dx*dx+dz*dz)/(2*sigma*sigma));
      if(weight>coverage){coverage=weight;type=cloudCells[c+4];}
    }
    weatherData[k]=Math.round(coverage*255);weatherData[k+1]=Math.round(type*255);weatherData[k+2]=Math.round((.65+.35*type)*255);weatherData[k+3]=255;
  }
  const weatherTexture=new THREE.DataTexture(weatherData,ws,ws,THREE.RGBAFormat,THREE.UnsignedByteType);
  weatherTexture.wrapS=weatherTexture.wrapT=THREE.RepeatWrapping;weatherTexture.minFilter=weatherTexture.magFilter=THREE.LinearFilter;weatherTexture.needsUpdate=true;
  // Choose a clear initial patch from the generated weather field. This is an
  // initial condition, not an island-centred exclusion mask: the whole field
  // still advects and evolves, and clouds can later cross the sunlight path.
  const weatherOrigin=new THREE.Vector2(.37,.51);let originCost=Infinity;
  for(let j=0;j<ws;j++)for(let i=0;i<ws;i++){
    const r=weatherData[(j*ws+i)*4]/255;
    if(r<.01||r>.10)continue;
    let clear=true;
    const clearRadius=Math.ceil(ws/64);
    for(const [dx,dz]of [[-clearRadius,0],[clearRadius,0],[0,-clearRadius],[0,clearRadius]])if(weatherData[(mod(j+dz,ws)*ws+mod(i+dx,ws))*4]/255>.25)clear=false;
    const u=(i+.5)/ws,v=(j+.5)/ws,cost=(u-.37)*(u-.37)+(v-.51)*(v-.51);
    if(clear&&cost<originCost){originCost=cost;weatherOrigin.set(u,v);}
  }
  const direction=sunDirection?.value?.isVector3?sunDirection.value:sunDirection?.isVector3?sunDirection:new THREE.Vector3(.65,.74,-.18).normalize();
  if(direction.lengthSq()<1e-12)direction.set(.65,.74,-.18);
  direction.normalize();
  const sunUniform={value:direction},intensityUniform={value:1},timeUniform={value:0};
  const uniforms={sunPosition:sunUniform,uSkyIntensity:intensityUniform,uSolarDisk:{value:1},uCloudTime:timeUniform,
    uCloudNoise:{value:noiseTexture},uCloudWeather:{value:weatherTexture},uCloudOffset:{value:new THREE.Vector2()},uCloudWeatherOrigin:{value:weatherOrigin},
    uCloudBase:{value:cloudBase},uCloudTop:{value:cloudTop},uCloudCoverage:{value:cloudCoverage},uCloudExtinction:{value:cloudExtinction}};
  const material=new THREE.ShaderMaterial({name:'Physical atmosphere and evolving cumulus',side:THREE.BackSide,depthWrite:false,depthTest:true,
    uniforms,defines:{CLOUD_STEPS:clamp(Math.round(cloudSteps),8,64),ATMOSPHERE_STEPS:8},
    vertexShader:`varying vec3 vSkyWorld;void main(){vec4 world=modelMatrix*vec4(position,1.0);vSkyWorld=world.xyz;gl_Position=projectionMatrix*viewMatrix*world;gl_Position.z=gl_Position.w;}`,
    fragmentShader:/* glsl */`
      precision highp float;
      uniform float uSkyIntensity,uSolarDisk;
      varying vec3 vSkyWorld;
      ${cloudShadowGLSL}
      ${atmosphereGLSL}
      void main(){
        vec3 rd=normalize(vSkyWorld-cameraPosition),sun=normalize(sunPosition);
        vec3 observer=vec3(cameraPosition.x,atmosphereEarth+max(2.0,cameraPosition.y),cameraPosition.z);
        vec3 extinction;vec3 clearSky=atmosphereRadiance(observer,rd,sun,extinction);
        float sunCos=dot(rd,sun),sunRadius=0.00465,diskEdge=cos(sunRadius);
        float disk=smoothstep(diskEdge-fwidth(sunCos),diskEdge+max(fwidth(sunCos),1e-7),sunCos);
        vec3 solar=atmosphereSunTransmission(max(cameraPosition.y,2.0),sun.y);
        clearSky+=solar*32000.0*disk*uSolarDisk;
        vec3 colour=clearSky;
        if(rd.y>-0.015&&uCloudCoverage>0.0){
          float entry=max(0.0,cloudSphereExit(observer,rd,atmosphereEarth+uCloudBase));
          float exit=cloudSphereExit(observer,rd,atmosphereEarth+uCloudTop);
          exit=min(exit,60000.0);
          if(exit>entry){
            float ds=(exit-entry)/float(CLOUD_STEPS),transmission=1.0;
            vec3 cloudLight=vec3(0.0);float viewPhase=0.82*atmospherePhaseHG(sunCos,0.62)+0.18*atmospherePhaseHG(sunCos,-0.25);
            float lod=clamp(log2(max(ds,65.0)/130.0),0.0,1.5);
            for(int i=0;i<CLOUD_STEPS;i++){
              if(transmission<0.015)break;
              float travel=entry+(float(i)+0.5)*ds;
              vec3 pPlanet=observer+rd*travel,p=vec3(pPlanet.x,pPlanet.y-atmosphereEarth,pPlanet.z);
              float density=atmosphereCloudDensity(p,uCloudTime,lod);
              if(density>0.0008){
                float lightDepth=0.0;
                // Three expanding samples capture self-shadow without an
                // atmosphere march nested inside every cloud-light sample.
                for(int j=0;j<3;j++){
                  float d=(float(j)+0.5)*230.0;
                  lightDepth+=atmosphereCloudDensity(p+sun*d,uCloudTime,min(lod+0.3,2.0))*230.0;
                }
                float lightTransmission=exp(-uCloudExtinction*lightDepth);
                float h=cloudAltitude(p),heightFraction=clamp((h-uCloudBase)/(uCloudTop-uCloudBase),0.0,1.0);
                vec3 sunlight=atmosphereSunTransmission(h,sun.y);
                vec3 ambient=mix(vec3(0.11,0.17,0.24),vec3(0.30,0.37,0.45),heightFraction)*max(0.0,sun.y+0.15);
                // Bounded diffuse bounce supplies the bright cloud interior;
                // it is a multiple-scattering approximation, not a solver.
                vec3 incident=sunlight*(22.0*viewPhase*lightTransmission+0.34*(1.0-lightTransmission))+ambient;
                float segmentTransmission=exp(-uCloudExtinction*density*ds);
                float weight=transmission*(1.0-segmentTransmission);
                // Atmospheric perspective makes remote cloud banks meet the
                // same physical horizon haze instead of a pasted white band.
                vec3 aerialTransmission=exp(-(betaRayleigh*0.65+vec3(betaMie*0.45))*travel);
                vec3 source=incident*aerialTransmission+clearSky*(1.0-aerialTransmission);
                cloudLight+=source*weight;transmission*=segmentTransmission;
              }
            }
            colour=cloudLight+clearSky*transmission;
          }
        }
        gl_FragColor=vec4(colour*uSkyIntensity,1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }
    `});
  const mesh=new THREE.Mesh(new THREE.SphereGeometry(20000,32,16),material);mesh.name='Dynamic atmosphere and volume cumulus';mesh.frustumCulled=false;mesh.renderOrder=-1000;
  let lastTime=0,lastWind=new THREE.Vector2(.936,.352).multiplyScalar(1.8*windMultiplier),lastCamera=null,disposed=false;
  function update({time=lastTime,wind=1.8,camera}={}){
    const nextWind=new THREE.Vector2();
    if(typeof wind==='number')nextWind.set(.936,.352).multiplyScalar(wind*windMultiplier);
    else if(wind?.isVector2)nextWind.copy(wind).multiplyScalar(windMultiplier);
    else if(wind?.isVector3)nextWind.set(wind.x,wind.z).multiplyScalar(windMultiplier);
    else nextWind.copy(lastWind);
    if(Number.isFinite(time)){
      const dt=time-lastTime;
      uniforms.uCloudOffset.value.addScaledVector(lastWind,dt*.5).addScaledVector(nextWind,dt*.5);
      timeUniform.value=time;lastTime=time;
    }
    lastWind.copy(nextWind);if(camera?.position)lastCamera=camera.position.toArray();
  }
  function setSun(value={}){
    const d=value?.isVector3?value:value.direction||value.sunDirection;
    if(d?.isVector3){direction.copy(d);if(direction.lengthSq()<1e-12)direction.set(.65,.74,-.18);direction.normalize();}
    else if(Number.isFinite(value.elevation))direction.setFromSphericalCoords(1,THREE.MathUtils.degToRad(90-value.elevation),THREE.MathUtils.degToRad(value.azimuth??100));
    if(Number.isFinite(value.intensity))intensityUniform.value=Math.max(0,value.intensity);
    return lighting();
  }
  const referenceTransmission=solarTransmittance(48*Math.PI/180);
  function lighting(){
    const t=solarTransmittance(Math.asin(clamp(direction.y,-1,1))),relative=t.map((v,i)=>v/Math.max(1e-6,referenceTransmission[i]));
    const warm=[1,.977,.940],rgb=relative.map((v,i)=>v*warm[i]),peak=Math.max(...rgb,0),denominator=Math.max(peak,1e-6);
    const sunColor=new THREE.Color().setRGB(rgb[0]/denominator,rgb[1]/denominator,rgb[2]/denominator);
    // Reconstruct the relative RGB irradiance exactly. Multiplying this
    // peak-normalized colour by a luminance ratio attenuated low sun twice.
    const sunStrength=peak*intensityUniform.value;
    const daylight=smooth(-.04,.7,direction.y);
    const skyTint=new THREE.Color().setRGB(.30+daylight*.07,.44+daylight*.06,.65);
    return {sunColor,sunStrength,skyTint,hemisphereStrength:(.12+.88*daylight)*intensityUniform.value,
      referenceElevationDegrees:48,units:'relative RGB peak scaling in linear scene lighting; not lux',solarTransmission:t,
      note:'sunStrength excludes cloud shadow; apply getCloudShadow once, not twice'};
  }
  function setQuality(value){
    const steps=value==='low'?20:value==='balanced'?32:64;
    if(material.defines.CLOUD_STEPS!==steps){material.defines.CLOUD_STEPS=steps;material.defines.ATMOSPHERE_STEPS=steps<=24?6:8;material.needsUpdate=true;}
  }
  function sampleTexture(bytes,n,x,y,z=0,volume=false){
    const ax=x*n-.5,ay=y*n-.5,az=z*n-.5,ix=Math.floor(ax),iy=Math.floor(ay),iz=Math.floor(az),fx=ax-ix,fy=ay-iy,fz=az-iz;
    const channels=[0,0,0,0];
    for(let k=0;k<(volume?2:1);k++)for(let j=0;j<2;j++)for(let i=0;i<2;i++){
      const weight=(i?fx:1-fx)*(j?fy:1-fy)*(volume?(k?fz:1-fz):1);
      const index=(volume?((mod(iz+k,n)*n+mod(iy+j,n))*n+mod(ix+i,n)):(mod(iy+j,n)*n+mod(ix+i,n)))*4;
      for(let c=0;c<4;c++)channels[c]+=bytes[index+c]/255*weight;
    }
    return channels;
  }
  function cloudDensityAt(p,time=timeUniform.value){
    const h=Math.hypot(p[0],EARTH+p[1],p[2])-EARTH;
    if(h<=uniforms.uCloudBase.value||h>=uniforms.uCloudTop.value||uniforms.uCloudCoverage.value<=0)return 0;
    const offset=uniforms.uCloudOffset.value,origin=uniforms.uCloudWeatherOrigin.value,w=sampleTexture(weatherData,ws,(p[0]-offset.x)/64000+origin.x,(p[2]-offset.y)/64000+origin.y);
    if(w[0]<.003)return 0;
    const radius=1.10+uniforms.uCloudCoverage.value,radialSquared=-2*Math.log(Math.max(w[0],.0001))/(radius*radius);
    const height=(h-uniforms.uCloudBase.value)/((uniforms.uCloudTop.value-uniforms.uCloudBase.value)*(.65+.20*w[1]));
    const s=sampleTexture(volume,size,(p[0]-offset.x)/4200+.31,h/2200+time*.0008,(p[2]-offset.y)/4200+.62,true);
    const y=(height-.25)/.65,distance=Math.sqrt(Math.max(0,radialSquared+y*y)),billow=(s[0]-.5)*.34+(s[2]-.5)*.28,field=1-distance+billow;
    const body=smooth(-.035,.17,field)*smooth(0,.075,height),margin=1-smooth(.05,.38,field);
    return Math.max(0,body-(1-s[1])*.10*margin)*smooth(0,.08,uniforms.uCloudCoverage.value);
  }
  function cloudShadowAt(worldPoint=[0,1,0],time=timeUniform.value){
    if(direction.y<=.015)return 1;
    const p=worldPoint.isVector3?worldPoint.toArray():worldPoint.length===2?[worldPoint[0],1,worldPoint[1]]:worldPoint;
    const planet=[p[0],EARTH+Math.max(1,p[1]),p[2]],r=Math.hypot(...planet),b=planet[0]*direction.x+planet[1]*direction.y+planet[2]*direction.z;
    const exit=radius=>-b+Math.sqrt(Math.max(0,b*b-(r-radius)*(r+radius)));
    const a=Math.max(0,exit(EARTH+uniforms.uCloudBase.value)),e=exit(EARTH+uniforms.uCloudTop.value),ds=(e-a)/3;let optical=0;
    for(let i=0;i<3;i++){const d=a+(i+.5)*ds;optical+=cloudDensityAt([p[0]+direction.x*d,p[1]+direction.y*d,p[2]+direction.z*d],time)*ds;}
    return Math.exp(-uniforms.uCloudExtinction.value*optical);
  }
  const initializationMs=performance.now()-start;
  const diagnostics=()=>({model:'spherical single-scattering Rayleigh/Mie/ozone atmosphere; evolving world-space volume cumulus',
    cloudSteps:material.defines.CLOUD_STEPS,atmosphereSteps:material.defines.ATMOSPHERE_STEPS,noiseDimensions:[size,size,size],weatherDimensions:[ws,ws],
    cloudBaseMetres:uniforms.uCloudBase.value,cloudTopMetres:uniforms.uCloudTop.value,coverage:uniforms.uCloudCoverage.value,cloudExtinctionPerMetre:uniforms.uCloudExtinction.value,
    time:timeUniform.value,offsetMetres:uniforms.uCloudOffset.value.toArray(),weatherOrigin:weatherOrigin.toArray(),altitudeWindMetresPerSecond:lastWind.toArray(),sun:direction.toArray(),
    groundCloudTransmission:cloudShadowAt(),lighting:{sunStrength:lighting().sunStrength,solarTransmission:lighting().solarTransmission,referenceElevationDegrees:48},
    camera:lastCamera,initializationMs,recommendedCubeFaceRate:12,recommendedPMREMHz:.5,
    limits:['8/6-point single-scattering quadrature, not a full multiple-scattering LUT','three-sample cloud self-shadow and ground shadow','bounded diffuse cloud bounce approximation','procedural advection/evolution, not a weather fluid simulation','GPU budget must be measured on the actual renderer']});
  mesh.userData={model:'dynamic-volume-sky-v4-lobed-shell-cumulus',diagnostics};
  function dispose(){if(disposed)return;disposed=true;mesh.geometry.dispose();material.dispose();noiseTexture.dispose();weatherTexture.dispose();}
  return {mesh,uniforms,update,setSun,lighting,setQuality,cloudShadowAt,cloudDensityAt,cloudShadowGLSL,diagnostics,dispose};
}
