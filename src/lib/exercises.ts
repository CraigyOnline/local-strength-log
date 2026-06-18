export type MuscleGroup =
  | "Chest" | "Shoulders" | "Biceps" | "Triceps" | "Forearms"
  | "Abs" | "Obliques" | "Lats" | "UpperBack" | "LowerBack"
  | "Glutes" | "Quads" | "Hamstrings" | "Calves" | "Cardio";

export type Equipment =
  | "Barbell" | "Dumbbell" | "Machine" | "Cable"
  | "Bodyweight" | "Kettlebell" | "Band" | "Cardio" | "Other";

export type MeasurementType = "reps" | "time" | "distance";

export interface ExerciseDef {
  id: string;
  name: string;
  muscle: MuscleGroup;
  secondary?: MuscleGroup[];
  equipment: Equipment;
  measurement?: MeasurementType;
}

const E = (
  id: string,
  name: string,
  muscle: MuscleGroup,
  equipment: Equipment,
  secondary: MuscleGroup[] = [],
  measurement: MeasurementType = "reps",
): ExerciseDef => ({
  id,
  name,
  muscle,
  equipment,
  secondary,
  measurement,
});

export const EXERCISES: ExerciseDef[] = [
  E("bench-press", "Bench Press (Barbell)", "Chest", "Barbell"),
  E("push-up", "Push Up", "Chest", "Bodyweight"),

  E("pull-up", "Pull Up", "Lats", "Bodyweight"),
  E("lat-pulldown", "Lat Pulldown", "Lats", "Cable"),

  E("plank", "Plank", "Abs", "Bodyweight", [], "time"),
  E("side-plank", "Side Plank", "Obliques", "Bodyweight", [], "time"),
  E("hollow-hold", "Hollow Hold", "Abs", "Bodyweight", [], "time"),

  E("treadmill", "Treadmill Run", "Cardio", "Cardio", [], "distance"),
  E("jump-rope", "Jump Rope", "Cardio", "Cardio", [], "time"),
];

export const MUSCLE_GROUPS: MuscleGroup[] = [
  "Chest","Lats","UpperBack","LowerBack",
  "Shoulders","Biceps","Triceps","Forearms",
  "Abs","Obliques","Quads","Hamstrings",
  "Glutes","Calves","Cardio",
];

export function getExercise(id: string): ExerciseDef | undefined {
  return EXERCISES.find((e) => e.id === id);
}export type MuscleGroup =
  | "Chest"
  | "Shoulders"
  | "Biceps"
  | "Triceps"
  | "Forearms"
  | "Abs"
  | "Obliques"
  | "Lats"
  | "UpperBack"
  | "LowerBack"
  | "Glutes"
  | "Quads"
  | "Hamstrings"
  | "Calves"
  | "Cardio";

export type Equipment =
  | "Barbell"
  | "Dumbbell"
  | "Machine"
  | "Cable"
  | "Bodyweight"
  | "Kettlebell"
  | "Band"
  | "Cardio"
  | "Other";

export interface ExerciseDef {
  id: string;
  name: string;
  muscle: MuscleGroup;        // primary group (used for charts)
  secondary?: MuscleGroup[];  // secondary recruited muscles
  equipment: Equipment;
  /** Whether sets are tracked as distance/time rather than weight x reps */
  cardio?: boolean;
}

const E = (
  id: string,
  name: string,
  muscle: MuscleGroup,
  equipment: Equipment,
  secondary: MuscleGroup[] = [],
  cardio = false,
): ExerciseDef => ({ id, name, muscle, equipment, secondary, cardio });

