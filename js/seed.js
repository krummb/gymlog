// Starting data: the 4-day upper/lower program.
// type: "weight" (kg × reps), "bodyweight" (reps, kg optional), "timed" (seconds)
export const SEED_VERSION = 1;

export const seedExercises = {
  chest_press:     { name: "Chest press machine", type: "weight", step: 2.5, scale: { unit: "kg", values: [9, 14, 18, 23, 27, 32, 36, 41, 46, 50, 55, 59, 64, 68, 73, 77, 82, 86, 91, 96, 100, 105, 109] }, cue: "Handles at chest height. Press smoothly, return with control. Shoulders relaxed." },
  seated_row:      { name: "Seated row", type: "weight", step: 2.5, cue: "Sit tall, pull towards lower ribs. No leaning or jerking." },
  shoulder_press:  { name: "Shoulder press machine", type: "weight", step: 2.5, cue: "Handles at shoulder height. Press up without arching your lower back." },
  biceps_curl:     { name: "Biceps curl", type: "weight", step: 1, cue: "Elbows still at your sides. Curl up, lower slowly." },
  triceps_pushdown:{ name: "Triceps pushdown", type: "weight", step: 2.5, cue: "Elbows pinned to your sides. Push down to straight arms, return slowly." },
  leg_press:       { name: "Leg press", type: "weight", step: 5, cue: "Back supported, feet shoulder-width. Lower slowly, don't let your lower back round." },
  seated_ham_curl: { name: "Seated hamstring curl", type: "weight", step: 2.5, cue: "Adjust to fit your legs. Pull the pad down, return slowly. Hips still." },
  calf_raise:      { name: "Calf raises", type: "bodyweight", step: 2.5, cue: "Rise high onto your toes, pause, lower slowly all the way." },
  glute_bridge:    { name: "Glute bridge", type: "bodyweight", step: 2.5, cue: "Feet flat, push through heels, squeeze glutes at the top. Don't overarch." },
  plank:           { name: "Plank", type: "timed", step: 5, cue: "Forearms and toes, body in a straight line. Brace and breathe. Stop if your back sags." },
  lat_pulldown:    { name: "Lat pulldown", type: "weight", step: 2.5, cue: "Grip slightly wider than shoulders. Pull to upper chest, torso mostly upright." },
  lateral_raise:   { name: "Lateral raises", type: "weight", step: 1, cue: "Slight bend in elbows. Raise to shoulder height, lower slowly. No swinging." },
  ham_curl:        { name: "Hamstring curl", type: "weight", step: 2.5, cue: "Adjust to fit your legs. Curl the pad up, return slowly. Hips still." },
  leg_extension:   { name: "Leg extension", type: "weight", step: 2.5, cue: "Knees lined up with the pivot. Straighten your legs, lower slowly." },
};

// sets start at 1 (weeks 1–2), bump to 2 in Programs around week 3
const it = (id, min, max) => ({ ex: id, sets: 1, min, max });

export const seedWorkouts = {
  A: { name: "Upper A", items: [it("chest_press",8,10), it("seated_row",8,10), it("shoulder_press",8,10), it("biceps_curl",10,12), it("triceps_pushdown",10,12)] },
  B: { name: "Lower A", items: [it("leg_press",8,10), it("seated_ham_curl",10,12), it("calf_raise",12,15), it("glute_bridge",10,12), it("plank",20,30)] },
  C: { name: "Upper B", items: [it("lat_pulldown",8,10), it("chest_press",8,10), it("seated_row",8,10), it("lateral_raise",10,12), it("biceps_curl",10,12)] },
  D: { name: "Lower B", items: [it("leg_press",8,10), it("ham_curl",10,12), it("leg_extension",10,12), it("calf_raise",12,15), it("plank",20,30)] },
};

export const seedSettings = {
  globalNote: "Breathe out on effort. Stop if sharp pain.",
  restSec: 120,
  theme: "c2",
};
