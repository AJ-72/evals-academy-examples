// Fast, offline unit tests for the scorers and statistics (node --test; no dependencies).
import assert from "node:assert/strict";
import { test } from "node:test";
import { contains, containsWord, exact, jsonScorer, normalize, numeric, score } from "./scorers.mjs";
import { passAtK, passHatK, wilson } from "./stats.mjs";

test("normalize strips case, quotes and trailing punctuation", () => {
  assert.equal(normalize('  "Paris."  '), "paris");
  assert.ok(exact("Positive.", "positive"));
  assert.ok(!exact("", ""));
});

test("containsWord fixes the substring false pass", () => {
  assert.ok(contains("The answer is 14.", "4")); // the trap
  assert.ok(!containsWord("The answer is 14.", "4")); // the fix
  assert.ok(containsWord("Answer: 4.", "4"));
});

test("numeric uses the final number", () => {
  assert.ok(numeric("First 3, then the total is 1,200.", "1200")[0]);
  assert.ok(!numeric("I think 4, no wait, 14", "4")[0]);
  assert.deepEqual(numeric("no digits", "3"), [false, "no number in the output"]);
});

test("json scorer parses, then compares or validates", () => {
  const c = { expected: '{"name": "John", "age": 30}' };
  assert.ok(jsonScorer('{"age":30,"name":"John"}', c)[0]);
  assert.ok(jsonScorer('```json\n{"name": "John", "age": 30}\n```', c)[0]);
  assert.match(jsonScorer("John is 30", c)[1], /^Parse error/);
  assert.match(jsonScorer('{"name":"John","age":"30"}', c)[1], /\$\.age is string, expected integer/);
  const schema = { type: "object", required: ["age"], properties: { age: { type: "integer", minimum: 0 } }, additionalProperties: false };
  assert.ok(jsonScorer('{"age": 3}', { schema })[0]);
  assert.match(jsonScorer('{"age": 1, "x": 2}', { schema })[1], /is not allowed/);
});

test("judge fails closed on prose", async () => {
  const [passed, reason] = await score("judge", "x", { input: "q", expected: "a" }, { callModel: async () => "The output is not correct." });
  assert.equal(passed, false);
  assert.match(reason, /^unscorable/);
});

test("statistics", () => {
  const [low, high] = wilson(3, 3);
  assert.equal(low.toFixed(2), "0.44");
  assert.equal(high, 1);
  assert.equal(passAtK(5, 1, 5), 1);
  assert.equal(passHatK(5, 4, 5), 0);
  assert.ok(Math.abs(passAtK(10, 3, 1) - 0.3) < 1e-12);
});
