import * as THREE from "three";
import { avoidsObstacle, crossesPlayer } from "./rules";

export type HazardKind = "coin" | "barrier" | "gate" | "vehicle";
export interface Hazard {
  root: THREE.Group;
  lane: number;
  z: number;
  kind: HazardKind;
  active: boolean;
}
const paint = (color: number, metalness = 0) => new THREE.MeshStandardMaterial({ color, metalness, roughness: metalness ? 0.38 : 0.72 });
const yellow = paint(0xffd44b, 0.7);
const amber = paint(0xf6a52d);
const orange = paint(0xf06c45);
const white = paint(0xfff3d9);
const dark = paint(0x29384c);
const steel = paint(0x76869b, 0.4);
const windowMat = new THREE.MeshStandardMaterial({ color: 0x83c6dc, metalness: 0.25, roughness: 0.24 });
const rubber = paint(0x202632);
const poleGeo = new THREE.CylinderGeometry(0.075, 0.075, 1, 10);
const panelGeo = new THREE.BoxGeometry(1, 1, 0.12);
const wheelGeo = new THREE.TorusGeometry(0.36, 0.12, 8, 16);
const coinGeo = new THREE.TorusGeometry(0.38, 0.12, 10, 22);
const coinCoreGeo = new THREE.CylinderGeometry(0.31, 0.31, 0.06, 22);
const vanProfile = new THREE.Shape();
vanProfile.moveTo(-0.88,0);
vanProfile.lineTo(0.88,0);
vanProfile.lineTo(0.88,0.83);
vanProfile.quadraticCurveTo(0.85,1.18,0.52,1.22);
vanProfile.lineTo(-0.52,1.22);
vanProfile.quadraticCurveTo(-0.85,1.18,-0.88,0.83);
vanProfile.closePath();
const vanGeo = new THREE.ExtrudeGeometry(vanProfile,{
  depth:1.95,steps:1,bevelEnabled:true,bevelThickness:0.07,bevelSize:0.07,bevelSegments:2,curveSegments:8
});
const cabinProfile = new THREE.Shape();
cabinProfile.moveTo(-0.7,0);
cabinProfile.lineTo(0.7,0);
cabinProfile.quadraticCurveTo(0.63,0.73,0.35,0.83);
cabinProfile.lineTo(-0.35,0.83);
cabinProfile.quadraticCurveTo(-0.63,0.73,-0.7,0);
cabinProfile.closePath();
const cabinGeo = new THREE.ExtrudeGeometry(cabinProfile,{
  depth:1.05,steps:1,bevelEnabled:true,bevelThickness:0.05,bevelSize:0.05,bevelSegments:2
});

function mesh(parent: THREE.Group, geo: THREE.BufferGeometry, mat: THREE.Material,
 x = 0, y = 0, z = 0): THREE.Mesh {
  const m = new THREE.Mesh(geo, mat);
  m.position.set(x, y, z);
  m.castShadow = true;
  m.receiveShadow = true;
  parent.add(m);
  return m;
}
function bar(parent: THREE.Group, mat: THREE.Material, x: number, y: number, z: number,
 w: number, h: number, d: number): THREE.Mesh {
  const m = mesh(parent, panelGeo, mat, x, y, z);
  m.scale.set(w, h, d / 0.12);
  return m;
}
function createVisual(kind: HazardKind): THREE.Group {
  const g = new THREE.Group();
  if (kind === "coin") {
    mesh(g, coinGeo, yellow, 0, 1.2);
    const core = mesh(g, coinCoreGeo, amber, 0, 1.2);
    core.rotation.x = Math.PI / 2;
    mesh(g, new THREE.OctahedronGeometry(0.13), white, 0, 1.2, 0.08);
  } else if (kind === "barrier") {
    // Roadwork barrier with rounded supports, feet and diagonal hazard stripes.
    for (const x of [-0.72, 0.72]) {
      const post = mesh(g, poleGeo, steel, x, 0.52);
      post.scale.set(1.5, 1.05, 1.5);
      bar(g, dark, x, 0.08, 0, 0.43, 0.16, 0.68);
    }
    bar(g, orange, 0, 0.77, 0, 1.75, 0.52, 0.2);
    for (let i = 0; i < 5; i++) {
      const stripe = bar(g, white, -0.7 + i * 0.35, 0.77, 0.125, 0.13, 0.5, 0.04);
      stripe.rotation.z = -0.4;
    }
  } else if (kind === "gate") {
    // Overhead sign: sliding underneath is the intended action.
    for (const x of [-0.98, 0.98]) {
      const post = mesh(g, poleGeo, steel, x, 1.25);
      post.scale.set(1.35, 2.5, 1.35);
    }
    bar(g, dark, 0, 2.12, 0, 2.25, 0.76, 0.22);
    bar(g, amber, 0, 2.12, 0.14, 1.93, 0.48, 0.07);
    for (const x of [-0.63, 0, 0.63]) {
      const arrow = mesh(g, new THREE.ConeGeometry(0.16, 0.25, 3), dark, x, 2.1, 0.21);
      arrow.rotation.z = Math.PI;
    }
  } else {
    // Stylized city delivery van with curved cabin, grille, lamps and wheels.
    mesh(g, vanGeo, orange, 0, 0.35, -0.97);
    mesh(g, cabinGeo, white, 0, 1.35, -0.68);
    bar(g, windowMat, 0, 1.72, -0.78, 1.03, 0.55, 0.08);
    bar(g, steel, 0, 1.35, -0.77, 1.22, 0.09, 0.1);
    for (const x of [-0.85, 0.85]) for (const z of [-0.65, 0.65]) {
      const wheel = mesh(g, wheelGeo, rubber, x, 0.4, z);
      wheel.rotation.y = Math.PI / 2;
    }
    for (const x of [-0.55, 0.55]) {
      mesh(g, new THREE.SphereGeometry(0.13, 10, 8), yellow, x, 0.9, 0.98);
    }
    bar(g, dark, 0, 0.7, 1, 0.85, 0.22, 0.08);
  }
  return g;
}

