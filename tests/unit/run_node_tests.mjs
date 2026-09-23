// Node test runner for unit tests
import { makeLink, sendFrame, attachWire, SLICE_BYTES } from "../../room/transport.js";
import { chatRecipients, VISIBILITY } from "../../room/visibility.js";
import { MODELS, NEED_GB, LOCAL_CANDIDATES, detectLocalModel } from "../../room/models.js";
import { WGSL, coopWGSL } from "../../engine/engine.js";

const assert = (cond, msg) => { if (!cond) throw new Error(msg || "assertion failed"); };
const eq = (a, b, m) => {
  const ja = JSON.stringify(a), jb = JSON.stringify(b);
  if (ja !== jb) throw new Error((m || "mismatch") + ": " + ja + " != " + jb);
};

let passed = 0;
async function test(name, fn) {
  try {
    await fn();
    console.log(`✓ ${name}`);
    passed++;
  } catch (err) {
    console.error(`✗ ${name}:`, err.message);
    process.exitCode = 1;
  }
}

// 1. Models tests
await test("models: catalog has all 10 expected models", () => {
  const expected = [
    "qwen3-0.6b", "qwen3-1.7b", "qwen3-4b", "qwen2.5-coder-1.5b",
    "qwen2.5-coder-7b", "deepseek-r1-distill-qwen-14b", "qwq-32b",
    "phi-4-mini", "qwen3.8-27b", "smollm-135m"
  ];
  for (const k of expected) {
    assert(MODELS[k], `Missing model key: ${k}`);
    assert(NEED_GB[k] > 0, `Missing NEED_GB for: ${k}`);
  }
});

await test("models: Qwen2.5 Coder prefers the fast mirror and has an HF fallback", () => {
  const m = MODELS["qwen2.5-coder-1.5b"];
  assert(m.gguf.startsWith("https://hf-mirror.com/"), "Qwen2.5 Coder should prefer the fast mirror");
  assert(m.ggufFallback.startsWith("https://huggingface.co/"), "Qwen2.5 Coder fallback URL missing");
  assert(NEED_GB["qwen2.5-coder-1.5b"] >= 1.5, "Qwen2.5 Coder memory pledge missing");
});

await test("models: Phi-4 mini uses the Phi3 GGUF path and a multi-GB pledge", () => {
  assert(MODELS["phi-4-mini"].arch === "phi3", "Phi-4 mini must use Phi3 GGUF mapping");
  assert(MODELS["phi-4-mini"].gguf.endsWith("/microsoft_Phi-4-mini-instruct-Q4_0.gguf"), "Phi-4 mini Q4 GGUF URL missing");
  assert(NEED_GB["phi-4-mini"] >= 3, "Phi-4 mini should require at least 3 GB");
});

await test("models: local candidates defined for all models", () => {
  for (const k of Object.keys(MODELS)) {
    assert(Array.isArray(LOCAL_CANDIDATES[k]), `LOCAL_CANDIDATES missing array for: ${k}`);
    assert(LOCAL_CANDIDATES[k].length > 0, `LOCAL_CANDIDATES empty for: ${k}`);
  }
});

await test("models: detectLocalModel gracefully handles unreachable local files", async () => {
  const res = await detectLocalModel("non-existent-model");
  assert(res === null, "should return null for non-existent model");
});

// 2. Visibility tests
await test("visibility: all — everyone gets the text", () => {
  const ids = ["p1", "p2", "p3"];
  eq(chatRecipients("all", "p2", ids), { full: ["p1", "p2", "p3"], hidden: [] });
});

await test("visibility: host — nobody but the host's own screen", () => {
  const ids = ["p1", "p2", "p3"];
  eq(chatRecipients("host", "p2", ids), { full: [], hidden: ["p1", "p2", "p3"] });
});

await test("visibility: asker — the asking peer by id, the rest hidden", () => {
  const ids = ["p1", "p2", "p3"];
  eq(chatRecipients("asker", "p2", ids), { full: ["p2"], hidden: ["p1", "p3"] });
});

await test("visibility: asker is the host itself — nobody else sees it", () => {
  const ids = ["p1", "p2", "p3"];
  eq(chatRecipients("asker", "host-id", ids), { full: [], hidden: ["p1", "p2", "p3"] });
});

await test("visibility: modes are the three the dropdown offers", () => {
  eq(VISIBILITY, ["all", "host", "asker"]);
});

