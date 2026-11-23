// Alternative exercises shown in the hint line (ids, best first). Only shown if they exist and are not already in today's workout.
export const ALTS = {
  db_bench: ["bench_press", "push_up"], seated_row: ["one_arm_cable_row", "inverted_row"], db_shoulder_press: ["overhead_press"],
  cable_lateral: ["lateral_raise"], triceps_pushdown: ["overhead_triceps_ext"], face_pull: ["reverse_fly"],
  goblet_squat: ["back_squat"], db_rdl: ["barbell_rdl"], db_split_squat: ["db_reverse_lunge", "db_step_up"],
  hanging_knee_raise: ["cable_crunch", "ab_wheel"], pull_up: ["chin_up", "lat_pulldown"], incline_db_press: ["chest_press", "push_up"],
  one_arm_row: ["one_arm_cable_row", "inverted_row"], reverse_fly: ["face_pull"], lateral_raise: ["cable_lateral"],
  cable_curl: ["hammer_curl", "incline_db_curl"], dips: ["push_up"], deadlift: ["trap_bar_deadlift", "barbell_rdl"],
  db_bulgarian: ["db_reverse_lunge"], ham_curl: ["prone_leg_curl"], prone_leg_curl: [], hip_thrust: ["db_hip_thrust", "glute_press"], db_hip_thrust: ["hip_thrust", "glute_press"], glute_press: ["hip_thrust", "db_hip_thrust"],
  plank: ["ab_wheel", "pallof_press"],
  back_squat: ["goblet_squat"], bench_press: ["db_bench"], overhead_press: ["db_shoulder_press"], barbell_rdl: ["db_rdl"],
  trap_bar_deadlift: ["deadlift"], chin_up: ["pull_up"], weighted_pull_up: ["pull_up"], weighted_dips: ["dips"], push_up: ["db_bench"],
  inverted_row: ["seated_row"], ab_wheel: ["plank"], back_extension: ["hip_thrust"], cable_fly: ["incline_db_press"],
  one_arm_cable_row: ["one_arm_row"], overhead_triceps_ext: ["triceps_pushdown"], incline_db_curl: ["cable_curl"], hammer_curl: ["cable_curl"],
  cable_pull_through: ["db_rdl"], cable_crunch: ["hanging_knee_raise"], pallof_press: ["plank"], db_reverse_lunge: ["db_split_squat"], db_step_up: ["db_split_squat"],
};

// Groups for the Exercises screen (ids not listed fall under "Other")
export const CAT_ORDER = ["Chest & push", "Back & pull", "Shoulders", "Arms", "Legs: squat & lunge", "Legs: hinge & glutes", "Core & carry", "Other"];
const C = (cat, ids) => Object.fromEntries(ids.map((i) => [i, cat]));
export const CATS = {
  ...C("Chest & push", ["db_bench", "incline_db_press", "bench_press", "push_up", "cable_fly", "dips", "weighted_dips", "chest_press"]),
  ...C("Back & pull", ["seated_row", "one_arm_row", "one_arm_cable_row", "inverted_row", "pull_up", "chin_up", "weighted_pull_up", "lat_pulldown"]),
  ...C("Shoulders", ["db_shoulder_press", "overhead_press", "shoulder_press", "cable_lateral", "lateral_raise", "face_pull", "reverse_fly", "deltoid_fly"]),
  ...C("Arms", ["triceps_pushdown", "overhead_triceps_ext", "cable_curl", "incline_db_curl", "hammer_curl", "biceps_curl"]),
  ...C("Legs: squat & lunge", ["goblet_squat", "back_squat", "db_split_squat", "db_bulgarian", "db_reverse_lunge", "db_step_up", "leg_press", "leg_extension", "calf_raise"]),
  ...C("Legs: hinge & glutes", ["deadlift", "trap_bar_deadlift", "db_rdl", "barbell_rdl", "prone_leg_curl", "ham_curl", "back_extension", "cable_pull_through", "hip_thrust", "db_hip_thrust", "glute_press", "glute_bridge"]),
  ...C("Core & carry", ["plank", "hanging_knee_raise", "ab_wheel", "cable_crunch", "pallof_press", "farmers_carry"]),
};

// Recommended rest between sets, as written in the PT how-to docs
const R = (txt, ids) => Object.fromEntries(ids.map((i) => [i, txt]));
export const REST_TEXT = {
  ...R("90–120 s", ["db_bench", "seated_row", "db_shoulder_press", "goblet_squat", "db_rdl", "incline_db_press", "dips", "hip_thrust", "inverted_row", "db_reverse_lunge", "db_step_up"]),
  ...R("60–90 s", ["face_pull", "calf_raise", "hanging_knee_raise", "cable_curl", "ham_curl", "push_up", "ab_wheel", "back_extension", "cable_fly", "overhead_triceps_ext", "incline_db_curl", "hammer_curl", "cable_pull_through", "cable_crunch"]),
  ...R("2–3 min", ["pull_up", "deadlift", "back_squat", "bench_press", "overhead_press", "barbell_rdl", "trap_bar_deadlift", "chin_up", "weighted_pull_up", "weighted_dips"]),
  ...R("Superset: no rest between the pair, 60–90 s after it", ["cable_lateral", "triceps_pushdown", "reverse_fly", "lateral_raise"]),
  ...R("60–90 s per side", ["one_arm_row", "one_arm_cable_row"]),
  db_split_squat: "about 90 s, after both legs", db_bulgarian: "90–120 s, after both legs", prone_leg_curl: "60–90 s, after both legs",
  farmers_carry: "about 90 s", plank: "about 60 s", pallof_press: "45–60 s per side",
};
