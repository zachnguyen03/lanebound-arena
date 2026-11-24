// VFX contact sheet: every champ:skill in the gallery at wind-up / hit / linger.
// Needs the Watch dev server running.
//   node apps/watch/scripts/vfx-contact-sheet.mjs [baseUrl] [out.png]
// Compare two sheets (before/after a tuning pass) side by side.
import { chromium } from "playwright";

const base = process.argv[2] ?? "http://127.0.0.1:5173";
const out = process.argv[3] ?? "vfx-contact-sheet.png";
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1900, height: 1100 } });
await p.goto(`${base}/?vfx=huntress:Q`);
await p.getByTestId("vfx-zoom").waitFor();
await p.waitForFunction(() => document.querySelectorAll('[data-testid="vfx-skill"] option').length > 0, null, { timeout: 60000 });
const skills = await p.$$eval('[data-testid="vfx-skill"] option', (os) => os.map((o) => o.value));

const setScrub = (v) =>
  p.getByTestId("vfx-scrub").evaluate((el, x) => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value").set.call(el, String(x));
    el.dispatchEvent(new Event("input", { bubbles: true }));
  }, v);

const rows = [];
for (const skill of skills) {
  await p.getByTestId("vfx-skill").selectOption(skill);
  await p.waitForTimeout(150);
  const cast = await p.getByTestId("vfx-cast").textContent();
  if (cast?.includes(" 0/0")) continue;
  const hit = Number(await p.getByTestId("vfx-zoom").getAttribute("data-hit-rel"));
  const shots = [];
  for (const rel of [Math.max(0, hit - 0.3), hit, hit + 0.5]) {
    await setScrub(rel);
    await p.waitForTimeout(80);
    shots.push((await p.getByTestId("vfx-zoom").screenshot()).toString("base64"));
  }
  rows.push({ skill, shots });
}

await p.setViewportSize({ width: 3 * 352 + 140, height: 600 });
await p.setContent(
  `<body style="margin:0;background:#111;color:#ddd;font:12px monospace">` +
    rows
      .map(
        (r) =>
          `<div style="display:flex;align-items:center"><div style="width:140px">${r.skill}</div>` +
          r.shots.map((s) => `<img src="data:image/png;base64,${s}" width="352" height="192" style="image-rendering:pixelated">`).join("") +
          `</div>`,
      )
      .join(""),
);
await p.screenshot({ path: out, fullPage: true });
console.log(`${rows.length} skills → ${out}`);
await b.close();
