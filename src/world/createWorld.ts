import { ArcRotateCamera } from "@babylonjs/core/Cameras/arcRotateCamera";
import { Color3, Color4 } from "@babylonjs/core/Maths/math.color";
import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import { HemisphericLight } from "@babylonjs/core/Lights/hemisphericLight";
import { DirectionalLight } from "@babylonjs/core/Lights/directionalLight";
import { Scene } from "@babylonjs/core/scene";
import type { Engine } from "@babylonjs/core/Engines/engine";
import { createPlayer } from "../player/createPlayer";
import { buildEnvironment } from "./buildEnvironment";
import { createGatheringSystem } from "../game/createGatheringSystem";

export function createWorld(engine: Engine, canvas: HTMLCanvasElement): Scene {
  const scene = new Scene(engine);
  scene.clearColor = new Color4(0.70, 0.80, 0.76, 1);
  scene.fogMode = Scene.FOGMODE_EXP2;
  scene.fogDensity = 0.008;
  scene.fogColor = new Color3(0.70, 0.80, 0.76);

  const camera = new ArcRotateCamera("third-person", -Math.PI / 2.5, Math.PI / 3.1, 12, new Vector3(0, 2, 0), scene);
  camera.attachControl(canvas, true);
  camera.wheelPrecision = 45;

  const ambient = new HemisphericLight("skylight", new Vector3(0, 1, 0), scene);
  ambient.intensity = 0.62;
  ambient.groundColor = new Color3(0.35, 0.43, 0.35);
  const sun = new DirectionalLight("late-afternoon-sun", new Vector3(-0.6, -1, 0.4), scene);
  sun.intensity = 1.05;
  sun.diffuse = new Color3(1, 0.91, 0.76);

  const obstacles = buildEnvironment(scene);
  const player = createPlayer(scene, camera, obstacles);
  createGatheringSystem(scene, player);
  return scene;
}
