# RUSH CITY — PROJECT HANDOFF & DEVELOPMENT GUIDE

> **Read this first in a new ChatGPT conversation.** This file is the durable source of truth for the project. Always inspect the current GitHub repository before editing: code can change after this document was written.
>
> Last reviewed: **2026-11-18**. Repository: **https://github.com/shymok-nt/Rewild**. Primary branch: **main**.
>
> Status: **active development / unfinished playable foundation**. Do **not** claim that the game is finished, visually equivalent to Subway Surfers, production-ready, or verified on the target computer.

## 1. Vision, non-negotiable requirements

**RUSH CITY** is a colorful, polished, responsive, three-dimensional urban endless-runner game for desktop browsers and eventually mobile browsers. The user wants a game visually **approaching the production polish of Subway Surfers**, not a direct copy of its copyrighted artwork or characters. The user explicitly rejects an unfinished box-and-sphere aesthetic, cheap-looking geometry, generic prototype art, placeholder gameplay, and long planning-only responses.

The user wants the assistant to **actually modify the GitHub repository**, implement substantial code, use suitable legally redistributable 3D assets where feasible, and commit changes **directly to main**. The user has already authorized continuing development and routine project changes without repeatedly asking for approval. They prefer **no repetitive interim updates**; give concise, accurate reports of meaningful changes and clearly disclose remaining work. Never claim that background work continues after a conversation ends. Never claim successful builds, performance, or asset licenses without verifying them.

The user's development PC (from previous discussions) is Windows with AMD Ryzen 7 5825U, integrated Radeon Graphics, and 16 GB RAM. Favor low draw calls, mesh instancing, pooling, compressed/optimized art, reasonable GPU memory, and adaptive quality.

### Visual target

- Appealing human runner with intentional character design and **skeletal run/jump/slide** animations.
- Cohesive, art-directed city: buildings, storefronts, awnings, roads, sidewalks, vegetation, signage, street props, vehicles and obstacle silhouettes.
- A readable three-lane running corridor and a clear third-person chase camera.
- Rich material/color design, warm sunlight, atmospheric sky, shadows and responsive effects.
- **Do not** call the current temporary RobotExpressive GLB the finished character.
- Prefer original designs or assets with confirmed commercial redistribution rights; track attribution and licenses.

## 2. Repository, tooling and working agreement

Repository: `shymok-nt/Rewild` (the repo was previously used for a different game called Rewild; it has been repurposed as RUSH CITY).

- GitHub branch: **main**. User explicitly wants work committed there.
- Language: TypeScript (strict).
- Runtime: Three.js 0.181.x, Vite 7.x, browser WebGL.
- TypeScript: ~5.9.3.
- Package scripts: `npm run dev`, `npm run build`, `npm run typecheck`, `npm run test`, `npm run preview`.
- GitHub Actions: `.github/workflows/build.yml` installs packages, runs tests, and builds on push to main.
- `package-lock.json` is now committed for reproducible dependency resolution; CI still uses `npm install`.
- Current GitHub connector tools can fetch/update/create/delete text files and create binary blobs, trees and commits. If using connector tools, check available tool schemas before calling them.
- **Critical:** The assistant has previously committed code without verifying a complete local `npm run build` or browser playtest. The next developer should prioritize real validation, not just another set of untested features.

### Local setup on Windows

```powershell
git clone https://github.com/shymok-nt/Rewild.git
cd Rewild
npm install
npm run test
npm run typecheck
npm run build
npm run dev
```

If the repository is already cloned, use `git pull origin main` instead of cloning. Open the local URL printed by Vite. Node.js 22 or newer is recommended. Use the actual output of commands to determine success or failure; do not assume success.

## 3. Current gameplay implementation

