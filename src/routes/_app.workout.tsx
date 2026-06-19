import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useLiveQuery } from "dexie-react-hooks";
import { useEffect, useState } from "react";
import { z } from "zod";
import {
  getDb,
  type Routine,
  type Workout,
  type WorkoutExerciseLog,
  type WorkoutSet,
} from "@/lib/db";
import { getExercise, isTimeBased } from "@/lib/exercises";
import { ExercisePicker } from "./_app.routines";
import { Check, Plus, Timer, X, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";

const searchSchema = z.object({
  routineId: z.coerce.number().optional(),
});

export const Route = createFileRoute("/_app/workout")({
  validateSearch: searchSchema,
  component: WorkoutPage,
});

/* =========================
   TYPES (FIXED: stable IDs added)
========================= */

type UIDSet = WorkoutSet & {
  id: string;
  timerStart: number | null;
};

interface ActiveSession {
  routine: Routine | null;
  name: string;
  startedAt: number;
  exercises: Array<{
    exerciseId: string;
    sets: UIDSet[];
  }>;
}

/* =========================
   SET FACTORY (FIXED)
========================= */

function makeSet(): UIDSet {
  return {
    id: crypto.randomUUID(),
    weight: 0,
    reps: 0,
    duration: 0,
    completed: false,
    timerStart: null,
  };
}

/* =========================
   PAGE
========================= */

function WorkoutPage() {
  const { routineId } = Route.useSearch();
  const navigate = useNavigate();

  const routines = useLiveQuery(
    () =>
      typeof window === "undefined"
        ? Promise.resolve<Routine[]>([])
        : getDb().routines.orderBy("createdAt").reverse().toArray(),
    [],
  ) as Routine[] | undefined;

  const [active, setActive] = useState<ActiveSession | null>(null);
  const [picking, setPicking] = useState(false);

  useEffect(() => {
    if (active || !routineId || !routines) return;
    const r = routines.find((x) => x.id === routineId);
    if (r) startWorkout(r);
  }, [routineId, routines]);

  function startWorkout(r: Routine | null) {
    setActive({
      routine: r,
      name: r?.name ?? "Quick Workout",
      startedAt: Date.now(),
      exercises:
        r?.exercises.map((e) => ({
          exerciseId: e.exerciseId,
          sets: Array.from({ length: Math.max(1, e.sets) }, () =>
            makeSet(),
          ),
        })) ?? [],
    });
  }

  if (!active) {
    return (
      <div className="flex flex-col gap-4 px-4 pt-6">
        <h1 className="text-2xl font-bold">Start Workout</h1>

        <Button onClick={() => startWorkout(null)}>
          <Plus className="mr-2 h-4 w-4" />
          Empty Workout
        </Button>

        <div>
          <p className="mb-2 text-sm font-semibold text-muted-foreground">
            From routine
          </p>

          {(routines ?? []).length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No routines yet. <Link to="/routines">Create one</Link>.
            </p>
          ) : (
            <ul className="flex flex-col gap-2">
              {(routines ?? []).map((r) => (
                <li key={r.id}>
                  <button
                    onClick={() => startWorkout(r)}
                    className="w-full rounded-xl bg-card px-4 py-3 text-left"
                  >
                    <p className="font-semibold">{r.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {r.exercises.length} exercises
                    </p>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    );
  }

  return (
    <>
      <LiveSession
        session={active}
        setSession={setActive}
        onAddExercise={() => setPicking(true)}
        onFinish={async (save: boolean) => {
          if (save) {
            const exercises: WorkoutExerciseLog[] =
              active.exercises.map((e) => ({
                exerciseId: e.exerciseId,
                sets: e.sets.map((s) => ({
                  weight: Number(s.weight) || 0,
                  reps: Number(s.reps) || 0,
                  duration: Number(s.duration) || 0,
                  completed: s.completed,
                })),
              }));

            await getDb().workouts.add({
              routineId: active.routine?.id,
              name: active.name,
              startedAt: active.startedAt,
              endedAt: Date.now(),
              durationSec: Math.round(
                (Date.now() - active.startedAt) / 1000,
              ),
              exercises,
            });
          }

          setActive(null);
          navigate({ to: "/history" });
        }}
      />

      {picking && (
        <ExercisePicker
          onClose={() => setPicking(false)}
          onPick={(id) => {
            setActive((s) =>
              s
                ? {
                    ...s,
                    exercises: [
                      ...s.exercises,
                      { exerciseId: id, sets: [makeSet()] },
                    ],
                  }
                : s,
            );
            setPicking(false);
          }}
        />
      )}
    </>
  );
}

/* =========================
   LIVE SESSION (RESTORED ORIGINAL UI + FIXED IDS)
========================= */

function LiveSession({ session, setSession, onAddExercise, onFinish }) {
  const [, force] = useState(0);

  useEffect(() => {
    const t = setInterval(() => force((x) => x + 1), 500);
    return () => clearInterval(t);
  }, []);

  const elapsed = Math.max(
    0,
    Math.round((Date.now() - session.startedAt) / 1000),
  );

  function fmtMMSS(sec: number) {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m}:${String(s).padStart(2, "0")}`;
  }

  /* =========================
     UPDATE SET (ID SAFE)
  ========================= */

  function updateSet(ei: number, setId: string, patch: any) {
    setSession((s) => {
      if (!s) return s;

      return {
        ...s,
        exercises: s.exercises.map((e, i) =>
          i !== ei
            ? e
            : {
                ...e,
                sets: e.sets.map((set) =>
                  set.id === setId ? { ...set, ...patch } : set,
                ),
              },
        ),
      };
    });
  }

  function addSet(ei: number) {
    setSession((s) =>
      s
        ? {
            ...s,
            exercises: s.exercises.map((e, i) =>
              i !== ei ? e : { ...e, sets: [...e.sets, makeSet()] },
            ),
          }
        : s,
    );
  }

  function removeSet(ei: number, si: number) {
    setSession((s) =>
      s
        ? {
            ...s,
            exercises: s.exercises.map((e, i) =>
              i !== ei
                ? e
                : {
                    ...e,
                    sets: e.sets.filter((_, j) => j !== si),
                  },
            ),
          }
        : s,
    );
  }

  function removeExercise(ei: number) {
    setSession((s) =>
      s
        ? {
            ...s,
            exercises: s.exercises.filter((_, i) => i !== ei),
          }
        : s,
    );
  }

  return (
    <div className="flex flex-col gap-4 px-4 pt-4 pb-8">
      {/* HEADER TIMER (RESTORED) */}
      <header className="flex items-center justify-between">
        <input
          value={session.name}
          onChange={(e) =>
            setSession((s) =>
              s ? { ...s, name: e.target.value } : s,
            )
          }
          className="min-w-0 flex-1 bg-transparent text-lg font-bold outline-none"
        />

        <div className="ml-2 flex items-center gap-1 text-sm text-muted-foreground">
          <Timer className="h-4 w-4" />
          <span className="tabular-nums">{fmtMMSS(elapsed)}</span>
        </div>
      </header>

      {/* FULL ORIGINAL UI RESTORED */}
      {session.exercises.map((ex, ei) => {
        const def = getExercise(ex.exerciseId);
        const timeBased = isTimeBased(def);

        return (
          <div key={ei} className="rounded-xl bg-card p-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-semibold">
                  {def?.name ?? ex.exerciseId}
                </p>
                <p className="text-xs text-muted-foreground">
                  {def?.muscle}
                </p>
              </div>

              <button onClick={() => removeExercise(ei)}>
                <X />
              </button>
            </div>

            <div className="mt-3 grid grid-cols-5 text-xs text-muted-foreground">
              <span>#</span>
              <span>{timeBased ? "Sec" : "Kg"}</span>
              <span>{timeBased ? "Notes" : "Reps"}</span>
              <span></span>
              <span></span>
            </div>

            {ex.sets.map((s, si) => (
              <div
                key={s.id}
                className="mt-2 grid grid-cols-5 items-center gap-2"
              >
                <span>{si + 1}</span>

                <input
                  value={s.weight}
                  onChange={(e) =>
                    updateSet(ei, s.id, {
                      weight: Number(e.target.value),
                    })
                  }
                  className="bg-secondary px-2 py-1 rounded"
                />

                <input
                  value={s.reps}
                  onChange={(e) =>
                    updateSet(ei, s.id, {
                      reps: Number(e.target.value),
                    })
                  }
                  className="bg-secondary px-2 py-1 rounded"
                />

                <button
                  onClick={() =>
                    updateSet(ei, s.id, {
                      completed: !s.completed,
                    })
                  }
                >
                  <Check />
                </button>

                <button onClick={() => removeSet(ei, si)}>
                  <Trash2 />
                </button>
              </div>
            ))}

            {/* ADD SET RESTORED */}
            <button
              onClick={() => addSet(ei)}
              className="mt-3 w-full rounded bg-secondary py-2 text-sm"
            >
              + Add set
            </button>
          </div>
        );
      })}

      {/* ACTIONS RESTORED */}
      <Button onClick={onAddExercise} className="w-full">
        <Plus className="mr-2 h-4 w-4" />
        Add exercise
      </Button>

      <div className="grid grid-cols-2 gap-2">
        <Button variant="ghost" onClick={() => onFinish(false)}>
          Cancel
        </Button>
        <Button onClick={() => onFinish(true)}>Finish</Button>
      </div>
    </div>
  );
}
