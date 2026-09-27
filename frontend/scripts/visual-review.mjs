import { chromium } from "@playwright/test";
import { mkdir, writeFile } from "node:fs/promises";
import { textContrastAudit } from "./contrast.mjs";

const root = "../reports/redesign/after";
await mkdir(root, { recursive: true });
const browser = await chromium.launch({ channel: "msedge", headless: true });
const pages = [
  ...[
    "overview",
    "operations",
    "analytics",
    "models",
    "scenario",
    "analyst",
  ].map((id) => ({ id, route: id })),
  { id: "anomalies", route: "operations", view: "Anomalies" },
  { id: "products", route: "operations", view: "Product watchlist" },
  { id: "segments", route: "analytics", view: "Customer segments" },
  { id: "statistics", route: "analytics", view: "Operating conditions" },
  { id: "quality", route: "analytics", view: "Data quality" },
];
const sizes = [
  { name: "desktop", width: 1440, height: 900 },
  { name: "laptop", width: 1280, height: 800 },
  { name: "mobile", width: 390, height: 844 },
  { name: "tablet", width: 768, height: 1024 },
];
const report = [];
for (const size of sizes) {
  for (const theme of ["light", "dark"]) {
    const context = await browser.newContext({
      viewport: size,
      colorScheme: theme,
      reducedMotion: "reduce",
    });
    const page = await context.newPage();
    const errors = [];
    page.on("pageerror", (error) => errors.push(error.message));
    for (const { id, route, view } of pages) {
      await page.goto(`http://127.0.0.1:5173/?review=${id}#${route}`);
      await page.locator("h1").waitFor();
      await page.waitForFunction(
        () => !document.querySelector(".skeleton-group"),
      );
      await page.evaluate(() => document.fonts.ready);
      if (view)
        await page.getByRole("button", { name: view, exact: true }).click();
      await page.waitForFunction(
        () => !document.querySelector(".skeleton-group"),
      );
      await page.screenshot({
        path: `${root}/${size.name}-${theme}-${id}.png`,
        fullPage: true,
      });
      const overflow = await page.evaluate(() => ({
        width: innerWidth,
        scroll: document.documentElement.scrollWidth,
      }));
      report.push({
        viewport: size.name,
        theme,
        route: id,
        overflow,
        errors: [...errors],
        alerts: await page.getByRole("alert").allTextContents(),
        contrast: await page.evaluate(textContrastAudit),
      });
      await writeFile(`${root}/review.json`, JSON.stringify(report, null, 2));
    }
    await context.close();
  }
}
await writeFile(`${root}/review.json`, JSON.stringify(report, null, 2));
await browser.close();
console.log(
  JSON.stringify(
    report.filter(
      (item) =>
        item.errors.length ||
        item.alerts.length ||
        item.overflow.scroll > item.overflow.width ||
        item.contrast.length,
    ),
    null,
    2,
  ),
);
console.log(`Captured ${report.length} complete page screenshots.`);
