"""Deterministic scorers with the same semantics as the course playground.

score(scorer, output, case) -> (passed, reason) dispatches on the scorer name
(exact | contains | contains_word | numeric | regex | json | judge). A case is
{"input", "expected"} plus an optional "schema" for the json scorer.

These must agree with the course's own scorer: repo-backed capstones re-score
your recorded outputs with it, and any disagreement is rejected.
"""
from __future__ import annotations

import json
import re

JUDGE_SYSTEM = (
    "You are a strict, fair evaluator of AI outputs. "
    'Respond with ONLY a JSON object: {"pass": boolean, "score": number between 0 and 1, "reason": "one short sentence"}.'
)


def normalize(s) -> str:
    s = re.sub(r"\s+", " ", str("" if s is None else s).lower().strip())
    s = re.sub(r"^[\"'`]+|[\"'`]+$", "", s)
    return re.sub(r"[.!?,;:]+$", "", s).strip()


def exact(output, expected) -> bool:
    want = normalize(expected)
    return want != "" and normalize(output) == want


def contains(output, expected) -> bool:
    want = normalize(expected)
    return want != "" and want in normalize(output)


def contains_word(output, expected) -> bool:
    """Whole-word containment: '4' does not match inside '14'."""
    want = normalize(expected)
    # [\W_] is "not a letter or digit", like the playground's [^\p{L}\p{N}]
    return want != "" and re.search(r"(^|[\W_])" + re.escape(want) + r"($|[\W_])", normalize(output)) is not None


def numeric(output, expected) -> tuple[bool, str]:
    """Compare the LAST number in the output (the 'final answer') with the expected number."""
    try:
        want = float(str(expected).replace(",", "").strip())
    except ValueError:
        return False, f"expected value {expected!r} is not a number"
    found = re.findall(r"-?\d+(?:\.\d+)?", re.sub(r"(\d),(?=\d{3}\b)", r"\1", str(output)))
    if not found:
        return False, "no number in the output"
    got = float(found[-1])
    ok = abs(got - want) <= 1e-9 * max(1.0, abs(want))
    return ok, f"final number {got:g} vs expected {want:g}"


def regex(output, expected) -> bool:
    return re.search(str(expected), str(output), re.IGNORECASE) is not None


def _type(v) -> str:
    if v is None:
        return "null"
    if isinstance(v, bool):
        return "boolean"
    if isinstance(v, int):
        return "integer"
    if isinstance(v, float):
        return "integer" if v.is_integer() else "number"
    if isinstance(v, str):
        return "string"
    if isinstance(v, list):
        return "array"
    return "object"


def json_diff(got, want, path="$"):
    """None when equal (key order and whitespace never matter), else where they differ."""
    tg, tw = _type(got), _type(want)
    numeric_types = {"integer", "number"}
    if tg != tw and not (tg in numeric_types and tw in numeric_types):
        return f"{path} is {tg}, expected {tw}"
    if tw == "array":
        if len(got) != len(want):
            return f"{path} has {len(got)} items, expected {len(want)}"
        for i, (g, w) in enumerate(zip(got, want)):
            d = json_diff(g, w, f"{path}[{i}]")
            if d:
                return d
        return None
    if tw == "object":
        for k in want:
            if k not in got:
                return f"{path}.{k} is missing"
            d = json_diff(got[k], want[k], f"{path}.{k}")
            if d:
                return d
        extra = next((k for k in got if k not in want), None)
        return f"{path}.{extra} is not expected" if extra else None
    return None if got == want else f"{path} is {json.dumps(got)}, expected {json.dumps(want)}"


