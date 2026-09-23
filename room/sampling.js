// Top-k / temperature sampling over a logits vector with repetition penalty (host CPU).

export function aiSample(logits, temp = 0.8, topk = 40, recentTokens = [], repPenalty = 1.15) {
  // Apply repetition penalty to recent tokens
  if (repPenalty !== 1.0 && recentTokens && recentTokens.length > 0) {
    const window = recentTokens.slice(-64);
    const seen = new Set(window);
    for (const id of seen) {
      if (id >= 0 && id < logits.length) {
        if (logits[id] > 0) logits[id] /= repPenalty;
        else logits[id] *= repPenalty;
      }
    }
  }

  // single-pass top-k selection: sorting all 248k logit indices cost tens of
  // milliseconds per token; this is O(n) with a tiny candidate table.
  const idx = new Int32Array(topk), val = new Float32Array(topk).fill(-Infinity);
  let min = -Infinity, minAt = 0;
  for (let i = 0; i < logits.length; i++) {
    const v = logits[i];
    if (v > min) {
      idx[minAt] = i; val[minAt] = v;
      min = val[0]; minAt = 0;
      for (let j = 1; j < topk; j++) if (val[j] < min) { min = val[j]; minAt = j; }
    }
  }
  const order = [...idx.keys()].sort((a, b) => val[b] - val[a]);
  const mx = val[order[0]];
  const ps = order.map((j) => Math.exp((val[j] - mx) / temp));
  const sum = ps.reduce((a, b) => a + b, 0);
  let r = Math.random() * sum;
  for (let i = 0; i < order.length; i++) { r -= ps[i]; if (r <= 0) return idx[order[i]]; }
  return idx[order[0]];
}
