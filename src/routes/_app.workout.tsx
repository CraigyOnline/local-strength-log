import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useLiveQuery } from "dexie-react-hooks";
import { useEffect, useMemo, useState } from "react";
import { z } from "zod";
import { getDb, type Routine, type WorkoutExerciseLog } from "@/lib/db";
import { getExercise } from "@/lib/exercises";
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

function WorkoutPage() {
  const { routineId } = Route.useSearch();
  const navigate = useNavigate();
  const routines = useLiveQuery(() =>
    typeof window === "undefined"
      ? []
      : getDb().routines.orderBy("createdAt").reverse().toArray()
  , []);

  const [active, setActive] = useState(null);

  function startWorkout(r: Routine | null) {
    setActive({
      routine: r,
      name: r?.name ?? "Quick Workout",
      startedAt: Date.now(),
      exercises:
        r?.exercises.map((e) => ({
          exerciseId: e.exerciseId,
          sets: Array.from({ length: e.sets }, () => ({
            weight: 0,
            reps: 0,
            duration: 0,
            completed: false,
            timerStart: null as number | null,
          })),
        })) ?? [],
    });
  }

  if (!active) {
    return (
      <div className="p-4">
        <button onClick={() => startWorkout(null)}>Empty Workout</button>
      </div>
    );
  }

  return (
    <LiveSession
      session={active}
      setSession={setActive}
      onFinish={async (save) => {
        if (save) {
          const endedAt = Date.now();

          const exercises = active.exercises.map((e) => ({
            ...e,
            pr: Math.max(...e.sets.map((s) => s.weight || 0)),
          }));

          await getDb().workouts.add({
            routineId: active.routine?.id,
            name: active.name,
            startedAt: active.startedAt,
            endedAt,
            durationSec: Math.round((endedAt - active.startedAt) / 1000),
            exercises,
          });
        }

        setActive(null);
        navigate({ to: "/profile" });
      }}
    />
  );
}

function LiveSession({ session, setSession, onFinish }) {
  const [, force] = useState(0);

  useEffect(() => {
    const t = setInterval(() => force(x => x + 1), 500);
    return () => clearInterval(t);
  }, []);

  const elapsed = Math.round((Date.now() - session.startedAt) / 1000);

  function updateSet(ei, si, patch) {
    setSession(s => {
      if (!s) return s;
      const exercises = [...s.exercises];
      exercises[ei].sets[si] = {
        ...exercises[ei].sets[si],
        ...patch,
      };
      return { ...s, exercises };
    });
  }

  function toggleTimer(ei, si) {
    setSession(s => {
      if (!s) return s;
      const set = s.exercises[ei].sets[si];

      const now = Date.now();
      const updated = set.timerStart
        ? { timerStart: null, duration: Math.round((now - set.timerStart) / 1000) }
        : { timerStart: now };

      const exercises = [...s.exercises];
      exercises[ei].sets[si] = { ...set, ...updated };

      return { ...s, exercises };
    });
  }

  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center gap-2">
        <Timer />
        <span>{elapsed}s</span>
      </div>

      {session.exercises.map((ex, ei) => {
        const def = getExercise(ex.exerciseId);

        return (
          <div key={ei} className="border p-3 rounded-xl">
            <div className="font-semibold">{def?.name}</div>

            {ex.sets.map((s, si) => {
              const isTime = def?.measurement === "time";

              return (
                <div key={si} className="flex gap-2 items-center mt-2">
                  <input
                    type="number"
                    placeholder={isTime ? "sec" : "reps"}
                    value={isTime ? s.duration : s.reps}
                    onChange={(e) =>
                      updateSet(ei, si, isTime
                        ? { duration: Number(e.target.value) }
                        : { reps: Number(e.target.value) }
                      )
                    }
                  />

                  <input
                    type="number"
                    placeholder="kg"
                    value={s.weight}
                    onChange={(e) =>
                      updateSet(ei, si, { weight: Number(e.target.value) })
                    }
                  />

                  {isTime && (
                    <button onClick={() => toggleTimer(ei, si)}>
                      {s.timerStart ? "Stop" : "Start"}
                    </button>
                  )}

                  {s.timerStart && (
                    <span>
                      {Math.round((Date.now() - s.timerStart) / 1000)}s
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        );
      })}

      <Button onClick={() => onFinish(true)}>Finish</Button>
    </div>
  );
}