- Three lanes, x positions approximately **-2.9, 0, +2.9**.
- Left/right lane switching with damped visual movement.
- Jump duration **0.82 seconds**, sinusoidal height peaking at **1.8 world units**.
- Slide duration **0.72 seconds**, currently implemented by vertically scaling the player root to **0.55**.
- Speed increases from **13** toward a cap of **24** as distance grows.
- Distance score, coin count and high score (high score persisted in localStorage).
- A start overlay, pause/resume overlay, collision/game-over state, restart button and keyboard restart.
- Keyboard controls: A/D or arrow left/right, W/up/space jump, S/down slide, P/Escape pause, R restart.
- Swipe input and on-screen mobile buttons.
- Coins, low barriers (jump to avoid), overhead gates (slide to avoid) and delivery vans (change lanes to avoid).
- Obstacle object pooling and swept Z collision checks.
- Procedural obstacle spawning, including some patterns with two blocked lanes and one safe lane.
- Original synthesized Web Audio sound effects with a persistent mute toggle.
- Coin sparkle particles, chase camera, responsive HUD and automatic render resolution adjustment.
- Page-visibility auto-pause.
- **Known limitations:** obstacle spawn fairness and visual hitbox widths need browser playtesting; jump/slide animation fallback depends on imported GLB clips; no full onboarding or advanced accessibility pass.

## 4. Architecture — actual files and responsibilities

| Path | Responsibility |
| --- | --- |
| `index.html` | Browser entry document with `#app` |
| `package.json` | Dependencies, development/build/test scripts |
| `tsconfig.json` | TypeScript compiler settings |
| `src/main.ts` | Scene, camera, renderer, character loading, input, HUD, main loop, scoring, game state |
| `src/style.css` | HUD, pause/start/game-over overlays, responsive mobile controls |
| `src/rules.ts` | Pure helper functions: lane clamp, speed curve, jump arc, avoidance, swept collision |
| `src/hazards.ts` | Coin and obstacle models, pooling, spawn patterns, collision and collection |
| `src/city.ts` | Recycled city blocks, window instancing, facade trim, signs and trees |
| `src/street.ts` | Streetlights, planters, bollards and their recycling |
| `src/road.ts` | Repeating curbs, crosswalks and road markings |
| `src/ground.ts` | Generated asphalt and sidewalk canvas textures |
| `src/sky.ts` | Gradient sky dome and cloud sprites |
| `src/audio.ts` | Web Audio synthesized sound effects and mute preference |
| `src/effects.ts` | Recycled coin pickup particle effects |
| `tests/rules.test.mjs` | Node test suite for pure gameplay rules |
| `public/assets/character.glb` | **Temporary** RobotExpressive animated character |
| `.github/workflows/build.yml` | GitHub Actions test/build pipeline |
| `README.md` | Short setup and architecture overview |
| `RUSH_CITY_PROJECT_GUIDE.md` | **This handoff and project continuity document** |

Older Phaser-era `src/scenes/RunnerScene.ts` and several old runner SVG assets were removed. Avoid reintroducing Phaser unless there is a user-approved reason.

## 5. Scene coordinates, camera and world streaming

The runner stays around world Z=0 while road decorations, obstacles and city blocks move toward positive Z. Negative Z is ahead of the player. The camera starts near (0, 4.5, 10) looking toward negative Z. A fixed road plane extends along the Z axis. City blocks, street furniture and road trim are reused by wrapping their positions based on accumulated distance. Rendering uses ACES tone mapping, SRGB output, hemisphere and directional lighting, fog and optional shadows.

Current city art is generated procedurally with shared geometry/materials and some instancing; it is **not yet a premium GLB city asset pack**. It should be replaced or significantly art-directed rather than described as final.

## 6. Character asset and animation details

`src/main.ts` loads `/assets/character.glb` with Three.js `GLTFLoader`. It normalizes the model to about 2.3 world units high, sets it on the ground and uses `THREE.AnimationMixer`.

Animation clip selection currently looks for:
- Run/jog, falling back to walk or the first available clip.
- Jump/leap, if present.
- Slide/crouch/duck, if present.

It crossfades actions where available. When a jump/slide clip is missing, it falls back to the run action. **The existing RobotExpressive model is only a pipeline test asset** from the Three.js examples. Its original licensing/attribution must be checked before distributing a commercial game.

**High priority:** replace the temporary robot with a suitable original or properly licensed stylized human GLB and validate skeletal animation, character orientation, mesh bounds, materials and performance. Do not silently import copyrighted game assets.

## 7. Collision, spawning and game state

