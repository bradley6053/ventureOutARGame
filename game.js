/* ============================================================================
   Marley's Treasure Hunt — A Venture Out Adventure
   game.js  —  ALL game logic (vanilla JS, no frameworks, 100% offline).

   This file drives the UI defined in index.html / styles.css.
   It owns: GPS positioning, map<->GPS calibration, the catch loop, the 5-zone
   state machine, scoring, localStorage saves, synthesized sounds, the camera,
   and the iPhone(GPS) vs iPad(Explorer Mode) split.

   >>> To tweak the game, edit the CONFIG block below. <<<
   ========================================================================== */
(() => {
'use strict';

/* ============================================================================
   1. CONFIG  — the one place to change zones, treasures, and tuning.
   ========================================================================== */
const CONFIG = {
  // Approximate resort georeference. Used to pre-position your dot BEFORE you
  // calibrate on-site. The on-site "Calibrate" button makes it accurate.
  resort: {
    center: { lat: 30.1373, lng: -85.747 }, // ~4345 Thomas Dr, Panama City Beach
    approxWidthM: 520,   // rough E-W size of the resort, in meters
    approxHeightM: 950,  // rough N-S size (Lagoon at north -> Gulf at south)
  },

  catchRadiusM: 25,       // how close (meters) before a treasure can be tapped
  spawnEveryMeters: 30,   // GPS backup: drop a treasure near you every N meters driven
  ambientTreasures: 4,    // how many treasures float on the map per zone
  safetyReminderMs: 150000, // gentle "stay seated" reminder cadence (2.5 min)

  // The 5 zones, north -> south, matching the resort map. `band` is the
  // vertical slice of the map image (0 = top/north, 1 = bottom/south) where
  // this zone's treasures appear. `target` = catches needed to finish the zone
  // (the LAST catch is always the special map piece / chest).
  zones: [
    {
      name: 'The Lagoon & Fishing Pier',
      bannerEmoji: '🎣',
      intro: "Ahoy! I'm Marley! A storm scattered Captain Barnacle's treasure. Let's start at the Fishing Pier — tap the sea critters!",
      band: [0.03, 0.16],
      target: 5,
      treasures: [
        { emoji: '🐠', value: 10 }, { emoji: '🐟', value: 10 },
        { emoji: '🐚', value: 5 },  { emoji: '⭐', value: 15 },
      ],
      piece: { emoji: '🗺️', value: 50, label: 'Map Piece 1' },
    },
    {
      name: 'The Marine Streets',
      bannerEmoji: '🛣️',
      intro: "Down Venture Blvd! Coins and shells rolled all down Shark, Sailfish and Dolphin streets. Grab 'em!",
      band: [0.18, 0.52],
      target: 6,
      treasures: [
        { emoji: '🪙', value: 10 }, { emoji: '🐚', value: 5 },
        { emoji: '🦀', value: 15 }, { emoji: '💎', value: 25 },
      ],
      piece: { emoji: '🗺️', value: 50, label: 'Map Piece 2' },
    },
    {
      name: 'The Amenities Hub',
      bannerEmoji: '🏓',
      intro: "Pirates hid loot by the tennis courts, putting green and shuffleboard. Look sharp, matey!",
      band: [0.54, 0.69],
      target: 6,
      treasures: [
        { emoji: '🏴‍☠️', value: 15 }, { emoji: '🪙', value: 10 },
        { emoji: '🥥', value: 10 },    { emoji: '🦜', value: 20 },
      ],
      piece: { emoji: '🗺️', value: 50, label: 'Map Piece 3' },
    },
    {
      name: 'The Big Crossing',
      bannerEmoji: '🚸',
      intro: "We're crossing the big road — Thomas Drive! Hold on tight and stay seated!",
      band: [0.70, 0.81],
      target: 4,
      // Safety beat: this card MUST be tapped by a grown-up before play resumes.
      safety: "🛑 BIG ROAD AHEAD! 🛑\nEveryone stay seated, keep your hands and your spyglass INSIDE the cart, and hold on tight while we cross Thomas Drive!",
      treasures: [
        { emoji: '🧭', value: 20 }, { emoji: '🪙', value: 10 },
      ],
      piece: { emoji: '🗺️', value: 50, label: 'Map Piece 4' },
    },
    {
      name: 'The Beach & Pool',
      bannerEmoji: '🏖️',
      intro: "We made it to the beach! All the map pieces are glowing... X marks the spot. Find the GRAND CHEST!",
      band: [0.83, 0.97],
      target: 7,
      isFinale: true,
      treasures: [
        { emoji: '🐢', value: 20 }, { emoji: '🐬', value: 20 },
        { emoji: '🪙', value: 10 }, { emoji: '🐚', value: 5 },
      ],
      piece: { emoji: '🧰', value: 200, label: 'Grand Treasure Chest' },
    },
  ],
};

const SAVE_KEY = 'voar_state_v1';
const TOTAL_PIECES = CONFIG.zones.length; // 5

/* ============================================================================
   2. Tiny DOM helpers
   ========================================================================== */
const $ = (id) => document.getElementById(id);
const on = (el, ev, fn) => el && el.addEventListener(ev, fn, { passive: false });
const show = (el) => el && el.classList.remove('hidden');
const hide = (el) => el && el.classList.add('hidden');
const setText = (id, t) => { const e = $(id); if (e) e.textContent = t; };

function showScreen(id) {
  document.querySelectorAll('.screen').forEach((s) =>
    s.classList.toggle('screen--active', s.id === id));
}

/* ============================================================================
   3. Game state (persisted to localStorage)
   ========================================================================== */
let state = freshState();
function freshState() {
  return {
    score: 0,
    zoneIndex: 0,
    zoneProgress: 0,      // catches made in the current zone
    pieceSpawned: false,  // has this zone's map piece appeared yet?
    pieces: 0,            // map pieces / chest collected (0..5)
    collected: {},        // emoji -> count, for the Treasure Bag
    calibration: null,    // {a,b,tx,ty,lat0,lng0} once calibrated on-site
    done: false,
  };
}
function save() {
  try { localStorage.setItem(SAVE_KEY, JSON.stringify(state)); } catch (e) {}
}
function load() {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (raw) state = Object.assign(freshState(), JSON.parse(raw));
  } catch (e) { state = freshState(); }
}

/* ============================================================================
   4. Geo math — project lat/lng to meters, then to a 0..1 spot on the map.
   ========================================================================== */
function projectMeters(lat, lng, lat0, lng0) {
  const R = 111320;
  const x = (lng - lng0) * Math.cos((lat0 * Math.PI) / 180) * R; // east (m)
  const y = (lat - lat0) * 110540;                               // north (m)
  return { x, y };
}
// lat/lng -> {fx,fy} fraction of the map image (0..1). Uses on-site calibration
// when available; otherwise a rough pre-seed so the dot at least moves.
function gpsToFraction(lat, lng) {
  const c = state.calibration;
  if (c) {
    const { x, y } = projectMeters(lat, lng, c.lat0, c.lng0);
    return clampFrac(c.a * x - c.b * y + c.tx, c.b * x + c.a * y + c.ty);
  }
  const ctr = CONFIG.resort.center;
  const { x, y } = projectMeters(lat, lng, ctr.lat, ctr.lng);
  return clampFrac(0.5 + x / CONFIG.resort.approxWidthM,
                   0.5 - y / CONFIG.resort.approxHeightM);
}
function clampFrac(fx, fy) {
  return { fx: Math.max(0, Math.min(1, fx)), fy: Math.max(0, Math.min(1, fy)) };
}
// Solve a similarity transform (rotate+scale+translate) from two on-site points.
function solveCalibration(p1, p2) {
  const ctr = CONFIG.resort.center;
  const m1 = projectMeters(p1.lat, p1.lng, ctr.lat, ctr.lng);
  const m2 = projectMeters(p2.lat, p2.lng, ctr.lat, ctr.lng);
  const dx = m2.x - m1.x, dy = m2.y - m1.y;
  const dfx = p2.fx - p1.fx, dfy = p2.fy - p1.fy;
  const det = dx * dx + dy * dy || 1;
  const a = (dx * dfx + dy * dfy) / det;
  const b = (dx * dfy - dy * dfx) / det;
  const tx = p1.fx - (a * m1.x - b * m1.y);
  const ty = p1.fy - (b * m1.x + a * m1.y);
  return { a, b, tx, ty, lat0: ctr.lat, lng0: ctr.lng };
}
// Distance between two map fractions, expressed in approx meters.
function fractionMeters(f1, f2) {
  const dx = (f1.fx - f2.fx) * CONFIG.resort.approxWidthM;
  const dy = (f1.fy - f2.fy) * CONFIG.resort.approxHeightM;
  return Math.hypot(dx, dy);
}

/* ============================================================================
   5. Mode: GPS (iPhone) vs Explorer (no-GPS iPad / desktop)
   ========================================================================== */
let mode = 'unknown';        // 'gps' | 'explorer'
let playerFrac = { fx: 0.5, fy: 0.5 };
let lastFrac = null;
let distSinceSpawn = 0;

function startLocation() {
  if (!('geolocation' in navigator)) { enterExplorer(); return; }
  let decided = false;
  navigator.geolocation.getCurrentPosition(
    (pos) => { if (!decided) { decided = true; enterGps(); } onPosition(pos); },
    ()    => { if (!decided) { decided = true; enterExplorer(); } },
    { enableHighAccuracy: true, timeout: 9000, maximumAge: 0 }
  );
}
function enterGps() {
  mode = 'gps';
  document.body.classList.remove('explorer-mode');
  navigator.geolocation.watchPosition(onPosition, () => {}, {
    enableHighAccuracy: true, maximumAge: 1000, timeout: 15000,
  });
}
function enterExplorer() {
  mode = 'explorer';
  document.body.classList.add('explorer-mode');
  const dot = $('playerDot'); if (dot) dot.style.display = 'none';
  marley("Explorer Mode! Treasures pop up on their own — just tap them! 🐚", 6000);
  // No GPS to flip proximity, so make EVERY treasure tappable right away —
  // including any spawned before GPS detection finished.
  treasures.forEach((t) => { t.collectable = true; t.el.classList.add('treasure--collectable'); });
  refreshAmbient(true);
}
function onPosition(pos) {
  if (mode !== 'gps') return;
  const { latitude, longitude } = pos.coords;
  playerFrac = gpsToFraction(latitude, longitude);
  positionPlayerDot();
  // distance-based backup spawner so there's always something to catch
  if (lastFrac) distSinceSpawn += fractionMeters(playerFrac, lastFrac);
  lastFrac = playerFrac;
  if (distSinceSpawn >= CONFIG.spawnEveryMeters) {
    distSinceSpawn = 0;
    spawnTreasure({ at: playerFrac, collectable: true });
  }
  updateProximity();
  if (calibrating) updateCalibrateLiveFix(latitude, longitude);
}
function positionPlayerDot() {
  const dot = $('playerDot');
  if (!dot || mode !== 'gps') return;
  dot.style.display = '';
  dot.style.left = (playerFrac.fx * 100) + '%';
  dot.style.top  = (playerFrac.fy * 100) + '%';
}

/* ============================================================================
   6. Treasures on the map
   ========================================================================== */
let treasures = [];   // {el, fx, fy, emoji, value, isPiece, collectable}
let started = false;

function zone() { return CONFIG.zones[state.zoneIndex]; }

function randomBandSpot() {
  const z = zone();
  const fx = 0.15 + Math.random() * 0.70;
  const fy = z.band[0] + Math.random() * (z.band[1] - z.band[0]);
  return { fx, fy };
}

function spawnTreasure(opts = {}) {
  const z = zone();
  const isPiece = !!opts.piece;
  const def = isPiece ? z.piece
    : z.treasures[Math.floor(Math.random() * z.treasures.length)];
  const spot = opts.at || randomBandSpot();
  const layer = $('treasureLayer');
  if (!layer) return;

  const el = document.createElement('button');
  el.className = 'treasure' + (isPiece ? ' treasure--piece' : '');
  el.type = 'button';
  el.dataset.emoji = def.emoji;
  el.textContent = def.emoji;
  el.style.left = (spot.fx * 100) + '%';
  el.style.top  = (spot.fy * 100) + '%';

  const t = { el, fx: spot.fx, fy: spot.fy, emoji: def.emoji,
              value: def.value, isPiece,
              collectable: mode === 'explorer' || !!opts.collectable };
  if (t.collectable) el.classList.add('treasure--collectable');
  layer.appendChild(el);
  treasures.push(t);
  return t;
}

// Keep a handful of ambient treasures floating in the current zone's band.
function refreshAmbient(forceCollectable) {
  const ambient = treasures.filter((t) => !t.isPiece);
  while (ambient.length + countAmbient() < CONFIG.ambientTreasures) {
    spawnTreasure({ collectable: forceCollectable });
  }
}
function countAmbient() { return treasures.filter((t) => !t.isPiece).length; }

function clearTreasures() {
  treasures.forEach((t) => t.el.remove());
  treasures = [];
}

// GPS mode: light up treasures within catch range; show the "tap it!" prompt.
function updateProximity() {
  if (mode !== 'gps') return;
  let near = false;
  treasures.forEach((t) => {
    const d = fractionMeters(playerFrac, { fx: t.fx, fy: t.fy });
    t.collectable = d <= CONFIG.catchRadiusM;
    t.el.classList.toggle('treasure--collectable', t.collectable);
    if (t.collectable) near = true;
  });
  $('proximityPrompt') && $('proximityPrompt').classList.toggle('hidden', !near);
}

/* ============================================================================
   7. The catch flow (AR camera screen)
   ========================================================================== */
let pendingCatch = null;

function openCatch(t) {
  if (!t || !t.collectable) return;
  pendingCatch = t;
  hide($('proximityPrompt'));
  hide($('marleyBubble')); // don't let Marley cover the treasure to tap
  showScreen('screen-catch');
  initCamera();
  const layer = $('catchLayer');
  if (layer) {
    layer.innerHTML = '';
    const c = document.createElement('button');
    c.className = 'catch-treasure';
    c.type = 'button';
    c.textContent = t.emoji;
    c.style.left = '50%';   // center horizontally (CSS centers via translate -50%)
    c.style.top = '44%';    // sit above the hint + back button
    on(c, 'click', () => doCatch(c));
    layer.appendChild(c);
  }
  setText('catchHint', t.isPiece ? 'A treasure piece! Tap it! 🗺️' : 'Tap the treasure to catch it! 👆');
}

function doCatch(c) {
  const t = pendingCatch;
  if (!t) return;
  pendingCatch = null;
  playCollect(t.isPiece);
  c.classList.add('catch-treasure--caught');
  sparkleBurst(c);

  // score + bag + progress
  state.score += t.value;
  state.collected[t.emoji] = (state.collected[t.emoji] || 0) + 1;
  state.zoneProgress += 1;
  if (t.isPiece) state.pieces = Math.min(TOTAL_PIECES, state.pieces + 1);
  updateHUD();
  save();

  // remove the caught treasure from the map
  const idx = treasures.indexOf(t);
  if (idx >= 0) { t.el.remove(); treasures.splice(idx, 1); }

  setTimeout(() => {
    showScreen('screen-map');
    afterCatch(t);
  }, 950);
}

function afterCatch(t) {
  const z = zone();
  if (t.isPiece) { zoneComplete(); return; }

  // When the kid is one catch away, reveal the special map piece near them.
  if (!state.pieceSpawned && state.zoneProgress >= z.target - 1) {
    state.pieceSpawned = true;
    const at = mode === 'gps' ? playerFrac
      : { fx: 0.5, fy: (z.band[0] + z.band[1]) / 2 };
    const piece = spawnTreasure({ piece: true, at, collectable: true });
    if (piece) piece.el.classList.add('treasure--collectable');
    marley(z.isFinale ? "There it is — the GRAND CHEST! Tap it! 🧰"
                      : "A map piece appeared! Grab it! 🗺️", 5000);
  } else if (mode === 'explorer') {
    refreshAmbient(true);
  } else {
    refreshAmbient(false);
  }
}

/* ============================================================================
   8. Zones & the win sequence
   ========================================================================== */
function startZone(showIntro) {
  const z = zone();
  state.zoneProgress = 0;
  state.pieceSpawned = false;
  clearTreasures();
  setText('zoneName', z.name);
  updateHUD();
  if (showIntro) {
    setText('zoneBannerEmoji', z.bannerEmoji);
    setText('zoneBannerName', z.name);
    flashBanner();
    marley(z.intro, 6500);
  }
  if (z.safety) showSafety(z.safety);
  refreshAmbient(mode === 'explorer');
}

function zoneComplete() {
  const z = zone();
  if (z.isFinale) { win(); return; }
  playZoneChime();
  marley("Hooray! Zone cleared! 🎉 Drive to the next stop, then tap “We made it!”", 6000);
  const b = $('btnWeMadeIt');
  if (b) b.classList.add('btn--ready');
}

function advanceZone() {
  if (state.done) return;
  if (state.zoneIndex >= CONFIG.zones.length - 1) {
    // On the last zone, the button nudges toward the chest instead of advancing.
    marley("We're at the beach! Catch treasures to make the GRAND CHEST appear! 🏴‍☠️", 5000);
    return;
  }
  state.zoneIndex += 1;
  const b = $('btnWeMadeIt'); if (b) b.classList.remove('btn--ready');
  save();
  startZone(true);
}

function win() {
  state.done = true;
  save();
  playWin();
  setText('winScore', `You scored ${state.score} points and found all ${state.pieces} treasures! 🏆`);
  showScreen('screen-win');
  confettiRain();
}

function playAgain() {
  const keepCal = state.calibration;
  state = freshState();
  state.calibration = keepCal;
  save();
  clearTreasures();
  showScreen('screen-map');
  startZone(true);
}

/* ============================================================================
   9. HUD, Marley, banner, safety, Treasure Bag
   ========================================================================== */
function updateHUD() {
  setText('scoreValue', state.score);
  setText('mapPieceValue', state.pieces);
  setText('zoneName', zone().name);
}

let marleyTimer = null;
function marley(text, ms = 5000) {
  const bub = $('marleyBubble');
  if (!bub) return;
  setText('marleyText', text);
  show(bub);
  clearTimeout(marleyTimer);
  marleyTimer = setTimeout(() => hide(bub), ms);
}

let bannerTimer = null;
function flashBanner() {
  const b = $('zoneBanner');
  if (!b) return;
  show(b);
  clearTimeout(bannerTimer);
  bannerTimer = setTimeout(() => hide(b), 2600);
}

function showSafety(text) {
  setText('safetyText', text);
  show($('safetyCard'));
}

function renderBag() {
  const grid = $('bagGrid');
  if (!grid) return;
  grid.innerHTML = '';
  const entries = Object.entries(state.collected);
  if (!entries.length) {
    grid.innerHTML = '<p class="bag-empty">No treasure yet — go catch some! 🐚</p>';
  } else {
    entries.forEach(([emoji, count]) => {
      const tile = document.createElement('div');
      tile.className = 'bag-tile';
      tile.innerHTML = `<span class="bag-tile__emoji">${emoji}</span>` +
                       `<span class="bag-tile__count">×${count}</span>`;
      grid.appendChild(tile);
    });
  }
  setText('bagTotal', `Score: ${state.score}  •  Map pieces: ${state.pieces}/${TOTAL_PIECES}`);
}

/* ============================================================================
   10. On-site calibration (2 taps on the map)
   ========================================================================== */
let calibrating = false;
let calStep = 0;
let calPoints = [];
let liveFix = null;

const CAL_PROMPTS = [
  'Stand by the big VENTURE OUT sign at the entrance, then tap that sign on the map. 📍',
  'Now go to the FISHING PIER (top of the map) and tap the pier. 📍',
];

function startCalibrate() {
  if (mode !== 'gps') { marley('Calibrate needs GPS — try it on the iPhone! 📱', 5000); return; }
  calibrating = true; calStep = 0; calPoints = [];
  show($('calibrateHint'));
  setText('calibrateHint', CAL_PROMPTS[0]);
  marley("Let's teach the map where we are! Two quick taps.", 5000);
}
function updateCalibrateLiveFix(lat, lng) { liveFix = { lat, lng }; }

function onMapTap(ev) {
  if (!calibrating || !liveFix) return;
  const vp = $('mapViewport');
  if (!vp) return;
  const r = vp.getBoundingClientRect();
  const fx = (ev.clientX - r.left) / r.width;
  const fy = (ev.clientY - r.top) / r.height;
  calPoints.push({ lat: liveFix.lat, lng: liveFix.lng, fx, fy });
  calStep += 1;
  if (calStep < CAL_PROMPTS.length) {
    setText('calibrateHint', CAL_PROMPTS[calStep]);
  } else {
    state.calibration = solveCalibration(calPoints[0], calPoints[1]);
    save();
    calibrating = false;
    hide($('calibrateHint'));
    marley('All set! The map knows where you are now. 🧭', 5000);
  }
}

/* ============================================================================
   11. Camera (rear) with graceful fallback
   ========================================================================== */
let cameraStream = null;
async function initCamera() {
  if (cameraStream) return true;
  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
    document.body.classList.add('no-camera'); return false;
  }
  try {
    cameraStream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: { ideal: 'environment' } }, audio: false,
    });
    const v = $('cameraVideo');
    if (v) { v.srcObject = cameraStream; v.play().catch(() => {}); }
    document.body.classList.remove('no-camera');
    return true;
  } catch (e) {
    document.body.classList.add('no-camera');
    return false;
  }
}

