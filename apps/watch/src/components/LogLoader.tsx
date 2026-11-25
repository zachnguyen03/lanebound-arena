import { useCallback, useRef, useState } from "react";
import { Button } from "./ui/button";
import { cn } from "@watch/lib/cn";

interface Props {
  disabled?: boolean;
  onLoadText: (text: string, name: string) => void;
  onLoadSample: () => void;
}

export function LogLoader({ disabled, onLoadText, onLoadSample }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleFiles = useCallback(
    async (files: FileList | null) => {
      setError(null);
      const file = files?.[0];
      if (!file) return;
      try {
        const text = await file.text();
        onLoadText(text, file.name);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to read file");
      }
    },
    [onLoadText],
  );

  return (
    <div
      data-testid="log-loader"
      className={cn(
        "border border-dashed border-line-2 bg-panel p-4 transition-colors",
        dragging && "border-paper bg-panel-2",
      )}
      onDragEnter={(e) => {
        e.preventDefault();
        setDragging(true);
      }}
      onDragOver={(e) => e.preventDefault()}
      onDragLeave={() => setDragging(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDragging(false);
        void handleFiles(e.dataTransfer.files);
      }}
    >
      <div className="font-condensed text-lg text-paper">LOAD EVENT LOG</div>
      <p className="mt-1 text-sm text-dim">
        Drop an event log (.jsonl), or pick a file.
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        <Button
          data-testid="btn-pick-file"
          variant="outline"
          size="sm"
          disabled={disabled}
          onClick={() => inputRef.current?.click()}
        >
          Choose file
        </Button>
        <Button
          data-testid="btn-load-sample"
          variant="active"
          size="sm"
          disabled={disabled}
          onClick={onLoadSample}
        >
          Load sample (seed 20261122)
        </Button>
        <input
          ref={inputRef}
          data-testid="file-input"
          type="file"
          accept=".jsonl,application/jsonl,text/plain"
          className="hidden"
          onChange={(e) => void handleFiles(e.target.files)}
        />
      </div>
      {error ? (
        <p className="mt-2 text-sm text-team-red" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
