// WebSLICE Performance & Scaling Analytics Sidebar
// Real-time live token generation velocity graph + Multi-device grid processing representation + Multi-system scalability efficiency curve.

const DEVICE_COLORS = [
  "#2b4eff", // 0: Royal Cobalt (Host / You)
  "#0d9488", // 1: Jade Teal
  "#d97706", // 2: Warm Amber
  "#7c3aed", // 3: Purple / Violet
  "#db2777", // 4: Rose Pink
  "#0284c7", // 5: Sky Blue
  "#16a34a", // 6: Leaf Green
  "#ea580c", // 7: Burnt Orange
];

export class PerfSidebar {
  constructor() {
    this.container = null;
    this.liveCanvas = null;
    this.scalingCanvas = null;
    this.liveCtx = null;
    this.scalingCtx = null;
    
    // Live stream state
    this.isStreaming = false;
    this.genStartTime = 0;
    this.lastTokenTime = 0;
    this.tokenCount = 0;
    this.firstTokenTime = null;
    this.peakTps = 0;
    this.streamPoints = []; // { t: elapsedSec, tps: instantTps, total: count }
    this.recentTokenTimes = []; // [timestamp, timestamp, ...] for sliding window
    this.animFrameId = null;

    // Devices & Grid state
    this.devices = [
      {
        id: "self",
        name: "you",
        self: true,
        color: DEVICE_COLORS[0],
        layers: "",
        stage: "Solo Engine",
        stageIndex: 0,
        totalStages: 1,
        meta: {},
        rtt: null,
        bw: null,
        tokens: 0,
        tps: 0,
        peakTps: 0,
        streamPoints: [],
        recentTokenTimes: [],
        visible: true,
        pipelineDelayMs: 0
      }
    ];
    this.deviceSessionTotals = new Map(); // id -> totalTokensInSession
    this.activeHighlightId = null; // null = all visible, or specific device id
    this.showClusterCurve = true;

    // Cluster & Session state
    this.clusterSize = 1;
    this.sessionTokens = 0;
    this.promptCount = 0;
    this.totalGenerationTime = 0;
    this.currentModel = "";

    // Scalability benchmark curve (Nodes vs Throughput Multiplier / Speed)
    // Strictly in increasing order to demonstrate multi-system efficiency
    this.observedScaling = new Map(); // clusterSize -> peakTps
  }

  init() {
    if (typeof document === "undefined") return;
    if (document.getElementById("perf-sidebar")) return;

    this.injectStyles();
    this.mountDOM();
    this.setupListeners();
    this.setupCanvases();
    this.updateDeviceListUI();
    this.renderScalingChart();
    this.renderLiveChart();
  }

  setDevices(newDevices) {
    const oldMap = new Map(this.devices.map(d => [d.id, d]));
    this.devices = newDevices.map((nd, idx) => {
      const old = oldMap.get(nd.id) || {};
      return {
        ...old,
        ...nd,
        tps: old.tps || 0,
        tokens: old.tokens || 0,
        visible: old.visible !== undefined ? old.visible : true,
        streamPoints: old.streamPoints || [],
        color: DEVICE_COLORS[idx % DEVICE_COLORS.length]
      };
    });
    this.clusterSize = this.devices.length;
    this.updateDeviceListUI();
    this.renderScalingChart();
    this.renderLiveChart();
  }

