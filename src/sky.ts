import * as THREE from "three";

/** Procedural sky gradient and distant soft cloud sprites.
 * No remote image requests, no per-frame texture creation. */
export function createSky(scene:THREE.Scene): (time:number,camera:THREE.Camera)=>void {
  const dome = new THREE.Mesh(
    new THREE.SphereGeometry(145,24,16),
    new THREE.ShaderMaterial({
      side:THREE.BackSide,
      depthWrite:false,
      uniforms:{
        top:{value:new THREE.Color(0x5c9edb)},
        horizon:{value:new THREE.Color(0xd5eafb)},
        ground:{value:new THREE.Color(0xf7e2c5)}
      },
      vertexShader:`varying vec3 vWorld;
        void main(){
          vec4 world=modelMatrix*vec4(position,1.0);
          vWorld=world.xyz;
          gl_Position=projectionMatrix*viewMatrix*world;
        }`,
      fragmentShader:`varying vec3 vWorld;
        uniform vec3 top;uniform vec3 horizon;uniform vec3 ground;
        void main(){
          float h=normalize(vWorld).y;
          vec3 sky=mix(horizon,top,smoothstep(-0.05,0.75,h));
          sky=mix(ground,sky,smoothstep(-0.4,0.05,h));
          gl_FragColor=vec4(sky,1.0);
        }`
    })
  );
  dome.renderOrder=-1000;
  dome.frustumCulled=false;
  scene.add(dome);
  const canvas=document.createElement("canvas");
  canvas.width=256;canvas.height=128;
  const ctx=canvas.getContext("2d")!;
  ctx.clearRect(0,0,256,128);
  const puffs:[[number,number,number,number],[number,number,number,number],[number,number,number,number]]=[
    [72,70,51,24],[122,58,59,33],[173,74,49,24]
  ];
  for(const [x,y,rx,ry] of puffs){
    ctx.save();
    ctx.translate(x,y);ctx.scale(rx,ry);
    const g=ctx.createRadialGradient(0,-0.2,0.1,0,0,1);
    g.addColorStop(0,"rgba(255,255,255,0.85)");
    g.addColorStop(0.65,"rgba(255,255,255,0.6)");
    g.addColorStop(1,"rgba(255,255,255,0)");
    ctx.fillStyle=g;ctx.beginPath();ctx.arc(0,0,1,0,Math.PI*2);ctx.fill();
    ctx.restore();
  }
  const cloudTexture=new THREE.CanvasTexture(canvas);
  cloudTexture.colorSpace=THREE.SRGBColorSpace;
  const clouds:THREE.Sprite[]=[];
  for(let i=0;i<10;i++){
    const sprite=new THREE.Sprite(new THREE.SpriteMaterial({
      map:cloudTexture,transparent:true,depthWrite:false,opacity:0.7,
      fog:false
    }));
    const side=i%2===0?-1:1;
    sprite.position.set(side*(28+(i%4)*13),18+(i%5)*4,-30-(i%6)*17);
    sprite.scale.set(17+(i%3)*6,9+(i%3)*3,1);
    scene.add(sprite);clouds.push(sprite);
  }
  return (time:number,camera:THREE.Camera)=>{
    dome.position.copy(camera.position);
    for(let i=0;i<clouds.length;i++){
      const cloud=clouds[i];
      cloud.position.x+=Math.sin(time*0.1+i)*0.001;
    }
  };
}
