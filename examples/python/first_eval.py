"""Lesson "What is an eval?": the smallest useful eval, runnable.

    MODEL_PROVIDER=mock python first_eval.py          # no key, no cost
    MODEL_PROVIDER=openai OPENAI_API_KEY=sk-... python first_eval.py
"""
from model import call_model
from scorers import contains

cases = [
    {"input": "What is the capital of France?", "expected": "Paris"},
    {"input": "What is 12 * 12?", "expected": "144"},
    {"input": "Who wrote Hamlet?", "expected": "Shakespeare"},
]

passed = 0
for case in cases:
    output = call_model(f"Answer the question with only the answer, no explanation.\n\nQuestion: {case['input']}")
    ok = contains(output, case["expected"])
    passed += ok
    print(f"{'PASS' if ok else 'FAIL'}  {case['input']!r} -> {output!r}")

print(f"pass rate: {passed / len(cases):.0%}")
