import { useMemo, useRef, useState } from "react";
import { Button } from "../ui/button";
import {
  CONSTANT_META,
  ConstantValidationError,
  defaultConstantsSnapshot,
  diffVsDefault,
  groupsInOrder,
  validateConstantOverride,
  type ConstantGroup,
  type ConstantMeta,
} from "@lab/constants-meta";
import {
  createPreset,
  parsePresetJson,
  serializePreset,
} from "@lab/presets";
import type { ConstantsPreset } from "@lab/types";
import { DEFAULT_CONSTANTS } from "@sim/constants";

interface Props {
  overrides: Record<string, unknown>;
  onChange: (next: Record<string, unknown>) => void;
  onPresetLoaded?: (preset: ConstantsPreset) => void;
}

function isEditable(m: ConstantMeta): boolean {
  return m.editability === "editable" || m.editability === "unused";
}

export function TuningPanel({ overrides, onChange, onPresetLoaded }: Props) {
  const [error, setError] = useState<string | null>(null);
  const [presetName, setPresetName] = useState("lab-custom");
  const [showUnused, setShowUnused] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const effective = useMemo(() => {
    const base = defaultConstantsSnapshot();
    return { ...base, ...overrides };
  }, [overrides]);

  const diffs = useMemo(() => diffVsDefault(effective), [effective]);

  const setKey = (key: string, raw: string) => {
    setError(null);
    const meta = CONSTANT_META.find((m) => m.key === key);
    if (!meta || !isEditable(meta)) return;
    if (raw.trim() === "") {
      const next = { ...overrides };
      delete next[key];
      onChange(next);
      return;
    }
    let value: unknown = raw;
    if (key === "XP_TO_LEVEL") {
      try {
        value = JSON.parse(raw);
      } catch {
        setError("XP_TO_LEVEL must be JSON");
        return;
      }
    } else {
      const n = Number(raw);
      if (!Number.isFinite(n)) {
        setError(`${key}: not a number`);
        return;
      }
      value = n;
    }
    try {
      const v = validateConstantOverride(key, value);
      onChange({ ...overrides, [key]: v });
    } catch (e) {
      if (e instanceof ConstantValidationError) setError(e.message);
      else setError(e instanceof Error ? e.message : "Invalid value");
    }
  };

  const resetGroup = (group: ConstantGroup) => {
    const next = { ...overrides };
    for (const m of CONSTANT_META) {
      if (m.group === group) delete next[m.key];
    }
    onChange(next);
  };

  const resetAll = () => onChange({});

  const savePreset = () => {
    try {
      const preset = createPreset(presetName || "untitled", overrides, "S5 tuning panel");
      const blob = new Blob([serializePreset(preset)], {
        type: "application/json",
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${preset.name}.json`;
      a.click();
      URL.revokeObjectURL(url);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Save failed");
    }
  };

  const groups = groupsInOrder().filter((g) => {
    if (showUnused) return true;
    return g !== "Cards (unused in sandbox)" && g !== "Retired / unused";
  });

  return (
    <section data-testid="tuning-panel" className="max-w-5xl">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-condensed text-3xl tracking-wide">Tuning</h1>
          <p className="mt-1 max-w-xl text-sm text-dim">
            Every build-spec §15 constant. Illegal values are rejected. Edits are
            staged and apply only to the next Watch / Batch run — never mid-match.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <label className="text-xs text-dim">
            Preset name
            <input
              data-testid="preset-name"
              className="ml-2 border border-line bg-field px-2 py-1 text-paper"
              value={presetName}
              onChange={(e) => setPresetName(e.target.value)}
            />
          </label>
          <Button size="sm" variant="active" data-testid="btn-save-preset" onClick={savePreset}>
            Save preset
          </Button>
          <Button
            size="sm"
            variant="outline"
            data-testid="btn-load-preset"
            onClick={() => fileRef.current?.click()}
          >
            Load preset
          </Button>
          <input
            ref={fileRef}
            type="file"
            accept="application/json,.json"
            className="hidden"
            data-testid="preset-file"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (!file) return;
              void file.text().then((text) => {
                try {
                  const preset = parsePresetJson(text);
                  onChange(preset.overrides);
                  setPresetName(preset.name);
                  onPresetLoaded?.(preset);
                  setError(null);
                } catch (err) {
                  setError(err instanceof Error ? err.message : "Load failed");
                }
              });
            }}
          />
          <Button size="sm" variant="outline" data-testid="btn-reset-all" onClick={resetAll}>
            Reset all
          </Button>
          <label className="flex items-center gap-1 text-xs text-dim">
            <input
              type="checkbox"
              data-testid="toggle-unused"
              checked={showUnused}
              onChange={(e) => setShowUnused(e.target.checked)}
            />
            Show unused
          </label>
        </div>
      </div>

      {error ? (
        <p data-testid="tuning-error" className="mt-3 text-sm text-team-red">
          {error}
        </p>
      ) : null}

      <div
        data-testid="tuning-diff"
        className="mt-4 border border-line bg-panel/60 px-4 py-3 text-sm"
      >
        <div className="font-condensed text-dim">DIFF VS DEFAULT</div>
        {diffs.length === 0 ? (
          <p className="mt-1 text-faint" data-testid="tuning-diff-empty">
            No overrides — defaults match §15 / DEFAULT_CONSTANTS.
          </p>
        ) : (
          <ul className="mt-2 space-y-1 font-mono text-xs">
            {diffs.map((d) => (
              <li key={d.key} data-testid={`diff-${d.key}`}>
                {d.key}: {JSON.stringify(d.default)} → {JSON.stringify(d.value)}
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="mt-6 space-y-8">
        {groups.map((group) => {
          const rows = CONSTANT_META.filter((m) => m.group === group);
          if (rows.length === 0) return null;
          return (
            <div key={group} data-testid={`tuning-group-${group}`}>
              <div className="mb-2 flex items-center justify-between">
                <h2 className="font-condensed text-xl tracking-wide text-dim">
                  {group}
                </h2>
                <Button
                  size="sm"
                  variant="ghost"
                  data-testid={`btn-reset-group-${group}`}
                  onClick={() => resetGroup(group)}
                >
                  Reset group
                </Button>
              </div>
              <div className="overflow-x-auto border border-line">
                <table className="w-full min-w-[720px] text-left text-sm">
                  <thead className="bg-panel-2 text-xs uppercase text-faint">
                    <tr>
                      <th className="px-3 py-2">Constant</th>
                      <th className="px-3 py-2">Value</th>
                      <th className="px-3 py-2">Band</th>
                      <th className="px-3 py-2">Notes</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((m) => {
                      const def = m.inSimTable
                        ? DEFAULT_CONSTANTS[m.key as keyof typeof DEFAULT_CONSTANTS]
                        : m.default;
                      const cur =
                        m.key in overrides ? overrides[m.key] : def;
                      const editable = isEditable(m);
                      return (
                        <tr
                          key={m.key}
                          data-testid={`const-row-${m.key}`}
                          data-editability={m.editability}
                          className="border-t border-line"
                        >
                          <td className="px-3 py-2 font-mono text-xs">{m.key}</td>
                          <td className="px-3 py-2">
                            {editable && typeof def !== "object" ? (
                              <input
                                data-testid={`const-input-${m.key}`}
                                className="w-28 border border-line bg-field px-2 py-1 font-mono text-xs"
                                defaultValue={String(cur)}
                                key={`${m.key}:${String(cur)}`}
                                onBlur={(e) => setKey(m.key, e.target.value)}
                                onKeyDown={(e) => {
                                  if (e.key === "Enter") {
                                    setKey(m.key, (e.target as HTMLInputElement).value);
                                  }
                                }}
                              />
                            ) : editable && m.key === "XP_TO_LEVEL" ? (
                              <textarea
                                data-testid={`const-input-${m.key}`}
                                className="h-16 w-64 border border-line bg-field p-1 font-mono text-[10px]"
                                defaultValue={JSON.stringify(cur)}
                                key={`${m.key}:${JSON.stringify(cur)}`}
                                onBlur={(e) => setKey(m.key, e.target.value)}
                              />
                            ) : (
                              <span
                                className="font-mono text-xs text-faint"
                                data-testid={`const-readonly-${m.key}`}
                              >
                                {typeof cur === "object"
                                  ? JSON.stringify(cur)
                                  : String(cur)}
                              </span>
                            )}
                          </td>
                          <td className="px-3 py-2 text-xs text-dim">
                            {m.min !== undefined && m.max !== undefined
                              ? `${m.min}–${m.max}`
                              : m.editability}
                          </td>
                          <td className="px-3 py-2 text-xs text-faint">
                            {m.notes ?? ""}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
