# Evals Academy examples

Runnable companion code for [Evals Academy](https://evals.academy), a free course on
evaluating AI features. Every lesson with code links to a file in [`examples/`](examples/).

- [`examples/python/`](examples/python/) — standard-library Python 3.9+, `pytest` for the tests
- [`examples/js/`](examples/js/) — Node 20+, no dependencies (Vitest only for the eval test)
- [`examples/cases/`](examples/cases/) — a small tagged golden set shared by both
- [`examples/fixtures/`](examples/fixtures/) — mock answers, so everything runs offline first
- [`examples/capstone-starter/`](examples/capstone-starter/) and
  [`examples/capstone-starter-js/`](examples/capstone-starter-js/) — copy one into your own
  public repo for the capstone

## Quick start

```bash
git clone https://github.com/AJ-72/evals-academy-examples
cd evals-academy-examples/examples/python
python first_eval.py          # MODEL_PROVIDER=mock by default: no key, no cost
```

```bash
cd evals-academy-examples/examples/js
node first-eval.mjs
```

Then add a key for a real model, for example
`MODEL_PROVIDER=openai OPENAI_API_KEY=sk-... python first_eval.py`. The
[examples README](examples/README.md) lists every provider, what each file covers, and how
to run the capstone.

This repository is published from the course's source; open an issue or use "Send feedback"
on the course site if something here doesn't run.
