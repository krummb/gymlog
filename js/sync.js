// Firestore sync, an optional layer on top of store.js.
// localStorage stays the instant, offline source for the UI. Firestore mirrors it per signed-in user:
//   users/{uid}/data/config      exercises, workouts, settings (except per-device Appearance)
//   users/{uid}/sessions/{key}   one doc per workout session, key = session start (ISO)
// If the Firebase SDK cannot load (offline first run), the app keeps working locally.
import { firebaseConfig } from "./firebase-config.js";

const SDK = "https://www.gstatic.com/firebasejs/12.0.0";
const FLAG = "gymlog.sync.attached."; // + uid: set once this device has reconciled with the account

// ---------- pure helpers (no Firebase; unit-testable in node) ----------
// Canonical string: object key order doesn't matter (Firestore does not keep it), undefined is dropped.
export function canon(v) {
  if (Array.isArray(v)) return "[" + v.map(canon).join(",") + "]";
  if (v && typeof v === "object") {
    return "{" + Object.keys(v).filter((k) => v[k] !== undefined).sort().map((k) => JSON.stringify(k) + ":" + canon(v[k])).join(",") + "}";
  }
  return JSON.stringify(v) ?? "null";
}
export const plain = (o) => JSON.parse(JSON.stringify(o)); // Firestore rejects undefined

export function configOf(db) {
  const { mode, ...settings } = db.settings || {}; // Appearance stays per device
  return plain({ seed: db.seed, exercises: db.exercises, workouts: db.workouts, settings });
}

// Date of the newest finished workout recorded in a config (exercise.last.date), "" if none
export function activity(config) {
  let m = "";
  for (const e of Object.values(config?.exercises || {})) if (e.last?.date && e.last.date > m) m = e.last.date;
  return m;
}

// First time a device attaches to the account: the side with the newer workout wins.
export function pickConfig(local, remote) {
  if (!remote) return "local";
  return activity(local) > activity(remote) ? "local" : "remote";
}

// ---------- status (read by the Settings screen) ----------
const st = { state: "off", user: "", error: "", pending: 0 };
const listeners = new Set();
export const status = () => ({ ...st, online: navigator.onLine });
export const onStatus = (fn) => listeners.add(fn);
function setSt(p) { Object.assign(st, p); listeners.forEach((f) => f()); }
const friendly = (e) => String(e?.code || e?.message || e);

// ---------- Firebase wiring ----------
let F = null;          // { authM, fsM, auth, fs }
let ctx = null;        // { getDb, afterRemote }
let uid = null;
let unsubs = [];
let timer = null;
let sent = { config: "", sessions: {} }; // canonical form of what Firestore is known to hold
let ready = { config: false, sessions: false };

async function loadSdk() {
  if (F) return F;
  const [appM, authM, fsM] = await Promise.all([
    import(`${SDK}/firebase-app.js`),
    import(`${SDK}/firebase-auth.js`),
    import(`${SDK}/firebase-firestore.js`),
  ]);
  const cfg = { ...firebaseConfig };
  // On Firebase Hosting, use the page's own domain for sign-in so the redirect flow works inside the iPhone PWA.
  if (/\.(web\.app|firebaseapp\.com)$/.test(location.hostname)) cfg.authDomain = location.hostname;
  const app = appM.initializeApp(cfg);
  const auth = authM.getAuth(app);
  let fs;
  try {
    fs = fsM.initializeFirestore(app, { localCache: fsM.persistentLocalCache({ tabManager: fsM.persistentMultipleTabManager() }) });
  } catch (e) {
    console.warn("Offline cache unavailable, using memory cache", e);
    fs = fsM.getFirestore(app);
  }
  F = { authM, fsM, auth, fs };
  return F;
}

let listening = false;
export async function start(c) {
  if (c) {
    ctx = c;
    addEventListener("online", () => { if (st.state === "unavailable") start(); else setSt({}); });
    addEventListener("offline", () => setSt({}));
    addEventListener("pagehide", flush);
    document.addEventListener("visibilitychange", () => { if (document.hidden) flush(); });
  }
  if (listening) return;
  setSt({ state: "loading", error: "" });
  try { await loadSdk(); }
  catch (e) { setSt({ state: "unavailable", error: "Could not load Firebase (offline?)" }); return; }
  listening = true;
  try { await F.authM.getRedirectResult(F.auth); } catch (e) { setSt({ error: friendly(e) }); }
  F.authM.onAuthStateChanged(F.auth, (u) => (u ? attach(u) : detach()));
}

function detach() {
  unsubs.forEach((u) => u());
  unsubs = []; uid = null; clearTimeout(timer);
  sent = { config: "", sessions: {} }; ready = { config: false, sessions: false };
  setSt({ state: "signedout", user: "", pending: 0 });
}

