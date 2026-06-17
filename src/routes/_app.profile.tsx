import { createFileRoute } from "@tanstack/react-router";
import { useLiveQuery } from "dexie-react-hooks";
import { useMemo } from "react";
import { getDb } from "@/lib/db";
import { getExercise, MUSCLE_GROUPS, type MuscleGroup } from "@/lib/exercises";
import { Flame, Dumbbell, Calendar, Trophy } from "lucide-react";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Cell,
} from "recharts";

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
    () => (typeof window === "undefined" ? [] : getDb().workouts.orderBy("startedAt").reverse().toArray()),
    [],
    [],
  );

  const stats = useMemo(() => computeStats(workouts ?? []), [workouts]);
  const muscleData = useMemo(() => computeMuscleVolume(workouts ?? []), [workouts]);

  return (
    <div className="flex flex-col gap-6 px-4 pt-6">
      <header className="flex items-center gap-4">
        <div
          className="flex h-16 w-16 items-center justify-center rounded-full text-2xl font-bold"
          style={{ background: "var(--color-primary)", color: "var(--color-primary-foreground)" }}
        >
          🏋️
        </div>
        <div>
          <h1 className="text-2xl font-bold">Athlete</h1>
          <p className="text-sm text-muted-foreground">Keep pushing your limits</p>
        </div>
      </header>

      <section className="grid grid-cols-2 gap-3">
        <StatCard icon={<Dumbbell className="h-4 w-4" />} label="Workouts" value={stats.total.toString()} />
        <StatCard icon={<Flame className="h-4 w-4" />} label="Streak" value={`${stats.streak} ${stats.streak === 1 ? "day" : "days"}`} />
        <StatCard icon={<Trophy className="h-4 w-4" />} label="Volume (kg)" value={Math.round(stats.totalVolume).toLocaleString()} />
        <StatCard icon={<Calendar className="h-4 w-4" />} label="This week" value={stats.thisWeek.toString()} />
      </section>

      <section className="rounded-2xl bg-card p-4">
        <h2 className="mb-3 text-base font-semibold">Volume by muscle group</h2>
        {muscleData.every((d) => d.volume === 0) ? (
          <p className="py-8 text-center text-sm text-muted-foreground">
            Complete a workout to see your distribution.
          </p>
        ) : (
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={muscleData} margin={{ top: 8, right: 8, bottom: 0, left: -20 }}>
                <XAxis
                  dataKey="muscle"
                  stroke="var(--color-muted-foreground)"
                  fontSize={10}
                  tickLine={false}
                  axisLine={false}
                  interval={0}
                  angle={-35}
                  textAnchor="end"
                  height={50}
                />
                <YAxis stroke="var(--color-muted-foreground)" fontSize={10} tickLine={false} axisLine={false} />
                <Tooltip
                  cursor={{ fill: "var(--color-muted)" }}
                  contentStyle={{
                    background: "var(--color-popover)",
                    border: "1px solid var(--color-border)",
                    borderRadius: 12,
                    fontSize: 12,
                  }}
                />
                <Bar dataKey="volume" radius={[6, 6, 0, 0]}>
                  {muscleData.map((_, i) => (
                    <Cell key={i} fill={`var(--color-chart-${(i % 5) + 1})`} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
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
              <li key={w.id} className="rounded-2xl bg-card p-4">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="font-semibold">{w.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {new Date(w.startedAt).toLocaleDateString(undefined, {
                        weekday: "short", month: "short", day: "numeric",
                      })}
                      {" · "}
                      {formatDuration(w.durationSec)}
                    </p>
                  </div>
                  <span className="rounded-full bg-secondary px-2 py-1 text-xs font-medium">
                    {w.exercises.reduce((acc, e) => acc + e.sets.filter((s) => s.completed).length, 0)} sets
                  </span>
                </div>
                <div className="mt-2 flex flex-wrap gap-1">
                  {w.exercises.slice(0, 4).map((e, i) => (
                    <span key={i} className="rounded-md bg-secondary px-2 py-0.5 text-xs text-muted-foreground">
                      {getExercise(e.exerciseId)?.name ?? e.exerciseId}
                    </span>
                  ))}
                  {w.exercises.length > 4 && (
                    <span className="text-xs text-muted-foreground">+{w.exercises.length - 4} more</span>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function StatCard({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
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

function formatDuration(sec: number) {
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

import type { Workout } from "@/lib/db";

function computeStats(workouts: Workout[]) {
  const total = workouts.length;
  const totalVolume = workouts.reduce(
    (acc, w) =>
      acc +
      w.exercises.reduce(
        (a, e) => a + e.sets.filter((s) => s.completed).reduce((x, s) => x + s.weight * s.reps, 0),
        0,
      ),
    0,
  );
  const weekAgo = Date.now() - 7 * 86400_000;
  const thisWeek = workouts.filter((w) => w.startedAt >= weekAgo).length;

  // Streak (consecutive days with at least one workout, ending today or yesterday)
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
  if (!days.has(cursor.getTime())) cursor.setDate(cursor.getDate() - 1);
  while (days.has(cursor.getTime())) {
    streak++;
    cursor.setDate(cursor.getDate() - 1);
  }
  return { total, totalVolume, thisWeek, streak };
}

function computeMuscleVolume(workouts: Workout[]) {
  const map = new Map<MuscleGroup, number>();
  MUSCLE_GROUPS.forEach((m) => map.set(m, 0));
  for (const w of workouts) {
    for (const e of w.exercises) {
      const def = getExercise(e.exerciseId);
      if (!def) continue;
      const vol = e.sets.filter((s) => s.completed).reduce((a, s) => a + s.weight * s.reps, 0);
      map.set(def.muscle, (map.get(def.muscle) ?? 0) + vol);
    }
  }
  return Array.from(map.entries()).map(([muscle, volume]) => ({ muscle, volume: Math.round(volume) }));
}
