# Evals Academy capstone (Python)

A complete, runnable eval to adapt for your capstone. Copy this folder into a new **public**
GitHub repository, make it yours, run it, and submit the repo URL.

```bash
python run_eval.py                    # MODEL_PROVIDER=mock by default: free dry run from fixtures/
pip install pytest && pytest -q       # the same eval as a test, gated on the threshold
MODEL_PROVIDER=openai OPENAI_API_KEY=sk-... python run_eval.py   # the real run you submit
```

## Make it yours

1. **Pick a real task**, ideally a prompt or skill you work on. Put the prompt in
   `eval.config.json` as `task`, with `{input}` where each case goes.
2. **Write cases** in `cases.jsonl`, one `{"input": ..., "expected": ...}` per line, from real
   inputs and real failures. Cover partitions and boundaries, not just the happy path.
3. **Choose the scorer on purpose**: `exact`, `contains`, `contains_word`, `numeric`, `regex`,
   `json` (a case may give a `schema` instead of `expected`) or `judge` (set `rubric`).
4. **Run it with a real model**, read every failure, change one thing, and run it again.
5. **Commit `results.json`** from your final run. Don't edit it by hand: the capstone re-scores
   each recorded output with the same scorer and rejects a file that disagrees.

Replace `fixtures/mock_answers.jsonl` with answers for your own cases if you want the mock dry
run (and CI without a key) to keep working.

## CI

`.github/workflows/eval.yml` runs `pytest` on every push and uploads `results.json`. Set the
repository variable `MODEL_PROVIDER` (`openai`, `anthropic`, `openrouter`, `groq`, `huggingface`)
and the matching secret, for example `OPENAI_API_KEY`, to run against a real model.

`model.py` and `scorers.py` are copies from the course's `examples/python`. Keep them as they are,
so your recorded verdicts match the capstone's re-check.
