// Hidden-state transport: a dedicated data channel per peer link that sends activation frames
// as small slices, optionally striped over several peer connections, with Forward Error Correction (FEC).
//
// Why: Chrome's SCTP stack (dcSCTP) releases at most 4 packets per send opportunity and starts
// with a ~12 KB congestion window, so a single 10 KB message pays an extra round trip and a 50 KB
// speculative verify block pays three. Measured on a 100 ms link: 1 KB = 51 ms one-way,
// 5 KB = 153 ms, 20 KB = 254 ms (docs/bench-log.md). Slicing every send under four packets and
// spreading a block across several associations brings a hop back to one one-way trip.
//
// On unordered channels (ordered: false, maxRetransmits: 0), lost packets cost 0 round trips
// when Forward Error Correction (FEC) is enabled: parity slices allow single-packet loss in
// each FEC block to be reconstructed with zero latency penalty.

export const WIRE_ID = 77;                 // negotiated channel id, same on both ends
export const SLICE_BYTES = 4600;           // ~4 packets of 1150 B payload
export const FEC_BLOCK = 8;                // slices per FEC block
export const FLAG_SPEC = 1;
export const FLAG_FEC = 2;
const HDR = 24;
const MAGIC = 0x5357;                      // "SW"
const KINDS = ["ai-hidden", "ai-hidden-b", "ai-hiddenret", "ai-hiddenret-b"];

// Per-link state: { chans: [RTCDataChannel], rr: number, rx: Map<msgId, ...>, nextId, sent, recv, fec, ordered }
export function makeLink(opts = {}) {
  return { chans: [], rr: 0, rx: new Map(), nextId: 1, sent: 0, recv: 0, fec: opts.fec, ordered: opts.ordered };
}

// Reset link state on fresh generation context to flush stale slices
export function resetLink(link) {
  if (!link) return;
  if (link.rx) link.rx.clear();
}

// Open the wire channel on a PeerJS DataConnection's RTCPeerConnection. Both sides call this with
// the same id, so no ondatachannel event fires and PeerJS never sees the channel.
export function attachWire(link, conn, onFrame, { ordered = true, fec } = {}) {
  const pc = conn.peerConnection;
  if (!pc) return null;
  const ch = pc.createDataChannel("swarm-wire", { negotiated: true, id: WIRE_ID, ordered, ...(ordered ? {} : { maxRetransmits: 0 }) });
  ch.binaryType = "arraybuffer";
  ch.onmessage = (ev) => receive(link, ev.data, onFrame);
  ch.onclose = () => { link.chans = link.chans.filter((c) => c !== ch); };
  link.chans.push(ch);
  link.ordered = ordered;
  if (fec !== undefined) link.fec = fec;
  else if (!ordered) link.fec = true;
  return ch;
}

export function wireReady(link) { return link.chans.some((c) => c.readyState === "open"); }

// msg: { t, pos|basePos, n?, spec?, data: Uint16Array (f16) }
export function sendFrame(link, msg, opts = {}) {
  try {
    const kind = KINDS.indexOf(msg.t);
    if (kind < 0) return false;
    const open = link.chans.filter((c) => c.readyState === "open");
    if (!open.length) return false;
    // Check if channel is heavily backpressured (> 8 MB buffered)
    for (const ch of open) {
      if (typeof ch.bufferedAmount === "number" && ch.bufferedAmount > 8 * 1024 * 1024) return false;
    }
    link.sent++;
    const u16 = msg.data;
    const bytes = new Uint8Array(u16.buffer, u16.byteOffset, u16.byteLength);
    const per = SLICE_BYTES - HDR;
    const nSlices = Math.max(1, Math.ceil(bytes.length / per));
    const id = link.nextId++ >>> 0;
    const pos = msg.t === "ai-hidden" || msg.t === "ai-hiddenret" ? msg.pos : msg.basePos;
    const useFec = opts.fec !== undefined ? opts.fec : (link.fec !== undefined ? link.fec : (link.ordered === false));

    // Send data slices
    for (let k = 0, off = 0; k < nSlices; k++) {
      const len = Math.min(per, bytes.length - off);
      const buf = new ArrayBuffer(HDR + len), dv = new DataView(buf);
      dv.setUint16(0, MAGIC); dv.setUint8(2, kind); dv.setUint8(3, msg.spec ? FLAG_SPEC : 0);
      dv.setUint32(4, id); dv.setUint32(8, pos >>> 0); dv.setUint16(12, msg.n || 1);
      dv.setUint16(14, k); dv.setUint16(16, nSlices); dv.setUint32(20, bytes.length);
      new Uint8Array(buf, HDR).set(bytes.subarray(off, off + len));
      off += len;
      // round-robin over associations so a block never waits on one congestion window
      const ch = open[(link.rr++) % open.length];
      ch.send(buf);
    }

    // Send FEC parity slices if enabled
    if (useFec) {
      const nBlocks = Math.ceil(nSlices / FEC_BLOCK);
      for (let b = 0; b < nBlocks; b++) {
        const bStart = b * FEC_BLOCK;
        const bEnd = Math.min(nSlices, (b + 1) * FEC_BLOCK);
        const pLen = Math.min(per, bytes.length - bStart * per);
        const pBuf = new ArrayBuffer(HDR + pLen);
        const pData = new Uint8Array(pBuf, HDR);
        for (let s = bStart; s < bEnd; s++) {
          const off = s * per;
          const len = Math.min(per, bytes.length - off);
          for (let i = 0; i < len; i++) pData[i] ^= bytes[off + i];
        }
        const pdv = new DataView(pBuf);
        pdv.setUint16(0, MAGIC); pdv.setUint8(2, kind); pdv.setUint8(3, (msg.spec ? FLAG_SPEC : 0) | FLAG_FEC);
        pdv.setUint32(4, id); pdv.setUint32(8, pos >>> 0); pdv.setUint16(12, msg.n || 1);
        pdv.setUint16(14, b); pdv.setUint16(16, nSlices); pdv.setUint32(20, bytes.length);
        const pch = open[(link.rr++) % open.length];
        pch.send(pBuf);
      }
    }
    return true;
  } catch (err) {
    console.warn("sendFrame failed:", err);
    return false;
  }
}

