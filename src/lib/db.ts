import Dexie, { type Table } from "dexie";

/**
 * ROUTINES
 */
export interface RoutineExercise {
  exerciseId: string;
  sets: number;
}

export interface Routine {
  id?: number;
  name: string;
  exercises: RoutineExercise[];
  createdAt: number;
}

/**
 * WORKOUTS
 */
export interface WorkoutSet {
  weight: number;
  reps: number;

  // 🆕 time-based support (planks, holds, etc.)
  duration?: number;

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

/**
 * 🏆 PR SYSTEM
 */
export interface PRRecord {
  id?: number;
  exerciseId: string;
  type: "weight" | "reps" | "time";
  value: number;

  // link to workout where PR happened
  workoutId?: number;

  createdAt: number;
}

/**
 * DATABASE
 */
export class HevyDB extends Dexie {
  routines!: Table<Routine, number>;
  workouts!: Table<Workout, number>;

  // 🆕 PR table
  prHistory!: Table<PRRecord, number>;

  constructor() {
    super("hevy-clone-db");

    this.version(2).stores({
      routines: "++id, name, createdAt",
      workouts: "++id, startedAt, routineId",

      // 🆕 PR index
      prHistory: "++id, exerciseId, type, value, workoutId, createdAt",
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
