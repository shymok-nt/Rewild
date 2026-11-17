import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { loadWorldAssets } from "./assetWorld";
import "./style.css";
import { HazardSystem } from "./hazards";
import { createStreetDetails } from "./street";
import { GameAudio } from "./audio";
import { PickupEffects } from "./effects";
import { createSky } from "./sky";
import { clampLane, jumpArc, runnerSpeed } from "./rules";

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
renderer.setPixelRatio(Math.min(devicePixelRatio, 1.25));
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
const updateSky = createSky(scene);
camera.position.set(0, 4.5, 10);
camera.lookAt(0, 1.3, -16);
scene.add(new THREE.HemisphereLight(0xf4f9ff, 0x768b9b, 2.2));
const sun = new THREE.DirectionalLight(0xffefd2, 2.6);
sun.position.set(-9, 18, 7);
sun.castShadow = true;
sun.shadow.mapSize.set(512, 512);
sun.shadow.camera.left = -22; sun.shadow.camera.right = 22;
sun.shadow.camera.top = 25; sun.shadow.camera.bottom = -25;
scene.add(sun);
const updateStreet = createStreetDetails(scene);
let updateWorld: (distance: number) => void = () => {};
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
// Model geometry comes exclusively from GLB files; Three.js only loads and animates it.
const loader = new GLTFLoader();
let runnerModel: THREE.Object3D | null = null;
let runnerMixer: THREE.AnimationMixer | null = null;
let runnerBaseY = 0;
const joints = new Map<string, THREE.Object3D>();
let runPhase = 0;
let poseBlend = 0;
function animateRunner(dt: number, pose: "run" | "jump" | "slide", speed: number): void {
  if (!runnerModel) return;
  if (runnerMixer) {
    runnerMixer.update(dt * Math.max(0.85, speed / 13));
    const slide = pose === "slide" ? 1 : 0;
    poseBlend += (slide - poseBlend) * (1 - Math.exp(-dt * 12));
    runnerModel.position.y = runnerBaseY - poseBlend * 0.65;
    runnerModel.rotation.x = -poseBlend * 0.35;
    return;
  }
  runPhase += dt * Math.max(8, speed * 0.72);
  const smooth = 1 - Math.exp(-dt * 14);
  poseBlend += ((pose === "slide" ? 1 : 0) - poseBlend) * smooth;
  const stride = Math.sin(runPhase);
  const torso = joints.get("Torso");
  if (torso) torso.rotation.x = poseBlend * 0.48;
  runnerModel.position.y = -poseBlend * 0.42 + (pose === "run" ? Math.abs(stride) * 0.06 : 0);
  for (const [i, side] of ["L", "R"].entries()) {
    const sign = i === 0 ? 1 : -1;
    const arm = joints.get("Arm" + side);
    const leg = joints.get("Leg" + side);
    const knee = joints.get("Knee" + side);
    const armTarget = pose === "run" ? sign * stride * 0.65 : pose === "jump" ? -0.5 : -0.9;
    const legTarget = pose === "run" ? -sign * stride * 0.68 : pose === "jump" ? 0.35 : -1.05;
    const kneeTarget = pose === "run" ? Math.max(0, sign * stride) * 0.9 : pose === "jump" ? 0.7 : 1.65;
    if (arm) arm.rotation.x += (armTarget - arm.rotation.x) * smooth;
    if (leg) leg.rotation.x += (legTarget - leg.rotation.x) * smooth;
    if (knee) knee.rotation.x += (kneeTarget - knee.rotation.x) * smooth;
  }
}
let assetsReady = false;
Promise.all([loader.loadAsync("/assets/real-runner.glb"), loadWorldAssets(scene)])
  .then(([gltf, update]) => {
    runnerModel = gltf.scene;
    const bounds = new THREE.Box3().setFromObject(runnerModel);
    const height = Math.max(0.01, bounds.max.y - bounds.min.y);
    const scale = 2.25 / height;
    runnerModel.scale.setScalar(scale);
    // Align model feet with ground regardless of source model units.
    runnerBaseY = -bounds.min.y * scale;
    runnerModel.position.y = runnerBaseY;
    if (gltf.animations.length > 0) {
      runnerMixer = new THREE.AnimationMixer(runnerModel);
      runnerMixer.clipAction(gltf.animations[0]).play();
    }
    runnerModel.traverse(node => {
      if (node.name) joints.set(node.name, node);
      if (node instanceof THREE.Mesh) {
        node.castShadow = true;
        // Runner is a transform pivot, not a visible body part in the exported GLB.
        if (!runnerMixer && node.name === "Runner") {
          node.geometry = node.geometry.clone();
          node.geometry.setDrawRange(0, 0);
        }
      }
    });
    playerRoot.add(runnerModel);
    updateWorld = update;
    assetsReady = true;
    restartButton.disabled = false;
    restartButton.textContent = "KOŞUYA BAŞLA";
    statusEl.textContent = "RUSH CITY · SOKAKLAR SENİN!";
  }).catch(error => {
    console.error("GLB asset loading failed", error);
    statusEl.hidden = false;
    statusEl.textContent = "3D modeller yüklenemedi. public/assets klasörünü kontrol edin.";
    restartButton.textContent = "MODEL HATASI";
  });
