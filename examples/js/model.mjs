// One function, callModel(), for every provider the course uses. No dependencies (Node 18+ fetch).
//
//   MODEL_PROVIDER   openai | anthropic | openrouter | groq | huggingface | mock   (default: mock)
//   MODEL_NAME       override the provider's default model
//   MODEL_BASE_URL   override the base URL of an OpenAI-compatible provider
//   EVAL_CACHE_DIR   cache responses on disk (development only)
//   MOCK_ANSWERS     JSONL fixtures for the mock provider (default: fixtures/ here, else ../fixtures/)
//
// Keys come from OPENAI_API_KEY, ANTHROPIC_API_KEY, OPENROUTER_API_KEY, GROQ_API_KEY or HF_TOKEN.
// The mock provider needs no key and no network, so tests and CI can check the wiring for free.
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const OPENAI_COMPATIBLE = {
  openai: ["https://api.openai.com/v1", "gpt-4o-mini", "OPENAI_API_KEY"],
  openrouter: ["https://openrouter.ai/api/v1", "google/gemma-4-31b-it:free", "OPENROUTER_API_KEY"],
  groq: ["https://api.groq.com/openai/v1", "llama-3.1-8b-instant", "GROQ_API_KEY"],
  huggingface: ["https://router.huggingface.co/v1", "meta-llama/Llama-3.2-3B-Instruct", "HF_TOKEN"],
};
const ANTHROPIC = ["https://api.anthropic.com", "claude-haiku-4-5", "ANTHROPIC_API_KEY"];
const JUDGE_MARKER = "ONLY a JSON object";

export const provider = () => (process.env.MODEL_PROVIDER || "mock").trim().toLowerCase();

export function modelName() {
  const p = provider();
  const fallback = p === "anthropic" ? ANTHROPIC[1] : (OPENAI_COMPATIBLE[p] || ["", "mock"])[1];
  return process.env.MODEL_NAME || fallback;
}

/** Send one prompt (plus an optional system prompt) and return the reply text. */
export async function callModel(prompt, { system = null, temperature = 0, maxTokens = 512 } = {}) {
  const cacheDir = process.env.EVAL_CACHE_DIR;
  const key = createHash("sha256").update(JSON.stringify([provider(), modelName(), system, prompt, temperature])).digest("hex");
  const hit = cacheDir && join(cacheDir, `${key}.json`);
  if (hit && existsSync(hit)) return JSON.parse(readFileSync(hit, "utf8")).output;

  const output = await call(prompt, system, temperature, maxTokens);

  if (hit) {
    mkdirSync(cacheDir, { recursive: true });
    writeFileSync(hit, JSON.stringify({ output }));
  }
  return output;
}

async function call(prompt, system, temperature, maxTokens) {
  const p = provider();
  if (p === "mock") return mockReply(prompt, system);
  if (p === "anthropic") {
    const [base, , env] = ANTHROPIC;
    const body = { model: modelName(), max_tokens: maxTokens, temperature, messages: [{ role: "user", content: prompt }] };
    if (system) body.system = system;
    const data = await post(`${base}/v1/messages`, body, { "x-api-key": key(env), "anthropic-version": "2023-06-01" });
    return (data.content || []).filter((b) => b.type === "text").map((b) => b.text).join("");
  }
  if (!OPENAI_COMPATIBLE[p]) throw new Error(`Unknown MODEL_PROVIDER "${p}"; use mock, anthropic, ${Object.keys(OPENAI_COMPATIBLE).join(", ")}`);
  const [defaultBase, , env] = OPENAI_COMPATIBLE[p];
  const base = (process.env.MODEL_BASE_URL || defaultBase).replace(/\/+$/, "");
  const messages = (system ? [{ role: "system", content: system }] : []).concat({ role: "user", content: prompt });
  const data = await post(`${base}/chat/completions`, { model: modelName(), messages, temperature, max_tokens: maxTokens }, { authorization: `Bearer ${key(env)}` });
  return data.choices?.[0]?.message?.content ?? "";
}

function key(env) {
  const value = process.env[env];
  if (!value) throw new Error(`${env} is not set (MODEL_PROVIDER=${provider()}). Set it, or use MODEL_PROVIDER=mock.`);
  return value;
}

async function post(url, body, headers) {
  const res = await fetch(url, { method: "POST", headers: { "content-type": "application/json", ...headers }, body: JSON.stringify(body) });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error?.message || `HTTP ${res.status} from ${url}`);
  return data;
}

/* ------------------------------------------------------------------ mock */
function fixtures() {
  // MOCK_ANSWERS, else fixtures/ next to this file (capstone starter), else one level up (examples/).
  const candidates = [process.env.MOCK_ANSWERS, join(HERE, "fixtures", "mock_answers.jsonl"), join(HERE, "..", "fixtures", "mock_answers.jsonl")];
  const path = candidates.find((c) => c && existsSync(c));
  if (!path) return [];
  return readFileSync(path, "utf8").split("\n").filter((l) => l.trim()).map((l) => JSON.parse(l));
}

/** Deterministic stand-in: the first fixture whose `match` appears in the prompt wins. Judge
    prompts get a verdict: pass when the expected answer appears in the output being judged. */
export function mockReply(prompt, system = null) {
  if (system && system.includes(JUDGE_MARKER)) {
    const expected = /EXPECTED ANSWER:\n([\s\S]*?)\n\n/.exec(prompt);
    const output = /MODEL OUTPUT:\n([\s\S]*?)\n\nRUBRIC:/.exec(prompt);
    const ok = !!(expected && output && output[1].toLowerCase().includes(expected[1].trim().toLowerCase()));
    return JSON.stringify({ pass: ok, score: ok ? 1 : 0, reason: `mock judge: expected answer ${ok ? "found" : "not found"}` });
  }
  const hit = fixtures().find((f) => prompt.includes(f.match));
  return hit ? hit.output : "I don't know.";
}
