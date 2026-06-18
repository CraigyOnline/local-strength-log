import { createFileRoute } from "@tanstack/react-router";
import { useLiveQuery } from "dexie-react-hooks";
import { useMemo, useState, type ReactNode } from "react";
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
      {
        name: "description",
        content: "Your workout stats, streak and history.",
      },
    ],
  }),
  component: ProfilePage,
});

function ProfilePage() {
  const workouts = useLiveQuery(
    async () => {
      if (typeof window === "undefined") {
        return [];
      }

      return getDb()
        .workouts
        .orderBy("startedAt")
        .reverse()
        .toArray();
    },
    [],
    [],
  );

  const [selectedMuscle, setSelectedMuscle] =
    useState<MuscleGroup | null>(null);

  const [drilldownMuscle, setDrilldownMuscle] =
    useState<MuscleGroup | null>(null);

  const stats = useMemo(
    () => computeStats(workouts ?? []),
    [workouts],
  );

  const intensity = useMemo(
    () => computeMuscleIntensity(workouts ?? []),
    [workouts],
  );

  const todayKey = Math.floor(Date.now() / 86_400_000);

  const welcomeMessage = useMemo(() => {
    if (!workouts?.length) {
      return "Ready to start your fitness journey?";
    }

    if (stats.streak >= 30) {
      return "30+ day streak. You're on fire.";
    }

    if (stats.streak >= 7) {
      return "A full week of consistency. Keep it going.";
    }

    if (stats.total >= 100) {
      return "100 workouts completed. Huge achievement.";
    }

    return MOTIVATIONAL_MESSAGES[
      todayKey % MOTIVATIONAL_MESSAGES.length
    ];
  }, [workouts, stats, todayKey]);

  return (
    <div className="flex flex-col gap-6 px-4 pt-6">
      <header className="grid grid-cols-[auto_minmax(0,1fr)] items-center gap-4">
        <div className="grid h-16 w-16 place-items-center rounded-full bg-primary text-2xl font-bold text-primary-foreground">
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
          value={`${stats.streak} days`}
        />

        <StatCard
          icon={<Trophy className="h-4 w-4" />}
          label="Volume"
          value={Math.round(stats.totalVolume).toLocaleString()}
        />

        <StatCard
          icon={<Calendar className="h-4 w-4" />}
          label="This week"
          value={stats.thisWeek.toString()}
        />
      </section>

      <section className="rounded-2xl border border-border/50 bg-card p-5 shadow-sm">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h2 className="text-base font-semibold">
              Muscle Distribution
            </h2>

            <p className="text-xs text-muted-foreground">
              Tap to select • Long press for details
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

        <div
          className={`mb-5 rounded-xl p-3 transition-all duration-300 ${
            selectedMuscle
              ? "bg-primary/10"
              : "bg-secondary/20"
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
            (m) => m !== "Cardio" && (intensity[m] ?? 0) > 0,
          )
            .sort(
              (a, b) =>
                (intensity[b] ?? 0) -
                (intensity[a] ?? 0),
            )
            .slice(0, 7)
            .map((m) => {
              const value = Math.round(
                (intensity[m] ?? 0) * 100,
              );

              const isSelected =
                selectedMuscle === m;

              const isDimmed =
                selectedMuscle && !isSelected;

              return (
                <div
                  key={m}
                  className={`transition-opacity duration-200 ${
                    isDimmed
                      ? "opacity-30"
                      : "opacity-100"
                  }`}
                  onClick={() =>
                    setSelectedMuscle((prev) =>
                      prev === m ? null : m,
                    )
                  }
                  onContextMenu={(e) => {
                    e.preventDefault();
                    setDrilldownMuscle(m);
                  }}
                >
                  <div className="mb-1 flex justify-between text-xs">
                    <span className="text-muted-foreground">
                      {m}
                    </span>

                    <span className="tabular-nums font-semibold">
                      {value}%
                    </span>
                  </div>

                  <div className="h-2 w-full overflow-hidden rounded-full bg-secondary">
                    <div
                      className={`h-full transition-all duration-300 ${
                        isSelected
                          ? "bg-primary"
                          : "bg-gradient-to-r from-primary to-primary/60"
                      }`}
                      style={{
                        width: `${value}%`,
                      }}
                    />
                  </div>
                </div>
              );
            })}
        </div>

        <div className="mt-4 flex items-center justify-between text-[10px] text-muted-foreground">
          <span>Less</span>

          <div className="mx-2 h-1 flex-1 rounded-full bg-gradient-to-r from-muted to-primary/60" />

          <span>More</span>
        </div>

        {drilldownMuscle && (
          <div className="fixed inset-0 z-50 flex items-end bg-black/40">
            <div className="w-full rounded-t-2xl bg-card p-5">
              <div className="mb-3 flex items-center justify-between">
                <h3 className="text-base font-semibold">
                  {drilldownMuscle}
                </h3>

                <button
                  onClick={() =>
                    setDrilldownMuscle(null)
                  }
                  className="text-sm text-muted-foreground"
                >
                  Close
                </button>
              </div>

              <div className="mb-4 grid grid-cols-2 gap-3">
                <div className="rounded-xl bg-secondary/30 p-3">
                  <p className="text-xs text-muted-foreground">
                    Intensity
                  </p>

                  <p className="text-lg font-bold">
                    {Math.round(
                      (intensity[
                        drilldownMuscle
                      ] ?? 0) * 100,
                    )}
                    %
                  </p>
                </div>

                <div className="rounded-xl bg-secondary/30 p-3">
                  <p className="text-xs text-muted-foreground">
                    Status
                  </p>

                  <p className="text-lg font-bold">
                    {selectedMuscle ===
                    drilldownMuscle
                      ? "Focused"
                      : "Overview"}
                  </p>
                </div>
              </div>

              <button
                onClick={() => {
                  setSelectedMuscle(
                    drilldownMuscle,
                  );
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
    </div>
  );
}

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

      <p className="mt-1 text-2xl font-bold">
        {value}
      </p>
    </div>
  );
}

/* keep your existing computeStats and computeMuscleIntensity functions unchanged */
