"""Lesson "Record, replay, and trace": save each model call once, then re-run the eval from the saved files.

    MODEL_PROVIDER=mock python record_replay.py record     # run 1: calls the model, saves one file per case
    MODEL_PROVIDER=mock python record_replay.py replay     # run 2: same results, zero model calls
    MODEL_PROVIDER=mock python record_replay.py replay --prompt v2   # prompt changed: replay fails on purpose
    MODEL_PROVIDER=mock python record_replay.py record --prompt v2 --dir recordings-v2   # re-record on purpose

Recordings are plain JSON you can open, review and commit. The JS version
(record-replay.mjs) writes byte-identical files, so either one can replay the other's.
"""
from __future__ import annotations

import argparse
import hashlib
import json
import pathlib
import sys

from model import call_model, model_name, provider
from scorers import contains

# The system under test: a support bot for a shoe shop. Two versions of its prompt.
PROMPTS = {
    "v1": "You are the support assistant for a shoe shop. Refund policy: 30 days, with a receipt. "
          "Answer the customer in one sentence.\n\nCustomer: {input}",
    "v2": "You are the friendly support assistant for a shoe shop. Refund policy: 30 days, with a receipt. "
          "Answer the customer in one short sentence.\n\nCustomer: {input}",
}
PARAMS = {"temperature": 0, "max_tokens": 200}

CASES = [
    {"id": "refund-in-window", "input": "I bought trainers 20 days ago. Can I get a refund?", "expected": "yes"},
    {"id": "refund-too-late", "input": "I bought boots 45 days ago. Can I return them?", "expected": "no"},
    {"id": "no-receipt", "input": "I lost my receipt. Can I still get a refund?", "expected": "receipt"},
]


def recording_key(prompt: str, model: str, params: dict) -> str:
    """Everything that changes the answer goes into the key. Compact JSON so Python and JS agree."""
    raw = json.dumps({"prompt": prompt, "model": model, "params": params}, separators=(",", ":"), ensure_ascii=False)
    return hashlib.sha256(raw.encode("utf-8")).hexdigest()[:12]


class ReplayMiss(Exception):
    """A replay asked for a call that was never recorded. This is a failed test, never a live call."""


def get_output(case: dict, prompt: str, mode: str, folder: pathlib.Path, stats: dict) -> str:
    model = f"{provider()}/{model_name()}"
    path = folder / f"{case['id']}.{recording_key(prompt, model, PARAMS)}.json"

    if mode == "replay":
        if path.exists():
            return json.loads(path.read_text(encoding="utf-8"))["output"]
        stale = sorted(folder.glob(f"{case['id']}.*.json"))
        why = ("a recording exists, but the prompt, model or params changed since it was made"
               if stale else "this case was never recorded")
        raise ReplayMiss(f"no recording for {case['id']}: {why}")

    output = call_model(prompt, temperature=PARAMS["temperature"], max_tokens=PARAMS["max_tokens"])
    stats["model_calls"] += 1
    folder.mkdir(parents=True, exist_ok=True)
    record = {"case": case["id"], "model": model, "params": PARAMS, "prompt": prompt, "output": output}
    # write_bytes keeps "\n" line endings on every OS, so the files match the JS version byte for byte
    path.write_bytes((json.dumps(record, indent=2, ensure_ascii=False) + "\n").encode("utf-8"))
    return output


def run(mode: str, prompt_version: str, folder: pathlib.Path) -> int:
    stats = {"model_calls": 0, "misses": 0}
    passed = 0
    for case in CASES:
        prompt = PROMPTS[prompt_version].replace("{input}", case["input"])
        try:
            output = get_output(case, prompt, mode, folder, stats)
        except ReplayMiss as miss:
            print(f"  FAIL  {miss}")
            stats["misses"] += 1
            continue
        ok = contains(output, case["expected"])
        passed += ok
        print(f"  {'pass' if ok else 'FAIL'}  {case['id']}: {output}")
    print(f"{mode} ({prompt_version}): {passed}/{len(CASES)} passed, {stats['model_calls']} model calls, files in {folder}/")
    if stats["misses"]:
        print("If that change was on purpose, record again (into a new --dir) and compare the two runs.")
    return 0 if passed == len(CASES) else 1


if __name__ == "__main__":
    ap = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    ap.add_argument("mode", choices=["record", "replay"])
    ap.add_argument("--prompt", choices=sorted(PROMPTS), default="v1")
    ap.add_argument("--dir", default="recordings")
    args = ap.parse_args()
    sys.exit(run(args.mode, args.prompt, pathlib.Path(args.dir)))
