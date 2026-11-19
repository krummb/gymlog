// Starting data: the 4-day free-weight program (v2, 2026-11-19).
// type: "weight" (kg × reps), "bodyweight" (reps, kg = added weight, optional), "timed" (seconds)
// Optional exercise fields:
//   per       "hand" (weight is per hand) | "side" | "leg" (reps are per side/leg)
//   repUnit   unit instead of "reps" (farmer's carry: "m"), repStep = stepper jump for it
//   rest      rest seconds for this exercise (default: settings.restSec)
//   fixed     timed exercise with a fixed hold time (item.min) instead of "beat your best"; weight optional (wstep)
//   start     typed starting weight for a brand-new exercise (becomes the "Start:" baseline)
// Optional item fields: ss (superset with the neighbour), opt (optional exercise)
export const SEED_VERSION = 1;
export const PROGRAM_VERSION = 2;

export const seedExercises = {
  // Up A – Push
  db_bench:         { name: "DB bench press", type: "weight", step: 1, per: "hand", start: 10, cue: "Shoulder blades pinched, feet planted. Lower to mid-chest under control, press up without flaring your elbows." },
  seated_row:       { name: "Seated cable row", type: "weight", step: 2.5, cue: "Sit tall, pull towards lower ribs. No leaning or jerking." },
  db_shoulder_press:{ name: "DB shoulder press", type: "weight", step: 1, per: "hand", start: 8, cue: "Dumbbells at shoulder height, ribs down. Press up without arching your lower back." },
  cable_lateral:    { name: "Cable lateral raise", type: "weight", step: 1, per: "side", start: 4, cue: "Elbow leads, slight bend. Raise to shoulder height, lower slowly. If reps collapse, go lighter." },
  triceps_pushdown: { name: "Cable triceps pushdown", type: "weight", step: 2.5, cue: "Elbows pinned to your sides. Push down to straight arms, return slowly." },
  face_pull:        { name: "Cable face pull", type: "weight", step: 2.5, start: 9, cue: "Rope to forehead height, elbows high, squeeze your shoulder blades together. Return slowly." },
  // Low A – Quads
  goblet_squat:     { name: "Goblet squat", type: "weight", step: 1, start: 12, cue: "Dumbbell held at your chest. Sit down between your heels, chest up, knees tracking over your toes." },
  db_rdl:           { name: "DB Romanian deadlift", type: "weight", step: 1, per: "hand", start: 10, cue: "Soft knees, hinge at the hips, dumbbells close to your legs. Flat back; stop around mid-shin." },
  db_split_squat:   { name: "DB split squat", type: "weight", step: 1, per: "leg", start: 6, cue: "Long stride, torso upright. Drop the back knee straight down, push through the front heel." },
  calf_raise:       { name: "Calf raise (plate-loaded)", type: "weight", step: 2.5, cue: "Balls of your feet on the plate. Rise high, pause, lower slowly all the way." },
  hanging_knee_raise:{ name: "Hanging knee raise", type: "bodyweight", step: 2.5, cue: "Hang from the rig, no swinging. Lift your knees towards your chest, lower slowly." },
  // Up B – Pull
  pull_up:          { name: "Pull-up (strict)", type: "bodyweight", step: 2.5, cue: "Full hang to chin over the bar, no kipping. Stop a rep before failure. Last set: slow negatives or band." },
  incline_db_press: { name: "Incline DB press", type: "weight", step: 1, per: "hand", start: 8, cue: "Bench at a low incline. Lower to upper chest, press up; wrists stacked over elbows." },
  one_arm_row:      { name: "One-arm DB row", type: "weight", step: 1, per: "side", start: 12, cue: "Hand and knee on the bench, flat back. Pull the dumbbell to your hip, no twisting." },
  reverse_fly:      { name: "Reverse fly (cable / delt machine)", type: "weight", step: 2.5, start: 27.5, cue: "Chest tall, soft elbows. Open your arms wide, squeeze your shoulder blades, return slowly." },
  lateral_raise:    { name: "DB lateral raise", type: "weight", step: 1, per: "hand", start: 4, cue: "Slight bend in elbows. Raise to shoulder height, lower slowly. No swinging." },
  cable_curl:       { name: "Cable curl", type: "weight", step: 2.5, start: 14, cue: "Elbows pinned to your sides. Curl up, lower slowly. No leaning back." },
  dips:             { name: "Dips (rig)", type: "bodyweight", step: 2.5, cue: "Shoulders down, lean slightly forward. Lower until upper arms are parallel, press up. Optional." },
  // Low B – Hinge
  deadlift:         { name: "Barbell deadlift", type: "weight", step: 5, rest: 180, start: 40, cue: "Bar over mid-foot, flat back, brace. Push the floor away, finish with your hips. Film it from the side." },
  db_bulgarian:     { name: "DB Bulgarian split squat", type: "weight", step: 1, per: "leg", start: 5, cue: "Rear foot on the bench, front foot far enough forward. Drop straight down, push through the front heel." },
  ham_curl:         { name: "Leg curl (machine)", type: "weight", step: 2.5, cue: "Adjust to fit your legs. Curl the pad up, return slowly. Hips still." },
  hip_thrust:       { name: "Barbell hip thrust", type: "weight", step: 2.5, start: 40, cue: "Upper back on the bench, bar over your hips. Drive through your heels, squeeze at the top, chin tucked." },
  farmers_carry:    { name: "Farmer's carry", type: "weight", step: 1, per: "hand", repUnit: "m", repStep: 5, start: 12, cue: "Tall posture, shoulders down, short steady steps. Don't let the weights swing." },
  plank:            { name: "Plank", type: "timed", fixed: true, step: 5, wstep: 2.5, cue: "Forearms and toes, body in a straight line. Brace and breathe. Add weight once the full time is easy." },
};

const it = (id, sets, min, max, extra = {}) => ({ ex: id, sets, min, max, ...extra });

export const seedWorkouts = {
  A: { name: "Up A - Push", items: [it("db_bench", 3, 8, 10), it("seated_row", 3, 10, 12), it("db_shoulder_press", 3, 8, 10), it("cable_lateral", 3, 12, 15, { ss: true }), it("triceps_pushdown", 3, 10, 12, { ss: true }), it("face_pull", 2, 12, 15)] },
  B: { name: "Low A - Quads", items: [it("goblet_squat", 3, 8, 12), it("db_rdl", 3, 8, 10), it("db_split_squat", 2, 8, 10), it("calf_raise", 3, 12, 15), it("hanging_knee_raise", 3, 8, 12)] },
  C: { name: "Up B - Pull", items: [it("pull_up", 4, 2, 3), it("incline_db_press", 3, 8, 12), it("one_arm_row", 3, 8, 12), it("reverse_fly", 3, 12, 15, { ss: true }), it("lateral_raise", 3, 12, 15, { ss: true }), it("cable_curl", 2, 10, 12), it("dips", 2, 6, 8, { opt: true })] },
  D: { name: "Low B - Hinge", items: [it("deadlift", 2, 5, 8), it("db_bulgarian", 2, 8, 10), it("ham_curl", 3, 10, 12), it("hip_thrust", 3, 10, 12), it("farmers_carry", 3, 30, 30), it("plank", 2, 60, 60)] },
};

export const seedSettings = {
  globalNote: "Breathe out on effort. Stop if sharp pain.",
  restSec: 120,
  theme: "c2",
};
