import { ArcRotateCamera } from "@babylonjs/core/Cameras/arcRotateCamera";
import { Color3, Color4 } from "@babylonjs/core/Maths/math.color";
import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import { HemisphericLight } from "@babylonjs/core/Lights/hemisphericLight";
import { DirectionalLight } from "@babylonjs/core/Lights/directionalLight";
import { ShadowGenerator } from "@babylonjs/core/Lights/Shadows/shadowGenerator";
import { PhotoDome } from "@babylonjs/core/Helpers/photoDome";
import { Scene } from "@babylonjs/core/scene";
import type { Engine } from "@babylonjs/core/Engines/engine";
import { createPlayer } from "../player/createPlayer";
import { buildEnvironment } from "./buildEnvironment";
import { createGatheringSystem } from "../game/createGatheringSystem";
import { installOakForest } from "./installOakForest";
import type { ForestTree } from "./installOakForest";
import { installRockModels } from "./installRockModels";
import { equipAxe } from "../player/equipAxe";
import { createGrassPrototype } from "./createGrassPrototype";

export function createWorld(engine: Engine, canvas: HTMLCanvasElement): Scene {
  const scene = new Scene(engine);
  scene.clearColor = new Color4(0.76, 0.83, 0.88, 1);
  scene.fogMode = Scene.FOGMODE_EXP2;
  scene.fogDensity = 0.004;
  scene.fogColor = new Color3(0.76, 0.83, 0.88);

  const camera = new ArcRotateCamera("third-person", -Math.PI / 2.5, Math.PI / 3.1, 12, new Vector3(0, 2, 0), scene);
  camera.attachControl(canvas, true);
  camera.wheelPrecision = 45;

  // DaySkyHDRI072B: clean equirectangular daytime sky panorama.
  // A lightweight JPG dome is used instead of importing Blender/USD/Godot files.
  // Unlike the previous rooftop panorama, this sky has no city foreground.
  const sky = new PhotoDome("day-environment-sky", "/models/DaySkyHDRI072B_1K_TONEMAPPED.jpg", {
    resolution: 32,
    size: 900,
    useDirectMapping: true,
  }, scene);
  sky.mesh.isPickable = false;

  const ambient = new HemisphericLight("skylight", new Vector3(0, 1, 0), scene);
  ambient.intensity = 0.72;
  ambient.groundColor = new Color3(0.39, 0.43, 0.38);
  const sun = new DirectionalLight("natural-daylight-sun", new Vector3(-0.45, -1, 0.35), scene);
  sun.intensity = 1.0;
  sun.diffuse = new Color3(1, 0.98, 0.94);
  sun.shadowMinZ = 1;
  sun.shadowMaxZ = 65;
  const shadows = new ShadowGenerator(1024, sun);
  shadows.usePercentageCloserFiltering = true;
  shadows.filteringQuality = ShadowGenerator.QUALITY_LOW;
  shadows.bias = 0.001;
  shadows.normalBias = 0.025;

  const forestTrees: ForestTree[] = [];
  const obstacles = buildEnvironment(scene, forestTrees);
  const ground = scene.getMeshByName("walkable-meadow");
  if (ground) ground.receiveShadows = true;
  createGrassPrototype(scene);
  const player = createPlayer(scene, camera, obstacles);
  const harvestNodes = createGatheringSystem(scene, player, obstacles);
  // Keep the shadow map inexpensive: only the nearby player and cabin,
  // not the full instanced forest, rocks or every blade of grass.
  const staticCasters = scene.meshes.filter(mesh =>
    mesh.name.startsWith("door-") || mesh.name.startsWith("window-") ||
    mesh.name.startsWith("roof-") || mesh.name.startsWith("chimney") ||
    mesh.name.startsWith("fence-")
  );
  for (const mesh of staticCasters) shadows.addShadowCaster(mesh);
  const registered = new Set(staticCasters);
  let shadowCheckElapsed = 0;
  scene.onBeforeRenderObservable.add(() => {
    shadowCheckElapsed += Math.min(engine.getDeltaTime(), 100);
    if (shadowCheckElapsed < 1000) return;
    shadowCheckElapsed = 0;
    for (const mesh of scene.meshes) {
      if (registered.has(mesh) || !mesh.isEnabled()) continue;
      if (!mesh.isDescendantOf(player.root)) continue;
      if (mesh.getTotalVertices() === 0) continue;
      shadows.addShadowCaster(mesh);
      registered.add(mesh);
    }
  });
  void equipAxe(scene, player.root, player.isHarvesting).catch(error => console.warn("Axe asset unavailable:", error));
  void installRockModels(scene, harvestNodes).catch(error => console.warn("Rock asset unavailable; keeping old rocks:", error));
  void installOakForest(scene, forestTrees, harvestNodes).catch(error => {
    console.warn("Oak model unavailable; keeping procedural forest.", error);
  });
  return scene;
}
