import * as THREE from "three";

/**
 * Lightweight repeating road trim: curb stones, painted arrows and pedestrian
 * crossings. All geometry is shared between repeating sections.
 */
export function createRoadDetails(scene: THREE.Scene): (distance: number) => void {
  const curbMat = new THREE.MeshStandardMaterial({ color: 0xf2e6d5, roughness: 0.94 });
  const curbEdge = new THREE.MeshStandardMaterial({ color: 0xb4a79b, roughness: 0.96 });
  const marking = new THREE.MeshStandardMaterial({ color: 0xf9f0dc, roughness: 0.85 });
  const yellow = new THREE.MeshStandardMaterial({ color: 0xf8d46a, roughness: 0.8 });
  const boxGeo = new THREE.BoxGeometry(1,1,1);
  const groups: THREE.Group[] = [];
  const add = (g: THREE.Group, material: THREE.Material,
    x: number, y: number, z: number, w: number, h: number, d: number): THREE.Mesh => {
    const m = new THREE.Mesh(boxGeo,material);
    m.position.set(x,y,z);
    m.scale.set(w,h,d);
    m.receiveShadow=true;
    g.add(m);
    return m;
  };
  for(let i=0;i<10;i++){
    const group=new THREE.Group();
    for(const side of [-1,1]){
      add(group,curbMat,side*5.05,0.12,0,0.3,0.24,18);
      add(group,curbEdge,side*5.23,0.19,0,0.08,0.12,18);
      for(let j=0;j<5;j++){
        add(group,j%2?curbMat:yellow,side*5.07,0.248,-7+j*3.5,0.31,0.018,1.4);
      }
    }
    // Crosswalk appears periodically and remains flat to avoid physics artifacts.
    if(i%4===0){
      for(let j=0;j<8;j++){
        add(group,marking,-4.3+j*1.23,0.045,-1.6,0.7,0.012,2.3);
      }
    }else if(i%3===0){
      for(const x of [-2.9,0,2.9]){
        add(group,marking,x,0.046,-2,0.11,0.012,2.8);
        const tip=add(group,marking,x,0.046,-3.25,0.68,0.012,0.12);
        tip.rotation.y=Math.PI/4;
      }
    }
    group.position.z=8-i*18;
    scene.add(group);
    groups.push(group);
  }
  return (distance:number)=>{
    const cycle=groups.length*18;
    for(let i=0;i<groups.length;i++){
      groups[i].position.z=8-((i*18-distance%cycle+cycle)%cycle);
    }
  };
}
