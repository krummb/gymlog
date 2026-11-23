// Offline cache. Bump VERSION when files change.
importScripts("version.js");
const VERSION = "gymlog-" + self.APP_VERSION;
const FILES = ["./", "index.html", "css/c2.css", "js/app.js", "js/logic.js", "js/store.js", "js/seed.js", "js/guides.js", "js/sync.js", "js/alts.js", "manifest.webmanifest", "version.js", "icon.svg", "icon-180.png", "icon-192.png", "icon-512.png"];
// Exercise pictures (img/<id>-1.webp, -2.webp) are precached best-effort: missing ones are skipped, a missing picture never breaks the install
const IDS = ["db_bench", "seated_row", "db_shoulder_press", "cable_lateral", "triceps_pushdown", "face_pull", "goblet_squat", "db_rdl", "db_split_squat", "calf_raise", "hanging_knee_raise", "pull_up", "incline_db_press", "one_arm_row", "reverse_fly", "lateral_raise", "cable_curl", "dips", "deadlift", "db_bulgarian", "ham_curl", "hip_thrust", "farmers_carry", "plank", "back_squat", "bench_press", "overhead_press", "barbell_rdl", "trap_bar_deadlift", "chin_up", "weighted_pull_up", "weighted_dips", "push_up", "inverted_row", "ab_wheel", "back_extension", "cable_fly", "one_arm_cable_row", "overhead_triceps_ext", "incline_db_curl", "hammer_curl", "cable_pull_through", "cable_crunch", "pallof_press", "db_reverse_lunge", "db_step_up", "prone_leg_curl", "db_hip_thrust", "glute_bridge"];
const IMGS = IDS.flatMap((id) => [1, 2].map((n) => `img/${id}-${n}.webp`));
// Pictures live in their own cache that survives version updates: a picture that fails to download (bad reception)
// keeps its old copy instead of disappearing. Revalidated in the background on install (cheap 304s when unchanged).
const IMGCACHE = "gymlog-img";
const isImg = (url) => new URL(url).pathname.includes("/img/");
self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(VERSION).then((c) => c.addAll(FILES)));
  caches.open(IMGCACHE).then((c) => Promise.allSettled(IMGS.map((u) => fetch(u, { cache: "no-cache" }).then((r) => { if (r.ok) return c.put(u, r); }))));
  self.skipWaiting();
});
self.addEventListener("activate", (e) => { e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== VERSION && k !== IMGCACHE).map((k) => caches.delete(k))))); self.clients.claim(); });
// Network with a 4 s limit (so updates arrive, but weak reception never hangs the app), cache as fallback.
// Pictures: cache first, network only for ones not cached yet.
const timeout = (p, ms) => new Promise((res, rej) => { const t = setTimeout(() => rej(new Error("timeout")), ms); p.then((r) => { clearTimeout(t); res(r); }, (e) => { clearTimeout(t); rej(e); }); });
self.addEventListener("fetch", (e) => {
  if (e.request.method !== "GET" || new URL(e.request.url).origin !== location.origin) return; // only our own files (never GitHub API calls)
  if (isImg(e.request.url)) {
    e.respondWith(caches.open(IMGCACHE).then((c) => c.match(e.request, { ignoreSearch: true }).then((hit) => hit || fetch(e.request).then((r) => { if (r.ok) c.put(e.request, r.clone()); return r; }))));
    return;
  }
  e.respondWith(timeout(fetch(e.request, { cache: "no-cache" }), 4000).then((r) => { const copy = r.clone(); caches.open(VERSION).then((c) => c.put(e.request, copy)); return r; })
    .catch(() => caches.match(e.request, { ignoreSearch: true }).then((hit) => hit || fetch(e.request))));
});
