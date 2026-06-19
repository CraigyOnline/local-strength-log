import { Link, useLocation } from "@tanstack/react-router";
import { User, ListChecks, Play, History } from "lucide-react";

const tabs = [
  { to: "/profile", label: "Profile", Icon: User },
  { to: "/routines", label: "Routines", Icon: ListChecks },
  { to: "/workout", label: "Workout", Icon: Play },
  { to: "/history", label: "History", Icon: History },
] as const;

export function BottomTabs() {
  const { pathname } = useLocation();
  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 border-t border-border bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/80">
      <ul className="mx-auto grid max-w-md grid-cols-3 pb-[env(safe-area-inset-bottom)]">
        {tabs.map(({ to, label, Icon }) => {
          const active = pathname.startsWith(to);
          return (
            <li key={to}>
              <Link
                to={to}
                className="flex flex-col items-center gap-1 py-3 text-xs transition-colors"
                style={{ color: active ? "var(--color-primary)" : "var(--color-muted-foreground)" }}
              >
                <Icon className="h-5 w-5" strokeWidth={active ? 2.5 : 2} />
                <span className={active ? "font-semibold" : ""}>{label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
