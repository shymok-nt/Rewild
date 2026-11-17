import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import "./style.css";
import { createCity } from "./city";
import { HazardSystem } from "./hazards";
import { createStreetDetails } from "./street";
import { createGroundMaterials } from "./ground";
import { GameAudio } from "./audio";
import { createRoadDetails } from "./road";
import { PickupEffects } from "./effects";

const app = document.querySelector<HTMLDivElement>("#app");
if (!app) throw new Error("App container not found");
app.innerHTML = `<div id="hud"><strong>RUSH CITY</strong><span id="score">0 m</span><span id="coins">● 0</span></div><div id="instructions">← → ŞERİT &nbsp; · &nbsp; ↑ ZIPLA &nbsp; · &nbsp; ↓ KAY &nbsp; · &nbsp; P DURAKLAT</div><div id="mobile-controls"><button data-action="ArrowLeft" aria-label="Sola geç">◀</button><button data-action="ArrowUp" aria-label="Zıpla">↑</button><button data-action="ArrowDown" aria-label="Kay">↓</button><button data-action="ArrowRight" aria-label="Sağa geç">▶</button></div><button id="pause-button" aria-label="Duraklat">Ⅱ</button><button id="sound-button" aria-label="Sesi aç veya kapat">♫</button><div id="status" hidden></div><button id="restart-button" hidden>YENİDEN OYNA</button>`;
const scoreEl = document.querySelector<HTMLElement>("#score")!;
const coinsEl = document.querySelector<HTMLElement>("#coins")!;
const statusEl = document.querySelector<HTMLElement>("#status")!;
const restartButton = document.querySelector<HTMLButtonElement>("#restart-button")!;
const pauseButton = document.querySelector<HTMLButtonElement>("#pause-button")!;
const soundButton = document.querySelector<HTMLButtonElement>("#sound-button")!;
const audio = new GameAudio();
soundButton.textContent = audio.isMuted ? "♪̸" : "♫";
soundButton.addEventListener("click",()=>{audio.setMuted(!audio.isMuted);soundButton.textContent=audio.isMuted?"♪̸":"♫";audio.unlock();});
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
const {road:roadMaterial,sidewalk:sidewalkMaterial}=createGroundMaterials();
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
const updateRoad = createRoadDetails(scene);
const playerRoot=new THREE.Group();scene.add(playerRoot);
const shadowCanvas=document.createElement("canvas");
shadowCanvas.width=shadowCanvas.height=128;
const shadowCtx=shadowCanvas.getContext("2d")!;
const shadowGradient=shadowCtx.createRadialGradient(64,64,4,64,64,64);
shadowGradient.addColorStop(0,"rgba(14,28,41,0.44)");
shadowGradient.addColorStop(0.45,"rgba(14,28,41,0.2)");
shadowGradient.addColorStop(1,"rgba(14,28,41,0)");
shadowCtx.fillStyle=shadowGradient;
shadowCtx.fillRect(0,0,128,128);
const shadowTexture=new THREE.CanvasTexture(shadowCanvas);
const playerShadow=new THREE.Mesh(
 new THREE.PlaneGeometry(2.1,1.35),
 new THREE.MeshBasicMaterial({map:shadowTexture,transparent:true,depthWrite:false,opacity:0.85})
);
playerShadow.rotation.x=-Math.PI/2;
playerShadow.position.y=0.045;
scene.add(playerShadow);
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
  if (!dead && !paused) statusEl.hidden=true;
},undefined,()=>{
  statusEl.hidden=false;
  statusEl.textContent="3D karakter modeli henüz kurulmadı: public/assets/character.glb gerekiyor. Sahne hazır, karakter varlığı bekleniyor.";
});
const clock=new THREE.Clock();
let distance=0,coins=0,lane=0,laneVisual=0,jump=0,slide=0,paused=true,dead=false;
let best = 0;
try { best = Math.max(0, Number(localStorage.getItem("rush-city-best") || 0) || 0); } catch { /* private browsing */ }
let jumpElapsed = 0;
let jumpActive = false;
const jumpDuration = 0.82;
const laneWidth=2.9;
const hazards = new HazardSystem(scene);
const pickupEffects = new PickupEffects(scene);
statusEl.hidden=false;
statusEl.textContent="RUSH CITY · SOKAKLAR SENİN!";
restartButton.hidden=false;
restartButton.textContent="KOŞUYA BAŞLA";
pauseButton.textContent="▶";
function action(key:string){
 if(dead&&key!=="r"&&key!==" ")return;
 if(paused&&key!=="p"&&key!=="Escape")return;
 if(key==="ArrowLeft"||key==="a"){const prev=lane;lane=Math.max(-1,lane-1);if(prev!==lane)audio.lane();}
 if(key==="ArrowRight"||key==="d"){const prev=lane;lane=Math.min(1,lane+1);if(prev!==lane)audio.lane();}
 if((key==="ArrowUp"||key===" "||key==="w")&&!jumpActive&&slide<=0){jumpActive=true;jumpElapsed=0;jump=jumpDuration;audio.jump();}
 if((key==="ArrowDown"||key==="s")&&slide<=0&&!jumpActive)slide=0.72;audio.slide();
 if(key==="p"||key==="Escape"){paused=!paused;pauseButton.textContent=paused?"▶":"Ⅱ";if(!dead){statusEl.hidden=!paused;if(paused)statusEl.textContent="DURAKLATILDI · P İLE DEVAM";else{restartButton.hidden=true;audio.start();}}}
 if(dead&&(key==="r"||key===" ")){restartButton.hidden=true;restartButton.textContent="YENİDEN OYNA";dead=false;paused=false;pauseButton.textContent="Ⅱ";distance=0;coins=0;lane=0;laneVisual=0;jump=0;slide=0;jumpActive=false;jumpElapsed=0;hazards.reset();statusEl.hidden=true;audio.start();}
}
restartButton.addEventListener("click",()=>{audio.unlock();if(dead)action("r");else if(paused)action("p");});
pauseButton.addEventListener("click",()=>{audio.unlock();action("p");});
document.querySelectorAll<HTMLButtonElement>("[data-action]").forEach(button=>button.addEventListener("pointerdown",e=>{e.preventDefault();audio.unlock();action(button.dataset.action||"");}));
window.addEventListener("keydown",e=>{if(["ArrowLeft","ArrowRight","ArrowUp","ArrowDown"," "].includes(e.key))e.preventDefault();if(!e.repeat){audio.unlock();action(e.key);}});
document.addEventListener("visibilitychange",()=>{if(document.hidden&&!dead&&!paused){paused=true;pauseButton.textContent="▶";statusEl.hidden=false;statusEl.textContent="DURAKLATILDI · P İLE DEVAM";}});
let touchStart:{x:number,y:number}|null=null;
renderer.domElement.addEventListener("pointerdown",e=>{audio.unlock();touchStart={x:e.clientX,y:e.clientY};});
renderer.domElement.addEventListener("pointerup",e=>{if(!touchStart)return;const dx=e.clientX-touchStart.x,dy=e.clientY-touchStart.y;touchStart=null;if(Math.abs(dx)>35&&Math.abs(dx)>Math.abs(dy))action(dx>0?"ArrowRight":"ArrowLeft");else if(Math.abs(dy)>35)action(dy<0?"ArrowUp":"ArrowDown");});
function resize(){const w=Math.max(1,app!.clientWidth),h=Math.max(1,app!.clientHeight);camera.aspect=w/h;camera.fov=h>w?72:62;camera.updateProjectionMatrix();renderer.setSize(w,h);}
window.addEventListener("resize",resize);resize();
let frameCount=0;
let frameSeconds=0;
let qualityCooldown=0;
function frame(){
 requestAnimationFrame(frame);
 const dt=Math.min(clock.getDelta(),0.05);
 frameCount++;
 frameSeconds+=dt;
 qualityCooldown=Math.max(0,qualityCooldown-dt);
 if(frameSeconds>=3){
  const fps=frameCount/frameSeconds;
  const pixelRatio=renderer.getPixelRatio();
  if(qualityCooldown===0&&fps<38&&pixelRatio>0.85){renderer.setPixelRatio(Math.max(0.85,pixelRatio-0.2));resize();qualityCooldown=8;}
  else if(qualityCooldown===0&&fps>58&&pixelRatio<Math.min(devicePixelRatio,1.5)){renderer.setPixelRatio(Math.min(Math.min(devicePixelRatio,1.5),pixelRatio+0.1));resize();qualityCooldown=8;}
  frameCount=0;frameSeconds=0;
 }
 if(!paused&&!dead){
  const speed=Math.min(24,13+distance/450);
  distance+=dt*speed;
  updateCity(distance);
  updateStreet(distance);
  updateRoad(distance);
  mixer?.update(dt);
  laneVisual=THREE.MathUtils.damp(laneVisual,lane*laneWidth,13,dt);
  if(jumpActive){jumpElapsed=Math.min(jumpDuration,jumpElapsed+dt);jump=jumpDuration-jumpElapsed;if(jumpElapsed>=jumpDuration){jumpActive=false;jump=0;}}
  const jumpHeight=jumpActive?Math.sin(jumpElapsed/jumpDuration*Math.PI)*1.8:0;
  playAnimation(jumpActive?"jump":slide>0?"slide":"run");
  if(slide>0)slide=Math.max(0,slide-dt);
  playerRoot.position.set(laneVisual,jumpHeight,0);
  playerShadow.position.x=laneVisual;
  playerShadow.scale.setScalar(1+jumpHeight*0.16);
  (playerShadow.material as THREE.MeshBasicMaterial).opacity=0.85-jumpHeight*0.25;
  playerRoot.scale.y=slide>0?0.55:1;
  camera.position.x=THREE.MathUtils.damp(camera.position.x,laneVisual*0.16,2.8,dt);
  camera.lookAt(camera.position.x*0.25,1.25,-16);
  for(const stripe of stripes){stripe.position.z+=dt*speed;if(stripe.position.z>12)stripe.position.z-=230;}
  const collision = hazards.update(dt, distance, speed, lane, playerRoot.position.y, slide > 0);
  coins += collision.coins;
  if(collision.coins>0){audio.coin();pickupEffects.burst(laneVisual,1.2,0);}
  pickupEffects.update(dt);
  if (collision.crashed) {
    audio.crash();
    dead = true;
    best=Math.max(best,Math.floor(distance));
    try { localStorage.setItem("rush-city-best",String(best)); } catch { /* storage disabled */ }
    statusEl.hidden = false;
    restartButton.hidden = false;
    restartButton.textContent = "YENİDEN OYNA";
    statusEl.textContent = "KOŞU BİTTİ · "+Math.floor(distance)+" m · REKOR "+best+" m · R İLE TEKRAR";
  }
  scoreEl.textContent=Math.floor(distance)+" m · REKOR "+best+" m";
  coinsEl.textContent="● "+coins;
 }
 renderer.render(scene,camera);
}
frame();
