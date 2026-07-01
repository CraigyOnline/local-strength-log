import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

// ─────────────────────────────────────────────────────────────────────────────
// NumberInput
//
// A controlled numeric input with:
//   - temporary empty editing state (type to clear, blur to commit)
//   - validate on blur (clamps to min/max, falls back to 0)
//   - select-all on focus (Android-friendly, no re-type needed)
//   - Android numeric keyboard (inputMode="decimal" or "numeric")
//   - decimal support via the `decimal` prop
//   - optional min/max clamping
//   - syncs to external `value` prop when it changes while not focused
//
// Usage:
//   <NumberInput value={kg} onCommit={setKg} decimal min={0} />
// ─────────────────────────────────────────────────────────────────────────────

export interface NumberInputProps {
  value: number;
  onCommit: (value: number) => void;
  decimal?: boolean;
  min?: number;
  max?: number;
  placeholder?: string;
  className?: string;
  /** aria-label for accessibility */
  label?: string;
}

export function NumberInput({
  value,
  onCommit,
  decimal = false,
  min,
  max,
  placeholder = "0",
  className,
  label,
}: NumberInputProps) {
  const [str, setStr] = useState<string>(formatValue(value, decimal));
  const focused = useRef(false);

  // Sync external value changes only when the field is not actively being edited
  useEffect(() => {
    if (!focused.current) {
      setStr(formatValue(value, decimal));
    }
  }, [value, decimal]);

  const pattern = decimal ? /^\d*\.?\d*$/ : /^\d*$/;

  function clamp(n: number): number {
    let v = n;
    if (min !== undefined) v = Math.max(min, v);
    if (max !== undefined) v = Math.min(max, v);
    return v;
  }

  function parse(s: string): number | null {
    const n = decimal ? parseFloat(s) : parseInt(s, 10);
    return Number.isFinite(n) ? n : null;
  }

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const v = e.target.value;
    if (!pattern.test(v)) return;
    setStr(v);
    const n = parse(v);
    if (n !== null) onCommit(clamp(n));
  }

  function handleBlur() {
    focused.current = false;
    const n = parse(str);
    const committed = n !== null ? clamp(n) : (min ?? 0);
    setStr(formatValue(committed, decimal));
    onCommit(committed);
  }

  function handleFocus(e: React.FocusEvent<HTMLInputElement>) {
    focused.current = true;
    e.target.select();
  }

  return (
    <input
      type="text"
      inputMode={decimal ? "decimal" : "numeric"}
      value={str}
      placeholder={placeholder}
      aria-label={label}
      onChange={handleChange}
      onBlur={handleBlur}
      onFocus={handleFocus}
      className={cn(
        "bg-transparent text-center text-sm outline-none",
        className,
      )}
    />
  );
}

function formatValue(value: number, decimal: boolean): string {
  if (!Number.isFinite(value)) return "0";
  return decimal ? String(value) : String(Math.round(value));
}

// ─────────────────────────────────────────────────────────────────────────────
// StepperInput
//
// Wraps NumberInput with −/+ buttons and the rounded-stepper chrome used
// throughout the app. The step and button sizing are configurable.
//
// Usage:
//   <StepperInput value={reps} onCommit={setReps} step={1} min={0} />
//   <StepperInput value={kg}   onCommit={setKg}   step={2.5} min={0} decimal size="sm" />
// ─────────────────────────────────────────────────────────────────────────────

export interface StepperInputProps extends NumberInputProps {
  step?: number;
  /** sm = compact (h-8 w-7 buttons), md = standard (h-9 w-8 buttons) */
  size?: "sm" | "md";
}

export function StepperInput({
  value,
  onCommit,
  step = 1,
  decimal = false,
  min,
  max,
  placeholder,
  className,
  label,
  size = "md",
}: StepperInputProps) {
  const btnClass = size === "sm"
    ? "w-7 h-full text-sm shrink-0"
    : "w-8 h-full shrink-0";
  const height = size === "sm" ? "h-8" : "h-9";

  function decrement() {
    const next = value - step;
    const clamped = min !== undefined ? Math.max(min, next) : next;
    onCommit(Number(decimal ? clamped.toFixed(1) : clamped));
  }

  function increment() {
    const next = value + step;
    const clamped = max !== undefined ? Math.min(max, next) : next;
    onCommit(Number(decimal ? clamped.toFixed(1) : clamped));
  }

  return (
    <div
      className={cn(
        "flex items-center bg-secondary rounded-lg overflow-hidden border",
        height,
        className,
      )}
    >
      <button type="button" onClick={decrement} className={btnClass}>
        −
      </button>
      <NumberInput
        value={value}
        onCommit={onCommit}
        decimal={decimal}
        min={min}
        max={max}
        placeholder={placeholder}
        label={label}
        className="w-12"
      />
      <button type="button" onClick={increment} className={btnClass}>
        +
      </button>
    </div>
  );
}