const clock=new THREE.Clock();
let distance=0,coins=0,lane=0,laneVisual=0,slide=0,paused=true,dead=false;
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
restartButton.textContent="3D MODELLER YÜKLENİYOR";
restartButton.disabled=true;
pauseButton.textContent="▶";
function action(key:string){
 if(dead&&key!=="r"&&key!==" ")return;
 if(paused&&key!=="p"&&key!=="Escape")return;
 if(key==="ArrowLeft"||key==="a"){const prev=lane;lane=clampLane(lane-1);if(prev!==lane)audio.lane();}
 if(key==="ArrowRight"||key==="d"){const prev=lane;lane=clampLane(lane+1);if(prev!==lane)audio.lane();}
 if((key==="ArrowUp"||key===" "||key==="w")&&!jumpActive&&slide<=0){jumpActive=true;jumpElapsed=0;audio.jump();}
 if((key==="ArrowDown"||key==="s")&&slide<=0&&!jumpActive){slide=0.72;audio.slide();}
 if((key==="p"||key==="Escape")&&!dead&&assetsReady){paused=!paused;pauseButton.textContent=paused?"▶":"Ⅱ";if(!dead){statusEl.hidden=!paused;if(paused)statusEl.textContent="DURAKLATILDI · P İLE DEVAM";else{restartButton.hidden=true;audio.start();}}}
 if(dead&&(key==="r"||key===" ")){restartButton.hidden=true;restartButton.textContent="YENİDEN OYNA";dead=false;paused=false;pauseButton.textContent="Ⅱ";distance=0;coins=0;lane=0;laneVisual=0;slide=0;jumpActive=false;jumpElapsed=0;hazards.reset();statusEl.hidden=true;audio.start();}
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
let shadowRecoverySeconds=0;
function frame(){
 requestAnimationFrame(frame);
 const dt=Math.min(clock.getDelta(),0.05);
 frameCount++;
 frameSeconds+=dt;
 qualityCooldown=Math.max(0,qualityCooldown-dt);
 if(frameSeconds>=3){
  const fps=frameCount/frameSeconds;
  const pixelRatio=renderer.getPixelRatio();
  // Hysteresis prevents rapid shadow toggling on integrated GPUs. Restore shadows
  // after sustained recovery instead of leaving them permanently disabled.
  if (fps < 29) {
    shadowRecoverySeconds = 0;
    if (renderer.shadowMap.enabled) {
      renderer.shadowMap.enabled = false;
      renderer.shadowMap.needsUpdate = true;
    }
  } else if (!renderer.shadowMap.enabled) {
    shadowRecoverySeconds = fps >= 54 ? shadowRecoverySeconds + frameSeconds : 0;
    if (shadowRecoverySeconds >= 12) {
      renderer.shadowMap.enabled = true;
      renderer.shadowMap.needsUpdate = true;
      shadowRecoverySeconds = 0;
      qualityCooldown = 8;
    }
  }
  if(qualityCooldown===0&&fps<38&&pixelRatio>0.85){renderer.setPixelRatio(Math.max(0.85,pixelRatio-0.2));resize();qualityCooldown=8;}
  else if(qualityCooldown===0&&fps>58&&pixelRatio<Math.min(devicePixelRatio,1.25)){renderer.setPixelRatio(Math.min(Math.min(devicePixelRatio,1.25),pixelRatio+0.1));resize();qualityCooldown=8;}
  frameCount=0;frameSeconds=0;
 }
 if(!paused&&!dead){
  const speed=runnerSpeed(distance);
  distance+=dt*speed;
  updateWorld(distance);
  updateStreet(distance);
  const previousLaneVisual=laneVisual;
  laneVisual=THREE.MathUtils.damp(laneVisual,lane*laneWidth,13,dt);
  if(jumpActive){jumpElapsed=Math.min(jumpDuration,jumpElapsed+dt);if(jumpElapsed>=jumpDuration){jumpActive=false;}}
  const jumpHeight=jumpActive?jumpArc(jumpElapsed,jumpDuration):0;
  const pose = jumpActive ? "jump" : slide > 0 ? "slide" : "run";
  animateRunner(dt, pose, speed);
  if(slide>0)slide=Math.max(0,slide-dt);
  playerRoot.position.set(laneVisual,jumpHeight,0);
  playerShadow.position.x=laneVisual;
  playerShadow.scale.setScalar(1+jumpHeight*0.16);
  (playerShadow.material as THREE.MeshBasicMaterial).opacity=0.85-jumpHeight*0.25;
  playerRoot.scale.y=1; // Articulated slide pose controls height instead of scaling the whole avatar.
  camera.position.x=THREE.MathUtils.damp(camera.position.x,laneVisual*0.16,2.8,dt);
  camera.lookAt(camera.position.x*0.25,1.25,-16);
  const collision = hazards.update(dt, distance, speed, previousLaneVisual, laneVisual, playerRoot.position.y, slide > 0);
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
 updateSky(clock.elapsedTime,camera);
 renderer.render(scene,camera);
}
frame();
