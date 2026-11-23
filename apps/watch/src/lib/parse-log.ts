import type { SimEvent } from "./types";

export function parseJsonl(text: string): SimEvent[] {
  const events: SimEvent[] = [];
  const lines = text.split(/\r?\n/);
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!.trim();
    if (!line) continue;
    let obj: unknown;
    try {
      obj = JSON.parse(line);
    } catch {
      throw new Error(`Invalid JSONL at line ${i + 1}`);
    }
    if (!obj || typeof obj !== "object") {
      throw new Error(`Event at line ${i + 1} is not an object`);
    }
    const ev = obj as Record<string, unknown>;
    if (typeof ev.type !== "string") {
      throw new Error(`Event at line ${i + 1} missing type`);
    }
    if (typeof ev.tick !== "number" || typeof ev.seq !== "number") {
      throw new Error(`Event at line ${i + 1} missing tick/seq`);
    }
    events.push(ev as SimEvent);
  }
  events.sort((a, b) => {
    if (a.seq !== b.seq) return a.seq - b.seq;
    return a.tick - b.tick;
  });
  return events;
}

export async function readFileAsText(file: File): Promise<string> {
  return await file.text();
}
