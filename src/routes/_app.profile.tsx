import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useLiveQuery } from "dexie-react-hooks";
import { useMemo, useState, type ReactNode } from "react";
import { getDb, type Workout } from "@/lib/db";
import { getExercise, MUSCLE_GROUPS, type MuscleGroup } from "@/lib/exercises";
import { Activity, TrendingUp, CalendarDays, BarChart3 } from "lucide-react";
import { MuscleMap } from "@/components/MuscleMap";

const MOTIVATIONAL_MESSAGES = [
  "Ready to crush today's session?",
  "Consistency beats talent. Let's work.",
  "No shortcuts. Just hard work.",
  "Earn your rest today.",
  "Make yourself proud.",
  "Small steps every day add up.",
  "Sweat now, shine later.",
  "The only bad workout is the one that didn't happen.",
] as const;

export const Route = createFileRoute("/_app/profile")({
  head: () => ({
    meta: [
      { title: "Profile · Hevy Clone" },
      {
        name: "description",
        content: "Your workout stats, streak and history.",
      },
    ],
  }),
  component: ProfilePage,
});

function ProfilePage() {
  const navigate = useNavigate();

  const workouts = useLiveQuery(async () => {
    if (typeof window === "undefined") return [];
    return getDb().workouts.orderBy("startedAt").reverse().toArray();
  }, []);

  const lastWorkout = useLiveQuery(async () => {
    if (typeof window === "undefined") return null;
    const all = await getDb().workouts.orderBy("startedAt").reverse().limit(1).toArray();
    return all?.[0] ?? null;
  }, []);

  const [selectedMuscle, setSelectedMuscle] = useState<MuscleGroup | null>(null);
  const [drilldownMuscle, setDrilldownMuscle] = useState<MuscleGroup | null>(null);

  const stats = useMemo(() => computeStats(workouts ?? []), [workouts]);
  const intensity = useMemo(() => computeMuscleIntensity(workouts ?? []), [workouts]);

  const todayKey = Math.floor(Date.now() / 86400000);

  const message = useMemo(() => {
    if (!workouts?.length) return "Start your first workout today.";
    if (stats.total >= 50) return "Momentum is building.";
    return MOTIVATIONAL_MESSAGES[todayKey % MOTIVATIONAL_MESSAGES.length];
  }, [workouts, stats, todayKey]);

  const lastSummary = useMemo(() => {
    if (!lastWorkout) return null;

    const sets = lastWorkout.exercises.reduce(
      (a, e) => a + e.sets.filter((s) => s.completed).length,
      0
    );

    const muscles = new Set(
      lastWorkout.exercises.map((e) => getExercise(e.exerciseId)?.muscle).filter(Boolean)
    );

    return {
      name: lastWorkout.name,
      duration: lastWorkout.durationSec,
      sets,
      muscles: Array.from(muscles).slice(0, 2),
      id: lastWorkout.id,
    };
  }, [lastWorkout]);

  return (
    <div className="flex flex-col gap-6 px-4 pt-6">

      {/* HEADER */}
      <header className="flex items-center gap-4">
        <div className="grid h-14 w-14 place-items-center rounded-2xl bg-primary/10 text-primary">
          <BarChart3 className="h-6 w-6" />
        </div>

        <div className="min-w-0">
          <h1 className="truncate text-xl font-bold tracking-tight">
            Training Overview
          </h1>

          <div className="mt-1 inline-flex items-center rounded-full bg-secondary px-3 py-1 text-xs text-muted-foreground">
            {message}
          </div>
        </div>
      </header>

      {/* LAST WORKOUT (NEW CORE MODULE) */}
      {lastSummary && (
        <div
          onClick={() =>
            lastSummary.id &&
            navigate({ to: "/history/$id", params: { id: String(lastSummary.id) } })
          }
          className="rounded-2xl bg-card p-4 active:scale-[0.99] transition cursor-pointer"
        >
          <div className="mb-2 flex items-center justify-between">
            <p className="text-sm font-semibold">Last workout</p>
            <p className="text-xs text-muted-foreground">Tap to view</p>
          </div>

          <p className="truncate font-bold">{lastSummary.name}</p>

          <div className="mt-2 flex flex-wrap gap-3 text-xs text-muted-foreground">
            <span>{Math.round(lastSummary.duration / 60)} min</span>
            <span>{lastSummary.sets} sets</span>
            {lastSummary.muscles.length > 0 && (
              <span>{lastSummary.muscles.join(", ")}</span>
            )}
          </div>
        </div>
      )}

      {/* STATS */}
      <section className="grid grid-cols-3 gap-3">
        <StatCard
          icon={<Activity className="h-4 w-4" />}
          label="Sessions"
          value={stats.total.toString()}
        />
        <StatCard
          icon={<TrendingUp className="h-4 w-4" />}
          label="Volume"
          value={Math.round(stats.totalVolume).toLocaleString()}
        />
        <StatCard
          icon={<CalendarDays className="h-4 w-4" />}
          label="Active days"
          value={stats.thisWeek.toString()}
        />
      </section>

      {/* MUSCLE MAP */}
      <section className="rounded-2xl border border-border/50 bg-card p-5">
        <div className="mb-4">
          <h2 className="text-base font-semibold">Muscle Activity</h2>
          <p className="text-xs text-muted-foreground">
            Based on completed sets • Tap to explore
          </p>
        </div>

        <div
          className={`mb-5 rounded-xl p-3 ${
            selectedMuscle ? "bg-primary/10" : "bg-secondary/20"
          }`}
        >
          <MuscleMap
            intensity={intensity}
            activeMuscle={selectedMuscle}
            className="max-h-72 w-full"
          />
        </div>

        <div className="space-y-3">
          {MUSCLE_GROUPS.filter(
            (m) => m !== "Cardio" && (intensity[m] ?? 0) > 0
          )
            .sort((a, b) => (intensity[b] ?? 0) - (intensity[a] ?? 0))
            .slice(0, 7)
            .map((m) => {
              const value = Math.round((intensity[m] ?? 0) * 100);
              const isSelected = selectedMuscle === m;
              const dim = selectedMuscle && !isSelected;

              return (
                <div
                  key={m}
                  className={dim ? "opacity-30" : "opacity-100"}
                  onClick={() => setSelectedMuscle((p) => (p === m ? null : m))}
                  onContextMenu={(e) => {
                    e.preventDefault();
                    setDrilldownMuscle(m);
                  }}
                >
                  <div className="mb-1 flex justify-between text-xs">
                    <span className="text-muted-foreground">{m}</span>
                    <span className="font-semibold tabular-nums">{value}%</span>
                  </div>

                  <div className="h-2 w-full rounded-full bg-secondary">
                    <div
                      className="h-full bg-primary transition-all"
                      style={{ width: `${value}%` }}
                    />
                  </div>
                </div>
              );
            })}
        </div>
      </section>

      {/* DRILLDOWN */}
      {drilldownMuscle && (
        <div className="fixed inset-0 z-50 flex items-end bg-black/40">
          <div className="w-full rounded-t-2xl bg-card p-5">
            <div className="mb-3 flex justify-between">
              <h3 className="font-semibold">{drilldownMuscle}</h3>
              <button
                onClick={() => setDrilldownMuscle(null)}
                className="text-sm text-muted-foreground"
              >
                Close
              </button>
            </div>

            <button
              onClick={() => {
                setSelectedMuscle(drilldownMuscle);
                setDrilldownMuscle(null);
              }}
              className="w-full rounded-xl bg-primary py-3 text-sm font-medium text-primary-foreground"
            >
              Focus this muscle
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

/* ===================== */

function StatCard({
  icon,
  label,
  value,
}: {
  icon: ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-2xl bg-card p-4">
      <div className="flex items-center gap-2 text-muted-foreground">
        {icon}
        <span className="text-xs">{label}</span>
      </div>
      <p className="mt-1 text-xl font-bold">{value}</p>
    </div>
  );
}

/* ===================== */

function computeStats(workouts: Workout[]) {
  const total = workouts.length;

  const totalVolume = workouts.reduce((acc, w) => {
    return (
      acc +
      w.exercises.reduce((a, e) => {
        return (
          a +
          e.sets.reduce((sAcc, s) => {
            if (!s.completed) return sAcc;
            return sAcc + Number(s.weight ?? 0) * Number(s.reps ?? 0);
          }, 0)
        );
      }, 0)
    );
  }, 0);

  const weekAgo = Date.now() - 7 * 86400000;

  const activeDays = new Set(
    workouts
      .filter((w) => w.startedAt >= weekAgo)
      .map((w) => {
        const d = new Date(w.startedAt);
        d.setHours(0, 0, 0, 0);
        return d.getTime();
      })
  ).size;

  return {
    total,
    totalVolume,
    thisWeek: activeDays,
  };
}

function computeMuscleIntensity(workouts: Workout[]) {
  const totals: Partial<Record<MuscleGroup, number>> = {};

  for (const w of workouts) {
    for (const e of w.exercises) {
      const def = getExercise(e.exerciseId);
      if (!def) continue;

      const completed = e.sets.filter((s) => s.completed).length;

      totals[def.muscle] = (totals[def.muscle] ?? 0) + completed;

      for (const sec of def.secondary ?? []) {
        totals[sec] = (totals[sec] ?? 0) + completed * 0.5;
      }
    }
  }

  const max = Math.max(1, ...Object.values(totals));

  const normalized: Partial<Record<MuscleGroup, number>> = {};

  for (const k of Object.keys(totals) as MuscleGroup[]) {
    normalized[k] = (totals[k] ?? 0) / max;
  }

  return normalized;
}
