import { createFileRoute, Link, useBlocker } from "@tanstack/react-router";
import { useLiveQuery } from "dexie-react-hooks";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { getDb, type Routine } from "@/lib/db";
import { getExercise } from "@/lib/exercises";
import { Plus, Pencil, Trash2, X, ArrowUp, ArrowDown, Pin } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ExercisePicker } from "@/components/ExercisePicker";
import { BOTTOM_NAV_HEIGHT } from "@/lib/constants";
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

export const Route = createFileRoute("/_app/routines")({
  component: RoutinesPage,
});

// ─────────────────────────────────────────────
// Undo state for routine deletion
// ─────────────────────────────────────────────
interface RoutineUndo {
  routine: Routine;
  timeoutId: ReturnType<typeof setTimeout>;
  startTime: number;
}

function RoutinesPage() {
  const routines = useLiveQuery(
    () =>
      typeof window === "undefined"
        ? []
        : getDb().routines.orderBy("createdAt").reverse().toArray(),
    [],
    [],
  ) as Routine[] | undefined;

  const [editing, setEditing] = useState<Routine | "new" | null>(null);

  const [undo, setUndo] = useState<RoutineUndo | null>(null);
  const [undoTimeLeft, setUndoTimeLeft] = useState(5);

  useEffect(() => {
    if (!undo) return;
    const t = setInterval(() => {
      const elapsed = (Date.now() - undo.startTime) / 1000;
      setUndoTimeLeft(Math.max(0, 5 - Math.floor(elapsed)));
    }, 200);
    return () => clearInterval(t);
  }, [undo]);

  async function deleteRoutine(r: Routine) {
    if (!r.id) return;
    if (undo?.timeoutId) clearTimeout(undo.timeoutId);
    await getDb().routines.delete(r.id);
    const timeoutId = setTimeout(() => {
      setUndo(null);
      setUndoTimeLeft(5);
    }, 5000);
    setUndo({ routine: r, timeoutId, startTime: Date.now() });
    setUndoTimeLeft(5);
  }

  async function undoDelete() {
    if (!undo) return;
    clearTimeout(undo.timeoutId);
    const { id: _id, ...rest } = undo.routine;
    await getDb().routines.add(rest as Routine);
    setUndo(null);
    setUndoTimeLeft(5);
  }

  const orderedRoutines = useMemo(() => {
    const list = routines ?? [];
    return [...list].sort((a, b) => {
      const ap = a.pinned ? 1 : 0;
      const bp = b.pinned ? 1 : 0;
      if (ap !== bp) return bp - ap;
      return (b.createdAt ?? 0) - (a.createdAt ?? 0);
    });
  }, [routines]);

  const nextRoutine = orderedRoutines[0];

  return (
    <>
      <div
        className="flex flex-col overflow-y-auto"
        style={{ height: `calc(100dvh - ${BOTTOM_NAV_HEIGHT}px)` }}
      >
        <div className="flex flex-col gap-4 px-4 pt-6 pb-8">
          <header className="flex items-start justify-between gap-3">
            <div>
              <h1 className="text-2xl font-bold">Routines</h1>
              <p className="text-sm text-muted-foreground">
                Build your weekly training plan
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                Organise your week • Push / Pull / Legs / Rest
              </p>
            </div>

            <button
              onClick={() => setEditing("new")}
              className="flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-semibold min-h-[44px]"
              style={{
                background: "var(--color-primary)",
                color: "var(--color-primary-foreground)",
              }}
            >
              <Plus className="h-4 w-4" />
              New
            </button>
          </header>

          {nextRoutine && (
            <div className="rounded-2xl border border-border/50 bg-card p-4">
              <p className="text-xs text-muted-foreground">Next up</p>
              <p className="text-base font-semibold">{nextRoutine.name}</p>
              <Link
                to="/workout"
                search={{ routineId: nextRoutine.id }}
                className="mt-2 inline-block text-sm font-semibold text-primary"
              >
                Start this workout →
              </Link>
            </div>
          )}

          {(routines ?? []).length === 0 && (
            <div className="rounded-2xl bg-card p-6 text-center text-sm text-muted-foreground">
              <p className="mb-3">No routines yet</p>
              <Button onClick={() => setEditing("new")} className="w-full">
                <Plus className="mr-2 h-4 w-4" />
                Create your first routine
              </Button>
            </div>
          )}

          <ul className="flex flex-col gap-3">
            {orderedRoutines.map((r) => (
              <li key={r.id} className="rounded-2xl bg-card p-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      {r.pinned && <Pin className="h-3 w-3 text-primary" />}
                      <p className="truncate font-semibold">{r.name}</p>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {r.exercises.length} exercise{r.exercises.length === 1 ? "" : "s"}
                    </p>
                  </div>

                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => getDb().routines.update(r.id!, { pinned: !r.pinned })}
                      className="flex h-11 w-11 items-center justify-center rounded-md text-muted-foreground"
                      title={r.pinned ? "Unpin" : "Pin"}
                    >
                      <Pin className={`h-4 w-4 ${r.pinned ? "text-primary" : ""}`} />
                    </button>

                    <button
                      onClick={() => setEditing(r)}
                      className="flex h-11 w-11 items-center justify-center rounded-md text-muted-foreground"
                      title="Edit"
                    >
                      <Pencil className="h-4 w-4" />
                    </button>

                    <button
                      onClick={() => deleteRoutine(r)}
                      className="flex h-11 w-11 items-center justify-center rounded-md text-destructive"
                      title="Delete"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>

                <div className="mt-2 flex flex-wrap gap-1">
                  {r.exercises.map((e, i) => (
                    <span
                      key={i}
                      className="rounded-md bg-secondary px-2 py-0.5 text-xs text-muted-foreground"
                    >
                      {getExercise(e.exerciseId)?.name ?? e.exerciseId}
                    </span>
                  ))}
                </div>

                <Link
                  to="/workout"
                  search={{ routineId: r.id }}
                  className="mt-3 block rounded-lg py-3 text-center text-sm font-semibold min-h-[44px] flex items-center justify-center"
                  style={{
                    background: "var(--color-primary)",
                    color: "var(--color-primary-foreground)",
                  }}
                >
                  Start workout
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </div>

      {editing && (
        <RoutineEditor
          initial={editing === "new" ? null : editing}
          onClose={() => setEditing(null)}
        />
      )}

      {undo && (
        <div className="fixed bottom-20 left-4 right-4 z-[9999] mx-auto flex max-w-md items-center justify-between rounded-xl bg-zinc-900 px-4 py-3 text-white shadow-xl">
          <div className="min-w-0">
            <p className="text-sm font-medium">"{undo.routine.name}" deleted</p>
            <p className="text-xs text-white/60">Undoing in {undoTimeLeft}s…</p>
          </div>
          <button
            onClick={undoDelete}
            className="ml-4 shrink-0 rounded-lg bg-white px-3 py-1.5 text-sm font-semibold text-black min-h-[36px]"
          >
            Undo
          </button>
        </div>
      )}
    </>
  );
}

// ─────────────────────────────────────────────
// RoutineEditor
// ─────────────────────────────────────────────

function RoutineEditor({
  initial,
  onClose,
}: {
  initial: Routine | null;
  onClose: () => void;
}) {
  const [name, setName] = useState(initial?.name ?? "");
  const [exercises, setExercises] = useState(initial?.exercises ?? []);
  const [picking, setPicking] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);

  const hasChanges = useMemo(() => {
    if (!initial) return name.trim() !== "" || exercises.length > 0;
    if (name !== initial.name) return true;
    if (exercises.length !== initial.exercises.length) return true;
    return exercises.some((e, i) => {
      const init = initial.exercises[i];
      return !init || e.exerciseId !== init.exerciseId || e.sets !== init.sets;
    });
  }, [name, exercises, initial]);

  const blocker = useBlocker({ shouldBlockFn: () => hasChanges, withResolver: true });

  useEffect(() => {
    if (blocker.status === "blocked") setConfirmOpen(true);
  }, [blocker.status]);

  const handleClose = useCallback(() => {
    if (hasChanges) setConfirmOpen(true);
    else onClose();
  }, [hasChanges, onClose]);

  const handleDiscard = useCallback(() => {
    setConfirmOpen(false);
    if (blocker.status === "blocked") blocker.proceed();
    else onClose();
  }, [blocker, onClose]);

  const handleCancel = useCallback(() => {
    setConfirmOpen(false);
    if (blocker.status === "blocked") blocker.reset();
  }, [blocker]);

  function moveExerciseUp(index: number) {
    if (index === 0) return;
    setExercises((xs) => {
      const next = [...xs];
      [next[index - 1], next[index]] = [next[index], next[index - 1]];
      return next;
    });
  }

  function moveExerciseDown(index: number) {
    setExercises((xs) => {
      if (index >= xs.length - 1) return xs;
      const next = [...xs];
      [next[index + 1], next[index]] = [next[index], next[index + 1]];
      return next;
    });
  }

  async function save() {
    const trimmed = name.trim();
    if (!trimmed || exercises.length === 0) return;
    const db = getDb();
    if (initial?.id) {
      await db.routines.update(initial.id, { name: trimmed, exercises });
    } else {
      await db.routines.add({ name: trimmed, exercises, createdAt: Date.now() });
    }
    onClose();
  }

  return (
    <div
      className="fixed inset-x-0 top-0 z-50 flex justify-center bg-background"
      style={{ bottom: `${BOTTOM_NAV_HEIGHT}px` }}
    >
      <div className="flex h-full w-full max-w-md flex-col">
        <header className="flex items-center justify-between border-b border-border px-4 py-3">
          <button onClick={handleClose} className="flex h-11 w-11 items-center justify-center">
            <X className="h-5 w-5" />
          </button>

          <h2 className="text-base font-semibold">
            {initial ? "Edit routine" : "New routine"}
          </h2>

          <button
            onClick={save}
            disabled={!name.trim() || exercises.length === 0}
            className="rounded-full px-4 py-1.5 text-sm font-semibold disabled:opacity-40 min-h-[36px]"
            style={{
              background: "var(--color-primary)",
              color: "var(--color-primary-foreground)",
            }}
          >
            Save
          </button>
        </header>

        <div className="flex-1 overflow-y-auto px-4 py-4 pb-6">
          <input
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Routine name"
            className="w-full rounded-xl bg-card px-4 py-3 text-lg font-semibold outline-none focus:ring-2 focus:ring-ring"
          />

          <div className="mt-4 text-xs text-muted-foreground">
            Add exercises to build your session
          </div>

          <ul className="mt-3 flex flex-col gap-2">
            {exercises.map((e, i) => {
              const def = getExercise(e.exerciseId);
              return (
                <li
                  key={i}
                  className="flex items-center justify-between rounded-xl bg-card px-4 py-3 gap-3"
                >
                  <div className="flex-1 min-w-0">
                    <p className="font-medium">{def?.name ?? e.exerciseId}</p>
                    <p className="text-xs text-muted-foreground">{def?.muscle}</p>

                    <div className="mt-3 flex flex-wrap gap-3">
                      <div className="flex items-center gap-1">
                        <span className="text-xs text-muted-foreground">Sets</span>
                        <input
                          type="number"
                          min="1"
                          value={e.sets}
                          onChange={(ev) =>
                            setExercises((xs) =>
                              xs.map((x, idx) =>
                                idx === i
                                  ? { ...x, sets: Math.max(1, Number(ev.target.value) || 1) }
                                  : x,
                              ),
                            )
                          }
                          className="w-14 rounded bg-secondary px-2 py-1 text-sm"
                        />
                      </div>

                      <div className="flex items-center gap-1">
                        <span className="text-xs text-muted-foreground">Kg</span>
                        <input
                          type="number"
                          min="0"
                          step="0.5"
                          value={e.targetWeight ?? ""}
                          onChange={(ev) =>
                            setExercises((xs) =>
                              xs.map((x, idx) =>
                                idx === i
                                  ? { ...x, targetWeight: Math.max(0, Number(ev.target.value) || 0) }
                                  : x,
                              ),
                            )
                          }
                          className="w-16 rounded bg-secondary px-2 py-1 text-sm"
                          placeholder="0"
                        />
                      </div>

                      <div className="flex items-center gap-1">
                        <span className="text-xs text-muted-foreground">Reps</span>
                        <input
                          type="number"
                          min="0"
                          value={e.targetReps ?? ""}
                          onChange={(ev) =>
                            setExercises((xs) =>
                              xs.map((x, idx) =>
                                idx === i
                                  ? { ...x, targetReps: Math.max(0, Number(ev.target.value) || 0) }
                                  : x,
                              ),
                            )
                          }
                          className="w-14 rounded bg-secondary px-2 py-1 text-sm"
                          placeholder="0"
                        />
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-col items-center gap-1">
                    <button
                      onClick={() => moveExerciseUp(i)}
                      disabled={i === 0}
                      className="flex h-10 w-10 items-center justify-center rounded disabled:opacity-30"
                    >
                      <ArrowUp className="h-4 w-4" />
                    </button>

                    <button
                      onClick={() => moveExerciseDown(i)}
                      disabled={i === exercises.length - 1}
                      className="flex h-10 w-10 items-center justify-center rounded disabled:opacity-30"
                    >
                      <ArrowDown className="h-4 w-4" />
                    </button>

                    <button
                      onClick={() => setExercises((xs) => xs.filter((_, j) => j !== i))}
                      className="flex h-10 w-10 items-center justify-center text-destructive"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>

          <Button className="mt-4 w-full min-h-[44px]" onClick={() => setPicking(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Add exercise
          </Button>
        </div>
      </div>

      {picking && (
        <ExercisePicker
          onClose={() => setPicking(false)}
          onPick={(id) => {
            setExercises((xs) => [...xs, { exerciseId: id, sets: 1 }]);
            setPicking(false);
          }}
        />
      )}

      <AlertDialog open={confirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Discard unsaved changes?</AlertDialogTitle>
            <AlertDialogDescription>
              Your changes to this routine haven't been saved.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={handleCancel}>Keep editing</AlertDialogCancel>
            <AlertDialogAction onClick={handleDiscard}>Discard</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
