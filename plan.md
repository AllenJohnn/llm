# SwarmLLM Project Progress & Execution Plan

**Last Updated:** 2026-09-24  
**Target Repository:** https://github.com/AllenJohnn/llm  

---

## 1. Project Mission & Architecture Overview
**SwarmLLM** is a decentralized, browser-native LLM inference engine. Multiple client devices (laptops, phones, desktops) join a shared WebRTC room, divide the transformer layers according to their available WebGPU memory (e.g. Host gets layers 0–13 + embeddings/head, Worker gets layers 14–27), and stream activations in a pipeline to execute inference cooperatively.

---

## 2. Complete Chronological Progress (What Has Been Accomplished)

### Milestone 1: Routing & Local Server Setup
- Created [`serve.json`](file:///D:/New%20folder/swarmllm/serve.json) configuring clean rewrites from `/room` to `/room/index.html`.
- Created [`room/index.html`](file:///D:/New%20folder/swarmllm/room/index.html) as a standalone entrypoint matching [`p2p.html`](file:///D:/New%20folder/swarmllm/p2p.html).

### Milestone 2: UI Button Interactivity & Diagnostic Loader
- Added direct inline event handlers `window.swarmStart(create)` and `window.stepGB(delta)`.
- Created a pre-flight diagnostic module loader that verifies network access, checks MIME types, and imports submodules cleanly with visible error banners if any script fails.

### Milestone 3: Ad-Blocker False Positive Fix
- Renamed `engine/quant.js` to [`engine/quantize.js`](file:///D:/New%20folder/swarmllm/engine/quantize.js) to prevent Brave Shields / EasyPrivacy from blocking it as Quantcast tracker (`/quant.js`).
- Updated all import statements across [`engine/engine.js`](file:///D:/New%20folder/swarmllm/engine/engine.js) and [`engine/selftest.js`](file:///D:/New%20folder/swarmllm/engine/selftest.js).

### Milestone 4: Fix `pipeline timeout (batch prefill)`
- Switched default `WIRE` to `"slice"` instead of `stripe4` to avoid uncoordinated channel packet drops.
- Added active peer pruning in `conn.on("close")` and at the start of `aiGenerate()`.
- Wrapped worker activation chunks in bounds clamping and error reporting.
- Wrapped batched prefill in a 15s timeout with automatic graceful fallback to sequential token prefill via `aiPipeToken`.

### Milestone 5: WebRTC ICE & Relay Traversal Hardening
- Added redundant STUN servers (Google, Cloudflare, Twilio) and free OpenRelay TURN servers across UDP and TCP ports 80/443 in `ICE.iceServers`.
- Increased negotiation window to 35s with real-time state tracking on `conn.peerConnection.iceConnectionState`.
- Resolved `.open` race conditions on both host and joiner links.

### Milestone 6: Clean Project Identity & Single-Author Repository
- Rebranded author metadata, LICENSE copyright, AUTHORS, CITATION, package.json, and documentation links.
- Reset git commit graph into a clean single initial root commit authored exclusively by `AllenJohnn <allenjohnjoy2004@gmail.com>`.
- Pointed repository remote strictly to `https://github.com/AllenJohnn/llm.git`.

### Milestone 7: Syntax Error & Link Fixes
- Fixed missing closing brace in `room.js` line 1565 in `aiStart()` that previously triggered `Unexpected token 'catch'`.
- Verified and updated all frontend UI buttons and footers to point to `https://github.com/AllenJohnn/llm`.

### Milestone 8: High-Speed Mirror Routing for All 10 Models
- Audited all 10 models in [`room/models.js`](file:///D:/New%20folder/swarmllm/room/models.js).
- Replaced slow Hugging Face direct links with `https://hf-mirror.com/` as primary endpoints while preserving `huggingface.co` as fallback.
- Verified HTTP 206 Range responses and CORS across all endpoints.

### Milestone 9: Fixed Corrupted / Garbled Output (Qwen2.5 Bias & Tokenizer Alignment)
- **Problem:** Running Qwen2.5 Coder 1.5B produced garbled tokens (`30ESS mexicoA1 tempList60PS0 optargak helf.HowessPOess9_letter...`).
- **Root Cause 1:** Missing Q, K, and V attention projection biases (`attn_q.bias`, `attn_k.bias`, `attn_v.bias`) in `DenseEngine`. Qwen2.5 has no QK RMSNorm and relies on additive biases with values up to $\pm 28.8$. Missing biases distorted attention dot products across 28 layers.
- **Root Cause 2:** Remote `tokenizer.json` had 151,665 tokens, while the GGUF model embeddings have 151,936 tokens.
- **Fixes Applied:**
  1. Added `@compute fn add_bias` WGSL compute shader kernel in [`engine/wgsl/base.js`](file:///D:/New%20folder/swarmllm/engine/wgsl/base.js#L240-L250).
  2. Mapped and loaded `qBias`, `kBias`, `vBias` in [`engine/gguf.js`](file:///D:/New%20folder/swarmllm/engine/gguf.js#L175-L287).
  3. Integrated `add_bias` dispatch in [`engine/dense.js`](file:///D:/New%20folder/swarmllm/engine/dense.js#L60-L465) for single-token decode and batched prefill passes.
  4. Built the authoritative tokenizer directly from `tokenizer.ggml.tokens` in [`room.js`](file:///D:/New%20folder/swarmllm/room.js#L1410-L1435).
  5. Verified with golden reference test [`tests/test_qwen.js`](file:///D:/New%20folder/swarmllm/tests/test_qwen.js) on WebGPU (QWEN Q8 PASS ✓, 0.096% diff, generated `" Paris. The capital of France is also"`).

### Milestone 10: Multi-Device Split & WebGPU Buffer Size Fix
- **Clarified Multi-Device Model Sharing:**
  - Only the host laptop needs the model `.gguf` in `./models/`.
  - When Device B connects to the host server, it streams only its assigned layer slice via HTTP 206 Range requests over local Wi-Fi without downloading the whole file.
- **Fixed `createBuffer` Size Error (`Value is not of type 'unsigned long long'`):**
  - **Root Cause:** When worker devices joined without a local `config.json`, remote `config.json` fetch failed (CORS/offline), falling back to `{ num_hidden_layers: L }` without `hidden_size`. This caused `dim * 4` to evaluate to `NaN` in `device.createBuffer({ size: NaN })`.
  - **Fixes Applied:**
    1. Implemented [`cfgFromGGUF(G)`](file:///D:/New%20folder/swarmllm/engine/gguf.js#L432-L465) to extract all architecture parameters (`embedding_length`, `head_count`, `head_count_kv`, `feed_forward_length`, `block_count`, etc.) directly from GGUF metadata, making inference completely self-contained and offline-capable.
    2. Host now bundles `cfg: ai.cfg` in the `ai-load` WebRTC message sent to workers so workers inherit the exact configuration without remote network fetches.
    3. Added defensive dimension fallbacks and `Math.max(4, ...)` guards on all buffer allocations in [`engine/dense.js`](file:///D:/New%20folder/swarmllm/engine/dense.js).

### Milestone 11: Comprehensive Test Suite Validation
- **Node Unit Tests:** All 35 tests in [`tests/unit/run_node_tests.mjs`](file:///D:/New%20folder/swarmllm/tests/unit/run_node_tests.mjs) pass.
- **Deno Unit Tests:** All 11 tests in [`tests/unit/models_test.js`](file:///D:/New%20folder/swarmllm/tests/unit/models_test.js) pass.
- **Topology Tests:** [`tests/test_topologies.js`](file:///D:/New%20folder/swarmllm/tests/test_topologies.js) passes for Solo, 2-Device Mesh, and Multi-Device Chain.

---

## 3. Current Working State

- **Local Server:** `npm run serve` serves `swarmLLM` on port 8080.
- **Models Ready:**
  - `qwen3-0.6b`: Fully downloaded in `models/qwen/model.gguf` (639 MB) — verified with golden reference test.
  - `qwen2.5-coder-7b`: Local file present in `models/qwen25coder/model.gguf` (3.10 GB) — bias support & auto-config complete.
  - All 10 models configured with fast mirrors (`hf-mirror.com`) and Hugging Face fallbacks.
- **Multi-Device Flow:**
  - Host loads local model or streams from mirror.
  - Workers receive layer assignments, inherit configuration via WebRTC, and stream only their assigned layers.
  - Inference runs collaboratively across WebGPU devices via pipeline parallelism.

---

## 4. Next Steps (To Continue Later)

1. **Local Signaling Server Option (`PeerServer`)**:
   - Provide a zero-configuration local signaling server script (`npx peerjs --port 9000`) for environments where public `0.peerjs.com` is unreachable or firewalled.
2. **Local Multi-Tab Transport (`BroadcastChannel`)**:
   - Add a same-origin loopback transport so testing two tabs on the same computer runs via `postMessage`/`BroadcastChannel` with 0ms latency, bypassing WebRTC STUN/TURN entirely.
3. **Live Demonstration Checklist**:
   - Device A (Host, RTX 4060): `npm run serve`, open `http://localhost:8080/room/`, create room.
   - Device B (Phone/Laptop on same Wi-Fi): open `http://<host-ip>:8080/room/`, enter 4-letter room code.
   - Select model (e.g. `qwen3-0.6b` or `qwen2.5-coder-7b`), click **Start Swarm**, and generate responses.

---

## 5. How to Resume Later
To resume work seamlessly in a new session, simply prompt:
> **"Continue where we stopped by reading PLAN.md"**
