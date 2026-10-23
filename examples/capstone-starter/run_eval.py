"""Run the capstone eval and write results.json -- the file the Evals Academy capstone reads.

    MODEL_PROVIDER=mock python run_eval.py                         # free dry run with fixtures
    MODEL_PROVIDER=openai OPENAI_API_KEY=sk-... python run_eval.py  # the real run you submit

Edit eval.config.json (task, scorer, threshold) and cases.jsonl, never results.json by hand:
the capstone re-scores every recorded output and rejects a file that disagrees with its scorer.
Exits 1 when the pass rate is below the threshold, so it doubles as a CI gate.
"""
from __future__ import annotations

import json
import pathlib
import sys

from model import call_model, model_name, provider
from scorers import score

HERE = pathlib.Path(__file__).resolve().parent


def run(config_path=HERE / "eval.config.json", cases_path=HERE / "cases.jsonl", out_path=HERE / "results.json") -> dict:
    config = json.loads(pathlib.Path(config_path).read_text(encoding="utf-8"))
    cases = [json.loads(line) for line in pathlib.Path(cases_path).read_text(encoding="utf-8").splitlines() if line.strip()]
    task, scorer = config["task"], config["scorer"]
    if "{input}" not in task:
        raise SystemExit("eval.config.json: the task needs an {input} placeholder")

    results = []
    for case in cases:
        record = {"input": case["input"], "expected": case.get("expected", "")}
        if case.get("schema"):
            record["schema"] = case["schema"]
        try:
            output = call_model(task.replace("{input}", case["input"]), temperature=config.get("temperature", 0))
            passed, reason = score(scorer, output, case, rubric=config.get("rubric", ""), call_model=call_model)
            record.update(output=output, passed=passed, reason=reason)
        except Exception as err:  # an error is a recorded failure, never a pass
            record.update(output="", passed=False, reason=f"error: {err}", error=True)
        results.append(record)

    passed = sum(r["passed"] for r in results)
    run_record = {
        "task": task,
        "scorer": scorer,
        "provider": provider(),
        "model": model_name(),
        "temperature": config.get("temperature", 0),
        "threshold": config.get("threshold", 0.8),
        "results": results,
        "summary": {"passed": passed, "total": len(results), "passRate": passed / len(results)},
    }
    pathlib.Path(out_path).write_text(json.dumps(run_record, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    return run_record


if __name__ == "__main__":
    record = run()
    s = record["summary"]
    print(f"{s['passed']}/{s['total']} passed ({s['passRate']:.0%}) with {record['provider']}:{record['model']} -> results.json")
    for r in record["results"]:
        if not r["passed"]:
            print(f"  FAIL {r['input']!r}: {r['reason']} (got {r['output']!r})")
    sys.exit(0 if s["passRate"] >= record["threshold"] else 1)
