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
// Dumbbell rack: 1-10 kg in 1 kg steps, then even numbers (12, 14 … 60)
export const DB_SCALE = { unit: "kg", values: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, ...Array.from({ length: 25 }, (_, i) => 12 + i * 2)] };
export const PROGRAM_VERSION = 2;

export const seedExercises = {
  // Up A – Push
  db_bench:         { name: "DB Bench Press", type: "weight", scale: DB_SCALE, rest: 105, step: 1, per: "hand", start: 10, cue: "Shoulder blades pinched, feet planted. Lower to mid-chest under control, press up without flaring your elbows." },
  seated_row:       { name: "Seated Cable Row", type: "weight", rest: 105, step: 2.5, cue: "Sit tall, pull towards lower ribs. No leaning or jerking." },
  db_shoulder_press:{ name: "DB Shoulder Press", type: "weight", scale: DB_SCALE, rest: 105, step: 1, per: "hand", start: 8, cue: "Dumbbells at shoulder height, ribs down. Press up without arching your lower back." },
  cable_lateral:    { name: "Cable Lateral Raise", type: "weight", rest: 75, step: 1, per: "side", start: 4, cue: "Elbow leads, slight bend. Raise to shoulder height, lower slowly. If reps collapse, go lighter." },
  triceps_pushdown: { name: "Cable Triceps Pushdown", type: "weight", rest: 75, step: 2.5, cue: "Elbows pinned to your sides. Push down to straight arms, return slowly." },
  face_pull:        { name: "Cable Face Pull", type: "weight", rest: 75, step: 2.5, start: 9, cue: "Rope to forehead height, elbows high, squeeze your shoulder blades together. Return slowly." },
  // Low A – Quads
  goblet_squat:     { name: "Goblet Squat", type: "weight", scale: DB_SCALE, rest: 105, step: 1, start: 12, cue: "Dumbbell held at your chest. Sit down between your heels, chest up, knees tracking over your toes." },
  db_rdl:           { name: "DB Romanian Deadlift", type: "weight", scale: DB_SCALE, rest: 105, step: 1, per: "hand", start: 10, cue: "Soft knees, hinge at the hips, dumbbells close to your legs. Flat back; stop around mid-shin." },
  db_split_squat:   { name: "DB Split Squat", handKg: true, type: "weight", scale: DB_SCALE, rest: 90, step: 1, per: "leg", start: 6, cue: "Long stride, torso upright. Drop the back knee straight down, push through the front heel." },
  calf_raise:       { name: "Calf Raise (Plate-Loaded)", type: "weight", rest: 75, step: 2.5, cue: "Balls of your feet on the plate. Rise high, pause, lower slowly all the way." },
  hanging_knee_raise:{ name: "Hanging Knee Raise", type: "bodyweight", rest: 75, step: 2.5, cue: "Hang from the rig, no swinging. Lift your knees towards your chest, lower slowly." },
  // Up B – Pull
  pull_up:          { name: "Pull-Up (Strict)", type: "bodyweight", rest: 150, step: 2.5, cue: "Full hang to chin over the bar, no kipping. Stop a rep before failure. Last set: slow negatives or band." },
  incline_db_press: { name: "Incline DB Press", type: "weight", scale: DB_SCALE, rest: 105, step: 1, per: "hand", start: 8, cue: "Bench at a low incline. Lower to upper chest, press up; wrists stacked over elbows." },
  one_arm_row:      { name: "One-Arm DB Row", type: "weight", scale: DB_SCALE, rest: 75, step: 1, per: "side", start: 12, cue: "Hand and knee on the bench, flat back. Pull the dumbbell to your hip, no twisting." },
  reverse_fly:      { name: "Reverse Fly (Cable / Delt Machine)", type: "weight", rest: 75, step: 2.5, start: 27.5, cue: "Chest tall, soft elbows. Open your arms wide, squeeze your shoulder blades, return slowly." },
  lateral_raise:    { name: "DB Lateral Raise", type: "weight", scale: DB_SCALE, rest: 75, step: 1, per: "hand", start: 4, cue: "Slight bend in elbows. Raise to shoulder height, lower slowly. No swinging." },
  cable_curl:       { name: "Cable Curl", type: "weight", rest: 75, step: 2.5, start: 14, cue: "Elbows pinned to your sides. Curl up, lower slowly. No leaning back." },
  dips:             { name: "Dips (Rig)", type: "bodyweight", rest: 105, step: 2.5, cue: "Shoulders down, lean slightly forward. Lower until upper arms are parallel, press up. Optional." },
  // Low B – Hinge
  deadlift:         { name: "Barbell Deadlift", type: "weight", step: 5, rest: 180, start: 40, cue: "Bar over mid-foot, flat back, brace. Push the floor away, finish with your hips. Film it from the side." },
  db_bulgarian:     { name: "DB Bulgarian Split Squat", handKg: true, type: "weight", scale: DB_SCALE, rest: 105, step: 1, per: "leg", start: 5, cue: "Rear foot on the bench, front foot far enough forward. Drop straight down, push through the front heel." },
  prone_leg_curl:   { name: "Prone Cable Leg Curl", cue: "Face down, hips pressed into the bench, abs braced. Curl one heel to your glute, lower slowly. (Per leg.)", type: "weight", step: 2.5, per: "leg", rest: 75, start: 10 },
  ham_curl:         { name: "Leg Curl (Machine)", type: "weight", rest: 75, step: 2.5, cue: "Adjust to fit your legs. Curl the pad up, return slowly. Hips still." },
  hip_thrust:       { name: "Barbell Hip Thrust", type: "weight", rest: 105, step: 2.5, start: 40, cue: "Upper back on the bench, bar over your hips. Drive through your heels, squeeze at the top, chin tucked." },
  farmers_carry:    { name: "Farmer's Carry", type: "weight", scale: DB_SCALE, rest: 90, step: 1, per: "hand", repUnit: "m", repStep: 5, start: 12, cue: "Tall posture, shoulders down, short steady steps. Don't let the weights swing." },
  plank:            { name: "Plank", type: "timed", rest: 60, fixed: true, step: 5, wstep: 2.5, cue: "Forearms and toes, body in a straight line. Brace and breathe. Add weight once the full time is easy." },
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
  incline_db_curl:      { name: "Incline DB Curl", type: "weight", scale: DB_SCALE, step: 1, per: "hand", rest: 75 },
  hammer_curl:          { name: "DB Hammer Curl", type: "weight", scale: DB_SCALE, step: 1, per: "hand", rest: 75 },
  cable_pull_through:   { name: "Cable Pull-Through", type: "weight", step: 2.5, rest: 75 },
  cable_crunch:         { name: "Cable Crunch", type: "weight", step: 2.5, rest: 75 },
  pallof_press:         { name: "Pallof Press", type: "weight", step: 2.5, per: "side", rest: 50 },
  db_reverse_lunge:     { name: "DB Reverse Lunge", handKg: true, type: "weight", scale: DB_SCALE, step: 1, per: "leg", rest: 105 },
  db_hip_thrust:        { name: "DB Hip Thrust", type: "weight", scale: DB_SCALE, step: 1, rest: 105, start: 20, cue: "One dumbbell across your hip crease, upper back on the bench. Drive through your heels, squeeze your glutes at the top, chin tucked." },
  glute_bridge:         { name: "Glute Press (Machine)", type: "weight", step: 2.5, rest: 105, cue: "Adjust the machine to fit. Push through your heels, squeeze your glutes, return slowly. Start light and adjust after set 1." },
  // Skating program (2026-11-24, skating chat). Timed + fixed = hold/duration from the workout item; noKg = no weight; live = word on the live timer
  single_leg_balance:   { name: "Single-Leg Balance (Balance Plate)", type: "timed", fixed: true, noKg: true, step: 5, per: "leg", rest: 30 },
  copenhagen_short:     { name: "Copenhagen Plank (Short Lever)", type: "timed", fixed: true, noKg: true, step: 5, per: "side", rest: 50 },
  copenhagen_long:      { name: "Copenhagen Plank (Long Lever)", type: "timed", fixed: true, noKg: true, step: 5, per: "side", rest: 60 },
  cable_hip_abduction:  { name: "Cable Hip Abduction", type: "weight", step: 1, per: "side", rest: 50, start: 5 },
  side_plank:           { name: "Side Plank", type: "timed", fixed: true, noKg: true, step: 5, per: "side", rest: 40 },
  tibialis_raise:       { name: "Tibialis Raise", type: "bodyweight", step: 2.5, rest: 50 },
  skater_bound:         { name: "Skater Bound", type: "bodyweight", step: 2.5, per: "side", rest: 120 },
  slider_lateral_push:  { name: "Slider Lateral Push", type: "bodyweight", step: 2.5, per: "side", rest: 60 },
  low_walk:             { name: "Low Walk", type: "bodyweight", step: 2.5, repUnit: "m", repStep: 5, rest: 75 },
  db_sl_rdl:            { name: "DB Single-Leg RDL", type: "weight", scale: DB_SCALE, step: 1, per: "leg", rest: 75, start: 8 },
  cardio_4x4:           { name: "Cardio Intervals (SkiErg/Rower)", type: "timed", fixed: true, noKg: true, step: 30, rest: 120, live: "Hard", liveRest: "Easy" },
  db_lateral_lunge:     { name: "DB Lateral Lunge", type: "weight", scale: DB_SCALE, step: 1, per: "side", handKg: true, rest: 75, start: 6 },
  // Recovery program (2026-11-25): gentle rest-day work
  band_ext_rotation:    { name: "Band External Rotation", type: "bodyweight", step: 2.5, per: "side", rest: 40 },
  dead_hang:            { name: "Dead Hang", type: "timed", fixed: true, noKg: true, step: 5, rest: 50 },
  hip_flexor_stretch:   { name: "Hip Flexor Stretch (Half-Kneeling)", type: "timed", fixed: true, noKg: true, step: 5, per: "side", rest: 10 },
  thoracic_rotation:    { name: "Thoracic Rotation (Side-Lying)", type: "bodyweight", step: 2.5, per: "side", rest: 10 },
  ankle_mobility:       { name: "Ankle Mobility (Knee to Wall)", type: "bodyweight", step: 2.5, per: "side", rest: 10 },
  neck_iso:             { name: "Neck Isometric Hold", type: "timed", fixed: true, noKg: true, step: 5, per: "direction", rest: 10 },
  wrist_curl:           { name: "DB Wrist Curl", type: "weight", scale: DB_SCALE, step: 1, per: "hand", rest: 40, start: 2 },
  reverse_wrist_curl:   { name: "DB Reverse Wrist Curl", type: "weight", scale: DB_SCALE, step: 1, per: "hand", rest: 40, start: 1 },
  forearm_rotation:     { name: "DB Forearm Rotation", type: "weight", scale: DB_SCALE, step: 1, per: "side", rest: 40, start: 2 },
  finger_extension:     { name: "Band Finger Extension", type: "bodyweight", step: 2.5, rest: 30 },
  ball_leg_curl:        { name: "Stability Ball Leg Curl", type: "bodyweight", step: 2.5, rest: 75 },
  seated_leg_curl:      { name: "Mx Seated Leg Curl", type: "weight", step: 2.5, rest: 75 },
  straight_arm_pulldown: { name: "Cable Straight-Arm Pulldown", type: "weight", step: 2.5, rest: 75, start: 10 },
  cardio_z2:            { name: "Steady Cardio Z2 (Bike/Rower)", type: "timed", fixed: true, noKg: true, step: 60, rest: 60, live: "Easy" },
  backpack_walk:        { name: "Backpack Incline Walk", type: "timed", fixed: true, noKg: true, step: 60, rest: 60, live: "Walk" },
  bfr_leg_extension:    { name: "BFR Leg Extension (Optional)", type: "weight", step: 2.5, rest: 30 },
  db_step_up:           { name: "DB Step-Up", handKg: true, type: "weight", scale: DB_SCALE, step: 1, per: "leg", rest: 105 },
};

