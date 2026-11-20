// Offline cache. Bump VERSION when files change.
importScripts("version.js");
const VERSION = "gymlog-" + self.APP_VERSION;
const FILES = ["./", "index.html", "css/c2.css", "js/app.js", "js/logic.js", "js/store.js", "js/seed.js", "js/guides.js", "js/sync.js", "manifest.webmanifest", "version.js", "icon.svg", "icon-180.png", "icon-192.png", "icon-512.png"];
// Exercise pictures (img/<id>-1.webp, -2.webp) are precached best-effort: missing ones are skipped, a missing picture never breaks the install
const IDS = ["db_bench", "seated_row", "db_shoulder_press", "cable_lateral", "triceps_pushdown", "face_pull", "goblet_squat", "db_rdl", "db_split_squat", "calf_raise", "hanging_knee_raise", "pull_up", "incline_db_press", "one_arm_row", "reverse_fly", "lateral_raise", "cable_curl", "dips", "deadlift", "db_bulgarian", "ham_curl", "hip_thrust", "farmers_carry", "plank", "back_squat", "bench_press", "overhead_press", "barbell_rdl", "trap_bar_deadlift", "chin_up", "weighted_pull_up", "weighted_dips", "push_up", "inverted_row", "ab_wheel", "back_extension", "cable_fly", "one_arm_cable_row", "overhead_triceps_ext", "incline_db_curl", "hammer_curl", "cable_pull_through", "cable_crunch", "pallof_press", "db_reverse_lunge", "db_step_up"];
const IMGS = IDS.flatMap((id) => [1, 2].map((n) => `img/${id}-${n}.webp`));
self.addEventListener("install", (e) => { e.waitUntil(caches.open(VERSION).then((c) => c.addAll(FILES).then(() => Promise.allSettled(IMGS.map((u) => c.add(u)))))); self.skipWaiting(); });
self.addEventListener("activate", (e) => { e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== VERSION).map((k) => caches.delete(k))))); self.clients.claim(); });
// Network first (so updates arrive), cache as fallback (so the gym basement works)
self.addEventListener("fetch", (e) => {
  if (e.request.method !== "GET" || new URL(e.request.url).origin !== location.origin) return; // only our own files (never GitHub API calls)
  e.respondWith(fetch(e.request, { cache: "no-cache" }).then((r) => { const copy = r.clone(); caches.open(VERSION).then((c) => c.put(e.request, copy)); return r; }).catch(() => caches.match(e.request, { ignoreSearch: true })));
});
