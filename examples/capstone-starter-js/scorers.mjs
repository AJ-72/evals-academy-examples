// Deterministic scorers with the same semantics as the course playground.
// score(scorer, output, c) -> [passed, reason]; a case is { input, expected } plus an optional
// `schema` for the json scorer. Repo-backed capstones are re-scored with these semantics.

export const JUDGE_SYSTEM =
  "You are a strict, fair evaluator of AI outputs. " +
  'Respond with ONLY a JSON object: {"pass": boolean, "score": number between 0 and 1, "reason": "one short sentence"}.';

export const normalize = (s) =>
  String(s ?? "").toLowerCase().trim().replace(/\s+/g, " ").replace(/^["'`]+|["'`]+$/g, "").replace(/[.!?,;:]+$/g, "").trim();

const escapeRegex = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

export const exact = (output, expected) => normalize(expected) !== "" && normalize(output) === normalize(expected);

export const contains = (output, expected) => normalize(expected) !== "" && normalize(output).includes(normalize(expected));

/** Whole-word containment: "4" does not match inside "14". */
export function containsWord(output, expected) {
  const want = normalize(expected);
  return want !== "" && new RegExp(`(^|[^\\p{L}\\p{N}])${escapeRegex(want)}($|[^\\p{L}\\p{N}])`, "u").test(normalize(output));
}

/** Compare the LAST number in the output (the "final answer") with the expected number. */
export function numeric(output, expected) {
  const want = Number(String(expected).replace(/,/g, "").trim());
  if (!Number.isFinite(want)) return [false, `expected value "${expected}" is not a number`];
  const found = String(output).replace(/(\d),(?=\d{3}\b)/g, "$1").match(/-?\d+(?:\.\d+)?/g);
  if (!found) return [false, "no number in the output"];
  const got = Number(found[found.length - 1]);
  return [Math.abs(got - want) <= 1e-9 * Math.max(1, Math.abs(want)), `final number ${got} vs expected ${want}`];
}

function jsonType(v) {
  if (v === null) return "null";
  if (Array.isArray(v)) return "array";
  if (typeof v === "number") return Number.isInteger(v) ? "integer" : "number";
  return typeof v;
}

/** null when equal (key order and whitespace never matter), else where they differ. */
export function jsonDiff(got, want, path = "$") {
  const tg = jsonType(got);
  const tw = jsonType(want);
  const isNum = (t) => t === "integer" || t === "number";
  if (tg !== tw && !(isNum(tg) && isNum(tw))) return `${path} is ${tg}, expected ${tw}`;
  if (tw === "array") {
    if (got.length !== want.length) return `${path} has ${got.length} items, expected ${want.length}`;
    for (let i = 0; i < want.length; i++) {
      const d = jsonDiff(got[i], want[i], `${path}[${i}]`);
      if (d) return d;
    }
    return null;
  }
  if (tw === "object") {
    for (const k of Object.keys(want)) {
      if (!(k in got)) return `${path}.${k} is missing`;
      const d = jsonDiff(got[k], want[k], `${path}.${k}`);
      if (d) return d;
    }
    const extra = Object.keys(got).find((k) => !(k in want));
    return extra ? `${path}.${extra} is not expected` : null;
  }
  return got === want ? null : `${path} is ${JSON.stringify(got)}, expected ${JSON.stringify(want)}`;
}

/** The playground's JSON Schema subset. */
export function validateSchema(v, s, path = "$") {
  if (s.type) {
    const types = Array.isArray(s.type) ? s.type : [s.type];
    const t = jsonType(v);
    if (!types.some((w) => w === t || (w === "number" && t === "integer"))) return `${path} is ${t}, expected ${types.join(" or ")}`;
  }
  if (s.enum && !s.enum.some((e) => JSON.stringify(e) === JSON.stringify(v))) return `${path} is not one of ${JSON.stringify(s.enum)}`;
  if (typeof v === "number") {
    if (typeof s.minimum === "number" && v < s.minimum) return `${path} is below the minimum ${s.minimum}`;
    if (typeof s.maximum === "number" && v > s.maximum) return `${path} is above the maximum ${s.maximum}`;
  }
  if (typeof v === "string") {
    if (typeof s.minLength === "number" && v.length < s.minLength) return `${path} is shorter than ${s.minLength}`;
    if (typeof s.maxLength === "number" && v.length > s.maxLength) return `${path} is longer than ${s.maxLength}`;
  }
  if (jsonType(v) === "object") {
    for (const k of s.required || []) if (!(k in v)) return `${path}.${k} is required`;
    const props = s.properties || {};
    for (const [k, sub] of Object.entries(props)) {
      if (k in v) {
        const err = validateSchema(v[k], sub, `${path}.${k}`);
        if (err) return err;
      }
    }
    if (s.additionalProperties === false) {
      const extra = Object.keys(v).find((k) => !(k in props));
      if (extra) return `${path}.${extra} is not allowed`;
    }
  }
  if (Array.isArray(v) && s.items) {
    for (let i = 0; i < v.length; i++) {
      const err = validateSchema(v[i], s.items, `${path}[${i}]`);
      if (err) return err;
    }
  }
  return null;
}

export function jsonScorer(output, c) {
  let got;
  try {
    got = JSON.parse(String(output).trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, ""));
  } catch (e) {
    return [false, `Parse error: output is not valid JSON (${e.message})`];
  }
  if (c.schema) {
    const err = validateSchema(got, c.schema);
    return err ? [false, `Schema error: ${err}`] : [true, "valid JSON that matches the schema"];
  }
  let want;
  try {
    want = typeof c.expected === "string" ? JSON.parse(c.expected) : c.expected;
  } catch (e) {
    return [false, "expected value is not valid JSON; give a JSON value or a schema"];
  }
  const diff = jsonDiff(got, want);
  return diff ? [false, `Mismatch: ${diff}`] : [true, "parsed JSON equals the expected value"];
}

/** LLM-as-judge that fails closed: a verdict that isn't JSON is a fail, never a guess. */
export async function judge(output, c, rubric, callModel) {
  const prompt = `TASK INPUT:\n${c.input}\n\nEXPECTED ANSWER:\n${c.expected}\n\nMODEL OUTPUT:\n${output}\n\nRUBRIC:\n${rubric}`;
  const raw = await callModel(prompt, { system: JUDGE_SYSTEM, temperature: 0 });
  let verdict = null;
  try {
    verdict = JSON.parse((raw.match(/\{[\s\S]*\}/) || [""])[0]);
  } catch {
    verdict = null;
  }
  if (!verdict || typeof verdict !== "object") return [false, "unscorable: the judge did not return JSON"];
  return [verdict.pass === true, String(verdict.reason || "")];
}

/** Score one output with the named scorer. Resolves to [passed, reason]. */
export async function score(scorer, output, c, { rubric = "", callModel = null } = {}) {
  const expected = c.expected ?? "";
  switch (scorer) {
    case "exact": {
      const ok = exact(output, expected);
      return [ok, ok ? "exact match" : `expected ${JSON.stringify(expected)}`];
    }
    case "contains": {
      const ok = contains(output, expected);
      return [ok, ok ? "contains the expected answer" : `missing ${JSON.stringify(expected)}`];
    }
    case "contains_word": {
      const ok = containsWord(output, expected);
      return [ok, ok ? "contains the expected answer as a whole word" : `missing ${JSON.stringify(expected)} as a whole word`];
    }
    case "numeric":
      return numeric(output, expected);
    case "regex": {
      let re;
      try {
        re = new RegExp(expected, "i");
      } catch (e) {
        return [false, `invalid regex: ${e.message}`];
      }
      const ok = re.test(output);
      return [ok, ok ? "regex matched" : "regex did not match"];
    }
    case "json":
      return jsonScorer(output, c);
    case "judge":
      if (!callModel) throw new Error("the judge scorer needs callModel");
      return judge(output, c, rubric || "The output is correct if it matches the meaning of the expected answer.", callModel);
    default:
      throw new Error(`unknown scorer "${scorer}"`);
  }
}
