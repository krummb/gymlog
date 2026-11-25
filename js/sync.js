// Optional one-way backup to a private GitHub repo, so the data can be read without exporting from the phone.
// Writes two files: gymlog.json (everything) and log.md (readable: current weights + finished sessions, newest first).
// Settings (repo, token) live in their own localStorage key, never inside the exported data.
import { missingSessions } from "./store.js";
const KEY = "gymlog.sync.v1";
let busy = false, onChange = () => {};

const read = () => { try { return JSON.parse(localStorage.getItem(KEY)) || {}; } catch (e) { return {}; } };
const write = (c) => { try { localStorage.setItem(KEY, JSON.stringify(c)); } catch (e) {} };

export const config = () => ({ repo: "krummb/gymlog-data", branch: "main", token: "", pending: false, last: null, err: null, hash: {}, ...read() });
export const configured = () => { const c = config(); return !!(c.token && c.repo); };
export function setConfig(patch) { write({ ...config(), ...patch }); onChange(); }
export const setListener = (fn) => { onChange = fn; };

const b64 = (s) => { const b = new TextEncoder().encode(s); let t = ""; for (let i = 0; i < b.length; i += 0x8000) t += String.fromCharCode(...b.subarray(i, i + 0x8000)); return btoa(t); };
const hashOf = (s) => { let h = 5381; for (let i = 0; i < s.length; i++) h = ((h * 33) ^ s.charCodeAt(i)) >>> 0; return String(h) + ":" + s.length; };
const fmtDate = (iso) => iso.slice(0, 10);

function setsText(ex, sets) {
  if (!sets.length) return "-";
  const unit = ex.type === "timed" ? "s" : ex.repUnit || "";
  if (ex.type === "timed") {
    const sides = ex.per === "direction" ? ["front", "back", "left", "right"] : ex.per === "leg" || ex.per === "side" ? ["L", "R"] : null;
    return sets.map((s, i) => (sides ? sides[i % sides.length] + " " : "") + (s.kg ? `${s.reps} s (+${s.kg} kg)` : `${s.reps} s`)).join(", ");
  }
  const groups = [];
  for (const s of sets) {
    const g = groups[groups.length - 1];
    if (g && g.kg === s.kg) g.reps.push(s.reps); else groups.push({ kg: s.kg, reps: [s.reps] });
  }
  return groups.map((g) => `${g.kg ? g.kg + " kg" : "BW"} × ${g.reps.join(", ")}${unit && unit !== "s" ? " " + unit : ""}`).join(" | ");
}

export function buildLog(db) {
  const L = [`# GymLog results`, ``, `Generated ${new Date().toISOString()} · kg · weights for dumbbells are per hand · reps listed per set in order · timed per-leg/side holds listed L, R in order`, ``];
  L.push(`## Current exercise weights`, ``);
  for (const e of Object.values(db.exercises)) {
    if (!e.last) continue;
    const w = e.last.kg != null ? (e.type === "timed" ? `${e.last.top} s` : `${e.last.kg} kg`) : "BW";
    L.push(`- ${e.name}: ${w}${e.last.baseline ? " (typed starting weight)" : ` (${e.last.date ? fmtDate(e.last.date) : "?"})`}`);
  }
  L.push(``, `## Sessions (newest first)`, ``);
  const sessions = Object.values(db.sessions).sort((a, b) => (b.startedAt || "").localeCompare(a.startedAt || ""));
  for (const s of sessions) {
    const p = db.programs && db.programs[s.program];
    const w = (p ? p.workouts : db.workouts)[s.workout];
    const mins = s.finishedAt ? Math.round((new Date(s.finishedAt) - new Date(s.startedAt)) / 60000) : null;
    L.push(`### ${fmtDate(s.startedAt)} · ${p ? p.code + " · " : ""}Workout ${s.workout}${w ? " · " + w.name : ""}${s.short ? " · short version" : ""}${mins != null ? ` · ${mins} min` : " · in progress / unfinished"}`);
    if (s.warmup) L.push(`- Warm-up: ${s.warmEx ? s.warmEx : s.warmup === true ? "done" : s.warmup}${s.warmSec ? ` (${Math.round(s.warmSec / 60)} min)` : ""}`);
    const order = w ? w.items.map((i) => i.ex).filter((id) => s.entries[id]) : [];
    for (const id of Object.keys(s.entries)) if (!order.includes(id)) order.push(id);
    for (const id of order) {
      const en = s.entries[id], ex = db.exercises[id];
      if (!ex) continue;
      const body = en.status === "skipped" ? "skipped" : setsText(ex, en.sets || []);
      const m = en.machine && Object.keys(en.machine).length ? en.machine : null;
      const mt = m ? " · machine: " + [m.type, m.dist && m.dist + " km", m.kcal && m.kcal + " kcal", m.hr && "avg HR " + m.hr, m.watts && "avg " + m.watts + " W", m.pace && m.pace + "/500 m", m.rate && "rate " + m.rate, m.level && "level " + m.level].filter(Boolean).join(", ") : "";
      L.push(`- ${ex.name}: ${body}${mt}`);
    }
    L.push(``);
  }
  return L.join("\n");
}