/* ============================================================================
   12. Sound — synthesized with Web Audio (no audio files needed)
   ========================================================================== */
let actx = null;
function unlockAudio() {
  try {
    actx = actx || new (window.AudioContext || window.webkitAudioContext)();
    if (actx.state === 'suspended') actx.resume();
  } catch (e) {}
}
function tone(freq, dur, type = 'sine', vol = 0.2, when = 0) {
  if (!actx) return;
  const t = actx.currentTime + when;
  const o = actx.createOscillator(), g = actx.createGain();
  o.type = type; o.frequency.value = freq;
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(vol, t + 0.012);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g).connect(actx.destination);
  o.start(t); o.stop(t + dur + 0.03);
}
function playTap()  { tone(440, 0.08, 'square', 0.12); }
function playCollect(isPiece) {
  tone(880, 0.10, 'triangle', 0.18);
  tone(1320, 0.12, 'triangle', 0.16, 0.07);
  if (isPiece) { tone(1760, 0.16, 'triangle', 0.16, 0.16); tone(2640, 0.20, 'sine', 0.12, 0.28); }
}
function playZoneChime() { [523, 659, 784, 1046].forEach((f, i) => tone(f, 0.16, 'triangle', 0.16, i * 0.10)); }
function playWin() {
  [523, 659, 784, 1046, 1318, 1046, 1318, 1568].forEach((f, i) =>
    tone(f, 0.22, 'triangle', 0.18, i * 0.16));
}

