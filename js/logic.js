// Theme-independent logic: targets, rotation, sessions.
export const LETTERS = ["A", "B", "C", "D"];

const round = (n) => Math.round(n * 100) / 100;
export const unitOf = (ex) => (ex.scale && ex.scale.unit) || "kg";

// Next/previous selectable weight: walks the machine's scale if it has one, else a fixed step
export function stepWeight(ex, cur, dir) {
  cur = cur || 0;
  const v = ex.scale && ex.scale.values;
  if (v && v.length) {
    if (dir > 0) { const n = v.find((x) => x > cur + 1e-9); return n === undefined ? v[v.length - 1] : n; }
    const p = [...v].reverse().find((x) => x < cur - 1e-9);
    return p === undefined ? 0 : p;
  }
  return Math.max(0, round(cur + dir * (ex.type === "timed" ? ex.wstep || 2.5 : ex.step)));
}

export const restFor = (db, ex) => ex.rest || db.settings.restSec;
export const repStepOf = (ex) => (ex.type === "timed" ? ex.step : ex.repStep || 1);
export const repCap = (ex) => (ex.type === "timed" ? "SECONDS" : ex.repUnit === "m" ? "METRES" : ex.repUnit ? ex.repUnit.toUpperCase() : "REPS");
const PER = { hand: "per hand", side: "per side", leg: "per leg" };
export const perText = (ex) => PER[ex.per] || "";
// "8–10", "30 m", "8–10/leg": the rep range of one item
export function rangeText(ex, item, short = false) {
  const r = item.min === item.max ? `${item.min}` : `${item.min}–${item.max}`;
  const u = ex.repUnit ? " " + ex.repUnit : "";
  const per = ex.per === "leg" || ex.per === "side" ? (short ? "/" + ex.per : " " + PER[ex.per]) : "";
  return r + u + per;
}

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

// Which letters are done in the current round: a round ends when all four are done, then all start unmarked again
export function cycleDone(db) {
  let out = new Set();
  for (const s of finishedSessions(db)) { out.add(s.workout); if (out.size === LETTERS.length) out = new Set(); }
  return out;
}

export function sessionCount(db) { return finishedSessions(db).length; }
export function sessionCountFor(db, letter) { return finishedSessions(db).filter((x) => x.workout === letter).length; }

// Today's target for one program item, from the exercise's last result
export function target(db, item) {
  const ex = db.exercises[item.ex];
  const last = ex.last;
  const t = { kg: null, reps: item.max, sets: item.sets, up: false, first: !last };
  // Timed (plank): no fixed range. First time start at item.min, afterwards beat your best by one step.
  if (ex.type === "timed" && ex.fixed) { t.reps = item.min; t.kg = (last && last.kg) || 0; t.first = false; return t; }
  if (ex.type === "timed") { t.reps = last ? last.top + ex.step : item.min; t.dyn = true; return t; }
  if (!last) {
    t.kg = ex.type === "weight" ? 0 : null;
    if (ex.type !== "timed") t.reps = item.min;
    return t;
  }
  t.kg = last.kg;
  // Only step up when every set used the same weight (a ramp like 55 then 64 repeats the heavier weight first)
  const sameKg = last.sets.every((s) => (s.kg || 0) === (last.sets[0].kg || 0));
  const allTop = sameKg && last.sets.length >= item.sets && last.sets.every((s) => s.reps >= item.max);
  if (allTop) {
    if (ex.type === "timed") t.reps = last.top + ex.step;
    else if (ex.type === "weight" || (last.kg || 0) > 0) { t.kg = stepWeight(ex, last.kg || 0, 1); t.up = true; t.reps = item.min; }
    else t.reps = item.max; // bodyweight with no load: keep at top
  } else {
    t.reps = Math.min(item.max, Math.max(item.min, Math.max(...last.sets.map((s) => s.reps))));
  }
  return t;
}

export function targetText(db, item) {
  const ex = db.exercises[item.ex];
  const t = target(db, item);
  if (ex.type === "timed") return `${item.sets} × ${t.reps} s${ex.fixed && t.kg ? " +" + fmtKg(t.kg) + "kg" : ""}`;
  const range = `${item.sets} × ${rangeText(ex, item, true)}`;
  if (t.first) return ex.type === "weight" ? `new · ${range}` : `BW · ${range}`;
  if (t.kg == null || t.kg === 0) return `BW · ${range}`;
  return `${fmtKg(t.kg)} ${unitOf(ex)} · ${range}`;
}

// "64 kg × 12, 12" when every set used the same weight, "55×12 · 64×12" when the weight changed between sets
export function setsSummary(ex, sets, withUnit = true) {
  const u = withUnit ? " " + unitOf(ex) : "";
  if (ex.type === "timed") {
    const t = sets.map((x) => x.reps).join(", ") + " s";
    const w = Math.max(...sets.map((x) => x.kg || 0));
    return w ? `${t} +${fmtKg(w)}${u}` : t;
  }
  const ru = ex.repUnit ? " " + ex.repUnit : "";
  const kgs = sets.map((x) => x.kg || 0);
  if (kgs.every((k) => k === kgs[0])) return `${kgs[0] ? fmtKg(kgs[0]) + u : "BW"} × ${sets.map((x) => x.reps).join(", ")}${ru}`;
  return sets.map((x) => `${fmtKg(x.kg || 0)}×${x.reps}`).join(" · ") + ru + u;
}

export function lastText(ex) {
  if (!ex.last) return "Last: –";
  if (ex.last.baseline) return ex.type === "timed" ? `Start: ${ex.last.top} s` : `Start: ${ex.last.kg ? fmtKg(ex.last.kg) + " " + unitOf(ex) : "BW"}`;
  return `Last: ${setsSummary(ex, ex.last.sets)}`;
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

// The exercises of one session: the workout's items, with today-only swaps (session.swaps: original id -> new id)
// and today-only additions (session.extra) applied. The program itself is never changed by these.
export function sessionItems(w, session) {
  if (!session || (!session.swaps && !session.extra)) return w.items;
  const sw = session.swaps || {};
  return [...w.items.map((it) => (sw[it.ex] ? { ...it, ex: sw[it.ex], today: true } : it)), ...(session.extra || [])];
}

// Close the session: copy each exercise's result to exercise.last
export function finishSession(db, session) {
  session.finishedAt = new Date().toISOString();
  const w = db.workouts[session.workout];
  for (const item of sessionItems(w, session)) {
    const e = session.entries[item.ex];
    if (!e || !e.sets.length) continue;
    const ex = db.exercises[item.ex];
    const kg = e.sets[e.sets.length - 1].kg;
    ex.last = { date: session.finishedAt, kg, sets: e.sets.map((s) => ({ kg: s.kg, reps: s.reps })), top: Math.max(...e.sets.map((s) => s.reps)) };
  }
}

// Set the "current weight" by hand (typed in Settings). Today's target starts from it.
export function setCurrent(ex, value) {
  const date = new Date().toISOString();
  if (ex.type === "timed") ex.last = { date, kg: null, sets: [{ kg: null, reps: value }], top: value, baseline: true };
  else ex.last = { date, kg: value, sets: [{ kg: value, reps: 0 }], top: 0, baseline: true };
}

export function currentText(ex) {
  if (!ex.last) return "–";
  if (ex.type === "timed") return ex.last.top + " s";
  return ex.last.kg ? fmtKg(ex.last.kg) + " " + unitOf(ex) : "BW";
}