export class HazardSystem {
  private readonly active: Hazard[] = [];
  private readonly pool = new Map<HazardKind, Hazard[]>();
  private nextSpawn = 25;
  private readonly spawnZ = -92;
  private readonly laneWidth = 2.9;
  constructor(private readonly scene: THREE.Scene) {}

  private acquire(kind: HazardKind, lane: number, z: number): void {
    const stored = this.pool.get(kind);
    const item = stored?.pop() ?? { root: createVisual(kind), lane, z, kind, active: false };
    item.lane = lane;
    item.z = z;
    item.active = true;
    item.root.position.set(lane * this.laneWidth, 0, z);
    item.root.visible = true;
    if (!item.root.parent) this.scene.add(item.root);
    this.active.push(item);
  }
  private release(index: number): void {
    const [item] = this.active.splice(index, 1);
    item.active = false;
    item.root.visible = false;
    const stored = this.pool.get(item.kind) ?? [];
    stored.push(item);
    this.pool.set(item.kind, stored);
  }
  reset(): void {
    for (let i = this.active.length - 1; i >= 0; i--) this.release(i);
    this.nextSpawn = 25;
  }
  update(dt: number, distance: number, speed: number, playerLane: number, jumpHeight: number, sliding: boolean):
    { coins: number; crashed: boolean } {
    if (distance >= this.nextSpawn) {
      const lane = Math.floor(Math.random() * 3) - 1;
      const pattern = Math.floor(Math.random() * 5);
      if (pattern === 0) {
        for (let i = 0; i < 4; i++) this.acquire("coin", lane, this.spawnZ - i * 3.8);
      } else if (pattern === 1 && distance > 120) {
        const safe = Math.floor(Math.random() * 3) - 1;
        for (let l = -1; l <= 1; l++) if (l !== safe) this.acquire("vehicle", l, this.spawnZ);
        this.acquire("coin", safe, this.spawnZ - 6);
      } else {
        this.acquire(pattern === 2 ? "barrier" : pattern === 3 ? "gate" : "vehicle", lane, this.spawnZ);
      }
      this.nextSpawn = distance + 22 + Math.random() * 10;
    }
    let coins = 0;
    let crashed = false;
    for (let i = this.active.length - 1; i >= 0; i--) {
      const item = this.active[i];
      const oldZ = item.z;
      item.z += dt * speed;
      item.root.position.z = item.z;
      if (item.kind === "coin") item.root.rotation.y += dt * 3.2;
      // Swept collision prevents tunnelling when a frame takes longer than expected.
      if (crossesPlayer(oldZ,item.z) && item.lane === playerLane) {
        if (item.kind === "coin") {
          coins++;
          this.release(i);
          continue;
        }
        const safe = avoidsObstacle(item.kind,jumpHeight,sliding);
        if (!safe) crashed = true;
        this.release(i);
        if (crashed) break;
        continue;
      }
      if (item.z > 14) this.release(i);
    }
    return { coins, crashed };
  }
}