// 3. WGSL generator smoke test
await test("generator: WGSL balanced braces and entry points", () => {
  for (const [wg, rows, cols, rowsB] of [[256, 4, 4, 4], [128, 4, 8, 2], [64, 4, 8, 4]]) {
    const src = WGSL + coopWGSL(wg, rows, 64, cols, rowsB, true);
    const open = (src.match(/\{/g) || []).length, close = (src.match(/\}/g) || []).length;
    assert(open === close, `unbalanced braces for ${wg}/${rows}/${cols}/${rowsB}`);
    assert((src.match(/@compute/g) || []).length > 0, "no entry points found");
  }
});

// 4. Transport tests
function fakeChannels(link, n, sink) {
  for (let i = 0; i < n; i++) link.chans.push({ readyState: "open", send: (buf) => sink.push({ i, buf }) });
}
function receiver(onFrame, opts = {}) {
  const link = makeLink(opts); let handler = null;
  const pc = { createDataChannel: () => ({ set onmessage(f) { handler = f; }, set onclose(_) {}, readyState: "open" }) };
  attachWire(link, { peerConnection: pc }, onFrame, opts);
  return (buf) => handler({ data: buf });
}

const dim = 512;
const shapes = [
  { t: "ai-hidden", pos: 17, n: 1, cols: 1 },
  { t: "ai-hidden-b", basePos: 240, n: 16, cols: 16 },
  { t: "ai-hiddenret-b", basePos: 5, n: 6, spec: 1, cols: 6 },
];

for (const sh of shapes) {
  const data = new Uint16Array(dim * sh.cols);
  for (let i = 0; i < data.length; i++) data[i] = (i * 2654435761) >>> 16;
  await test(`transport round trip ${sh.t} x${sh.cols}`, () => {
    const link = makeLink(), out = []; fakeChannels(link, 3, out);
    if (!sendFrame(link, { ...sh, data })) throw new Error("send refused");
    for (const { buf } of out) if (buf.byteLength > SLICE_BYTES) throw new Error("slice too big: " + buf.byteLength);
    const expectSlices = Math.ceil(data.byteLength / (SLICE_BYTES - 24));
    if (out.length !== expectSlices) throw new Error(`expected ${expectSlices} slices, got ${out.length}`);
    let got = null; const deliver = receiver((m) => { got = m; });
    const order = [...out].reverse(); order.splice(1, 0, out[Math.floor(out.length / 2)]);
    for (const { buf } of order) deliver(buf);
    if (!got) throw new Error("frame not reassembled");
    if (got.t !== sh.t) throw new Error("kind mismatch " + got.t);
    if ((sh.pos ?? sh.basePos) !== (got.pos ?? got.basePos)) throw new Error("pos mismatch");
    if (got.n !== sh.n || !got.spec !== !sh.spec) throw new Error("meta mismatch");
    if (got.data.length !== data.length) throw new Error("length mismatch");
    for (let i = 0; i < data.length; i++) if (got.data[i] !== data[i]) throw new Error("byte mismatch at " + i);
  });
}

await test("transport refuses when no channel is open", () => {
  const link = makeLink(); link.chans.push({ readyState: "connecting", send() {} });
  if (sendFrame(link, { t: "ai-hidden", pos: 0, data: new Uint16Array(8) })) throw new Error("should refuse");
});

await test("transport: FEC recovers single dropped slice in each block under packet loss", () => {
  const data = new Uint16Array(dim * 8); // spans multiple slices
  for (let i = 0; i < data.length; i++) data[i] = (i * 31337 + 7) & 0xFFFF;
  const link = makeLink({ ordered: false, fec: true });
  const out = [];
  fakeChannels(link, 4, out);
  if (!sendFrame(link, { t: "ai-hidden-b", basePos: 100, n: 4, data })) throw new Error("send refused");

  const nDataSlices = Math.ceil(data.byteLength / (SLICE_BYTES - 24));
  assert(out.length > nDataSlices, "FEC parity slice should be emitted");

  // Simulate packet loss: drop slice 1 (a middle data slice)
  const simulated = out.filter((_, idx) => idx !== 1);
  let got = null;
  const deliver = receiver((m) => { got = m; }, { ordered: false, fec: true });

  // Shuffle order to simulate unordered delivery over WebRTC
  const shuffled = [...simulated].reverse();
  for (const { buf } of shuffled) deliver(buf);

  assert(got !== null, "frame should be reconstructed despite FEC parity slice");
  eq(got.data.length, data.length);
  for (let i = 0; i < data.length; i++) {
    eq(got.data[i], data[i]);
  }
});

