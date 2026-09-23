import { MODELS, NEED_GB, LOCAL_CANDIDATES, detectLocalModel } from "../../room/models.js";

const assert = (cond, msg) => { if (!cond) throw new Error(msg || "assertion failed"); };

Deno.test("models: catalog has all 7 expected models", () => {
  const expected = ["qwen3-0.6b", "qwen3-1.7b", "qwen3-4b", "qwen2.5-coder-1.5b", "phi-4-mini", "qwen3.8-27b", "smollm-135m"];
  for (const k of expected) {
    assert(MODELS[k], `Missing model key: ${k}`);
    assert(NEED_GB[k] > 0, `Missing NEED_GB for: ${k}`);
  }
});

Deno.test("models: Qwen2.5 Coder uses the fast mirror and has an HF fallback", () => {
  const m = MODELS["qwen2.5-coder-1.5b"];
  assert(m.gguf.startsWith("https://hf-mirror.com/"), "Qwen2.5 Coder should prefer the fast mirror");
  assert(m.ggufFallback.startsWith("https://huggingface.co/"), "Qwen2.5 Coder fallback URL missing");
  assert(NEED_GB["qwen2.5-coder-1.5b"] >= 1.5, "Qwen2.5 Coder memory pledge missing");
});

Deno.test("models: Phi-4 mini uses Phi3 GGUF path and fits a multi-GB room", () => {
  assert(MODELS["phi-4-mini"].arch === "phi3", "Phi-4 mini must use the Phi3 GGUF mapping");
  assert(MODELS["phi-4-mini"].gguf.endsWith("/microsoft_Phi-4-mini-instruct-Q4_0.gguf"), "Phi-4 mini Q4 GGUF URL missing");
  assert(NEED_GB["phi-4-mini"] >= 3, "Phi-4 mini pledge should include weights and runtime memory");
});

Deno.test("models: local candidates defined for all models", () => {
  for (const k of Object.keys(MODELS)) {
    assert(Array.isArray(LOCAL_CANDIDATES[k]), `LOCAL_CANDIDATES missing array for: ${k}`);
    assert(LOCAL_CANDIDATES[k].length > 0, `LOCAL_CANDIDATES empty for: ${k}`);
  }
});

Deno.test("models: detectLocalModel gracefully handles unreachable local files", async () => {
  const res = await detectLocalModel("non-existent-model");
  assert(res === null, "should return null for non-existent model");
});
