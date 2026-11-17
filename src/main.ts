import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import "./style.css";
import { createCity } from "./city";
import { HazardSystem } from "./hazards";
import { createStreetDetails } from "./street";

const app = document.querySelector<HTMLDivElement>("#app");
if (!app) throw new Error("App container not found");
app.innerHTML = `<div id="hud"><strong>RUSH CITY</strong><span id="score">0 m</span><span id="coins">● 0</span></div><div id="instructions">← → ŞERİT &nbsp; · &nbsp; ↑ ZIPLA &nbsp; · &nbsp; ↓ KAY &nbsp; · &nbsp; P DURAKLAT</div><div id="mobile-controls"><button data-action="ArrowLeft" aria-label="Sola geç">◀</button><button data-action="ArrowUp" aria-label="Zıpla">↑</button><button data-action="ArrowDown" aria-label="Kay">↓</button><button data-action="ArrowRight" aria-label="Sağa geç">▶</button></div><button id="pause-button" aria-label="Duraklat">Ⅱ</button><div id="status" hidden></div>`;
const scoreEl = document.querySelector<HTMLElement>("#score")!;
const coinsEl = document.querySelector<HTMLElement>("#coins")!;
const statusEl = document.querySelector<HTMLElement>("#status")!;
const pauseButton = document.querySelector<HTMLButtonElement>("#pause-button")!;
const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: "high-performance" });
renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.5;
app.prepend(renderer.domElement);
const scene = new THREE.Scene();
scene.background = new THREE.Color("#91c8ef");
scene.fog = new THREE.Fog("#91c8ef", 35, 110);
const camera = new THREE.PerspectiveCamera(62, 1, 0.1, 180);
camera.position.set(0, 4.5, 10);
camera.lookAt(0, 1.3, -16);
scene.add(new THREE.HemisphereLight(0xf4f9ff, 0x768b9b, 2.2));
const sun = new THREE.DirectionalLight(0xffefd2, 2.6);
sun.position.set(-9, 18, 7);
sun.castShadow = true;
sun.shadow.mapSize.set(1024, 1024);
sun.shadow.camera.left = -22; sun.shadow.camera.right = 22;
sun.shadow.camera.top = 25; sun.shadow.camera.bottom = -25;
scene.add(sun);
const roadMaterial = new THREE.MeshStandardMaterial({color:0x394c63,roughness:0.94});
const sidewalkMaterial = new THREE.MeshStandardMaterial({color:0xe6d5c1,roughness:0.9});
const lineMaterial = new THREE.MeshStandardMaterial({color:0xfceacb,emissive:0x50422b,emissiveIntensity:0.15});
function plane(width:number,depth:number,x:number,y:number,z:number,material:THREE.Material):THREE.Mesh {
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(width,depth),material);
  mesh.rotation.x = -Math.PI/2;mesh.position.set(x,y,z);mesh.receiveShadow=true;scene.add(mesh);return mesh;
}
plane(10,240,0,0,-90,roadMaterial);
plane(3,240,-6.5,0.025,-90,sidewalkMaterial);
plane(3,240,6.5,0.025,-90,sidewalkMaterial);
const stripes:THREE.Mesh[]=[];
for(let i=0;i<46;i++)for(const lane of [-1,1]){
  const m=plane(0.10,2.4,lane*1.65,0.035,-i*5+9,lineMaterial);stripes.push(m);
}
const updateCity = createCity(scene);
const updateStreet = createStreetDetails(scene);
const playerRoot=new THREE.Group();scene.add(playerRoot);
const loader=new GLTFLoader();
let mixer:THREE.AnimationMixer|null=null;
const clips = new Map<string,THREE.AnimationAction>();
let currentClip = "";
function playAnimation(name: string): void {
  if (currentClip === name || !mixer) return;
  const next = clips.get(name) ?? clips.get("run");
  if (!next) return;
  const previous = clips.get(currentClip);
  next.reset().setEffectiveWeight(1).setEffectiveTimeScale(1).play();
  if (previous && previous !== next) next.crossFadeFrom(previous,0.16,true);
  currentClip=name;
}
let avatar:THREE.Object3D|null=null;

