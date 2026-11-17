import * as THREE from "three";

/** Street furniture is batched into fixed recycled blocks. */
export function createStreetDetails(scene: THREE.Scene): (distance: number) => void {
  const metal = new THREE.MeshStandardMaterial({color:0x324b61,metalness:0.5,roughness:0.45});
  const warm = new THREE.MeshStandardMaterial({color:0xffe5a3,emissive:0xffb751,emissiveIntensity:0.4});
  const planter = new THREE.MeshStandardMaterial({color:0xd0a886,roughness:0.88});
  const green = new THREE.MeshStandardMaterial({color:0x4d9b72,roughness:0.94});
  const blossom = new THREE.MeshStandardMaterial({color:0xe9a1a4,roughness:0.9});
  const bollard = new THREE.CylinderGeometry(0.12,0.15,0.7,10);
  const pole = new THREE.CylinderGeometry(0.065,0.09,4.5,10);
  const globe = new THREE.SphereGeometry(0.26,12,8);
  const potGeo = new THREE.CylinderGeometry(0.65,0.45,0.9,12);
  const crownGeo = new THREE.IcosahedronGeometry(0.75,2);
  const segments: THREE.Group[]=[];
  for(let i=0;i<18;i++){
    const segment = new THREE.Group();
    const side=i%2===0?-1:1;
    const lamp = new THREE.Group();
    const shaft = new THREE.Mesh(pole,metal);
    shaft.position.y=2.25;shaft.castShadow=true;lamp.add(shaft);
    const light = new THREE.Mesh(globe,warm);
    light.position.set(-side*0.38,4.5,0);
    lamp.add(light);
    const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.055,0.055,0.9,8),metal);
    arm.rotation.z=Math.PI/2;arm.position.set(-side*0.25,4.42,0);
    lamp.add(arm);
    lamp.position.x=side*5.6;
    segment.add(lamp);
    const pot=new THREE.Mesh(potGeo,planter);
    pot.position.set(side*7.3,0.45,3.2);
    pot.castShadow=true;
    segment.add(pot);
    const bush=new THREE.Mesh(crownGeo,i%5===0?blossom:green);
    bush.position.set(side*7.3,1.32,3.2);
    bush.scale.set(0.95,0.85,0.95);
    bush.castShadow=true;segment.add(bush);
    for(let j=0;j<3;j++){
      const post=new THREE.Mesh(bollard,metal);
      post.position.set(side*5.2,0.35,-3.4+j*1.5);
      segment.add(post);
    }
    segment.position.z=7-Math.floor(i/2)*18;
    scene.add(segment);segments.push(segment);
  }
  return (distance:number)=>{
    const cycle=9*18;
    for(let i=0;i<segments.length;i++){
      const index=Math.floor(i/2);
      segments[i].position.z=7-((index*18-distance%cycle+cycle)%cycle);
    }
  };
}
