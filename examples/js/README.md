# JavaScript examples

No dependencies to run the examples; Vitest only for the eval test. Node 20+.

```bash
node first-eval.mjs                  # MODEL_PROVIDER=mock by default: no key, no cost
node metamorphic.mjs                 # metamorphic relations against the same model()
node --test scorers.test.mjs         # fast suite: scorers and stats, no model calls
npm install && npm run test:eval     # the eval itself in Vitest (RUN_EVALS=1)
MODEL_PROVIDER=openai OPENAI_API_KEY=sk-... node first-eval.mjs
```

| File | What it shows | Lesson |
| --- | --- | --- |
| `model.mjs` | `callModel()`: one function for every provider, plus the offline mock | used by every example |
| `first-eval.mjs` | Three cases, one scorer, a pass rate | What is an eval? |
| `scorers.mjs` | `exact`, `contains`, `contains_word`, `numeric`, `regex`, `json` (value or schema), `judge` (fails closed) | Deterministic vs model-based scoring; Why strings break; Structured outputs; LLM-as-judge |
| `runner.mjs` | Result records; a model error is never counted as a pass | Anatomy of a runner |
| `stats.mjs` | Wilson confidence interval, pass@k and pass^k | Confidence intervals; pass@k |
| `scorers.test.mjs` | Unit tests for the scorers and stats (`node --test`) | Evals in your test runner |
| `sentiment.eval.test.mjs`, `vitest.config.mjs` | The eval as one aggregate assertion, skipped unless `RUN_EVALS=1` | Evals in your test runner |
| `metamorphic.mjs` | Relations that must hold without a labelled answer | Metamorphic and property-based testing |

Cases come from `../cases/` and mock answers from `../fixtures/`. See the
[examples README](../README.md) for providers and the response cache.
