import { test, expect } from "@playwright/test";

// Deliberate test fixtures for failure/race coverage; never imported by the app.
const prediction = (p) => ({ probability: p, risk_level: "Investigate", drivers: [{ feature: "warehouse_load", probability_difference: .1 }] });
test.beforeEach(async ({ page }) => {
  await page.route("**/api/health", (route) => route.fulfill({ json: { snapshot: "2025-12-31", ai_provider: "groq", ai_model: "test-provider" } }));
});

test("cold-start overview waits for the snapshot without a false empty state", async ({ page }) => {
  let release;
  await page.route("**/api/health", async (route) => {
    await new Promise((resolve) => { release = resolve; });
    await route.fulfill({ json: { snapshot: "2025-12-31", ai_provider: "groq" } });
  });
  await page.goto("/#overview");
  await expect(page.getByRole("status", { name: "Loading business snapshot" })).toBeVisible();
  await expect(page.getByText("This analysis is not available yet")).toHaveCount(0);
  await expect.poll(() => Boolean(release)).toBe(true);
  release();
  await expect(page.getByTestId("revenue-value")).toBeVisible();
});

test("pinned order risk agrees with its table row immediately", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.goto("/#operations");
  const row = page.getByRole("table", { name: "Delivery predictions" }).locator("tbody tr").first();
  const expected = await row.locator(".risk-text").innerText();
  await row.getByRole("button", { name: /Inspect order/ }).click();
  const detail = page.getByLabel("Selected order details");
  await detail.waitFor({ state: "visible" });
  expect(await detail.locator(".detail-score strong").innerText()).toBe(expected);
});

test("category selection stays pinned and mobile regional cards expose delay rate", async ({ page }) => {
  await page.goto("/#analytics");
  const fitness = page.getByRole("group", { name: "Inspect category revenue" }).getByRole("button", { name: /Fitness/ });
  await fitness.click();
  await page.mouse.move(0, 0);
  await expect(fitness).toHaveAttribute("aria-pressed", "true");
  await fitness.press("Enter");
  await expect(fitness).toHaveAttribute("aria-pressed", "false");

  await page.setViewportSize({ width: 390, height: 844 });
  const table = page.getByRole("table", { name: "Regional performance comparison" });
  const delay = table.locator('tbody tr').first().locator('td[data-label="Delay rate"]');
  await expect(delay).toBeVisible();
  expect(await delay.evaluate((element) => element.getBoundingClientRect().right <= innerWidth)).toBeTruthy();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBeTruthy();
});

test("scenario coalesces edits, rejects stale results, caches duplicates and recovers from failure", async ({ page }) => {
  const calls = [];
  let release;
  await page.route("**/api/predictions/scenario", async (route) => {
    const body = route.request().postDataJSON(); calls.push(body);
    if (calls.length === 1) await new Promise((resolve) => { release = resolve; });
    if (body.units === 99) return route.fulfill({ status: 503, json: { detail: "Test model unavailable" } });
    await route.fulfill({ json: prediction(body.units / 100) });
  });
  await page.goto("/#scenario");
  await page.getByRole("button", { name: "Run prediction" }).click();
  await expect.poll(() => calls.length).toBe(1);
  const units = page.getByLabel("Units ordered", { exact: true });
  await units.fill("7"); await units.fill("8"); await units.fill("9");
  release();
  await expect(page.getByTestId("scenario-probability")).toHaveText("9.0%");
  expect(calls).toHaveLength(2);
  await page.getByRole("button", { name: "Run prediction" }).click();
  await page.waitForTimeout(800);
  expect(calls).toHaveLength(2);
  await units.fill("99");
  await expect(page.getByText("Test model unavailable")).toBeVisible();
  await expect(page.getByTestId("scenario-probability")).toHaveText("9.0%");
  await units.fill("10");
  await expect(page.getByTestId("scenario-probability")).toHaveText("10.0%");
  await expect(page.locator(".baseline-comparison b")).toHaveText("9.0%");
  await units.fill(""); await page.waitForTimeout(750);
  expect(calls).toHaveLength(4);
  await expect(page.getByRole("button", { name: "Run prediction" })).toBeDisabled();
});

test("scenario slider waits during drag and remains keyboard accessible", async ({ page }) => {
  let calls = 0;
  await page.route("**/api/predictions/scenario", (route) => { calls++; return route.fulfill({ json: prediction(.56) }); });
  await page.goto("/#scenario");
  const slider = page.getByRole("slider", { name: "Shipping distance slider" });
  const box = await slider.boundingBox();
  await page.mouse.move(box.x + 10, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width * .75, box.y + box.height / 2, { steps: 12 });
  await page.waitForTimeout(800); expect(calls).toBe(0);
  await page.mouse.up();
  await expect(page.getByTestId("scenario-probability")).toHaveText("56.0%");
  expect(calls).toBe(1);
  await slider.focus(); await slider.press("ArrowRight");
  await expect.poll(() => calls).toBe(2);
});

