import { expect, test } from "@playwright/test";

async function expectNoHorizontalOverflow(page: import("@playwright/test").Page) {
  const dimensions = await page.evaluate(() => ({
    clientWidth: document.documentElement.clientWidth,
    scrollWidth: document.documentElement.scrollWidth,
  }));
  expect(dimensions.scrollWidth).toBeLessThanOrEqual(dimensions.clientWidth + 1);
}

test("public request journey renders without viewport overflow", async ({ page }) => {
  await page.goto("/");
  await expect(
    page.getByRole("heading", { level: 1, name: /ideas become reality here/i }),
  ).toBeVisible();
  await expectNoHorizontalOverflow(page);

  await page.goto("/request");
  await expect(
    page.getByRole("heading", { level: 1, name: /tell us what you want to make/i }),
  ).toBeVisible();
  await expect(page.getByRole("button", { name: /send print request/i })).toBeVisible();
  await expectNoHorizontalOverflow(page);
});

test("request form reports missing fields accessibly and preserves ordered colors", async ({
  page,
}) => {
  await page.goto("/request");

  await page.getByRole("button", { name: "White", exact: true }).click();
  await expect(page.getByRole("list", { name: /selected colors in print order/i })).toContainText(
    "White",
  );
  await expect(page.getByText("1 of 4 selected", { exact: true })).toBeVisible();

  await page.getByRole("button", { name: /send print request/i }).click();
  const alert = page.getByRole("alert");
  await expect(alert).toContainText("Check this request");
  await expect(alert.getByRole("link", { name: /your name/i })).toBeVisible();
});

test("tokenless status route reveals no request data", async ({ page }) => {
  await page.goto("/status/CBSS-0042");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    /opening your private request|private link is incomplete or no longer valid/i,
  );
  await expect(page).toHaveURL(/\/status\/CBSS-0042$/);
  await expectNoHorizontalOverflow(page);
});
