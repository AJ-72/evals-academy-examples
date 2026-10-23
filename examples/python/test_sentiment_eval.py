"""Lesson "Evals in your test runner": one eval, one aggregate assertion.

    pytest                 # unit tests only (evals are deselected in pytest.ini)
    pytest -m eval         # run the eval (MODEL_PROVIDER=mock by default: free and offline)
"""
import pathlib

import pytest

from model import call_model
from runner import build_prompt, load_cases
from scorers import contains_word

TASK = "Classify the review as positive, negative or neutral. Reply with one word.\n\nReview: {input}"
CASES = load_cases(pathlib.Path(__file__).parent.parent / "cases" / "sentiment.jsonl")
THRESHOLD = 0.75  # agreed before the run, from a baseline -- not tuned afterwards


@pytest.mark.eval
def test_sentiment_pass_rate():
    failures = []
    for case in CASES:
        output = call_model(build_prompt(TASK, case["input"]), temperature=0)
        if not contains_word(output, case["expected"]):
            failures.append(f"{case['input']!r}: expected {case['expected']!r}, got {output!r}")
    rate = 1 - len(failures) / len(CASES)
    print(f"pass rate {rate:.0%} on {len(CASES)} cases")
    assert rate >= THRESHOLD, f"pass rate {rate:.0%} < {THRESHOLD:.0%}\n" + "\n".join(failures)
