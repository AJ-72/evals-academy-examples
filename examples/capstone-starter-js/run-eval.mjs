// Run the capstone eval and write results.json -- the file the Evals Academy capstone reads.
//
//   MODEL_PROVIDER=mock node run-eval.mjs                          # free dry run with fixtures
//   MODEL_PROVIDER=openai OPENAI_API_KEY=sk-... node run-eval.mjs   # the real run you submit
//
// Edit eval.config.json and cases.jsonl, never results.json by hand: the capstone re-scores
// every recorded output and rejects a file that disagrees with its scorer.
// Exits 1 when the pass rate is below the threshold, so it doubles as a CI gate.
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";
import { callModel, modelName, provider } from "./model.mjs";
import { score } from "./scorers.mjs";

const here = (name) => fileURLToPath(new URL(name, import.meta.url));

export async function run({ config = here("eval.config.json"), cases = here("cases.jsonl"), out = here("results.json") } = {}) {
  const cfg = JSON.parse(readFileSync(config, "utf8"));
  const list = readFileSync(cases, "utf8").split("\n").filter((l) => l.trim()).map((l) => JSON.parse(l));
  if (!cfg.task.includes("{input}")) throw new Error("eval.config.json: the task needs an {input} placeholder");

  const results = [];
  for (const c of list) {
    const record = { input: c.input, expected: c.expected ?? "" };
    if (c.schema) record.schema = c.schema;
    try {
      const output = await callModel(cfg.task.replaceAll("{input}", c.input), { temperature: cfg.temperature ?? 0 });
      const [passed, reason] = await score(cfg.scorer, output, c, { rubric: cfg.rubric || "", callModel });
      Object.assign(record, { output, passed, reason });
    } catch (err) {
      Object.assign(record, { output: "", passed: false, reason: `error: ${err.message}`, error: true }); // never a pass
    }
    results.push(record);
  }

  const passed = results.filter((r) => r.passed).length;
  const record = {
    task: cfg.task,
    scorer: cfg.scorer,
    provider: provider(),
    model: modelName(),
    temperature: cfg.temperature ?? 0,
    threshold: cfg.threshold ?? 0.8,
    results,
    summary: { passed, total: results.length, passRate: passed / results.length },
  };
  writeFileSync(out, JSON.stringify(record, null, 2) + "\n");
  return record;
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const record = await run();
  const s = record.summary;
  console.log(`${s.passed}/${s.total} passed (${Math.round(s.passRate * 100)}%) with ${record.provider}:${record.model} -> results.json`);
  for (const r of record.results.filter((x) => !x.passed)) console.log(`  FAIL ${JSON.stringify(r.input)}: ${r.reason} (got ${JSON.stringify(r.output)})`);
  process.exit(s.passRate >= record.threshold ? 0 : 1);
}
