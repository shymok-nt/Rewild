import { ArcRotateCamera } from "@babylonjs/core/Cameras/arcRotateCamera";
import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import { TransformNode } from "@babylonjs/core/Meshes/transformNode";
import type { Scene } from "@babylonjs/core/scene";
import { resolveMovement } from "../world/collision";
import type { Footprint } from "../world/collision";
import { createExplorer } from "./createExplorer";
import { loadSurvivor } from "./loadSurvivor";

export interface PlayerController {
  root: TransformNode;
  harvest(): void;
  isHarvesting(): boolean;
}

export function createPlayer(scene: Scene, camera: ArcRotateCamera, obstacles: readonly Footprint[]): PlayerController {
  const root = new TransformNode("player-root", scene);
  root.position.set(0, 0, 9);
  const fallback = createExplorer(scene, root);
  let model: Awaited<ReturnType<typeof loadSurvivor>> | null = null;
  void loadSurvivor(scene, root).then(loaded => {
    if (scene.isDisposed) { loaded.dispose(); return; }
    model = loaded;
    fallback.setVisible(false);
    // First-person view: do not render the full-body survivor over the camera.
    for (const mesh of loaded.rightHand?.getScene().meshes ?? []) {
      if (mesh.isDescendantOf(root)) mesh.isVisible = false;
    }
  }).catch(error => {
    console.warn("Survivor GLB unavailable; using built-in explorer.", error);
  });
  // Keep zoom focused on the character's torso rather than their feet.
  const cameraFocus = new TransformNode("player-camera-focus", scene);
  cameraFocus.parent = root;
  cameraFocus.position.y = 1.68;
  camera.lockedTarget = cameraFocus;
  camera.radius = 0.06;
  camera.lowerRadiusLimit = 0.06;
  camera.upperRadiusLimit = 0.06;
  camera.lowerBetaLimit = 0.12;
  camera.upperBetaLimit = Math.PI - 0.12;
  camera.panningSensibility = 0;
  // Click the canvas once to capture the pointer; Esc releases it.
  camera.inputs.removeByType("ArcRotateCameraPointersInput");
  const canvas = scene.getEngine().getRenderingCanvas();
  const onCanvasClick = () => {
    if (canvas && document.pointerLockElement !== canvas) {
      void canvas.requestPointerLock();
    }
  };
  const onMouseMove = (event: MouseEvent) => {
    if (!canvas || document.pointerLockElement !== canvas) return;
    camera.alpha -= event.movementX * 0.003;
    camera.beta -= event.movementY * 0.003;
    camera.beta = Math.max(camera.lowerBetaLimit ?? 0.3, Math.min(camera.upperBetaLimit ?? 1.45, camera.beta));
  };
  canvas?.addEventListener("click", onCanvasClick);
  document.addEventListener("mousemove", onMouseMove);

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

  let harvestUntil = 0;
  let verticalVelocity = 0;
  let grounded = true;
  scene.onBeforeRenderObservable.add(() => {
    const dt = Math.min(scene.getEngine().getDeltaTime() / 1000, 0.05);
    const forwardInput = Number(keys.has("KeyW") || keys.has("ArrowUp")) - Number(keys.has("KeyS") || keys.has("ArrowDown"));
    const rightInput = Number(keys.has("KeyD") || keys.has("ArrowRight")) - Number(keys.has("KeyA") || keys.has("ArrowLeft"));
    const input = new Vector3(rightInput, 0, forwardInput);
    const moving = input.lengthSquared() > 0;
    const sprinting = keys.has("ShiftLeft") || keys.has("ShiftRight");
    if (moving) {
      input.normalize();
      const forward = new Vector3(-Math.cos(camera.alpha), 0, -Math.sin(camera.alpha));
      const right = new Vector3(forward.z, 0, -forward.x);
      const direction = forward.scale(input.z).add(right.scale(input.x)).normalize();
      const speed = sprinting ? 8 : 4.5;
      const step = direction.scale(speed * dt);
      const next = resolveMovement(root.position.x, root.position.z, step.x, step.z, obstacles);
      root.position.x = next.x;
      root.position.z = next.z;

    }
    // Face the camera heading, including while strafing or standing still.
    root.rotation.y = -camera.alpha - Math.PI / 2;
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
    (model ?? fallback).update(dt, moving, sprinting, !grounded, performance.now() < harvestUntil);
    root.position.x = Math.max(-68, Math.min(68, root.position.x));
    root.position.z = Math.max(-68, Math.min(68, root.position.z));
  });
  scene.onDisposeObservable.add(() => {
    window.removeEventListener("keydown", onDown);
    window.removeEventListener("keyup", onUp);
    window.removeEventListener("blur", onBlur);
    canvas?.removeEventListener("click", onCanvasClick);
    document.removeEventListener("mousemove", onMouseMove);
    if (canvas && document.pointerLockElement === canvas) document.exitPointerLock();
    model?.dispose();
  });
  return { root, harvest: () => { harvestUntil = performance.now() + 550; }, isHarvesting: () => performance.now() < harvestUntil, getRightHand: () => model?.rightHand ?? null };
}