/* ============================================================================
   13. Particle effects
   ========================================================================== */
function sparkleBurst(anchor) {
  const host = $('catchLayer') || document.body;
  const r = anchor.getBoundingClientRect();
  const hostR = host.getBoundingClientRect();
  const cx = r.left - hostR.left + r.width / 2;
  const cy = r.top - hostR.top + r.height / 2;
  for (let i = 0; i < 12; i++) {
    const s = document.createElement('span');
    s.className = 'sparkle';
    s.textContent = ['✨', '⭐', '💫', '🌟'][i % 4];
    s.style.left = cx + 'px';
    s.style.top = cy + 'px';
    s.style.setProperty('--dx', (Math.random() * 160 - 80).toFixed(0) + 'px');
    s.style.setProperty('--dy', (Math.random() * -160 - 20).toFixed(0) + 'px');
    s.style.setProperty('--r', (Math.random() * 360 - 180).toFixed(0) + 'deg');
    host.appendChild(s);
    setTimeout(() => s.remove(), 750);
  }
}
function confettiRain() {
  const host = $('screen-win') || document.body;
  const colors = ['#FFC940', '#FF6B5C', '#2EC4D6', '#2BC48A', '#7A4BAD', '#FF8A4C'];
  for (let i = 0; i < 80; i++) {
    const c = document.createElement('span');
    c.className = 'confetti';
    c.style.left = Math.random() * 100 + '%';
    c.style.background = colors[i % colors.length];
    c.style.setProperty('--delay', (Math.random() * 1.2).toFixed(2) + 's');
    c.style.setProperty('--dur', (1.6 + Math.random() * 1.6).toFixed(2) + 's');
    c.style.setProperty('--rot', (Math.random() * 720 - 360).toFixed(0) + 'deg');
    host.appendChild(c);
    setTimeout(() => c.remove(), 4000);
  }
}