  injectStyles() {
    if (document.getElementById("perf-sidebar-styles")) return;
    const style = document.createElement("style");
    style.id = "perf-sidebar-styles";
    style.textContent = `
      /* ---- WebSLICE Performance & Scaling Sidebar ---- */
      #perf-sidebar {
        width: 330px;
        flex: none;
        display: flex;
        flex-direction: column;
        border-left: 1px solid var(--border);
        background: color-mix(in srgb, var(--panel) 90%, transparent);
        overflow-y: auto;
        overflow-x: hidden;
        min-height: 0;
        transition: transform 0.28s cubic-bezier(0.2, 0.8, 0.2, 1),
                    width 0.28s cubic-bezier(0.2, 0.8, 0.2, 1),
                    margin-right 0.28s cubic-bezier(0.2, 0.8, 0.2, 1),
                    opacity 0.2s ease;
        z-index: 25;
      }
      #perf-sidebar.collapsed {
        margin-right: -330px;
        width: 0;
        border-left-color: transparent;
        pointer-events: none;
        opacity: 0;
      }
      @media (max-width: 1120px) {
        #perf-sidebar {
          position: fixed;
          top: 61px;
          right: 0;
          bottom: 0;
          width: 320px;
          background: var(--panel);
          box-shadow: -8px 0 32px rgba(20, 21, 26, 0.14);
          z-index: 90;
        }
        #perf-sidebar.collapsed {
          transform: translateX(100%);
          margin-right: 0;
          width: 320px;
        }
      }
      @media (max-width: 640px) {
        #perf-sidebar {
          width: 100vw;
          max-width: 100vw;
        }
        #perf-sidebar.collapsed {
          transform: translateX(100%);
          width: 100vw;
        }
      }

      /* Topbar Toggle Chip */
      .topbar-perf-chip {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        background: var(--panel);
        border: 1px solid var(--border);
        border-radius: 100px;
        padding: 5px 12px 5px 10px;
        font-family: var(--mono);
        font-size: 11.5px;
        color: var(--text);
        cursor: pointer;
        user-select: none;
        transition: all 0.2s cubic-bezier(0.2, 0.8, 0.2, 1);
        white-space: nowrap;
        margin-right: 4px;
      }
      .topbar-perf-chip:hover {
        border-color: var(--accent);
        transform: translateY(-1px);
        box-shadow: 0 4px 12px rgba(43, 78, 255, 0.1);
      }
      .topbar-perf-chip.active {
        border-color: color-mix(in srgb, var(--accent) 60%, var(--border));
        background: color-mix(in srgb, var(--accent) 8%, var(--panel));
        color: var(--accent);
        font-weight: 600;
      }
      .topbar-perf-chip.streaming {
        border-color: var(--accent);
        background: color-mix(in srgb, var(--accent) 12%, var(--panel));
        color: var(--accent);
        animation: perfChipPulse 1.6s infinite ease-in-out;
      }
      @keyframes perfChipPulse {
        0%, 100% { box-shadow: 0 0 0 0 rgba(43, 78, 255, 0.3); }
        50% { box-shadow: 0 0 0 4px rgba(43, 78, 255, 0); }
      }
      .topbar-perf-icon {
        color: var(--accent);
        flex: none;
      }

      /* Sidebar Internal Layout */
      .perf-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 14px 16px 12px;
        border-bottom: 1px solid var(--border);
        background: color-mix(in srgb, var(--panel-2) 60%, var(--panel));
        flex: none;
      }
      .perf-title-row {
        display: flex;
        align-items: center;
        gap: 8px;
      }
      .perf-icon-badge {
        width: 22px;
        height: 22px;
        border-radius: 6px;
        background: color-mix(in srgb, var(--accent) 15%, transparent);
        color: var(--accent);
        display: flex;
        align-items: center;
        justify-content: center;
        flex: none;
      }
      .perf-title {
        font-family: var(--mono);
        font-size: 11px;
        letter-spacing: 0.14em;
        font-weight: 700;
        color: var(--text);
      }
      .perf-header-actions {
        display: flex;
        align-items: center;
        gap: 8px;
      }
      .perf-status-pill {
        display: inline-flex;
        align-items: center;
        gap: 5px;
        font-family: var(--mono);
        font-size: 9.5px;
        font-weight: 600;
        letter-spacing: 0.05em;
        padding: 2px 7px;
        border-radius: 100px;
        background: var(--panel-2);
        color: var(--muted);
        border: 1px solid var(--border);
        transition: all 0.2s ease;
      }
      .perf-status-pill.streaming {
        background: color-mix(in srgb, var(--accent) 14%, transparent);
        color: var(--accent);
        border-color: color-mix(in srgb, var(--accent) 40%, transparent);
      }
      .perf-status-dot {
        width: 6px;
        height: 6px;
        border-radius: 50%;
        background: var(--muted);
      }
      .perf-status-pill.streaming .perf-status-dot {
        background: var(--accent);
        animation: perfDotBlink 1s infinite alternate;
      }
      @keyframes perfDotBlink {
        from { opacity: 0.4; transform: scale(0.85); }
        to { opacity: 1; transform: scale(1.15); }
      }
      .perf-close-btn {
        background: transparent;
        border: 1px solid transparent;
        border-radius: 6px;
        padding: 4px;
        cursor: pointer;
        color: var(--muted);
        display: flex;
        align-items: center;
        justify-content: center;
        transition: all 0.18s ease;
      }
      .perf-close-btn:hover {
        color: var(--text);
        border-color: var(--border);
        background: var(--panel-2);
      }

      /* Sections */
      .perf-section {
        padding: 14px 16px;
        border-bottom: 1px solid var(--border);
        display: flex;
        flex-direction: column;
        gap: 10px;
      }
      .perf-sec-label {
        display: flex;
        align-items: center;
        justify-content: space-between;
        font-family: var(--mono);
        font-size: 10px;
        letter-spacing: 0.16em;
        color: var(--muted);
        font-weight: 600;
        text-transform: uppercase;
      }
      .perf-unit {
        font-size: 10px;
        font-weight: 500;
        color: var(--text);
        text-transform: none;
        letter-spacing: 0;
      }
      .perf-badge-pill {
        font-size: 9.5px;
        font-weight: 600;
        color: var(--accent);
        background: color-mix(in srgb, var(--accent) 12%, transparent);
        padding: 2px 7px;
        border-radius: 100px;
        letter-spacing: 0;
      }

      /* Hero Speed Display */
      .perf-hero-stat {
        display: flex;
        flex-direction: column;
        gap: 2px;
        margin: 2px 0 4px;
      }
      .perf-hero-main-row {
        display: flex;
        align-items: baseline;
        gap: 6px;
      }
      .perf-hero-val {
        font-family: var(--sans);
        font-size: 34px;
        font-weight: 700;
        line-height: 1;
        letter-spacing: -0.03em;
        color: var(--text);
      }
      .perf-hero-val.streaming {
        color: var(--accent);
      }
      .perf-hero-unit {
        font-family: var(--mono);
        font-size: 11px;
        font-weight: 600;
        color: var(--muted);
        letter-spacing: 0.08em;
      }
      .perf-hero-sub {
        font-family: var(--mono);
        font-size: 10.5px;
        color: var(--muted);
        margin-top: 2px;
      }

      /* Multi-Device Legend Chips above Canvas */
      .perf-device-legend {
        display: flex;
        flex-wrap: wrap;
        gap: 5px;
        margin: 2px 0 6px;
      }
      .perf-legend-chip {
        display: inline-flex;
        align-items: center;
        gap: 5px;
        font-family: var(--mono);
        font-size: 10px;
        color: var(--text);
        background: var(--panel);
        border: 1px solid var(--border);
        border-radius: 100px;
        padding: 3px 8px;
        cursor: pointer;
        user-select: none;
        transition: all 0.18s ease;
      }
      .perf-legend-chip:hover {
        border-color: var(--accent);
        transform: translateY(-1px);
      }
      .perf-legend-chip.active {
        border-color: color-mix(in srgb, var(--accent) 50%, var(--border));
        background: color-mix(in srgb, var(--accent) 8%, var(--panel));
      }
      .perf-legend-chip.dimmed {
        opacity: 0.45;
        border-style: dashed;
      }
      .perf-chip-dot {
        width: 7px;
        height: 7px;
        border-radius: 50%;
        flex: none;
      }
      .perf-chip-speed {
        font-weight: 600;
        color: var(--muted);
      }
      .perf-legend-chip.active .perf-chip-speed {
        color: var(--text);
      }

      /* Canvas Wrap */
      .perf-canvas-wrap {
        position: relative;
        width: 100%;
        height: 124px;
        background: var(--panel);
        border: 1px solid var(--border);
        border-radius: 12px;
        overflow: hidden;
      }
      .perf-canvas-wrap canvas {
        width: 100%;
        height: 100%;
        display: block;
      }
      .perf-canvas-empty {
        position: absolute;
        inset: 0;
        display: flex;
        align-items: center;
        justify-content: center;
        text-align: center;
        font-family: var(--mono);
        font-size: 11px;
        color: var(--muted);
        padding: 16px;
        pointer-events: none;
        line-height: 1.4;
      }
      .perf-canvas-wrap.active .perf-canvas-empty {
        display: none;
      }

      /* Grid Devices Live Processing Breakdown */
      .perf-devices-breakdown-wrap {
        display: flex;
        flex-direction: column;
        gap: 8px;
        margin-top: 6px;
      }
      .perf-dev-card {
        background: var(--panel);
        border: 1px solid var(--border);
        border-radius: 10px;
        padding: 9px 11px;
        display: flex;
        flex-direction: column;
        gap: 6px;
        transition: border-color 0.2s ease, box-shadow 0.2s ease;
      }
      .perf-dev-card.streaming {
        border-color: color-mix(in srgb, var(--accent) 45%, var(--border));
        box-shadow: 0 2px 10px rgba(43, 78, 255, 0.06);
      }
      .perf-dev-top {
        display: flex;
        align-items: center;
        justify-content: space-between;
      }
      .perf-dev-title-wrap {
        display: flex;
        align-items: center;
        gap: 6px;
        min-width: 0;
      }
      .perf-dev-dot {
        width: 8px;
        height: 8px;
        border-radius: 50%;
        flex: none;
      }
      .perf-dev-name {
        font-family: var(--mono);
        font-size: 11px;
        font-weight: 600;
        color: var(--text);
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }
      .perf-dev-stage-badge {
        font-family: var(--mono);
        font-size: 9px;
        font-weight: 500;
        color: var(--muted);
        background: var(--panel-2);
        padding: 1px 5px;
        border-radius: 4px;
        border: 1px solid var(--border);
      }
      .perf-dev-rates {
        display: flex;
        align-items: baseline;
        gap: 6px;
        flex: none;
      }
      .perf-dev-tps {
        font-family: var(--mono);
        font-size: 12px;
        font-weight: 700;
        color: var(--text);
      }
      .perf-dev-toks {
        font-family: var(--mono);
        font-size: 10px;
        color: var(--muted);
      }
      .perf-dev-meter-track {
        height: 4px;
        background: color-mix(in srgb, var(--border) 70%, transparent);
        border-radius: 100px;
        overflow: hidden;
        width: 100%;
      }
      .perf-dev-meter-fill {
        height: 100%;
        border-radius: 100px;
        transition: width 0.18s cubic-bezier(0.2, 0.8, 0.2, 1);
      }
      .perf-dev-foot {
        display: flex;
        align-items: center;
        justify-content: space-between;
        font-family: var(--mono);
        font-size: 9.5px;
        color: var(--muted);
      }

      /* Metric Readouts Grid */
      .perf-grid {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 8px;
        margin-top: 4px;
      }
      .perf-stat-item {
        background: var(--panel);
        border: 1px solid var(--border);
        border-radius: 10px;
        padding: 8px 10px;
        display: flex;
        flex-direction: column;
        gap: 3px;
      }
      .perf-stat-k {
        font-family: var(--mono);
        font-size: 9px;
        letter-spacing: 0.12em;
        color: var(--muted);
        font-weight: 600;
      }
      .perf-stat-v {
        font-family: var(--mono);
        font-size: 13px;
        font-weight: 600;
        color: var(--text);
      }

      /* Scalability section */
      .perf-desc {
        font-size: 12px;
        color: var(--muted);
        line-height: 1.45;
        margin-bottom: 2px;
      }
      .perf-scaling-legend {
        display: flex;
        flex-direction: column;
        gap: 5px;
        margin-top: 6px;
      }
      .perf-scaling-row {
        display: flex;
        align-items: center;
        justify-content: space-between;
        font-family: var(--mono);
        font-size: 11px;
        padding: 4px 8px;
        border-radius: 6px;
        background: var(--panel);
        border: 1px solid transparent;
        transition: all 0.2s ease;
      }
      .perf-scaling-row.active {
        border-color: color-mix(in srgb, var(--accent) 45%, var(--border));
        background: color-mix(in srgb, var(--accent) 8%, var(--panel));
        font-weight: 600;
      }
      .perf-scaling-row.active .scaling-node-label {
        color: var(--accent);
      }
      .perf-scaling-row.active .scaling-node-mult {
        color: var(--accent);
      }
      .scaling-node-label {
        color: var(--text);
        display: flex;
        align-items: center;
        gap: 6px;
      }
      .scaling-active-tag {
        font-size: 8.5px;
        background: var(--accent);
        color: #fff;
        padding: 1px 4px;
        border-radius: 3px;
        font-weight: 700;
        letter-spacing: 0.05em;
      }
      .scaling-node-mult {
        font-weight: 600;
        color: var(--muted);
      }

      /* Summary List */
      .perf-summary-list {
        display: flex;
        flex-direction: column;
        gap: 6px;
      }
      .perf-summary-row {
        display: flex;
        align-items: center;
        justify-content: space-between;
        font-family: var(--mono);
        font-size: 11.5px;
        color: var(--muted);
        padding: 2px 0;
      }
      .perf-summary-row b {
        color: var(--text);
        font-weight: 600;
      }
      .perf-dev-sess-list {
        display: flex;
        flex-direction: column;
        gap: 4px;
        margin-top: 6px;
        padding-top: 6px;
        border-top: 1px dashed var(--border);
      }
      .perf-dev-sess-row {
        display: flex;
        align-items: center;
        justify-content: space-between;
        font-family: var(--mono);
        font-size: 10.5px;
        color: var(--muted);
      }
      .perf-dev-sess-row span {
        display: inline-flex;
        align-items: center;
        gap: 5px;
      }
    `;
    document.head.appendChild(style);
  }

