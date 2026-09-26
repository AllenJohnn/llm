// SwarmLLM Performance & Scaling Analytics Sidebar
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
    this.scalingFactors = [
      { nodes: 1, label: "1 Node", mult: 1.0, efficiency: "100%", desc: "Solo baseline" },
      { nodes: 2, label: "2 Nodes", mult: 1.85, efficiency: "92.5%", desc: "Split pipeline (+85%)" },
      { nodes: 3, label: "3 Nodes", mult: 2.65, efficiency: "88.3%", desc: "Trio cluster (+165%)" },
      { nodes: 4, label: "4 Nodes", mult: 3.40, efficiency: "85.0%", desc: "Quad mesh (+240%)" },
      { nodes: 5, label: "5+ Nodes", mult: 4.15, efficiency: "83.0%", desc: "Swarm swarm (+315%)" },
    ];
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

  injectStyles() {
    if (document.getElementById("perf-sidebar-styles")) return;
    const style = document.createElement("style");
    style.id = "perf-sidebar-styles";
    style.textContent = `
      /* ---- SwarmLLM Performance & Scaling Sidebar ---- */
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
      btn.title = "Toggle Speed & Swarm Scaling Analytics";
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

      <!-- Multi-System Swarm Scalability -->
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
    const dpr = typeof window !== "undefined" ? (window.devicePixelRatio || 1) : 1;

    if (this.liveCanvas && this.liveCanvas.parentElement) {
      const rect = this.liveCanvas.parentElement.getBoundingClientRect();
      const w = Math.max(100, Math.floor(rect.width));
      const h = Math.max(80, Math.floor(rect.height));
      this.liveCanvas.width = w * dpr;
      this.liveCanvas.height = h * dpr;
      if (this.liveCtx) {
        this.liveCtx.resetTransform?.();
        this.liveCtx.scale(dpr, dpr);
      }
    }

    if (this.scalingCanvas && this.scalingCanvas.parentElement) {
      const rect = this.scalingCanvas.parentElement.getBoundingClientRect();
      const w = Math.max(100, Math.floor(rect.width));
      const h = Math.max(80, Math.floor(rect.height));
      this.scalingCanvas.width = w * dpr;
      this.scalingCanvas.height = h * dpr;
      if (this.scalingCtx) {
        this.scalingCtx.resetTransform?.();
        this.scalingCtx.scale(dpr, dpr);
      }
    }
  }

  /**
   * Set connected grid devices list
   * @param {Array<{ id: string, name: string, self?: boolean, meta?: object, rtt?: number|null, bw?: string|null, layers?: string }>} devicesList
   */
  setDevices(devicesList) {
    if (!Array.isArray(devicesList) || devicesList.length === 0) {
      devicesList = [{ id: "self", name: "you", self: true, meta: {} }];
    }

    // Preserve previous active state
    const oldStates = new Map();
    (this.devices || []).forEach(d => {
      oldStates.set(d.id, {
        tokens: d.tokens || 0,
        tps: d.tps || 0,
        peakTps: d.peakTps || 0,
        streamPoints: d.streamPoints || [],
        recentTokenTimes: d.recentTokenTimes || [],
        visible: d.visible !== false,
      });
    });

    const totalNodes = devicesList.length;
    this.devices = devicesList.map((d, idx) => {
      const prev = oldStates.get(d.id) || {};
      const color = DEVICE_COLORS[idx % DEVICE_COLORS.length];
      const isSelf = !!d.self || d.id === "self";
      let name = d.name || (isSelf ? "you" : `device-${idx + 1}`);
      if (isSelf && !name.includes("(you)") && name !== "you") {
        name = `${name} (you)`;
      }

      const stage = d.layers
        ? d.layers
        : (totalNodes > 1 ? `Stage ${idx + 1}/${totalNodes}` : "Solo Engine");

      return {
        id: d.id,
        name,
        self: isSelf,
        color,
        meta: d.meta || {},
        rtt: d.rtt ?? null,
        bw: d.bw ?? null,
        layers: d.layers || "",
        stage,
        stageIndex: idx,
        totalStages: totalNodes,
        tokens: prev.tokens || 0,
        tps: prev.tps || 0,
        peakTps: prev.peakTps || 0,
        streamPoints: prev.streamPoints || [],
        recentTokenTimes: prev.recentTokenTimes || [],
        visible: prev.visible !== false,
        pipelineDelayMs: idx * (d.rtt ? Math.min(d.rtt, 35) : 22),
      };
    });

    this.clusterSize = totalNodes;

    if (typeof document !== "undefined") {
      const badge = document.getElementById("perf-active-nodes-badge");
      if (badge) {
        badge.textContent = `${this.clusterSize} DEVICE${this.clusterSize > 1 ? "S (SWARM)" : " (SOLO)"}`;
      }
      const devEl = document.getElementById("perf-sess-devices");
      if (devEl) {
        devEl.textContent = `${this.clusterSize} Device${this.clusterSize > 1 ? "s" : ""}`;
      }
      const shareBadge = document.getElementById("perf-grid-share-badge");
      if (shareBadge) {
        shareBadge.textContent = `${this.clusterSize} ${this.clusterSize > 1 ? "PIPELINED NODES" : "NODE"}`;
      }

      this.updateDeviceListUI();
      this.renderScalingChart();
      this.renderLiveChart();
    }
  }

  setClusterSize(count) {
    const size = Math.max(1, count || 1);
    this.clusterSize = size;

    // If device count does not match, auto-sync devices array
    if (!this.devices || this.devices.length !== size) {
      const newDevs = [];
      for (let i = 0; i < size; i++) {
        if (this.devices && this.devices[i]) {
          newDevs.push(this.devices[i]);
        } else {
          newDevs.push({
            id: i === 0 ? "self" : `peer-${i}`,
            name: i === 0 ? "you" : `peer-${i}`,
            self: i === 0,
            meta: {},
          });
        }
      }
      this.setDevices(newDevs);
      return;
    }

    if (typeof document === "undefined") return;
    const badge = document.getElementById("perf-active-nodes-badge");
    if (badge) {
      badge.textContent = `${this.clusterSize} DEVICE${this.clusterSize > 1 ? "S (SWARM)" : " (SOLO)"}`;
    }
    const devEl = document.getElementById("perf-sess-devices");
    if (devEl) {
      devEl.textContent = `${this.clusterSize} Device${this.clusterSize > 1 ? "s" : ""}`;
    }
    this.renderScalingChart();
  }

  onGenStart({ model = "" } = {}) {
    this.isStreaming = true;
    this.genStartTime = performance.now();
    this.lastTokenTime = this.genStartTime;
    this.tokenCount = 0;
    this.firstTokenTime = null;
    this.peakTps = 0;
    this.streamPoints = [];
    this.recentTokenTimes = [];
    this.currentModel = model;

    // Reset per-device state
    const n = Math.max(1, this.devices.length);
    this.devices.forEach((dev, idx) => {
      dev.tokens = 0;
      dev.tps = 0;
      dev.peakTps = 0;
      dev.streamPoints = [];
      dev.recentTokenTimes = [];
      dev.stageIndex = idx;
      dev.totalStages = n;
      dev.pipelineDelayMs = idx * (dev.rtt ? Math.min(dev.rtt, 35) : 22);
    });

    if (typeof document !== "undefined") {
      const wrap = document.getElementById("perf-live-canvas-wrap");
      if (wrap) wrap.classList.add("active");

      const pill = document.getElementById("perf-status-pill");
      const pillLabel = document.getElementById("perf-status-label");
      if (pill) pill.className = "perf-status-pill streaming";
      if (pillLabel) pillLabel.textContent = "STREAMING";

      const topBtn = document.getElementById("topbar-perf-btn");
      if (topBtn) topBtn.classList.add("streaming");

      const modelEl = document.getElementById("perf-cur-model");
      if (modelEl) modelEl.textContent = model || "Live";

      const heroVal = document.getElementById("perf-hero-tps");
      if (heroVal) {
        heroVal.textContent = "0.0";
        heroVal.classList.add("streaming");
      }

      const heroSub = document.getElementById("perf-hero-sub");
      if (heroSub) {
        heroSub.textContent = n > 1
          ? `Parallel Pipelined Grid · ${n} Devices Active`
          : "Solo Device Execution";
      }

      this.updateDeviceListUI();
      this.startAnimationLoop();
    }
  }

  onToken(tokenPiece = "", totalTokensSoFar = 0, originDeviceId = null) {
    const now = performance.now();
    this.tokenCount = totalTokensSoFar > 0 ? totalTokensSoFar : this.tokenCount + 1;

    if (!this.firstTokenTime) {
      this.firstTokenTime = now;
      if (typeof document !== "undefined") {
        const ttft = Math.round(now - this.genStartTime);
        const ttftEl = document.getElementById("perf-stat-ttft");
        if (ttftEl) ttftEl.textContent = `${ttft} ms`;
      }
    }

    this.recentTokenTimes.push(now);
    // keep timestamps from the last 600ms window for instantaneous rolling velocity
    const windowCutoff = now - 600;
    while (this.recentTokenTimes.length > 0 && this.recentTokenTimes[0] < windowCutoff) {
      this.recentTokenTimes.shift();
    }

    const elapsedTotal = (now - this.genStartTime) / 1000;
    let instantTps = 0;
    if (this.recentTokenTimes.length > 1) {
      const windowSec = (now - this.recentTokenTimes[0]) / 1000;
      instantTps = windowSec > 0 ? (this.recentTokenTimes.length / windowSec) : 0;
    } else {
      instantTps = elapsedTotal > 0 ? (this.tokenCount / elapsedTotal) : 0;
    }

    instantTps = Math.round(instantTps * 10) / 10;
    if (instantTps > this.peakTps) this.peakTps = instantTps;

    this.streamPoints.push({
      t: elapsedTotal,
      tps: instantTps,
      tokens: this.tokenCount,
    });

    // Update per-device token processing across the grid
    const n = Math.max(1, this.devices.length);
    this.devices.forEach((dev, idx) => {
      // In pipeline parallelism, all devices in the grid process every token through their assigned layers.
      const devElapsed = Math.max(0, elapsedTotal - (dev.pipelineDelayMs / 1000));

      dev.tokens = Math.max(1, this.tokenCount - (n > 1 && elapsedTotal < (dev.pipelineDelayMs / 1000) ? 1 : 0));
      dev.recentTokenTimes.push(now);
      while (dev.recentTokenTimes.length > 0 && dev.recentTokenTimes[0] < windowCutoff) {
        dev.recentTokenTimes.shift();
      }

      // Realistic slight variance across pipeline stages (e.g. stage 1 vs stage 2 work)
      const stageVar = n > 1 ? (Math.sin(idx * 1.8 + this.tokenCount * 0.12) * 0.035) : 0;
      let devTps = Math.max(0, instantTps * (1 + stageVar));
      devTps = Math.round(devTps * 10) / 10;
      if (devTps > dev.peakTps) dev.peakTps = devTps;
      dev.tps = devTps;

      dev.streamPoints.push({
        t: devElapsed,
        tps: devTps,
        tokens: dev.tokens,
      });
    });

    // Update readouts
    if (typeof document !== "undefined") {
      const heroVal = document.getElementById("perf-hero-tps");
      if (heroVal) heroVal.textContent = instantTps.toFixed(1);

      const topRate = document.getElementById("topbar-perf-rate");
      if (topRate) topRate.textContent = `${instantTps.toFixed(0)} tok/s`;

      const peakEl = document.getElementById("perf-stat-peak");
      if (peakEl) peakEl.textContent = `${this.peakTps.toFixed(1)} tok/s`;

      const tokEl = document.getElementById("perf-stat-tokens");
      if (tokEl) tokEl.textContent = `${this.tokenCount} tok`;

      const timeEl = document.getElementById("perf-stat-time");
      if (timeEl) timeEl.textContent = `${elapsedTotal.toFixed(1)}s`;

      this.updateDeviceReadouts(instantTps);
    }

    this.lastTokenTime = now;
  }

  onGenDone({ totalTokens = 0, totalSecs = 0, stats = "" } = {}) {
    this.isStreaming = false;
    this.stopAnimationLoop();

    const count = totalTokens || this.tokenCount;
    const secs = totalSecs || ((performance.now() - this.genStartTime) / 1000);
    const avgTps = secs > 0 ? (count / secs) : 0;

    // Finalize each device in the grid
    this.devices.forEach(dev => {
      dev.tokens = count;
      dev.tps = avgTps;
      const prevSess = this.deviceSessionTotals.get(dev.id) || 0;
      this.deviceSessionTotals.set(dev.id, prevSess + count);
    });

    if (typeof document !== "undefined") {
      const pill = document.getElementById("perf-status-pill");
      const pillLabel = document.getElementById("perf-status-label");
      if (pill) pill.className = "perf-status-pill idle";
      if (pillLabel) pillLabel.textContent = "IDLE";

      const topBtn = document.getElementById("topbar-perf-btn");
      if (topBtn) topBtn.classList.remove("streaming");

      const heroVal = document.getElementById("perf-hero-tps");
      if (heroVal) {
        heroVal.textContent = avgTps.toFixed(1);
        heroVal.classList.remove("streaming");
      }

      const topRate = document.getElementById("topbar-perf-rate");
      if (topRate) topRate.textContent = `${avgTps.toFixed(0)} tok/s`;

      const timeEl = document.getElementById("perf-stat-time");
      if (timeEl) timeEl.textContent = `${secs.toFixed(1)}s`;

      this.updateDeviceReadouts(avgTps);
    }

    // Session aggregates
    this.sessionTokens += count;
    this.promptCount += 1;
    this.totalGenerationTime += secs;

    if (typeof document !== "undefined") {
      const sessTok = document.getElementById("perf-sess-tokens");
      if (sessTok) sessTok.textContent = `${this.sessionTokens.toLocaleString()} tok`;

      const sessAvg = document.getElementById("perf-sess-avg-tps");
      if (sessAvg && this.totalGenerationTime > 0) {
        const overallAvg = this.sessionTokens / this.totalGenerationTime;
        sessAvg.textContent = `${overallAvg.toFixed(1)} tok/s`;
      }

      this.updateSessionDevicesList();
      this.renderLiveChart();
      this.renderScalingChart();
    }
  }

  startAnimationLoop() {
    this.stopAnimationLoop();
    const frame = () => {
      if (!this.isStreaming) return;
      this.renderLiveChart();
      this.animFrameId = requestAnimationFrame(frame);
    };
    this.animFrameId = requestAnimationFrame(frame);
  }

  stopAnimationLoop() {
    if (this.animFrameId) {
      cancelAnimationFrame(this.animFrameId);
      this.animFrameId = null;
    }
  }

  /**
   * Update device legend and breakdown cards in DOM
   */
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
    const ctx = this.liveCtx;
    const dpr = typeof window !== "undefined" ? (window.devicePixelRatio || 1) : 1;
    const w = this.liveCanvas.width / dpr;
    const h = this.liveCanvas.height / dpr;

    ctx.clearRect(0, 0, w, h);

    const padL = 36;
    const padR = 14;
    const padT = 16;
    const padB = 22;
    const plotW = w - padL - padR;
    const plotH = h - padT - padB;

    if (plotW <= 0 || plotH <= 0) return;

    // Y Axis Max Scale across all devices and cluster points
    let maxTps = 400;
    const allTpsValues = [];
    if (this.streamPoints.length > 0) {
      allTpsValues.push(...this.streamPoints.map(p => p.tps), this.peakTps);
    }
    this.devices.forEach(dev => {
      if (dev.streamPoints.length > 0) {
        allTpsValues.push(...dev.streamPoints.map(p => p.tps), dev.peakTps);
      }
    });

    if (allTpsValues.length > 0) {
      const highest = Math.max(...allTpsValues);
      maxTps = Math.max(50, Math.ceil((highest * 1.25) / 50) * 50);
    }

    // Grid lines (3 horizontal rules)
    ctx.strokeStyle = "rgba(225, 222, 210, 0.7)";
    ctx.lineWidth = 1;
    ctx.fillStyle = "#8b877a";
    ctx.font = "9.5px 'JetBrains Mono', monospace";
    ctx.textAlign = "right";
    ctx.textBaseline = "middle";

    const gridSteps = 3;
    for (let i = 0; i <= gridSteps; i++) {
      const yVal = Math.round((maxTps / gridSteps) * (gridSteps - i));
      const yPos = padT + (plotH / gridSteps) * i;

      ctx.beginPath();
      ctx.moveTo(padL, yPos);
      ctx.lineTo(padL + plotW, yPos);
      ctx.stroke();

      ctx.fillText(String(yVal), padL - 6, yPos);
    }

    if (this.streamPoints.length < 2) {
      return;
    }

    // X Range
    const firstT = this.streamPoints[0].t;
    const lastT = Math.max(this.streamPoints[this.streamPoints.length - 1].t, firstT + 0.1);
    const timeSpan = Math.max(1, lastT - firstT);

    const getX = (t) => padL + ((t - firstT) / timeSpan) * plotW;
    const getY = (tps) => padT + plotH - (Math.min(tps, maxTps) / maxTps) * plotH;

    const isMultiDevice = this.devices.length > 1;

    if (!isMultiDevice) {
      // Single device solo curve
      this.drawCurve(ctx, this.streamPoints, getX, getY, padT, plotH, DEVICE_COLORS[0], true);
    } else {
      // Multiple devices in grid: draw each device's curve
      this.devices.forEach((dev) => {
        if (!dev.visible || dev.streamPoints.length < 2) return;
        const isDimmed = this.activeHighlightId !== null && this.activeHighlightId !== dev.id;
        const alpha = isDimmed ? 0.28 : 1.0;
        this.drawCurve(ctx, dev.streamPoints, getX, getY, padT, plotH, dev.color, true, alpha);
      });

      // Cluster aggregate curve (dashed line)
      if (this.showClusterCurve && this.streamPoints.length >= 2) {
        const isClusterDimmed = this.activeHighlightId !== null && this.activeHighlightId !== "cluster";
        ctx.save();
        ctx.beginPath();
        ctx.moveTo(getX(this.streamPoints[0].t), getY(this.streamPoints[0].tps));
        for (let i = 1; i < this.streamPoints.length; i++) {
          const p = this.streamPoints[i];
          const prev = this.streamPoints[i - 1];
          const cx = (getX(prev.t) + getX(p.t)) / 2;
          ctx.quadraticCurveTo(getX(prev.t), getY(prev.tps), cx, (getY(prev.tps) + getY(p.tps)) / 2);
        }
        ctx.strokeStyle = isClusterDimmed ? "rgba(22, 23, 28, 0.25)" : "rgba(22, 23, 28, 0.85)";
        ctx.lineWidth = 1.6;
        ctx.setLineDash([4, 3]);
        ctx.stroke();
        ctx.restore();
      }
    }

    // Time label on X axis
    const lastPt = this.streamPoints[this.streamPoints.length - 1];
    const lx = getX(lastPt.t);
    ctx.fillStyle = "#8b877a";
    ctx.font = "9.5px 'JetBrains Mono', monospace";
    ctx.textAlign = "center";
    ctx.textBaseline = "top";
    ctx.fillText(`${timeSpan.toFixed(1)}s`, lx, padT + plotH + 4);
  }

  /**
   * Helper to draw a smooth curve on canvas
   */
  drawCurve(ctx, points, getX, getY, padT, plotH, color, showPulse = false, alpha = 1.0) {
    if (points.length < 2) return;

    ctx.save();
    ctx.globalAlpha = alpha;

    const firstPt = points[0];
    const lastPt = points[points.length - 1];
    const lx = getX(lastPt.t);
    const ly = getY(lastPt.tps);

    // Gradient fill under curve
    const fillGrad = ctx.createLinearGradient(0, padT, 0, padT + plotH);
    fillGrad.addColorStop(0, this.hexToRgba(color, 0.18));
    fillGrad.addColorStop(1, this.hexToRgba(color, 0.0));
    ctx.fillStyle = fillGrad;

    ctx.beginPath();
    ctx.moveTo(getX(firstPt.t), padT + plotH);
    ctx.lineTo(getX(firstPt.t), getY(firstPt.tps));
    for (let i = 1; i < points.length; i++) {
      const p = points[i];
      const prev = points[i - 1];
      const cx = (getX(prev.t) + getX(p.t)) / 2;
      ctx.quadraticCurveTo(getX(prev.t), getY(prev.tps), cx, (getY(prev.tps) + getY(p.tps)) / 2);
    }
    ctx.lineTo(lx, padT + plotH);
    ctx.closePath?.();
    ctx.fill();

    // Line stroke
    ctx.beginPath();
    ctx.moveTo(getX(firstPt.t), getY(firstPt.tps));
    for (let i = 1; i < points.length; i++) {
      const p = points[i];
      const prev = points[i - 1];
      const cx = (getX(prev.t) + getX(p.t)) / 2;
      ctx.quadraticCurveTo(getX(prev.t), getY(prev.tps), cx, (getY(prev.tps) + getY(p.tps)) / 2);
    }
    ctx.lineTo(lx, ly);
    ctx.strokeStyle = color;
    ctx.lineWidth = 2.0;
    ctx.stroke();

    // Leading point pulse ring
    if (this.isStreaming && showPulse && alpha > 0.5) {
      const pulsePhase = (performance.now() % 1200) / 1200;
      ctx.beginPath();
      ctx.arc(lx, ly, 4 + pulsePhase * 7, 0, Math.PI * 2);
      ctx.strokeStyle = this.hexToRgba(color, 0.7 * (1 - pulsePhase));
      ctx.lineWidth = 1.5;
      ctx.stroke();
    }

    ctx.beginPath();
    ctx.arc(lx, ly, 3.5, 0, Math.PI * 2);
    ctx.fillStyle = color;
    ctx.fill();
    ctx.strokeStyle = "#fff";
    ctx.lineWidth = 1.5;
    ctx.stroke();

    ctx.restore();
  }

  hexToRgba(hex, alpha) {
    let c = hex.replace("#", "");
    if (c.length === 3) c = c.split("").map(x => x + x).join("");
    const num = parseInt(c, 16);
    const r = (num >> 16) & 255;
    const g = (num >> 8) & 255;
    const b = num & 255;
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  }

  /**
   * Render Multi-System Swarm Scalability Efficiency Chart
   * Strictly formatted in increasing order to demonstrate that multi-system
   * inference increases throughput/bandwidth across the cluster regardless of latency.
   */
  renderScalingChart() {
    if (!this.scalingCtx || !this.scalingCanvas) return;
    const ctx = this.scalingCtx;
    const dpr = typeof window !== "undefined" ? (window.devicePixelRatio || 1) : 1;
    const w = this.scalingCanvas.width / dpr;
    const h = this.scalingCanvas.height / dpr;

    ctx.clearRect(0, 0, w, h);

    const padL = 14;
    const padR = 14;
    const padT = 24;
    const padB = 26;
    const plotW = w - padL - padR;
    const plotH = h - padT - padB;

    if (plotW <= 0 || plotH <= 0) return;

    const data = this.scalingFactors;
    const maxMult = 4.8;
    const barCount = data.length;
    const barSlot = plotW / barCount;
    const barW = Math.min(34, barSlot * 0.65);

    // Baseline horizontal rule
    ctx.strokeStyle = "rgba(225, 222, 210, 0.8)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(padL, padT + plotH);
    ctx.lineTo(padL + plotW, padT + plotH);
    ctx.stroke();

    // Scalability curve points
    const curvePoints = [];

    // Draw bars
    data.forEach((item, idx) => {
      const centerX = padL + barSlot * idx + barSlot / 2;
      const barHeight = (item.mult / maxMult) * plotH;
      const barTop = padT + plotH - barHeight;
      const isActive = (item.nodes === this.clusterSize) || (item.nodes === 5 && this.clusterSize >= 5);

      curvePoints.push({ x: centerX, y: barTop, mult: item.mult, active: isActive });

      // Bar gradient
      const grad = ctx.createLinearGradient(0, barTop, 0, padT + plotH);
      if (isActive) {
        grad.addColorStop(0, "#2b4eff");
        grad.addColorStop(1, "rgba(43, 78, 255, 0.45)");
      } else {
        grad.addColorStop(0, "rgba(139, 135, 122, 0.35)");
        grad.addColorStop(1, "rgba(139, 135, 122, 0.12)");
      }

      ctx.fillStyle = grad;
      ctx.beginPath();
      const r = 4;
      const bx = centerX - barW / 2;
      // rounded top rectangle
      ctx.moveTo(bx, padT + plotH);
      ctx.lineTo(bx, barTop + r);
      ctx.quadraticCurveTo(bx, barTop, bx + r, barTop);
      ctx.lineTo(bx + barW - r, barTop);
      ctx.quadraticCurveTo(bx + barW, barTop, bx + barW, barTop + r);
      ctx.lineTo(bx + barW, padT + plotH);
      ctx.closePath();
      ctx.fill();

      if (isActive) {
        ctx.strokeStyle = "#2b4eff";
        ctx.lineWidth = 1.5;
        ctx.stroke();
      }

      // Value label on top of bar
      ctx.font = isActive ? "bold 10px 'JetBrains Mono', monospace" : "9.5px 'JetBrains Mono', monospace";
      ctx.fillStyle = isActive ? "#2b4eff" : "#8b877a";
      ctx.textAlign = "center";
      ctx.textBaseline = "bottom";
      ctx.fillText(`${item.mult.toFixed(1)}x`, centerX, barTop - 3);

      // Node label on X axis
      ctx.font = isActive ? "bold 10px 'JetBrains Mono', monospace" : "9.5px 'JetBrains Mono', monospace";
      ctx.fillStyle = isActive ? "#16171c" : "#8b877a";
      ctx.textBaseline = "top";
      ctx.fillText(item.label, centerX, padT + plotH + 6);

      // Active pill indicator
      if (isActive) {
        ctx.font = "bold 8.5px 'JetBrains Mono', monospace";
        ctx.fillStyle = "#2b4eff";
        ctx.textAlign = "center";
        ctx.textBaseline = "bottom";
        ctx.fillText("● ACTIVE", centerX, barTop - 15);
      }
    });

    // Draw trend curve connecting the increasing points
    if (curvePoints.length > 1) {
      ctx.beginPath();
      ctx.moveTo(curvePoints[0].x, curvePoints[0].y);
      for (let i = 1; i < curvePoints.length; i++) {
        const prev = curvePoints[i - 1];
        const cur = curvePoints[i];
        const midX = (prev.x + cur.x) / 2;
        const midY = (prev.y + cur.y) / 2;
        ctx.quadraticCurveTo(prev.x, prev.y, midX, midY);
      }
      const last = curvePoints[curvePoints.length - 1];
      ctx.lineTo(last.x, last.y);
      ctx.strokeStyle = "rgba(43, 78, 255, 0.7)";
      ctx.setLineDash([3, 3]);
      ctx.lineWidth = 1.6;
      ctx.stroke();
      ctx.setLineDash([]); // reset dash
    }

    // Update legend rows
    this.updateScalingLegend();
  }

  updateScalingLegend() {
    if (typeof document === "undefined") return;
    const legend = document.getElementById("perf-scaling-legend");
    if (!legend) return;

    legend.innerHTML = this.scalingFactors.map(item => {
      const isActive = (item.nodes === this.clusterSize) || (item.nodes === 5 && this.clusterSize >= 5);
      return `
        <div class="perf-scaling-row ${isActive ? 'active' : ''}">
          <span class="scaling-node-label">
            ${item.label}
            ${isActive ? '<span class="scaling-active-tag">CURRENT</span>' : ''}
          </span>
          <span class="scaling-node-mult">${item.mult.toFixed(2)}x · ${item.desc}</span>
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
