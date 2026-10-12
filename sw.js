// Offline cache. Bump VERSION when files change.
const VERSION = "gymlog-0.3.0";
const FILES = ["./", "index.html", "css/c2.css", "js/app.js", "js/logic.js", "js/store.js", "js/seed.js", "js/sync.js", "js/firebase-config.js", "manifest.webmanifest", "icon.svg", "icon-180.png", "icon-192.png", "icon-512.png"];
self.addEventListener("install", (e) => { e.waitUntil(caches.open(VERSION).then((c) => c.addAll(FILES))); self.skipWaiting(); });
self.addEventListener("activate", (e) => { e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== VERSION).map((k) => caches.delete(k))))); self.clients.claim(); });
// Network first (so updates arrive), cache as fallback (so the gym basement works).
// Only our own files and the Firebase SDK are handled. Firestore/Auth traffic (long-lived streams) and
// Firebase's /__/ sign-in pages must pass straight through, never be cached.
self.addEventListener("fetch", (e) => {
  if (e.request.method !== "GET") return;
  const u = new URL(e.request.url);
  const ours = u.origin === location.origin && !u.pathname.startsWith("/__/");
  const sdk = u.origin === "https://www.gstatic.com" && u.pathname.startsWith("/firebasejs/");
  if (!ours && !sdk) return;
  e.respondWith(fetch(e.request).then((r) => { if (r.ok) { const copy = r.clone(); caches.open(VERSION).then((c) => c.put(e.request, copy)); } return r; }).catch(() => caches.match(e.request, { ignoreSearch: true })));
});
