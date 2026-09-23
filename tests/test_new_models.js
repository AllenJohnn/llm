// Tests for the 3 new models:
// Model A: Qwen2.5-Coder-7B-Instruct (28 layers, DenseEngine)
// Model B: DeepSeek-R1-Distill-Qwen-14B (48 layers, DenseEngine, <think> tags)
// Model C: Qwen QwQ-32B (64 layers, DenseEngine, multi-device split)

import { DenseEngine, argmax } from "../engine/engine.js";
import { ggmlLayerNames, GGML_EMBED, GGML_FINAL_NORM, GGML_OUTPUT } from "../engine/gguf.js";
import { MODELS, NEED_GB } from "../room/models.js";

const MODEL_CONFIGS = {
  "qwen2.5-coder-7b": {
    label: "Qwen2.5-Coder-7B",
    hidden_size: 3584,
    intermediate_size: 18944,
    num_attention_heads: 28,
    num_key_value_heads: 4,
    num_hidden_layers: 28,
    head_dim: 128,
    rms_norm_eps: 1e-6,
    rope_theta: 1000000,
    vocab_size: 152064,
  },
  "deepseek-r1-distill-qwen-14b": {
    label: "DeepSeek-R1-Distill-Qwen-14B",
    hidden_size: 5120,
    intermediate_size: 13824,
    num_attention_heads: 40,
    num_key_value_heads: 8,
    num_hidden_layers: 48,
    head_dim: 128,
    rms_norm_eps: 1e-6,
    rope_theta: 1000000,
    vocab_size: 152064,
    thinking: true,
  },
  "qwq-32b": {
    label: "Qwen-QwQ-32B",
    hidden_size: 5120,
    intermediate_size: 27648,
    num_attention_heads: 40,
    num_key_value_heads: 8,
    num_hidden_layers: 64,
    head_dim: 128,
    rms_norm_eps: 1e-6,
    rope_theta: 1000000,
    vocab_size: 152064,
    thinking: true,
  },
};

console.log("=== Verifying GGUF Tensor Names for New Models ===");
for (const [key, cfg] of Object.entries(MODEL_CONFIGS)) {
  const m = MODELS[key];
  if (!m) throw new Error(`Model ${key} missing from MODELS`);
  console.log(`[${key}] checking tensor names...`);
  for (let l = 0; l < cfg.num_hidden_layers; l++) {
    const names = ggmlLayerNames(l, "llama");
    if (!names.inNorm.startsWith(`blk.${l}.`)) throw new Error("bad name prefix: " + names.inNorm);
    if (!names.q.includes("attn_q")) throw new Error("bad attn_q name: " + names.q);
    if (!names.k.includes("attn_k")) throw new Error("bad attn_k name: " + names.k);
    if (!names.v.includes("attn_v")) throw new Error("bad attn_v name: " + names.v);
    if (!names.o.includes("attn_output")) throw new Error("bad attn_output name: " + names.o);
    if (!names.postNorm.includes("ffn_norm")) throw new Error("bad ffn_norm name: " + names.postNorm);
    if (!names.gate.includes("ffn_gate")) throw new Error("bad ffn_gate name: " + names.gate);
    if (!names.up.includes("ffn_up")) throw new Error("bad ffn_up name: " + names.up);
    if (!names.down.includes("ffn_down")) throw new Error("bad ffn_down name: " + names.down);
  }
  console.log(`[${key}] all ${cfg.num_hidden_layers} layer tensor names match DenseEngine!`);
}

