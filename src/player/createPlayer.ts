import { ArcRotateCamera } from "@babylonjs/core/Cameras/arcRotateCamera";
import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import { MeshBuilder } from "@babylonjs/core/Meshes/meshBuilder";
import { StandardMaterial } from "@babylonjs/core/Materials/standardMaterial";
import { Color3 } from "@babylonjs/core/Maths/math.color";
import { TransformNode } from "@babylonjs/core/Meshes/transformNode";
import type { Scene } from "@babylonjs/core/scene";
import { resolveMovement } from "../world/collision";
import type { Footprint } from "../world/collision";

export function createPlayer(scene: Scene, camera: ArcRotateCamera, obstacles: readonly Footprint[]): void {
  const root = new TransformNode("player-root", scene);
  root.position.set(0, 0, 9);
  const outfit = new StandardMaterial("outfit", scene);
  outfit.diffuseColor = new Color3(0.19, 0.36, 0.42);
  const skin = new StandardMaterial("skin", scene);
  skin.diffuseColor = new Color3(0.77, 0.56, 0.39);
  const body = MeshBuilder.CreateCapsule("player-body", { height: 1.65, radius: 0.37, tessellation: 10 }, scene);
  body.parent = root;
  body.position.y = 1.05;
  body.material = outfit;
  const head = MeshBuilder.CreateSphere("player-head", { diameter: 0.55, segments: 10 }, scene);
  head.parent = root;
  head.position.y = 2.08;
  head.material = skin;
  camera.lockedTarget = root;
  camera.radius = 12;
  camera.lowerRadiusLimit = 5;
  camera.upperRadiusLimit = 22;
  camera.lowerBetaLimit = 0.3;
  camera.upperBetaLimit = 1.45;
  camera.panningSensibility = 0;

  const keys = new Set<string>();
  const controlled = new Set(["KeyW", "KeyA", "KeyS", "KeyD", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "Space", "ShiftLeft", "ShiftRight"]);
  const onDown = (event: KeyboardEvent) => {
    if (controlled.has(event.code)) event.preventDefault();
    keys.add(event.code);
  };
  const onUp = (event: KeyboardEvent) => keys.delete(event.code);
  const onBlur = () => keys.clear();
  window.addEventListener("keydown", onDown);
  window.addEventListener("keyup", onUp);
  window.addEventListener("blur", onBlur);

  let verticalVelocity = 0;
  let grounded = true;
  scene.onBeforeRenderObservable.add(() => {
    const dt = Math.min(scene.getEngine().getDeltaTime() / 1000, 0.05);
    const forwardInput = Number(keys.has("KeyW") || keys.has("ArrowUp")) - Number(keys.has("KeyS") || keys.has("ArrowDown"));
    const rightInput = Number(keys.has("KeyD") || keys.has("ArrowRight")) - Number(keys.has("KeyA") || keys.has("ArrowLeft"));
    const input = new Vector3(rightInput, 0, forwardInput);
    if (input.lengthSquared() > 0) {
      input.normalize();
      const forward = new Vector3(-Math.cos(camera.alpha), 0, -Math.sin(camera.alpha));
      const right = new Vector3(forward.z, 0, -forward.x);
      const direction = forward.scale(input.z).add(right.scale(input.x)).normalize();
      const speed = keys.has("ShiftLeft") || keys.has("ShiftRight") ? 8 : 4.5;
      const step = direction.scale(speed * dt);
      const next = resolveMovement(root.position.x, root.position.z, step.x, step.z, obstacles);
      root.position.x = next.x;
      root.position.z = next.z;
      root.rotation.y = Math.atan2(direction.x, direction.z);
    }
    // Ground plane is y=0. Phase 2 uses simple gravity, not a full physics engine.
    if (grounded && keys.has("Space")) {
      verticalVelocity = 7;
      grounded = false;
    }
    if (!grounded) {
      verticalVelocity -= 19 * dt;
      root.position.y += verticalVelocity * dt;
      if (root.position.y <= 0) {
        root.position.y = 0;
        verticalVelocity = 0;
        grounded = true;
      }
    }
    root.position.x = Math.max(-68, Math.min(68, root.position.x));
    root.position.z = Math.max(-68, Math.min(68, root.position.z));
  });
  scene.onDisposeObservable.add(() => {
    window.removeEventListener("keydown", onDown);
    window.removeEventListener("keyup", onUp);
    window.removeEventListener("blur", onBlur);
  });
}
