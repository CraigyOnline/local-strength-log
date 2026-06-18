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
  head: () => ({
    meta: [
      { title: "Workout · Hevy Clone" },
      { name: "description", content: "Track sets, reps and weights in real time." },
    ],
  }),
  component: WorkoutPage,
});

function WorkoutPage() {
  const { routineId } = Route.useSearch();
  const navigate = useNavigate();
  const routines = useLiveQuery(
    () => (typeof window === "undefined" ? [] : getDb().routines.orderBy("createdAt").reverse().toArray()),
    [],
    [],
  );

  const [active, setActive] = useState<{
    routine: Routine | null;
    name: string;
    startedAt: number;
    exercises: WorkoutExerciseLog[];
  } | null>(null);

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
          sets: Array.from({ length: e.sets }, () => ({ weight: 0, reps: 0, completed: false })),
        })) ?? [],
    });
  }

  if (!active) {
    return (
      <div className="flex flex-col gap-4 px-4 pt-6">
        <header>
          <h1 className="text-2xl font-bold">Start workout</h1>
          <p className="text-sm text-muted-foreground">Choose a routine or go freestyle</p>
        </header>
        <button
          onClick={() => startWorkout(null)}
          className="rounded-2xl p-5 text-left font-semibold"
          style={{ background: "var(--color-primary)", color: "var(--color-primary-foreground)" }}
        >
          <p className="text-lg">Empty workout</p>
          <p className="mt-1 text-sm opacity-80">Build it on the fly</p>
        </button>

        <h2 className="mt-2 text-sm font-semibold text-muted-foreground uppercase tracking-wide">Your routines</h2>
        {(routines ?? []).length === 0 ? (
          <p className="rounded-2xl bg-card p-6 text-center text-sm text-muted-foreground">
            Create a routine first.
          </p>
        ) : (
          <ul className="flex flex-col gap-2">
            {(routines ?? []).map((r) => (
              <li key={r.id}>
                <button
                  onClick={() => startWorkout(r)}
                  className="w-full rounded-2xl bg-card p-4 text-left"
                >
                  <p className="font-semibold">{r.name}</p>
                  <p className="text-xs text-muted-foreground">{r.exercises.length} exercises</p>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    );
  }

  return (
    <LiveSession
      session={active}
      setSession={setActive}
      onFinish={async (save) => {
        if (save) {
          const exercises = active.exercises.map((e) => ({
            ...e,
            sets: e.sets.map((s) =>
              s.completed || s.weight > 0 || s.reps > 0 ? { ...s, completed: true } : s,
            ),
          }));
          const hasCompleted = exercises.some((e) => e.sets.some((s) => s.completed));
          if (!hasCompleted) {
            const discard = confirm(
              "This workout is empty — no sets have any weight or reps. Discard it? (Cancel to keep editing.)",
            );
            if (!discard) return;
          } else {
            const endedAt = Date.now();
            await getDb().workouts.add({
              routineId: active.routine?.id,
              name: active.name,
              startedAt: active.startedAt,
              endedAt,
              durationSec: Math.round((endedAt - active.startedAt) / 1000),
              exercises,
            });
          }
        }
        setActive(null);
        navigate({ to: "/profile" });
      }}
    />
  );
}

function LiveSession({
  session,
  setSession,
  onFinish,
}: {
  session: NonNullable<ReturnType<typeof useState<{
    routine: Routine | null;
    name: string;
    startedAt: number;
    exercises: WorkoutExerciseLog[];
  } | null>>[0]>;
  setSession: React.Dispatch<React.SetStateAction<typeof session | null>>;
  onFinish: (save: boolean) => void;
}) {
  const [, force] = useState(0);
  const [picking, setPicking] = useState(false);

  useEffect(() => {
    const t = setInterval(() => force((x) => x + 1), 1000);
    return () => clearInterval(t);
  }, []);

  const elapsed = Math.round((Date.now() - session.startedAt) / 1000);

  const completedCount = useMemo(
    () => session.exercises.reduce((a, e) => a + e.sets.filter((s) => s.completed).length, 0),
    [session.exercises],
  );

  function updateSet(ei: number, si: number, patch: Partial<{ weight: number; reps: number; completed: boolean }>) {
    setSession((s) =>
      s
        ? {
            ...s,
            exercises: s.exercises.map((e, i) =>
              i !== ei ? e : { ...e, sets: e.sets.map((st, j) => (j !== si ? st : { ...st, ...patch })) },
            ),
          }
        : s,
    );
  }

  function addSet(ei: number) {
    setSession((s) =>
      s
        ? {
            ...s,
            exercises: s.exercises.map((e, i) =>
              i !== ei
                ? e
                : {
                    ...e,
                    sets: [
                      ...e.sets,
                      {
                        weight: e.sets[e.sets.length - 1]?.weight ?? 0,
                        reps: e.sets[e.sets.length - 1]?.reps ?? 0,
                        completed: false,
                      },
                    ],
                  },
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
              i !== ei ? e : { ...e, sets: e.sets.filter((_, j) => j !== si) },
            ),
          }
        : s,
    );
  }

  function removeExercise(ei: number) {
    setSession((s) => (s ? { ...s, exercises: s.exercises.filter((_, i) => i !== ei) } : s));
  }

  function addExercise(id: string) {
    setSession((s) =>
      s
        ? {
            ...s,
            exercises: [
              ...s.exercises,
              { exerciseId: id, sets: [{ weight: 0, reps: 0, completed: false }] },
            ],
          }
        : s,
    );
    setPicking(false);
  }

  return (
    <div className="flex w-full min-w-0 max-w-full flex-col gap-4 overflow-x-hidden px-4 pt-4">
      <header className="sticky top-0 -mx-4 z-10 grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-2 border-b border-border bg-background/90 px-4 py-3 backdrop-blur">
        <div className="flex items-center gap-2">
          <Timer className="h-4 w-4 text-primary" />
          <span className="font-mono text-base font-bold tabular-nums">{fmt(elapsed)}</span>
        </div>
        <div className="truncate text-center text-xs text-muted-foreground">{completedCount} sets done</div>
        <button
          onClick={() => onFinish(true)}
          className="rounded-full px-4 py-1.5 text-sm font-bold"
          style={{ background: "var(--color-primary)", color: "var(--color-primary-foreground)" }}
        >
          Finish
        </button>
      </header>

      <input
        value={session.name}
        onChange={(e) => setSession((s) => (s ? { ...s, name: e.target.value } : s))}
        className="w-full min-w-0 bg-transparent text-2xl font-bold outline-none"
      />


      {session.exercises.map((ex, ei) => {
        const def = getExercise(ex.exerciseId);
        return (
          <div key={ei} className="w-full min-w-0 overflow-hidden rounded-2xl bg-card p-3 sm:p-4">
            <div className="mb-3 flex items-center justify-between gap-2">
              <div className="min-w-0">
                <p className="truncate font-semibold text-primary">{def?.name ?? ex.exerciseId}</p>
                <p className="truncate text-xs text-muted-foreground">{def?.muscle}</p>
              </div>
              <button onClick={() => removeExercise(ei)} className="shrink-0 text-muted-foreground" aria-label="Remove exercise">
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="grid grid-cols-[1.75rem_minmax(0,1fr)_minmax(0,1fr)_1.75rem_1.5rem] gap-2 text-[10px] uppercase tracking-wide text-muted-foreground">
              <span className="text-center">Set</span>
              <span className="text-center">Kg</span>
              <span className="text-center">{def?.cardio ? "Sec" : "Reps"}</span>
              <span></span>
              <span></span>
            </div>
            <ul className="mt-2 flex flex-col gap-2">
              {ex.sets.map((s, si) => (
                <li
                  key={si}
                  className="grid grid-cols-[1.75rem_minmax(0,1fr)_minmax(0,1fr)_1.75rem_1.5rem] items-center gap-2 rounded-lg px-1 py-1.5"
                  style={{ background: s.completed ? "color-mix(in oklab, var(--color-primary) 18%, transparent)" : undefined }}
                >
                  <span className="text-center text-sm font-semibold">{si + 1}</span>
                  <NumField
                    value={s.weight}
                    decimal
                    onCommit={(n) => updateSet(ei, si, { weight: n })}
                  />
                  <NumField
                    value={s.reps}
                    onCommit={(n) => updateSet(ei, si, { reps: n })}
                    placeholder={def?.cardio ? "sec" : "0"}
                  />

                  <button
                    onClick={() => updateSet(ei, si, { completed: !s.completed })}
                    aria-label="Mark complete"
                    className="flex h-7 w-7 items-center justify-center rounded-md justify-self-end transition-colors"
                    style={{
                      background: s.completed ? "var(--color-primary)" : "var(--color-secondary)",
                      color: s.completed ? "var(--color-primary-foreground)" : "var(--color-muted-foreground)",
                    }}
                  >
                    <Check className="h-4 w-4" strokeWidth={3} />
                  </button>
                  <button
                    onClick={() => removeSet(ei, si)}
                    aria-label="Remove set"
                    className="flex h-7 w-6 items-center justify-center justify-self-end text-muted-foreground hover:text-destructive"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </li>
              ))}
            </ul>
            <button
              onClick={() => addSet(ei)}
              className="mt-3 w-full rounded-lg bg-secondary py-2 text-sm font-medium text-muted-foreground hover:text-foreground"
            >
              + Add set
            </button>
          </div>
        );
      })}

      <Button variant="outline" className="w-full" onClick={() => setPicking(true)}>
        <Plus className="mr-2 h-4 w-4" /> Add exercise
      </Button>
      <Button
        variant="ghost"
        className="w-full text-destructive hover:text-destructive"
        onClick={() => {
          if (confirm("Discard workout?")) onFinish(false);
        }}
      >
        <Trash2 className="mr-2 h-4 w-4" /> Discard workout
      </Button>

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

function NumField({
  value,
  onCommit,
  decimal = false,
  placeholder = "0",
}: {
  value: number;
  onCommit: (n: number) => void;
  decimal?: boolean;
  placeholder?: string;
}) {
  const [text, setText] = useState<string>(value ? String(value) : "");
  const [focused, setFocused] = useState(false);
  useEffect(() => {
    if (!focused) setText(value ? String(value) : "");
  }, [value, focused]);
  const pattern = decimal ? /^\d*\.?\d*$/ : /^\d*$/;
  return (
    <input
      type="text"
      inputMode={decimal ? "decimal" : "numeric"}
      value={text}
      placeholder={placeholder}
      onFocus={() => setFocused(true)}
      onBlur={() => {
        setFocused(false);
        const n = decimal ? parseFloat(text) : parseInt(text, 10);
        onCommit(Number.isFinite(n) ? n : 0);
        if (!Number.isFinite(n)) setText("");
      }}
      onChange={(e) => {
        const v = e.target.value;
        if (!pattern.test(v)) return;
        setText(v);
        if (v === "" || v === "." ) {
          onCommit(0);
          return;
        }
        const n = decimal ? parseFloat(v) : parseInt(v, 10);
        if (Number.isFinite(n)) onCommit(n);
      }}
      className="w-full min-w-0 rounded-md bg-secondary px-1 py-1.5 text-center font-medium tabular-nums outline-none focus:ring-1 focus:ring-ring"
    />
  );
}
