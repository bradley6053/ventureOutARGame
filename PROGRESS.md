# PROGRESS — Marley's Treasure Hunt (Venture Out AR Adventure)

**Status:** ✅ v1 (Phase A) complete and verified locally. Ready to deploy + test on-device.
**Last updated:** 2026-06-22

---

## What this is
Offline, Pokémon-GO-style location-based AR treasure hunt for Brad's kids (5–9) to play on a golf cart at the Venture Out resort, Panama City Beach. iPhone-first (real GPS, works offline); Wi-Fi-only iPad falls back to "Explorer Mode." Built as a vanilla HTML/CSS/JS PWA — no frameworks, no build step, no CDN libraries (so it caches cleanly for offline).

## Orchestration model
- **Opus 4.8** — orchestrator + all game logic / PWA plumbing / integration / testing.
- **Sonnet** (subagent) — built the visual design system (`index.html` + `styles.css`) to a fixed ID/class interface contract.

## Key architecture decisions
- **No A-Frame / AR.js.** GPS + the resort map image + the camera (all native browser APIs) give the same feel, robustly, offline. (AR.js geo-mode is fragile at cart speed and GPS-dependent.)
- **Camera = live background; treasures = screen-anchored** (like Pokémon GO's AR catch), so no pinpoint compass/GPS accuracy needed.
- **Map ↔ GPS** via equirectangular projection + a 2-point on-site **calibration** (similarity transform saved to `localStorage`), pre-seeded with the resort center (30.1373, −85.747). Distance-based backup spawner guarantees catches even if calibration is rough.
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

## Not yet done / next steps
- ⏳ **On-device test** (the real proof): install on the iPhone via Safari, Airplane-Mode it, confirm the boat moves + camera works + catches persist. Then a dress-rehearsal lap on the cart.
- ⏳ **Deploy** to GitHub Pages (or Netlify Drop) — see README.
- 🔜 **Phase B:** swap emoji → Brad's custom Claude-designed art (treasures, Marley, Captain Barnacle, splash); optional custom sounds.
- 🔜 **Phase C (optional):** compass-anchored "point at the real spot" AR; GPS auto-advancing zones; haptics; per-kid score profiles.

## Ratings
- Confidence (v1 works as designed): **86/100** (up from 82 after local verification; remaining risk is on-device GPS accuracy + iOS permission UX).
- Implementation complexity: **62/100**.

## Notes for future-you
- **Fonts** are self-hosted in `assets/fonts/` (Ribeye = display headlines via `--font-display`; Fredoka variable = body/UI via `--font-fun`/`--font-body`). To change one: download its `.woff2`, update the `@font-face` + token in `styles.css`, add the file to `sw.js` precache, and bump `CACHE_VERSION`. (Added 2026-06-22, replacing the generic Chalkboard/Comic Sans system stack. SW is now `voar-v2`.)
- After editing ANY file, **bump `CACHE_VERSION` in `sw.js`** so installed phones refresh.
- During local dev the cache-first SW serves stale files — clear it (DevTools → Application → Service Workers/Storage) or run `MTH.reset()` after edits.
- Local test server port **8090** is registered in `~/localHostDashboard/projects.json` (reserved).
