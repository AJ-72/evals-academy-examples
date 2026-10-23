// A small eval runner: cases in, per-case result records and a summary out.
//
//   node runner.mjs ../cases/sentiment.jsonl --scorer contains_word \
//     --task "Classify the review as positive, negative or neutral. Reply with one word.\n\nReview: {input}"
//
// Writes results.json in the format the capstone accepts (see ../capstone-starter).
import { readFileSync, writeFileSync } from "node:fs";
import { pathToFileURL } from "node:url";
import { parseArgs } from "node:util";
import { callModel, modelName, provider } from "./model.mjs";
import { score } from "./scorers.mjs";
import { wilson } from "./stats.mjs";

export function loadCases(path) {
  const text = readFileSync(path, "utf8");
  if (text.trimStart().startsWith("[")) return JSON.parse(text);
  return text.split("\n").filter((l) => l.trim()).map((l) => JSON.parse(l));
}

export const buildPrompt = (task, input) => (task.includes("{input}") ? task.replaceAll("{input}", input) : `${task}\n\n${input}`);

/** Run every case once and return { task, scorer, model, results, summary }. */
export async function runEval(task, cases, scorer, { rubric = "", temperature = 0 } = {}) {
  const results = [];
  for (const c of cases) {
    const started = performance.now();
    const record = { input: c.input, expected: c.expected ?? "" };
    if (c.schema) record.schema = c.schema;
    try {
      const output = await callModel(buildPrompt(task, c.input), { temperature });
      const [passed, reason] = await score(scorer, output, c, { rubric, callModel });
      Object.assign(record, { output, passed, reason });
    } catch (err) {
      // one failed call is an error record, never a crash or a pass
      Object.assign(record, { output: "", passed: false, reason: `error: ${err.message}`, error: true });
    }
    record.latency_ms = Math.round(performance.now() - started);
    results.push(record);
  }
  const passed = results.filter((r) => r.passed).length;
  const [low, high] = wilson(passed, results.length);
  return {
    task,
    scorer,
    provider: provider(),
    model: modelName(),
    temperature,
    results,
    summary: { passed, total: results.length, passRate: results.length ? passed / results.length : 0, ci95: [+low.toFixed(3), +high.toFixed(3)] },
  };
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const { values, positionals } = parseArgs({
    allowPositionals: true,
    options: { task: { type: "string" }, scorer: { type: "string", default: "contains_word" }, rubric: { type: "string", default: "" }, out: { type: "string", default: "results.json" } },
  });
  if (!positionals[0] || !values.task) {
    console.error("usage: node runner.mjs <cases.jsonl> --task \"... {input}\" [--scorer contains_word] [--out results.json]");
    process.exit(2);
  }
  const run = await runEval(values.task.replaceAll("\\n", "\n"), loadCases(positionals[0]), values.scorer, { rubric: values.rubric });
  writeFileSync(values.out, JSON.stringify(run, null, 2) + "\n");
  const s = run.summary;
  console.log(`${s.passed}/${s.total} passed (${Math.round(s.passRate * 100)}%, 95% CI ${Math.round(s.ci95[0] * 100)}-${Math.round(s.ci95[1] * 100)}%) -> ${values.out}`);
  for (const r of run.results.filter((x) => !x.passed)) console.log(`  FAIL ${JSON.stringify(r.input)}: ${r.reason} (got ${JSON.stringify(r.output)})`);
}