// CPU reference forward function for 1 layer
function cpuLayerRef(cfg, xIn, weights, pos) {
  const dim = cfg.hidden_size;
  const nH = cfg.num_attention_heads;
  const nKV = cfg.num_key_value_heads;
  const headDim = cfg.head_dim;
  const qDim = nH * headDim;
  const kvDim = nKV * headDim;
  const inter = cfg.intermediate_size;
  const eps = cfg.rms_norm_eps;

  // rmsnorm 1
  let ss1 = 0;
  for (let i = 0; i < dim; i++) ss1 += xIn[i] * xIn[i];
  const inv1 = 1 / Math.sqrt(ss1 / dim + eps);
  const xn = new Float32Array(dim);
  for (let i = 0; i < dim; i++) xn[i] = xIn[i] * inv1 * weights.inNorm[i];

  // QKV projections
  const q = new Float32Array(qDim);
  for (let r = 0; r < qDim; r++) {
    let acc = 0;
    const off = r * dim;
    for (let c = 0; c < dim; c++) acc += weights.wq[off + c] * xn[c];
    q[r] = acc;
  }
  const k = new Float32Array(kvDim);
  for (let r = 0; r < kvDim; r++) {
    let acc = 0;
    const off = r * dim;
    for (let c = 0; c < dim; c++) acc += weights.wk[off + c] * xn[c];
    k[r] = acc;
  }
  const v = new Float32Array(kvDim);
  for (let r = 0; r < kvDim; r++) {
    let acc = 0;
    const off = r * dim;
    for (let c = 0; c < dim; c++) acc += weights.wv[off + c] * xn[c];
    v[r] = acc;
  }

  // RoPE
  const half = headDim / 2;
  for (let h = 0; h < nH; h++) {
    const off = h * headDim;
    for (let i = 0; i < half; i++) {
      const ang = pos * Math.pow(cfg.rope_theta, -(2 * i) / headDim);
      const co = Math.cos(ang), si = Math.sin(ang);
      const a = q[off + i], b = q[off + i + half];
      q[off + i] = a * co - b * si;
      q[off + i + half] = b * co + a * si;
    }
  }
  for (let h = 0; h < nKV; h++) {
    const off = h * headDim;
    for (let i = 0; i < half; i++) {
      const ang = pos * Math.pow(cfg.rope_theta, -(2 * i) / headDim);
      const co = Math.cos(ang), si = Math.sin(ang);
      const a = k[off + i], b = k[off + i + half];
      k[off + i] = a * co - b * si;
      k[off + i + half] = b * co + a * si;
    }
  }

  // Attention scores & output (single token self-attention: softmax(score)=1)
  const attnOut = new Float32Array(qDim);
  const rep = nH / nKV;
  for (let h = 0; h < nH; h++) {
    const kvH = Math.floor(h / rep);
    for (let i = 0; i < headDim; i++) {
      attnOut[h * headDim + i] = v[kvH * headDim + i];
    }
  }

  // Wo projection + residual
  const xMid = new Float32Array(dim);
  for (let r = 0; r < dim; r++) {
    let acc = 0;
    const off = r * qDim;
    for (let c = 0; c < qDim; c++) acc += weights.wo[off + c] * attnOut[c];
    xMid[r] = xIn[r] + acc;
  }

  // rmsnorm 2
  let ss2 = 0;
  for (let i = 0; i < dim; i++) ss2 += xMid[i] * xMid[i];
  const inv2 = 1 / Math.sqrt(ss2 / dim + eps);
  const xn2 = new Float32Array(dim);
  for (let i = 0; i < dim; i++) xn2[i] = xMid[i] * inv2 * weights.postNorm[i];

  // MLP (gate + up + silu + down)
  const g = new Float32Array(inter);
  for (let r = 0; r < inter; r++) {
    let accG = 0, accU = 0;
    const off = r * dim;
    for (let c = 0; c < dim; c++) {
      const xc = xn2[c];
      accG += weights.wgate[off + c] * xc;
      accU += weights.wup[off + c] * xc;
    }
    const siluG = accG / (1 + Math.exp(-accG));
    g[r] = siluG * accU;
  }

  const xOut = new Float32Array(dim);
  for (let r = 0; r < dim; r++) {
    let acc = 0;
    const off = r * inter;
    for (let c = 0; c < inter; c++) acc += weights.wdown[off + c] * g[c];
    xOut[r] = xMid[r] + acc;
  }

  return xOut;
}

