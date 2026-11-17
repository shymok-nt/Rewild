import * as THREE from "three";

/** Recycled city blocks with window trim, awnings and trees.
 * All materials and geometry are shared; no per-frame allocations. */
export function createCity(scene: THREE.Scene): (distance: number) => void {
  const palette = [0xe9a57e, 0x8caec8, 0xe8c6a0, 0xb9b1d6, 0x91b5a5];
  const facades = palette.map(color => new THREE.MeshStandardMaterial({ color, roughness: 0.88 }));
  const trim = new THREE.MeshStandardMaterial({ color: 0xf7e9d7, roughness: 0.85 });
  const glass = new THREE.MeshStandardMaterial({ color: 0x425d7c, metalness: 0.18, roughness: 0.35 });
  const roof = new THREE.MeshStandardMaterial({ color: 0x5b637d, roughness: 0.9 });
  const leaves = new THREE.MeshStandardMaterial({ color: 0x4c987a, roughness: 0.95 });
  const trunk = new THREE.MeshStandardMaterial({ color: 0x88654e, roughness: 1 });
  const blocks: THREE.Group[] = [];
  const box = new THREE.BoxGeometry(1, 1, 1);
  const sphere = new THREE.IcosahedronGeometry(1, 1);
  function block(parent: THREE.Group, material: THREE.Material, x: number, y: number, z: number, w: number, h: number, d: number): void {
    const mesh = new THREE.Mesh(box, material);
    mesh.position.set(x, y, z);
    mesh.scale.set(w, h, d);
    mesh.receiveShadow = true;
    parent.add(mesh);
  }
  for (let i = 0; i < 24; i++) {
    const group = new THREE.Group();
    const side = i % 2 ? 1 : -1;
    const depthIndex = Math.floor(i / 2);
    const height = 7 + ((depthIndex * 7 + i * 3) % 7) * 1.2;
    const width = 5 + (i % 3) * 0.7;
    const x = side * (9.5 + width * 0.5);
    const facade = facades[(i * 3) % facades.length];
    block(group, facade, x, height * 0.5, 0, width, height, 8);
    block(group, roof, x, height + 0.18, 0, width + 0.45, 0.36, 8.45);
    // Three instanced layers replace hundreds of individual window draw calls.
    const frontX = x - side * (width * 0.5 + 0.035);
    const floorCount = Math.max(0, Math.floor(height / 2.3) - 1);
    const windowCount = floorCount * 3;
    if (windowCount > 0) {
      const frameBatch = new THREE.InstancedMesh(box, trim, windowCount);
      const glassBatch = new THREE.InstancedMesh(box, glass, windowCount);
      const sillBatch = new THREE.InstancedMesh(box, trim, windowCount);
      const matrix = new THREE.Matrix4();
      const pos = new THREE.Vector3();
      const scale = new THREE.Vector3();
      const rotation = new THREE.Quaternion();
      const set = (batch: THREE.InstancedMesh, index: number, px: number, py: number, pz: number,
        w: number, h: number, d: number) => {
        pos.set(px, py, pz);
        scale.set(w, h, d);
        matrix.compose(pos, rotation, scale);
        batch.setMatrixAt(index, matrix);
      };
      let n = 0;
      for (let floor = 1; floor <= floorCount; floor++) {
        for (let col = -1; col <= 1; col++) {
          const z = col * 2.1;
          const y = floor * 2.2 + 0.55;
          set(frameBatch, n, frontX - side * 0.14, y, z, 0.14, 1.55, 1.45);
          set(glassBatch, n, frontX - side * 0.17, y, z, 0.15, 1.25, 1.15);
          set(sillBatch, n, frontX - side * 0.2, y - 0.72, z, 0.22, 0.16, 1.55);
          n++;
        }
      }
      for (const batch of [frameBatch, glassBatch, sillBatch]) {
        batch.instanceMatrix.needsUpdate = true;
        batch.receiveShadow = true;
        batch.computeBoundingSphere();
        group.add(batch);
      }
    }
    block(group, trim, frontX - side * 0.35, 2.3, 0, 0.65, 0.24, 4.5);
    block(group, roof, frontX - side * 0.35, 2.1, 0, 0.7, 0.16, 4.4);
    const tree = new THREE.Mesh(sphere, leaves);
    tree.position.set(side * 7.8, 3.6, 0);
    tree.scale.set(1.35, 1.8, 1.3);
    group.add(tree);
    block(group, trunk, side * 7.8, 1.35, 0, 0.38, 2.7, 0.38);
    group.position.z = 8 - depthIndex * 14;
    scene.add(group);
    blocks.push(group);
  }
  return (distance: number) => {
    const cycle = 12 * 14;
    for (let i = 0; i < blocks.length; i++) {
      const index = Math.floor(i / 2);
      blocks[i].position.z = 8 - ((index * 14 - distance % cycle + cycle) % cycle);
    }
  };
}
