import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useLiveQuery } from "dexie-react-hooks";
import { ArrowLeft } from "lucide-react";
import { getDb, type PRRecord } from "@/lib/db";
import { getExercise } from "@/lib/exercises";

export const Route = createFileRoute("/_app/exercise/$id")({
  component: ExerciseProgressPage,
});

function ExerciseProgressPage() {
  const { id } = Route.useParams();
  const navigate = useNavigate();

  const def = getExercise(id);

  // All PR records for this exercise, sorted by date ascending
  const prs = useLiveQuery(async () => {
    if (typeof window === "undefined") return [];
    return getDb()
      .prHistory.where("exerciseId")
      .equals(id)
      .sortBy("createdAt");
  }, [id]) as PRRecord[] | undefined;

  // Latest PR per type — derived directly from stored records
  const latest: Partial<Record<"weight" | "reps" | "time", PRRecord>> = {};
  if (prs) {
    for (const pr of prs) {
      latest[pr.type] = pr; // prs is ascending by createdAt, so last wins
    }
  }

  const fmt = (pr: PRRecord, v: number) =>
    pr.type === "time"
      ? v >= 60
        ? `${Math.floor(v / 60)}:${String(v % 60).padStart(2, "0")}`
        : `${v}s`
      : pr.type === "weight"
      ? `${v}kg`
      : `${v}`;

  // Group PRs by type for the progression list
  const byType: Record<string, PRRecord[]> = {};
  if (prs) {
    for (const pr of prs) {
      if (!byType[pr.type]) byType[pr.type] = [];
      byType[pr.type].push(pr);
    }
  }

  const typeOrder: Array<"weight" | "reps" | "time"> = ["weight", "reps", "time"];
  const typeLabel: Record<string, string> = {
    weight: "Weight",
    reps: "Reps",
    time: "Duration",
  };

  return (
    <div className="flex flex-col gap-4 px-4 pt-4 pb-8">
      {/* Header */}
      <header className="flex items-center gap-3">
        <button onClick={() => navigate({ to: "/history" })} className="p-1">
          <ArrowLeft className="h-5 w-5" />
        </button>
        <div className="min-w-0">
          <h1 className="truncate text-lg font-bold">
            {def?.name ?? id}
          </h1>
          <p className="text-xs text-muted-foreground">{def?.muscle}</p>
        </div>
      </header>

      {/* Current PRs */}
      {prs && prs.length > 0 && (
        <div className="rounded-xl bg-card p-4">
          <h2 className="mb-3 text-sm font-semibold">Current Personal Bests</h2>
          <div className="flex flex-wrap gap-4">
            {typeOrder.map((type) => {
              const pr = latest[type];
              if (!pr) return null;
              return (
                <div key={type}>
                  <p className="text-xs text-muted-foreground">{typeLabel[type]}</p>
                  <p className="text-base font-bold text-primary">{fmt(pr, pr.value)}</p>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Progression by type */}
      {prs && prs.length === 0 && (
        <p className="text-sm text-muted-foreground">
          No personal records yet for this exercise.
        </p>
      )}

      {prs && prs.length > 0 &&
        typeOrder.map((type) => {
          const records = byType[type];
          if (!records?.length) return null;
          return (
            <div key={type} className="rounded-xl bg-card p-4">
              <h2 className="mb-3 text-sm font-semibold">{typeLabel[type]} Progression</h2>
              <div className="flex flex-col gap-2">
                {records.map((pr, i) => {
                  const isFirst = (pr.previousBest ?? 0) === 0;
                  const date = new Date(pr.createdAt).toLocaleDateString();
                  return (
                    <div
                      key={pr.id ?? i}
                      className="flex items-center justify-between gap-2 border-b border-muted/20 pb-2 last:border-0 last:pb-0"
                    >
                      <div>
                        <p className="text-sm">
                          {isFirst ? (
                            <span>
                              First PR —{" "}
                              <span className="font-semibold text-primary">
                                {fmt(pr, pr.value)}
                              </span>
                            </span>
                          ) : (
                            <span>
                              {fmt(pr, pr.previousBest ?? 0)} →{" "}
                              <span className="font-semibold text-primary">
                                {fmt(pr, pr.value)}
                              </span>
                            </span>
                          )}
                        </p>
                        <p className="text-xs text-muted-foreground">{date}</p>
                      </div>
                      {!isFirst && (
                        <span className="shrink-0 text-xs font-semibold text-primary">
                          +{fmt(pr, pr.delta ?? (pr.value - (pr.previousBest ?? 0)))}
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
    </div>
  );
}
