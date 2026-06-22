# PROGRESS — Marley's Treasure Hunt (Venture Out AR Adventure)

**Status:** ✅ v1 (Phase A) complete + Phase C compass features added (facing beam, fixed prizes, world-anchored AR). Verified locally; sensor motion needs an on-device pass.
**Last updated:** 2026-06-22

---

## What this is
Offline, Pokémon-GO-style location-based AR treasure hunt for Brad's kids (5–9) to play on a golf cart at the Venture Out resort, Panama City Beach. iPhone-first (real GPS, works offline); Wi-Fi-only iPad falls back to "Explorer Mode." Built as a vanilla HTML/CSS/JS PWA — no frameworks, no build step, no CDN libraries (so it caches cleanly for offline).

## Orchestration model
- **Opus 4.8** — orchestrator + all game logic / PWA plumbing / integration / testing.
- **Sonnet** (subagent) — built the visual design system (`index.html` + `styles.css`) to a fixed ID/class interface contract.

## Key architecture decisions
- **No A-Frame / AR.js.** GPS + the resort map image + the camera (all native browser APIs) give the same feel, robustly, offline. (AR.js geo-mode is fragile at cart speed and GPS-dependent.)
- **Camera = live background; treasures = world-anchored** via device orientation (compass heading + pitch): the catch emoji holds its real-world bearing/elevation, so it slides in and out of frame and scales with distance as you move (Pokémon-GO-style). Falls back to a centered overlay when sensors are unavailable/denied.
- **Map ↔ GPS** via equirectangular projection + a 2-point on-site **calibration** (similarity transform saved to `localStorage`), pre-seeded with the resort center (30.1373, −85.747). Treasures sit at **fixed spots** in each zone's map band (4 maintained by `refreshAmbient`, the map piece at the band centre) and only become tappable within `catchRadiusM` (25 m) — the kid travels to them. (The old "spawn one at your feet every 30 m" backup spawner was removed — it defeated the point of walking toward anything.)
- **Offline** via a cache-first service worker precaching all 11 same-origin files; `navigator.storage.persist()` + Home-Screen install resist iOS cache eviction.
- **Art = emoji** (zero files) for v1; **sound = Web Audio synthesis** (zero files). Only real binaries are the PWA icons + the map image.

## Files
`index.html` · `styles.css` · `game.js` (CONFIG block = all tunables) · `manifest.json` · `sw.js` · `assets/` (map, icons, logo, sign) · `.claude/launch.json` (local preview server).

## Verified (local, via headless preview on :8090)
- ✅ Title → map → catch → bag → win → safety-card screens all render correctly (screenshots reviewed).
- ✅ Full catch loop: tap treasure → catch screen → tap → **score increments**, added to bag.
- ✅ **Explorer Mode** fallback (no GPS): all treasures tappable; zones advance via "We made it!" (3→4 confirmed).
- ✅ **Camera fallback** (`body.no-camera`): painted sunset background, game fully playable.
- ✅ **Offline:** SW controls the page; **all 11 assets confirmed in cache**.
- ✅ State **persists** to `localStorage`.
- ✅ Thomas Drive **safety card** appears in zone 4 and must be dismissed.
- ✅ **Zero console errors** across the whole session.

### Bugs found & fixed during integration
1. Explorer Mode left pre-GPS treasures non-collectable → now flips all existing treasures collectable on entry.
2. `.treasure` / `#playerDot` used the plain `bob` keyframe, clobbering `translate(-50%,-50%)` centering → added a centering-safe `float-centered` keyframe.
3. Catch treasure had no `left/top` → rendered in the corner → now centered (50% / 44%).
4. Long Marley messages made the bubble tall/narrow + covered the catch target → shortened copy, hide Marley on catch, fixed bubble width.
5. Map `object-fit: cover` cropped the map → switched to `contain` so all 5 zones are visible.
6. Calibration tap bound to `#mapImg` (which has `pointer-events:none`) → moved to `#mapViewport`.

