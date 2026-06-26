import Dexie, { type Table } from "dexie";

/**
 * ROUTINES
 */
export interface RoutineExercise {
  exerciseId: string;

  sets: number;

  targetWeight?: number;
  targetReps?: number;
  targetDuration?: number;
}

export interface Routine {
  id?: number;
  name: string;
  exercises: RoutineExercise[];
  createdAt: number;
  pinned?: boolean;
}

/**
 * WORKOUTS
 */
export interface WorkoutSet {
  // stable identity for undo / list reconciliation
  id?: string;

  weight: number;
  reps: number;

  // time-based support (planks, holds, etc.)
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
 * PR SYSTEM
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
export class AppDB extends Dexie {
  routines!: Table<Routine, number>;
  workouts!: Table<Workout, number>;
  prHistory!: Table<PRRecord, number>;

  constructor() {
    super("untrained-effort-db");

    this.version(3).stores({
      routines: "++id, name, createdAt",
      workouts: "++id, startedAt, routineId",
      prHistory: "++id, exerciseId, type, value, workoutId, createdAt",
    });

    // Version 4: adds `pinned` index to routines.
    // Existing rows have pinned explicitly set to false via upgrade().
    this.version(4)
      .stores({
        routines: "++id, name, createdAt, pinned",
        workouts: "++id, startedAt, routineId",
        prHistory: "++id, exerciseId, type, value, workoutId, createdAt",
      })
      .upgrade((tx) => {
        return tx
          .table("routines")
          .toCollection()
          .modify((routine) => {
            if (routine.pinned === undefined) {
              routine.pinned = false;
            }
          });
      });
  }
}

let _db: AppDB | null = null;

export function getDb(): AppDB {
  if (typeof window === "undefined") {
    throw new Error("DB is only available in the browser");
  }

  if (!_db) {
    try {
      _db = new AppDB();
    } catch (err) {
      throw new Error(
        `Failed to initialise database. IndexedDB may be unavailable (e.g. private browsing mode). Original error: ${err instanceof Error ? err.message : String(err)}`
      );
    }
  }

  return _db;
}