/* ============================================================================
   14. Offline readiness + Service Worker
   ========================================================================== */
function registerSW() {
  if (!('serviceWorker' in navigator)) { offlineGate(false); return; }
  navigator.serviceWorker.register('./sw.js').catch(() => {});
  navigator.serviceWorker.ready.then(() => checkOfflineReady())
    .catch(() => offlineGate(false));
  if (navigator.serviceWorker.controller) checkOfflineReady();
}
async function checkOfflineReady() {
  try {
    const hit = await caches.match('./index.html') || await caches.match('./');
    offlineGate(!!hit);
  } catch (e) { offlineGate(false); }
}
function offlineGate(ready) {
  const g = $('offlineGate');
  if (!g) return;
  show(g);
  if (ready) {
    g.classList.add('gate--ready');
    setText('offlineGateIcon', '✅');
    setText('offlineGateText', 'Ready to play offline!');
    setTimeout(() => hide(g), 4500);
  } else {
    setText('offlineGateIcon', '⏳');
    setText('offlineGateText', 'Getting ready… stay on Wi-Fi a moment.');
  }
}

/* ============================================================================
   15. Wire up the UI + boot
   ========================================================================== */
function startGame() {
  unlockAudio();
  initCamera();           // ask for camera early (we have a user gesture)
  if (navigator.storage && navigator.storage.persist) {
    navigator.storage.persist().catch(() => {});
  }
  started = true;
  showScreen('screen-map');
  const pd = $('playerDot'); if (pd) pd.style.display = 'none'; // shown on first GPS fix
  updateHUD();
  startLocation();
  startZone(true);
  setInterval(() => {
    if (started && !state.done) {
      marley('🛟 Marley says: stay seated and keep your spyglass inside the cart!', 5000);
    }
  }, CONFIG.safetyReminderMs);
}

