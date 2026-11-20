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
  db_bench:         { name: "DB Bench Press", type: "weight", step: 1, per: "hand", start: 10, cue: "Shoulder blades pinched, feet planted. Lower to mid-chest under control, press up without flaring your elbows." },
  seated_row:       { name: "Seated Cable Row", type: "weight", step: 2.5, cue: "Sit tall, pull towards lower ribs. No leaning or jerking." },
  db_shoulder_press:{ name: "DB Shoulder Press", type: "weight", step: 1, per: "hand", start: 8, cue: "Dumbbells at shoulder height, ribs down. Press up without arching your lower back." },
  cable_lateral:    { name: "Cable Lateral Raise", type: "weight", step: 1, per: "side", start: 4, cue: "Elbow leads, slight bend. Raise to shoulder height, lower slowly. If reps collapse, go lighter." },
  triceps_pushdown: { name: "Cable Triceps Pushdown", type: "weight", step: 2.5, cue: "Elbows pinned to your sides. Push down to straight arms, return slowly." },
  face_pull:        { name: "Cable Face Pull", type: "weight", step: 2.5, start: 9, cue: "Rope to forehead height, elbows high, squeeze your shoulder blades together. Return slowly." },
  // Low A – Quads
  goblet_squat:     { name: "Goblet Squat", type: "weight", step: 1, start: 12, cue: "Dumbbell held at your chest. Sit down between your heels, chest up, knees tracking over your toes." },
  db_rdl:           { name: "DB Romanian Deadlift", type: "weight", step: 1, per: "hand", start: 10, cue: "Soft knees, hinge at the hips, dumbbells close to your legs. Flat back; stop around mid-shin." },
  db_split_squat:   { name: "DB Split Squat", type: "weight", step: 1, per: "leg", start: 6, cue: "Long stride, torso upright. Drop the back knee straight down, push through the front heel." },
  calf_raise:       { name: "Calf Raise (Plate-Loaded)", type: "weight", step: 2.5, cue: "Balls of your feet on the plate. Rise high, pause, lower slowly all the way." },
  hanging_knee_raise:{ name: "Hanging Knee Raise", type: "bodyweight", step: 2.5, cue: "Hang from the rig, no swinging. Lift your knees towards your chest, lower slowly." },
  // Up B – Pull
  pull_up:          { name: "Pull-Up (Strict)", type: "bodyweight", step: 2.5, cue: "Full hang to chin over the bar, no kipping. Stop a rep before failure. Last set: slow negatives or band." },
  incline_db_press: { name: "Incline DB Press", type: "weight", step: 1, per: "hand", start: 8, cue: "Bench at a low incline. Lower to upper chest, press up; wrists stacked over elbows." },
  one_arm_row:      { name: "One-Arm DB Row", type: "weight", step: 1, per: "side", start: 12, cue: "Hand and knee on the bench, flat back. Pull the dumbbell to your hip, no twisting." },
  reverse_fly:      { name: "Reverse Fly (Cable / Delt Machine)", type: "weight", step: 2.5, start: 27.5, cue: "Chest tall, soft elbows. Open your arms wide, squeeze your shoulder blades, return slowly." },
  lateral_raise:    { name: "DB Lateral Raise", type: "weight", step: 1, per: "hand", start: 4, cue: "Slight bend in elbows. Raise to shoulder height, lower slowly. No swinging." },
  cable_curl:       { name: "Cable Curl", type: "weight", step: 2.5, start: 14, cue: "Elbows pinned to your sides. Curl up, lower slowly. No leaning back." },
  dips:             { name: "Dips (Rig)", type: "bodyweight", step: 2.5, cue: "Shoulders down, lean slightly forward. Lower until upper arms are parallel, press up. Optional." },
  // Low B – Hinge
  deadlift:         { name: "Barbell Deadlift", type: "weight", step: 5, rest: 180, start: 40, cue: "Bar over mid-foot, flat back, brace. Push the floor away, finish with your hips. Film it from the side." },
  db_bulgarian:     { name: "DB Bulgarian Split Squat", type: "weight", step: 1, per: "leg", start: 5, cue: "Rear foot on the bench, front foot far enough forward. Drop straight down, push through the front heel." },
  ham_curl:         { name: "Leg Curl (Machine)", type: "weight", step: 2.5, cue: "Adjust to fit your legs. Curl the pad up, return slowly. Hips still." },
  hip_thrust:       { name: "Barbell Hip Thrust", type: "weight", step: 2.5, start: 40, cue: "Upper back on the bench, bar over your hips. Drive through your heels, squeeze at the top, chin tucked." },
  farmers_carry:    { name: "Farmer's Carry", type: "weight", step: 1, per: "hand", repUnit: "m", repStep: 5, start: 12, cue: "Tall posture, shoulders down, short steady steps. Don't let the weights swing." },
  plank:            { name: "Plank", type: "timed", fixed: true, step: 5, wstep: 2.5, cue: "Forearms and toes, body in a straight line. Brace and breathe. Add weight once the full time is easy." },
};