`src/hazards.ts` spawns obstacles at approximately Z=-92 and advances them by `dt*speed`. Spawn cadence is distance-based (roughly every 22–32 world units). Objects are reused from per-kind pools. Coins are collectible on crossing the player's Z plane in the selected lane. Low barriers are avoided when jump height exceeds 0.8; overhead gates require slide; vans require changing lanes.

**Potential gameplay bugs to investigate:**
1. Spawning is distance-based but newly spawned items start at a fixed Z; this can make early obstacles arrive later than the nominal spawn distance. Confirm difficulty and spacing in actual gameplay.
2. Collision now uses interpolated visual X at the obstacle's Z-plane crossing, with widths based on obstacle type. Validate fast lane switches, hitbox tuning and input grace in the browser.
3. Collision only uses an approximate Z interval. Validate under 30 FPS, 60 FPS, pauses, and high speed.
4. Start, pause, restart and asynchronous character loading states should be tested together.
5. Avoidance windows for slide/jump should match visible geometry and animation timing.
6. Check for guaranteed safe paths in all spawn patterns, especially with multi-obstacle combinations.
7. Confirm coins don't get collected when visually too far from the avatar.

## 8. Rendering and performance

Performance-conscious measures already present:
- Device pixel ratio capped at ~1.25 initially.
- Adaptive pixel ratio: reduce after sustained low FPS, increase after sustained high FPS.
- Directional shadow map 512x512; shadows may be disabled at sustained FPS below 29.
- Mesh instancing for building windows.
- Reused repeating city, street and road segments.
- Pooled obstacles and particle effects.
- No network texture requests for procedural sky/road textures.

**Known technical risks:**
- Procedural city still contains numerous individual meshes, and each may incur a draw call. Profile with renderer.info.render.calls.
- Some materials and geometries are created per obstacle variant rather than globally; pooling mitigates but does not eliminate initial spikes.
- Fixed geometry detail and shadow casting need profiling on integrated Radeon GPUs.
- Shadow maps disabled due to low FPS currently do not automatically re-enable.
- Textures and sky clouds should be verified visually on both desktop and mobile.
- Consider limiting CPU overhead and avoiding excess garbage collection.
- Avoid claiming stable FPS without actual browser benchmarks.

## 9. Tests, CI and validation truth

The project has a Node `node:test` suite covering lane clamp, speed, jump arc, avoidance rules and swept collision. GitHub Actions is configured to run `npm install`, `npm run test`, and `npm run build`.

**Latest local verification (2026-11-18):** `npm run test` passed 6/6 tests; `npm run typecheck` exited successfully; `npm run build` completed with Vite 7.3.8. The build emitted a non-fatal JS chunk-size warning (~660 kB minified). This is CLI verification, **not** a browser playtest, CI run, or FPS measurement on the target AMD hardware.

Recommended acceptance checks:
- `npm run test` passes and shows test totals.
- `npm run typecheck` exits successfully.
- `npm run build` exits successfully and produces `dist/`.
- Browser starts with no console errors, model is visible, and controls work.
- Start/pause/restart works via keyboard, touch and pointer controls.
- Obstacles can be dodged fairly; coins increment once; high score persists.
- Screen resizing and portrait mode do not hide controls.
- Frame pacing and memory usage are reasonable on the target Windows AMD GPU.
- Assets have documented licenses and attribution where required.

## 10. Priorities for the next development session

**P0 — correctness and validation**
1. Pull/fetch latest main and inspect actual files.
2. Get a real TypeScript + Vite build and Node tests running. Fix errors before adding more features.
3. Check asynchronous GLB loading, pause/start/restart states, input and visual collision fairness.
4. Review performance, remove stale dependencies/assets and add any missing lockfile.

**P1 — visual quality**
1. Source or create an original/licensed stylized human runner and appropriate animations.
2. Replace obvious primitive/prototype city geometry with art-directed city assets or substantially refined procedural meshes.
3. Improve character silhouette, camera composition, color consistency, obstacle silhouettes, environment variation, material and lighting polish.
4. Verify all downloaded assets' licenses and document their origins.

