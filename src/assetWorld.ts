import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";

/** Loads pre-authored GLB geometry; Three.js is used only to render/recycle models. */
export async function loadWorldAssets(scene: THREE.Scene): Promise<(distance: number) => void> {
  const loader = new GLTFLoader();
  const [buildings, road] = await Promise.all([
    Promise.all(["hotel", "loja_esquina", "restaurante", "escritorio"].map(name => loader.loadAsync(`/assets/city-${name}.glb`))),
    loader.loadAsync("/assets/road-segment.glb")
  ]);
  const blocks: THREE.Object3D[] = [];
  // Extend the recycled city beyond the camera fog limit, so distant blocks fade
  // into haze before recycling instead of visibly disappearing at the horizon.
  const roads: THREE.Object3D[] = [];
  for (let i = 0; i < 36; i++) {
    const side = i % 2 === 0 ? -1 : 1;
    const model = buildings[Math.floor(i / 2) % buildings.length].scene.clone(true);
    model.position.set(side * 12.3, 0, 8 - Math.floor(i / 2) * 14);
    // Imported CC0 kit uses 2m grid lots; enlarge to match runner road width.
    model.rotation.y = side === -1 ? Math.PI / 2 : -Math.PI / 2;
    model.scale.setScalar(2.8 + (i % 4) * 0.12);
    model.traverse(o => { if (o instanceof THREE.Mesh) { o.castShadow = false; o.receiveShadow = true; } });
    scene.add(model);
    blocks.push(model);
  }
  for (let i = 0; i < 16; i++) {
    const model = road.scene.clone(true);
    model.position.z = 8 - i * 18;
    model.traverse(o => { if (o instanceof THREE.Mesh) o.receiveShadow = true; });
    scene.add(model);
    roads.push(model);
  }
  return distance => {
    const cityCycle = 18 * 14;
    for (let i = 0; i < blocks.length; i++) {
      const index = Math.floor(i / 2);
      blocks[i].position.z = 8 - ((index * 14 - distance % cityCycle + cityCycle) % cityCycle);
    }
    const roadCycle = roads.length * 18;
    for (let i = 0; i < roads.length; i++) {
      roads[i].position.z = 8 - ((i * 18 - distance % roadCycle + roadCycle) % roadCycle);
    }
  };
}
