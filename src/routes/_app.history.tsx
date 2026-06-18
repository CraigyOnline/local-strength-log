import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useLiveQuery } from "dexie-react-hooks";
import { getDb } from "@/lib/db";

export const Route = createFileRoute("/_app/history")({
  component: HistoryPage,
});

function HistoryPage() {
  const navigate = useNavigate();

  const workouts = useLiveQuery(
    () => getDb().workouts.orderBy("startedAt").reverse().toArray(),
    []
  );

  return (
    <div className="p-4 space-y-4">
      <h1 className="text-xl font-bold">Workout History</h1>

      {!workouts?.length && (
        <p className="text-sm text-muted-foreground">No workouts yet.</p>
      )}

      <ul className="space-y-3">
        {workouts?.map((w) => (
          <li
            key={w.id}
            className="rounded-xl border p-3 cursor-pointer"
            onClick={() =>
              navigate({ to: "/_app/history/$id", params: { id: w.id } })
            }
          >
            <div className="font-semibold">{w.name}</div>
            <div className="text-xs text-muted-foreground">
              {new Date(w.startedAt).toLocaleDateString()} ·{" "}
              {Math.round(w.durationSec / 60)} min
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
