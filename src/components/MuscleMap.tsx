import type { MuscleGroup } from "@/lib/exercises";

/**
 * Stylized front/back silhouette. Each muscle region's fill opacity scales
 * with usage intensity (0..1). Darker = more sets logged for that muscle.
 */
export function MuscleMap({
  intensity,
  className,
}: {
  /** muscle → intensity 0..1 */
  intensity: Partial<Record<MuscleGroup, number>>;
  className?: string;
}) {
  const c = (m: MuscleGroup) => {
    const v = Math.max(0, Math.min(1, intensity[m] ?? 0));
    // Map 0..1 into oklch lightness from base muted to vivid primary
    const alpha = 0.12 + v * 0.85;
    return `color-mix(in oklab, var(--color-primary) ${Math.round(alpha * 100)}%, var(--color-muted) ${Math.round((1 - alpha) * 100)}%)`;
  };
  const stroke = "var(--color-border)";

  return (
    <svg
      viewBox="0 0 360 260"
      className={className}
      xmlns="http://www.w3.org/2000/svg"
      aria-label="Muscle activation map"
    >
      {/* ============ FRONT ============ */}
      <g transform="translate(20,10)">
        <text x="70" y="10" textAnchor="middle" fontSize="9" fill="var(--color-muted-foreground)">
          Front
        </text>
        {/* head */}
        <ellipse cx="70" cy="30" rx="13" ry="15" fill="var(--color-muted)" stroke={stroke} />
        {/* neck */}
        <rect x="63" y="42" width="14" height="8" fill="var(--color-muted)" stroke={stroke} />
        {/* torso silhouette */}
        <path
          d="M40,52 Q70,46 100,52 L106,110 Q103,140 96,160 L44,160 Q37,140 34,110 Z"
          fill="var(--color-muted)"
          stroke={stroke}
        />
        {/* shoulders (delts front) */}
        <ellipse cx="38" cy="58" rx="11" ry="9" fill={c("Shoulders")} stroke={stroke} />
        <ellipse cx="102" cy="58" rx="11" ry="9" fill={c("Shoulders")} stroke={stroke} />
        {/* chest L/R */}
        <path d="M44,60 Q57,55 68,60 L68,86 Q56,92 44,86 Z" fill={c("Chest")} stroke={stroke} />
        <path d="M72,60 Q83,55 96,60 L96,86 Q84,92 72,86 Z" fill={c("Chest")} stroke={stroke} />
        {/* abs */}
        <rect x="60" y="92" width="20" height="40" rx="4" fill={c("Abs")} stroke={stroke} />
        {/* obliques */}
        <path d="M46,92 L58,92 L56,134 L44,128 Z" fill={c("Obliques")} stroke={stroke} />
        <path d="M82,92 L94,92 L96,128 L84,134 Z" fill={c("Obliques")} stroke={stroke} />
        {/* biceps */}
        <ellipse cx="28" cy="82" rx="9" ry="18" fill={c("Biceps")} stroke={stroke} />
        <ellipse cx="112" cy="82" rx="9" ry="18" fill={c("Biceps")} stroke={stroke} />
        {/* forearms */}
        <ellipse cx="22" cy="116" rx="8" ry="16" fill={c("Forearms")} stroke={stroke} />
        <ellipse cx="118" cy="116" rx="8" ry="16" fill={c("Forearms")} stroke={stroke} />
        {/* quads */}
        <path d="M46,162 Q56,170 58,210 L46,235 Q40,200 42,170 Z" fill={c("Quads")} stroke={stroke} />
        <path d="M82,162 Q92,170 98,170 Q100,200 94,235 L82,210 Z" fill={c("Quads")} stroke={stroke} />
        {/* calves (front shin area, lighter) */}
        <ellipse cx="50" cy="245" rx="7" ry="10" fill={c("Calves")} stroke={stroke} />
        <ellipse cx="90" cy="245" rx="7" ry="10" fill={c("Calves")} stroke={stroke} />
      </g>

      {/* ============ BACK ============ */}
      <g transform="translate(200,10)">
        <text x="70" y="10" textAnchor="middle" fontSize="9" fill="var(--color-muted-foreground)">
          Back
        </text>
        <ellipse cx="70" cy="30" rx="13" ry="15" fill="var(--color-muted)" stroke={stroke} />
        <rect x="63" y="42" width="14" height="8" fill="var(--color-muted)" stroke={stroke} />
        <path
          d="M40,52 Q70,46 100,52 L106,110 Q103,140 96,160 L44,160 Q37,140 34,110 Z"
          fill="var(--color-muted)"
          stroke={stroke}
        />
        {/* rear delts */}
        <ellipse cx="38" cy="58" rx="11" ry="9" fill={c("Shoulders")} stroke={stroke} />
        <ellipse cx="102" cy="58" rx="11" ry="9" fill={c("Shoulders")} stroke={stroke} />
        {/* upper back / traps */}
        <path d="M55,52 Q70,48 85,52 L82,76 Q70,72 58,76 Z" fill={c("UpperBack")} stroke={stroke} />
        {/* lats */}
        <path d="M44,72 Q56,76 60,100 L52,118 Q42,108 40,86 Z" fill={c("Lats")} stroke={stroke} />
        <path d="M96,72 Q84,76 80,100 L88,118 Q98,108 100,86 Z" fill={c("Lats")} stroke={stroke} />
        {/* lower back */}
        <rect x="58" y="116" width="24" height="32" rx="4" fill={c("LowerBack")} stroke={stroke} />
        {/* triceps */}
        <ellipse cx="28" cy="82" rx="9" ry="18" fill={c("Triceps")} stroke={stroke} />
        <ellipse cx="112" cy="82" rx="9" ry="18" fill={c("Triceps")} stroke={stroke} />
        {/* forearms */}
        <ellipse cx="22" cy="116" rx="8" ry="16" fill={c("Forearms")} stroke={stroke} />
        <ellipse cx="118" cy="116" rx="8" ry="16" fill={c("Forearms")} stroke={stroke} />
        {/* glutes */}
        <path d="M44,160 Q58,156 68,160 L68,184 Q56,190 44,184 Z" fill={c("Glutes")} stroke={stroke} />
        <path d="M72,160 Q82,156 96,160 L96,184 Q84,190 72,184 Z" fill={c("Glutes")} stroke={stroke} />
        {/* hamstrings */}
        <path d="M46,188 Q58,192 58,220 L46,235 Q40,210 42,190 Z" fill={c("Hamstrings")} stroke={stroke} />
        <path d="M82,188 Q94,192 98,190 Q100,210 94,235 L82,220 Z" fill={c("Hamstrings")} stroke={stroke} />
        {/* calves */}
        <ellipse cx="50" cy="245" rx="7" ry="10" fill={c("Calves")} stroke={stroke} />
        <ellipse cx="90" cy="245" rx="7" ry="10" fill={c("Calves")} stroke={stroke} />
      </g>
    </svg>
  );
}
