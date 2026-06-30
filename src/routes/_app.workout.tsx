import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useLiveQuery } from "dexie-react-hooks";
import { useEffect, useMemo, useState } from "react";
import { z } from "zod";
import {
  getDb,
  type Routine,
  type Workout,
  type WorkoutExerciseLog,
  type WorkoutSet,
  type PRRecord,
} from "@/lib/db";
import { getExercise, isTimeBased } from "@/lib/exercises";
import { ExercisePicker } from "./_app.routines";
import { Check, Plus, Timer, X, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { WorkoutSummary } from "@/components/WorkoutSummary";
import { formatTime } from "@/lib/format";
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

const searchSchema = z.object({
  routineId: z.coerce.number().optional(),
});

export const Route = createFileRoute("/_app/workout")({
  validateSearch: searchSchema,
  component: WorkoutPage,
});

interface ActiveSession {
  routine: Routine | null;
  name: string;
  startedAt: number;
  exercises: Array<{
    exerciseId: string;
    sets: Array<WorkoutSet & { timerStart?: number | null }>;
  }>;
}

function newId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return `s_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

function makeSet(): WorkoutSet & { timerStart: number | null } {
  return { id: newId(), weight: 0, reps: 0, duration: 0, completed: false, timerStart: null };
}

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
  const [summary, setSummary] = useState<Workout | null>(null);
  const summaryPRs = useLiveQuery(async () => {
    if (typeof window === "undefined" || !summary?.id) return [];
    return getDb().prHistory.where("workoutId").equals(summary.id).toArray();
  }, [summary?.id]) as PRRecord[] | undefined;

  const [discardDialogOpen, setDiscardDialogOpen] = useState(false);
  const [saveErrorDialogOpen, setSaveErrorDialogOpen] = useState(false);
  const [pendingFinishExercises, setPendingFinishExercises] = useState<WorkoutExerciseLog[] | null>(null);
  const [cancelPending, setCancelPending] = useState(false);

  useEffect(() => {
    if (active || !routineId || !routines) return;
    const r = routines.find((x) => x.id === routineId);
    if (r) startWorkout(r);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [routineId, routines]);

  function startWorkout(r: Routine | null) {
    setActive({
      routine: r,
      name: r?.name ?? "Quick Workout",
      startedAt: Date.now(),
      exercises:
        r?.exercises.map((e) => ({
          exerciseId: e.exerciseId,
          sets: Array.from({ length: Math.max(1, e.sets) }, () => ({
            ...makeSet(),
            weight: e.targetWeight ?? 0,
            reps: e.targetReps ?? 0,
            duration: e.targetDuration ?? 0,
          })),
        })) ?? [],
    });
  }

  if (summary) {
    return (
      <div className="flex flex-col gap-4 px-4 pt-6 pb-8">
        <h1 className="text-2xl font-bold">Workout Complete 🎉</h1>
        <WorkoutSummary
          name={summary.name}
          durationSec={summary.durationSec}
          exercises={summary.exercises}
          showName
        />

        <div className="flex flex-col gap-2">
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
            What you did
          </h2>
          {summary.exercises.map((ex, ei) => {
            const def = getExercise(ex.exerciseId);
            const timeBased = isTimeBased(def);
            const isCardio = def?.cardio === true;
            const completedSets = ex.sets.filter((s) => s.completed);
            if (completedSets.length === 0) return null;
            return (
              <div key={ei} className="rounded-xl bg-card px-4 py-3">
                <p className="font-semibold text-sm">{def?.name ?? ex.exerciseId}</p>
                <ul className="mt-1 flex flex-col gap-0.5">
                  {completedSets.map((s, si) => {
                    let label: string;
                    if (isCardio) {
                      const km = s.weight ?? 0;
                      const d = s.duration ?? 0;
                      const m = Math.floor(d / 60);
                      const sec = d % 60;
                      label = `Set ${si + 1}: ${km}km · ${m}:${String(sec).padStart(2, "0")}`;
                    } else if (timeBased) {
                      const d = s.duration ?? 0;
                      const m = Math.floor(d / 60);
                      const sec = d % 60;
                      label = m > 0
                        ? `Set ${si + 1}: ${m}:${String(sec).padStart(2, "0")}`
                        : `Set ${si + 1}: ${sec}s`;
                    } else if (def?.equipment === "Bodyweight") {
                      label = `Set ${si + 1}: ${s.reps ?? 0} reps`;
                    } else {
                      label = `Set ${si + 1}: ${s.weight ?? 0}kg × ${s.reps ?? 0}`;
                    }
                    return (
                      <li key={si} className="text-xs text-muted-foreground tabular-nums">
                        {label}
                      </li>
                    );
                  })}
                </ul>
              </div>
            );
          })}
        </div>

        {summaryPRs && summaryPRs.length > 0 && (
          <div className="flex flex-col gap-2">
            <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
              Personal Records 🏆
            </h2>
            <div className="rounded-xl bg-card px-4 py-3 flex flex-col gap-2">
              {summaryPRs.map((pr, i) => {
                const def = getExercise(pr.exerciseId);
                const name = def?.name ?? pr.exerciseId;
                const typeLabel = pr.type === "weight" ? "Weight" : pr.type === "reps" ? "Reps" : "Duration";
                const fmt = (v: number) => pr.type === "time"
                  ? (v >= 60 ? `${Math.floor(v / 60)}:${String(v % 60).padStart(2, "0")}` : `${v}s`)
                  : pr.type === "weight" ? `${v}kg` : `${v}`;
                // previousBest === 0 means first-ever PR (no prior record existed)
                const isFirst = (pr.previousBest ?? 0) === 0;
                return (
                  <div key={i} className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold truncate">{name}</p>
                      <p className="text-xs text-muted-foreground">
                        {typeLabel} •{" "}
                        {isFirst
                          ? <span className="text-primary">First PR ({fmt(pr.value)})</span>
                          : <span>{fmt(pr.previousBest ?? 0)} → <span className="text-primary font-semibold">{fmt(pr.value)}</span></span>
                        }
                      </p>
                    </div>
                    {!isFirst && (
                      <span className="shrink-0 text-xs text-primary font-semibold">
                        +{fmt(pr.delta ?? pr.value)}
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        <Button
          onClick={() => {
            setSummary(null);
            navigate({ to: "/history" });
          }}
        >
          Done
        </Button>
      </div>
    );
  }

  if (!active) {
    return (
      <div className="flex flex-col gap-4 px-4 pt-6">
        <h1 className="text-2xl font-bold">Start Workout</h1>
        <Button onClick={() => startWorkout(null)}>
          <Plus className="mr-2 h-4 w-4" /> Log Freestyle Session
        </Button>

        <div>
          <p className="mb-2 text-sm font-semibold text-muted-foreground">From routine</p>
          {(routines ?? []).length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No routines yet.{" "}
              <Link to="/routines" className="text-primary underline">
                Create one
              </Link>
              .
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
                      {r.exercises.length} exercise{r.exercises.length === 1 ? "" : "s"}
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
            const exercises: WorkoutExerciseLog[] = active.exercises.map((e) => ({
              exerciseId: e.exerciseId,
              sets: e.sets.map(({ timerStart: _t, ...s }) => ({
                weight: Number(s.weight) || 0,
                reps: Number(s.reps) || 0,
                duration: Number(s.duration) || 0,
                completed:
                  s.completed ||
                  (Number(s.weight) || 0) > 0 ||
                  (Number(s.reps) || 0) > 0 ||
                  (Number(s.duration) || 0) > 0,
              })),
            }));

            const hasAnyData = exercises.some((e) => e.sets.some((s) => s.completed));

            if (!hasAnyData) {
              setPendingFinishExercises(exercises);
              setDiscardDialogOpen(true);
              return;
            }

            await doSaveWorkout(exercises, active, setActive, setSummary, setSaveErrorDialogOpen);
            return;
          }

          const hasData = active.exercises.some((e) =>
            e.sets.some(
              (s) =>
                s.completed ||
                (Number(s.weight) || 0) > 0 ||
                (Number(s.reps) || 0) > 0 ||
                (Number(s.duration) || 0) > 0,
            ),
          );
          if (hasData) {
            setCancelPending(true);
            setDiscardDialogOpen(true);
            return;
          }
          setPendingFinishExercises(null);
          setActive(null);
          navigate({ to: "/workout" });
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
                    exercises: [...s.exercises, { exerciseId: id, sets: [makeSet()] }],
                  }
                : s,
            );
            setPicking(false);
          }}
          addedIds={new Set(active.exercises.map((e) => e.exerciseId))}
        />
      )}

      {/* Discard confirmation — empty finish or cancel with data */}
      <AlertDialog
        open={discardDialogOpen}
        onOpenChange={(open) => {
          if (!open) {
            setCancelPending(false);
            setDiscardDialogOpen(false);
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {cancelPending ? "Discard workout?" : "Discard empty workout?"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {cancelPending
                ? "You have unsaved progress. Discard this session without saving?"
                : "No sets were completed. Discard this session without saving?"}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel
              onClick={() => {
                setCancelPending(false);
                setPendingFinishExercises(null);
              }}
            >
              Keep going
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                setDiscardDialogOpen(false);
                setCancelPending(false);
                setPendingFinishExercises(null);
                setActive(null);
                navigate({ to: "/workout" });
              }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Discard
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Save error */}
      <AlertDialog open={saveErrorDialogOpen} onOpenChange={setSaveErrorDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Failed to save workout</AlertDialogTitle>
            <AlertDialogDescription>
              Something went wrong saving your session. Your data is still in memory — try
              finishing again, or check the browser console for details.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogAction onClick={() => setSaveErrorDialogOpen(false)}>
              OK
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

// ── Save helper (extracted so dialogs can call it too) ───────────────────────
async function doSaveWorkout(
  exercises: WorkoutExerciseLog[],
  active: ActiveSession,
  setActive: (v: null) => void,
  setSummary: (w: Workout) => void,
  setSaveErrorDialogOpen: (v: boolean) => void,
) {
  const endedAt = Date.now();
  const workout: Workout = {
    routineId: active.routine?.id,
    name: active.name,
    startedAt: active.startedAt,
    endedAt,
    durationSec: Math.max(1, Math.round((endedAt - active.startedAt) / 1000)),
    exercises,
  };
  try {
    const savedId = await getDb().workouts.add(workout);
    const workoutId = savedId as number;

    // Write PRs now that workoutId is known — same logic as savePR in history edit
    const db = getDb();
    // Track which exercise+type combos have already set a PR this session to avoid duplicates
    const written = new Set<string>();
    for (const ex of exercises) {
      const def = getExercise(ex.exerciseId);
      if (!def) continue;
      const timeBased = isTimeBased(def);
      for (const s of ex.sets) {
        if (!s.completed) continue;
        if (timeBased) {
          const d = s.duration ?? 0;
          const key = `${ex.exerciseId}:time`;
          if (d > 0 && !written.has(key)) {
            const existing = await db.prHistory.where({ exerciseId: ex.exerciseId, type: "time" }).toArray();
            const best = existing.reduce((m, p) => Math.max(m, p.value), 0);
            if (d > best) {
              await db.prHistory.add({ exerciseId: ex.exerciseId, type: "time", value: d, previousBest: best, delta: d - best, workoutId, createdAt: Date.now() });
              written.add(key);
            }
          }
        } else {
          const w = s.weight ?? 0;
          const r = s.reps ?? 0;
          const wKey = `${ex.exerciseId}:weight`;
          if (w > 0 && !written.has(wKey)) {
            const existing = await db.prHistory.where({ exerciseId: ex.exerciseId, type: "weight" }).toArray();
            const best = existing.reduce((m, p) => Math.max(m, p.value), 0);
            if (w > best) {
              await db.prHistory.add({ exerciseId: ex.exerciseId, type: "weight", value: w, previousBest: best, delta: w - best, workoutId, createdAt: Date.now() });
              written.add(wKey);
            }
          }
          const rKey = `${ex.exerciseId}:reps`;
          if (r > 0 && !written.has(rKey)) {
            const existing = await db.prHistory.where({ exerciseId: ex.exerciseId, type: "reps" }).toArray();
            const best = existing.reduce((m, p) => Math.max(m, p.value), 0);
            if (r > best) {
              await db.prHistory.add({ exerciseId: ex.exerciseId, type: "reps", value: r, previousBest: best, delta: r - best, workoutId, createdAt: Date.now() });
              written.add(rKey);
            }
          }
        }
      }
    }

    setActive(null);
    setSummary({ ...workout, id: workoutId });
  } catch (err) {
    console.error("Failed to save workout", err);
    setSaveErrorDialogOpen(true);
  }
}

// ─────────────────────────────────────────────
// LiveSession
// ─────────────────────────────────────────────

interface LiveSessionProps {
  session: ActiveSession;
  setSession: React.Dispatch<React.SetStateAction<ActiveSession | null>>;
  onAddExercise: () => void;
  onFinish: (save: boolean) => void;
}

function LiveSession({ session, setSession, onAddExercise, onFinish }: LiveSessionProps) {
  const [, force] = useState(0);

  useEffect(() => {
    const t = setInterval(() => force((x) => x + 1), 250);
    return () => clearInterval(t);
  }, []);

  const now = Date.now();
  const elapsed = Math.max(0, Math.round((now - session.startedAt) / 1000));

  const allWorkouts = useLiveQuery(
    () =>
      typeof window === "undefined"
        ? Promise.resolve<Workout[]>([])
        : getDb().workouts.orderBy("startedAt").reverse().toArray(),
    [],
  ) as Workout[] | undefined;

  const previousByExercise = useMemo(() => {
    const map = new Map<string, WorkoutSet[]>();
    if (!allWorkouts) return map;
    for (const w of allWorkouts) {
      if (w.startedAt === session.startedAt) continue;
      for (const e of w.exercises) {
        if (map.has(e.exerciseId)) continue;
        const done = e.sets.filter((s) => s.completed);
        if (done.length > 0) map.set(e.exerciseId, done);
      }
    }
    return map;
  }, [allWorkouts, session.startedAt]);

  function formatPrevSet(s: WorkoutSet, timeBased: boolean, isCardio: boolean): string {
    if (isCardio) {
      const km = Number(s.weight) || 0;
      const d = Number(s.duration) || 0;
      const m = Math.floor(d / 60);
      const sec = d % 60;
      return `${km}km · ${m}:${String(sec).padStart(2, "0")}`;
    }
    if (timeBased) {
      const d = Number(s.duration) || 0;
      const m = Math.floor(d / 60);
      const sec = d % 60;
      return m > 0 ? `${m}:${String(sec).padStart(2, "0")}` : `${sec}s`;
    }
    const w = Number(s.weight) || 0;
    const r = Number(s.reps) || 0;
    return `${w}kg × ${r}`;
  }

  // ── Undo state ────────────────────────────────────────────────────────
  const [undo, setUndo] = useState<null | {
    exerciseId: string;
    set: WorkoutSet & { timerStart?: number | null };
    timeoutId: ReturnType<typeof setTimeout>;
  }>(null);
  const [undoTick, setUndoTick] = useState(0);

  useEffect(() => {
    if (!undo) return;
    const t = setInterval(() => setUndoTick((x) => x + 1), 100);
    return () => clearInterval(t);
  }, [undo]);

  const undoSecondsLeft = undo ? Math.max(0, 3 - Math.floor(undoTick / 10)) : 0;

  function undoDelete() {
    if (!undo) return;
    const { exerciseId, set } = undo;
    setSession((s) => {
      if (!s) return s;
      const exIdx = s.exercises.findIndex((e) => e.exerciseId === exerciseId);
      if (exIdx === -1) return s;
      const ex = s.exercises[exIdx];
      if (set.id && ex.sets.some((x) => x.id === set.id)) return s;
      const newExercises = [...s.exercises];
      newExercises[exIdx] = { ...ex, sets: [...ex.sets, set] };
      return { ...s, exercises: newExercises };
    });
    clearTimeout(undo.timeoutId);
    setUndo(null);
  }

  function getLiveDuration(s: WorkoutSet & { timerStart?: number | null }) {
    if (!s.timerStart) return s.duration ?? 0;
    return (s.duration ?? 0) + Math.round((now - s.timerStart) / 1000);
  }

  function updateSet(
    ei: number,
    si: number,
    patch: Partial<WorkoutSet & { timerStart: number | null }>,
  ) {
    setSession((s) => {
      if (!s) return s;
      return {
        ...s,
        exercises: s.exercises.map((e, i) =>
          i !== ei
            ? e
            : { ...e, sets: e.sets.map((set, j) => (j !== si ? set : { ...set, ...patch })) },
        ),
      };
    });
  }

  function toggleTimer(ei: number, si: number) {
    setSession((s) => {
      if (!s) return s;
      const set = s.exercises[ei].sets[si];
      const now = Date.now();
      const patch =
        set.timerStart != null
          ? {
              timerStart: null,
              duration:
                (Number(set.duration) || 0) + Math.round((now - set.timerStart) / 1000),
            }
          : { timerStart: now };
      return {
        ...s,
        exercises: s.exercises.map((e, i) =>
          i !== ei
            ? e
            : { ...e, sets: e.sets.map((x, j) => (j !== si ? x : { ...x, ...patch })) },
        ),
      };
    });
  }

  function addSet(ei: number) {
    setSession((s) =>
      s
        ? {
            ...s,
            exercises: s.exercises.map((e, i) => {
              if (i !== ei) return e;
              const last = e.sets[e.sets.length - 1];
              return {
                ...e,
                sets: [
                  ...e.sets,
                  {
                    ...makeSet(),
                    weight: last?.weight ?? 0,
                    reps: last?.reps ?? 0,
                    duration: last?.duration ?? 0,
                  },
                ],
              };
            }),
          }
        : s,
    );
  }

  function removeSet(ei: number, si: number) {
    setSession((s) => {
      if (!s) return s;
      const setToDelete = s.exercises[ei].sets[si];
      const updated = {
        ...s,
        exercises: s.exercises.map((e, i) =>
          i !== ei ? e : { ...e, sets: e.sets.filter((_, j) => j !== si) },
        ),
      };

      if (undo?.timeoutId) clearTimeout(undo.timeoutId);

      const timeoutId = setTimeout(() => {
        setUndo((current) => {
          if (current?.timeoutId === timeoutId) return null;
          return current;
        });
      }, 3000);

      setUndo({ exerciseId: s.exercises[ei].exerciseId, set: setToDelete, timeoutId });
      setUndoTick(0);

      return updated;
    });
  }

  function removeExercise(ei: number) {
    setSession((s) =>
      s ? { ...s, exercises: s.exercises.filter((_, i) => i !== ei) } : s,
    );
  }

  function markExerciseComplete(ei: number) {
    setSession((s) =>
      s
        ? {
            ...s,
            exercises: s.exercises.map((e, i) =>
              i !== ei ? e : { ...e, sets: e.sets.map((x) => ({ ...x, completed: true })) },
            ),
          }
        : s,
    );
  }

  return (
    <div className="flex flex-col gap-4 px-4 pt-4 pb-8">
      <header className="flex items-center justify-between">
        <input
          value={session.name}
          onChange={(e) => setSession((s) => (s ? { ...s, name: e.target.value } : s))}
          className="min-w-0 flex-1 bg-transparent text-lg font-bold outline-none"
        />

        <div className="ml-2 flex items-center gap-1 text-sm text-muted-foreground">
          <Timer className="h-4 w-4" />
          <span className="tabular-nums">{formatTime(elapsed)}</span>
        </div>
      </header>

      {session.exercises.map((ex, ei) => {
        const def = getExercise(ex.exerciseId);
        const timeBased = isTimeBased(def);
        const isCardio = def?.cardio === true;

        return (
          <div key={ei} className="rounded-xl bg-card p-3">
            <div className="flex items-center justify-between">
              <div className="min-w-0">
                <p className="truncate font-semibold">{def?.name ?? ex.exerciseId}</p>
                <p className="text-xs text-muted-foreground">{def?.muscle}</p>
              </div>
              <button onClick={() => removeExercise(ei)} className="p-1 text-muted-foreground">
                <X className="h-4 w-4" />
              </button>
            </div>

            {(() => {
              const prev = previousByExercise.get(ex.exerciseId);
              if (!prev || prev.length === 0) return null;
              return (
                <div className="mt-2 rounded-md bg-secondary/50 px-2 py-1.5">
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                    Previous Workout
                  </p>
                  <ul className="mt-0.5 text-xs tabular-nums text-foreground/80">
                    {prev.map((s, i) => (
                      <li key={i}>{formatPrevSet(s, timeBased, isCardio)}</li>
                    ))}
                  </ul>
                </div>
              );
            })()}

            {def?.interval && (
              <IntervalTimer
                config={def.interval}
                onComplete={() => markExerciseComplete(ei)}
              />
            )}

            {!def?.interval && (
              <>
                <div className="mt-3 grid grid-cols-[24px_1fr_1fr_auto_auto] items-center gap-2 text-xs text-muted-foreground">
                  <span>{isCardio ? "Set" : "#"}</span>
                  <span>{isCardio ? "Km" : timeBased ? "Sec" : "Kg"}</span>
                  <span>{isCardio ? "Time (mm:ss)" : timeBased ? "Distance/Notes" : "Reps"}</span>
                  <span />
                  <span />
                </div>

                {ex.sets.map((s, si) => (
                  <div
                    key={si}
                    className="mt-2 grid grid-cols-[24px_1fr_1fr_auto_auto] items-center gap-2"
                  >
                    <span className="text-sm font-semibold">{si + 1}</span>

                    {isCardio ? (
                      <>
                        <div className="flex items-center bg-secondary rounded-lg overflow-hidden h-8 border">
                          <button
                            onClick={() => updateSet(ei, si, { weight: Math.max(0, (s.weight ?? 0) - 0.1) })}
                            className="w-7 h-full text-sm"
                          >
                            −
                          </button>
                          <NumField
                            value={s.weight ?? 0}
                            onCommit={(v) => updateSet(ei, si, { weight: v })}
                            decimal
                            placeholder="0"
                          />
                          <button
                            onClick={() => updateSet(ei, si, { weight: (s.weight ?? 0) + 0.1 })}
                            className="w-7 h-full text-sm"
                          >
                            +
                          </button>
                        </div>

                        <div className="flex items-center gap-2">
                          <span className="min-w-[60px] tabular-nums text-sm">
                            {formatTime(getLiveDuration(s))}
                          </span>
                          <button
                            onClick={() => toggleTimer(ei, si)}
                            className="rounded bg-secondary px-2 py-1 text-xs"
                          >
                            {s.timerStart ? "■" : "▶"}
                          </button>
                        </div>
                      </>
                    ) : timeBased ? (
                      <>
                        <div className="flex items-center gap-2">
                          <span className="min-w-[60px] tabular-nums text-sm">
                            {formatTime(getLiveDuration(s))}
                          </span>
                          <button
                            onClick={() => toggleTimer(ei, si)}
                            className="rounded bg-secondary px-2 py-1 text-xs"
                          >
                            {s.timerStart ? "■" : "▶"}
                          </button>
                        </div>

                        <div className="flex items-center bg-secondary rounded-lg overflow-hidden h-8 border">
                          <button
                            onClick={() => updateSet(ei, si, { weight: Math.max(0, (s.weight ?? 0) - 2.5) })}
                            className="w-7 h-full text-sm"
                          >
                            −
                          </button>
                          <NumField
                            value={s.weight ?? 0}
                            onCommit={(v) => updateSet(ei, si, { weight: v })}
                            decimal
                            placeholder="0"
                          />
                          <button
                            onClick={() => updateSet(ei, si, { weight: (s.weight ?? 0) + 2.5 })}
                            className="w-7 h-full text-sm"
                          >
                            +
                          </button>
                        </div>
                      </>
                    ) : (
                      <>
                        <div className="flex items-center bg-secondary rounded-lg overflow-hidden h-8 border">
                          <button
                            onClick={() => updateSet(ei, si, { weight: Math.max(0, (s.weight ?? 0) - 2.5) })}
                            className="w-7 h-full text-sm"
                          >
                            −
                          </button>
                          <NumField
                            value={s.weight ?? 0}
                            onCommit={(v) => updateSet(ei, si, { weight: v })}
                            decimal
                            placeholder="0"
                          />
                          <button
                            onClick={() => updateSet(ei, si, { weight: (s.weight ?? 0) + 2.5 })}
                            className="w-7 h-full text-sm"
                          >
                            +
                          </button>
                        </div>
                        <div className="flex items-center bg-secondary rounded-lg overflow-hidden h-8 border">
                          <button
                            onClick={() => updateSet(ei, si, { reps: Math.max(0, (s.reps ?? 0) - 1) })}
                            className="w-7 h-full text-sm"
                          >
                            −
                          </button>
                          <NumField
                            value={s.reps ?? 0}
                            onCommit={(v) => updateSet(ei, si, { reps: v })}
                            placeholder="0"
                          />
                          <button
                            onClick={() => updateSet(ei, si, { reps: (s.reps ?? 0) + 1 })}
                            className="w-7 h-full text-sm"
                          >
                            +
                          </button>
                        </div>
                      </>
                    )}

                    <button
                      onClick={() => updateSet(ei, si, { completed: !s.completed })}
                      className={`flex h-7 w-7 items-center justify-center rounded ${
                        s.completed
                          ? "bg-primary text-primary-foreground"
                          : "bg-secondary text-muted-foreground"
                      }`}
                    >
                      <Check className="h-4 w-4" />
                    </button>

                    <button onClick={() => removeSet(ei, si)} className="text-muted-foreground">
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                ))}

                <button
                  onClick={() => addSet(ei)}
                  className="mt-3 w-full rounded-lg bg-secondary py-2 text-sm font-medium"
                >
                  + Add set
                </button>
              </>
            )}
          </div>
        );
      })}

      <Button variant="outline" onClick={onAddExercise}>
        <Plus className="mr-2 h-4 w-4" /> Add exercise
      </Button>

      <div className="grid grid-cols-2 gap-2">
        <Button variant="ghost" onClick={() => onFinish(false)} className="text-destructive">
          Cancel
        </Button>
        <Button onClick={() => onFinish(true)}>Finish</Button>
      </div>

      {undo && (
        <div className="fixed bottom-4 left-4 right-4 z-[9999] mx-auto flex max-w-md items-center justify-between rounded-lg bg-black px-4 py-3 text-white shadow-lg pointer-events-auto">
          <span className="text-sm">
            Set deleted{" "}
            <span className="ml-2 text-xs text-white/70">{undoSecondsLeft}s</span>
          </span>
          <button
            onClick={undoDelete}
            className="rounded bg-white px-3 py-1 text-sm font-medium text-black"
          >
            Undo
          </button>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────
// NumField
// ─────────────────────────────────────────────

function NumField({
  value,
  onCommit,
  decimal,
  placeholder,
}: {
  value: number;
  onCommit: (v: number) => void;
  decimal?: boolean;
  placeholder?: string;
}) {
  const [str, setStr] = useState<string>(String(value ?? 0));

  useEffect(() => {
    setStr(String(value ?? 0));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  const re = decimal ? /^\d*\.?\d*$/ : /^\d*$/;

  return (
    <input
      type="text"
      inputMode={decimal ? "decimal" : "numeric"}
      value={str}
      placeholder={placeholder}
      onChange={(e) => {
        const v = e.target.value;
        if (!re.test(v)) return;
        setStr(v);
        const n = decimal ? parseFloat(v) : parseInt(v, 10);
        if (Number.isFinite(n)) onCommit(n);
      }}
      onBlur={() => {
        if (str === "" || str === ".") {
          setStr("0");
          onCommit(0);
        }
      }}
      className="w-full rounded bg-secondary px-2 py-1 text-sm outline-none"
    />
  );
}

// ─────────────────────────────────────────────
// IntervalTimer
// ─────────────────────────────────────────────

function IntervalTimer({
  config,
  onComplete,
}: {
  config: { rounds: number; workSeconds: number; restSeconds: number };
  onComplete: () => void;
}) {
  const [round, setRound] = useState(1);
  const [phase, setPhase] = useState<"work" | "rest">("work");
  const [remaining, setRemaining] = useState(config.workSeconds);
  const [running, setRunning] = useState(false);
  const [started, setStarted] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (!running || done) return;
    const t = setInterval(() => setRemaining((r) => r - 1), 1000);
    return () => clearInterval(t);
  }, [running, done]);

  useEffect(() => {
    if (done || remaining > 0 || !started) return;
    if (phase === "work") {
      setPhase("rest");
      setRemaining(config.restSeconds);
    } else {
      if (round >= config.rounds) {
        setDone(true);
        setRunning(false);
        onComplete();
      } else {
        setRound((n) => n + 1);
        setPhase("work");
        setRemaining(config.workSeconds);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [remaining]);

  function reset() {
    setRound(1);
    setPhase("work");
    setRemaining(config.workSeconds);
    setRunning(false);
    setStarted(false);
    setDone(false);
  }

  function fmtInterval(s: number) {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${m}:${String(sec).padStart(2, "0")}`;
  }

  const mm = Math.floor(Math.max(0, remaining) / 60);
  const ss = Math.max(0, remaining) % 60;

  return (
    <div className="mt-3 space-y-2">
      <div className="rounded-md bg-secondary/50 px-3 py-2 text-xs">
        <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
          Interval
        </p>
        <div className="mt-1 flex gap-4 tabular-nums">
          <span>
            Rounds: <b>{config.rounds}</b>
          </span>
          <span>
            Work: <b>{fmtInterval(config.workSeconds)}</b>
          </span>
          <span>
            Rest: <b>{fmtInterval(config.restSeconds)}</b>
          </span>
        </div>
      </div>

      <div
        className={`rounded-md px-3 py-2 ${
          done
            ? "bg-primary/10"
            : !started
              ? "bg-secondary"
              : phase === "work"
                ? "bg-red-500/15"
                : "bg-blue-500/15"
        }`}
      >
        <div className="flex items-center justify-between">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
              Interval Timer
            </p>
            <p className="text-sm font-semibold">
              {done ? "Complete" : !started ? "Ready" : phase === "work" ? "WORK" : "REST"} ·
              Round {round}/{config.rounds}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span className="tabular-nums text-2xl font-bold">
              {mm}:{String(ss).padStart(2, "0")}
            </span>
            {!done ? (
              <button
                onClick={() => {
                  setStarted(true);
                  setRunning((r) => !r);
                }}
                className="rounded bg-secondary px-2 py-1 text-xs"
              >
                {running ? "Pause" : started ? "Resume" : "Start"}
              </button>
            ) : null}
            <button onClick={reset} className="rounded bg-secondary px-2 py-1 text-xs">
              Reset
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
