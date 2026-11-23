import { expect, type Page } from "playwright/test";

/** Header labels must sit inside their own controls, at every desktop width. */
export async function expectHeaderFits(page: Page) {
  const problems = await page.evaluate(() => {
    const header = document.querySelector("header.top");
    if (!header) return ["missing header"];
    const found: string[] = [];
    const items = [...header.querySelectorAll("button, .date, .wm")].filter((el) => {
      const box = el.getBoundingClientRect();
      return box.width > 0 && box.height > 0;
    });
    for (const el of items) {
      const node = el as HTMLElement;
      const label = (node.getAttribute("aria-label") || node.textContent || "").replace(/\s+/g, " ").trim();
      if (node.scrollWidth > node.clientWidth + 1 || node.scrollHeight > node.clientHeight + 1) {
        found.push(`overflow ${label}`);
      }
      const box = node.getBoundingClientRect();
      const hit = document.elementFromPoint(box.left + box.width / 2, box.top + box.height / 2);
      if (!hit || (hit !== node && !node.contains(hit) && !hit.contains(node))) {
        found.push(`overlap ${label}`);
      }
    }
    for (let i = 0; i < items.length; i++) {
      for (let j = i + 1; j < items.length; j++) {
        const a = items[i]!;
        const b = items[j]!;
        if (a.contains(b) || b.contains(a)) continue;
        const ra = a.getBoundingClientRect();
        const rb = b.getBoundingClientRect();
        const crosses = ra.left < rb.right - 1 && ra.right > rb.left + 1 && ra.top < rb.bottom - 1 && ra.bottom > rb.top + 1;
        if (crosses) {
          const left = (a.getAttribute("aria-label") || a.textContent || "").replace(/\s+/g, " ").trim();
          const right = (b.getAttribute("aria-label") || b.textContent || "").replace(/\s+/g, " ").trim();
          found.push(`boxes ${left} and ${right}`);
        }
      }
    }
    return found;
  });
  expect(problems).toEqual([]);
}
