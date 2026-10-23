"""The capstone eval as a pytest test: runs every case, writes results.json, and
asserts the aggregate pass rate against the threshold in eval.config.json."""
import run_eval


def test_pass_rate_meets_threshold():
    record = run_eval.run()
    s = record["summary"]
    failures = [f"{r['input']!r}: {r['reason']} (got {r['output']!r})" for r in record["results"] if not r["passed"]]
    assert s["total"] >= 3, "the capstone needs at least 3 cases"
    assert s["passRate"] >= record["threshold"], (
        f"pass rate {s['passRate']:.0%} is below {record['threshold']:.0%}:\n" + "\n".join(failures)
    )
