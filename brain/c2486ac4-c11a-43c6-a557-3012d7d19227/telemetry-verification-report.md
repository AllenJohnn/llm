# Distributed Inference Verification Report

## Conclusion
**A) Peer is genuinely computing and telemetry is wrong.**

The distributed inference pipeline is functioning perfectly. The peer is actively computing its assigned 10 layers, and the contradictory UI is entirely caused by incomplete telemetry rendering and static HTML defaults.

## Trace Analysis & Answers

### 1. Is the peer actually computing?
**Yes.** 
The fact that the generation completed in ~23 tok/s without throwing an error proves the peer is computing. If the peer failed to compute, the host's `aiPipeToken` would throw a `"pipeline timeout (peer gone?)"` error after 60-90 seconds.

### 2. Is the peer receiving hidden states?
**Yes.** 
In `room.js`, the host transmits the intermediate tensor via `sendHidden(targetPeer, { t: "ai-hidden", pos, ... })`. The worker's `aiOnData` handler successfully receives `ai-hidden`, unpacks the tensor, and passes it to `await ai.engine.runHidden(hin, d.pos)` to execute its 10 layers.

### 3. Is the peer returning hidden states?
**Yes.** 
After the worker finishes its layers, it packs the output tensor and returns it to the host via `sendHidden(ai.next, { t: "ai-hiddenret", ...msg })`. 

### 4. Is the host actually using the peer's returned hidden state?
**Yes.** 
The host receives `ai-hiddenret`, resolves the suspended Promise in `ai.waiters`, and yields the returned hidden state `h`. The host then directly feeds this state into the final projection matrix via `await ai.engine.headFromHidden(h)` to sample the actual token.

### 5. Is only the telemetry incorrectly showing 0 tokens?
**Yes.** 
Token emission is tracked locally. When the host generates a token, it calls `perfSidebar?.onToken(piece, count)`. Inside `perf-sidebar.js`, `onToken()` strictly executes `this.devices[0].tokens++`. Because `devices[0]` is always hardcoded as the local device (`{ id: "self" }`), the host takes 100% of the token credit and leaves the peer's counter permanently at `0 tok`.

### 6. Why does the UI say "1 NODE" and "Solo Device Execution"?
These strings are hardcoded directly into the raw HTML template of `perf-sidebar.js` (lines 759 and 744) as default fallback text. While `PerfSidebar.setDevices()` correctly tracks the active cluster size (`this.devices.length`), there is absolutely no JavaScript logic implemented to dynamically update `#perf-grid-share-badge` or `#perf-hero-sub`. Therefore, they never change from their defaults.

## Next Steps
The distributed inference engine itself requires no changes. The fixes required are purely UI/telemetry patches in `perf-sidebar.js` to correctly render cluster size strings and distribute token counting across the active device array.
