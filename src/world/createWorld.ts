import { ArcRotateCamera } from "@babylonjs/core/Cameras/arcRotateCamera";
import { Color3, Color4 } from "@babylonjs/core/Maths/math.color";
import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import { HemisphericLight } from "@babylonjs/core/Lights/hemisphericLight";
import { DirectionalLight } from "@babylonjs/core/Lights/directionalLight";
import { MeshBuilder } from "@babylonjs/core/Meshes/meshBuilder";
import { StandardMaterial } from "@babylonjs/core/Materials/standardMaterial";
import { Scene } from "@babylonjs/core/scene";
import type { Engine } from "@babylonjs/core/Engines/engine";

export function createWorld(engine: Engine, canvas: HTMLCanvasElement): Scene {
  const scene = new Scene(engine);
  scene.clearColor = new Color4(0.72, 0.84, 0.83, 1);
  scene.fogMode = Scene.FOGMODE_EXP2;
  scene.fogDensity = 0.007;
  scene.fogColor = new Color3(0.72, 0.84, 0.83);

  const camera = new ArcRotateCamera("orbit", -Math.PI / 2.5, Math.PI / 3.1, 35, new Vector3(0, 2, 0), scene);
  camera.attachControl(canvas, true);
  camera.lowerRadiusLimit = 10;
  camera.upperRadiusLimit = 65;
  camera.wheelPrecision = 45;

  const ambient = new HemisphericLight("ambient", new Vector3(0, 1, 0), scene);
  ambient.intensity = 0.85;
  const sun = new DirectionalLight("sun", new Vector3(-0.6, -1, 0.4), scene);
  sun.intensity = 1.25;

  const ground = MeshBuilder.CreateGround("meadow", { width: 140, height: 140 }, scene);
  const grass = new StandardMaterial("grass", scene);
  grass.diffuseColor = new Color3(0.32, 0.52, 0.33);
  ground.material = grass;

  const trunkMat = new StandardMaterial("bark", scene);
  trunkMat.diffuseColor = new Color3(0.34, 0.24, 0.18);
  const leafMat = new StandardMaterial("foliage", scene);
  leafMat.diffuseColor = new Color3(0.19, 0.39, 0.27);
  const stoneMat = new StandardMaterial("stone", scene);
  stoneMat.diffuseColor = new Color3(0.46, 0.49, 0.44);

  // Deterministic placement: stable scene across reloads, no external assets.
  for (let i = 0; i < 48; i++) {
    const angle = i * 2.399963229728653;
    const radius = 12 + Math.sqrt(i / 48) * 52;
    const x = Math.cos(angle) * radius;
    const z = Math.sin(angle) * radius;
    const trunk = MeshBuilder.CreateCylinder(`trunk-${i}`, { height: 3.4, diameter: 0.65, tessellation: 7 }, scene);
    trunk.position.set(x, 1.7, z);
    trunk.material = trunkMat;
    const crown = MeshBuilder.CreateSphere(`crown-${i}`, { diameter: 4.5, segments: 7 }, scene);
    crown.scaling.y = 1.2;
    crown.position.set(x, 4.6, z);
    crown.material = leafMat;
  }
  for (let i = 0; i < 16; i++) {
    const angle = i * 2.4;
    const radius = 8 + i * 2.6;
    const rock = MeshBuilder.CreateSphere(`rock-${i}`, { diameter: 1.4, segments: 6 }, scene);
    rock.scaling.set(1.5, 0.55, 1.0);
    rock.position.set(Math.cos(angle) * radius, 0.35, Math.sin(angle) * radius);
    rock.material = stoneMat;
  }

  const walls = new StandardMaterial("cabin-walls", scene);
  walls.diffuseColor = new Color3(0.56, 0.39, 0.27);
  const roofMat = new StandardMaterial("cabin-roof", scene);
  roofMat.diffuseColor = new Color3(0.33, 0.34, 0.31);
  const cabin = MeshBuilder.CreateBox("abandoned-cabin", { width: 6, height: 3.5, depth: 5 }, scene);
  cabin.position.set(0, 1.75, 0);
  cabin.material = walls;
  const roof = MeshBuilder.CreateCylinder("roof", { diameter: 7.6, height: 5.7, tessellation: 3 }, scene);
  roof.rotation.z = Math.PI / 2;
  roof.rotation.y = Math.PI / 2;
  roof.position.set(0, 4.2, 0);
  roof.material = roofMat;
  return scene;
}
