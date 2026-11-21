// Lesson "Record, replay, and trace": save each model call once, then re-run the eval from the saved files.
//
//   MODEL_PROVIDER=mock node record-replay.mjs record     # run 1: calls the model, saves one file per case
//   MODEL_PROVIDER=mock node record-replay.mjs replay     # run 2: same results, zero model calls
//   MODEL_PROVIDER=mock node record-replay.mjs replay --prompt v2   # prompt changed: replay fails on purpose
//   MODEL_PROVIDER=mock node record-replay.mjs record --prompt v2 --dir recordings-v2   # re-record on purpose
//
// Recordings are plain JSON you can open, review and commit. The Python version
// (record_replay.py) writes byte-identical files, so either one can replay the other's.
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { parseArgs } from "node:util";
import { callModel, modelName, provider } from "./model.mjs";
import { contains } from "./scorers.mjs";

// The system under test: a support bot for a shoe shop. Two versions of its prompt.
const PROMPTS = {
  v1: "You are the support assistant for a shoe shop. Refund policy: 30 days, with a receipt. " +
      "Answer the customer in one sentence.\n\nCustomer: {input}",
  v2: "You are the friendly support assistant for a shoe shop. Refund policy: 30 days, with a receipt. " +
      "Answer the customer in one short sentence.\n\nCustomer: {input}",
};
const PARAMS = { temperature: 0, max_tokens: 200 };

const CASES = [
  { id: "refund-in-window", input: "I bought trainers 20 days ago. Can I get a refund?", expected: "yes" },
  { id: "refund-too-late", input: "I bought boots 45 days ago. Can I return them?", expected: "no" },
  { id: "no-receipt", input: "I lost my receipt. Can I still get a refund?", expected: "receipt" },
];

/** Everything that changes the answer goes into the key. Same JSON as the Python version. */
export const recordingKey = (prompt, model, params) =>
  createHash("sha256").update(JSON.stringify({ prompt, model, params })).digest("hex").slice(0, 12);

/** A replay asked for a call that was never recorded. This is a failed test, never a live call. */
class ReplayMiss extends Error {}

async function getOutput(c, prompt, mode, folder, stats) {
  const model = `${provider()}/${modelName()}`;
  const file = join(folder, `${c.id}.${recordingKey(prompt, model, PARAMS)}.json`);

  if (mode === "replay") {
    if (existsSync(file)) return JSON.parse(readFileSync(file, "utf8")).output;
    const stale = existsSync(folder) && readdirSync(folder).some((f) => f.startsWith(`${c.id}.`));
    const why = stale
      ? "a recording exists, but the prompt, model or params changed since it was made"
      : "this case was never recorded";
    throw new ReplayMiss(`no recording for ${c.id}: ${why}`);
  }

  const output = await callModel(prompt, { temperature: PARAMS.temperature, maxTokens: PARAMS.max_tokens });
  stats.modelCalls += 1;
  mkdirSync(folder, { recursive: true });
  writeFileSync(file, JSON.stringify({ case: c.id, model, params: PARAMS, prompt, output }, null, 2) + "\n");
  return output;
}

export async function run(mode, promptVersion = "v1", folder = "recordings") {
  const stats = { modelCalls: 0, misses: 0 };
  let passed = 0;
  for (const c of CASES) {
    const prompt = PROMPTS[promptVersion].replace("{input}", c.input);
    let output;
    try {
      output = await getOutput(c, prompt, mode, folder, stats);
    } catch (e) {
      if (!(e instanceof ReplayMiss)) throw e;
      console.log(`  FAIL  ${e.message}`);
      stats.misses += 1;
      continue;
    }
    const ok = contains(output, c.expected);
    passed += ok ? 1 : 0;
    console.log(`  ${ok ? "pass" : "FAIL"}  ${c.id}: ${output}`);
  }
  console.log(`${mode} (${promptVersion}): ${passed}/${CASES.length} passed, ${stats.modelCalls} model calls, files in ${folder}/`);
  if (stats.misses) console.log("If that change was on purpose, record again (into a new --dir) and compare the two runs.");
  return passed === CASES.length ? 0 : 1;
}

const { values, positionals } = parseArgs({
  allowPositionals: true,
  options: { prompt: { type: "string", default: "v1" }, dir: { type: "string", default: "recordings" } },
});
const mode = positionals[0];
if (!["record", "replay"].includes(mode) || !(values.prompt in PROMPTS)) {
  console.error("usage: node record-replay.mjs record|replay [--prompt v1|v2] [--dir recordings]");
  process.exit(2);
}
process.exitCode = await run(mode, values.prompt, values.dir);
