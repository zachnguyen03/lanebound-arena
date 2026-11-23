/**
 * Purity scanner helpers — strip comments, then match banned APIs in remaining code.
 * Shared by `npm run purity` and tests/purity-scan.test.ts.
 */

/** Banned nondeterminism / non-IEEE Math / locale / timers in sim/. */
export const BANNED_PATTERN = [
  "Math\\.random",
  "Date\\.now",
  "performance\\.now",
  "new Date",
  "Math\\.sin",
  "Math\\.cos",
  "Math\\.tan\\b",
  "Math\\.atan\\b",
  "Math\\.atan2",
  "Math\\.exp",
  "Math\\.log",
  "Math\\.pow\\b",
  "\\bIntl\\b",
  "setTimeout",
  "setInterval",
].join("|");

export const BANNED_RE = new RegExp(BANNED_PATTERN, "g");

/**
 * Strip line (`//`) and block (`/* … *​/`) comments from TS/JS source.
 * Strings are preserved so a string containing `//` or `/*` is not treated as a comment.
 */
export function stripComments(source: string): string {
  let out = "";
  let i = 0;
  const n = source.length;
  type Mode = "code" | "line" | "block" | "sq" | "dq" | "tmpl";
  let mode: Mode = "code";

  while (i < n) {
    const c = source[i]!;
    const next = i + 1 < n ? source[i + 1]! : "";

    if (mode === "code") {
      if (c === "/" && next === "/") {
        mode = "line";
        out += "  "; // keep length-ish alignment for line numbers (spaces)
        i += 2;
        continue;
      }
      if (c === "/" && next === "*") {
        mode = "block";
        out += "  ";
        i += 2;
        continue;
      }
      if (c === "'") {
        mode = "sq";
        out += c;
        i++;
        continue;
      }
      if (c === '"') {
        mode = "dq";
        out += c;
        i++;
        continue;
      }
      if (c === "`") {
        mode = "tmpl";
        out += c;
        i++;
        continue;
      }
      out += c;
      i++;
      continue;
    }

    if (mode === "line") {
      if (c === "\n") {
        mode = "code";
        out += "\n";
      } else {
        out += " ";
      }
      i++;
      continue;
    }

    if (mode === "block") {
      if (c === "*" && next === "/") {
        mode = "code";
        out += "  ";
        i += 2;
        continue;
      }
      out += c === "\n" ? "\n" : " ";
      i++;
      continue;
    }

    // string / template — copy through, honor escapes
    if (c === "\\" && i + 1 < n) {
      out += c + source[i + 1]!;
      i += 2;
      continue;
    }
    if (mode === "sq" && c === "'") mode = "code";
    else if (mode === "dq" && c === '"') mode = "code";
    else if (mode === "tmpl" && c === "`") mode = "code";
    out += c;
    i++;
  }
  return out;
}

export interface PurityHit {
  line: number;
  text: string;
  match: string;
}

/** Scan source for banned calls in non-comment code. */
export function findBannedInSource(source: string): PurityHit[] {
  const stripped = stripComments(source);
  const hits: PurityHit[] = [];
  const lines = stripped.split("\n");
  const origLines = source.split("\n");
  for (let li = 0; li < lines.length; li++) {
    const line = lines[li]!;
    BANNED_RE.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = BANNED_RE.exec(line)) !== null) {
      hits.push({
        line: li + 1,
        text: (origLines[li] ?? line).trimEnd(),
        match: m[0]!,
      });
    }
  }
  return hits;
}
