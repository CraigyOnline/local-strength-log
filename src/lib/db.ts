import Dexie, { type Table } from "dexie";

export interface RoutineExercise {
  exerciseId: string;
  sets: number; // target set count
}

export interface Routine {
  id?: number;
  name: string;
  exercises: RoutineExercise[];
  createdAt: number;
}

export interface WorkoutSet {
  weight: number;
  reps: number;
  completed: boolean;
}

export interface WorkoutExerciseLog {
  exerciseId: string;
  sets: WorkoutSet[];
}

export interface Workout {
  id?: number;
  routineId?: number;
  name: string;
  startedAt: number;
  endedAt: number;
  durationSec: number;
  exercises: WorkoutExerciseLog[];
}

export class HevyDB extends Dexie {
  routines!: Table<Routine, number>;
  workouts!: Table<Workout, number>;

  constructor() {
    super("hevy-clone-db");
    this.version(1).stores({
      routines: "++id, name, createdAt",
      workouts: "++id, startedAt, routineId",
    });
  }
}

let _db: HevyDB | null = null;
export function getDb(): HevyDB {
  if (typeof window === "undefined") {
    throw new Error("DB is only available in the browser");
  }
  if (!_db) _db = new HevyDB();
  return _db;
}