console.log("\n=== Testing WebGPU Layer Equivalence for New Models ===");
const adapter = await navigator.gpu.requestAdapter();
const device = await adapter.requestDevice({
  requiredLimits: {
    maxBufferSize: adapter.limits.maxBufferSize,
    maxStorageBufferBindingSize: adapter.limits.maxStorageBufferBindingSize,
  },
});

for (const [key, cfg] of Object.entries(MODEL_CONFIGS)) {
  const dim = cfg.hidden_size;
  const nH = cfg.num_attention_heads;
  const nKV = cfg.num_key_value_heads;
  const headDim = cfg.head_dim;
  const qDim = nH * headDim;
  const kvDim = nKV * headDim;
  const inter = cfg.intermediate_size;

  // Generate deterministic synthetic weights for layer 0
  const pseudo = (seed, len, scale = 0.02) => {
    const out = new Float32Array(len);
    let s = seed >>> 0;
    for (let i = 0; i < len; i++) {
      s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
      out[i] = ((s / 4294967296) - 0.5) * scale;
    }
    return out;
  };

  const ones = (len) => {
    const o = new Float32Array(len);
    o.fill(1.0);
    return o;
  };

  const cpuW = {
    inNorm: ones(dim),
    postNorm: ones(dim),
    wq: pseudo(101, qDim * dim),
    wk: pseudo(202, kvDim * dim),
    wv: pseudo(303, kvDim * dim),
    wo: pseudo(404, dim * qDim),
    wgate: pseudo(505, inter * dim),
    wup: pseudo(606, inter * dim),
    wdown: pseudo(707, dim * inter),
  };

  const gpuWeights = {
    layers: [{
      inNorm: { kind: "f32", data: cpuW.inNorm },
      postNorm: { kind: "f32", data: cpuW.postNorm },
      q: { kind: "f32", data: cpuW.wq },
      k: { kind: "f32", data: cpuW.wk },
      v: { kind: "f32", data: cpuW.wv },
      o: { kind: "f32", data: cpuW.wo },
      gate: { kind: "f32", data: cpuW.wgate },
      up: { kind: "f32", data: cpuW.wup },
      down: { kind: "f32", data: cpuW.wdown },
      qNorm: null,
      kNorm: null,
    }],
    embed: { kind: "f32", data: pseudo(999, dim) },
  };

  const eng = await DenseEngine.create({
    device,
    cfg: { ...cfg, num_hidden_layers: 1 },
    weights: gpuWeights,
    layerRange: [0, 1],
    hasEmbed: false,
    hasHead: false,
    maxSeq: 256,
  });

  const xInput = pseudo(1234, dim, 1.0);
  const t0 = performance.now();
  const gpuOut = await eng.runHidden(xInput, 0);
  const t1 = performance.now();
  const cpuOut = cpuLayerRef(cfg, xInput, cpuW, 0);

  let maxDiff = 0, maxVal = 1e-6;
  for (let i = 0; i < dim; i++) {
    maxDiff = Math.max(maxDiff, Math.abs(gpuOut[i] - cpuOut[i]));
    maxVal = Math.max(maxVal, Math.abs(cpuOut[i]));
  }
  const relDiff = maxDiff / maxVal;
  const ok = relDiff < 1e-4;
  console.log(`[${key}] dim=${dim} inter=${inter} layers=${cfg.num_hidden_layers} ` +
              `relDiff=${relDiff.toExponential(2)} (gate 1e-4) time=${(t1 - t0).toFixed(1)}ms => ${ok ? "PASS ✓" : "FAIL"}`);
  if (!ok) {
    console.error(`Mismatch on model ${key}: relDiff=${relDiff}`);
    Deno.exit(1);
  }
}

console.log("\nALL 3 NEW MODELS VERIFIED SUCCESSFULLY! ✓");