// 5. Sampling and Repetition Penalty tests
import { aiSample } from "../../room/sampling.js";

await test("sampling: aiSample selects high probability token without repetition penalty", () => {
  const logits = new Float32Array(100);
  logits.fill(-10);
  logits[42] = 20; // dominant token
  const sampled = aiSample(logits, 0.1, 10);
  assert(sampled === 42, `expected token 42, got ${sampled}`);
});

await test("sampling: aiSample applies repetition penalty to penalize repeated tokens", () => {
  const logits = new Float32Array(100);
  logits.fill(-10);
  logits[42] = 10.0;
  logits[43] = 9.5;
  // Without penalty, token 42 dominates with temp=0.01
  const s1 = aiSample(logits.slice(), 0.01, 10, [], 1.0);
  assert(s1 === 42, "token 42 should win without penalty");

  // With repetition penalty of 1.2 on token 42, 10.0 / 1.2 = 8.33 < 9.5 (token 43)
  const s2 = aiSample(logits.slice(), 0.01, 10, [42], 1.2);
  assert(s2 === 43, `expected token 43 to win after token 42 is penalized, got ${s2}`);
});

// 6. Markdown and Streaming syntax tests
import { md, esc } from "../../room/markdown.js";

await test("markdown: renders headings, bold, and code blocks with copy button", () => {
  const html = md("# Test Heading\n\n**Bold text**\n\n```python\nprint(123)\n```");
  assert(html.includes("<h1>Test Heading</h1>"), "missing heading");
  assert(html.includes("<strong>Bold text</strong>") || html.includes("<b>Bold text</b>"), "missing bold text");
  assert(html.includes("class=\"code-block\""), "missing code-block container");
  assert(html.includes("class=\"code-copy-btn\""), "missing copy button");
  assert(html.includes("print(123)"), "missing code text");
});

await test("markdown: streaming mode auto-closes incomplete code fences", () => {
  const streamingText = "Here is code:\n\n```javascript\nconst x = 10;"; // unclosed code block
  const html = md(streamingText, true);
  assert(html.includes("class=\"code-block\""), "streaming should auto-close code block");
  assert(html.includes("const x = 10;"), "missing code content in streaming block");
});

await test("markdown: renders ThoughtChain for <think> tags", () => {
  const thinkText = "<think>\nExploring solution space\n</think>\nHere is the answer.";
  const html = md(thinkText);
  assert(html.includes("class=\"thought-chain\""), "missing thought-chain container");
  assert(html.includes("Thought Process"), "missing thought header");
  assert(html.includes("Exploring solution space"), "missing inner thought content");
  assert(html.includes("Here is the answer"), "missing answer content");
});

await test("markdown: completed thought chain is collapsed and streaming thought chain is open", () => {
  const completedHtml = md("<think>Thinking done</think>Answer text");
  assert(!completedHtml.includes("<details class=\"thought-chain\" data-status=\"completed\" open>"), "completed thought chain should NOT be open by default");
  assert(completedHtml.includes("data-status=\"completed\""), "completed thought should have completed status");

  const streamingHtml = md("<think>Thinking in progress...", true);
  assert(streamingHtml.includes("data-status=\"streaming\" open"), "streaming thought chain MUST be open with streaming status");
  assert(streamingHtml.includes("Thinking…"), "missing streaming Thinking header");
});

import { resetLink } from "../../room/transport.js";
await test("transport: resetLink cleanly flushes pending rx frames", () => {
  const link = makeLink();
  link.rx.set(42, { parts: [true], got: 1, n: 2, buf: new Uint8Array(100), t: Date.now() });
  assert(link.rx.size === 1, "link should have 1 pending rx frame");
  resetLink(link);
  assert(link.rx.size === 0, "resetLink should clear rx map");
});

await test("models: Qwen models have thinking enabled and SmolLM disabled", () => {
  assert(MODELS["qwen3-0.6b"].thinking === true, "qwen3-0.6b should have thinking: true");
  assert(MODELS["qwen3-1.7b"].thinking === true, "qwen3-1.7b should have thinking: true");
  assert(MODELS["smollm-135m"].thinking === false, "smollm-135m should have thinking: false");
});

import { runContextTests } from "./context_overflow_test.js";
await runContextTests(test);

console.log(`\nAll ${passed} tests passed successfully!`);
