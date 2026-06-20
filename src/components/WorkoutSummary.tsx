import type { Workout } from "@/lib/db";
import { computeIntensity } from "@/lib/muscles";
import { MuscleMap } from "@/components/MuscleMap";

interface Props {
  name?: string;
  durationSec: number;
  exercises: Workout["exercises"];
  showName?: boolean;
}

function fmt(sec: number) {
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  return h > 0
    ? `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`
    : `${m}:${String(s).padStart(2, "0")}`;
}

export function WorkoutSummary({ name, durationSec, exercises, showName }: Props) {
  const intensity = computeIntensity(exercises);
  const totalSets = exercises.reduce(
    (a, e) => a + e.sets.filter((s) => s.completed).length,
    0,
  );
  const totalVolume = exercises.reduce(
    (a, e) =>
      a +
      e.sets
        .filter((s) => s.completed)
        .reduce((x, s) => x + (s.weight ?? 0) * (s.reps ?? 0), 0),
    0,
  );

  return (
    <div className="flex flex-col gap-3 rounded-xl bg-card p-3">
      {showName && name && <h2 className="text-lg font-bold">{name}</h2>}
      <div className="grid grid-cols-3 gap-2 text-center">
        <div>
          <p className="text-xs text-muted-foreground">Duration</p>
          <p className="font-bold">{fmt(durationSec)}</p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">Sets</p>
          <p className="font-bold">{totalSets}</p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">Volume</p>
          <p className="font-bold">{Math.round(totalVolume)} kg</p>
        </div>
      </div>
      <MuscleMap intensity={intensity} />
    </div>
  );
}
