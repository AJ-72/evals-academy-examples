"""One function, call_model(), for every provider the course uses. Standard library only.

    MODEL_PROVIDER   openai | anthropic | openrouter | groq | huggingface | mock   (default: mock)
    MODEL_NAME       override the provider's default model
    MODEL_BASE_URL   override the base URL of an OpenAI-compatible provider
    EVAL_CACHE_DIR   cache responses on disk (development only; see the test-runner lesson)
    MOCK_ANSWERS     JSONL fixtures for the mock provider (default: fixtures/ here, else ../fixtures/)

Keys come from OPENAI_API_KEY, ANTHROPIC_API_KEY, OPENROUTER_API_KEY, GROQ_API_KEY or HF_TOKEN.
The mock provider needs no key and no network: it answers from fixtures, so tests and CI can
check the wiring for free before you spend anything on a real model.
"""
from __future__ import annotations

import hashlib
import json
import os
import pathlib
import re
import urllib.request

OPENAI_COMPATIBLE = {
    "openai": ("https://api.openai.com/v1", "gpt-4o-mini", "OPENAI_API_KEY"),
    "openrouter": ("https://openrouter.ai/api/v1", "google/gemma-4-31b-it:free", "OPENROUTER_API_KEY"),
    "groq": ("https://api.groq.com/openai/v1", "llama-3.1-8b-instant", "GROQ_API_KEY"),
    "huggingface": ("https://router.huggingface.co/v1", "meta-llama/Llama-3.2-3B-Instruct", "HF_TOKEN"),
}
ANTHROPIC = ("https://api.anthropic.com", "claude-haiku-4-5", "ANTHROPIC_API_KEY")
JUDGE_MARKER = "ONLY a JSON object"
HERE = pathlib.Path(__file__).resolve().parent


def provider() -> str:
    return os.environ.get("MODEL_PROVIDER", "mock").strip().lower()


def model_name() -> str:
    p = provider()
    default = ANTHROPIC[1] if p == "anthropic" else OPENAI_COMPATIBLE.get(p, ("", "mock", ""))[1]
    return os.environ.get("MODEL_NAME") or default


def call_model(prompt: str, system: str | None = None, temperature: float = 0, max_tokens: int = 512) -> str:
    """Send one prompt (plus an optional system prompt) and return the reply text."""
    cache_dir = os.environ.get("EVAL_CACHE_DIR")
    key = hashlib.sha256(json.dumps([provider(), model_name(), system, prompt, temperature]).encode()).hexdigest()
    if cache_dir:
        hit = pathlib.Path(cache_dir) / f"{key}.json"
        if hit.exists():
            return json.loads(hit.read_text(encoding="utf-8"))["output"]

    output = _call(prompt, system, temperature, max_tokens)

    if cache_dir:
        pathlib.Path(cache_dir).mkdir(parents=True, exist_ok=True)
        (pathlib.Path(cache_dir) / f"{key}.json").write_text(json.dumps({"output": output}), encoding="utf-8")
    return output


def _call(prompt, system, temperature, max_tokens):
    p = provider()
    if p == "mock":
        return mock_reply(prompt, system)
    if p == "anthropic":
        base, _, env = ANTHROPIC
        body = {"model": model_name(), "max_tokens": max_tokens, "temperature": temperature,
                "messages": [{"role": "user", "content": prompt}]}
        if system:
            body["system"] = system
        data = _post(f"{base}/v1/messages", body, {"x-api-key": _key(env), "anthropic-version": "2023-06-01"})
        return "".join(b.get("text", "") for b in data.get("content", []) if b.get("type") == "text")
    if p not in OPENAI_COMPATIBLE:
        raise ValueError(f"Unknown MODEL_PROVIDER {p!r}; use one of: mock, anthropic, {', '.join(OPENAI_COMPATIBLE)}")
    base, _, env = OPENAI_COMPATIBLE[p]
    base = os.environ.get("MODEL_BASE_URL", base).rstrip("/")
    messages = ([{"role": "system", "content": system}] if system else []) + [{"role": "user", "content": prompt}]
    body = {"model": model_name(), "messages": messages, "temperature": temperature, "max_tokens": max_tokens}
    data = _post(f"{base}/chat/completions", body, {"authorization": f"Bearer {_key(env)}"})
    return data["choices"][0]["message"]["content"] or ""


def _key(env: str) -> str:
    value = os.environ.get(env)
    if not value:
        raise RuntimeError(f"{env} is not set (MODEL_PROVIDER={provider()}). Set it, or use MODEL_PROVIDER=mock.")
    return value


def _post(url: str, body: dict, headers: dict) -> dict:
    req = urllib.request.Request(url, data=json.dumps(body).encode(), method="POST",
                                 headers={"content-type": "application/json", **headers})
    with urllib.request.urlopen(req, timeout=60) as res:
        return json.loads(res.read())


# --------------------------------------------------------------------------- mock
def _fixtures() -> list[dict]:
    # MOCK_ANSWERS, else fixtures/ next to this file (capstone starter), else one level up (examples/).
    candidates = [os.environ.get("MOCK_ANSWERS"), HERE / "fixtures" / "mock_answers.jsonl", HERE.parent / "fixtures" / "mock_answers.jsonl"]
    path = next((pathlib.Path(c) for c in candidates if c and pathlib.Path(c).exists()), None)
    if path is None:
        return []
    return [json.loads(line) for line in path.read_text(encoding="utf-8").splitlines() if line.strip()]


def mock_reply(prompt: str, system: str | None = None) -> str:
    """Deterministic stand-in for a model: the first fixture whose `match` appears in
    the prompt wins. Judge prompts get a verdict: pass when the expected answer
    appears in the model output being judged."""
    if system and JUDGE_MARKER in system:
        expected = re.search(r"EXPECTED ANSWER:\n(.*?)\n\n", prompt, re.S)
        output = re.search(r"MODEL OUTPUT:\n(.*?)\n\nRUBRIC:", prompt, re.S)
        ok = bool(expected and output and expected.group(1).strip().lower() in output.group(1).lower())
        return json.dumps({"pass": ok, "score": 1 if ok else 0, "reason": "mock judge: expected answer " + ("found" if ok else "not found")})
    for fixture in _fixtures():
        if fixture["match"] in prompt:
            return fixture["output"]
    return "I don't know."