  mountDOM() {
    // 1. Mount Topbar Toggle Button inside <header>
    const header = document.querySelector("header");
    if (header && !document.getElementById("topbar-perf-btn")) {
      const topbarPeers = document.getElementById("topbar-peers");
      const btn = document.createElement("button");
      btn.id = "topbar-perf-btn";
      btn.className = "topbar-perf-chip active";
      btn.type = "button";
      btn.title = "Toggle Speed & WebSLICE Scaling Analytics";
      btn.innerHTML = `
        <svg class="topbar-perf-icon" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round">
          <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"></polyline>
        </svg>
        <span id="topbar-perf-rate">0.0 tok/s</span>
      `;
      btn.onclick = () => this.toggleSidebar();
      if (topbarPeers) {
        header.insertBefore(btn, topbarPeers);
      } else {
        header.appendChild(btn);
      }
    }

    // 2. Mount Sidebar into #room-screen
    const roomScreen = document.getElementById("room-screen");
    if (!roomScreen) return;

    const aside = document.createElement("aside");
    aside.id = "perf-sidebar";
    aside.className = "perf-sidebar";
    aside.innerHTML = `
      <!-- Header -->
      <div class="perf-header">
        <div class="perf-title-row">
          <div class="perf-icon-badge">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
              <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"></polyline>
            </svg>
          </div>
          <span class="perf-title">SPEED &amp; SCALING</span>
        </div>
        <div class="perf-header-actions">
          <span class="perf-status-pill idle" id="perf-status-pill">
            <span class="perf-status-dot"></span>
            <span id="perf-status-label">IDLE</span>
          </span>
          <button type="button" class="perf-close-btn" id="perf-close-btn" title="Collapse analytics sidebar" aria-label="Collapse analytics sidebar">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
          </button>
        </div>
      </div>

      <!-- Live Token Velocity -->
      <div class="perf-section">
        <div class="perf-sec-label">
          <span>LIVE STREAM VELOCITY</span>
          <span class="perf-unit" id="perf-cur-model">—</span>
        </div>
        
        <div class="perf-hero-stat">
          <div class="perf-hero-main-row">
            <div class="perf-hero-val" id="perf-hero-tps">0.0</div>
            <div class="perf-hero-unit">TOK / SEC</div>
          </div>
          <div class="perf-hero-sub" id="perf-hero-sub">Solo Device Execution</div>
        </div>

        <!-- Multi-Device Legend Chips -->
        <div class="perf-device-legend" id="perf-device-legend"></div>

        <div class="perf-canvas-wrap" id="perf-live-canvas-wrap">
          <canvas id="perf-live-canvas" width="298" height="124"></canvas>
          <div class="perf-canvas-empty" id="perf-live-empty">Send a prompt to stream live token throughput curve</div>
        </div>

        <!-- Grid Devices Processing Breakdown -->
        <div class="perf-devices-breakdown-wrap" id="perf-devices-breakdown-wrap">
          <div class="perf-sec-label" style="margin-top: 4px;">
            <span>GRID TOKENS PROCESSED</span>
            <span class="perf-badge-pill" id="perf-grid-share-badge">1 NODE</span>
          </div>
          <div id="perf-devices-list" style="display:flex; flex-direction:column; gap:6px;"></div>
        </div>

        <div class="perf-grid">
          <div class="perf-stat-item">
            <span class="perf-stat-k">PEAK SPEED</span>
            <span class="perf-stat-v" id="perf-stat-peak">0.0 tok/s</span>
          </div>
          <div class="perf-stat-item">
            <span class="perf-stat-k">TOKENS YIELDED</span>
            <span class="perf-stat-v" id="perf-stat-tokens">0 tok</span>
          </div>
          <div class="perf-stat-item">
            <span class="perf-stat-k">TIME TO FIRST TOKEN</span>
            <span class="perf-stat-v" id="perf-stat-ttft">— ms</span>
          </div>
          <div class="perf-stat-item">
            <span class="perf-stat-k">ELAPSED TIME</span>
            <span class="perf-stat-v" id="perf-stat-time">0.0s</span>
          </div>
        </div>
      </div>

      <!-- Multi-System WebSLICE Scalability -->
      <div class="perf-section">
        <div class="perf-sec-label">
          <span>SWARM SCALING EFFICIENCY</span>
          <span class="perf-badge-pill" id="perf-active-nodes-badge">1 DEVICE (SOLO)</span>
        </div>
        <div class="perf-desc">
          Adding systems increases effective throughput in strictly increasing order via pooled memory bandwidth &amp; pipelining:
        </div>

        <div class="perf-canvas-wrap" style="height: 148px;">
          <canvas id="perf-scaling-canvas" width="298" height="148"></canvas>
        </div>

        <div class="perf-scaling-legend" id="perf-scaling-legend"></div>
      </div>

      <!-- Session Aggregates -->
      <div class="perf-section" style="margin-top: auto; border-bottom: none;">
        <div class="perf-sec-label">
          <span>ROOM SESSION TOTALS</span>
        </div>
        <div class="perf-summary-list">
          <div class="perf-summary-row">
            <span>Session Tokens</span>
            <b id="perf-sess-tokens">0 tok</b>
          </div>
          <div class="perf-summary-row">
            <span>Avg Stream Speed</span>
            <b id="perf-sess-avg-tps">— tok/s</b>
          </div>
          <div class="perf-summary-row">
            <span>Mesh Devices Online</span>
            <b id="perf-sess-devices">1 Device</b>
          </div>
        </div>
        <div class="perf-dev-sess-list" id="perf-dev-sess-list" style="display:none;"></div>
      </div>
    `;

    roomScreen.appendChild(aside);
    this.container = aside;

    // Check stored collapse state
    try {
      const stored = localStorage.getItem("swarm_perf_sidebar");
      if (stored === "closed") {
        this.setCollapsed(true);
      }
    } catch {}
  }

