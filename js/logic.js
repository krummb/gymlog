// Theme-independent logic: targets, rotation, sessions.
export const LETTERS = ["A", "B", "C", "D"];

const round = (n) => Math.round(n * 100) / 100;
export const fmtKg = (n) => (n == null ? "–" : String(round(n)).replace(/\.0+$/, ""));

export function openSession(db) {
  return Object.values(db.sessions).find((s) => !s.finishedAt) || null;
}

export function finishedSessions(db) {
  return Object.values(db.sessions).filter((s) => s.finishedAt).sort((a, b) => a.finishedAt.localeCompare(b.finishedAt));
}

// Next workout in A→B→C→D rotation after the last finished one
export function nextLetter(db) {
  const done = finishedSessions(db);
  if (!done.length) return "A";
  const i = LETTERS.indexOf(done[done.length - 1].workout);
  return LETTERS[(i + 1) % 4];
}

// Which letters are done in the current rotation cycle (since the last A started)
export function cycleDone(db) {
  const done = finishedSessions(db);
  const out = new Set();
  for (let i = done.length - 1; i >= 0; i--) {
    out.add(done[i].workout);
    if (done[i].workout === "A") break;
  }
  return out;
}

export function sessionCount(db) { return finishedSessions(db).length; }
export function sessionCountFor(db, letter) { return finishedSessions(db).filter((x) => x.workout === letter).length; }

// Today's target for one program item, from the exercise's last result
export function target(db, item) {
  const ex = db.exercises[item.ex];
  const last = ex.last;
  const t = { kg: null, reps: item.max, sets: item.sets, up: false, first: !last };
  if (ex.type === "timed") { t.reps = last ? last.top : item.min; }
  if (!last) {
    t.kg = ex.type === "weight" ? 0 : null;
    if (ex.type !== "timed") t.reps = item.min;
    return t;
  }
  t.kg = last.kg;
  const allTop = last.sets.length >= item.sets && last.sets.every((s) => s.reps >= item.max);
  if (allTop) {
    if (ex.type === "timed") t.reps = last.top + ex.step;
    else if (ex.type === "weight" || (last.kg || 0) > 0) { t.kg = (last.kg || 0) + ex.step; t.up = true; t.reps = item.min; }
    else t.reps = item.max; // bodyweight with no load: keep at top
  } else {
    t.reps = Math.min(item.max, Math.max(item.min, Math.max(...last.sets.map((s) => s.reps))));
  }
  return t;
}

export function targetText(db, item) {
  const ex = db.exercises[item.ex];
  const t = target(db, item);
  if (ex.type === "timed") return `${item.sets} × ${item.min}–${item.max} s`;
  const range = `${item.sets} × ${item.min}–${item.max}`;
  if (t.first) return ex.type === "weight" ? `new · ${range}` : `BW · ${range}`;
  if (t.kg == null || t.kg === 0) return `BW · ${range}`;
  return `${fmtKg(t.kg)} kg · ${range}`;
}

export function lastText(ex) {
  if (!ex.last) return "Last: –";
  const reps = ex.last.sets.map((s) => s.reps).join(", ");
  if (ex.type === "timed") return `Last: ${reps} s`;
  const kg = ex.last.kg ? `${fmtKg(ex.last.kg)} kg` : "BW";
  return `Last: ${kg} × ${reps}`;
}

export function newSession(db, letter) {
  const id = new Date().toISOString();
  const s = { id, workout: letter, startedAt: id, finishedAt: null, warmup: false, warmStart: null, warmAt: null, warmSec: 0, entries: {} };
  db.sessions[id] = s;
  return s;
}

export function entryFor(session, exId) {
  if (!session.entries[exId]) session.entries[exId] = { status: "todo", sets: [] };
  return session.entries[exId];
}

export function itemState(session, item) {
  if (!session) return { status: "todo", sets: [] };
  const e = session.entries[item.ex];
  if (!e) return { status: "todo", sets: [] };
  if (e.status === "todo" && e.sets.length >= item.sets) return { ...e, status: "done" };
  return e;
}

// Close the session: copy each exercise's result to exercise.last
export function finishSession(db, session) {
  session.finishedAt = new Date().toISOString();
  const w = db.workouts[session.workout];
  for (const item of w.items) {
    const e = session.entries[item.ex];
    if (!e || !e.sets.length) continue;
    const ex = db.exercises[item.ex];
    const kg = e.sets[e.sets.length - 1].kg;
    ex.last = { date: session.finishedAt, kg, sets: e.sets.map((s) => ({ kg: s.kg, reps: s.reps })), top: Math.max(...e.sets.map((s) => s.reps)) };
  }
}
