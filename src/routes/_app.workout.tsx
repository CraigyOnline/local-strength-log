import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useLiveQuery } from "dexie-react-hooks";
import { useEffect, useState, useRef } from "react";
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
   TYPES
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
   SET FACTORY
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

  /* =========================
     RENDER (EMPTY STATE)
  ========================= */

  if (!active) {
    return (
      <div className="flex flex-col gap-4 px-4 pt-6">
        <h1 className="text-2xl font-bold">Start Workout</h1>

        <Button onClick={() => startWorkout(null)}>
          <Plus className="mr-2 h-4 w-4" />
          Empty Workout
        </Button>

        <div className="flex flex-col gap-2">
          {(routines ?? []).map((r) => (
            <button
              key={r.id}
              onClick={() => startWorkout(r)}
              className="w-full rounded-xl bg-card px-4 py-3 text-left"
            >
              <p className="font-semibold">{r.name}</p>
              <p className="text-xs text-muted-foreground">
                {r.exercises.length} exercises
              </p>
            </button>
          ))}
        </div>
      </div>
    );
  }

  return (
    <LiveSession
      session={active}
      setSession={setActive}
      onAddExercise={() => setPicking(true)}
      onFinish={async (save) => {
        if (save) {
          const exercises: WorkoutExerciseLog[] = active.exercises.map(
            (e) => ({
              exerciseId: e.exerciseId,
              sets: e.sets.map((s) => ({
                weight: Number(s.weight) || 0,
                reps: Number(s.reps) || 0,
                duration: Number(s.duration) || 0,
                completed: s.completed,
              })),
            }),
          );

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
  );
}

/* =========================
   LIVE SESSION
========================= */

function LiveSession({ session, setSession, onAddExercise }) {
  const [, force] = useState(0);

  useEffect(() => {
    const t = setInterval(() => force((x) => x + 1), 500);
    return () => clearInterval(t);
  }, []);

  const swipeStart = useRef<Record<string, number>>({});
  const [undoState, setUndoState] = useState<any>(null);

  /* =========================
     SESSION TIMER
  ========================= */

  const elapsed = Math.floor(
    (Date.now() - session.startedAt) / 1000,
  );

  function fmt(sec: number) {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m}:${String(s).padStart(2, "0")}`;
  }

  /* =========================
     SET UPDATE
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

  /* =========================
     ADD SET (FIXED)
  ========================= */

  function addSet(ei: number) {
    setSession((s) => {
      if (!s) return s;

      return {
        ...s,
        exercises: s.exercises.map((e, i) =>
          i !== ei
            ? e
            : {
                ...e,
                sets: [...e.sets, makeSet()],
              },
        ),
      };
    });
  }

  /* =========================
     DELETE + UNDO (FIXED)
  ========================= */

  function removeSet(ei: number, si: number) {
    setSession((s) => {
      if (!s) return s;

      const deleted = s.exercises[ei].sets[si];

      const updated = {
        ...s,
        exercises: s.exercises.map((e, i) =>
          i !== ei
            ? e
            : {
                ...e,
                sets: e.sets.filter((set) => set.id !== deleted.id),
              },
        ),
      };

      setUndoState({
        exerciseIndex: ei,
        setIndex: si,
        set: deleted,
        timeout: Date.now(),
      });

      return updated;
    });
  }

  function undoDelete() {
    if (!undoState) return;

    setSession((s) => {
      if (!s) return s;

      return {
        ...s,
        exercises: s.exercises.map((e, i) => {
          if (i !== undoState.exerciseIndex) return e;

          const exists = e.sets.find((x) => x.id === undoState.set.id);
          if (exists) return e;

          const sets = [...e.sets];
          sets.splice(undoState.setIndex, 0, undoState.set);

          return { ...e, sets };
        }),
      };
    });

    setUndoState(null);
  }

  /* =========================
     RENDER
  ========================= */

  return (
    <div className="flex flex-col gap-4 px-4 pt-4 pb-28">
      {/* HEADER TIMER (RESTORED) */}
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-bold">{session.name}</h1>
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Timer className="h-4 w-4" />
          {fmt(elapsed)}
        </div>
      </div>

      {session.exercises.map((ex, ei) => {
        const def = getExercise(ex.exerciseId);
        const timeBased = isTimeBased(def);

        return (
          <div key={ei} className="bg-card p-3 rounded-xl">
            <p className="font-semibold">{def?.name}</p>

            {/* SET HEADER */}
            <div className="grid grid-cols-5 text-xs text-muted-foreground mt-2">
              <span>#</span>
              <span>{timeBased ? "Time" : "Weight"}</span>
              <span>Reps</span>
              <span></span>
              <span></span>
            </div>

            {ex.sets.map((s, si) => {
              const key = s.id;

              return (
                <div
                  key={s.id}
                  onTouchStart={(e) => {
                    swipeStart.current[key] =
                      e.touches[0].clientX;
                  }}
                  onTouchEnd={(e) => {
                    const start = swipeStart.current[key];
                    if (!start) return;

                    const delta =
                      e.changedTouches[0].clientX - start;

                    delete swipeStart.current[key];

                    if (delta < -60) {
                      removeSet(ei, si);
                    }
                  }}
                  className="grid grid-cols-5 gap-2 mt-2 items-center"
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
              );
            })}

            {/* ADD SET (RESTORED) */}
            <button
              onClick={() => addSet(ei)}
              className="mt-3 w-full rounded bg-secondary py-2 text-sm"
            >
              + Add set
            </button>
          </div>
        );
      })}

      {/* UNDO (FIXED) */}
      {undoState && (
        <div className="fixed bottom-20 left-4 right-4 bg-black text-white p-3 rounded flex justify-between">
          <span>Set deleted — Undo</span>
          <button onClick={undoDelete}>Undo</button>
        </div>
      )}

      {/* ADD EXERCISE */}
      <Button onClick={onAddExercise} className="w-full">
        <Plus className="mr-2 h-4 w-4" />
        Add exercise
      </Button>
    </div>
  );
}
