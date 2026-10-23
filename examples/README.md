# Evals Academy: runnable examples

The code from the course, as files you can run. Everything works offline first: the
default `MODEL_PROVIDER=mock` answers from `fixtures/mock_answers.jsonl`, so you can check
the wiring for free, then switch to a real provider.

```bash
# Python 3.9+ (standard library only; pytest for the tests)
cd python
python first_eval.py
pip install pytest && pytest && pytest -m eval

# Node 20+ (no dependencies; Vitest only for the eval test)
cd js
node first-eval.mjs
node --test scorers.test.mjs
npm install && npm run test:eval
```

Then use a real model:

```bash
MODEL_PROVIDER=openai OPENAI_API_KEY=sk-... python first_eval.py
```

| `MODEL_PROVIDER` | Key variable | Default model (`MODEL_NAME` overrides) |
| --- | --- | --- |
| `mock` (default) | none | answers from fixtures |
| `openai` | `OPENAI_API_KEY` | `gpt-4o-mini` |
| `anthropic` | `ANTHROPIC_API_KEY` | `claude-haiku-4-5` |
| `openrouter` | `OPENROUTER_API_KEY` | a free model |
| `groq` | `GROQ_API_KEY` | `llama-3.1-8b-instant` |
| `huggingface` | `HF_TOKEN` | `meta-llama/Llama-3.2-3B-Instruct` |

Set `EVAL_CACHE_DIR=.eval-cache` while you develop, to replay responses for free. Turn it
off for real measurements: a cache replays one sample forever.

## What's here

| File | Lesson |
| --- | --- |
| `python/model.py`, `js/model.mjs` | The `model()` the lessons call: one function, every provider, plus the mock |
| `python/first_eval.py`, `js/first-eval.mjs` | What is an eval? |
| `python/scorers.py`, `js/scorers.mjs` | Deterministic vs model-based scoring; Why strings break; Structured outputs (parse, then schema); LLM-as-judge (fails closed) |
| `python/runner.py`, `js/runner.mjs` | Anatomy of a runner (result records, errors never count as passes) |
| `python/stats.py`, `js/stats.mjs` | Confidence intervals (Wilson); pass@k and pass^k |
| `python/test_sentiment_eval.py` + `pytest.ini`, `js/sentiment.eval.test.mjs` | Evals in your test runner (one aggregate assertion, kept out of the fast suite) |
| `python/metamorphic.py`, `js/metamorphic.mjs` | Metamorphic and property-based testing |
| `cases/sentiment.jsonl` | A small tagged golden set (partitions: negation, sarcasm, Spanish, mixed) |
| `capstone-starter/`, `capstone-starter-js/` | The capstone: copy one into a new public repo |

The scorers match the course playground exactly. The capstone re-scores recorded results with
the same rules, and the course's test suite checks that Python, JavaScript and the playground
agree on every scorer before any change is published here.

## The capstone starter

1. Copy `capstone-starter/` (Python) or `capstone-starter-js/` (Node) into a new **public**
   GitHub repository.
2. Edit `eval.config.json` (task, scorer, threshold) and `cases.jsonl` for a prompt or skill you
   actually care about.
3. Run it with a real provider (`python run_eval.py` or `node run-eval.mjs`) and commit the
   `results.json` it writes. Never edit that file by hand: the capstone re-scores every recorded
   output and rejects a file that disagrees with its scorer.
4. Submit the repo URL in the capstone form, with why you chose the scorer and what you changed
   after reading the failures.

The included GitHub Action runs the eval on every push and uploads `results.json`. Set the repository
variable `MODEL_PROVIDER` and the matching secret to use a real model in CI.
