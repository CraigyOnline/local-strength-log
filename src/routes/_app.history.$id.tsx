import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { ArrowLeft, Check, Trash2, X, Pencil, Save } from "lucide-react";
import { getDb, type Workout, type WorkoutExerciseLog } from "@/lib/db";
import { getExercise, isTimeBased } from "@/lib/exercises";
import { ExercisePicker } from "@/components/ExercisePicker";
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

// Fix #4: save PR only on explicit blur/commit, not on every keystroke.
// Call this when the user finishes editing a field (onBlur / stepper tap).
async function savePR(exerciseId: string, type: PRType, value: number, workoutId?: number) {
  if (!value || value <= 0) return;
  const db = getDb();
  const existing = await db.prHistory.where({ exerciseId, type }).toArray();
  const best = existing.reduce((m, p) => Math.max(m, p.value), 0);
  if (value > best) {
    await db.prHistory.add({ exerciseId, type, value, workoutId, createdAt: Date.now() });
  }
}

function HistoryDetailPage() {
  const { id } = Route.useParams();
  const navigate = useNavigate();

  const [workout, setWorkout] = useState<Workout | null | undefined>(undefined);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<Workout | null>(null);
  const [picking, setPicking] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);

  // ── Undo state (using Date.now() math, matching the corrected workout route) ──
  const [undo, setUndo] = useState<null | {
    exerciseId: string;
    set: WorkoutExerciseLog["sets"][0];
    timeoutId: ReturnType<typeof setTimeout>;
    startTime: number;
  }>(null);
  const [undoSecondsLeft, setUndoSecondsLeft] = useState(3);

  useEffect(() => {
    if (!undo) return;
    const t = setInterval(() => {
      const elapsed = (Date.now() - undo.startTime) / 1000;
      setUndoSecondsLeft(Math.max(0, 3 - Math.floor(elapsed)));
    }, 200);
    return () => clearInterval(t);
  }, [undo]);

  function newSetId(): string {
    if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
    return `s_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
  }

  useEffect(() => {
    const n = Number(id);
    if (!Number.isFinite(n)) { setWorkout(null); return; }
    getDb()
      .workouts.get(n)
      .then((w) => setWorkout(w ?? null));
  }, [id]);

  if (workout === undefined)
    return (
      <div className="flex flex-col gap-3 px-4 pt-8">
        <div className="h-8 w-48 animate-pulse rounded bg-card" />
        <div className="h-32 w-full animate-pulse rounded-xl bg-card" />
        <div className="h-48 w-full animate-pulse rounded-xl bg-card" />
      </div>
    );

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
    // Fix #19: use structuredClone instead of JSON.parse(JSON.stringify(...))
    setDraft(structuredClone(workout));
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
      setUndoSecondsLeft(3);
    }, 3000);

    setUndo({
      exerciseId: draft.exercises[ei].exerciseId,
      set: setToDelete,
      timeoutId,
      startTime: Date.now(),
    });
    setUndoSecondsLeft(3);
  }

  // Fix #4: PR check only called from onBlur/stepper handlers, not on every patch
  function checkAndSavePR(
    exerciseId: string,
    set: { weight?: number; reps?: number; duration?: number },
  ) {
    const def = getExercise(exerciseId);
    if (!def) return;
    const wid = workout?.id;
    if (isTimeBased(def)) {
      if ((set.duration ?? 0) > 0) savePR(exerciseId, "time", set.duration ?? 0, wid);
    } else {
      if ((set.weight ?? 0) > 0) savePR(exerciseId, "weight", set.weight ?? 0, wid);
      if ((set.reps ?? 0) > 0) savePR(exerciseId, "reps", set.reps ?? 0, wid);
    }
  }

  function patchSet(
    ei: number,
    si: number,
    p: Partial<{ weight: number; reps: number; duration: number; completed: boolean }>,
    commitPR = false,
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
              },
        ),
      };
      // Only check PR when explicitly committing (blur / stepper), not every keystroke (#4)
      if (commitPR) {
        checkAndSavePR(updated.exercises[ei].exerciseId, updated.exercises[ei].sets[si]);
      }
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
      <header className="grid grid-cols-[44px_minmax(0,1fr)_44px] items-center gap-2">
        <button
          onClick={() => navigate({ to: "/history" })}
          className="flex h-11 w-11 items-center justify-center"
        >
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
          <button onClick={save} className="flex h-11 w-11 items-center justify-center">
            <Save className="h-4 w-4" />
          </button>
        ) : (
          <button onClick={startEdit} className="flex h-11 w-11 items-center justify-center">
            <Pencil className="h-4 w-4" />
          </button>
        )}
      </header>

      <WorkoutSummary durationSec={view.durationSec} exercises={view.exercises} />

      {view.exercises.map((ex, ei) => {
        const def = getExercise(ex.exerciseId);
        const timeBased = isTimeBased(def);
        const isBodyweight = def?.equipment === "Bodyweight";
        const isCardio = def?.equipment === "Cardio";

        return (
          <div key={ei} className="rounded-xl bg-card p-4">
            <div className="flex justify-between items-center">
              <div>
                <p className="font-semibold">{def?.name || "Unknown Exercise"}</p>
                <p className="text-xs text-muted-foreground">{def?.muscle}</p>
              </div>
              {editing && (
                <button
                  onClick={() => removeExercise(ei)}
                  className="flex h-11 w-11 items-center justify-center text-muted-foreground"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>

            <div className="mt-2 space-y-3">
              {ex.sets.map((s, si) => (
                <SetRow
                  key={si}
                  index={si}
                  set={s}
                  editing={editing}
                  timeBased={timeBased}
                  isBodyweight={isBodyweight}
                  isCardio={isCardio}
                  onPatch={(p, commitPR) => patchSet(ei, si, p, commitPR)}
                  onRemove={() => removeSet(ei, si)}
                />
              ))}
            </div>

            {editing && (
              <button
                onClick={() => addSet(ei)}
                className="mt-4 w-full py-3 bg-secondary/50 text-xs font-semibold rounded-lg text-primary min-h-[44px]"
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
          <Button variant="ghost" onClick={() => setEditing(false)}>Cancel</Button>
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
        <ExercisePicker onClose={() => setPicking(false)} onPick={addExercise} />
      )}

      {/* Undo toast */}
      {undo && (
        <div className="fixed bottom-4 left-4 right-4 z-[9999] mx-auto flex max-w-md items-center justify-between rounded-lg bg-black px-4 py-3 text-white shadow-lg pointer-events-auto">
          <span className="text-sm">Set deleted — Undo in {undoSecondsLeft}s</span>
          <button
            onClick={undoDeleteSet}
            className="rounded bg-white px-3 py-1 text-sm font-medium text-black min-h-[36px]"
          >
            Undo
          </button>
        </div>
      )}

      {/* Delete workout dialog */}
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

// ─────────────────────────────────────────────
// SetRow — extracted so NumField focus ref is per-input, not shared
// ─────────────────────────────────────────────

function SetRow({
  index,
  set: s,
  editing,
  timeBased,
  isBodyweight,
  isCardio,
  onPatch,
  onRemove,
}: {
  index: number;
  set: WorkoutExerciseLog["sets"][0];
  editing: boolean;
  timeBased: boolean;
  isBodyweight: boolean;
  isCardio: boolean;
  onPatch: (
    p: Partial<{ weight: number; reps: number; duration: number; completed: boolean }>,
    commitPR?: boolean,
  ) => void;
  onRemove: () => void;
}) {
  return (
    <div className="flex gap-4 items-center justify-between py-1 text-sm border-b border-muted/10">
      <div className="flex flex-col gap-2 min-w-0 flex-1">
        <span className="font-semibold text-xs text-muted-foreground">Set {index + 1}</span>

        {editing ? (
          <div className="flex flex-wrap gap-4 items-center">
            {!isBodyweight && !isCardio && (
              <StepperField
                label="Weight (kg)"
                value={s.weight ?? 0}
                step={2.5}
                decimal
                onChange={(v) => onPatch({ weight: v }, false)}
                onCommit={(v) => onPatch({ weight: v }, true)}
              />
            )}
            <StepperField
              label={timeBased ? "Duration" : "Reps"}
              value={timeBased ? (s.duration ?? 0) : (s.reps ?? 0)}
              step={timeBased ? 5 : 1}
              onChange={(v) =>
                timeBased ? onPatch({ duration: v }, false) : onPatch({ reps: v }, false)
              }
              onCommit={(v) =>
                timeBased ? onPatch({ duration: v }, true) : onPatch({ reps: v }, true)
              }
            />
          </div>
        ) : (
          <div className="flex items-center gap-1.5 font-medium">
            {isCardio ? (
              <span>{formatDuration(s.duration ?? 0)}</span>
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
            onClick={onRemove}
            className="flex h-11 w-11 items-center justify-center text-muted-foreground"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        ) : (
          s.completed && <Check className="h-5 w-5 text-primary" />
        )}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// StepperField — inline number input with +/− buttons
// PR committed only on blur or stepper tap, not keystrokes (#4)
// ─────────────────────────────────────────────

function StepperField({
  label,
  value,
  step,
  decimal,
  onChange,
  onCommit,
}: {
  label: string;
  value: number;
  step: number;
  decimal?: boolean;
  onChange: (v: number) => void;
  onCommit: (v: number) => void;
}) {
  const [str, setStr] = useState(String(value));
  const focusedRef = useRef(false);

  useEffect(() => {
    if (!focusedRef.current) setStr(String(value));
  }, [value]);

  const re = decimal ? /^\d*\.?\d*$/ : /^\d*$/;

  function parse(s: string) {
    return decimal ? parseFloat(s) : parseInt(s, 10);
  }

  return (
    <div className="flex flex-col gap-1">
      <span className="text-[10px] uppercase font-bold text-muted-foreground/60">{label}</span>
      <div className="flex items-center bg-secondary rounded-lg overflow-hidden h-10 border">
        <button
          onPointerDown={(e) => e.preventDefault()} // don't steal focus from input
          onClick={() => {
            const next = Math.max(0, value - step);
            onChange(next);
            onCommit(next);
          }}
          className="w-10 h-full flex items-center justify-center text-lg"
        >
          −
        </button>
        <input
          className="w-14 bg-transparent text-center text-sm"
          value={str}
          onFocus={() => { focusedRef.current = true; }}
          onChange={(e) => {
            const v = e.target.value;
            if (!re.test(v)) return;
            setStr(v);
            const n = parse(v);
            if (Number.isFinite(n)) onChange(n);
          }}
          onBlur={() => {
            focusedRef.current = false;
            const n = parse(str);
            const safe = Number.isFinite(n) ? Math.max(0, n) : 0;
            setStr(String(safe));
            onCommit(safe);
          }}
        />
        <button
          onPointerDown={(e) => e.preventDefault()}
          onClick={() => {
            const next = value + step;
            onChange(next);
            onCommit(next);
          }}
          className="w-10 h-full flex items-center justify-center text-lg"
        >
          +
        </button>
      </div>
    </div>
  );
}
