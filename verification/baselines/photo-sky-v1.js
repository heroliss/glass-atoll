// Historical photographed sky, retained for visual comparison; inactive.
function createPhotoSky(texture){
  // Detect the photographed sun in the linear HDR pixels. It is removed from
  // the panorama and reintroduced at the adjustable solar direction, avoiding
  // two suns or a fixed highlight when the lighting controls are moved.
  const {data,width,height}=texture.image;
  let brightest=0,sourceX=0,sourceY=0;
  for(let y=0;y<height;y++)for(let x=0;x<width;x++){
    const i=(y*width+x)*4;
    const value=THREE.DataUtils.fromHalfFloat(data[i])+THREE.DataUtils.fromHalfFloat(data[i+1])+THREE.DataUtils.fromHalfFloat(data[i+2]);
    if(value>brightest){brightest=value;sourceX=x;sourceY=y;}
  }
  const sourceUV=new THREE.Vector2((sourceX+.5)/width,1.-(sourceY+.5)/height);
  const phi=(sourceUV.x-.5)*Math.PI*2,theta=(sourceUV.y-.5)*Math.PI;
  const sourceDir=new THREE.Vector3(Math.cos(theta)*Math.cos(phi),Math.sin(theta),Math.cos(theta)*Math.sin(phi));
  const material=new THREE.ShaderMaterial({
    side:THREE.BackSide,depthWrite:false,
    uniforms:{uPanorama:{value:texture},sunPosition:{value:sunDirection},uSourceSun:{value:sourceDir},uSourcePhi:{value:phi},uSkyIntensity:{value:1},uCloudTime:{value:0},uSolarDisk:{value:1}},
    vertexShader:/* glsl */`varying vec3 vDirection;void main(){vec4 world=modelMatrix*vec4(position,1.);vDirection=world.xyz;gl_Position=projectionMatrix*viewMatrix*world;}`,
    fragmentShader:/* glsl */`
      uniform sampler2D uPanorama;
      uniform vec3 sunPosition;
      uniform vec3 uSourceSun;
      uniform float uSourcePhi;
      uniform float uSkyIntensity;
      uniform float uSolarDisk;
      varying vec3 vDirection;
      vec2 equirect(vec3 d){return vec2(atan(d.z,d.x)*.1591549431+.5,asin(clamp(d.y,-1.,1.))*.3183098862+.5);}
      void main(){
        vec3 d=normalize(vDirection-cameraPosition);
        float targetPhi=atan(sunPosition.z,sunPosition.x);
        float yaw=uSourcePhi-targetPhi;
        vec3 sourceDirection=vec3(cos(yaw)*d.x-sin(yaw)*d.z,d.y,sin(yaw)*d.x+cos(yaw)*d.z);
        vec2 uv=equirect(sourceDirection);
        vec3 colour=texture2D(uPanorama,uv).rgb;
        float oldSun=dot(sourceDirection,uSourceSun);
        float mask=smoothstep(.991,.9992,oldSun);
        vec3 replacement=texture2D(uPanorama,uv+vec2(.035,0.)).rgb;
        colour=mix(colour,replacement,mask);
        float blue=smoothstep(.08,.55,(colour.b-colour.r)/max(colour.b,.001));
        colour*=mix(vec3(1.),vec3(.68,1.04,1.20),blue*.75);
        float warm=1.-smoothstep(.12,.65,sunPosition.y);
        colour*=mix(vec3(1.),vec3(1.12,.82,.66),warm*.65);
        float newSun=dot(d,sunPosition);
        colour+=vec3(1.,.91,.74)*pow(max(newSun,0.),420.)*.45;
        float disk=smoothstep(.999986,.999990,newSun);
        colour=mix(colour,vec3(48000.,46000.,42000.),disk*uSolarDisk);
        gl_FragColor=vec4(colour*uSkyIntensity,1.);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }
    `
  });
  const mesh=new THREE.Mesh(new THREE.SphereGeometry(20000,48,24),material);
  mesh.frustumCulled=false;
  mesh.userData={sourceUV:sourceUV.toArray(),sourceDirection:sourceDir.toArray(),brightest};
  return mesh;
}
