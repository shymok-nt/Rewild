import * as THREE from "three";

/** Fixed-size pooled pickup bursts: zero allocations during the game loop. */
export class PickupEffects {
  private readonly geometry = new THREE.OctahedronGeometry(0.09,0);
  private readonly material = new THREE.MeshBasicMaterial({color:0xffdc72,transparent:true,depthWrite:false});
  private readonly particles: {
    mesh: THREE.Mesh;
    velocity: THREE.Vector3;
    life: number;
    duration: number;
  }[]=[];
  private readonly gravity = 8;
  private next=0;

  constructor(scene:THREE.Scene, capacity=36){
    for(let i=0;i<capacity;i++){
      const mesh=new THREE.Mesh(this.geometry,this.material);
      mesh.visible=false;
      mesh.frustumCulled=false;
      scene.add(mesh);
      this.particles.push({mesh,velocity:new THREE.Vector3(),life:0,duration:0.5});
    }
  }
  burst(x:number,y:number,z:number):void {
    for(let i=0;i<9;i++){
      const particle=this.particles[this.next];
      this.next=(this.next+1)%this.particles.length;
      const angle=i*Math.PI*2/9;
      const speed=2.4+(i%3)*0.45;
      particle.mesh.position.set(x,y,z);
      particle.mesh.scale.setScalar(0.75+(i%2)*0.45);
      particle.mesh.rotation.set(0,0,0);
      particle.velocity.set(Math.cos(angle)*speed,1.8+(i%4)*0.4,Math.sin(angle)*speed);
      particle.life=0.48;
      particle.duration=0.48;
      particle.mesh.visible=true;
    }
  }
  update(dt:number):void{
    for(const p of this.particles){
      if(p.life<=0)continue;
      p.life=Math.max(0,p.life-dt);
      p.velocity.y-=this.gravity*dt;
      p.mesh.position.addScaledVector(p.velocity,dt);
      p.mesh.rotation.y+=dt*7;
      p.mesh.rotation.x+=dt*4;
      p.mesh.scale.setScalar(Math.max(0.001,p.life/p.duration)*0.9);
      if(p.life===0)p.mesh.visible=false;
    }
  }
}