export const EXERCISES: ExerciseDef[] = [
  // ---------- Chest ----------
  E("bench-press", "Bench Press (Barbell)", "Chest", "Barbell", ["Triceps", "Shoulders"]),
  E("incline-bench", "Incline Bench Press (Barbell)", "Chest", "Barbell", ["Shoulders", "Triceps"]),
  E("decline-bench", "Decline Bench Press (Barbell)", "Chest", "Barbell", ["Triceps"]),
  E("incline-db-press", "Incline Dumbbell Press", "Chest", "Dumbbell", ["Shoulders", "Triceps"]),
  E("db-bench-press", "Dumbbell Bench Press", "Chest", "Dumbbell", ["Triceps", "Shoulders"]),
  E("floor-press", "Floor Press (Dumbbell)", "Chest", "Dumbbell", ["Triceps"]),
  E("floor-press-bb", "Floor Press (Barbell)", "Chest", "Barbell", ["Triceps"]),
  E("chest-fly-db", "Dumbbell Chest Fly", "Chest", "Dumbbell", ["Shoulders"]),
  E("chest-fly-cable", "Cable Chest Fly", "Chest", "Cable", ["Shoulders"]),
  E("pec-deck", "Pec Deck Machine", "Chest", "Machine"),
  E("push-up", "Push Up", "Chest", "Bodyweight", ["Triceps", "Shoulders"]),
  E("dip-chest", "Chest Dip", "Chest", "Bodyweight", ["Triceps", "Shoulders"]),
  E("svend-press", "Svend Press", "Chest", "Other"),

  // ---------- Back / Lats ----------
  E("deadlift", "Deadlift (Barbell)", "LowerBack", "Barbell", ["Glutes", "Hamstrings", "Lats", "Forearms"]),
  E("sumo-deadlift", "Sumo Deadlift", "Glutes", "Barbell", ["LowerBack", "Hamstrings", "Quads"]),
  E("rdl", "Romanian Deadlift", "Hamstrings", "Barbell", ["Glutes", "LowerBack"]),
  E("pull-up", "Pull Up", "Lats", "Bodyweight", ["Biceps", "UpperBack"]),
  E("chin-up", "Chin Up", "Lats", "Bodyweight", ["Biceps"]),
  E("lat-pulldown", "Lat Pulldown", "Lats", "Cable", ["Biceps"]),
  E("bent-over-row-bb", "Bent Over Row (Barbell)", "UpperBack", "Barbell", ["Lats", "Biceps"]),
  E("db-row", "Dumbbell Row", "Lats", "Dumbbell", ["UpperBack", "Biceps"]),
  E("seated-cable-row", "Seated Cable Row", "UpperBack", "Cable", ["Lats", "Biceps"]),
  E("t-bar-row", "T-Bar Row", "UpperBack", "Barbell", ["Lats", "Biceps"]),
  E("chest-supported-row", "Chest-Supported Row", "UpperBack", "Machine", ["Lats", "Biceps"]),
  E("inverted-row", "Inverted Row", "UpperBack", "Bodyweight", ["Lats", "Biceps"]),
  E("pullover-db", "Dumbbell Pullover", "Lats", "Dumbbell", ["Chest"]),
  E("good-morning", "Good Morning", "LowerBack", "Barbell", ["Hamstrings", "Glutes"]),
  E("back-extension", "Back Extension", "LowerBack", "Bodyweight", ["Glutes", "Hamstrings"]),
  E("shrug-bb", "Shrug (Barbell)", "UpperBack", "Barbell"),
  E("shrug-db", "Shrug (Dumbbell)", "UpperBack", "Dumbbell"),

  // ---------- Shoulders ----------
  E("ohp", "Overhead Press (Barbell)", "Shoulders", "Barbell", ["Triceps"]),
  E("db-shoulder-press", "Dumbbell Shoulder Press", "Shoulders", "Dumbbell", ["Triceps"]),
  E("arnold-press", "Arnold Press", "Shoulders", "Dumbbell", ["Triceps"]),
  E("lateral-raise", "Lateral Raise (Dumbbell)", "Shoulders", "Dumbbell"),
  E("cable-lateral-raise", "Cable Lateral Raise", "Shoulders", "Cable"),
  E("front-raise", "Front Raise", "Shoulders", "Dumbbell"),
  E("rear-delt-fly", "Rear Delt Reverse Fly (Dumbbell)", "Shoulders", "Dumbbell", ["UpperBack"]),
  E("rear-delt-cable", "Rear Delt Cable Fly", "Shoulders", "Cable", ["UpperBack"]),
  E("reverse-pec-deck", "Reverse Pec Deck", "Shoulders", "Machine", ["UpperBack"]),
  E("face-pull", "Face Pull", "Shoulders", "Cable", ["UpperBack"]),
  E("upright-row", "Upright Row", "Shoulders", "Barbell", ["UpperBack"]),
  E("landmine-press", "Landmine Press", "Shoulders", "Barbell", ["Triceps", "Chest"]),
  E("pike-pushup", "Pike Push Up", "Shoulders", "Bodyweight", ["Triceps"]),

  // ---------- Biceps ----------
  E("bicep-curl-db", "Dumbbell Curl", "Biceps", "Dumbbell", ["Forearms"]),
  E("bicep-curl-bb", "Barbell Curl", "Biceps", "Barbell", ["Forearms"]),
  E("ez-curl", "EZ-Bar Curl", "Biceps", "Barbell", ["Forearms"]),
  E("hammer-curl", "Hammer Curl", "Biceps", "Dumbbell", ["Forearms"]),
  E("preacher-curl", "Preacher Curl", "Biceps", "Barbell"),
  E("concentration-curl", "Concentration Curl", "Biceps", "Dumbbell"),
  E("cable-curl", "Cable Curl", "Biceps", "Cable"),
  E("incline-db-curl", "Incline Dumbbell Curl", "Biceps", "Dumbbell"),

  // ---------- Triceps ----------
  E("tricep-pushdown", "Tricep Pushdown (Cable)", "Triceps", "Cable"),
  E("rope-pushdown", "Rope Pushdown", "Triceps", "Cable"),
  E("overhead-tri-ext", "Overhead Tricep Extension", "Triceps", "Dumbbell"),
  E("skull-crusher", "Skull Crusher", "Triceps", "Barbell"),
  E("close-grip-bench", "Close-Grip Bench Press", "Triceps", "Barbell", ["Chest"]),
  E("dip-tri", "Tricep Dip", "Triceps", "Bodyweight", ["Chest", "Shoulders"]),
  E("bench-dip", "Bench Dip", "Triceps", "Bodyweight"),
  E("kickback", "Tricep Kickback", "Triceps", "Dumbbell"),

  // ---------- Forearms ----------
  E("wrist-curl", "Wrist Curl", "Forearms", "Dumbbell"),
  E("reverse-curl", "Reverse Curl", "Forearms", "Barbell", ["Biceps"]),
  E("farmer-carry", "Farmer's Carry", "Forearms", "Dumbbell", ["UpperBack", "Quads"]),

  // ---------- Legs - Quads ----------
  E("back-squat", "Back Squat", "Quads", "Barbell", ["Glutes", "Hamstrings", "LowerBack"]),
  E("front-squat", "Front Squat", "Quads", "Barbell", ["Glutes", "Abs"]),
  E("goblet-squat", "Goblet Squat", "Quads", "Dumbbell", ["Glutes"]),
  E("hack-squat", "Hack Squat", "Quads", "Machine", ["Glutes"]),
  E("bulgarian-split", "Bulgarian Split Squat", "Quads", "Dumbbell", ["Glutes"]),
  E("lunge", "Walking Lunge", "Quads", "Dumbbell", ["Glutes"]),
  E("step-up", "Step Up", "Quads", "Dumbbell", ["Glutes"]),
  E("leg-press", "Leg Press", "Quads", "Machine", ["Glutes"]),
  E("leg-extension", "Leg Extension", "Quads", "Machine"),
  E("sissy-squat", "Sissy Squat", "Quads", "Bodyweight"),
  E("box-jump", "Box Jump", "Quads", "Bodyweight", ["Glutes", "Calves"]),

  // ---------- Hamstrings ----------
  E("leg-curl-seated", "Seated Leg Curl", "Hamstrings", "Machine"),
  E("leg-curl-lying", "Lying Leg Curl", "Hamstrings", "Machine"),
  E("nordic-curl", "Nordic Hamstring Curl", "Hamstrings", "Bodyweight"),
  E("sldl-db", "Single-Leg Deadlift (Dumbbell)", "Hamstrings", "Dumbbell", ["Glutes"]),

  // ---------- Glutes ----------
  E("hip-thrust", "Hip Thrust (Barbell)", "Glutes", "Barbell", ["Hamstrings"]),
  E("glute-bridge", "Glute Bridge", "Glutes", "Bodyweight", ["Hamstrings"]),
  E("cable-kickback", "Cable Glute Kickback", "Glutes", "Cable"),
  E("hip-abduction", "Hip Abduction Machine", "Glutes", "Machine"),

  // ---------- Calves ----------
  E("standing-calf", "Standing Calf Raise", "Calves", "Machine"),
  E("seated-calf", "Seated Calf Raise", "Calves", "Machine"),
  E("calf-raise-db", "Dumbbell Calf Raise", "Calves", "Dumbbell"),

  // ---------- Core / Abs ----------
  E("plank", "Plank", "Abs", "Bodyweight", ["Obliques"]),
  E("side-plank", "Side Plank", "Obliques", "Bodyweight", ["Abs"]),
  E("crunch", "Crunch", "Abs", "Bodyweight"),
  E("cable-crunch", "Cable Crunch", "Abs", "Cable"),
  E("hanging-leg-raise", "Hanging Leg Raise", "Abs", "Bodyweight"),
  E("lying-leg-raise", "Lying Leg Raise", "Abs", "Bodyweight"),
  E("russian-twist", "Russian Twist", "Obliques", "Bodyweight", ["Abs"]),
  E("ab-wheel", "Ab Wheel Rollout", "Abs", "Other"),
  E("woodchopper", "Cable Woodchopper", "Obliques", "Cable", ["Abs"]),
  E("dead-bug", "Dead Bug", "Abs", "Bodyweight"),
  E("hollow-hold", "Hollow Hold", "Abs", "Bodyweight"),
  E("mountain-climber", "Mountain Climber", "Abs", "Bodyweight", ["Cardio"]),

  // ---------- Cardio ----------
  E("treadmill", "Treadmill Run", "Cardio", "Cardio", [], true),
  E("rowing-machine", "Rowing Machine", "Cardio", "Cardio", ["UpperBack", "Lats", "Quads"], true),
  E("assault-bike", "Assault Bike", "Cardio", "Cardio", [], true),
  E("stationary-bike", "Stationary Bike", "Cardio", "Cardio", ["Quads"], true),
  E("elliptical", "Elliptical", "Cardio", "Cardio", [], true),
  E("stair-master", "Stair Master", "Cardio", "Cardio", ["Glutes", "Quads"], true),
  E("jump-rope", "Jump Rope", "Cardio", "Cardio", ["Calves"], true),
  E("ski-erg", "Ski Erg", "Cardio", "Cardio", ["Lats", "Abs"], true),
  E("outdoor-run", "Outdoor Run", "Cardio", "Cardio", [], true),
  E("outdoor-walk", "Outdoor Walk", "Cardio", "Cardio", [], true),
  E("swimming", "Swimming", "Cardio", "Cardio", ["Lats", "Shoulders"], true),

  // ---------- Kettlebell / full body ----------
  E("kb-swing", "Kettlebell Swing", "Glutes", "Kettlebell", ["Hamstrings", "LowerBack"]),
  E("kb-goblet-squat", "Kettlebell Goblet Squat", "Quads", "Kettlebell", ["Glutes"]),
  E("turkish-getup", "Turkish Get-Up", "Abs", "Kettlebell", ["Shoulders", "Glutes"]),
  E("clean-press", "Clean & Press", "Shoulders", "Barbell", ["Quads", "Glutes", "UpperBack"]),
  E("power-clean", "Power Clean", "UpperBack", "Barbell", ["Quads", "Glutes"]),
  E("snatch", "Snatch", "Shoulders", "Barbell", ["Quads", "Glutes", "UpperBack"]),
];

export const MUSCLE_GROUPS: MuscleGroup[] = [
  "Chest", "Lats", "UpperBack", "LowerBack",
  "Shoulders", "Biceps", "Triceps", "Forearms",
  "Abs", "Obliques", "Quads", "Hamstrings",
  "Glutes", "Calves", "Cardio",
];

export function getExercise(id: string): ExerciseDef | undefined {
  return EXERCISES.find((e) => e.id === id);
}
