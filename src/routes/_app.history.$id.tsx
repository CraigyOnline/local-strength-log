import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { ArrowLeft, Check, Trash2, X, Pencil, Save } from "lucide-react";
import { getDb, type Workout, type WorkoutExerciseLog, type PRRecord } from "@/lib/db";
import { getExercise, isTimeBased } from "@/lib/exercises";
import { ExercisePicker } from "./_app.routines";
import { Button } from "@/components/ui/button";
import { WorkoutSummary } from "@/components/WorkoutSummary";
import { formatDuration } from "@/lib/format";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

export const Route = createFileRoute("/_app/history/$id")({
  component: HistoryDetailPage,
});

type PRType = "weight" | "reps" | "time";

async function savePR(exerciseId: string, type: PRType, value: number, workoutId?: number) {
  const db = getDb();
  const existing = await db.prHistory.where({ exerciseId, type }).toArray();
  const previousBest = existing.reduce((m, p) => Math.max(m, p.value), 0);
  if (value > previousBest) {
    await db.prHistory.add({
      exerciseId,
      type,
      value,
      previousBest,
      delta: value - previousBest,
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

  const workoutPRs = useLiveQuery(async () => {
    if (typeof window === "undefined" || !workout?.id) return [];
    return getDb().prHistory.where("workoutId").equals(workout.id).toArray();
  }, [workout?.id]) as PRRecord[] | undefined;

  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<Workout | null>(null);
  const [picking, setPicking] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);

  // ── Undo state ───────────────────────────────────────────────────────
  const [undo, setUndo] = useState<null | {
    exerciseId: string;
    set: WorkoutExerciseLog["sets"][0];
    timeoutId: ReturnType<typeof setTimeout>;
    startTime: number;
  }>(null);
  const [timeLeft, setTimeLeft] = useState(3);

  useEffect(() => {
    if (!undo) return;
    const t = setInterval(() => {
      const elapsed = (Date.now() - undo.startTime) / 1000;
      setTimeLeft(Math.max(0, 3 - Math.floor(elapsed)));
    }, 100);
    return () => clearInterval(t);
  }, [undo]);

  function newSetId(): string {
    if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
    return `s_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
  }

  useEffect(() => {
    const n = Number(id);
    if (!Number.isFinite(n)) {
      setWorkout(null);
      return;
    }
    getDb()
      .workouts.get(n)
      .then((w) => setWorkout(w ?? null));
  }, [id]);

  if (workout === undefined)
    return <div className="px-4 pt-8 text-sm text-muted-foreground">Loading…</div>;
  if (workout === null)
    return (
      <div className="flex flex-col gap-4 px-4 pt-6">
        <p className="text-sm text-muted-foreground">Workout not found.</p>
        <Link to="/history" className="text-sm text-primary underline">
          Back to history
        </Link>
      </div>
    );

  const view = editing && draft ? draft : workout;

  function startEdit() {
    setDraft(JSON.parse(JSON.stringify(workout)));
    setEditing(true);
  }

  // PRs are written only here, on explicit save — not on every keystroke
  async function save() {
    if (!draft?.id) return;
    await getDb().workouts.update(draft.id, {
      name: draft.name,
      exercises: draft.exercises,
    });

    const wid = draft.id;
    for (const ex of draft.exercises) {
      const def = getExercise(ex.exerciseId);
      if (!def) continue;
      for (const s of ex.sets) {
        if (!s.completed) continue;
        if (isTimeBased(def)) {
          if ((s.duration ?? 0) > 0) await savePR(ex.exerciseId, "time", s.duration ?? 0, wid);
        } else {
          if ((s.weight ?? 0) > 0) await savePR(ex.exerciseId, "weight", s.weight ?? 0, wid);
          if ((s.reps ?? 0) > 0) await savePR(ex.exerciseId, "reps", s.reps ?? 0, wid);
        }
      }
    }

    setWorkout(draft);
    setEditing(false);
  }

  function undoDeleteSet() {
    if (!undo) return;
    const { exerciseId, set } = undo;
    setDraft((d) => {
      if (!d) return d;
      const exIdx = d.exercises.findIndex((e) => e.exerciseId === exerciseId);
      if (exIdx === -1) return d;
      const ex = d.exercises[exIdx];
      if (set.id && ex.sets.some((x) => x.id === set.id)) return d;
      const newExercises = [...d.exercises];
      newExercises[exIdx] = { ...ex, sets: [...ex.sets, set] };
      return { ...d, exercises: newExercises };
    });
    clearTimeout(undo.timeoutId);
    setUndo(null);
    setTimeLeft(3);
  }

  function removeSet(ei: number, si: number) {
    if (!draft) return;
    const setToDelete = draft.exercises[ei].sets[si];
    if (!setToDelete) return;

    if (undo?.timeoutId) clearTimeout(undo.timeoutId);

    const newExercises = draft.exercises.map((e, i) =>
      i !== ei ? e : { ...e, sets: e.sets.filter((_, j) => j !== si) },
    );
    setDraft({ ...draft, exercises: newExercises });

    const timeoutId = setTimeout(() => {
      setUndo(null);
      setTimeLeft(3);
    }, 3000);
    setUndo({
      exerciseId: draft.exercises[ei].exerciseId,
      set: setToDelete,
      timeoutId,
      startTime: Date.now(),
    });
    setTimeLeft(3);
  }

  function patchSet(
    ei: number,
    si: number,
    p: Partial<{ weight: number; reps: number; duration: number; completed: boolean }>,
  ) {
    if (!draft) return;
    setDraft((d) => {
      if (!d) return d;
      return {
        ...d,
        exercises: d.exercises.map((e, i) =>
          i !== ei
            ? e
            : {
                ...e,
                sets: e.sets.map((s, j) => (j !== si ? s : { ...s, ...p })),
              },
        ),
      };
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
                        id: newSetId(),
                        weight: e.sets.at(-1)?.weight ?? 0,
                        reps: e.sets.at(-1)?.reps ?? 0,
                        duration: e.sets.at(-1)?.duration ?? 0,
                        completed: true,
                      },
                    ],
                  },
            ),
          }
        : d,
    );
  }

  function removeExercise(ei: number) {
    setDraft((d) =>
      d ? { ...d, exercises: d.exercises.filter((_, i) => i !== ei) } : d,
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
                sets: [{ id: newSetId(), weight: 0, reps: 0, duration: 0, completed: true }],
              },
            ],
          }
        : d,
    );
    setPicking(false);
  }

  async function confirmDelete() {
    await getDb().workouts.delete(workout.id!);
    navigate({ to: "/history" });
  }

  return (
    <div className="flex flex-col gap-4 px-4 pt-4 pb-8">
      <header className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-2">
        <button onClick={() => navigate({ to: "/history" })}>
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

      <WorkoutSummary durationSec={view.durationSec} exercises={view.exercises} />

      {workoutPRs && workoutPRs.length > 0 && (
        <div className="rounded-xl bg-card p-4 flex flex-col gap-2">
          <h2 className="text-sm font-semibold">Personal Records 🏆</h2>
          {workoutPRs.map((pr, i) => {
            const def = getExercise(pr.exerciseId);
            const name = def?.name ?? pr.exerciseId;
            const typeLabel = pr.type === "weight" ? "Weight" : pr.type === "reps" ? "Reps" : "Duration";
            const fmt = (v: number) => pr.type === "time"
              ? (v >= 60 ? `${Math.floor(v / 60)}:${String(v % 60).padStart(2, "0")}` : `${v}s`)
              : pr.type === "weight" ? `${v}kg` : `${v}`;
            const isFirst = (pr.previousBest ?? 0) === 0;
            return (
              <div key={i} className="flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate">{name}</p>
                  <p className="text-xs text-muted-foreground">
                    {typeLabel} •{" "}
                    {isFirst
                      ? <span className="text-primary">First PR ({fmt(pr.value)})</span>
                      : <span>{fmt(pr.previousBest ?? 0)} → <span className="text-primary font-semibold">{fmt(pr.value)}</span></span>
                    }
                  </p>
                </div>
                {!isFirst && (
                  <span className="shrink-0 text-xs font-semibold text-primary">
                    +{fmt(pr.delta ?? (pr.value - (pr.previousBest ?? 0)))}
                  </span>
                )}
              </div>
            );
          })}
        </div>
      )}

      {view.exercises.map((ex, ei) => {
        const def = getExercise(ex.exerciseId);
        const timeBased = isTimeBased(def);
        const isBodyweight = def?.equipment === "Bodyweight";
        const isCardio = def?.equipment === "Cardio";
        return (
          <div key={ei} className="rounded-xl bg-card p-4">
            <div className="flex justify-between">
              <div>
                {editing ? (
                  <p className="font-semibold">{def?.name || "Unknown Exercise"}</p>
                ) : (
                  <Link
                    to="/exercise/$id"
                    params={{ id: ex.exerciseId }}
                    className="font-semibold hover:text-primary transition-colors"
                  >
                    {def?.name || "Unknown Exercise"}
                  </Link>
                )}
                <p className="text-xs text-muted-foreground">{def?.muscle}</p>
              </div>
              {editing && (
                <button onClick={() => removeExercise(ei)}>
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>

            <div className="mt-2 space-y-3">
              {ex.sets.map((s, si) => (
                <div
                  key={si}
                  className="flex gap-4 items-center justify-between py-1 text-sm border-b border-muted/10"
                >
                  <div className="flex flex-col gap-2 min-w-0 flex-1">
                    <span className="font-semibold text-xs text-muted-foreground">
                      Set {si + 1}
                    </span>
                    {editing ? (
                      <div className="flex flex-wrap gap-4 items-center">
                        {!isBodyweight && !isCardio && (
                          <div className="flex flex-col gap-1">
                            <span className="text-[10px] uppercase font-bold text-muted-foreground/60">
                              Weight (kg)
                            </span>
                            <div className="flex items-center bg-secondary rounded-lg overflow-hidden h-9 border">
                              <button
                                onClick={() =>
                                  patchSet(ei, si, {
                                    weight: Math.max(0, (s.weight ?? 0) - 2.5),
                                  })
                                }
                                className="w-8 h-full"
                              >
                                −
                              </button>
                              <input
                                className="w-12 bg-transparent text-center"
                                value={s.weight ?? ""}
                                onChange={(e) =>
                                  patchSet(ei, si, {
                                    weight: Number(e.target.value.replace(/[^0-9.]/g, "")),
                                  })
                                }
                              />
                              <button
                                onClick={() =>
                                  patchSet(ei, si, { weight: (s.weight ?? 0) + 2.5 })
                                }
                                className="w-8 h-full"
                              >
                                +
                              </button>
                            </div>
                          </div>
                        )}
                        {isCardio && (
                          <div className="flex flex-col gap-1">
                            <span className="text-[10px] uppercase font-bold text-muted-foreground/60">
                              Km
                            </span>
                            <div className="flex items-center bg-secondary rounded-lg overflow-hidden h-9 border">
                              <button
                                onClick={() =>
                                  patchSet(ei, si, {
                                    weight: Math.max(0, (s.weight ?? 0) - 0.1),
                                  })
                                }
                                className="w-8 h-full"
                              >
                                −
                              </button>
                              <input
                                className="w-12 bg-transparent text-center"
                                value={s.weight ?? ""}
                                onChange={(e) =>
                                  patchSet(ei, si, {
                                    weight: Number(e.target.value.replace(/[^0-9.]/g, "")),
                                  })
                                }
                              />
                              <button
                                onClick={() =>
                                  patchSet(ei, si, { weight: (s.weight ?? 0) + 0.1 })
                                }
                                className="w-8 h-full"
                              >
                                +
                              </button>
                            </div>
                          </div>
                        )}
                        <div className="flex flex-col gap-1">
                          <span className="text-[10px] uppercase font-bold text-muted-foreground/60">
                            {isCardio ? "Time (mm:ss)" : timeBased ? "Duration" : "Reps"}
                          </span>
                          <div className="flex items-center bg-secondary rounded-lg overflow-hidden h-9 border">
                            <button
                              onClick={() =>
                                timeBased
                                  ? patchSet(ei, si, {
                                      duration: Math.max(0, (s.duration ?? 0) - 5),
                                    })
                                  : patchSet(ei, si, {
                                      reps: Math.max(0, (s.reps ?? 0) - 1),
                                    })
                              }
                              className="w-8 h-full"
                            >
                              −
                            </button>
                            <input
                              className="w-12 bg-transparent text-center"
                              value={(timeBased ? s.duration : s.reps) ?? ""}
                              onChange={(e) => {
                                const v = Number(e.target.value.replace(/[^0-9]/g, ""));
                                timeBased
                                  ? patchSet(ei, si, { duration: v })
                                  : patchSet(ei, si, { reps: v });
                              }}
                            />
                            <button
                              onClick={() =>
                                timeBased
                                  ? patchSet(ei, si, { duration: (s.duration ?? 0) + 5 })
                                  : patchSet(ei, si, { reps: (s.reps ?? 0) + 1 })
                              }
                              className="w-8 h-full"
                            >
                              +
                            </button>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-center gap-1.5 font-medium">
                        {isCardio ? (
                          <span>{s.weight ?? 0}km · {formatDuration(s.duration ?? 0)}</span>
                        ) : timeBased ? (
                          <span>{s.duration ?? 0}s</span>
                        ) : (
                          <>
                            {!isBodyweight && <span>{s.weight ?? 0}kg</span>}
                            <span>{s.reps ?? 0} reps</span>
                          </>
                        )}
                      </div>
                    )}
                  </div>
                  <div className="self-end pb-1.5">
                    {editing ? (
                      <button
                        onClick={() => removeSet(ei, si)}
                        className="text-muted-foreground hover:text-red-500"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    ) : (
                      s.completed && <Check className="h-5 w-5 text-primary" />
                    )}
                  </div>
                </div>
              ))}
            </div>
            {editing && (
              <button
                onClick={() => addSet(ei)}
                className="mt-4 w-full py-2 bg-secondary/50 text-xs font-semibold rounded-lg text-primary"
              >
                + Add set
              </button>
            )}
          </div>
        );
      })}

      {editing ? (
        <>
          <Button onClick={() => setPicking(true)}>Add exercise</Button>
          <Button variant="ghost" onClick={() => setEditing(false)}>
            Cancel
          </Button>
        </>
      ) : (
        <Button
          variant="ghost"
          onClick={() => setDeleteDialogOpen(true)}
          className="text-red-500"
        >
          Delete workout
        </Button>
      )}

      {picking && (
        <ExercisePicker
          onClose={() => setPicking(false)}
          onPick={addExercise}
          addedIds={new Set((draft?.exercises ?? []).map((e) => e.exerciseId))}
        />
      )}

      {undo && (
        <div className="fixed bottom-4 left-4 right-4 z-[9999] mx-auto flex max-w-md items-center justify-between rounded-lg bg-black px-4 py-3 text-white shadow-lg pointer-events-auto">
          <span className="text-sm">Set deleted — Undo in {timeLeft}s</span>
          <button
            onClick={undoDeleteSet}
            className="rounded bg-white px-3 py-1 text-sm font-medium text-black"
          >
            Undo
          </button>
        </div>
      )}

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete workout?</AlertDialogTitle>
            <AlertDialogDescription>
              "{workout.name}" will be permanently deleted. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