  setupListeners() {
    const closeBtn = document.getElementById("perf-close-btn");
    if (closeBtn) {
      closeBtn.onclick = () => this.toggleSidebar();
    }

    window.addEventListener("resize", () => {
      this.resizeCanvases();
      this.renderScalingChart();
      this.renderLiveChart();
    });

    if (typeof ResizeObserver !== "undefined" && this.container) {
      const ro = new ResizeObserver(() => {
        this.resizeCanvases();
        this.renderScalingChart();
        this.renderLiveChart();
      });
      ro.observe(this.container);
    }
  }

  toggleSidebar() {
    if (!this.container) return;
    const isClosed = this.container.classList.contains("collapsed");
    this.setCollapsed(!isClosed);
  }

  setCollapsed(collapsed) {
    if (!this.container) return;
    const btn = document.getElementById("topbar-perf-btn");
    if (collapsed) {
      this.container.classList.add("collapsed");
      if (btn) btn.classList.remove("active");
      try { localStorage.setItem("swarm_perf_sidebar", "closed"); } catch {}
    } else {
      this.container.classList.remove("collapsed");
      if (btn) btn.classList.add("active");
      try { localStorage.setItem("swarm_perf_sidebar", "open"); } catch {}
      // Force canvas refresh on expand
      setTimeout(() => {
        this.resizeCanvases();
        this.renderScalingChart();
        this.renderLiveChart();
      }, 150);
    }
  }