function attach(user) {
  detach();
  uid = user.uid;
  setSt({ state: "signedin", user: user.displayName || user.email || "your account", error: "" });
  const { fs, fsM } = F;
  const first = !localStorage.getItem(FLAG + uid); // first time this device meets this account
  const markAttached = () => { if (first && ready.config && ready.sessions) try { localStorage.setItem(FLAG + uid, "1"); } catch (e) {} };
  const onErr = (e) => setSt({ error: friendly(e) });

  // Nothing is written until we have seen what Firestore already holds ("ready"), so a stale device can't clobber newer data.
  // config doc
  unsubs.push(fsM.onSnapshot(cfgRef(), { includeMetadataChanges: true }, (snap) => {
    if (snap.metadata.hasPendingWrites) return;           // our own write, not yet confirmed
    const fromServer = !snap.metadata.fromCache;
    const remote = snap.exists() ? snap.data() : null;
    const db = ctx.getDb();
    if (!ready.config) {
      if (!(fromServer || (!first && remote))) return;    // first meeting: wait for the server; later: the offline cache is enough
      ready.config = true; markAttached();
      if (!remote || (first && pickConfig(configOf(db), remote) === "local")) { flush(); return; } // this device's config becomes the account's
    }
    if (!remote) { if (fromServer) flush(); return; }
    const rc = canon(remote);
    if (rc === sent.config) return;
    if (rc === canon(configOf(db))) { sent.config = rc; return; } // already identical, nothing to redraw
    db.seed = remote.seed ?? db.seed;
    db.exercises = remote.exercises || db.exercises;
    db.workouts = remote.workouts || db.workouts;
    db.settings = { ...remote.settings, mode: db.settings.mode };
    sent.config = rc;
    ctx.afterRemote();
  }, onErr));

  // session docs
  unsubs.push(fsM.onSnapshot(fsM.collection(fs, "users", uid, "sessions"), { includeMetadataChanges: true }, (snap) => {
    const db = ctx.getDb();
    let changed = false;
    snap.docChanges().forEach((ch) => {
      if (ch.type === "removed" || ch.doc.metadata.hasPendingWrites) return;
      const data = ch.doc.data(), c = canon(data);
      if (sent.sessions[ch.doc.id] === c) return;
      db.sessions[ch.doc.id] = data;                      // same key on both sides: the account's copy wins
      sent.sessions[ch.doc.id] = c;
      changed = true;
    });
    if (!ready.sessions && (!snap.metadata.fromCache || (!first && snap.size > 0))) {
      ready.sessions = true; markAttached();
      flush();                                            // sessions recorded here before sign-in go up now
    }
    if (changed) ctx.afterRemote();
  }, onErr));
}

const cfgRef = () => F.fsM.doc(F.fs, "users", uid, "data", "config");

// Called after every local save (store.js). Cheap no-op until signed in and reconciled.
export function push() {
  if (!F || !uid) return;
  clearTimeout(timer);
  timer = setTimeout(flush, 300);
}

function write(ref, data, forget) {
  st.pending++; setSt({});
  F.fsM.setDoc(ref, data)
    .then(() => { st.pending--; setSt({}); })
    .catch((e) => { st.pending--; forget(); setSt({ error: friendly(e) }); });
}

function flush() {
  if (!F || !uid || !ctx) return;
  clearTimeout(timer);
  const db = ctx.getDb();
  if (ready.config) {
    const cfg = configOf(db), cc = canon(cfg);
    if (cc !== sent.config) { sent.config = cc; write(cfgRef(), cfg, () => { sent.config = ""; }); }
  }
  if (ready.sessions) {
    for (const [k, s] of Object.entries(db.sessions)) {
      const sc = canon(s);
      if (sc !== sent.sessions[k]) {
        sent.sessions[k] = sc;
        write(F.fsM.doc(F.fs, "users", uid, "sessions", k), plain(s), () => { delete sent.sessions[k]; });
      }
    }
  }
}

export async function signIn() {
  setSt({ error: "" });
  await start();                // loads the SDK and starts listening if that hasn't happened yet
  if (!F) return;
  const { authM, auth } = F;
  const provider = new authM.GoogleAuthProvider();
  const standalone = navigator.standalone || matchMedia("(display-mode: standalone)").matches;
  try {
    if (standalone) return await authM.signInWithRedirect(auth, provider); // popups are unreliable in an installed iPhone app
    await authM.signInWithPopup(auth, provider);
  } catch (e) {
    if (e.code === "auth/popup-blocked" || e.code === "auth/operation-not-supported-in-this-environment") return authM.signInWithRedirect(auth, provider);
    if (e.code !== "auth/popup-closed-by-user" && e.code !== "auth/cancelled-popup-request") setSt({ error: friendly(e) });
  }
}

export async function signOut() {
  if (F) await F.authM.signOut(F.auth);
}
