import * as THREE from "three";

/** Seeded procedural asphalt grain. Generated once; no image downloads or per-frame texture work. */
function rng(seed: number): () => number {
  return () => { seed = (Math.imul(seed, 1664525) + 1013904223) | 0; return (seed >>> 0) / 4294967296; };
}
function texture(kind: "asphalt" | "pavement"): THREE.CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = 512;
  const ctx = canvas.getContext("2d", {alpha:false})!;
  const random = rng(kind==="asphalt"?92381:15382);
  ctx.fillStyle=kind==="asphalt"?"#667081":"#d8c6ae";
  ctx.fillRect(0,0,512,512);
  for(let i=0;i<22000;i++){
    const v=Math.floor(random()*50);
    const x=random()*512,y=random()*512,size=0.4+random()*2;
    ctx.fillStyle=kind==="asphalt"?`rgba(21,35,52,${v/500})`:`rgba(103,79,62,${v/850})`;
    ctx.fillRect(x,y,size,size);
  }
  if(kind==="pavement"){
    ctx.strokeStyle="#b8a48e";ctx.lineWidth=2;
    for(let y=0;y<=512;y+=128){ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(512,y);ctx.stroke();}
    for(let y=0;y<512;y+=128)for(let x=(y/128)%2===0?0:-64;x<512;x+=128){
      ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(x,y+128);ctx.stroke();
    }
  }
  const t=new THREE.CanvasTexture(canvas);
  t.colorSpace=THREE.SRGBColorSpace;
  t.wrapS=t.wrapT=THREE.RepeatWrapping;
  t.repeat.set(kind==="asphalt"?2:1,kind==="asphalt"?30:25);
  t.anisotropy=4;
  return t;
}
export function createGroundMaterials(): {road:THREE.MeshStandardMaterial;sidewalk:THREE.MeshStandardMaterial} {
  return {
    road:new THREE.MeshStandardMaterial({map:texture("asphalt"),color:0xb7bfc8,roughness:0.96}),
    sidewalk:new THREE.MeshStandardMaterial({map:texture("pavement"),roughness:0.94})
  };
}