  setupCanvases() {
    this.liveCanvas = document.getElementById("perf-live-canvas");
    this.scalingCanvas = document.getElementById("perf-scaling-canvas");
    if (this.liveCanvas) this.liveCtx = this.liveCanvas.getContext("2d");
    if (this.scalingCanvas) this.scalingCtx = this.scalingCanvas.getContext("2d");
    this.resizeCanvases();
  }

  
  resizeCanvases() {
    if (this.liveChartInstance) this.liveChartInstance.resize();
    if (this.scalingChartInstance) this.scalingChartInstance.resize();
  }

  updateDeviceListUI() {
    if (typeof document === "undefined") return;

    // 1. Legend Chips above Canvas
    const legendEl = document.getElementById("perf-device-legend");
    if (legendEl) {
      if (this.devices.length > 1) {
        let chipsHtml = this.devices.map(d => {
          const isDimmed = this.activeHighlightId !== null && this.activeHighlightId !== d.id;
          return `
            <button type="button" class="perf-legend-chip ${d.visible ? 'active' : ''} ${isDimmed ? 'dimmed' : ''}" data-dev-id="${escapeHtml(d.id)}">
              <span class="perf-chip-dot" style="background:${d.color};"></span>
              <span>${escapeHtml(d.name)}</span>
              <span class="perf-chip-speed" id="legend-speed-${escapeHtml(d.id)}">${d.tps.toFixed(1)} tok/s</span>
            </button>
          `;
        }).join("");

        // Cluster Total Chip
        const isClusterDimmed = this.activeHighlightId !== null && this.activeHighlightId !== "cluster";
        chipsHtml += `
          <button type="button" class="perf-legend-chip ${this.showClusterCurve ? 'active' : ''} ${isClusterDimmed ? 'dimmed' : ''}" data-dev-id="cluster">
            <span class="perf-chip-dot" style="background:var(--text);"></span>
            <span>Cluster</span>
            <span class="perf-chip-speed" id="legend-speed-cluster">${this.peakTps.toFixed(1)} tok/s</span>
          </button>
        `;
        legendEl.innerHTML = chipsHtml;

        // Add click handlers for interactive highlighting
        legendEl.querySelectorAll(".perf-legend-chip").forEach(chip => {
          chip.onclick = () => {
            const devId = chip.getAttribute("data-dev-id");
            if (devId === "cluster") {
              this.showClusterCurve = !this.showClusterCurve;
            } else {
              if (this.activeHighlightId === devId) {
                this.activeHighlightId = null; // reset filter
              } else {
                this.activeHighlightId = devId; // focus on this device
              }
            }
            this.updateDeviceListUI();
            this.renderLiveChart();
          };
        });
      } else {
        legendEl.innerHTML = "";
      }
    }

    // 2. Grid Devices Processing Breakdown Cards
    const listEl = document.getElementById("perf-devices-list");
    if (listEl) {
      listEl.innerHTML = this.devices.map(d => {
        const pct = this.tokenCount > 0 ? Math.min(100, Math.round((d.tokens / this.tokenCount) * 100)) : 100;
        const gpuMeta = d.meta?.gpu || (d.meta?.webgpu ? "WebGPU" : "Mesh Node");
        const latMeta = d.rtt !== null ? `RTT: ${d.rtt}ms` : "Local Host";

        return `
          <div class="perf-dev-card ${this.isStreaming ? 'streaming' : ''}" id="dev-card-${escapeHtml(d.id)}">
            <div class="perf-dev-top">
              <div class="perf-dev-title-wrap">
                <span class="perf-dev-dot" style="background:${d.color};"></span>
                <span class="perf-dev-name" title="${escapeHtml(d.name)}">${escapeHtml(d.name)}</span>
                <span class="perf-dev-stage-badge">${escapeHtml(d.stage)}</span>
              </div>
              <div class="perf-dev-rates">
                <span class="perf-dev-tps" id="dev-tps-${escapeHtml(d.id)}">${d.tps.toFixed(1)} tok/s</span>
                <span class="perf-dev-toks" id="dev-toks-${escapeHtml(d.id)}">${d.tokens} tok</span>
              </div>
            </div>
            <div class="perf-dev-meter-track">
              <div class="perf-dev-meter-fill" id="dev-meter-${escapeHtml(d.id)}" style="width:${pct}%; background:${d.color};"></div>
            </div>
            <div class="perf-dev-foot">
              <span>${escapeHtml(gpuMeta)}</span>
              <span>${escapeHtml(latMeta)}</span>
            </div>
          </div>
        `;
      }).join("");
    }
  }

