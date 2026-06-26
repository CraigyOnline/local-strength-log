import { createFileRoute, Outlet, useLocation } from "@tanstack/react-router";

export const Route = createFileRoute("/_app/history")({
  component: HistoryLayout,
});

/**
 * Fix #1: The history list has been moved to _app.history.index.tsx.
 * This layout file simply renders the child route (list or detail).
 * Previously the list was inline here with a fragile pathname check.
 */
function HistoryLayout() {
  return <Outlet />;
}
