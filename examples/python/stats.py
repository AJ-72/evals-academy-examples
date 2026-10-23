"""The statistics from the metrics module: intervals and pass@k."""
from __future__ import annotations

import math


def wilson(passed: int, total: int, z: float = 1.96) -> tuple[float, float]:
    """Wilson score interval for a pass rate; well-behaved at small n and at 0% / 100%."""
    if total == 0:
        return 0.0, 1.0
    p = passed / total
    denom = 1 + z * z / total
    centre = (p + z * z / (2 * total)) / denom
    margin = z / denom * math.sqrt(p * (1 - p) / total + z * z / (4 * total * total))
    return max(0.0, centre - margin), min(1.0, centre + margin)


def pass_at_k(n: int, c: int, k: int) -> float:
    """Unbiased pass@k from n samples with c correct (Chen et al., 2021)."""
    if n - c < k:
        return 1.0
    return 1.0 - math.comb(n - c, k) / math.comb(n, k)


def pass_hat_k(n: int, c: int, k: int) -> float:
    """Estimated probability that k fresh samples ALL pass: reliability, not capability."""
    if c < k:
        return 0.0
    return math.comb(c, k) / math.comb(n, k)
