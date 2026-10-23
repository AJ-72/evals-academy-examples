// Lesson "What is an eval?": the smallest useful eval, runnable.
//
//   MODEL_PROVIDER=mock node first-eval.mjs          # no key, no cost
//   MODEL_PROVIDER=openai OPENAI_API_KEY=sk-... node first-eval.mjs
import { callModel } from "./model.mjs";
import { contains } from "./scorers.mjs";

const cases = [
  { input: "What is the capital of France?", expected: "Paris" },
  { input: "What is 12 * 12?", expected: "144" },
  { input: "Who wrote Hamlet?", expected: "Shakespeare" },
];

let passed = 0;
for (const c of cases) {
  const output = await callModel(`Answer the question with only the answer, no explanation.\n\nQuestion: ${c.input}`);
  const ok = contains(output, c.expected);
  if (ok) passed++;
  console.log(`${ok ? "PASS" : "FAIL"}  ${JSON.stringify(c.input)} -> ${JSON.stringify(output)}`);
}

console.log(`pass rate: ${Math.round((passed / cases.length) * 100)}%`);
