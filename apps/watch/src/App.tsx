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

  if (mode === "lab") {
    return (
      <LabShell
        onBackToWatch={() => setMode("watch")}
        stagedOverrides={stagedOverrides}
        onStagedOverrides={setStagedOverrides}
        dirty={dirty}
      />
    );
  }

  return (
    <WatchShell
      stagedConstants={stagedOverrides}
      onOpenLab={() => setMode("lab")}
      dirty={dirty}
    />
  );
}
