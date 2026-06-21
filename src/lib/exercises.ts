export type MuscleGroup =
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
  muscle: MuscleGroup;
  secondary?: MuscleGroup[];
  equipment: Equipment;

  /** cardio-style (treadmill, rowing) — uses time + optional distance */
  cardio?: boolean;
  /** time-based (planks, holds) — uses duration instead of reps */
  time?: boolean;
  /** interval/HIIT config — drives an auto interval timer on workout screen */
  interval?: {
    rounds: number;
    workSeconds: number;
    restSeconds: number;
  };
}

const E = (
  id: string,
  name: string,
  muscle: MuscleGroup,
  equipment: Equipment,
  secondary: MuscleGroup[] = [],
  opts: {
    cardio?: boolean;
    time?: boolean;
    interval?: { rounds: number; workSeconds: number; restSeconds: number };
  } = {},
): ExerciseDef => ({
  id,
  name,
  muscle,
  equipment,
  secondary,
  cardio: opts.cardio,
  time: opts.time,
  interval: opts.interval,
});

export const EXERCISES: ExerciseDef[] = [
  // Chest
  E("bench-press", "Bench Press (Barbell)", "Chest", "Barbell", ["Triceps", "Shoulders"]),
  E("incline-bench", "Incline Bench Press (Barbell)", "Chest", "Barbell", ["Shoulders", "Triceps"]),
  E("db-bench-press", "Dumbbell Bench Press", "Chest", "Dumbbell", ["Triceps", "Shoulders"]),
  E("floor-press", "Floor Press", "Chest", "Barbell", ["Triceps"]),
  E("db-floor-press", "Dumbbell Floor Press", "Chest", "Dumbbell", ["Triceps"]),
  E("chest-fly", "Chest Fly (Dumbbell)", "Chest", "Dumbbell"),
  E("cable-crossover", "Cable Crossover", "Chest", "Cable"),
  E("push-up", "Push Up", "Chest", "Bodyweight", ["Triceps", "Shoulders"]),
  E("dip", "Chest Dip", "Chest", "Bodyweight", ["Triceps"]),

  // Back
  E("deadlift", "Deadlift (Barbell)", "LowerBack", "Barbell", ["Glutes", "Hamstrings"]),
  E("romanian-deadlift", "Romanian Deadlift", "Hamstrings", "Barbell", ["Glutes", "LowerBack"]),
  E("pull-up", "Pull Up", "Lats", "Bodyweight", ["Biceps"]),
  E("chin-up", "Chin Up", "Lats", "Bodyweight", ["Biceps"]),
  E("lat-pulldown", "Lat Pulldown", "Lats", "Cable", ["Biceps"]),
  E("seated-row", "Seated Cable Row", "UpperBack", "Cable", ["Biceps"]),
  E("db-row", "Dumbbell Row", "Lats", "Dumbbell", ["UpperBack", "Biceps"]),
  E("barbell-row", "Barbell Row", "UpperBack", "Barbell", ["Lats", "Biceps"]),
  E("t-bar-row", "T-Bar Row", "UpperBack", "Barbell", ["Lats"]),
  E("face-pull", "Face Pull", "UpperBack", "Cable", ["Shoulders"]),
  E("back-extension", "Back Extension", "LowerBack", "Bodyweight", ["Glutes"]),

  // Shoulders
  E("ohp", "Overhead Press (Barbell)", "Shoulders", "Barbell", ["Triceps"]),
  E("db-shoulder-press", "Dumbbell Shoulder Press", "Shoulders", "Dumbbell", ["Triceps"]),
  E("arnold-press", "Arnold Press", "Shoulders", "Dumbbell", ["Triceps"]),
  E("lateral-raise", "Lateral Raise", "Shoulders", "Dumbbell"),
  E("front-raise", "Front Raise", "Shoulders", "Dumbbell"),
  E("rear-delt-fly", "Rear Delt Reverse Fly", "Shoulders", "Dumbbell", ["UpperBack"]),
  E("reverse-pec-deck", "Reverse Pec Deck", "Shoulders", "Machine", ["UpperBack"]),
  E("shrug", "Shrug (Dumbbell)", "UpperBack", "Dumbbell"),

  // Arms
  E("bicep-curl-db", "Dumbbell Curl", "Biceps", "Dumbbell"),
  E("bicep-curl-bb", "Barbell Curl", "Biceps", "Barbell"),
  E("hammer-curl", "Hammer Curl", "Biceps", "Dumbbell", ["Forearms"]),
  E("preacher-curl", "Preacher Curl", "Biceps", "Barbell"),
  E("tricep-pushdown", "Tricep Pushdown", "Triceps", "Cable"),
  E("overhead-tri-ext", "Overhead Tricep Extension", "Triceps", "Dumbbell"),
  E("skullcrusher", "Skullcrusher", "Triceps", "Barbell"),
  E("close-grip-bench", "Close-Grip Bench Press", "Triceps", "Barbell", ["Chest"]),
  E("wrist-curl", "Wrist Curl", "Forearms", "Dumbbell"),

  // Legs
  E("back-squat", "Back Squat", "Quads", "Barbell", ["Glutes"]),
  E("front-squat", "Front Squat", "Quads", "Barbell", ["Glutes"]),
  E("goblet-squat", "Goblet Squat", "Quads", "Dumbbell", ["Glutes"]),
  E("leg-press", "Leg Press", "Quads", "Machine", ["Glutes"]),
  E("leg-extension", "Leg Extension", "Quads", "Machine"),
  E("leg-curl", "Leg Curl", "Hamstrings", "Machine"),
  E("lunge", "Walking Lunge", "Quads", "Dumbbell", ["Glutes"]),
  E("bulgarian-split-squat", "Bulgarian Split Squat", "Quads", "Dumbbell", ["Glutes"]),
  E("hip-thrust", "Hip Thrust", "Glutes", "Barbell", ["Hamstrings"]),
  E("glute-bridge", "Glute Bridge", "Glutes", "Bodyweight"),
  E("calf-raise", "Standing Calf Raise", "Calves", "Machine"),
  E("seated-calf-raise", "Seated Calf Raise", "Calves", "Machine"),

  // Core (time-based)
  E("plank", "Plank", "Abs", "Bodyweight", [], { time: true }),
  E("side-plank", "Side Plank", "Obliques", "Bodyweight", ["Abs"], { time: true }),
  E("dead-hang", "Dead Hang", "Forearms", "Bodyweight", ["Lats"], { time: true }),
  E("wall-sit", "Wall Sit", "Quads", "Bodyweight", ["Glutes"], { time: true }),
  E("hollow-hold", "Hollow Hold", "Abs", "Bodyweight", [], { time: true }),
  E("l-sit", "L-Sit", "Abs", "Bodyweight", [], { time: true }),

  // Core (reps)
  E("crunch", "Crunch", "Abs", "Bodyweight"),
  E("sit-up", "Sit Up", "Abs", "Bodyweight"),
  E("hanging-leg-raise", "Hanging Leg Raise", "Abs", "Bodyweight"),
  E("russian-twist", "Russian Twist", "Obliques", "Bodyweight"),
  E("ab-wheel", "Ab Wheel Rollout", "Abs", "Other"),

  // Cardio (time-based)
  E("treadmill", "Treadmill Run", "Cardio", "Cardio", [], { cardio: true, time: true }),
  E("rowing-machine", "Rowing Machine", "Cardio", "Cardio", ["UpperBack", "Lats"], { cardio: true, time: true }),
  E("stationary-bike", "Stationary Bike", "Cardio", "Cardio", ["Quads"], { cardio: true, time: true }),
  E("elliptical", "Elliptical", "Cardio", "Cardio", [], { cardio: true, time: true }),
  E("stair-climber", "Stair Climber", "Cardio", "Cardio", ["Glutes"], { cardio: true, time: true }),
  E("jump-rope", "Jump Rope", "Cardio", "Cardio", ["Calves"], { cardio: true, time: true }),
  E("rowing-intervals", "Rowing Intervals", "Cardio", "Cardio", ["UpperBack", "Lats"], {
    cardio: true,
    time: true,
    interval: { rounds: 8, workSeconds: 60, restSeconds: 120 },
  }),
];

export const MUSCLE_GROUPS: MuscleGroup[] = [
  "Chest",
  "Lats",
  "UpperBack",
  "LowerBack",
  "Shoulders",
  "Biceps",
  "Triceps",
  "Forearms",
  "Abs",
  "Obliques",
  "Quads",
  "Hamstrings",
  "Glutes",
  "Calves",
  "Cardio",
];

export function getExercise(id: string): ExerciseDef | undefined {
  return EXERCISES.find((e) => e.id === id);
}

/** Helper: should this exercise use time/duration tracking instead of reps? */
export function isTimeBased(def: ExerciseDef | undefined): boolean {
  return Boolean(def?.time || def?.cardio);
}
