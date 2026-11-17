# RUSH CITY

A browser-based 3D endless runner built with **Three.js, TypeScript and Vite**.

> **Development status:** This is an early playable 3D foundation, **not** a finished Subway Surfers-quality game. The current character is an original procedural articulated human runner and the environment is still being art-directed.

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
npm run test
npm run typecheck
npm run build
npm run preview
```

The project includes a GitHub Actions test and build workflow. The pure gameplay rule tests passed locally under Node 22, but a successful full project build workflow run should be verified before distributing the game. The game has not yet been visually validated on the target AMD integrated GPU.

## Controls

| Input | Action |
| --- | --- |
| Left / A | Move one lane left |
| Right / D | Move one lane right |
| Up / W / Space | Jump |
| Down / S | Slide |
| P / Escape | Pause or resume |
| R | Restart after a collision |
| Start / replay button | Begin or restart on touch screens |
| Sound button | Toggle synthesized sound effects |
| Swipe | Move, jump or slide on touch devices |

## Architecture

- `src/main.ts`: Three.js renderer, camera, input, avatar, main game loop and HUD
- `src/city.ts`: recycled facade blocks, shop signage, instanced windows and street trees
- `src/street.ts`: recycled street furniture, lamps and planters
- `src/hazards.ts`: pooled coins and obstacles, spawn patterns and collision rules
- `src/road.ts`: repeating curb stones, lane markings and pedestrian crossings
- `src/ground.ts`: seeded asphalt and sidewalk texture generation
- `src/audio.ts`: original synthesized audio with mute preference
- `src/effects.ts`: pooled 3D coin-pickup particles
- `src/sky.ts`: gradient sky and generated cloud sprites
- `src/rules.ts`: pure lane, speed, jump and collision rules
- `tests/rules.test.mjs`: Node 22 gameplay unit tests
- `src/humanRunner.ts`: original stylized articulated human runner and procedural run/jump/slide animations

## Visual and technical roadmap

The procedural character and some scenery are early art-direction iterations for the final art direction. Before release the project needs a properly licensed human runner with run/jump/slide animation clips, polished art assets, mobile tuning, sound design, accessibility options, and verified playtesting. Do not market the current scene as a finished commercial game.

## Credits

The active human runner is original code-generated geometry and animation, with no external model dependencies. The legacy RobotExpressive GLB is unused and should be removed during asset cleanup.
