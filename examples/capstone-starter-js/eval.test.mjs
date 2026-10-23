// The capstone eval as a test (node --test; no dependencies): runs every case, writes
// results.json, and asserts the aggregate pass rate against eval.config.json's threshold.
// Prefer Vitest? The same body works inside a Vitest `test(...)` -- see examples/js.
import assert from "node:assert/strict";
import { test } from "node:test";
import { run } from "./run-eval.mjs";

test("pass rate meets the threshold", { timeout: 120_000 }, async () => {
  const record = await run();
  const s = record.summary;
  const failures = record.results.filter((r) => !r.passed).map((r) => `${JSON.stringify(r.input)}: ${r.reason} (got ${JSON.stringify(r.output)})`);
  assert.ok(s.total >= 3, "the capstone needs at least 3 cases");
  assert.ok(s.passRate >= record.threshold, `pass rate ${Math.round(s.passRate * 100)}% is below ${record.threshold * 100}%:\n${failures.join("\n")}`);
});
