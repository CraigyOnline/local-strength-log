import { createFileRoute, Outlet, useLocation, useNavigate } from "@tanstack/react-router";
import { useLiveQuery } from "dexie-react-hooks";
import { getDb, type Workout } from "@/lib/db";
import { getExercise } from "@/lib/exercises";
import { Trash2 } from "lucide-react";

export const Route = createFileRoute("/_app/history")({
  component: HistoryPage,
});

function HistoryPage() {
  const { pathname } = useLocation();
  // When a child route (/history/$id) is active, just render it
  if (pathname !== "/history" && pathname !== "/history/") {
    return <Outlet />;
  }
  return <HistoryList />;
}

function HistoryList() {
  const navigate = useNavigate();

  const workouts = useLiveQuery(
    () =>
      typeof window === "undefined"
        ? Promise.resolve([])
        : getDb().workouts.orderBy("startedAt").reverse().toArray(),
    [],
  );

  async function remove(id: number | undefined, e: React.MouseEvent) {
    e.stopPropagation();
    if (!id) return;
    if (!confirm("Delete this workout?")) return;
    await getDb().workouts.delete(id);
  }

  return (
    <div className="flex flex-col gap-4 px-4 pt-6 pb-8">
      <h1 className="text-2xl font-bold">Workout History</h1>

      {!workouts?.length && (
        <p className="text-sm text-muted-foreground">No workouts yet. Start one from the Workout tab.</p>
      )}

      <ul className="flex flex-col gap-3">
        {workouts?.map((w) => {
          const totalSets = w.exercises.reduce((a, e) => a + e.sets.filter((s) => s.completed).length, 0);
          return (
            <li
              key={w.id}
              className="cursor-pointer rounded-xl bg-card p-4"
              onClick={() => w.id && navigate({ to: "/history/$id", params: { id: String(w.id) } })}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="truncate font-semibold">{w.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {new Date(w.startedAt).toLocaleString()} ·{" "}
                    {Math.max(1, Math.round((w.durationSec ?? 0) / 60))} min · {w.exercises.length} ex · {totalSets} sets
                  </p>
                  <div className="mt-2 flex flex-wrap gap-1">
                    {w.exercises.slice(0, 5).map((e, i) => (
                      <span key={i} className="rounded bg-secondary px-2 py-0.5 text-xs text-muted-foreground">
                        {getExercise(e.exerciseId)?.name ?? e.exerciseId}
                      </span>
                    ))}
                    {w.exercises.length > 5 && (
                      <span className="text-xs text-muted-foreground">+{w.exercises.length - 5}</span>
                    )}
                  </div>
                </div>
                <button
                  onClick={(ev) => remove(w.id, ev)}
                  aria-label="Delete workout"
                  className="p-2 text-destructive"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
