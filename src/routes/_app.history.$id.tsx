import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, Check, Plus, Trash2, X, Pencil, Save } from "lucide-react";
import { getDb, type Workout, type WorkoutExerciseLog } from "@/lib/db";
import { getExercise } from "@/lib/exercises";
import { ExercisePicker } from "./_app.routines";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/_app/history/$id")({
  head: () => ({
    meta: [
      { title: "Workout Details · Hevy Clone" },
      { name: "description", content: "Review and edit a past workout." },
    ],
  }),
  component: HistoryDetailPage,
});

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
        <Link to="/profile" className="text-sm text-primary underline">Back to history</Link>
      </div>
    );
  }

  const view = editing && draft ? draft : workout;

  const totalVolume = view.exercises.reduce(
    (a, e) => a + e.sets.filter((s) => s.completed).reduce((x, s) => x + s.weight * s.reps, 0),
    0,
  );
  const totalSets = view.exercises.reduce((a, e) => a + e.sets.filter((s) => s.completed).length, 0);

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

  function patchSet(ei: number, si: number, p: Partial<{ weight: number; reps: number; completed: boolean }>) {
    setDraft((d) =>
      d
        ? {
            ...d,
            exercises: d.exercises.map((e, i) =>
              i !== ei ? e : { ...e, sets: e.sets.map((s, j) => (j !== si ? s : { ...s, ...p })) },
            ),
          }
        : d,
    );
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
                        completed: true,
                      },
                    ],
                  },
            ),
          }
        : d,
    );
  }
  function removeSet(ei: number, si: number) {
    setDraft((d) =>
      d
        ? {
            ...d,
            exercises: d.exercises.map((e, i) =>
              i !== ei ? e : { ...e, sets: e.sets.filter((_, j) => j !== si) },
            ),
          }
        : d,
    );
  }
  function removeExercise(ei: number) {
    setDraft((d) => (d ? { ...d, exercises: d.exercises.filter((_, i) => i !== ei) } : d));
  }
  function addExercise(id: string) {
    setDraft((d) =>
      d
        ? {
            ...d,
            exercises: [
              ...d.exercises,
              { exerciseId: id, sets: [{ weight: 0, reps: 0, completed: true }] } as WorkoutExerciseLog,
            ],
          }
        : d,
    );
    setPicking(false);
  }

  return (
    <div className="flex flex-col gap-4 px-4 pt-4 pb-8">
      <header className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-2">
        <button onClick={() => navigate({ to: "/profile" })} aria-label="Back" className="p-2">
          <ArrowLeft className="h-5 w-5" />
        </button>
        {editing ? (
          <input
            value={draft?.name ?? ""}
            onChange={(e) => setDraft((d) => (d ? { ...d, name: e.target.value } : d))}
            className="min-w-0 rounded-lg bg-card px-3 py-1.5 text-base font-semibold outline-none"
          />
        ) : (
          <h1 className="min-w-0 truncate text-lg font-bold">{view.name}</h1>
        )}
        {editing ? (
          <button
            onClick={save}
            className="flex items-center gap-1 rounded-full px-3 py-1.5 text-sm font-bold"
            style={{ background: "var(--color-primary)", color: "var(--color-primary-foreground)" }}
          >
            <Save className="h-4 w-4" /> Save
          </button>
        ) : (
          <button
            onClick={startEdit}
            className="flex items-center gap-1 rounded-full bg-secondary px-3 py-1.5 text-sm font-semibold"
          >
            <Pencil className="h-4 w-4" /> Edit
          </button>
        )}
      </header>

      <section className="grid grid-cols-3 gap-2 rounded-2xl bg-card p-3 text-center">
        <div className="min-w-0">
          <p className="text-[10px] uppercase text-muted-foreground">Duration</p>
          <p className="truncate font-bold tabular-nums">{fmt(view.durationSec)}</p>
        </div>
        <div className="min-w-0">
          <p className="text-[10px] uppercase text-muted-foreground">Sets</p>
          <p className="truncate font-bold tabular-nums">{totalSets}</p>
        </div>
        <div className="min-w-0">
          <p className="text-[10px] uppercase text-muted-foreground">Volume</p>
          <p className="truncate font-bold tabular-nums">{Math.round(totalVolume)} kg</p>
        </div>
      </section>

      <p className="text-xs text-muted-foreground">
        {new Date(view.startedAt).toLocaleString()}
      </p>

      {view.exercises.map((ex, ei) => {
        const def = getExercise(ex.exerciseId);
        return (
          <div key={ei} className="w-full min-w-0 overflow-hidden rounded-2xl bg-card p-4">
            <div className="mb-3 flex items-center justify-between gap-2">
              <div className="min-w-0">
                <p className="truncate font-semibold text-primary">{def?.name ?? ex.exerciseId}</p>
                <p className="truncate text-xs text-muted-foreground">{def?.muscle}</p>
              </div>
              {editing && (
                <button onClick={() => removeExercise(ei)} className="shrink-0 text-muted-foreground">
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>
            <div className="grid grid-cols-[1.5rem_minmax(0,1fr)_minmax(0,1fr)_1.5rem] gap-2 text-[10px] uppercase tracking-wide text-muted-foreground">
              <span className="text-center">Set</span>
              <span className="text-center">Kg</span>
              <span className="text-center">Reps</span>
              <span></span>
            </div>
            <ul className="mt-2 flex flex-col gap-2">
              {ex.sets.map((s, si) => (
                <li
                  key={si}
                  className="grid grid-cols-[1.5rem_minmax(0,1fr)_minmax(0,1fr)_1.5rem] items-center gap-2 rounded-lg px-1 py-1.5"
                  style={{
                    background: s.completed
                      ? "color-mix(in oklab, var(--color-primary) 14%, transparent)"
                      : undefined,
                  }}
                >
                  <span className="text-center text-sm font-semibold">{si + 1}</span>
                  {editing ? (
                    <>
                      <input
                        type="number"
                        inputMode="decimal"
                        value={s.weight || ""}
                        onChange={(e) => patchSet(ei, si, { weight: parseFloat(e.target.value) || 0 })}
                        placeholder="0"
                        className="w-full min-w-0 rounded-md bg-secondary px-1 py-1.5 text-center font-medium tabular-nums outline-none"
                      />
                      <input
                        type="number"
                        inputMode="numeric"
                        value={s.reps || ""}
                        onChange={(e) => patchSet(ei, si, { reps: parseInt(e.target.value) || 0 })}
                        placeholder="0"
                        className="w-full min-w-0 rounded-md bg-secondary px-1 py-1.5 text-center font-medium tabular-nums outline-none"
                      />
                      <button
                        onClick={() => removeSet(ei, si)}
                        className="flex h-7 w-7 items-center justify-center justify-self-end rounded-md bg-secondary text-muted-foreground"
                        aria-label="Remove set"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </>
                  ) : (
                    <>
                      <span className="text-center font-medium tabular-nums">{s.weight || "—"}</span>
                      <span className="text-center font-medium tabular-nums">{s.reps || "—"}</span>
                      {s.completed ? (
                        <Check className="h-4 w-4 justify-self-end text-primary" strokeWidth={3} />
                      ) : (
                        <span></span>
                      )}
                    </>
                  )}
                </li>
              ))}
            </ul>
            {editing && (
              <button
                onClick={() => addSet(ei)}
                className="mt-3 w-full rounded-lg bg-secondary py-2 text-sm font-medium text-muted-foreground hover:text-foreground"
              >
                + Add set
              </button>
            )}
          </div>
        );
      })}

      {editing && (
        <>
          <Button variant="outline" className="w-full" onClick={() => setPicking(true)}>
            <Plus className="mr-2 h-4 w-4" /> Add exercise
          </Button>
          <Button
            variant="ghost"
            className="w-full text-destructive hover:text-destructive"
            onClick={() => {
              setDraft(null);
              setEditing(false);
            }}
          >
            Cancel
          </Button>
        </>
      )}
      {!editing && (
        <Button variant="ghost" className="w-full text-destructive hover:text-destructive" onClick={remove}>
          <Trash2 className="mr-2 h-4 w-4" /> Delete workout
        </Button>
      )}

      {picking && <ExercisePicker onClose={() => setPicking(false)} onPick={addExercise} />}
    </div>
  );
}

function fmt(sec: number) {
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  const mm = String(m).padStart(2, "0");
  const ss = String(s).padStart(2, "0");
  if (h > 0) return `${h}:${mm}:${ss}`;
  return `${mm}:${ss}`;
}
