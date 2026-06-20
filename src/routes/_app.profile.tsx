import { createFileRoute } from "@tanstack/react-router";
import { useLiveQuery } from "dexie-react-hooks";
import { useMemo, useState, type ReactNode } from "react";
import { getDb, type Workout } from "@/lib/db";
import { getExercise, MUSCLE_GROUPS, type MuscleGroup } from "@/lib/exercises";
import { Dumbbell, Calendar, Trophy, Flame } from "lucide-react";
import { MuscleMap } from "@/components/MuscleMap";

const MOTIVATIONAL_MESSAGES = [
  "Ready to crush today's session?",
  "Consistency beats talent. Let's work.",
  "No shortcuts. Just hard work.",
  "Earn your rest today.",
  "Make yourself proud.",
  "Small steps every day add up.",
  "Sweat now, shine later.",
  "The only workout you regret is the one that didn't happen.",
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
  const workouts = useLiveQuery(async () => {
    if (typeof window === "undefined") return [];
    return getDb().workouts.orderBy("startedAt").reverse().toArray();
  }, []);

  const [selectedMuscle, setSelectedMuscle] = useState<MuscleGroup | null>(null);
  const [drilldownMuscle, setDrilldownMuscle] = useState<MuscleGroup | null>(null);

  const stats = useMemo(() => computeStats(workouts ?? []), [workouts]);
  const intensity = useMemo(() => computeMuscleIntensity(workouts ?? []), [workouts]);

  const todayKey = Math.floor(Date.now() / 86400000);

  const welcomeMessage = useMemo(() => {
    if (!workouts?.length) return "Ready to start your fitness journey?";
    if (stats.streak >= 30) return "30+ day streak. You're on fire.";
    if (stats.streak >= 7) return "A full week of consistency. Keep it going.";
    if (stats.total >= 100) return "100 workouts completed. Huge achievement.";
    return MOTIVATIONAL_MESSAGES[todayKey % MOTIVATIONAL_MESSAGES.length];
  }, [workouts, stats, todayKey]);

  const summaryLine = useMemo(() => {
    if (!workouts?.length) return "No workouts yet — start your first session.";
    return `${stats.total} workouts · ${stats.streak} day streak · ${Math.round(
      stats.totalVolume
    ).toLocaleString()} kg total volume`;
  }, [workouts, stats]);

  const topMuscleLabel = useMemo(() => {
    const top = Object.entries(intensity).sort((a, b) => (b[1] ?? 0) - (a[1] ?? 0))[0];
    if (!top) return "No training data yet";
    return `Most active: ${top[0]} (${Math.round((top[1] ?? 0) * 100)}%)`;
  }, [intensity]);

  return (
    <div className="flex flex-col gap-8 px-4 pt-6 pb-10">

      {/* HEADER (clean + motivational + context) */}
      <header className="flex flex-col gap-2">
        <h1 className="text-2xl font-bold tracking-tight">Profile</h1>

        <p className="text-sm text-muted-foreground leading-snug">
          {welcomeMessage}
        </p>

        <p className="text-xs text-muted-foreground/80">
          {summaryLine}
        </p>
      </header>

      {/* MUSCLE MAP (now behaves like a live body report) */}
      <section className="rounded-2xl border border-border/40 bg-card p-5 shadow-sm">

        <div className="mb-4 flex items-start justify-between">
          <div>
            <h2 className="text-base font-semibold">Training Focus</h2>

            <p className="text-xs text-muted-foreground">
              {topMuscleLabel}
            </p>
          </div>

          {selectedMuscle && (
            <button
              onClick={() => setSelectedMuscle(null)}
              className="text-xs font-medium text-primary"
            >
              Clear
            </button>
          )}
        </div>

        {/* BODY VISUAL */}
        <div
          className={`mb-5 rounded-xl p-4 transition-colors duration-300 ${
            selectedMuscle ? "bg-primary/10" : "bg-secondary/20"
          }`}
        >
          <MuscleMap
            intensity={intensity}
            activeMuscle={selectedMuscle}
            className="max-h-72 w-full"
          />
        </div>

        {/* INTENSITY LIST */}
        <div className="space-y-3">
          {MUSCLE_GROUPS.filter(
            (m) => m !== "Cardio" && (intensity[m] ?? 0) > 0
          )
            .sort((a, b) => (intensity[b] ?? 0) - (intensity[a] ?? 0))
            .slice(0, 6)
            .map((m) => {
              const value = Math.round((intensity[m] ?? 0) * 100);
              const isSelected = selectedMuscle === m;
              const isDimmed = selectedMuscle && !isSelected;

              return (
                <div
                  key={m}
                  className={`transition-opacity duration-200 ${
                    isDimmed ? "opacity-30" : "opacity-100"
                  }`}
                  onClick={() =>
                    setSelectedMuscle((prev) => (prev === m ? null : m))
                  }
                  onContextMenu={(e) => {
                    e.preventDefault();
                    setDrilldownMuscle(m);
                  }}
                >
                  <div className="mb-1 flex justify-between text-xs">
                    <span className="text-muted-foreground">{m}</span>
                    <span className="tabular-nums font-semibold">{value}%</span>
                  </div>

                  <div className="h-2 w-full overflow-hidden rounded-full bg-secondary">
                    <div
                      className={`h-full transition-all duration-300 ${
                        isSelected ? "bg-primary" : "bg-primary/70"
                      }`}
                      style={{ width: `${value}%` }}
                    />
                  </div>
                </div>
              );
            })}
        </div>

        {/* SCALE */}
        <div className="mt-4 flex items-center justify-between text-[10px] text-muted-foreground">
          <span>Low activation</span>
          <div className="mx-2 h-1 flex-1 rounded-full bg-gradient-to-r from-muted to-primary/60" />
          <span>High activation</span>
        </div>

        {/* DRILLDOWN (unchanged behaviour) */}
        {drilldownMuscle && (
          <div className="fixed inset-0 z-50 flex items-end bg-black/40">
            <div className="w-full rounded-t-2xl bg-card p-5">
              <div className="mb-3 flex items-center justify-between">
                <h3 className="text-base font-semibold">{drilldownMuscle}</h3>
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
      </section>

      {/* STATS (unchanged logic, slightly secondary visually) */}
      <section className="grid grid-cols-2 gap-3 opacity-90">
        <StatCard icon={<Dumbbell className="h-4 w-4" />} label="Workouts" value={stats.total.toString()} />
        <StatCard icon={<Flame className="h-4 w-4" />} label="Streak" value={`${stats.streak} days`} />
        <StatCard icon={<Trophy className="h-4 w-4" />} label="Volume" value={Math.round(stats.totalVolume).toLocaleString()} />
        <StatCard icon={<Calendar className="h-4 w-4" />} label="This week" value={stats.thisWeek.toString()} />
      </section>
    </div>
  );
}

/* unchanged */
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
      <p className="mt-1 text-2xl font-bold">{value}</p>
    </div>
  );
}

/* unchanged logic */
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
  const thisWeek = workouts.filter((w) => w.startedAt >= weekAgo).length;

  const days = new Set(
    workouts.map((w) => {
      const d = new Date(w.startedAt);
      d.setHours(0, 0, 0, 0);
      return d.getTime();
    })
  );

  let streak = 0;
  const cursor = new Date();
  cursor.setHours(0, 0, 0, 0);

  if (!days.has(cursor.getTime())) {
    cursor.setDate(cursor.getDate() - 1);
  }

  while (days.has(cursor.getTime())) {
    streak++;
    cursor.setDate(cursor.getDate() - 1);
  }

  return { total, totalVolume, thisWeek, streak };
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
