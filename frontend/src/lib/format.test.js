import { test } from "node:test";
import assert from "node:assert/strict";
import { dateLabel, money, decimal, delta, initialPeriod } from "./format.js";

test("table callback rows cannot be misinterpreted as date or number format options", () => {
  const row = { day: "2025-12-12", region: "East", revenue: 1250.5 };
  assert.equal(dateLabel(row.day, row), "12 Dec 2025");
  assert.equal(money(row.revenue, row), "₹1,251");
  assert.equal(decimal(0.27, row), "0.3");
  assert.equal(
    dateLabel(row.day, { day: "numeric", month: "short" }),
    "12 Dec",
  );
});
test("missing values and undefined percentage comparisons remain explicit", () => {
  assert.equal(dateLabel(null), "—");
  assert.equal(dateLabel("bad-date"), "—");
  assert.equal(money(null), "—");
  assert.equal(decimal(null), "—");
  assert.equal(delta(100, 0), null);
  assert.equal(delta(100, null), null);
  assert.equal(delta(0, 100), -100);
});
test("the inclusive 30-day filter crosses month and year boundaries correctly", () => {
  assert.deepEqual(initialPeriod("2026-01-14"), {
    start: "2025-12-16",
    end: "2026-01-14",
    region: "",
  });
  assert.deepEqual(initialPeriod("2025-12-31"), {
    start: "2025-12-02",
    end: "2025-12-31",
    region: "",
  });
});
