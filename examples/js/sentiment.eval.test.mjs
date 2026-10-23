// Lesson "Evals in your test runner": one eval, one aggregate assertion (Vitest).
//
//   npm test             # the eval is skipped
//   npm run test:eval    # RUN_EVALS=1 (MODEL_PROVIDER=mock by default: free and offline)
import { describe, expect, test } from "vitest";
import { callModel } from "./model.mjs";
import { buildPrompt, loadCases } from "./runner.mjs";
import { containsWord } from "./scorers.mjs";

const TASK = "Classify the review as positive, negative or neutral. Reply with one word.\n\nReview: {input}";
const CASES = loadCases(new URL("../cases/sentiment.jsonl", import.meta.url));
const THRESHOLD = 0.75; // agreed before the run, from a baseline -- not tuned afterwards

describe.skipIf(process.env.RUN_EVALS !== "1")("sentiment eval", () => {
  test("pass rate meets the threshold", async () => {
    const failures = [];
    for (const c of CASES) {
      const output = await callModel(buildPrompt(TASK, c.input), { temperature: 0 });
      if (!containsWord(output, c.expected)) failures.push(`${JSON.stringify(c.input)}: expected ${c.expected}, got ${JSON.stringify(output)}`);
    }
    const rate = 1 - failures.length / CASES.length;
    console.log(`pass rate ${Math.round(rate * 100)}% on ${CASES.length} cases`);
    expect(rate, failures.join("\n")).toBeGreaterThanOrEqual(THRESHOLD);
  }, 120_000);
});
