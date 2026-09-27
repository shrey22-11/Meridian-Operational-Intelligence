import { test, expect } from "@playwright/test";
import { mkdir, readFile, writeFile } from "node:fs/promises";

const reports = "../reports/redesign/workflows";
const inr = (value) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(value);
async function navigate(page, name) {
  const mobile = await page
    .getByRole("button", { name: "Open navigation" })
    .isVisible();
  if (mobile)
    await page.getByRole("button", { name: "Open navigation" }).click();
  await page
    .getByRole("navigation", { name: "Main navigation" })
    .getByRole("link", { name, exact: true })
    .filter({ visible: true })
    .click();
}
test.beforeAll(async () => {
  await mkdir(reports, { recursive: true });
});

// The two original end-to-end flows remain, with updated semantic selectors and stronger assertions.
test("dashboard, filters, analytics, saved inference and responsive navigation", async ({
  page,
  request,
}) => {
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "Operational overview" }),
  ).toBeVisible();
  const response = await request.get("/api/metrics");
  expect(response.ok()).toBeTruthy();
  const metrics = await response.json();
  await expect(page.getByTestId("revenue-value")).toHaveText(
    inr(metrics.current.revenue),
  );
  await page.getByLabel("Region", { exact: true }).selectOption("North");
  const north = await (await request.get("/api/metrics?region=North")).json();
  await expect(page.getByTestId("revenue-value")).toHaveText(
    inr(north.current.revenue),
  );
  await page.getByRole("button", { name: "Reset filters" }).click();
  await expect(page.getByTestId("revenue-value")).toHaveText(
    inr(metrics.current.revenue),
  );
  await page
    .getByRole("group", { name: "Trend metric" })
    .getByRole("button", { name: "Orders", exact: true })
    .click();
  await expect(
    page.getByRole("img", { name: /Daily order counts/ }),
  ).toBeVisible();
  const [download] = await Promise.all([
    page.waitForEvent("download"),
    page.getByRole("link", { name: "Export data" }).click(),
  ]);
  expect(download.suggestedFilename()).toMatch(/daily_operations.*csv/);
  const csv = await readFile(await download.path(), "utf8");
  expect(csv).toContain("revenue");
  expect(csv.split("\n").length).toBeGreaterThan(100);
  await navigate(page, "Analytics");
  await expect(page.getByRole('table', { name: 'Regional performance comparison' })).toBeVisible();
  await expect(page.getByRole('table', { name: 'Monthly regional revenue decomposition' })).toBeVisible();
  await page
    .getByRole("button", { name: "Customer segments", exact: true })
    .click();
  await expect(
    page.getByRole("table", { name: "RFM customer segment comparison" }),
  ).toBeVisible();
  await navigate(page, "Models");
  await expect(
    page.getByRole("table", { name: "Classifier validation comparison" }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Demand outlook" }),
  ).toBeVisible();
  await navigate(page, "Scenario Lab");
  const firstRequest = page.waitForResponse((response) =>
    response.url().endsWith("/api/predictions/scenario"),
  );
  await page.getByRole("button", { name: "Run prediction" }).click();
  const first = await (await firstRequest).json();
  await expect(page.getByTestId("scenario-probability")).toHaveText(
    `${(first.probability * 100).toFixed(1)}%`,
  );
  await page.getByLabel("Warehouse load", { exact: true }).fill("0.3");
  await expect(page.getByText("Inputs changed", { exact: true })).toBeVisible();
  const secondRequest = page.waitForResponse((response) =>
    response.url().endsWith("/api/predictions/scenario"),
  );
  await page.getByRole("button", { name: "Run prediction" }).click();
  const second = await (await secondRequest).json();
  expect(second.probability).toBeLessThan(first.probability);
  await expect(page.getByTestId("scenario-probability")).toHaveText(
    `${(second.probability * 100).toFixed(1)}%`,
  );
  await expect(page.locator(".baseline-comparison b")).toHaveText(
    `${(first.probability * 100).toFixed(1)}%`,
  );
  await expect(
    page.getByText("Lower predicted delay risk", { exact: true }),
  ).toBeVisible();
  await page.screenshot({
    path: `${reports}/scenario-comparison-light.png`,
    fullPage: true,
  });
  await page.getByLabel("Theme", { exact: true }).selectOption("dark");
  await page.screenshot({
    path: `${reports}/scenario-comparison-dark.png`,
    fullPage: true,
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({
    path: `${reports}/scenario-comparison-mobile.png`,
    fullPage: true,
  });
  await navigate(page, "AI Analyst");
  await expect(page.getByLabel("Ask the analyst")).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBeTruthy();
  expect(errors).toEqual([]);
});

test("AI analyst sends a real request and displays cited tool results", async ({
  page,
}) => {
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/#analyst");
  await page
    .getByLabel("Ask the analyst")
    .fill("How is booked revenue defined? Retrieve and cite the policy.");
  const answerResponse = page.waitForResponse(
    (response) => response.url().endsWith("/api/ai/chat"),
    { timeout: 210000 },
  );
  await page.getByRole("button", { name: "Run analysis", exact: true }).click();
  await expect(
    page.getByText("Analyst request in progress", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText(/Individual tool progress is not streamed/),
  ).toBeVisible();
  const response = await answerResponse;
  expect(response.ok()).toBeTruthy();
  const body = await response.json();
  expect(
    body.evidence.some((entry) => entry.tool === "search_policies"),
  ).toBeTruthy();
  await expect(page.locator(".answer-text")).toHaveText(
    body.answer
      .replaceAll(/\[T(\d+)\]/g, "T$1")
      .replaceAll("**", "")
      .replaceAll("`", "")
      .replaceAll("_", " "),
    { useInnerText: true },
  );
  const policy = body.evidence.find(
    (entry) => entry.tool === "search_policies",
  );
  await page
    .getByRole("group", { name: "Evidence sources" })
    .getByRole("button", { name: /Operating guidance/ })
    .click();
  await expect(page.locator(".policy-excerpts")).toContainText(
    policy.result[0].text,
  );
  await expect(page.locator(".raw-evidence pre").first()).not.toBeVisible();
  await page.screenshot({
    path: `${reports}/ai-policy-light.png`,
    fullPage: true,
  });
  await page.getByLabel("Theme", { exact: true }).selectOption("dark");
  await page.screenshot({
    path: `${reports}/ai-policy-dark.png`,
    fullPage: true,
  });
  await page
    .getByText("Inspect complete tool response", { exact: true })
    .click();
  await expect(page.locator(".raw-evidence pre").last()).toContainText(
    policy.result[0].id,
  );
  await page
    .getByText("Inspect complete tool response", { exact: true })
    .click();
  await navigate(page, "Overview");
  await navigate(page, "AI Analyst");
  await expect(page.locator(".answer-text")).toBeVisible();
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({
    path: `${reports}/ai-policy-mobile.png`,
    fullPage: true,
  });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBeTruthy();
  await writeFile(
    `${reports}/actual-ai-response.json`,
    JSON.stringify(body, null, 2),
  );
  expect(errors).toEqual([]);
});

test("operations queue supports sorting, pagination, search, details and all views", async ({
  page,
}) => {
  await page.goto("/#operations");
  const table = page.getByRole("table", {
    name: "Delivery predictions",
    exact: true,
  });
  await expect(table.locator("tbody tr")).toHaveCount(20);
  const firstOrder = await table
    .locator("tbody tr")
    .first()
    .locator("td")
    .first()
    .textContent();
  await page.getByRole("button", { name: "Next", exact: true }).click();
  await expect(page.getByText("Page 2 of 5")).toBeVisible();
  await expect(
    table.locator("tbody tr").first().locator("td").first(),
  ).not.toHaveText(firstOrder);
  await page
    .getByRole("button", { name: "Sort by Booked value", exact: true })
    .click();
  await expect(
    table.getByRole("columnheader", { name: "Sort by Booked value" }),
  ).toHaveAttribute("aria-sort", "descending");
  await expect(page.getByText("Page 1 of 5")).toBeVisible();
  await table
    .getByRole("button", { name: /Inspect order/ })
    .first()
    .click();
  await expect(
    page.getByRole("heading", { name: "Observed order inputs" }),
  ).toBeVisible();
  await page.screenshot({
    path: `${reports}/order-review-light.png`,
    fullPage: true,
  });
  await page.getByRole("button", { name: "Close order details" }).click();
  await page.getByLabel("Find an order").fill("no-matching-order");
  await expect(
    page.getByText("No open orders match these filters"),
  ).toBeVisible();
  await page.getByLabel("Find an order").fill(firstOrder.replace("#", ""));
  await expect(table.locator("tbody tr")).toHaveCount(1);
  await page.getByRole("button", { name: "Anomalies", exact: true }).click();
  await expect(
    page.getByRole("table", { name: "Regional anomaly monitoring" }),
  ).toBeVisible();
  await page.getByLabel("Region", { exact: true }).selectOption("East");
  await expect(
    page
      .getByRole("table", { name: "Regional anomaly monitoring" })
      .locator("tbody tr")
      .first(),
  ).toContainText("East");
  await page.screenshot({
    path: `${reports}/anomalies-light.png`,
    fullPage: true,
  });
  await page
    .getByRole("button", { name: "Product watchlist", exact: true })
    .click();
  await expect(
    page.getByRole("table", { name: "Product delivery watchlist" }),
  ).toBeVisible();
  await page
    .getByLabel("Find a product or supplier")
    .fill("no-matching-supplier");
  await expect(page.getByText("No products match this search")).toBeVisible();
});

test("statistics, lineage, segmentation and forecast remain available", async ({
  page,
}) => {
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/#analytics");
  await page
    .getByRole("button", { name: "Operating conditions", exact: true })
    .click();
  await expect(
    page.getByRole("table", { name: "Regional delay confidence intervals" }),
  ).toBeVisible();
  await page
    .getByText("Inspect statistical relationships", { exact: true })
    .click();
  await expect(
    page.getByRole("table", {
      name: "Correlations with actual delivery duration",
    }),
  ).toBeVisible();
  await page.screenshot({
    path: `${reports}/statistics-light.png`,
    fullPage: true,
  });
  await page.getByRole("button", { name: "Data quality", exact: true }).click();
  await expect(
    page.getByRole("table", { name: "Cleaning audit" }),
  ).toBeVisible();
  await page
    .getByText("Source fingerprint and run details", { exact: true })
    .click();
  await expect(page.locator(".fingerprints")).toContainText("orders");
  await page.getByLabel("Theme", { exact: true }).selectOption("dark");
  await page.screenshot({
    path: `${reports}/quality-dark.png`,
    fullPage: true,
  });
  await page
    .getByRole("button", { name: "Customer segments", exact: true })
    .click();
  await expect(
    page
      .getByRole("table", { name: "RFM customer segment comparison" })
      .locator("tbody tr"),
  ).toHaveCount(4);
  await page.screenshot({
    path: `${reports}/segments-dark.png`,
    fullPage: true,
  });
  await navigate(page, "Models");
  await expect(page.getByRole("img", { name: /Fourteen-day/ })).toBeVisible();
  expect(errors).toEqual([]);
});

test("theme respects system changes, persists overrides and keyboard navigation works", async ({
  page,
}) => {
  await page.emulateMedia({ colorScheme: "dark", reducedMotion: "reduce" });
  await page.goto("/");
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await expect(page.getByLabel("Theme", { exact: true })).toHaveValue("system");
  await page.emulateMedia({ colorScheme: "light" });
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
  await page.getByLabel("Theme", { exact: true }).selectOption("dark");
  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await page.getByLabel("Theme", { exact: true }).selectOption("light");
  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
  await navigate(page, "Models");
  await page.getByRole("link", { name: "Skip to main content" }).focus();
  await page.keyboard.press("Enter");
  await expect(page.locator("#main-content")).toBeFocused();
  await expect(page).toHaveURL(/#models$/);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole("button", { name: "Open navigation" }).click();
  await expect(page.locator("dialog")).toBeVisible();
  await page.screenshot({ path: `${reports}/mobile-navigation.png` });
  await page.keyboard.press("Escape");
  await expect(page.locator("dialog")).not.toBeVisible();
  await expect(
    page.getByRole("button", { name: "Open navigation" }),
  ).toBeFocused();
  await navigate(page, "Overview");
  await expect(
    page.getByRole("heading", { name: "Operational overview" }),
  ).toBeVisible();
});

test("date validation, empty results, loading and recoverable API errors", async ({
  page,
}) => {
  await page.goto("/");
  await expect(page.getByTestId("revenue-value")).toBeVisible();
  await page.getByLabel("Start date").fill("2026-02-01");
  await page.getByRole("button", { name: "Apply dates" }).click();
  await expect(page.getByRole("alert")).toContainText("Choose a start date");
  await page.getByLabel("End date").fill("2026-02-28");
  await page.getByRole("button", { name: "Apply dates" }).click();
  await expect(
    page.getByText("No order activity for this period"),
  ).toBeVisible();
  await expect(page.getByTestId("revenue-value")).toHaveText(inr(0));
  await page.screenshot({
    path: `${reports}/empty-period-light.png`,
    fullPage: true,
  });
  let release;
  const gate = new Promise((resolve) => {
    release = resolve;
  });
  await page.route("**/api/metrics?**", async (route) => {
    await gate;
    await route.abort("failed");
  });
  await page.getByRole("button", { name: "Reset filters" }).click();
  await expect(
    page.getByRole("status", { name: "Business metrics", exact: true }),
  ).toBeVisible();
  release();
  await expect(page.getByRole("alert")).toContainText(
    "Unable to load business metrics",
  );
  await page.getByLabel("Theme", { exact: true }).selectOption("dark");
  await page.screenshot({
    path: `${reports}/api-error-dark.png`,
    fullPage: true,
  });
  await page.unroute("**/api/metrics?**");
  await page.getByRole("button", { name: "Retry", exact: true }).click();
  await expect(page.getByTestId("revenue-value")).toBeVisible();
});

test("AI provider failure preserves the question and offers a retry", async ({
  page,
}) => {
  await page.route("**/api/ai/chat", (route) => route.abort("failed"));
  await page.goto("/#analyst");
  await page.getByLabel("Ask the analyst").fill("Summarize revenue movement.");
  await page.getByRole("button", { name: "Run analysis", exact: true }).click();
  await expect(page.getByRole("alert")).toContainText(
    "Analysis could not be completed",
  );
  await expect(
    page.getByRole("heading", { name: "Summarize revenue movement." }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Retry", exact: true }),
  ).toBeEnabled();
  await page.screenshot({
    path: `${reports}/ai-error-light.png`,
    fullPage: true,
  });
  await page
    .getByRole("button", { name: "Clear session", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Start with a business question" }),
  ).toBeVisible();
});

test("numerical AI analysis presents the exact structured-data source", async ({
  page,
  request,
}) => {
  await page.goto("/#analyst");
  await page
    .getByLabel("Ask the analyst")
    .fill(
      "What was net booked revenue in December 2025? Get business metrics for 2025-12-01 through 2025-12-31, all regions.",
    );
  const responsePromise = page.waitForResponse(
    (response) => response.url().endsWith("/api/ai/chat"),
    { timeout: 210000 },
  );
  await page.getByRole("button", { name: "Run analysis", exact: true }).click();
  const response = await responsePromise;
  expect(response.ok()).toBeTruthy();
  const body = await response.json();
  const metrics = body.evidence.find(
    (entry) => entry.tool === "get_business_metrics",
  );
  expect(metrics).toBeTruthy();
  const direct = await (
    await request.get("/api/metrics?start_date=2025-12-01&end_date=2025-12-31")
  ).json();
  expect(metrics.result.current.revenue).toBe(direct.current.revenue);
  await page
    .getByRole("group", { name: "Evidence sources" })
    .getByRole("button", { name: /Business metrics/ })
    .first()
    .click();
  const exactMoney = new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 2,
  }).format(direct.current.revenue);
  await expect(page.locator(".evidence-primary strong")).toHaveText(exactMoney);
  await expect(page.locator(".evidence-primary small")).toHaveText(
    "1 Dec 2025 – 31 Dec 2025",
  );
  await page.screenshot({
    path: `${reports}/ai-metrics-light.png`,
    fullPage: true,
  });
  await page.getByLabel("Theme", { exact: true }).selectOption("dark");
  await page.screenshot({
    path: `${reports}/ai-metrics-dark.png`,
    fullPage: true,
  });
  await writeFile(
    `${reports}/actual-numerical-ai-response.json`,
    JSON.stringify(body, null, 2),
  );
});