const it = (id, sets, min, max, extra = {}) => ({ ex: id, sets, min, max, ...extra });

export const seedWorkouts = {
  A: { name: "Up A - Push", items: [it("db_bench", 3, 8, 10), it("seated_row", 3, 10, 12), it("db_shoulder_press", 3, 8, 10), it("cable_lateral", 3, 12, 15, { ss: true }), it("triceps_pushdown", 3, 10, 12, { ss: true }), it("face_pull", 2, 12, 15)] },
  B: { name: "Low A - Quads", items: [it("goblet_squat", 3, 8, 12), it("db_rdl", 3, 8, 10), it("db_split_squat", 2, 8, 10), it("calf_raise", 3, 12, 15), it("hanging_knee_raise", 3, 8, 12)] },
  C: { name: "Up B - Pull", items: [it("pull_up", 4, 2, 3), it("incline_db_press", 3, 8, 12), it("one_arm_row", 3, 8, 12), it("reverse_fly", 3, 12, 15, { ss: true }), it("lateral_raise", 3, 12, 15, { ss: true }), it("cable_curl", 2, 10, 12), it("dips", 2, 6, 8, { opt: true })] },
  D: { name: "Low B - Hinge", items: [it("deadlift", 3, 5, 8), it("db_bulgarian", 2, 8, 10), it("prone_leg_curl", 3, 12, 15), it("hip_thrust", 3, 10, 12), it("farmers_carry", 3, 40, 50), it("plank", 2, 60, 60)] },
};

