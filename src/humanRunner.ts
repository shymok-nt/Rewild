import * as THREE from "three";

/** Original, lightweight articulated city runner. No downloaded meshes or external textures. */
export type RunnerPose = "run" | "jump" | "slide";
export function createHumanRunner(): {
  root: THREE.Group;
  update: (dt: number, pose: RunnerPose, speed: number) => void;
} {
  const root = new THREE.Group();
  const torso = new THREE.Group();
  root.add(torso);
  const skin = new THREE.MeshStandardMaterial({ color: 0xc98563, roughness: 0.88 });
  const hair = new THREE.MeshStandardMaterial({ color: 0x24263c, roughness: 0.9 });
  const jacket = new THREE.MeshStandardMaterial({ color: 0x21a6a2, roughness: 0.78 });
  const jacketLight = new THREE.MeshStandardMaterial({ color: 0x53d6bf, roughness: 0.76 });
  const pants = new THREE.MeshStandardMaterial({ color: 0x263655, roughness: 0.9 });
  const shoes = new THREE.MeshStandardMaterial({ color: 0xffbd54, roughness: 0.72 });
  const trim = new THREE.MeshStandardMaterial({ color: 0xf9f0db, roughness: 0.85 });
  const sphere = new THREE.SphereGeometry(1, 12, 10);
  const box = new THREE.BoxGeometry(1, 1, 1);
  function part(parent: THREE.Object3D, geometry: THREE.BufferGeometry, material: THREE.Material,
    x: number, y: number, z: number, sx: number, sy: number, sz: number): THREE.Mesh {
    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.set(x, y, z);
    mesh.scale.set(sx, sy, sz);
    mesh.castShadow = true;
    parent.add(mesh);
    return mesh;
  }
  // Torso pivots at hip level, limbs at shoulders/hips. Character faces -Z.
  torso.position.y = 1.08;
  part(torso, box, jacket, 0, 0.39, 0, 0.71, 0.83, 0.39);
  part(torso, box, jacketLight, 0, 0.42, -0.209, 0.52, 0.53, 0.045);
  part(torso, box, trim, 0, 0.19, -0.242, 0.47, 0.07, 0.02);
  part(torso, sphere, skin, 0, 1.06, -0.015, 0.245, 0.285, 0.24);
  part(torso, sphere, hair, 0, 1.225, 0.03, 0.25, 0.135, 0.245);
  part(torso, box, hair, 0, 1.17, -0.205, 0.29, 0.065, 0.13);
  part(torso, box, pants, 0, -0.07, 0, 0.65, 0.25, 0.38);
  // Small backpack with contrasting strap.
  part(torso, box, shoes, 0, 0.37, 0.26, 0.49, 0.61, 0.21);
  for (const side of [-1, 1]) {
    part(torso, box, trim, side * 0.26, 0.43, -0.22, 0.065, 0.63, 0.025);
  }
  const arms: THREE.Group[] = [];
  const legs: THREE.Group[] = [];
  const knees: THREE.Group[] = [];
  for (const side of [-1, 1]) {
    const arm = new THREE.Group();
    arm.position.set(side * 0.44, 0.73, 0);
    torso.add(arm);
    part(arm, sphere, jacket, 0, -0.21, 0, 0.17, 0.34, 0.18);
    part(arm, sphere, skin, 0, -0.55, 0, 0.13, 0.17, 0.13);
    arms.push(arm);
    const leg = new THREE.Group();
    leg.position.set(side * 0.2, 0, 0);
    torso.add(leg);
    part(leg, sphere, pants, 0, -0.28, 0, 0.19, 0.35, 0.21);
    const knee = new THREE.Group();
    knee.position.y = -0.52;
    leg.add(knee);
    part(knee, sphere, pants, 0, -0.23, 0, 0.16, 0.31, 0.17);
    part(knee, box, shoes, 0, -0.48, -0.105, 0.24, 0.17, 0.42);
    legs.push(leg);
    knees.push(knee);
  }
  let phase = 0;
  let crouch = 0;
  return {
    root,
    update(dt, pose, speed) {
      phase += dt * Math.max(8, speed * 0.72);
      const blend = 1 - Math.exp(-dt * 14);
      const targetCrouch = pose === "slide" ? 1 : 0;
      crouch += (targetCrouch - crouch) * blend;
      const stride = Math.sin(phase);
      const running = pose === "run";
      const jumping = pose === "jump";
      torso.position.y = 1.08 - crouch * 0.48 + (running ? Math.abs(stride) * 0.065 : 0);
      torso.rotation.x = 0.08 + crouch * 0.55 + (jumping ? -0.1 : 0);
      torso.rotation.z = running ? Math.sin(phase * 0.5) * 0.035 : 0;
      for (let i = 0; i < 2; i++) {
        const sign = i === 0 ? 1 : -1;
        const armTarget = running ? sign * stride * 0.65 : jumping ? -0.55 : -0.85;
        arms[i].rotation.x += (armTarget - arms[i].rotation.x) * blend;
        arms[i].rotation.z = sign * (crouch * 0.25 + 0.08);
        const legTarget = running ? -sign * stride * 0.68 : jumping ? 0.38 : -1.1;
        legs[i].rotation.x += (legTarget - legs[i].rotation.x) * blend;
        const kneeTarget = running ? Math.max(0, sign * stride) * 0.95 : jumping ? 0.75 : 1.75;
        knees[i].rotation.x += (kneeTarget - knees[i].rotation.x) * blend;
      }
    }
  };
}