// Temporary animated model for the GLB pipeline; replace with art-directed human runner.
const characterUrl="/assets/character.glb";
loader.load(characterUrl,gltf=>{
  avatar=gltf.scene;
  const bounds=new THREE.Box3().setFromObject(avatar);
  const height=Math.max(bounds.max.y-bounds.min.y,0.01);
  avatar.scale.multiplyScalar(2.3/height);
  const resized=new THREE.Box3().setFromObject(avatar);
  avatar.position.y=-resized.min.y;
  avatar.rotation.y=Math.PI;
  avatar.traverse(o=>{if(o instanceof THREE.Mesh){o.castShadow=true;o.receiveShadow=true;}});
  playerRoot.add(avatar);
  mixer=new THREE.AnimationMixer(avatar);
  const find=(regex:RegExp)=>gltf.animations.find(a=>regex.test(a.name));
  const run=find(/run|jog/i)??find(/walk/i)??gltf.animations[0];
  const jumpClip=find(/jump|leap/i);
  const slideClip=find(/slide|crouch|duck/i);
  if(run)clips.set("run",mixer.clipAction(run));
  if(jumpClip)clips.set("jump",mixer.clipAction(jumpClip));
  if(slideClip)clips.set("slide",mixer.clipAction(slideClip));
  playAnimation("run");
  statusEl.hidden=true;
},undefined,()=>{
  statusEl.hidden=false;
  statusEl.textContent="3D karakter modeli henüz kurulmadı: public/assets/character.glb gerekiyor. Sahne hazır, karakter varlığı bekleniyor.";
});
const clock=new THREE.Clock();
let distance=0,coins=0,lane=0,laneVisual=0,jump=0,slide=0,paused=false,dead=false;
let best = Number(localStorage.getItem("rush-city-best") || 0);
let jumpElapsed = 0;
let jumpActive = false;
const jumpDuration = 0.82;
const laneWidth=2.9;
const hazards = new HazardSystem(scene);
function action(key:string){
 if(dead&&key!=="r"&&key!==" ")return;
 if(paused&&key!=="p"&&key!=="Escape")return;
 if(key==="ArrowLeft"||key==="a")lane=Math.max(-1,lane-1);
 if(key==="ArrowRight"||key==="d")lane=Math.min(1,lane+1);
 if((key==="ArrowUp"||key===" "||key==="w")&&!jumpActive&&slide<=0){jumpActive=true;jumpElapsed=0;jump=jumpDuration;}
 if((key==="ArrowDown"||key==="s")&&slide<=0&&!jumpActive)slide=0.72;
 if(key==="p"||key==="Escape"){paused=!paused;pauseButton.textContent=paused?"▶":"Ⅱ";if(!dead){statusEl.hidden=!paused;statusEl.textContent="DURAKLATILDI · P İLE DEVAM";}}
 if(dead&&(key==="r"||key===" ")){dead=false;paused=false;pauseButton.textContent="Ⅱ";distance=0;coins=0;lane=0;laneVisual=0;jump=0;slide=0;jumpActive=false;jumpElapsed=0;hazards.reset();statusEl.hidden=true;}
}
pauseButton.addEventListener("click",()=>action("p"));
document.querySelectorAll<HTMLButtonElement>("[data-action]").forEach(button=>button.addEventListener("pointerdown",e=>{e.preventDefault();action(button.dataset.action||"");}));
window.addEventListener("keydown",e=>{if(["ArrowLeft","ArrowRight","ArrowUp","ArrowDown"," "].includes(e.key))e.preventDefault();if(!e.repeat)action(e.key);});
let touchStart:{x:number,y:number}|null=null;
renderer.domElement.addEventListener("pointerdown",e=>touchStart={x:e.clientX,y:e.clientY});
renderer.domElement.addEventListener("pointerup",e=>{if(!touchStart)return;const dx=e.clientX-touchStart.x,dy=e.clientY-touchStart.y;touchStart=null;if(Math.abs(dx)>35&&Math.abs(dx)>Math.abs(dy))action(dx>0?"ArrowRight":"ArrowLeft");else if(Math.abs(dy)>35)action(dy<0?"ArrowUp":"ArrowDown");});
function resize(){const w=Math.max(1,app!.clientWidth),h=Math.max(1,app!.clientHeight);camera.aspect=w/h;camera.fov=h>w?72:62;camera.updateProjectionMatrix();renderer.setSize(w,h);}
window.addEventListener("resize",resize);resize();
function frame(){
 requestAnimationFrame(frame);
 const dt=Math.min(clock.getDelta(),0.05);
 if(!paused&&!dead){
  const speed=Math.min(24,13+distance/450);
  distance+=dt*speed;
  updateCity(distance);
  updateStreet(distance);
  mixer?.update(dt);
  laneVisual=THREE.MathUtils.damp(laneVisual,lane*laneWidth,13,dt);
  if(jumpActive){jumpElapsed=Math.min(jumpDuration,jumpElapsed+dt);jump=jumpDuration-jumpElapsed;if(jumpElapsed>=jumpDuration){jumpActive=false;jump=0;}}
  const jumpHeight=jumpActive?Math.sin(jumpElapsed/jumpDuration*Math.PI)*1.8:0;
  playAnimation(jumpActive?"jump":slide>0?"slide":"run");
  if(slide>0)slide=Math.max(0,slide-dt);
  playerRoot.position.set(laneVisual,jumpHeight,0);
  playerRoot.scale.y=slide>0?0.55:1;
  camera.position.x=THREE.MathUtils.damp(camera.position.x,laneVisual*0.16,2.8,dt);
  camera.lookAt(camera.position.x*0.25,1.25,-16);
  for(const stripe of stripes){stripe.position.z+=dt*speed;if(stripe.position.z>12)stripe.position.z-=230;}
  const collision = hazards.update(dt, distance, speed, lane, playerRoot.position.y, slide > 0);
  coins += collision.coins;
  if (collision.crashed) {
    dead = true;
    best=Math.max(best,Math.floor(distance));
    localStorage.setItem("rush-city-best",String(best));
    statusEl.hidden = false;
    statusEl.textContent = "KOŞU BİTTİ · "+Math.floor(distance)+" m · REKOR "+best+" m · R İLE TEKRAR";
  }
  scoreEl.textContent=Math.floor(distance)+" m · REKOR "+best+" m";
  coinsEl.textContent="● "+coins;
 }
 renderer.render(scene,camera);
}
frame();
