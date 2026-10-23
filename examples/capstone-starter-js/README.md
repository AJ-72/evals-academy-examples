# Evals Academy capstone (JavaScript)

A complete, runnable eval to adapt for your capstone. No dependencies (Node 20+). Copy this folder
into a new **public** GitHub repository, make it yours, run it, and submit the repo URL.

```bash
node run-eval.mjs                     # MODEL_PROVIDER=mock by default: free dry run from fixtures/
npm test                              # the same eval as a test, gated on the threshold
MODEL_PROVIDER=openai OPENAI_API_KEY=sk-... node run-eval.mjs    # the real run you submit
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

The test uses Node's built-in runner, so there's nothing to install. If your team uses Vitest,
the same body works inside a Vitest `test(...)`: see `examples/js/sentiment.eval.test.mjs`.

## CI

`.github/workflows/eval.yml` runs `npm test` on every push and uploads `results.json`. Set the
repository variable `MODEL_PROVIDER` and the matching secret, for example `OPENAI_API_KEY`, to run
against a real model.

`model.mjs` and `scorers.mjs` are copies from the course's `examples/js`. Keep them as they are,
so your recorded verdicts match the capstone's re-check.