test("scenario returns to an in-flight input without losing the latest result", async ({ page }) => {
  let release;
  let calls = 0;
  await page.route("**/api/predictions/scenario", async (route) => {
    calls++;
    if (calls === 1) await new Promise((resolve) => { release = resolve; });
    await route.fulfill({ json: prediction(.56) });
  });
  await page.goto("/#scenario");
  await page.getByRole("button", { name: "Run prediction" }).click();
  await expect.poll(() => calls).toBe(1);
  const units = page.getByLabel("Units ordered", { exact: true });
  await units.fill("7");
  await units.fill("6");
  release();
  await expect(page.getByTestId("scenario-probability")).toHaveText("56.0%");
  expect(calls).toBe(1);
});

test("revenue bridge uses the exact complete-month API values", async ({ page, request }) => {
  const response = await request.get("/api/revenue-bridge");
  expect(response.ok()).toBeTruthy();
  const bridge = await response.json();
  const sum = (key) => bridge.regions.reduce((acc, row) => acc + row[key], 0);
  const inr = (value) => new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(value);
  await page.goto("/#analytics");
  const stages = page.getByRole("group", { name: "Revenue decomposition stages" });
  await expect(stages.getByRole("button", { name: new RegExp("Previous revenue") })).toContainText(inr(sum("previous_revenue")));
  await expect(stages.getByRole("button", { name: new RegExp("Volume effect") })).toContainText(inr(sum("volume_effect")));
  await expect(stages.getByRole("button", { name: new RegExp("Basket effect") })).toContainText(inr(sum("basket_effect")));
  await expect(stages.getByRole("button", { name: new RegExp("Current revenue") })).toContainText(inr(sum("revenue")));
  await expect(page.getByText(/complete calendar months · all regions, independent of reporting filters/)).toBeVisible();
});

test("mobile order cards open a pinned detail sheet and can close it", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/#operations");
  const table = page.getByRole("table", { name: "Delivery predictions" });
  await expect(table.locator("tbody tr")).toHaveCount(20);
  await table.getByRole("button", { name: /Inspect order/ }).first().click();
  const panel = page.getByLabel("Selected order details");
  await expect(panel).toHaveClass(/pinned-detail/);
  await expect(panel.getByText("Warehouse load")).toBeVisible();
  await panel.getByRole("button", { name: "Close order details" }).click();
  await expect(panel).toHaveCount(0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBeTruthy();
  await page.setViewportSize({ width: 900, height: 900 });
  await page.goto("/#overview");
  await expect(page.getByTestId("revenue-value")).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBeTruthy();
});

for (const status of ["passed", "withheld", "evidence"]) {
  test(`analyst faithfully presents ${status} results and source selection`, async ({ page }) => {
    await page.route("**/api/ai/chat", (route) => route.fulfill({ json: {
      mode: status === "evidence" ? "evidence" : "groq", answer: status === "withheld" ? "Generated explanation withheld. Review the evidence." : "Policy evidence is available [T1].",
      guard: { status: status === "evidence" ? "not_applicable" : status },
      evidence: [{ id: "T1", tool: "search_policies", arguments: { query: "revenue" }, result: [] }],
    } }));
    await page.goto("/#analyst");
    await page.getByLabel("Ask the analyst").fill("Explain booked revenue");
    await page.getByRole("button", { name: "Run analysis", exact: true }).click();
    await expect(page.getByText(status === "passed" ? "Numerical & citation checks passed" : status === "withheld" ? "Explanation withheld" : "No generated interpretation", { exact: true })).toBeVisible();
    if (status !== "withheld") {
      await page.getByRole("button", { name: "View evidence T1", exact: true }).click();
      await expect(page.getByRole("complementary", { name: "Analysis evidence" })).toBeFocused();
    }
    await expect(page.getByRole("group", { name: "Evidence sources" })).toBeVisible();
  });
}

test("analyst network failure stays recoverable and never shows completed stages", async ({ page }) => {
  await page.route("**/api/ai/chat", (route) => route.abort());
  await page.goto("/#analyst");
  await page.getByLabel("Ask the analyst").fill("Explain revenue");
  await page.getByRole("button", { name: "Run analysis", exact: true }).click();
  await expect(page.getByText("Analysis could not be completed")).toBeVisible();
  await expect(page.getByRole("button", { name: "Retry", exact: true })).toBeVisible();
  await expect(page.getByText("Numerical & citation checks passed", { exact: true })).toHaveCount(0);
});
