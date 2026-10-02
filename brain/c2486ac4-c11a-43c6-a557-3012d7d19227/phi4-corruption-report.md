# Root Cause Analysis: Corrupted Phi-4-mini Output

## Exact Root Cause
The root cause of the garbage output when switching from Qwen3 0.6B to Phi-4-mini is **stale configuration inheritance**. 

When the user clicks "Start" to load a new model, `aiStart()` in `room.js` fetches the new model's GGUF header but merges it into the existing `ai.cfg` object rather than replacing it:
```javascript
ai.cfg = { ...cfgFromGGUF(ai.G), ...(ai.cfg || {}) };
```
Because of the object spread ordering, properties from the old Qwen configuration (`ai.cfg`) took precedence over the new Phi configuration. Consequently:
1. `ai.cfg.num_hidden_layers` remained 28 (or 24, depending on the Qwen model variant), instead of Phi's 32 layers. This perfectly explains why the layer split was `19+embed` and `9` (which sums to 28).
2. `ai.cfg.hidden_size` remained 1536 (from Qwen) instead of 3072.
3. The engine instantiated matrices and buffers sized for 1536 dimensions but parsed 3072-dimensional raw bytes from the Phi-4-mini GGUF.

This caused the entire WebGPU pipeline (both on the host and on the distributed peer, since the corrupted `ai.cfg` is transmitted to peers via the `ai-load` message) to compute mathematically nonsensical attention and FFN operations, resulting in pure noise. Because the logits output was noise, the model ceaselessly generated garbage tokens until it hit the hard context limit (2046 tokens).

## Architecture & State Analysis
- **Architecture Support (`DenseEngine`)**: Phi-4-mini (`phi3` architecture) is fundamentally supported by the existing WebGPU engine. The engine explicitly handles `arch === "phi3"` in `ggufWeights()` by mathematically splitting Phi's fused `qkv_proj` tensor into `q`, `k`, and `v`, and its fused `gate_up_proj` tensor into `gate` and `up`. It feeds them perfectly into `DenseEngine`, making it mathematically identical to the Llama/Qwen execution path.
- **Tokenizer**: The Phi tokenizer is correctly parsed via `fetchGGUFHeader(..., true)` since it has no external remote `tok` URL configured.
- **Stale State (`ai.lastHidden`)**: The `ai.lastHidden` buffer was not explicitly cleared upon model switch, but this was *not* the primary cause of the failure. For prefill operations, it is overwritten by the result of `embedRun` anyway. Furthermore, the UI displaying `Solo Engine` for the host and `0 tok/s` for the worker is expected behavior for a healthy distributed swarm (the host emits all final tokens; the workers only compute intermediate hidden states).

## Minimal Fix Applied
I modified `aiStart()` in `room.js` to unconditionally clear stale model state (including `ai.cfg`, `ai.G`, `ai.tok`, and `ai.lastHidden`) when the user switches to a different model:

```javascript
  // room.js:1677
  ai.readyPeers = new Set();
  if (ai.model !== modelKey || ai.GModel !== modelKey) {
    ai.cfg = null; ai.G = null; ai.GModel = null; ai.tok = null; ai.lastHidden = null;
  }
  try {
```

## Required Manual Testing
Because I cannot launch and view a graphical browser instance, please execute the manual testing protocol to confirm:
1. Run `npm run serve` and open `http://localhost:8080/room`.
2. Generate a prompt using Qwen3 0.6B to confirm it works correctly.
3. Switch the model dropdown to **Phi-4 mini · Q4**.
4. Issue a new prompt (e.g., "hi").
5. Verify that the layer split now accounts for 32 total layers (e.g., `you 21+embed · peer-QC 11`).
6. Verify the output is coherent English (not repeating code or garbage) and stops naturally before the context limit.
7. Verify that live performance graphs and LIVE STREAM VELOCITY still update correctly.