// The repo's gymlog.json (null if there is none yet)
export async function fetchRemote() {
  const c = config();
  const r = await fetch(`https://api.github.com/repos/${c.repo}/contents/gymlog.json?ref=${encodeURIComponent(c.branch)}`,
    { headers: { Authorization: `Bearer ${c.token}`, Accept: "application/vnd.github.raw+json", "X-GitHub-Api-Version": "2022-11-28" }, cache: "no-store" });
  if (r.status === 404) return null;
  if (!r.ok) throw new Error(r.status === 401 || r.status === 403 ? "Token refused (check it and its repo access)" : `GitHub said ${r.status}`);
  return JSON.parse(await r.text());
}

async function put(c, path, text, message) {
  const url = `https://api.github.com/repos/${c.repo}/contents/${path}`;
  const h = { Authorization: `Bearer ${c.token}`, Accept: "application/vnd.github+json", "X-GitHub-Api-Version": "2022-11-28" };
  let sha;
  const g = await fetch(`${url}?ref=${encodeURIComponent(c.branch)}`, { headers: h, cache: "no-store" });
  if (g.ok) sha = (await g.json()).sha;
  else if (g.status !== 404) throw new Error(g.status === 401 || g.status === 403 ? "Token refused (check it and its repo access)" : `GitHub said ${g.status}`);
  const r = await fetch(url, { method: "PUT", headers: { ...h, "Content-Type": "application/json" }, body: JSON.stringify({ message, content: b64(text), branch: c.branch, ...(sha ? { sha } : {}) }) });
  if (!r.ok) throw new Error(r.status === 404 ? "Repo not found (create it first, private, and give the token access)" : r.status === 401 || r.status === 403 ? "Token refused (needs Contents: read and write)" : `GitHub said ${r.status}`);
}

// Push now (skips files that did not change since the last successful push)
export async function flush(db, force = false) {
  const c = config();
  if (!c.token || !c.repo || busy) return;
  if (!navigator.onLine) { setConfig({ pending: true }); return; }
  busy = true; onChange();
  try {
    // Never overwrite workouts this phone doesn't have (e.g. a fresh copy of the app): stop and offer Restore instead
    const remote = await fetchRemote();
    const miss = remote ? missingSessions(db, remote) : [];
    if (miss.length) { busy = false; setConfig({ pending: true, conflict: miss.length, err: `The repo has ${miss.length} workout${miss.length === 1 ? "" : "s"} this phone doesn't have. Nothing was sent. Tap “Restore from GitHub”.` }); return; }
    const files = { "gymlog.json": JSON.stringify(db, null, 2), "log.md": buildLog(db) };
    const hash = { ...c.hash };
    for (const [path, text] of Object.entries(files)) {
      const hh = hashOf(text);
      if (!force && hash[path] === hh) continue;
      await put(c, path, text, `GymLog ${new Date().toISOString().slice(0, 16).replace("T", " ")}`);
      hash[path] = hh;
    }
    busy = false; setConfig({ pending: false, last: new Date().toISOString(), err: null, conflict: 0, hash });
  } catch (e) {
    busy = false; setConfig({ pending: true, err: String(e.message || e) });
  }
}

// Call after any change to the data: only marks it as unsent. The push happens on finishing a workout, when the app is left,
// when the phone is back online, on opening the app, or via Sync now (keeps the commit history short).
export function touch() {
  if (!configured()) return;
  if (!config().pending) setConfig({ pending: true });
}

export const busyNow = () => busy;

// PT targets for the next session: next.json in the same repo (written by the dev chat from the PT doc).
// Read with the same token, kept on the phone for offline use (own key, not part of backups).
const NKEY = "gymlog.next.v1";
export const nextTargets = () => { try { return JSON.parse(localStorage.getItem(NKEY)) || null; } catch (e) { return null; } };
export async function fetchNext() {
  const c = config();
  if (!c.token || !c.repo || !navigator.onLine) return false;
  try {
    const r = await fetch(`https://api.github.com/repos/${c.repo}/contents/next.json?ref=${encodeURIComponent(c.branch)}`,
      { headers: { Authorization: `Bearer ${c.token}`, Accept: "application/vnd.github.raw+json", "X-GitHub-Api-Version": "2022-11-28" }, cache: "no-store" });
    if (!r.ok) return false;
    const txt = await r.text(); JSON.parse(txt);
    const changed = localStorage.getItem(NKEY) !== txt;
    try { localStorage.setItem(NKEY, txt); } catch (e) {}
    return changed;
  } catch (e) { return false; }
}
