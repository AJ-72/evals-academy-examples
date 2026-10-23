"""Fast, offline unit tests for the scorers and statistics (no model calls)."""
import pytest

from scorers import contains, contains_word, exact, json_scorer, normalize, numeric, score
from stats import pass_at_k, pass_hat_k, wilson


def test_normalize_strips_case_quotes_and_trailing_punctuation():
    assert normalize('  "Paris."  ') == "paris"
    assert exact("Positive.", "positive")
    assert not exact("", "")


def test_contains_word_fixes_the_substring_false_pass():
    assert contains("The answer is 14.", "4")          # the trap
    assert not contains_word("The answer is 14.", "4")  # the fix
    assert contains_word("Answer: 4.", "4")
    assert contains_word("snake_case 4", "4")


def test_numeric_uses_the_final_number():
    assert numeric("First 3, then the total is 1,200.", "1200")[0]
    assert not numeric("I think 4, no wait, 14", "4")[0]
    assert numeric("no digits", "3") == (False, "no number in the output")


@pytest.mark.parametrize(
    "output, ok, reason",
    [
        ('{"age":30,"name":"John"}', True, "equals"),
        ('```json\n{"name": "John", "age": 30}\n```', True, "equals"),
        ("John is 30", False, "Parse error"),
        ('{"name":"John","age":"30"}', False, "$.age is string, expected integer"),
        ('{"name":"John"}', False, "$.age is missing"),
        ('{"name":"John","age":30,"x":1}', False, "$.x is not expected"),
    ],
)
def test_json_scorer_parses_then_compares(output, ok, reason):
    passed, why = json_scorer(output, {"expected": '{"name": "John", "age": 30}'})
    assert passed is ok
    assert reason in why


def test_json_scorer_schema_and_bool_is_not_a_number():
    schema = {"type": "object", "required": ["age"], "properties": {"age": {"type": "integer", "minimum": 0}},
              "additionalProperties": False}
    assert json_scorer('{"age": 3}', {"schema": schema})[0]
    assert "below the minimum" in json_scorer('{"age": -1}', {"schema": schema})[1]
    assert "is not allowed" in json_scorer('{"age": 1, "x": 2}', {"schema": schema})[1]
    assert not json_scorer("true", {"expected": "1"})[0]


def test_judge_fails_closed_on_prose():
    passed, reason = score("judge", "x", {"input": "q", "expected": "a"}, call_model=lambda *a, **k: "The output is not correct.")
    assert not passed and reason.startswith("unscorable")


def test_statistics():
    low, high = wilson(3, 3)
    assert round(low, 2) == 0.44 and high == 1.0
    assert pass_at_k(5, 1, 5) == 1.0
    assert pass_hat_k(5, 4, 5) == 0.0
    assert abs(pass_at_k(10, 3, 1) - 0.3) < 1e-12