function receive(link, buf, onFrame) {
  if (!(buf instanceof ArrayBuffer) || buf.byteLength < HDR) return;
  const dv = new DataView(buf);
  if (dv.getUint16(0) !== MAGIC) return;
  const kind = dv.getUint8(2), flags = dv.getUint8(3), id = dv.getUint32(4), pos = dv.getUint32(8), n = dv.getUint16(12);
  const k = dv.getUint16(14), nSlices = dv.getUint16(16), total = dv.getUint32(20);
  const isFec = (flags & FLAG_FEC) !== 0;
  const spec = (flags & FLAG_SPEC) !== 0 ? 1 : 0;
  const per = SLICE_BYTES - HDR;
  const nBlocks = Math.ceil(nSlices / FEC_BLOCK);

  let r = link.rx.get(id);
  if (!r) {
    r = {
      parts: new Array(nSlices),
      sliceData: new Array(nSlices),
      parity: new Array(nBlocks),
      got: 0,
      n: nSlices,
      buf: new Uint8Array(total),
      t: performance.now(),
    };
    link.rx.set(id, r);
  }

  if (isFec) {
    if (!r.parity[k]) {
      r.parity[k] = new Uint8Array(buf, HDR);
    }
  } else {
    if (r.parts[k]) return;   // duplicate
    r.parts[k] = true;
    r.got++;
    const sliceBytes = new Uint8Array(buf, HDR);
    r.sliceData[k] = sliceBytes;
    r.buf.set(sliceBytes, k * per);
  }

  // Check if any missing slice can be reconstructed via FEC parity
  if (r.got < r.n) {
    for (let b = 0; b < nBlocks; b++) {
      if (!r.parity[b]) continue;
      const bStart = b * FEC_BLOCK;
      const bEnd = Math.min(r.n, (b + 1) * FEC_BLOCK);
      let missingIndex = -1;
      let missingCount = 0;
      for (let j = bStart; j < bEnd; j++) {
        if (!r.parts[j]) {
          missingCount++;
          missingIndex = j;
        }
      }
      if (missingCount === 1) {
        // Reconstruct the single missing slice in this block
        const mLen = Math.min(per, total - missingIndex * per);
        const rec = new Uint8Array(r.parity[b]);
        for (let j = bStart; j < bEnd; j++) {
          if (j === missingIndex) continue;
          const sj = r.sliceData[j];
          if (sj) for (let i = 0; i < sj.length; i++) rec[i] ^= sj[i];
        }
        const recoveredSlice = rec.subarray(0, mLen);
        r.parts[missingIndex] = true;
        r.sliceData[missingIndex] = recoveredSlice;
        r.buf.set(recoveredSlice, missingIndex * per);
        r.got++;
      }
    }
  }

  if (r.got < r.n) return;
  link.rx.delete(id);
  link.recv++;
  const data = new Uint16Array(r.buf.buffer, 0, total >> 1);
  const t = KINDS[kind];
  const msg = { t, enc: "f16", data, n, spec };
  if (t === "ai-hidden" || t === "ai-hiddenret") msg.pos = pos; else msg.basePos = pos;
  onFrame(msg);

  // drop half-received frames older than 30 s so a lost slice cannot leak memory
  if (link.rx.size > 64) for (const [i, v] of link.rx) if (performance.now() - v.t > 30000) link.rx.delete(i);
}
