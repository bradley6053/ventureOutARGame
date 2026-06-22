# 🏴‍☠️ Marley's Treasure Hunt — A Venture Out Adventure

A bright, kid-friendly, **offline** treasure-hunt game for ages 5–9, played on an **iPhone** (or iPad) while riding the golf cart around the **Venture Out** resort in Panama City Beach.

Kids hold up the "magic spyglass" (the phone), watch their boat travel the resort map, drive near treasures, and **tap to catch** seashells, gold coins, friendly sea creatures, and pirate chests — guided by **Marley the Marlin**. Collect a map piece in each of the 5 zones to unlock the **Grand Treasure Chest** at the beach!

It runs **100% offline** once loaded, so it works on the cart with no Wi-Fi or cell signal.

---

## How to play
1. Tap **Start the Adventure**.
2. Drive the cart. Your boat ⛵ moves on the resort map. When a treasure starts glowing, **tap it**.
3. The camera opens with the treasure floating in front — **tap it to catch it!** 🎉
4. Each zone hides a **map piece** 🗺️. Collect all 5 to reveal the **Grand Chest** 🧰 at the beach.
5. **Stay seated and keep the phone inside the cart** — Marley reminds everyone, especially when crossing **Thomas Drive**.

**The 5 zones (north → south):** Lagoon & Fishing Pier → Marine Streets → Amenities Hub → Thomas Drive Crossing → Beach & Pool (finale).

---

## 📱 Put it on the iPhone (do this on the condo Wi-Fi first!)
1. Open the game's web address in **Safari** (it must be Safari to install it as an app).
2. Tap **Start the Adventure** once, and **Allow** when it asks for **Location** and **Camera**.
3. Wait for the green **"✅ Ready to play offline!"** banner at the bottom.
4. Tap the **Share** button → **Add to Home Screen**. Now launch the game from its new home-screen icon.
5. Let it sit ~10 seconds so the GPS gets its first lock (faster on Wi-Fi).
6. **You can now drive away with no internet.** Keep **Location Services ON** (Airplane Mode is fine — GPS still works).

### On arrival at the resort: calibrate once (makes the map accurate)
1. Tap **📍 Calibrate**.
2. Stand by the big **Venture Out entrance sign** and tap that spot on the map.
3. Go to the **Fishing Pier** (top of the map) and tap the pier.
4. Done — your boat now lines up with the real resort. (You only do this once; it's remembered.)

> **iPad note:** A **Wi-Fi-only iPad has no GPS**, so it can't show the live map offline. It automatically switches to **Explorer Mode** — treasures pop up on their own to tap, and a grown-up taps **"We made it! →"** to move to the next zone. Still works great; the **iPhone** is the one that gets the full live-map experience.

---

## 🏠 Test it away from the resort (Practice Mode)
Not in Florida yet? On the title screen tap **🏠 Practice Mode: ON**, then **Start the Adventure**. The first GPS fix makes wherever you're standing the center of the resort map — about **250m of your neighborhood maps to the whole resort** — so your boat moves and the zones trigger as you walk or drive around the block. It's a true GPS dress-rehearsal. Turn it **OFF** (or just do a real **📍 Calibrate** once you're at Venture Out) to switch back to the real resort positions. (Tune the area with `CONFIG.practiceSpanM` in `game.js`.)

---

## 🌐 Host it for free (so you have a web address)

**Option A — GitHub Pages (recommended):**
1. Create a new GitHub repo (e.g. `venture-out-ar`) and upload all the files in this folder.
2. Repo **Settings → Pages → Deploy from branch → `main` / root**.
3. Your address will be `https://<your-username>.github.io/venture-out-ar/`. Open it in Safari (step above).
   - GitHub Pages is **HTTPS**, which the camera, GPS, and offline features all require. ✅

**Option B — Netlify Drop (no GitHub needed):** go to **app.netlify.com/drop** and drag this whole folder onto the page. It gives you an instant HTTPS address.

> ⚠️ Everything uses **relative paths**, so it works at a subfolder address like `.../venture-out-ar/`. Don't rename files or move the `assets/` folder.

---

## 🖥️ Run it on your Mac (to preview / develop)
From this folder:
```bash
python3 -m http.server 8090 --directory "/Users/brad/Venture Out AR Adventure"
```
Then open **http://localhost:8090**. (Port 8090 is registered in `~/localHostDashboard/projects.json`.)
On a desktop there's no GPS/camera, so it runs in **Explorer Mode** with the painted-beach background — that's expected.

**Debug console helpers** (open DevTools console):
`MTH.start()` · `MTH.explorer()` · `MTH.zone(4)` · `MTH.win()` · `MTH.reset()`

---

## ✏️ Customize the game
**Everything tweakable lives in the `CONFIG` block at the top of [`game.js`](game.js).**
- **Treasures:** change the `emoji` and `value` in each zone's `treasures` list.
- **Zone names / Marley's lines:** `name` and `intro`.
- **Difficulty:** `target` (catches needed per zone), `catchRadiusM` (how close you must be), `spawnEveryMeters`, `ambientTreasures`.
- **Map position of a zone's treasures:** `band: [topFraction, bottomFraction]` (0 = top/north of the map, 1 = bottom/south).
- **The safety message** at Thomas Drive: zone 4's `safety` text.

**Swapping in your custom Claude-designed art later:** the treasures are currently Apple **emoji** (zero files, instant). When your art is ready, drop the images in `assets/` and we'll change the treasure rendering from emoji text to `<img>` — that's the planned **Phase B**.

**Fonts:** Ribeye (headlines) and Fredoka (body/UI) are **self-hosted** in `assets/fonts/` so they work with no internet. To change one: download its `.woff2`, update the `@font-face` + the `--font-display` / `--font-fun` tokens in [styles.css](styles.css), add the file to [`sw.js`](sw.js), and bump `CACHE_VERSION`.

> **IMPORTANT after ANY edit:** open [`sw.js`](sw.js) and bump `CACHE_VERSION` (e.g. `voar-v1` → `voar-v2`), then re-upload. This tells already-installed phones to pull the fresh version next time they're online. Without it, the old cached version keeps running.

---

## 📁 What's in here
| File | What it does |
|------|--------------|
| `index.html` | The page + all screens (title, map, catch, bag, win) |
| `styles.css` | All the visual design, theme, and animations |
| `game.js` | All game logic — GPS, calibration, catching, zones, scoring, sound, offline |
| `manifest.json` | Makes it installable as a home-screen app |
| `sw.js` | The service worker that caches everything for **offline** play |
| `assets/` | Resort map, app icons, Venture Out logo/sign, and the self-hosted **Ribeye + Fredoka** fonts |

No frameworks, no build step, no libraries — just open it.

---

*Made for the Venture Out crew 🌴 — drive safe, stay seated, and happy hunting!*
