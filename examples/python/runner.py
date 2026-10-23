"""A small eval runner: cases in, per-case result records and a summary out.

    python runner.py ../cases/sentiment.jsonl --scorer contains_word \
        --task "Classify the review as positive, negative or neutral. Reply with one word.\n\nReview: {input}"

It writes results.json in the format the capstone accepts (see ../capstone-starter).
"""
from __future__ import annotations

import argparse
import json
import pathlib
import time

from model import call_model, model_name, provider
from scorers import score
from stats import wilson


def load_cases(path) -> list[dict]:
    text = pathlib.Path(path).read_text(encoding="utf-8")
    if text.lstrip().startswith("["):
        return json.loads(text)
    return [json.loads(line) for line in text.splitlines() if line.strip()]


def build_prompt(task: str, case_input: str) -> str:
    return task.replace("{input}", case_input) if "{input}" in task else f"{task}\n\n{case_input}"


def run_eval(task, cases, scorer, rubric="", temperature=0.0) -> dict:
    """Run every case once and return {task, scorer, model, results, summary}."""
    results = []
    for case in cases:
        started = time.perf_counter()
        record = {"input": case["input"], "expected": case.get("expected", "")}
        if case.get("schema"):
            record["schema"] = case["schema"]
        try:
            output = call_model(build_prompt(task, case["input"]), temperature=temperature)
            passed, reason = score(scorer, output, case, rubric=rubric, call_model=call_model)
            record.update(output=output, passed=passed, reason=reason)
        except Exception as err:  # one failed call is an error record, never a crash or a pass
            record.update(output="", passed=False, reason=f"error: {err}", error=True)
        record["latency_ms"] = round((time.perf_counter() - started) * 1000)
        results.append(record)

    passed = sum(r["passed"] for r in results)
    low, high = wilson(passed, len(results))
    return {
        "task": task,
        "scorer": scorer,
        "provider": provider(),
        "model": model_name(),
        "temperature": temperature,
        "results": results,
        "summary": {"passed": passed, "total": len(results), "passRate": passed / len(results) if results else 0,
                    "ci95": [round(low, 3), round(high, 3)]},
    }


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("cases", help="JSONL (one case per line) or a JSON array")
    parser.add_argument("--task", required=True, help="prompt template with {input}")
    parser.add_argument("--scorer", default="contains_word")
    parser.add_argument("--rubric", default="")
    parser.add_argument("--out", default="results.json")
    args = parser.parse_args()

    run = run_eval(args.task.replace("\\n", "\n"), load_cases(args.cases), args.scorer, args.rubric)
    pathlib.Path(args.out).write_text(json.dumps(run, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    s = run["summary"]
    print(f"{s['passed']}/{s['total']} passed ({s['passRate']:.0%}, 95% CI {s['ci95'][0]:.0%}-{s['ci95'][1]:.0%}) -> {args.out}")
    for r in run["results"]:
        if not r["passed"]:
            print(f"  FAIL {r['input']!r}: {r['reason']} (got {r['output']!r})")


if __name__ == "__main__":
    main()