// Extra exercises to slot into the program later (how-tos in guides.js, rest times from the user's "Additional Exercise How-Tos").
// Not in any workout; they are added to saved data on load and can be put into a workout via Programs + Add exercise or F6 Swap.
// rest: 2-3 min -> 150, 90-120 s -> 105, 60-90 s -> 75, 45-60 s -> 50
export const extraExercises = {
  back_squat:           { name: "Barbell Back Squat", type: "weight", step: 2.5, rest: 150 },
  bench_press:          { name: "Barbell Bench Press", type: "weight", step: 2.5, rest: 150 },
  overhead_press:       { name: "Barbell Overhead Press", type: "weight", step: 2.5, rest: 150 },
  barbell_rdl:          { name: "Barbell Romanian Deadlift", type: "weight", step: 2.5, rest: 150 },
  trap_bar_deadlift:    { name: "Trap Bar Deadlift", type: "weight", step: 5, rest: 150 },
  chin_up:              { name: "Chin-Up", type: "bodyweight", step: 2.5, rest: 150 },
  weighted_pull_up:     { name: "Weighted Pull-Up", type: "bodyweight", step: 2.5, rest: 150 },
  weighted_dips:        { name: "Weighted Dips", type: "bodyweight", step: 2.5, rest: 150 },
  push_up:              { name: "Push-Up", type: "bodyweight", step: 2.5, rest: 75 },
  inverted_row:         { name: "Inverted Row", type: "bodyweight", step: 2.5, rest: 105 },
  ab_wheel:             { name: "Ab Wheel Rollout", type: "bodyweight", step: 2.5, rest: 75 },
  back_extension:       { name: "Back Extension", type: "bodyweight", step: 2.5, rest: 75 },
  cable_fly:            { name: "Cable Chest Fly", type: "weight", step: 2.5, rest: 75 },
  one_arm_cable_row:    { name: "One-Arm Cable Row", type: "weight", step: 2.5, per: "side", rest: 75 },
  overhead_triceps_ext: { name: "Overhead Cable Triceps Extension", type: "weight", step: 2.5, rest: 75 },
  incline_db_curl:      { name: "Incline DB Curl", type: "weight", step: 1, per: "hand", rest: 75 },
  hammer_curl:          { name: "Hammer Curl", type: "weight", step: 1, per: "hand", rest: 75 },
  cable_pull_through:   { name: "Cable Pull-Through", type: "weight", step: 2.5, rest: 75 },
  cable_crunch:         { name: "Cable Crunch", type: "weight", step: 2.5, rest: 75 },
  pallof_press:         { name: "Pallof Press", type: "weight", step: 2.5, per: "side", rest: 50 },
  db_reverse_lunge:     { name: "DB Reverse Lunge", type: "weight", step: 1, per: "leg", rest: 105 },
  db_step_up:           { name: "DB Step-Up", type: "weight", step: 1, per: "leg", rest: 105 },
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
