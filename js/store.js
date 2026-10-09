// Storage layer. Today: the phone's localStorage.
// Later: same shape in Firestore (users/{uid}/exercises, workouts, sessions, settings),
// so only this file changes when we switch.
import { SEED_VERSION, seedExercises, seedWorkouts, seedSettings } from "./seed.js";

const KEY = "gymlog.v1";
const clone = (o) => JSON.parse(JSON.stringify(o));

function fresh() {
  const exercises = {};
  for (const [id, e] of Object.entries(seedExercises)) exercises[id] = { ...clone(e), note: "", last: null };
  return { seed: SEED_VERSION, exercises, workouts: clone(seedWorkouts), sessions: {}, settings: clone(seedSettings) };
}

export function load() {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return JSON.parse(raw);
  } catch (e) { console.warn("load failed", e); }
  const db = fresh();
  save(db);
  return db;
}

export function save(db) {
  try { localStorage.setItem(KEY, JSON.stringify(db)); }
  catch (e) { alert("Could not save on this device: " + e.message); }
}

export function exportJson(db) {
  return JSON.stringify(db, null, 2);
}

export function importJson(text) {
  const db = JSON.parse(text);
  if (!db.exercises || !db.workouts || !db.sessions) throw new Error("Not a GymLog backup");
  save(db);
  return db;
}
