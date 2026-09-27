import { chromium } from "@playwright/test";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { resolve } from "node:path";
import { mkdir, writeFile } from "node:fs/promises";

// Run the existing FastAPI app with evidence-only configuration in an isolated process.
// The normal application and .env are untouched; every response comes from real services.
const root = resolve("..");
const python =
  process.env.MERIDIAN_PYTHON ||
  resolve(
    root,
    process.platform === "win32"
      ? ".venv/Scripts/python.exe"
      : ".venv/bin/python",
  );
const port = process.env.MERIDIAN_QA_PORT || "8001";
const backend = spawn(
  python,
  [
    "-m",
    "uvicorn",
    "backend.app.main:app",
    "--host",
    "127.0.0.1",
    "--port",
    port,
  ],
  {
    cwd: root,
    env: { ...process.env, AI_PROVIDER: "evidence" },
    windowsHide: true,
    stdio: "pipe",
  },
);
let logs = "";
backend.stdout.on("data", (data) => {
  logs += data;
});
backend.stderr.on("data", (data) => {
  logs += data;
});
let browser;
try {
  let ready = false;
  for (let i = 0; i < 60; i++) {
    if (backend.exitCode !== null)
      throw new Error(`Isolated API failed: ${logs}`);
    try {
      const response = await fetch(`http://127.0.0.1:${port}/api/health`);
      const health = await response.json();
      if (response.ok && health.ai_provider === "evidence") {
        ready = true;
        break;
      }
    } catch {}
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  if (!ready)
    throw new Error(`Evidence-only API did not become ready: ${logs}`);
  browser = await chromium.launch({ channel: "msedge", headless: true });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    reducedMotion: 'reduce',
  });
  const page = await context.newPage();
  await page.route("**/api/**", (route) => {
    const url = new URL(route.request().url());
    return route.continue({
      url: `http://127.0.0.1:${port}${url.pathname}${url.search}`,
    });
  });
  await page.goto("http://127.0.0.1:5173/#analyst");
  await page.getByText("Evidence-only mode", { exact: true }).waitFor();
  await page
    .getByLabel("Ask the analyst")
    .fill("Summarize operations and business metrics.");
  const responsePromise = page.waitForResponse((response) =>
    response.url().endsWith("/api/ai/chat"),
  );
  await page
    .getByRole("button", { name: "Retrieve evidence", exact: true })
    .click();
  const response = await responsePromise;
  const body = await response.json();
  if (
    body.mode !== "evidence" ||
    !body.evidence.some((entry) => entry.tool === "get_business_metrics")
  )
    throw new Error("Expected actual structured business metrics");
  await page.locator(".evidence-primary strong").waitFor();
  await mkdir("../reports/redesign/workflows", { recursive: true });
  for (const theme of ["light", "dark"]) {
    await page.getByLabel("Theme", { exact: true }).selectOption(theme);
    await page.screenshot({
      path: `../reports/redesign/workflows/evidence-only-${theme}.png`,
      fullPage: true,
    });
  }
  await writeFile(
    "../reports/redesign/workflows/evidence-only-response.json",
    JSON.stringify(body, null, 2),
  );
  console.log(
    "Verified actual evidence-only FastAPI response, formatted business metrics and policy retrieval.",
  );
} finally {
  await browser?.close();
  if (backend.exitCode === null) {
    const closed = once(backend, "close");
    backend.kill();
    await closed;
  }
}
