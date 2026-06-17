export type MuscleGroup =
  | "Chest"
  | "Back"
  | "Shoulders"
  | "Biceps"
  | "Triceps"
  | "Legs"
  | "Core"
  | "Glutes"
  | "Cardio";

export interface ExerciseDef {
  id: string;
  name: string;
  muscle: MuscleGroup;
}

export const EXERCISES: ExerciseDef[] = [
  { id: "bench-press", name: "Bench Press (Barbell)", muscle: "Chest" },
  { id: "incline-db-press", name: "Incline Dumbbell Press", muscle: "Chest" },
  { id: "chest-fly", name: "Cable Chest Fly", muscle: "Chest" },
  { id: "push-up", name: "Push Up", muscle: "Chest" },
  { id: "deadlift", name: "Deadlift (Barbell)", muscle: "Back" },
  { id: "pull-up", name: "Pull Up", muscle: "Back" },
  { id: "lat-pulldown", name: "Lat Pulldown", muscle: "Back" },
  { id: "bent-over-row", name: "Bent Over Row", muscle: "Back" },
  { id: "ohp", name: "Overhead Press", muscle: "Shoulders" },
  { id: "lateral-raise", name: "Lateral Raise", muscle: "Shoulders" },
  { id: "face-pull", name: "Face Pull", muscle: "Shoulders" },
  { id: "bicep-curl", name: "Dumbbell Curl", muscle: "Biceps" },
  { id: "hammer-curl", name: "Hammer Curl", muscle: "Biceps" },
  { id: "tricep-pushdown", name: "Tricep Pushdown", muscle: "Triceps" },
  { id: "skull-crusher", name: "Skull Crusher", muscle: "Triceps" },
  { id: "squat", name: "Back Squat", muscle: "Legs" },
  { id: "front-squat", name: "Front Squat", muscle: "Legs" },
  { id: "leg-press", name: "Leg Press", muscle: "Legs" },
  { id: "leg-curl", name: "Leg Curl", muscle: "Legs" },
  { id: "leg-extension", name: "Leg Extension", muscle: "Legs" },
  { id: "hip-thrust", name: "Hip Thrust", muscle: "Glutes" },
  { id: "rdl", name: "Romanian Deadlift", muscle: "Glutes" },
  { id: "plank", name: "Plank", muscle: "Core" },
  { id: "crunch", name: "Crunch", muscle: "Core" },
  { id: "hanging-leg-raise", name: "Hanging Leg Raise", muscle: "Core" },
  { id: "treadmill", name: "Treadmill", muscle: "Cardio" },
];

export const MUSCLE_GROUPS: MuscleGroup[] = [
  "Chest", "Back", "Shoulders", "Biceps", "Triceps", "Legs", "Core", "Glutes", "Cardio",
];

export function getExercise(id: string): ExerciseDef | undefined {
  return EXERCISES.find((e) => e.id === id);
}
