# Python examples

Standard library only; `pytest` for the tests. Python 3.9+.

```bash
python first_eval.py                 # MODEL_PROVIDER=mock by default: no key, no cost
python metamorphic.py                # metamorphic relations against the same model()
pip install pytest
pytest                               # fast suite: scorers and stats, no model calls
pytest -m eval                       # the eval itself, kept out of the fast suite
MODEL_PROVIDER=openai OPENAI_API_KEY=sk-... python first_eval.py
```

| File | What it shows | Lesson |
| --- | --- | --- |
| `model.py` | `call_model()`: one function for every provider, plus the offline mock | used by every example |
| `first_eval.py` | Three cases, one scorer, a pass rate | What is an eval? |
| `scorers.py` | `exact`, `contains`, `contains_word`, `numeric`, `regex`, `json` (value or schema), `judge` (fails closed) | Deterministic vs model-based scoring; Why strings break; Structured outputs; LLM-as-judge |
| `runner.py` | Result records; a model error is never counted as a pass | Anatomy of a runner |
| `stats.py` | Wilson confidence interval, pass@k and pass^k | Confidence intervals; pass@k |
| `test_scorers.py` | Unit tests for the scorers and stats | Evals in your test runner |
| `test_sentiment_eval.py`, `pytest.ini` | The eval as one aggregate assertion behind the `eval` marker | Evals in your test runner |
| `metamorphic.py` | Relations that must hold without a labelled answer | Metamorphic and property-based testing |

Cases come from `../cases/` and mock answers from `../fixtures/`. See the
[examples README](../README.md) for providers and the response cache.
