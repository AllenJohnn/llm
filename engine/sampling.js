// Sampling helpers.

export function argmax(a, chain = null, penalty = 1.0) {
  if (chain && penalty !== 1.0) {
    for (let i = Math.max(0, chain.length - 64); i < chain.length; i++) {
      const id = chain[i];
      if (a[id] > 0) a[id] /= penalty;
      else a[id] *= penalty;
    }
  }
  let bi = 0;
  for (let i = 1; i < a.length; i++) if (a[i] > a[bi]) bi = i;
  return bi;
}


// ---------- GPU kernel self-test ----------
// Runs a tiny synthetic Llama model through the f32, q8 and q4 kernel paths on
// the given device and compares logits with a CPU reference. Names the broken
// path on GPUs whose drivers/compilers disagree with the spec.
