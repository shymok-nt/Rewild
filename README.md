# RUSH CITY

A browser-based 3D endless runner built with **Three.js, TypeScript and Vite**.

> **Development status:** This is an early playable 3D foundation, **not** a finished Subway Surfers-quality game. The current imported character is a temporary animated GLB and the environment is still being art-directed.

## Requirements

- Node.js 22 or newer
- A modern WebGL2-capable browser
- Hardware acceleration enabled

## Start on Windows

```powershell
git pull origin main
npm install
npm run dev
```

Open the localhost URL shown by Vite.

## Build

```powershell
npm run typecheck
npm run build
npm run preview
```

The project includes a GitHub Actions build workflow. A successful workflow run should be verified before distributing the game.

## Controls

| Input | Action |
| --- | --- |
| Left / A | Move one lane left |
| Right / D | Move one lane right |
| Up / W / Space | Jump |
| Down / S | Slide |
| P / Escape | Pause or resume |
| R | Restart after a collision |
| Swipe | Move, jump or slide on touch devices |

## Architecture

- `src/main.ts`: Three.js renderer, camera, input, avatar, main game loop and HUD
- `src/city.ts`: recycled facade blocks, shop trim, windows and street trees
- `src/street.ts`: recycled street furniture, lamps and planters
- `src/hazards.ts`: pooled coins and obstacles, spawn patterns and collision rules
- `public/assets/character.glb`: temporary animated example asset from the Three.js example library

## Visual and technical roadmap

The existing character and some scenery are placeholders for the final art direction. Before release the project needs a properly licensed human runner with run/jump/slide animation clips, polished art assets, mobile tuning, sound design, accessibility options, and verified playtesting. Do not market the current scene as a finished commercial game.

## Credits

Temporary character GLB: `RobotExpressive.glb` from the [Three.js examples](https://github.com/mrdoob/three.js/tree/master/examples/models/gltf/RobotExpressive). Review its original asset licensing and attribution before redistribution.