// Skating program (SK4), S1-S4 as A-D. Week 1 ("learn"): 2 sets on every new exercise; per-leg/per-side holds are
// one set per leg/side (2 per leg = 4 sets) so the live timer runs each hold.
export const skatingWorkouts = {
  A: { name: "S1 Low A - Push-Off", items: [it("single_leg_balance", 4, 30, 30), it("copenhagen_short", 4, 15, 15), it("deadlift", 3, 5, 8), it("db_bulgarian", 3, 8, 10), it("cable_hip_abduction", 2, 12, 15), it("ball_leg_curl", 2, 10, 12), it("calf_raise", 3, 12, 15), it("cardio_z2", 1, 600, 600, { opt: true })] },
  B: { name: "S2 Up A - Intervals + Push", items: [it("cardio_4x4", 6, 60, 60), it("pallof_press", 2, 10, 10), it("db_bench", 3, 8, 10), it("pull_up", 4, 3, 3), it("one_arm_row", 3, 10, 12), it("db_shoulder_press", 2, 8, 10, { ss: true }), it("face_pull", 2, 12, 15, { ss: true })] },
  C: { name: "S3 Low B - Skate", items: [it("tibialis_raise", 2, 15, 20), it("single_leg_balance", 4, 30, 30), it("skater_bound", 2, 5, 5), it("goblet_squat", 3, 8, 12), it("db_sl_rdl", 2, 8, 8), it("slider_lateral_push", 2, 8, 8), it("low_walk", 2, 20, 20), it("side_plank", 4, 30, 30), it("cardio_z2", 1, 900, 900, { opt: true })] },
  D: { name: "S4 Up B - Pull + Base", items: [it("back_extension", 2, 10, 12), it("seated_row", 3, 10, 12), it("incline_db_press", 3, 10, 12), it("reverse_fly", 2, 12, 15), it("straight_arm_pulldown", 2, 12, 15), it("hanging_knee_raise", 2, 8, 12), it("cardio_z2", 1, 1200, 1200)] },
};

