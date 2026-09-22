# SwarmLLM Project Progress & Tomorrow's Execution Plan

**Last Updated:** 2026-09-22  
**Target Repository:** https://github.com/AllenJohnn/llm  

---

## 1. Project Mission & Architecture Overview
**SwarmLLM** is a decentralized, browser-native LLM inference engine. Multiple client devices (laptops, phones, desktops) join a shared WebRTC room, divide the transformer layers according to their available WebGPU memory (e.g. Host gets layers 0–13 + embeddings/head, Worker gets layers 14–27), and stream activations in a pipeline to execute inference cooperatively.

---

## 2. Complete Chronological Progress (What We Have Done From Start)

### Milestone 1: Routing & Local Server Setup
- **Issue:** Running `npx -y serve -l 8080 .` failed when navigating to `/room` (returned 404 or directory listing), and navigation between `p2p.html` and `/room` was inconsistent.
- **Solution:**
  - Created [`serve.json`](file:///D:/New%20folder/swarmllm/serve.json) configuring clean rewrites from `/room` to `/room/index.html`.
  - Created [`room/index.html`](file:///D:/New%20folder/swarmllm/room/index.html) as a standalone entrypoint matching [`p2p.html`](file:///D:/New%20folder/swarmllm/p2p.html).

### Milestone 2: UI Button Interactivity & Diagnostic Loader
- **Issue:** Clicking "Create room", "Join room", or memory steppers (`+`/`-`) produced no response because event listeners registered in ES modules had execution race conditions or failed if the module was delayed.
- **Solution:**
  - Added direct inline event handlers `window.swarmStart(create)` and `window.stepGB(delta)`.
  - Created a robust pre-flight diagnostic module loader that verifies network access, checks MIME types, and imports submodules cleanly with visible error banners if any script fails to load.

### Milestone 3: Ad-Blocker False Positive Fix
- **Issue:** Brave Shields and ad-blockers (EasyPrivacy list) blocked `engine/quant.js` (`ERR_BLOCKED_BY_CLIENT`), mistakenly matching it as the Quantcast tracker (`/quant.js`).
- **Solution:**
  - Renamed `engine/quant.js` to [`engine/quantize.js`](file:///D:/New%20folder/swarmllm/engine/quantize.js).
  - Updated all import statements across [`engine/engine.js`](file:///D:/New%20folder/swarmllm/engine/engine.js), [`engine/selftest.js`](file:///D:/New%20folder/swarmllm/engine/selftest.js), and loader scripts.

### Milestone 4: Fix `pipeline timeout (batch prefill)`
- **Issue:** When starting a model and sending a prompt message in the chat, prefill timed out with `Error: pipeline timeout (batch prefill)`.
- **Root Causes Identified & Fixed:**
  1. **`stripe4` Multichannel Drops:** `WIRE` defaulted to `"stripe4"`, which attempted to scatter slices across 4 separate WebRTC data channels on uncoordinated connections. Slices were dropped, so reassembly stalled indefinitely.
     - **Fix:** Switched default `WIRE` to `"slice"`, routing reliably through the single negotiated `swarm-wire` channel.
  2. **Dead Peers in Chain:** When peers disconnected, `ai.chain` was not pruned. The host sent frames to dead peer IDs.
     - **Fix:** Added active peer pruning in `conn.on("close")` and at the start of `aiGenerate()`.
  3. **Silent Worker Crashes:** Worker's `ai-hidden-b` lacked try/catch, threw bounds errors when `DenseEngine` returned 4 tokens for `m < 4`, and never sent replies to the host.
     - **Fix:** Clamped `hb.set()` chunk subarrays and wrapped in try/catch with error reporting to `ai.hostId`.
  4. **Immediate Waiter Notification:** Updated `ai-error` and disconnect handlers to immediately reject pending `ai.waiters` instead of hanging for 90 seconds.
  5. **Prefill Fallback:** Wrapped batched prefill in `try ... catch` with a 15s timeout. If batched prefill encounters network drop or timeout, it automatically falls back to sequential token prefill via `aiPipeToken` without crashing.

### Milestone 5: WebRTC ICE & Relay Traversal Hardening
- **Issue:** Joiner showed: `found the room, but the direct connection failed (strict NAT/firewall on one side) — trying relay, give it ~20s or try another network`.
- **Root Causes Identified & Fixed:**
  1. **Zero TURN Relays Configured:** `window.TURN_SERVERS` was empty, so when direct STUN hole-punching failed under symmetric NAT / firewalls, WebRTC had no relay.
     - **Fix:** Added redundant STUN servers (Google, Cloudflare, Twilio) and free OpenRelay TURN servers across UDP and TCP ports 80/443 in `ICE.iceServers`.
  2. **Premature 15s Timeout:** Increased negotiation window to 35s with real-time state tracking on `conn.peerConnection.iceConnectionState`.
  3. **Race Condition on `.open`:** Added `if (conn.open) handleOpen(); else conn.on("open", handleOpen);` on both host and joiner.

### Milestone 6: Clean Project Identity & Single-Author Repository
- **Action:** Cleared legacy contributor history and established the project as Allen John's clean standalone repository:
  - Updated author metadata, LICENSE copyright, AUTHORS, CITATION, package.json, CODEOWNERS, and documentation links.
  - Reset git commit graph into a clean single initial root commit authored exclusively by `AllenJohnn <allenjohnjoy2004@gmail.com>` with message `"Initial commit: SwarmLLM browser-native peer-to-peer LLM engine"`.
  - Deleted legacy tags (`v0.2.0`) and pruned git database/reflogs so `git shortlog -sn --all` confirms exclusively 1 contributor (`AllenJohnn`).
  - Pointed repository remote strictly to `https://github.com/AllenJohnn/llm.git` and removed all upstream remotes.
  - Force-pushed clean `main` branch to GitHub so the remote repo shows zero prior contributor history.

---

## 3. Current Checkpoint: Why the Strict NAT / Relay Error Appears
The error message:
> `could not connect: strict NAT/firewall blocked direct & relay paths. Try another network or mobile hotspot.`

### Root Cause Breakdown:
1. **Public OpenRelay Limitations:**
   The free `openrelay.metered.ca` public TURN servers are shared globally by thousands of open-source projects. Many ISPs and corporate/mobile firewalls throttle or block public TURN servers, or the public servers temporarily reject unauthenticated relay allocations.
2. **Local Machine Loopback / Hairpinning:**
   When testing two tabs on the **same machine** or same local Wi-Fi:
   - Chromium obfuscates local IPs into `.local` mDNS hostnames (e.g. `48f8a655-....local`). If mDNS loopback resolution fails, the browser tries public STUN.
   - Home routers without **NAT Loopback / Hairpinning** drop packets sent from a LAN IP to the router's own WAN IP.
3. **Public PeerJS Cloud Signaling Delays:**
   `0.peerjs.com` is a free public signaling server. When it is under heavy traffic, SDP candidate exchange can take longer than the ICE candidate gathering timeout.

---

## 4. Next Steps & Tomorrow's Action Plan

When resuming tomorrow, execute these steps in order:

### Step 1: Add a Local Signaling Server (Instant, 100% Reliable for Local & LAN)
- Public `0.peerjs.com` is subject to cloud outages and rate limits.
- Add an optional lightweight local signaling server using `peer` (PeerServer):
  ```bash
  npx peerjs --port 9000 --path /swarm
  ```
- In `room.js` / URL parameters, auto-detect or allow connecting to local signaling (`?signal=localhost:9000` or auto-fallback) so local testing is instant and never blocked by NAT.

### Step 2: Implement Same-Device Local Tab Fallback (`BroadcastChannel` / `MessageChannel`)
- When two tabs on the same computer want to form a swarm (e.g. tab 1 = host, tab 2 = worker), WebRTC over the public internet is overkill and subject to NAT/firewall blocking.
- Implement a local transport adapter:
  - Detect if peers are running on the same origin / browser via `BroadcastChannel("swarmllm-local")`.
  - Transfer tensor buffers instantly via `postMessage` with zero network overhead, 0ms latency, and 100% immunity to NAT/firewall issues.

### Step 3: Reliable Production TURN Relay Configuration
- For cross-network devices (e.g. Phone on 5G + PC on Wi-Fi), integrate a dedicated free Metered TURN API key or Xirsys credentials.
- Allow users to enter custom TURN credentials in an advanced settings accordion in `p2p.html`.

### Step 4: End-to-End Verification Checklist
1. **Same-Machine Test:** Tab 1 (Host) + Tab 2 (Joiner) on `localhost:8080` connect instantly, download shards, and complete chat prompt.
2. **Local Network (LAN) Test:** PC + Laptop on same Wi-Fi connect via room code.
3. **Cross-Network Test:** Phone on 5G + PC on Wi-Fi connect via room code and complete inference.

---

## 5. How to Resume Tomorrow
To resume work seamlessly, prompt:
> **"Continue where we stopped by reading plan.md"**
