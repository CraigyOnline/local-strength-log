import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useLiveQuery } from "dexie-react-hooks";
import { useState } from "react";
import { getDb, type Workout } from "@/lib/db";
import { getExercise } from "@/lib/exercises";
import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
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

export const Route = createFileRoute("/_app/history/")({
  component: HistoryList,
});

function HistoryList() {
  const navigate = useNavigate();
  const [visibleCount, setVisibleCount] = useState(10);
  const [pendingDelete, setPendingDelete] = useState<Workout | null>(null);

  const workouts = useLiveQuery(
    () =>
      typeof window === "undefined"
        ? Promise.resolve<Workout[]>([])
        : getDb().workouts.orderBy("startedAt").reverse().toArray(),
    [],
  ) as Workout[] | undefined;

  async function remove(workout: Workout) {
    if (!workout.id) return;
    await getDb().workouts.delete(workout.id);
    setPendingDelete(null);
  }

  return (
    <div className="flex flex-col gap-4 px-4 pt-6 pb-8">
      <h1 className="text-2xl font-bold">Workout History</h1>

      {!workouts?.length && (
        <p className="text-sm text-muted-foreground">
          No workouts yet. Start one from the Workout tab.
        </p>
      )}

      <ul className="flex flex-col gap-3">
        {workouts?.slice(0, visibleCount).map((w) => {
          const totalSets = w.exercises.reduce(
            (a, e) => a + e.sets.filter((s) => s.completed).length,
            0,
          );

          // Volume: skip bodyweight & cardio — weight × reps is meaningless for those
          const totalVolume = w.exercises.reduce((sum, ex) => {
            const def = getExercise(ex.exerciseId);
            if (def?.equipment === "Bodyweight" || def?.equipment === "Cardio") return sum;
            return (
              sum +
              ex.sets.reduce((s, set) => s + (set.weight ?? 0) * (set.reps ?? 0), 0)
            );
          }, 0);

          return (
            <li
              key={w.id}
              className="cursor-pointer rounded-xl bg-card p-4 active:scale-[0.99] transition"
              onClick={() =>
                w.id && navigate({ to: "/history/$id", params: { id: String(w.id) } })
              }
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="truncate font-semibold">{w.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {new Date(w.startedAt).toLocaleDateString()} ·{" "}
                    {Math.max(1, Math.round((w.durationSec ?? 0) / 60))} min ·{" "}
                    {w.exercises.length} ex · {totalSets} sets
                  </p>

                  {totalVolume > 0 && (
                    <p className="mt-1 text-xs text-muted-foreground">
                      Volume: {totalVolume.toLocaleString()} kg
                    </p>
                  )}

                  <div className="mt-2 flex flex-wrap gap-1">
                    {w.exercises.slice(0, 5).map((e, i) => (
                      <span
                        key={i}
                        className="rounded bg-secondary px-2 py-0.5 text-xs text-muted-foreground"
                      >
                        {getExercise(e.exerciseId)?.name ?? e.exerciseId}
                      </span>
                    ))}
                    {w.exercises.length > 5 && (
                      <span className="text-xs text-muted-foreground">
                        +{w.exercises.length - 5}
                      </span>
                    )}
                  </div>
                </div>

                {/* Fix #11: 44px tap target for delete */}
                <button
                  onClick={(ev) => {
                    ev.stopPropagation();
                    setPendingDelete(w);
                  }}
                  aria-label="Delete workout"
                  className="flex h-11 w-11 items-center justify-center text-destructive shrink-0"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </li>
          );
        })}
      </ul>

      {workouts && workouts.length > visibleCount && (
        <Button variant="outline" onClick={() => setVisibleCount((v) => v + 10)}>
          Load More
        </Button>
      )}

      <AlertDialog
        open={!!pendingDelete}
        onOpenChange={(open) => !open && setPendingDelete(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete workout?</AlertDialogTitle>
            <AlertDialogDescription>
              "{pendingDelete?.name}" will be permanently deleted. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => pendingDelete && remove(pendingDelete)}
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