**P2 — gameplay polish**
1. Fairer obstacle patterns, difficulty progression, tutorial, visual hit feedback and better collectible feedback.
2. Animation state transitions and slide collision tuning.
3. Touch responsiveness, keyboard accessibility, reduced-motion and sound preferences.
4. Gameplay settings, achievements or missions only after core quality is reliable.

**P3 — shipping**
1. Automated browser smoke tests and performance budgets.
2. Production build validation and deployment plan.
3. Optional mobile/PWA packaging after browser stability.
4. A clear release checklist and final instructions for the user.

## 11. How to continue in a new ChatGPT conversation

Paste this short request, or point the new conversation to this file in the repository:

> Continue developing my RUSH CITY game in GitHub repository `shymok-nt/Rewild`, branch `main`. First read `RUSH_CITY_PROJECT_GUIDE.md`, `README.md`, `package.json`, `src/main.ts`, and the relevant source files. The user has authorized substantial implementation and commits directly on main. Do not just write a plan or ask for routine approval. Prioritize a verified build, gameplay correctness, and polished stylized 3D visuals. Keep this guide updated whenever architecture, assets, status or major decisions change. Do not claim the game is complete until it has actually been validated.

### Rules for the assistant maintaining this guide

- Update this document after significant feature work, especially architecture changes, asset imports and bug fixes.
- Record **what exists** separately from **what is planned**.
- State whether tests were actually executed; never fabricate results.
- Record any new asset's source, license, attribution and file path.
- Keep the GitHub branch and setup commands accurate.
- Never delete or rewrite this guide without providing an equivalent continuity document.
- Do not store credentials, tokens or private user information in the repo.


---

## 12. Türkçe proje özeti — yeni sohbete geçerken

### Proje tam olarak nedir?

**RUSH CITY**, tarayıcıda çalışan, üç şeritli, üçüncü şahıs kameralı bir **3D sonsuz koşu oyunudur**. Kullanıcı, görsel kalite olarak Subway Surfers seviyesine yaklaşan, fakat kendi özgün karakterleri ve şehir tasarımına sahip bir oyun istiyor. Bu hedef, mevcut sürümün ulaştığı kaliteyle **karıştırılmamalıdır**: şu an çalışan bir temel geliştiriliyor; son ürün hazır değil.

### Kullanıcının çalışma tercihleri

- Kodları ve özellikleri **GitHub deposunda doğrudan geliştir**.
- Varsayılan dal **main**. Kullanıcı rutin işlemler için önceden izin verdi.
- Sadece fikir veya prompt verme; gerçek kod yaz, dosyaları güncelle, commit oluştur.
- Kullanıcı gereksiz sorular ve ara durum mesajları istemiyor.
- Bir şeyin tamamlandığını söylemeden önce test et; test edemediysen açıkça belirt.
- Görsel kaliteyi artırırken FPS'yi koru. Hedef donanım güçlü bir ekran kartı değil, entegre AMD Radeon.
- Önceki Rewild adlı hayatta kalma oyununun kodlarını geri getirme; depo artık RUSH CITY için kullanılıyor.
- Kullanıcı bir sohbetten diğerine geçerse **önce bu MD dosyasını oku**, sonra mevcut kodları incele.
- Her önemli geliştirme sonunda bu dosyayı güncelle ve değişiklikleri main'e kaydet.

### Şu anda neler var?

1. Three.js, Vite ve TypeScript altyapısı.
2. Üç şerit, şerit değiştirme, zıplama ve kayma.
3. Engeller, altın toplama, çarpışma, puan ve rekor.
4. Başlatma, duraklatma, yeniden başlatma ve mobil dokunmatik kontroller.
5. Üretilmiş şehir blokları, mağaza tabelaları, yol çizgileri, kaldırımlar, ağaçlar ve sokak eşyaları.
6. Gökyüzü, bulutlar, ışık, sis ve karakter gölgesi.
7. Ses efektleri, ses açma/kapatma ve altın toplama parçacıkları.
8. Nesne havuzu, instancing ve uyarlanabilir çözünürlük gibi performans çalışmaları.
9. Oynanış matematiği için otomatik testler ve GitHub Actions iş akışı.
10. **Geçici robot karakter**; nihai insan karakter henüz eklenmedi.

