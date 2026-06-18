```tsx
import { createFileRoute, Link } from "@tanstack/react-router";
import { useLiveQuery } from "dexie-react-hooks";
import { useMemo } from "react";
import { getDb, type Workout } from "@/lib/db";
import { getExercise, MUSCLE_GROUPS, type MuscleGroup } from "@/lib/exercises";
import { Flame, Dumbbell, Calendar, Trophy, ChevronRight } from "lucide-react";
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

  const stats = useMemo(() => computeStats(workouts ?? []), [workouts]);
  const intensity = useMemo(() => computeMuscleIntensity(workouts ?? []), [workouts]);
  const hasData = Object.values(intensity).some((v) => v > 0);

  const welcomeMessage = useMemo(() => {
    if (!workouts?.length) {
      return "Ready to start your fitness journey?";
    }

    const workoutStats = computeStats(workouts);

    if (workoutStats.streak >= 30) {
      return "30+ day streak. You're on fire.";
    }

    if (workoutStats.streak >= 7) {
      return "A full week of consistency. Keep it going.";
    }

    if (workoutStats.total >= 100) {
      return "100 workouts completed. Huge achievement.";
    }

    const dayIndex =
      Math.floor(Date.now() / 86_400_000) %
      MOTIVATIONAL_MESSAGES.length;

    return MOTIVATIONAL_MESSAGES[dayIndex];
  }, [workouts]);

  return (
    <div className="flex flex-col gap-6 px-4 pt-6">
      <header className="grid grid-cols-[auto_minmax(0,1fr)] items-center gap-4">
        <div
          className="grid h-16 w-16 shrink-0 place-items-center rounded-full text-2xl font-bold"
          style={{
            background: "var(--color-primary)",
            color: "var(--color-primary-foreground)",
          }}
        >
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

      <section className="grid grid-cols-2 gap-3">
        <StatCard
          icon={<Dumbbell className="h-4 w-4" />}
          label="Workouts"
          value={stats.total.toString()}
        />

        <StatCard
          icon={<Flame className="h-4 w-4" />}
          label="Streak"
          value={`${stats.streak} ${stats.streak === 1 ? "day" : "days"}`}
        />

        <StatCard
          icon={<Trophy className="h-4 w-4" />}
          label="Volume (kg)"
          value={Math.round(stats.totalVolume).toLocaleString()}
        />

        <StatCard
          icon={<Calendar className="h-4 w-4" />}
          label="This week"
          value={stats.thisWeek.toString()}
        />
      </section>

      <section className="rounded-2xl bg-card p-4">
        <div className="mb-3 flex items-baseline justify-between gap-2">
          <h2 className="text-base font-semibold">Muscles worked</h2>
          <p className="text-xs text-muted-foreground">Last 30 days</p>
        </div>

        {!hasData ? (
          <p className="py-8 text-center text-sm text-muted-foreground">
            Complete a workout to light up your muscles.
          </p>
        ) : (
          <>
            <MuscleMap intensity={intensity} className="w-full max-h-72" />

            <div className="mt-3 flex items-center justify-between text-[10px] text-muted-foreground">
              <span>Less</span>

              <div
                className="mx-2 h-2 flex-1 rounded-full"
                style={{
                  background:
                    "linear-gradient(to right, var(--color-muted), var(--color-primary))",
                }}
              />

              <span>More</span>
            </div>

            <ul className="mt-3 grid grid-cols-2 gap-x-3 gap-y-1 text-xs">
              {MUSCLE_GROUPS.filter(
                (m) => m !== "Cardio" && (intensity[m] ?? 0) > 0,
              )
                .sort(
                  (a, b) =>
                    (intensity[b] ?? 0) - (intensity[a] ?? 0),
                )
                .slice(0, 6)
                .map((m) => (
                  <li
                    key={m}
                    className="flex items-center justify-between"
                  >
                    <span className="text-muted-foreground">{m}</span>
                    <span className="font-semibold tabular-nums">
                      {Math.round((intensity[m] ?? 0) * 100)}%
                    </span>
                  </li>
                ))}
            </ul>
          </>
        )}
      </section>

      <section>
        <h2 className="mb-3 text-base font-semibold">History</h2>

        {(workouts ?? []).length === 0 ? (
          <div className="rounded-2xl bg-card p-6 text-center text-sm text-muted-foreground">
            No workouts yet. Tap the Workout tab to start your first session.
          </div>
        ) : (
          <ul className="flex flex-col gap-2">
            {(workouts ?? []).map((w) => (
              <li key={w.id}>
                <Link
                  to="/history/$id"
                  params={{ id: String(w.id) }}
                  className="block rounded-2xl bg-card p-4 transition-colors hover:bg-secondary/40"
                >
                  <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-2">
                    <div className="min-w-0">
                      <p className="truncate font-semibold">{w.name}</p>

                      <p className="truncate text-xs text-muted-foreground">
                        {new Date(w.startedAt).toLocaleDateString(undefined, {
                          weekday: "short",
                          month: "short",
                          day: "numeric",
                        })}
                        {" · "}
                        {formatDuration(w.durationSec)}
                      </p>
                    </div>

                    <div className="flex shrink-0 items-center gap-1">
                      <span className="rounded-full bg-secondary px-2 py-1 text-xs font-medium">
                        {w.exercises.reduce(
                          (acc, e) =>
                            acc +
                            e.sets.filter((s) => s.completed).length,
                          0,
                        )}{" "}
                        sets
                      </span>

                      <ChevronRight className="h-4 w-4 text-muted-foreground" />
                    </div>
                  </div>

                  <div className="mt-2 flex flex-wrap gap-1">
                    {w.exercises.slice(0, 4).map((e, i) => (
                      <span
                        key={i}
                        className="rounded-md bg-secondary px-2 py-0.5 text-xs text-muted-foreground"
                      >
                        {getExercise(e.exerciseId)?.name ?? e.exerciseId}
                      </span>
                    ))}

                    {w.exercises.length > 4 && (
                      <span className="text-xs text-muted-foreground">
                        +{w.exercises.length - 4} more
                      </span>
                    )}
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

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
    <div className="min-w-0 rounded-2xl bg-card p-4">
      <div className="flex items-center gap-2 text-muted-foreground">
        {icon}
        <span className="truncate text-xs">{label}</span>
      </div>

      <p className="mt-1 truncate text-2xl font-bold">{value}</p>
    </div>
  );
}

function formatDuration(sec: number) {
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);

  if (h > 0) return `${h}h ${m}m`;

  return `${m}m`;
}

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

  const thisWeek = workouts.filter(
    (w) => w.startedAt >= weekAgo,
  ).length;

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

/**
 * Intensity per muscle group from the past 30 days. Counts each completed set
 * once for the primary muscle (1.0) and 0.5 for secondary muscles, normalized
 * by the most-used muscle.
 */
function computeMuscleIntensity(
  workouts: Workout[],
): Partial<Record<MuscleGroup, number>> {
  const cutoff = Date.now() - 30 * 86400_000;

  const raw: Partial<Record<MuscleGroup, number>> = {};

  for (const w of workouts) {
    if (w.startedAt < cutoff) continue;

    for (const ex of w.exercises) {
      const def = getExercise(ex.exerciseId);

      if (!def) continue;

      const completed = ex.sets.filter((s) => s.completed).length;

      if (completed === 0) continue;

      raw[def.muscle] = (raw[def.muscle] ?? 0) + completed;

      for (const sec of def.secondary ?? []) {
        raw[sec] = (raw[sec] ?? 0) + completed * 0.5;
      }
    }
  }

  const max = Math.max(0, ...Object.values(raw));

  if (max === 0) return {};

  const out: Partial<Record<MuscleGroup, number>> = {};

  for (const [k, v] of Object.entries(raw)) {
    out[k as MuscleGroup] = (v ?? 0) / max;
  }

  return out;
}
