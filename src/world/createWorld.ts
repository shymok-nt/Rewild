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
import { createDebugTools } from "../debug/createDebugTools";

export function createWorld(engine: Engine, canvas: HTMLCanvasElement): Scene {
  const scene = new Scene(engine);
  createDebugTools(scene, engine);
  scene.clearColor = new Color4(0.76, 0.83, 0.88, 1);
  scene.fogMode = Scene.FOGMODE_EXP2;
  scene.fogDensity = 0.004;
  scene.fogColor = new Color3(0.76, 0.83, 0.88);

  const camera = new ArcRotateCamera("first-person", -Math.PI / 2, Math.PI / 2, 0.06, new Vector3(0, 2, 0), scene);
  camera.attachControl(canvas, true);
  camera.inputs.removeByType("ArcRotateCameraMouseWheelInput");
  camera.minZ = 0.025;

  // DaySkyHDRI072B: clean equirectangular daytime sky panorama.
  // A lightweight JPG dome is used instead of importing Blender/USD/Godot files.
  // Unlike the previous rooftop panorama, this sky has no city foreground.
  const sky = new PhotoDome("day-environment-sky", "/models/DaySkyHDRI072B_1K_TONEMAPPED.jpg", {
    resolution: 32,
    size: 900,
    useDirectMapping: true,
  }, scene);
  sky.mesh.isPickable = false;
  // Distant sky must not receive scene fog: EXP2 fog washes the panorama
  // into a flat color at the dome radius.
  sky.mesh.applyFog = false;

  const ambient = new HemisphericLight("skylight", new Vector3(0, 1, 0), scene);
  ambient.intensity = 0.72;
  ambient.groundColor = new Color3(0.39, 0.43, 0.38);
  const sun = new DirectionalLight("natural-daylight-sun", new Vector3(-0.45, -1, 0.35), scene);
  sun.intensity = 1.0;
  sun.diffuse = new Color3(1, 0.98, 0.94);
  sun.shadowMinZ = 1;
  sun.shadowMaxZ = 75;
  // Stable, player-centered shadow projection; do not fit the whole 140m map.
  sun.autoUpdateExtends = false;
  sun.orthoLeft = -28;
  sun.orthoRight = 28;
  sun.orthoTop = 28;
  sun.orthoBottom = -28;
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
  const harvestNodes = createGatheringSystem(scene, player, obstacles, forestTrees);
  // Keep the shadow map inexpensive: only the nearby player and cabin,
  // not the full instanced forest, rocks or every blade of grass.
  const staticCasters = scene.meshes.filter(mesh =>
    mesh.name.startsWith("door-") || mesh.name.startsWith("window-") ||
    mesh.name.startsWith("roof-") || mesh.name.startsWith("chimney") ||
    mesh.name.startsWith("fence-")
  );
  // Cabin pieces far from the player would expand the shadow projection.
  // Register them only when nearby, alongside the oak instances.
  const registered = new Set<import("@babylonjs/core/Meshes/abstractMesh").AbstractMesh>();
  const nearbyStaticCasters = new Set<import("@babylonjs/core/Meshes/abstractMesh").AbstractMesh>();
  let shadowCheckElapsed = 0;
  // A small moving budget of oak instances casts real shadows near the player.
  // Avoid submitting the entire instanced forest to the 1024px shadow map.
  const nearbyOakCasters = new Set<import("@babylonjs/core/Meshes/abstractMesh").AbstractMesh>();
  const MAX_SHADOW_TREES = 4;
  const SHADOW_RADIUS_SQUARED = 22 * 22;
  scene.onBeforeRenderObservable.add(() => {
    // Update the light every frame to prevent the shadow map drifting behind.
    sun.position.set(player.root.position.x + 18, 34, player.root.position.z - 14);
    shadowCheckElapsed += Math.min(engine.getDeltaTime(), 100);
    if (shadowCheckElapsed < 1000) return;
    shadowCheckElapsed = 0;
    const px = player.root.position.x;
    const pz = player.root.position.z;
    sun.position.set(px + 18, 34, pz - 14);
    for (const mesh of staticCasters) {
      const position = mesh.getAbsolutePosition();
      const nearby = (position.x - px) ** 2 + (position.z - pz) ** 2 < 24 * 24;
      if (nearby && !nearbyStaticCasters.has(mesh)) {
        shadows.addShadowCaster(mesh, false);
        nearbyStaticCasters.add(mesh);
      } else if (!nearby && nearbyStaticCasters.has(mesh)) {
        shadows.removeShadowCaster(mesh);
        nearbyStaticCasters.delete(mesh);
      }
    }
    const closest = scene.transformNodes
      .filter(node => node.name === "oak-forest")
      .map(node => {
        const worldPosition = node.getAbsolutePosition();
        const dx = worldPosition.x - px;
        const dz = worldPosition.z - pz;
        return { node, distanceSquared: dx * dx + dz * dz };
      })
      .filter(item => item.distanceSquared < SHADOW_RADIUS_SQUARED)
      .sort((a, b) => a.distanceSquared - b.distanceSquared)
      .slice(0, MAX_SHADOW_TREES);
    const wanted = new Set<import("@babylonjs/core/Meshes/abstractMesh").AbstractMesh>();
    for (const { node } of closest) {
      for (const mesh of node.getChildMeshes(false)) {
        if (mesh.isEnabled() && mesh.getTotalVertices() > 0) wanted.add(mesh);
      }
    }
    for (const mesh of nearbyOakCasters) {
      if (wanted.has(mesh)) continue;
      shadows.removeShadowCaster(mesh);
      nearbyOakCasters.delete(mesh);
    }
    for (const mesh of wanted) {
      if (nearbyOakCasters.has(mesh)) continue;
      shadows.addShadowCaster(mesh, false);
      nearbyOakCasters.add(mesh);
    }
    for (const mesh of scene.meshes) {
      if (registered.has(mesh) || !mesh.isEnabled()) continue;
      if (!mesh.isDescendantOf(player.root)) continue;
      if (mesh.getTotalVertices() === 0) continue;
      shadows.addShadowCaster(mesh);
      registered.add(mesh);
    }
  });
  void equipAxe(scene, player.root, player.isHarvesting, player.getRightHand).catch(error => console.warn("Axe asset unavailable:", error));
  void installRockModels(scene, harvestNodes).catch(error => console.warn("Rock asset unavailable; keeping old rocks:", error));
  void installOakForest(scene, forestTrees, harvestNodes).catch(error => {
    console.warn("Oak model unavailable; keeping procedural forest.", error);
  });
  return scene;
}
