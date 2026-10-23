// The statistics from the metrics module: intervals and pass@k.

/** Wilson score interval for a pass rate; well-behaved at small n and at 0% / 100%. */
export function wilson(passed, total, z = 1.96) {
  if (!total) return [0, 1];
  const p = passed / total;
  const denom = 1 + (z * z) / total;
  const centre = (p + (z * z) / (2 * total)) / denom;
  const margin = (z / denom) * Math.sqrt((p * (1 - p)) / total + (z * z) / (4 * total * total));
  return [Math.max(0, centre - margin), Math.min(1, centre + margin)];
}

function comb(n, k) {
  if (k < 0 || k > n) return 0;
  let r = 1;
  for (let i = 1; i <= k; i++) r = (r * (n - k + i)) / i;
  return r;
}

/** Unbiased pass@k from n samples with c correct (Chen et al., 2021). */
export const passAtK = (n, c, k) => (n - c < k ? 1 : 1 - comb(n - c, k) / comb(n, k));

/** Estimated probability that k fresh samples ALL pass: reliability, not capability. */
export const passHatK = (n, c, k) => (c < k ? 0 : comb(c, k) / comb(n, k));