  /**
   * Fast dynamic update for live token numbers during streaming
   */
  updateDeviceReadouts(instantTps) {
    if (typeof document === "undefined") return;

    const clusterSpeedEl = document.getElementById("legend-speed-cluster");
    if (clusterSpeedEl) clusterSpeedEl.textContent = `${instantTps.toFixed(1)} tok/s`;

    this.devices.forEach(d => {
      const legSpeed = document.getElementById(`legend-speed-${d.id}`);
      if (legSpeed) legSpeed.textContent = `${d.tps.toFixed(1)} tok/s`;

      const devTps = document.getElementById(`dev-tps-${d.id}`);
      if (devTps) devTps.textContent = `${d.tps.toFixed(1)} tok/s`;

      const devToks = document.getElementById(`dev-toks-${d.id}`);
      if (devToks) devToks.textContent = `${d.tokens} tok`;

      const devMeter = document.getElementById(`dev-meter-${d.id}`);
      if (devMeter) {
        const pct = this.tokenCount > 0 ? Math.min(100, Math.round((d.tokens / this.tokenCount) * 100)) : 100;
        devMeter.style.width = `${pct}%`;
      }
    });
  }

  updateSessionDevicesList() {
    if (typeof document === "undefined") return;
    const sessList = document.getElementById("perf-dev-sess-list");
    if (!sessList) return;

    if (this.devices.length > 1) {
      sessList.style.display = "flex";
      sessList.innerHTML = this.devices.map(d => {
        const tot = this.deviceSessionTotals.get(d.id) || 0;
        return `
          <div class="perf-dev-sess-row">
            <span>
              <span class="perf-dev-dot" style="background:${d.color};"></span>
              ${escapeHtml(d.name)}
            </span>
            <b>${tot.toLocaleString()} tok</b>
          </div>
        `;
      }).join("");
    } else {
      sessList.style.display = "none";
    }
  }

