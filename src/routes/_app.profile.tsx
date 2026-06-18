import { createFileRoute, Link } from "@tanstack/react-router";
import { useLiveQuery } from "dexie-react-hooks";
import { useMemo, useState } from "react";
import { getDb, type Workout } from "@/lib/db";
import { getExercise, MUSCLE_GROUPS, type MuscleGroup } from "@/lib/exercises";
import { Flame, Dumbbell, Calendar, Trophy } from "lucide-react";
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
      { name: "description", content: "Your workout stats, streak and history." },
    ],
  }),
  component: ProfilePage,
});

function ProfilePage() {
  const workouts = useLiveQuery(
    () =>
      typeof window === "undefined"
        ? []
        : getDb().workouts.orderBy("startedAt").reverse().toArray(),
    [],
    [],
  );

  const [activeMuscle, setActiveMuscle] = useState<MuscleGroup | null>(null);

  const stats = useMemo(() => computeStats(workouts ?? []), [workouts]);
  const intensity = useMemo(() => computeMuscleIntensity(workouts ?? []), [workouts]);
  const hasData = Object.values(intensity).some((v) => v > 0);

  const todayKey = Math.floor(Date.now() / 86_400_000);

  const welcomeMessage = useMemo(() => {
    if (!workouts?.length) {
      return "Ready to start your fitness journey?";
    }

    const workoutStats = computeStats(workouts);

    if (workoutStats.streak >= 30) return "30+ day streak. You're on fire.";
    if (workoutStats.streak >= 7) return "A full week of consistency. Keep it going.";
    if (workoutStats.total >= 100) return "100 workouts completed. Huge achievement.";

    return MOTIVATIONAL_MESSAGES[todayKey % MOTIVATIONAL_MESSAGES.length];
  }, [workouts, todayKey]);

  const topMuscle = useMemo(() => {
    const entries = Object.entries(intensity);
    if (!entries.length) return null;

    return (
      activeMuscle ||
      entries.sort((a, b) => b[1] - a[1])[0]?.[0] ||
      null
    );
  }, [intensity, activeMuscle]);

  return (
    <div className="flex flex-col gap-6 px-4 pt-6">
      {/* HEADER */}
      <header className="grid grid-cols-[auto_minmax(0,1fr)] items-center gap-4">
        <div className="grid h-16 w-16 place-items-center rounded-full text-2xl font-bold bg-primary text-primary-foreground">
          🏋️
        </div>

        <div className="min-w-0">
          <h1 className="truncate text-2xl font-bold tracking-tight">
            Welcome Back, Champ
          </h1>
          <p className="truncate text-sm text-muted-foreground">
            {welcomeMessage}
          </p>
        </div>
      </header>

      {/* STATS */}
      <section className="grid grid-cols-2 gap-3">
        <StatCard icon={<Dumbbell className="h-4 w-4" />} label="Workouts" value={stats.total.toString()} />
        <StatCard icon={<Flame className="h-4 w-4" />} label="Streak" value={`${stats.streak} days`} />
        <StatCard icon={<Trophy className="h-4 w-4" />} label="Volume" value={Math.round(stats.totalVolume).toLocaleString()} />
        <StatCard icon={<Calendar className="h-4 w-4" />} label="This week" value={stats.thisWeek.toString()} />
      </section>

      {/* MUSCLE DISTRIBUTION */}
      <section className="rounded-2xl bg-card p-5 border border-border/50 shadow-sm">
        {/* HEADER */}
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-base font-semibold">Muscle Distribution</h2>
            <p className="text-xs text-muted-foreground">Last 30 days</p>
          </div>

          {topMuscle && (
            <div className="text-right">
              <p className="text-[10px] text-muted-foreground">Focused</p>
              <p className="text-xs font-semibold">{topMuscle}</p>
            </div>
          )}
        </div>

        {/* MAP */}
        <div
          className={`rounded-xl p-3 mb-5 transition-all duration-300 ${
            activeMuscle ? "bg-primary/10" : "bg-secondary/20"
          }`}
        >
          <MuscleMap intensity={intensity} className="w-full max-h-72" />
        </div>

        {/* BARS */}
        <div className="space-y-3">
          {MUSCLE_GROUPS.filter(
            (m) => m !== "Cardio" && (intensity[m] ?? 0) > 0,
          )
            .sort((a, b) => (intensity[b] ?? 0) - (intensity[a] ?? 0))
            .slice(0, 6)
            .map((m) => {
              const value = Math.round((intensity[m] ?? 0) * 100);
              const isActive = activeMuscle === m;
              const isDimmed = activeMuscle && !isActive;

              return (
                <div
                  key={m}
                  onMouseEnter={() => setActiveMuscle(m)}
                  onMouseLeave={() => setActiveMuscle(null)}
                  className={`transition-opacity duration-200 ${
                    isDimmed ? "opacity-40" : "opacity-100"
                  }`}
                >
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-muted-foreground">{m}</span>
                    <span className="font-semibold tabular-nums">{value}%</span>
                  </div>

                  <div className="h-2 w-full rounded-full bg-secondary overflow-hidden">
                    <div
                      className={`h-full transition-all duration-300 ${
                        isActive
                          ? "bg-primary"
                          : "bg-gradient-to-r from-primary to-primary/60"
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
          <span>Less</span>
          <div className="h-1 flex-1 mx-2 rounded-full bg-gradient-to-r from-muted to-primary/60" />
          <span>More</span>
        </div>
      </section>
    </div>
  );
}

/* ========================= */
/* UI COMPONENTS */
/* ========================= */

function StatCard({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
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

/* ========================= */
/* LOGIC */
/* ========================= */

function computeStats(workouts: Workout[]) {
  const total = workouts.length;

  const totalVolume = workouts.reduce(
    (acc, w) =>
      acc +
      w.exercises.reduce(
        (a, e) =>
          a +
          e.sets
            .filter((s) => s.completed)
            .reduce((x, s) => x + s.weight * s.reps, 0),
        0,
      ),
    0,
  );

  const weekAgo = Date.now() - 7 * 86400_000;

  const thisWeek = workouts.filter((w) => w.startedAt >= weekAgo).length;

  const days = new Set(
    workouts.map((w) => {
      const d = new Date(w.startedAt);
      d.setHours(0, 0, 0, 0);
      return d.getTime();
    }),
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
  const cutoff = Date.now() - 30 * 86400_000;

  const raw: Partial<Record<MuscleGroup, number>> = {};

  for (const w of workouts) {
    if (w.startedAt < cutoff) continue;

    for (const ex of w.exercises) {
      const def = getExercise(ex.exerciseId);
      if (!def) continue;

      const completed = ex.sets.filter((s) => s.completed).length;
      if (!completed) continue;

      raw[def.muscle] = (raw[def.muscle] ?? 0) + completed;

      for (const sec of def.secondary ?? []) {
        raw[sec] = (raw[sec] ?? 0) + completed * 0.5;
      }
    }
  }

  const max = Math.max(0, ...Object.values(raw));
  if (!max) return {};

  const out: Partial<Record<MuscleGroup, number>> = {};

  for (const [k, v] of Object.entries(raw)) {
    out[k as MuscleGroup] = (v ?? 0) / max;
  }

  return out;
}
