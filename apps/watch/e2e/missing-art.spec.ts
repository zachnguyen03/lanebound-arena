import { expect, test } from "@playwright/test";

test("missing champion art stays hidden when the even lineup is packed", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.goto("/");
  await expect(page.getByTestId("watch-root")).toHaveAttribute(
    "data-art-checked",
    "true",
    { timeout: 30_000 },
  );
  await expect(page.getByTestId("missing-assets")).toHaveCount(0);
});
