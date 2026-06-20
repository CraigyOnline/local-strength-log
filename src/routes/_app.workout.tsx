import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useLiveQuery } from "dexie-react-hooks";
import { useEffect, useState } from "react";
import { z } from "zod";
import { getDb, type Routine, type Workout, type WorkoutExerciseLog, type WorkoutSet } from "@/lib/db";
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

  // Auto-start from ?routineId=...
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
          sets: Array.from({ length: Math.max(1, e.sets) }, () => makeSet()),
        })) ?? [],
    });
  }

  if (!active) {
    return (
      <div className="flex flex-col gap-4 px-4 pt-6">
        <h1 className="text-2xl font-bold">Start Workout</h1>
        <Button onClick={() => startWorkout(null)}>
          <Plus className="mr-2 h-4 w-4" /> Empty Workout
        </Button>

        <div>
          <p className="mb-2 text-sm font-semibold text-muted-foreground">From routine</p>
          {(routines ?? []).length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No routines yet. <Link to="/routines" className="text-primary underline">Create one</Link>.
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
            // Auto-complete any set with data so user input isn't lost
            const exercises: WorkoutExerciseLog[] = active.exercises.map((e) => ({
              exerciseId: e.exerciseId,
              sets: e.sets
                .map(({ timerStart: _t, ...s }) => ({
                  weight: Number(s.weight) || 0,
                  reps: Number(s.reps) || 0,
                  duration: Number(s.duration) || 0,
                  completed:
                    s.completed || (Number(s.weight) || 0) > 0 || (Number(s.reps) || 0) > 0 || (Number(s.duration) || 0) > 0,
                })),
            }));

            const hasAnyData = exercises.some((e) => e.sets.some((s) => s.completed));

            if (!hasAnyData) {
              const ok = confirm("This workout is empty — discard it?");
              if (!ok) return;
            } else {
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
                await getDb().workouts.add(workout);
              } catch (err) {
                console.error("Failed to save workout", err);
                alert("Failed to save workout. See console.");
                return;
              }
            }
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
                    exercises: [...s.exercises, { exerciseId: id, sets: [makeSet()] }],
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

interface LiveSessionProps {
  session: ActiveSession;
  setSession: React.Dispatch<React.SetStateAction<ActiveSession | null>>;
  onAddExercise: () => void;
  onFinish: (save: boolean) => void;
}

function LiveSession({ session, setSession, onAddExercise, onFinish }: LiveSessionProps) {
  const [, force] = useState(0);

  // 🔁 global rerender loop (drives live timers + undo countdown)
  useEffect(() => {
    const t = setInterval(() => force((x) => x + 1), 250);
    return () => clearInterval(t);
  }, []);

  const now = Date.now();

  const elapsed = Math.max(0, Math.round((now - session.startedAt) / 1000));

  // =========================
  // 🔥 UNDO STATE
  // =========================
  const [undo, setUndo] = useState<null | {
    ei: number;
    si: number;
    set: WorkoutSet & { timerStart?: number | null };
    timeoutId: ReturnType<typeof setTimeout>;
  }>(null);

  const [undoTick, setUndoTick] = useState(0);

  useEffect(() => {
    if (!undo) return;

    const t = setInterval(() => {
      setUndoTick((x) => x + 1);
    }, 100);

    return () => clearInterval(t);
  }, [undo]);

  const undoSecondsLeft = undo
    ? Math.max(0, 3 - Math.floor(undoTick / 10))
    : 0;

  function undoDelete() {
    if (!undo) return;

    setSession((s) => {
      if (!s) return s;

      const newExercises = [...s.exercises];

      const ex = newExercises[undo.ei];
      if (!ex) return s;

      const newSets = [...ex.sets];
      newSets.splice(undo.si, 0, undo.set);

      newExercises[undo.ei] = {
        ...ex,
        sets: newSets,
      };

      return {
        ...s,
        exercises: newExercises,
      };
    });

    clearTimeout(undo.timeoutId);
    setUndo(null);
  }

  function getLiveDuration(s: WorkoutSet & { timerStart?: number | null }) {
    if (!s.timerStart) return s.duration ?? 0;
    return (s.duration ?? 0) + Math.round((now - s.timerStart) / 1000);
  }

  function formatTime(sec: number) {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m}:${String(s).padStart(2, "0")}`;
  }

  function updateSet(
    ei: number,
    si: number,
    patch: Partial<WorkoutSet & { timerStart: number | null }>
  ) {
    setSession((s) => {
      if (!s) return s;

      return {
        ...s,
        exercises: s.exercises.map((e, i) =>
          i !== ei
            ? e
            : {
                ...e,
                sets: e.sets.map((set, j) =>
                  j !== si ? set : { ...set, ...patch }
                ),
              }
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
                (Number(set.duration) || 0) +
                Math.round((now - set.timerStart) / 1000),
            }
          : { timerStart: now };

      return {
        ...s,
        exercises: s.exercises.map((e, i) =>
          i !== ei
            ? e
            : {
                ...e,
                sets: e.sets.map((x, j) =>
                  j !== si ? x : { ...x, ...patch }
                ),
              }
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
        : s
    );
  }

function removeSet(ei: number, si: number) {
  setSession((s) => {
    if (!s) return s;

    const setToDelete = s.exercises[ei].sets[si];

    const updated = {
      ...s,
      exercises: s.exercises.map((e, i) =>
        i !== ei
          ? e
          : {
              ...e,
              sets: e.sets.filter((_, j) => j !== si),
            },
      ),
    };

    // ✅ IMPORTANT: clear ANY existing undo timer before creating a new one
    if (undo?.timeoutId) {
      clearTimeout(undo.timeoutId);
    }

    const timeoutId = setTimeout(() => {
      setUndo((current) => {
        // only clear if this is still the active undo
        if (current?.timeoutId === timeoutId) {
          return null;
        }
        return current;
      });
    }, 3000);

    setUndo({
      ei,
      si,
      set: setToDelete,
      timeoutId,
    });

    setUndoTick(0);

    return updated;
  });
}

  function removeExercise(ei: number) {
    setSession((s) =>
      s ? { ...s, exercises: s.exercises.filter((_, i) => i !== ei) } : s
    );
  }

  return (
    <div className="flex flex-col gap-4 px-4 pt-4 pb-8">
      <header className="flex items-center justify-between">
        <input
          value={session.name}
          onChange={(e) =>
            setSession((s) => (s ? { ...s, name: e.target.value } : s))
          }
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

        return (
          <div key={ei} className="rounded-xl bg-card p-3">
            <div className="flex items-center justify-between">
              <div className="min-w-0">
                <p className="truncate font-semibold">
                  {def?.name ?? ex.exerciseId}
                </p>
                <p className="text-xs text-muted-foreground">
                  {def?.muscle}
                </p>
              </div>

              <button
                onClick={() => removeExercise(ei)}
                className="p-1 text-muted-foreground"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="mt-3 grid grid-cols-[24px_1fr_1fr_auto_auto] items-center gap-2 text-xs text-muted-foreground">
              <span>#</span>
              <span>{timeBased ? "Sec" : "Kg"}</span>
              <span>{timeBased ? "Distance/Notes" : "Reps"}</span>
              <span />
              <span />
            </div>

            {ex.sets.map((s, si) => (
              <div
                key={si}
                className="mt-2 grid grid-cols-[24px_1fr_1fr_auto_auto] items-center gap-2"
              >
                <span className="text-sm font-semibold">{si + 1}</span>

                {timeBased ? (
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

                    <NumField
                      value={s.weight ?? 0}
                      onCommit={(v) => updateSet(ei, si, { weight: v })}
                      decimal
                      placeholder="0"
                    />
                  </>
                ) : (
                  <>
                    <NumField
                      value={s.weight ?? 0}
                      onCommit={(v) => updateSet(ei, si, { weight: v })}
                      decimal
                      placeholder="0"
                    />

                    <NumField
                      value={s.reps ?? 0}
                      onCommit={(v) => updateSet(ei, si, { reps: v })}
                      placeholder="0"
                    />
                  </>
                )}

                <button
                  onClick={() =>
                    updateSet(ei, si, { completed: !s.completed })
                  }
                  className={`flex h-7 w-7 items-center justify-center rounded ${
                    s.completed
                      ? "bg-primary text-primary-foreground"
                      : "bg-secondary text-muted-foreground"
                  }`}
                >
                  <Check className="h-4 w-4" />
                </button>

                <button
                  onClick={() => removeSet(ei, si)}
                  className="text-muted-foreground"
                >
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
            <span className="ml-2 text-xs text-white/70">
              {undoSecondsLeft}s
            </span>
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
