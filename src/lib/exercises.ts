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

  /** time-based / cardio-style tracking */
  cardio?: boolean;
}

const E = (
  id: string,
  name: string,
  muscle: MuscleGroup,
  equipment: Equipment,
  secondary: MuscleGroup[] = [],
  cardio = false,
): ExerciseDef => ({
  id,
  name,
  muscle,
  equipment,
  secondary,
  cardio,
});

export const EXERCISES: ExerciseDef[] = [
  E("bench-press", "Bench Press (Barbell)", "Chest", "Barbell", ["Triceps", "Shoulders"]),
  E("incline-bench", "Incline Bench Press (Barbell)", "Chest", "Barbell", ["Shoulders", "Triceps"]),
  E("push-up", "Push Up", "Chest", "Bodyweight", ["Triceps", "Shoulders"]),

  E("deadlift", "Deadlift (Barbell)", "LowerBack", "Barbell", ["Glutes", "Hamstrings"]),
  E("pull-up", "Pull Up", "Lats", "Bodyweight", ["Biceps"]),

  E("ohp", "Overhead Press", "Shoulders", "Barbell", ["Triceps"]),
  E("lateral-raise", "Lateral Raise", "Shoulders", "Dumbbell"),

  E("bicep-curl-db", "Dumbbell Curl", "Biceps", "Dumbbell"),
  E("tricep-pushdown", "Tricep Pushdown", "Triceps", "Cable"),

  E("back-squat", "Back Squat", "Quads", "Barbell", ["Glutes"]),
  E("leg-press", "Leg Press", "Quads", "Machine"),

  // core
  E("plank", "Plank", "Abs", "Bodyweight"),
  E("crunch", "Crunch", "Abs", "Bodyweight"),

  // cardio
  E("treadmill", "Treadmill Run", "Cardio", "Cardio", [], true),
  E("rowing-machine", "Rowing Machine", "Cardio", "Cardio", [], true),
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