  /**
   * Render Live Stream Velocity Chart
   * Displays instantaneous tok/s curve over time with leading pulse ring,
   * showing per-device velocity traces when multiple devices are in the grid.
   */
  
  renderLiveChart() {
    if (!this.liveCtx || !this.liveCanvas) return;
    
    if (!this.liveChartInstance) {
      this.liveChartInstance = new Chart(this.liveCanvas, {
        type: 'line',
        data: {
          datasets: []
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          animation: { duration: 0 },
          scales: {
            x: { type: 'linear', display: false },
            y: { beginAtZero: true, grid: { color: 'rgba(225, 222, 210, 0.7)' } }
          },
          plugins: { legend: { display: false } }
        }
      });
    }

    const datasets = [];
    const isMultiDevice = this.devices.length > 1;

    if (!isMultiDevice && this.streamPoints.length >= 2) {
      datasets.push({
        label: 'Solo',
        data: this.streamPoints.map(p => ({x: p.t, y: p.tps})),
        borderColor: DEVICE_COLORS[0] || '#2b4eff',
        borderWidth: 2,
        fill: true,
        backgroundColor: 'rgba(43, 78, 255, 0.1)',
        tension: 0.4,
        pointRadius: 0
      });
    } else if (isMultiDevice) {
      this.devices.forEach((dev) => {
        if (!dev.visible || dev.streamPoints.length < 2) return;
        datasets.push({
          label: dev.id,
          data: dev.streamPoints.map(p => ({x: p.t, y: p.tps})),
          borderColor: dev.color || '#8b877a',
          borderWidth: 1.5,
          tension: 0.4,
          pointRadius: 0
        });
      });
      if (this.showClusterCurve && this.streamPoints.length >= 2) {
        datasets.push({
          label: 'Cluster',
          data: this.streamPoints.map(p => ({x: p.t, y: p.tps})),
          borderColor: 'rgba(22, 23, 28, 0.85)',
          borderWidth: 2,
          borderDash: [4, 3],
          tension: 0.4,
          pointRadius: 0
        });
      }
    }

    this.liveChartInstance.data.datasets = datasets;
    this.liveChartInstance.update();
  }

