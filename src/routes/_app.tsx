import { createFileRoute, Outlet } from "@tanstack/react-router";
import { BottomTabs } from "@/components/BottomTabs";

export const Route = createFileRoute("/_app")({
  component: AppLayout,
});

function AppLayout() {
  return (
    <div className="mx-auto flex min-h-screen max-w-md flex-col bg-background pb-24">
      <Outlet />
      <BottomTabs />
    </div>
  );
}