function bindUI() {
  on($('btnStart'), 'click', () => { playTap(); startGame(); });
  on($('btnOpenBag'), 'click', () => { playTap(); renderBag(); showScreen('screen-bag'); });
  on($('btnBagBack'), 'click', () => { playTap(); showScreen('screen-map'); });
  on($('btnCalibrate'), 'click', () => { playTap(); startCalibrate(); });
  on($('btnWeMadeIt'), 'click', () => { playTap(); advanceZone(); });
  on($('btnCatchBack'), 'click', () => { playTap(); pendingCatch = null; showScreen('screen-map'); });
  on($('btnSafetyOk'), 'click', () => { playTap(); hide($('safetyCard')); });
  on($('btnPlayAgain'), 'click', () => { playTap(); playAgain(); });

  // Tap a treasure on the map -> open the catch screen (only if it's in range).
  on($('treasureLayer'), 'click', (e) => {
    if (calibrating) return; // during calibration, taps are for placing points
    const el = e.target.closest('.treasure');
    if (!el) return;
    const t = treasures.find((x) => x.el === el);
    if (t && t.collectable) openCatch(t);
    else marley('Get a little closer to catch that one! 🚗💨', 3000);
  });

  // Map taps are used during calibration (bound to the viewport because
  // #mapImg has pointer-events:none).
  on($('mapViewport'), 'click', onMapTap);
}

function boot() {
  load();
  bindUI();
  registerSW();
  updateHUD();
  setText('zoneName', zone().name);
  showScreen('screen-title');
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', boot);
} else {
  boot();
}

/* ----------------------------------------------------------------------------
   Debug helpers (for testing on a desktop with no GPS).
   In the browser console:  MTH.start()  MTH.explorer()  MTH.give('🪙')  MTH.zone(4)
   -------------------------------------------------------------------------- */
window.MTH = {
  get state() { return state; },
  start: () => startGame(),
  explorer: () => { enterExplorer(); },
  spawn: (collectable = true) => spawnTreasure({ collectable }),
  give: (emoji = '🪙') => { const t = spawnTreasure({ collectable: true }); if (t) { t.emoji = emoji; t.el.textContent = emoji; } },
  zone: (i) => { state.zoneIndex = Math.max(0, Math.min(CONFIG.zones.length - 1, i)); startZone(true); },
  win: () => win(),
  reset: () => { localStorage.removeItem(SAVE_KEY); location.reload(); },
};
})();