  renderScalingChart() {
    if (!this.scalingCtx || !this.scalingCanvas) return;
    
    if (!this.scalingChartInstance) {
      this.scalingChartInstance = new Chart(this.scalingCanvas, {
        type: 'bar',
        data: { labels: [], datasets: [] },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          animation: { duration: 0 },
          scales: {
            x: { grid: { display: false } },
            y: { beginAtZero: true, display: false }
          },
          plugins: { legend: { display: false } }
        }
      });
    }

    
      const labels = ["1 device", "2 devices", "3 devices", "4 devices", "5+ devices"];
      const speeds = [1, 2, 3, 4, 5].map(n => this.observedScaling.get(n) || 0);

      const bgColors = [1, 2, 3, 4, 5].map(n => {
        const isActive = (n === this.clusterSize) || (n === 5 && this.clusterSize >= 5);
        return isActive ? 'rgba(43, 78, 255, 0.6)' : 'rgba(139, 135, 122, 0.2)';
      });

      const borderColors = [1, 2, 3, 4, 5].map(n => {
        const isActive = (n === this.clusterSize) || (n === 5 && this.clusterSize >= 5);
        return isActive ? '#2b4eff' : 'transparent';
      });

      if (this.scalingChartInstance && this.scalingChartInstance.data) {
        this.scalingChartInstance.data.labels = labels;
        this.scalingChartInstance.data.datasets = [
          {
            type: 'bar',
            label: 'Peak Speed (tok/s)',
            data: speeds,
            backgroundColor: bgColors,
            borderColor: borderColors,
            borderWidth: 1.5,
            borderRadius: 4
          }
        ];
        try { this.scalingChartInstance.update(); } catch (e) { console.warn("Chart update failed", e); }
      }
      this.updateScalingLegend();

  }
updateScalingLegend() {
    if (typeof document === "undefined") return;
    const legend = document.getElementById("perf-scaling-legend");
    if (!legend) return;

    
    legend.innerHTML = [1, 2, 3, 4, 5].map(n => {
      const isActive = (n === this.clusterSize) || (n === 5 && this.clusterSize >= 5);
      const label = n === 5 ? "5+ devices" : n + " device" + (n > 1 ? "s" : "");
      const speed = this.observedScaling.get(n);
      const speedText = speed ? speed.toFixed(1) + " tok/s" : "— waiting for benchmark";
      return `
        <div class="perf-scaling-row ${isActive ? 'active' : ''}">
          <span class="scaling-node-label">
            ${label}
            ${isActive ? '<span class="scaling-active-tag">CURRENT</span>' : ''}
          </span>
          <span class="scaling-node-mult">${speedText}</span>
        </div>
      `;
    }).join("");

  }
}

function escapeHtml(str) {
  return String(str || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

// Global instance export
export const perfSidebar = new PerfSidebar();
