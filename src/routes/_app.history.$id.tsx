import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  Check,
  Plus,
  Trash2,
  X,
  Pencil,
  Save,
} from "lucide-react";
import { getDb, type Workout, type WorkoutExerciseLog } from "@/lib/db";
import { getExercise } from "@/lib/exercises";
import { ExercisePicker } from "./_app.routines";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/_app/history/$id")({
  component: HistoryDetailPage,
});

/**
 * PR TYPES
 */
type PRType = "weight" | "reps" | "time";

/**
 * SIMPLE PR SAVER (safe + local)
 */
async function savePR(
  exerciseId: string,
  type: PRType,
  value: number,
  workoutId?: number
) {
  const db = getDb();

  const existing = await db.prHistory
    .where({ exerciseId, type })
    .toArray();

  const best = existing.reduce((m, p) => Math.max(m, p.value), 0);

  if (value > best) {
    await db.prHistory.add({
      exerciseId,
      type,
      value,
      workoutId,
      createdAt: Date.now(),
    });
    return true;
  }

  return false;
}

function HistoryDetailPage() {
  const { id } = Route.useParams();
  const navigate = useNavigate();

  const [workout, setWorkout] = useState<Workout | null | undefined>(undefined);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<Workout | null>(null);
  const [picking, setPicking] = useState(false);

  useEffect(() => {
    const n = Number(id);
    if (!Number.isFinite(n)) {
      setWorkout(null);
      return;
    }
    getDb().workouts.get(n).then((w) => setWorkout(w ?? null));
  }, [id]);

  if (workout === undefined) {
    return <div className="px-4 pt-8 text-sm text-muted-foreground">Loading…</div>;
  }

  if (workout === null) {
    return (
      <div className="flex flex-col gap-4 px-4 pt-6">
        <p className="text-sm text-muted-foreground">Workout not found.</p>
        <Link to="/profile" className="text-sm text-primary underline">
          Back to history
        </Link>
      </div>
    );
  }

  const view = editing && draft ? draft : workout;

  const totalVolume = view.exercises.reduce(
    (a, e) =>
      a +
      e.sets
        .filter((s) => s.completed)
        .reduce((x, s) => x + s.weight * s.reps, 0),
    0
  );

  const totalSets = view.exercises.reduce(
    (a, e) => a + e.sets.filter((s) => s.completed).length,
    0
  );

  function startEdit() {
    setDraft(JSON.parse(JSON.stringify(workout)));
    setEditing(true);
  }

  async function save() {
    if (!draft?.id) return;

    await getDb().workouts.update(draft.id, {
      name: draft.name,
      exercises: draft.exercises,
    });

    setWorkout(draft);
    setEditing(false);
  }

  async function remove() {
    if (!workout?.id) return;
    if (!confirm("Delete this workout?")) return;

    await getDb().workouts.delete(workout.id);
    navigate({ to: "/profile" });
  }

  /**
   * PR CHECK (runs when editing sets)
   */
  function checkPR(exerciseId: string, set: any) {
    const def = getExercise(exerciseId);
    if (!def) return;

    if (def.measurement === "time") {
      if (set.duration > 0) {
        savePR(exerciseId, "time", set.duration, workout.id);
      }
    } else {
      if (set.weight > 0) {
        savePR(exerciseId, "weight", set.weight, workout.id);
      }
      if (set.reps > 0) {
        savePR(exerciseId, "reps", set.reps, workout.id);
      }
    }
  }

  function patchSet(
    ei: number,
    si: number,
    p: Partial<{ weight: number; reps: number; duration: number; completed: boolean }>
  ) {
    setDraft((d) => {
      if (!d) return d;

      const updated = {
        ...d,
        exercises: d.exercises.map((e, i) =>
          i !== ei
            ? e
            : {
                ...e,
                sets: e.sets.map((s, j) => (j !== si ? s : { ...s, ...p })),
              }
        ),
      };

      const set = updated.exercises[ei].sets[si];

      // Run PR check on edit
      checkPR(updated.exercises[ei].exerciseId, set);

      return updated;
    });
  }

  function addSet(ei: number) {
    setDraft((d) =>
      d
        ? {
            ...d,
            exercises: d.exercises.map((e, i) =>
              i !== ei
                ? e
                : {
                    ...e,
                    sets: [
                      ...e.sets,
                      {
                        weight: e.sets.at(-1)?.weight ?? 0,
                        reps: e.sets.at(-1)?.reps ?? 0,
                        duration: e.sets.at(-1)?.duration ?? 0,
                        completed: true,
                      },
                    ],
                  }
            ),
          }
        : d
    );
  }

  function removeSet(ei: number, si: number) {
    setDraft((d) =>
      d
        ? {
            ...d,
            exercises: d.exercises.map((e, i) =>
              i !== ei ? e : { ...e, sets: e.sets.filter((_, j) => j !== si) }
            ),
          }
        : d
    );
  }

  function removeExercise(ei: number) {
    setDraft((d) =>
      d
        ? { ...d, exercises: d.exercises.filter((_, i) => i !== ei) }
        : d
    );
  }

  function addExercise(id: string) {
    setDraft((d) =>
      d
        ? {
            ...d,
            exercises: [
              ...d.exercises,
              {
                exerciseId: id,
                sets: [
                  {
                    weight: 0,
                    reps: 0,
                    duration: 0,
                    completed: true,
                  },
                ],
              } as WorkoutExerciseLog,
            ],
          }
        : d
    );
    setPicking(false);
  }

  return (
    <div className="flex flex-col gap-4 px-4 pt-4 pb-8">
      {/* HEADER */}
      <header className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-2">
        <button onClick={() => navigate({ to: "/profile" })}>
          <ArrowLeft className="h-5 w-5" />
        </button>

        {editing ? (
          <input
            value={draft?.name ?? ""}
            onChange={(e) =>
              setDraft((d) => (d ? { ...d, name: e.target.value } : d))
            }
            className="rounded bg-card px-2 py-1 font-semibold"
          />
        ) : (
          <h1 className="truncate font-bold">{view.name}</h1>
        )}

        {editing ? (
          <button onClick={save}>
            <Save className="h-4 w-4" />
          </button>
        ) : (
          <button onClick={startEdit}>
            <Pencil className="h-4 w-4" />
          </button>
        )}
      </header>

      {/* STATS */}
      <section className="grid grid-cols-3 gap-2 bg-card p-3 rounded-xl text-center">
        <div>
          <p className="text-xs text-muted-foreground">Duration</p>
          <p className="font-bold">{fmt(view.durationSec)}</p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">Sets</p>
          <p className="font-bold">{totalSets}</p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">Volume</p>
          <p className="font-bold">{Math.round(totalVolume)} kg</p>
        </div>
      </section>

      {/* EXERCISES */}
      {view.exercises.map((ex, ei) => {
        const def = getExercise(ex.exerciseId);

        return (
          <div key={ei} className="rounded-xl bg-card p-4">
            <div className="flex justify-between">
              <div>
                <p className="font-semibold">{def?.name}</p>
                <p className="text-xs text-muted-foreground">
                  {def?.muscle}
                </p>
              </div>

              {editing && (
                <button onClick={() => removeExercise(ei)}>
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>

            {/* SETS */}
            <div className="mt-2 space-y-2">
              {ex.sets.map((s, si) => (
                <div key={si} className="flex gap-2 items-center">
                  {editing ? (
                    <>
                      <input
                        value={s.weight || 0}
                        onChange={(e) =>
                          patchSet(ei, si, {
                            weight: Number(e.target.value),
                          })
                        }
                        className="w-16 bg-secondary rounded px-2"
                      />

                      <input
                        value={s.reps || 0}
                        onChange={(e) =>
                          patchSet(ei, si, {
                            reps: Number(e.target.value),
                          })
                        }
                        className="w-16 bg-secondary rounded px-2"
                      />

                      <input
                        value={s.duration || 0}
                        onChange={(e) =>
                          patchSet(ei, si, {
                            duration: Number(e.target.value),
                          })
                        }
                        className="w-16 bg-secondary rounded px-2"
                      />

                      <button onClick={() => removeSet(ei, si)}>
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </>
                  ) : (
                    <>
                      <span className="text-sm">
                        {s.weight}kg · {s.reps} reps · {s.duration || 0}s
                      </span>

                      {s.completed && (
                        <Check className="h-4 w-4 text-primary" />
                      )}
                    </>
                  )}
                </div>
              ))}
            </div>

            {editing && (
              <button
                onClick={() => addSet(ei)}
                className="mt-2 text-sm text-muted-foreground"
              >
                + Add set
              </button>
            )}
          </div>
        );
      })}

      {/* ACTIONS */}
      {editing ? (
        <>
          <Button onClick={() => setPicking(true)}>Add exercise</Button>
          <Button variant="ghost" onClick={() => setEditing(false)}>
            Cancel
          </Button>
        </>
      ) : (
        <Button variant="ghost" onClick={remove} className="text-red-500">
          Delete workout
        </Button>
      )}

      {picking && (
        <ExercisePicker onClose={() => setPicking(false)} onPick={addExercise} />
      )}
    </div>
  );
}

function fmt(sec: number) {
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  if (h > 0) return `${h}:${m}:${s}`;
  return `${m}:${s}`;
}
