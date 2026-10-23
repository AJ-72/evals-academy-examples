"""Lesson "Metamorphic and property-based testing": relations instead of labels.

    MODEL_PROVIDER=mock python metamorphic.py
"""
from model import call_model

TASK = "Classify the review as positive, negative or neutral. Reply with one word.\n\nReview: {input}"

# name -> (transformation, whether the label must stay the "same" or become "different")
RELATIONS = {
    "add_irrelevant_context": (lambda t: t + " The parking lot is on 5th Street.", "same"),
    "shout": (lambda t: t.upper(), "same"),
    "negate": (lambda t: t.replace(" was ", " was not ", 1), "different"),
}


def classify(text: str) -> str:
    return call_model(TASK.replace("{input}", text)).strip().lower().rstrip(".")


def check_relations(sources: list[str]) -> list[tuple]:
    violations = []
    for text in sources:
        base = classify(text)
        for name, (transform, expect) in RELATIONS.items():
            follow = classify(transform(text))
            if (expect == "same") != (follow == base):
                violations.append((name, text, base, follow))
    return violations


if __name__ == "__main__":
    sources = ["The food was great.", "The service was slow and rude."]
    found = check_relations(sources)
    total = len(sources) * len(RELATIONS)
    print(f"{total - len(found)}/{total} relations held")
    for name, text, base, follow in found:
        print(f"  VIOLATION {name}: {text!r}: {base!r} -> {follow!r}")