### 2026-06-22 — Compass + fixed prizes + world-anchored AR (this iteration)
**Asks:** (1) prizes kept appearing underfoot; (2) add a "which way am I facing" compass; (3) make the AR icon stay put in the world (resize / go in & out of frame) like Pokémon GO.
**Done:**
- **Fixed prizes:** removed the at-your-feet "spawn every 30 m" backup spawner; the map piece now parks at the zone-band centre (not on the player); fixed a `refreshAmbient` double-count (`ambient.length + countAmbient()`) so the pool actually refills to 4. Treasures only become tappable within 25 m, so the kid walks to them.
- **Facing beam:** a new `deviceorientation` heading drives a gold cone (`#facingBeam`) on the boat; rotation = `mapNorthDeg() + heading` (north-up off-site; calibration-corrected on-site).
- **World-anchored AR:** the catch emoji is positioned every frame from `worldBearing(player→treasure)` vs phone heading (horizontal), pitch (vertical), and GPS distance (size). When it's outside the camera frame, a "→ Turn to find it!" edge arrow points the way. Centered-overlay fallback if sensors are missing/denied.
- iOS motion/orientation permission is requested inside the Start tap (alongside camera). SW bumped to `voar-v4`.
**Verified locally:** 20/20 AR-math unit checks (Node); fixed-treasure catch loop + refill; beam cone geometry (screenshot); AR emoji placement + off-frame arrow (screenshots); zero console errors. ⚠️ **Live sensor motion can't run in the headless preview (`requestAnimationFrame` is paused when the tab isn't visible) — the moving beam / in-and-out-of-frame AR must be confirmed on the iPhone.**
**Tuning knobs** (`AR` object in `game.js`): `fovH` 60, `fovV` 75, `elevation` −5°, `sizeNear` 172px, `sizeFar` 78px. If the treasure feels mis-aimed or wrong-sized on-device, nudge these first.

## Not yet done / next steps
- ⏳ **On-device test** (the real proof): install on the iPhone via Safari, Airplane-Mode it, confirm the boat moves + camera works + catches persist. Then a dress-rehearsal lap on the cart.
- ⏳ **Deploy** to GitHub Pages (or Netlify Drop) — see README.
- 🔜 **Phase B:** swap emoji → Brad's custom Claude-designed art (treasures, Marley, Captain Barnacle, splash); optional custom sounds.
- ✅ **Phase C (compass) — built 2026-06-22:** boat "facing beam" + world-anchored "point at the real spot" AR + off-frame "turn to find it" arrow (see iteration note). **Needs on-device tuning** of the AR field-of-view/heading constants. Still future/optional: GPS auto-advancing zones; haptics; per-kid score profiles.

## Ratings
- Confidence (v1 works as designed): **86/100** (up from 82 after local verification; remaining risk is on-device GPS accuracy + iOS permission UX).
- Implementation complexity: **62/100**.

## Notes for future-you
- **Practice Mode** (green toggle on the title screen) lets you test the full GPS experience anywhere — on the first fix it re-centers the resort map on your current location with a tight span (`CONFIG.practiceSpanM` = 250m), so a short neighborhood loop covers all zones. A real on-site Calibrate turns it off. (Added 2026-06-22; SW now `voar-v3`.)
- **Fonts** are self-hosted in `assets/fonts/` (Ribeye = display headlines via `--font-display`; Fredoka variable = body/UI via `--font-fun`/`--font-body`). To change one: download its `.woff2`, update the `@font-face` + token in `styles.css`, add the file to `sw.js` precache, and bump `CACHE_VERSION`. (Added 2026-06-22, replacing the generic Chalkboard/Comic Sans system stack. SW is now `voar-v2`.)
- After editing ANY file, **bump `CACHE_VERSION` in `sw.js`** so installed phones refresh.
- During local dev the cache-first SW serves stale files — clear it (DevTools → Application → Service Workers/Storage) or run `MTH.reset()` after edits.
- Local test server port **8090** is registered in `~/localHostDashboard/projects.json` (reserved).