// Recovery program (RC4, rest days, R1-R4 as A-D). light: shared exercises use the item's kg and don't change
// the exercise's progress; recovery-only exercises progress as usual. Forearm block at the end of every workout.
const forearms = () => [it("wrist_curl", 2, 15, 15), it("reverse_wrist_curl", 2, 15, 15), it("forearm_rotation", 2, 10, 10), it("finger_extension", 2, 20, 20)];
export const recoveryWorkouts = {
  A: { name: "R1 Bike - Shoulders", items: [it("cardio_z2", 1, 1200, 1200), it("band_ext_rotation", 2, 15, 15), it("lateral_raise", 2, 15, 15, { kg: 3 }), it("face_pull", 2, 15, 15, { kg: 5 }), ...forearms()] },
  B: { name: "R2 Rower - Grip + Core", items: [it("cardio_z2", 1, 1200, 1200), it("dead_hang", 2, 20, 20), it("pallof_press", 2, 10, 10, { kg: 5 }), it("side_plank", 4, 20, 20), ...forearms()] },
  C: { name: "R3 SkiErg - Mobility", items: [it("cardio_z2", 1, 1200, 1200), it("hip_flexor_stretch", 4, 30, 30), it("thoracic_rotation", 2, 8, 8), it("ankle_mobility", 2, 10, 10), ...forearms()] },
  D: { name: "R4 Walk - Arms + Neck", items: [it("backpack_walk", 1, 1800, 1800), it("hammer_curl", 2, 12, 15, { kg: 6 }), it("triceps_pushdown", 2, 12, 15, { kg: 25 }), it("neck_iso", 8, 15, 15), ...forearms()] },
};

export const seedSettings = {
  globalNote: "Breathe out on effort. Stop if sharp pain.",
  restSec: 120, // rest between exercises (after an exercise's last set); rest between sets is per exercise
  prepSec: 10,  // live hold timer: get-ready time
  theme: "c2",
};
