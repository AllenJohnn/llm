// room/transport.js: slicing and reassembly are byte-exact, tolerate reordering and duplicates,
// keep every send under SLICE_BYTES, and recover lost slices with FEC on unordered channels.
import { makeLink, sendFrame, SLICE_BYTES, attachWire } from "../../room/transport.js";

function fakeChannels(link, n, sink) {
  for (let i = 0; i < n; i++) link.chans.push({ readyState: "open", send: (buf) => sink.push({ i, buf }) });
}
// receive() is module-private: attach a stub peer connection and drive its onmessage
function receiver(onFrame, opts = {}) {
  const link = makeLink(opts); let handler = null;
  const pc = { createDataChannel: () => ({ set onmessage(f) { handler = f; }, set onclose(_) {}, readyState: "open" }) };
  attachWire(link, { peerConnection: pc }, onFrame, opts);
  return (buf) => handler({ data: buf });
}

const dim = 5120;
const shapes = [
  { t: "ai-hidden", pos: 17, n: 1, cols: 1 },
  { t: "ai-hidden-b", basePos: 240, n: 16, cols: 16 },
  { t: "ai-hiddenret-b", basePos: 5, n: 6, spec: 1, cols: 6 },
];
for (const sh of shapes) {
  const data = new Uint16Array(dim * sh.cols); for (let i = 0; i < data.length; i++) data[i] = (i * 2654435761) >>> 16;
  Deno.test(`transport round trip ${sh.t} x${sh.cols}`, () => {
    const link = makeLink(), out = []; fakeChannels(link, 3, out);
    if (!sendFrame(link, { ...sh, data })) throw new Error("send refused");
    for (const { buf } of out) if (buf.byteLength > SLICE_BYTES) throw new Error("slice too big: " + buf.byteLength);
    const expectSlices = Math.ceil(data.byteLength / (SLICE_BYTES - 24));
    if (out.length !== expectSlices) throw new Error(`expected ${expectSlices} slices, got ${out.length}`);
    // stripes: consecutive slices land on different channels
    if (out.length > 1 && out[0].i === out[1].i) throw new Error("slices not striped");
    let got = null; const deliver = receiver((m) => { got = m; });
    // deliver reversed, with a duplicate in the middle
    const order = [...out].reverse(); order.splice(1, 0, out[Math.floor(out.length / 2)]);
    for (const { buf } of order) deliver(buf);
    if (!got) throw new Error("frame not reassembled");
    if (got.t !== sh.t) throw new Error("kind mismatch " + got.t);
    if ((sh.pos ?? sh.basePos) !== (got.pos ?? got.basePos)) throw new Error("pos mismatch");
    if (got.n !== sh.n || !!got.spec !== !!sh.spec) throw new Error("meta mismatch");
    if (got.data.length !== data.length) throw new Error("length mismatch");
    for (let i = 0; i < data.length; i++) if (got.data[i] !== data[i]) throw new Error("byte mismatch at " + i);
  });
}

Deno.test("transport refuses when no channel is open", () => {
  const link = makeLink(); link.chans.push({ readyState: "connecting", send() {} });
  if (sendFrame(link, { t: "ai-hidden", pos: 0, data: new Uint16Array(8) })) throw new Error("should refuse");
});

Deno.test("transport FEC recovers single dropped slice in each block", () => {
  const data = new Uint16Array(dim * 4); // ~40 KB, spans multiple slices
  for (let i = 0; i < data.length; i++) data[i] = (i * 31337 + 7) & 0xFFFF;
  const link = makeLink({ ordered: false, fec: true });
  const out = [];
  fakeChannels(link, 4, out);
  if (!sendFrame(link, { t: "ai-hidden-b", basePos: 100, n: 4, data })) throw new Error("send refused");

  // We should have data slices plus at least 1 FEC parity slice
  const nDataSlices = Math.ceil(data.byteLength / (SLICE_BYTES - 24));
  if (out.length <= nDataSlices) throw new Error("FEC parity slice not emitted");

  // Simulate loss: drop slice 1 (a middle data slice)
  const simulated = out.filter((_, idx) => idx !== 1);
  let got = null;
  const deliver = receiver((m) => { got = m; }, { ordered: false, fec: true });

  // Shuffle order to simulate unordered delivery over WebRTC
  const shuffled = [...simulated].reverse();
  for (const { buf } of shuffled) deliver(buf);

  if (!got) throw new Error("frame not reconstructed despite FEC parity slice");
  if (got.data.length !== data.length) throw new Error("length mismatch");
  for (let i = 0; i < data.length; i++) {
    if (got.data[i] !== data[i]) throw new Error(`byte mismatch at ${i} after FEC reconstruction`);
  }
});

Deno.test("transport FEC tolerates lost parity slice when all data slices arrive", () => {
  const data = new Uint16Array(dim * 2);
  for (let i = 0; i < data.length; i++) data[i] = (i * 12345) & 0xFFFF;
  const link = makeLink({ ordered: false, fec: true });
  const out = [];
  fakeChannels(link, 2, out);
  sendFrame(link, { t: "ai-hidden", pos: 42, data });

  // Drop the last slice (which is the FEC parity slice)
  const simulated = out.slice(0, -1);
  let got = null;
  const deliver = receiver((m) => { got = m; }, { ordered: false, fec: true });
  for (const { buf } of simulated) deliver(buf);

  if (!got) throw new Error("frame not reassembled when only parity was dropped");
  for (let i = 0; i < data.length; i++) {
    if (got.data[i] !== data[i]) throw new Error(`byte mismatch at ${i}`);
  }
});