### Önemli açık işler

- Karakteri gerçek anlamda stilize, kaliteli, rig'li bir **insan koşucu** ile değiştirmek.
- Koşma/zıplama/kayma animasyonlarının gerçekten uygun şekilde çalıştığını doğrulamak.
- Şehir ve araç modellerini prototip görünümünden çıkarıp profesyonel sanat yönetimine yaklaştırmak.
- **Gerçek** TypeScript derleme, test, tarayıcı ve hedef cihaz FPS sonuçlarını toplamak.
- Engellerin çarpışma sınırlarını ve oynanış adaletini gerçek koşularda denemek.
- Kaynak dosyalarını, lisansları ve dağıtım şartlarını belgelemek.
- Oyunun tamamlandığını ilan etmeden önce son kalite kontrolü yapmak.

### Güncel teknik not

2026-11-18 itibarıyla başlangıç butonu karakter GLB yüklenene kadar devre dışı bırakılacak şekilde düzenlendi. Bu, yüklenmemiş karakterle oyuna girilmesini engeller. Bu değişiklik de henüz tam bir tarayıcı testinden geçirilmiş değildir.

### Yeni sohbette doğrudan kullanılabilecek komut

> GitHub'daki `shymok-nt/Rewild` projem olan RUSH CITY'yi geliştirmeye devam et. `main` dalındaki `RUSH_CITY_PROJECT_GUIDE.md` dosyasını ve mevcut kodları önce incele. Proje bitmedi; öncelik gerçek derleme/test doğrulaması, kaliteli 3D insan karakter, animasyonlar ve premium şehir görselleri. Rutin değişiklikler için onayımı zaten verdim; doğrudan kodla ve main'e commit yap. Proje rehberini güncel tut. Tamamlanmayan şeyleri tamamlandı diye söyleme.

### Geliştirme günlükleri için kayıt biçimi

Her önemli geliştirme sonrasında bu bölümün altına tarih, değişen dosyalar, ilgili commit, çalıştırılan testlerin gerçek sonucu, kalan sorunlar ve bir sonraki öncelik eklenmelidir. Özellikle başarısız denemeleri saklama; yeni sohbetin aynı hataları tekrarlamaması için burada belirt.

#### 2026-11-18 — Dokümantasyon ve başlangıç güvenliği

- `RUSH_CITY_PROJECT_GUIDE.md` oluşturuldu; mimari, oyun tasarımı, kullanıcı tercihleri, teknik riskler ve yeni sohbet aktarım bilgileri yazıldı.
- `src/main.ts` karakter GLB dosyası yüklenmeden oyunun başlatılmasını engelleyecek şekilde düzenlendi.
- `src/style.css` yüklenme durumundaki butonu ayırt edecek şekilde güncellendi.
- **Test durumu:** Tam proje derlemesi ve gerçek tarayıcı testi henüz doğrulanmadı.

#### 2026-11-18 — İlk doğrulanmış derleme ve görsel konumla çarpışma

- `src/rules.ts`: `overlapsRunner` ile engelin oyuncu düzleminden geçtiği anda karakterin interpolasyonlu yatay konumuna göre temas hesabı eklendi.
- `src/hazards.ts` ve `src/main.ts`: engel temasları hedef şerit yerine karakterin önceki/güncel görsel X konumuyla hesaplanıyor; engele göre yatay temas genişliği kullanılıyor.
- `tests/rules.test.mjs`: son anda şerit değiştirme, aynı şeritte temas ve Z dışında kalma testleri eklendi.
- `package-lock.json`: bağımlılık çözümlemesi sabitlendi.
- **Gerçek yerel doğrulama:** `npm run test` 6/6 başarılı; `npm run typecheck` başarılı; `npm run build` başarılı (Vite 7.3.8, büyük JS paketi uyarısı var).
- **Henüz doğrulanmadı:** tarayıcı oynanışı, animasyonların görünümü, çarpışma hissi, mobil kontrol ve hedef AMD bilgisayarda FPS.
- **Sonraki öncelik:** tarayıcı smoke test, hitbox ayarı, gerçek insan karakteri ve lisanslı/özgün çevre görselleri.
