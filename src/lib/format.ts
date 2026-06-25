/**
 * Shared formatting utilities — avoids the duplicate fmt() definitions
 * that existed in _app.history.$id.tsx and _app.workout.tsx
 */

/** Format seconds as M:SS or H:MM:SS */
export function formatDuration(sec: number): string {
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  if (h > 0) {
    return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  }
  return `${m}:${String(s).padStart(2, "0")}`;
}

/** Format seconds as M:SS (alias kept for timer displays) */
export function formatTime(sec: number): string {
  return formatDuration(sec);
}
