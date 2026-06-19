import { createFileRoute, useNavigate } from "@tanstack/react-router";
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
import { Check, Plus, Timer, Trash2 } from "lucide-react";
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
      <div className="p-4">
        <Button onClick={() => startWorkout(null)}>
          <Plus className="mr-2 h-4 w-4" />
          Empty Workout
        </Button>
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

  const activeTimers = useRef<Record<string, number>>({});

  function fmt(sec: number) {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m}:${String(s).padStart(2, "0")}`;
  }

  function startUndo(payload: any) {
    if (undoState?.intervalId) clearInterval(undoState.intervalId);

    let seconds = 3;

    const intervalId = window.setInterval(() => {
      seconds -= 1;

      setUndoState((p) =>
        p ? { ...p, secondsLeft: seconds } : null,
      );

      if (seconds <= 0) {
        clearInterval(intervalId);
        setUndoState(null);
      }
    }, 1000);

    setUndoState({ ...payload, secondsLeft: 3, intervalId });
  }

  function undoDelete() {
    if (!undoState) return;

    clearInterval(undoState.intervalId);

    setSession((s) => {
      if (!s) return s;

      const exercises = [...s.exercises];
      const ex = exercises[undoState.exerciseIndex];

      ex.sets.splice(undoState.setIndex, 0, undoState.set);

      exercises[undoState.exerciseIndex] = ex;

      return { ...s, exercises };
    });

    setUndoState(null);
  }

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

      startUndo({
        exerciseIndex: ei,
        setIndex: si,
        set: deleted,
      });

      return updated;
    });
  }

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

  function getLiveDuration(set: any) {
    if (!set.timerStart) return set.duration;
    return set.duration + Math.floor((Date.now() - set.timerStart) / 1000);
  }

  return (
    <div className="p-4 pb-24">
      {session.exercises.map((ex, ei) => {
        const def = getExercise(ex.exerciseId);
        const timeBased = isTimeBased(def);

        return (
          <div key={ei} className="bg-card p-3 rounded-xl mb-4">
            <p className="font-semibold">{def?.name}</p>

            {ex.sets.map((s) => {
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
                      const si = ex.sets.findIndex(
                        (x) => x.id === s.id,
                      );
                      removeSet(ei, si);
                    }
                  }}
                  className="grid grid-cols-5 gap-2 mt-2 items-center"
                >
                  <span>{ex.sets.indexOf(s) + 1}</span>

                  {timeBased ? (
                    <span className="font-mono">
                      {fmt(getLiveDuration(s))}
                    </span>
                  ) : (
                    <input
                      value={s.weight}
                      onChange={(e) =>
                        updateSet(ei, s.id, {
                          weight: Number(e.target.value),
                        })
                      }
                      className="bg-secondary px-2 py-1 rounded"
                    />
                  )}

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

                  <button
                    onClick={() => {
                      const si = ex.sets.findIndex(
                        (x) => x.id === s.id,
                      );
                      removeSet(ei, si);
                    }}
                  >
                    <Trash2 />
                  </button>
                </div>
              );
            })}
          </div>
        );
      })}

      {undoState && (
        <div className="fixed bottom-20 left-4 right-4 bg-black text-white p-3 rounded flex justify-between">
          <span>
            Set deleted — Undo ({undoState.secondsLeft})
          </span>
          <button onClick={undoDelete}>Undo</button>
        </div>
      )}
    </div>
  );
}
