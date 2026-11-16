# Rewild

Stylized 3D restoration survival game prototype, powered by Babylon.js, TypeScript and Vite.

## Quick start

Requires Node.js 20.19+ or 22.12+.

```bash
npm install
npm run dev
```

Open the local URL printed by Vite. Run `npm run build` to type-check and bundle.

Phase 2 adds a simple capsule-based third-person character with camera-relative WASD/arrow-key movement, Shift sprint, Space jump, mouse-orbit camera and zoom. This is a prototype controller: no character animations, physics-engine collisions with buildings, inventory or construction yet.

## Phase 3 environment

The initial primitive environment has been replaced with a deterministic woodland scene: tiered pines (thin instancing), meadow patches, a winding footpath, wildflowers, rocks, a weathered cottage and distant ruins. The playable ground remains flat at y=0 to preserve the Phase 2 controller. Terrain height variation, collision with buildings, lighting polish and detailed art assets are future work.

Run `npm run build` to validate TypeScript and Vite before playing. Visuals are procedural prototypes, not final production art.
