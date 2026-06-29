import { createFileRoute } from "@tanstack/react-router";
import { useLiveQuery } from "dexie-react-hooks";
import { useRef, useState } from "react";
import { toast } from "sonner";
import { getDb, type Routine, type Workout, type PRRecord } from "@/lib/db";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Download, Upload, Info, FileText, Settings as SettingsIcon } from "lucide-react";

const APP_VERSION = "1.0.0";
const SCHEMA_VERSION = 1;

export const Route = createFileRoute("/_app/settings")({
  head: () => ({
    meta: [
      { title: "Settings · Untrained Effort" },
      { name: "description", content: "App settings, backup, restore and licenses." },
    ],
  }),
  component: SettingsPage,
});

interface BackupPayload {
  schemaVersion: number;
  exportedAt: number;
  routines: Routine[];
  workouts: Workout[];
  prHistory: PRRecord[];
}

function isBackupPayload(x: unknown): x is BackupPayload {
  if (!x || typeof x !== "object") return false;
  const o = x as Record<string, unknown>;
  return (
    typeof o.schemaVersion === "number" &&
    Array.isArray(o.routines) &&
    Array.isArray(o.workouts) &&
    Array.isArray(o.prHistory)
  );
}

function SettingsPage() {
  const fileRef = useRef<HTMLInputElement>(null);
  const [pendingReplace, setPendingReplace] = useState<BackupPayload | null>(null);
  const [importMode, setImportMode] = useState<"merge" | "replace">("merge");

  const workoutCount = useLiveQuery(async () => {
    if (typeof window === "undefined") return 0;
    return getDb().workouts.count();
  }, []);

  const routineCount = useLiveQuery(async () => {
    if (typeof window === "undefined") return 0;
    return getDb().routines.count();
  }, []);

  async function handleExport() {
    try {
      const db = getDb();
      const [routines, workouts, prHistory] = await Promise.all([
        db.routines.toArray(),
        db.workouts.toArray(),
        db.prHistory.toArray(),
      ]);

      const payload: BackupPayload = {
        schemaVersion: SCHEMA_VERSION,
        exportedAt: Date.now(),
        routines,
        workouts,
        prHistory,
      };

      const stamp = new Date().toISOString().replace(/[:.]/g, "-");
      const filename = `untrained-effort-backup-${stamp}.json`;
      const json = JSON.stringify(payload, null, 2);
      const blob = new Blob([json], { type: "application/json" });

      // Use the native share sheet on Android/iOS (Web Share API level 2).
      // This opens the system chooser so the user can save to Files, Drive,
      // send via email, etc. Falls back to the anchor-download method for
      // desktop browsers that don't support navigator.share with files.
      if (
        typeof navigator.share === "function" &&
        typeof navigator.canShare === "function" &&
        navigator.canShare({ files: [new File([blob], filename, { type: "application/json" })] })
      ) {
        const file = new File([blob], filename, { type: "application/json" });
        await navigator.share({ files: [file], title: filename });
        toast.success("Backup ready to save", { duration: 4000 });
      } else {
        // Desktop fallback: anchor download
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(url);
        toast.success("Backup downloaded", { duration: 4000 });
      }
    } catch (err) {
      // navigator.share throws AbortError if the user cancels — that is not an error.
      if (err instanceof Error && err.name === "AbortError") return;
      console.error(err);
      toast.error("Export failed", { duration: 4000 });
    }
  }

  function triggerImport(mode: "merge" | "replace") {
    setImportMode(mode);
    fileRef.current?.click();
  }

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;

    try {
      const text = await file.text();
      const parsed = JSON.parse(text);
      if (!isBackupPayload(parsed)) {
        toast.error("Invalid backup file", { duration: 4000 });
        return;
      }
      if (parsed.schemaVersion !== SCHEMA_VERSION) {
        toast.error(`Unsupported schema version: ${parsed.schemaVersion}`, { duration: 4000 });
        return;
      }

      if (importMode === "replace") {
        setPendingReplace(parsed);
      } else {
        await mergeImport(parsed);
      }
    } catch (err) {
      console.error(err);
      toast.error("Could not read backup file", { duration: 4000 });
    }
  }

  async function mergeImport(payload: BackupPayload) {
    try {
      const db = getDb();
      await db.transaction("rw", db.routines, db.workouts, db.prHistory, async () => {
        for (const r of payload.routines) {
          const { id: _id, ...rest } = r;
          await db.routines.add(rest as Routine);
        }
        for (const w of payload.workouts) {
          const { id: _id, ...rest } = w;
          await db.workouts.add(rest as Workout);
        }
        for (const p of payload.prHistory) {
          const { id: _id, ...rest } = p;
          await db.prHistory.add(rest as PRRecord);
        }
      });
      toast.success(
        `Merged ${payload.routines.length} routines, ${payload.workouts.length} workouts`,
        { duration: 4000 }
      );
    } catch (err) {
      console.error(err);
      toast.error("Merge import failed", { duration: 4000 });
    }
  }

  async function replaceImport(payload: BackupPayload) {
    try {
      const db = getDb();
      await db.transaction("rw", db.routines, db.workouts, db.prHistory, async () => {
        await Promise.all([db.routines.clear(), db.workouts.clear(), db.prHistory.clear()]);
        await db.routines.bulkPut(payload.routines);
        await db.workouts.bulkPut(payload.workouts);
        await db.prHistory.bulkPut(payload.prHistory);
      });
      toast.success("Data replaced from backup", { duration: 4000 });
    } catch (err) {
      console.error(err);
      toast.error("Replace import failed", { duration: 4000 });
    } finally {
      setPendingReplace(null);
    }
  }

  return (
    <div className="flex flex-col gap-6 px-4 pt-6 pb-8">
      <header className="flex items-center gap-4">
        <div className="grid h-14 w-14 place-items-center rounded-2xl bg-primary/10 text-primary">
          <SettingsIcon className="h-6 w-6" />
        </div>
        <div className="min-w-0">
          <h1 className="truncate text-xl font-bold tracking-tight">Settings</h1>
          <p className="text-xs text-muted-foreground">App management & data ownership</p>
        </div>
      </header>

      {/* Backup & Restore */}
      <section className="rounded-2xl border border-border/50 bg-card p-5">
        <div className="mb-4 flex items-center gap-2">
          <Download className="h-4 w-4 text-primary" />
          <h2 className="text-base font-semibold">Backup & Restore</h2>
        </div>
        <p className="mb-4 text-xs text-muted-foreground">
          Export all your data to a JSON file, or restore from a previous backup.
        </p>

        <div className="flex flex-col gap-2">
          <button
            onClick={handleExport}
            className="flex items-center justify-center gap-2 rounded-xl bg-primary py-3 text-sm font-medium text-primary-foreground active:scale-[0.99]"
          >
            <Download className="h-4 w-4" />
            Export Backup
          </button>

          <button
            onClick={() => triggerImport("merge")}
            className="flex items-center justify-center gap-2 rounded-xl bg-secondary py-3 text-sm font-medium active:scale-[0.99]"
          >
            <Upload className="h-4 w-4" />
            Import & Merge
          </button>

          <button
            onClick={() => triggerImport("replace")}
            className="flex items-center justify-center gap-2 rounded-xl border border-destructive/50 bg-card py-3 text-sm font-medium text-destructive active:scale-[0.99]"
          >
            <Upload className="h-4 w-4" />
            Import & Replace All
          </button>

          <input
            ref={fileRef}
            type="file"
            accept="application/json,.json"
            className="hidden"
            onChange={handleFileChange}
          />
        </div>
      </section>

      {/* App Info */}
      <section className="rounded-2xl border border-border/50 bg-card p-5">
        <div className="mb-4 flex items-center gap-2">
          <Info className="h-4 w-4 text-primary" />
          <h2 className="text-base font-semibold">App Information</h2>
        </div>
        <dl className="space-y-2 text-sm">
          <Row label="App version" value={APP_VERSION} />
          <Row label="Schema version" value={String(SCHEMA_VERSION)} />
          <Row label="Total workouts" value={String(workoutCount ?? 0)} />
          <Row label="Total routines" value={String(routineCount ?? 0)} />
        </dl>
      </section>

      {/* Licenses */}
      <section className="rounded-2xl border border-border/50 bg-card p-5">
        <div className="mb-4 flex items-center gap-2">
          <FileText className="h-4 w-4 text-primary" />
          <h2 className="text-base font-semibold">Open Source Licenses</h2>
        </div>
        <div className="space-y-3 text-xs leading-relaxed text-muted-foreground">
          <p>
            Portions of this application use assets, logos, or icons from{" "}
            <a
              href="https://github.com/wger-project/wger"
              target="_blank"
              rel="noreferrer"
              className="text-primary underline"
            >
              wger
            </a>
            .
          </p>
          <p>
            <span className="font-medium text-foreground">Software / Branding Assets:</span>{" "}
            Licensed under the GNU Affero General Public License v3.0 or later (AGPL-3.0+).
          </p>
          <p>
            <span className="font-medium text-foreground">Exercise Data and Media:</span>{" "}
            Licensed under Creative Commons Attribution-ShareAlike (CC-BY-SA).
          </p>
          <p>Copyright © wger Team and contributors.</p>
          <p>
            A copy of the AGPL-3.0 License is available at{" "}
            <a
              href="https://www.gnu.org/licenses/agpl-3.0.html"
              target="_blank"
              rel="noreferrer"
              className="break-all text-primary underline"
            >
              https://www.gnu.org/licenses/agpl-3.0.html
            </a>
            .
          </p>
        </div>
      </section>

      <AlertDialog
        open={!!pendingReplace}
        onOpenChange={(open) => !open && setPendingReplace(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Replace all data?</AlertDialogTitle>
            <AlertDialogDescription>
              This permanently deletes your current routines, workouts and PR history,
              and replaces them with the contents of the backup. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => pendingReplace && replaceImport(pendingReplace)}
            >
              Replace
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between border-b border-border/30 py-1 last:border-0">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="font-medium tabular-nums">{value}</dd>
    </div>
  );
}
