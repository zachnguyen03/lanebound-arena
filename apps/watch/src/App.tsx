import { useMemo, useState } from "react";
import { WatchShell } from "./components/WatchShell";
import { LabShell } from "./components/lab/LabShell";

type AppMode = "watch" | "lab";

export default function App() {
  const [mode, setMode] = useState<AppMode>("watch");
  const [stagedOverrides, setStagedOverrides] = useState<Record<string, unknown>>(
    {},
  );
  const dirty = useMemo(
    () => Object.keys(stagedOverrides).length > 0,
    [stagedOverrides],
  );

  return (
    <>
      {/* Keep Watch mounted (hidden) while Lab is open so a live match survives. */}
      <div
        data-testid="watch-keep-alive"
        style={{ display: mode === "watch" ? "contents" : "none" }}
        aria-hidden={mode !== "watch"}
      >
        <WatchShell
          stagedConstants={stagedOverrides}
          onOpenLab={() => setMode("lab")}
          dirty={dirty}
        />
      </div>
      {mode === "lab" ? (
        <LabShell
          onBackToWatch={() => setMode("watch")}
          stagedOverrides={stagedOverrides}
          onStagedOverrides={setStagedOverrides}
          dirty={dirty}
        />
      ) : null}
    </>
  );
}