def validate_schema(v, s, path="$"):
    """The playground's JSON Schema subset: type, enum, required, properties,
    additionalProperties: false, items, minimum, maximum, minLength, maxLength."""
    if "type" in s:
        types = s["type"] if isinstance(s["type"], list) else [s["type"]]
        t = _type(v)
        if not any(w == t or (w == "number" and t == "integer") for w in types):
            return f"{path} is {t}, expected {' or '.join(types)}"
    if "enum" in s and not any(json.dumps(e, sort_keys=True) == json.dumps(v, sort_keys=True) for e in s["enum"]):
        return f"{path} is not one of {json.dumps(s['enum'])}"
    if _type(v) in ("integer", "number"):
        if "minimum" in s and v < s["minimum"]:
            return f"{path} is below the minimum {s['minimum']}"
        if "maximum" in s and v > s["maximum"]:
            return f"{path} is above the maximum {s['maximum']}"
    if isinstance(v, str):
        if "minLength" in s and len(v) < s["minLength"]:
            return f"{path} is shorter than {s['minLength']}"
        if "maxLength" in s and len(v) > s["maxLength"]:
            return f"{path} is longer than {s['maxLength']}"
    if isinstance(v, dict):
        for k in s.get("required", []):
            if k not in v:
                return f"{path}.{k} is required"
        props = s.get("properties", {})
        for k, sub in props.items():
            if k in v:
                err = validate_schema(v[k], sub, f"{path}.{k}")
                if err:
                    return err
        if s.get("additionalProperties") is False:
            extra = next((k for k in v if k not in props), None)
            if extra:
                return f"{path}.{extra} is not allowed"
    if isinstance(v, list) and "items" in s:
        for i, item in enumerate(v):
            err = validate_schema(item, s["items"], f"{path}[{i}]")
            if err:
                return err
    return None


def json_scorer(output, case) -> tuple[bool, str]:
    text = re.sub(r"^```(?:json)?\s*|\s*```$", "", str(output).strip())
    try:
        got = json.loads(text)
    except ValueError as err:
        return False, f"Parse error: output is not valid JSON ({err})"
    if case.get("schema"):
        err = validate_schema(got, case["schema"])
        return (False, f"Schema error: {err}") if err else (True, "valid JSON that matches the schema")
    expected = case.get("expected")
    try:
        want = json.loads(expected) if isinstance(expected, str) else expected
    except ValueError:
        return False, "expected value is not valid JSON; give a JSON value or a schema"
    diff = json_diff(got, want)
    return (False, f"Mismatch: {diff}") if diff else (True, "parsed JSON equals the expected value")


def judge(output, case, rubric, call_model) -> tuple[bool, str]:
    """LLM-as-judge that fails closed: a verdict that isn't JSON is a fail, never a guess."""
    prompt = (
        f"TASK INPUT:\n{case['input']}\n\nEXPECTED ANSWER:\n{case['expected']}\n\n"
        f"MODEL OUTPUT:\n{output}\n\nRUBRIC:\n{rubric}"
    )
    raw = call_model(prompt, system=JUDGE_SYSTEM, temperature=0)
    match = re.search(r"\{.*\}", raw, re.S)
    try:
        verdict = json.loads(match.group(0)) if match else None
    except ValueError:
        verdict = None
    if not isinstance(verdict, dict):
        return False, "unscorable: the judge did not return JSON"
    return verdict.get("pass") is True, str(verdict.get("reason", ""))


def score(scorer, output, case, rubric="", call_model=None) -> tuple[bool, str]:
    """Score one output with the named scorer. Returns (passed, reason)."""
    expected = case.get("expected", "")
    if scorer == "exact":
        ok = exact(output, expected)
        return ok, "exact match" if ok else f"expected {expected!r}"
    if scorer == "contains":
        ok = contains(output, expected)
        return ok, "contains the expected answer" if ok else f"missing {expected!r}"
    if scorer == "contains_word":
        ok = contains_word(output, expected)
        return ok, "contains the expected answer as a whole word" if ok else f"missing {expected!r} as a whole word"
    if scorer == "numeric":
        return numeric(output, expected)
    if scorer == "regex":
        try:
            ok = regex(output, expected)
        except re.error as err:
            return False, f"invalid regex: {err}"
        return ok, "regex matched" if ok else "regex did not match"
    if scorer == "json":
        return json_scorer(output, case)
    if scorer == "judge":
        if call_model is None:
            raise ValueError("the judge scorer needs call_model")
        return judge(output, case, rubric or "The output is correct if it matches the meaning of the expected answer.", call_model)
    raise ValueError(f"unknown scorer {scorer!r}")
