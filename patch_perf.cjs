const fs = require('fs');
let c = fs.readFileSync('room/perf-sidebar.js', 'utf8');

const newMethods = `
  onGenStart(opts) {
    try {
      this.isStreaming = true;
      this.currentModel = opts.model || '';
      this.genStartTime = performance.now();
      this.firstTokenTime = null;
      this.tokenCount = 0;
      this.peakTps = 0;
      this.streamPoints = [];
      this.recentTokenTimes = [];
      
      if (typeof document !== 'undefined') {
        const topBtn = document.getElementById('topbar-perf-btn');
        if (topBtn) topBtn.classList.add('streaming');
        const ttftEl = document.getElementById('perf-stat-ttft');
        if (ttftEl) ttftEl.innerText = '— ms';
        const tokEl = document.getElementById('perf-stat-tokens');
        if (tokEl) tokEl.innerText = '0 tok';
        const timeEl = document.getElementById('perf-stat-time');
        if (timeEl) timeEl.innerText = '0.0s';
        const peakEl = document.getElementById('perf-stat-peak');
        if (peakEl) peakEl.innerText = '0.0 tok/s';
      }
    } catch (e) {
      console.warn("perfSidebar.onGenStart failed:", e);
    }
  }

  onToken(text, totalCount) {
    try {
      if (!this.isStreaming) return;
      const now = performance.now();
      
      if (this.firstTokenTime === null) {
        this.firstTokenTime = now;
        const ttft = now - this.genStartTime;
        if (typeof document !== 'undefined') {
          const ttftEl = document.getElementById('perf-stat-ttft');
          if (ttftEl) ttftEl.innerText = Math.round(ttft) + ' ms';
        }
      }
      
      this.tokenCount = totalCount || (this.tokenCount + 1);
      this.recentTokenTimes.push(now);
      
      while (this.recentTokenTimes.length > 0 && now - this.recentTokenTimes[0] > 1000) {
        this.recentTokenTimes.shift();
      }
      
      const elapsedSec = (now - this.genStartTime) / 1000;
      
      let instantTps = 0;
      if (this.recentTokenTimes.length > 1) {
        const windowStart = this.recentTokenTimes[0];
        const windowEnd = this.recentTokenTimes[this.recentTokenTimes.length - 1];
        const windowSpanSec = (windowEnd - windowStart) / 1000;
        if (windowSpanSec > 0.05) {
          instantTps = this.recentTokenTimes.length / windowSpanSec;
        } else {
          instantTps = this.recentTokenTimes.length;
        }
      }
      
      if (instantTps > this.peakTps) {
        this.peakTps = instantTps;
        if (typeof document !== 'undefined') {
          const peakEl = document.getElementById('perf-stat-peak');
          if (peakEl) peakEl.innerText = this.peakTps.toFixed(1) + ' tok/s';
        }
        
        // Update observed scaling
        const bucket = this.clusterSize >= 5 ? 5 : this.clusterSize;
        const currentRecord = this.observedScaling.get(bucket) || 0;
        if (this.peakTps > currentRecord) {
          this.observedScaling.set(bucket, this.peakTps);
          this.renderScalingChart();
        }
      }
      
      this.streamPoints.push({ t: elapsedSec, tps: instantTps, total: this.tokenCount });
      
      if (typeof document !== 'undefined') {
        const topRate = document.getElementById('topbar-perf-rate');
        if (topRate) topRate.innerText = instantTps.toFixed(1) + ' tok/s';
        
        const tokEl = document.getElementById('perf-stat-tokens');
        if (tokEl) tokEl.innerText = this.tokenCount + ' tok';
        
        const timeEl = document.getElementById('perf-stat-time');
        if (timeEl) timeEl.innerText = elapsedSec.toFixed(1) + 's';
      }
      
      this.updateDeviceReadouts(instantTps);
      this.renderLiveChart();
    } catch (e) {
      console.warn("perfSidebar.onToken failed:", e);
    }
  }

  onGenDone(opts) {
    try {
      this.isStreaming = false;
      if (typeof document !== 'undefined') {
        const topBtn = document.getElementById('topbar-perf-btn');
        if (topBtn) topBtn.classList.remove('streaming');
        
        if (opts && opts.totalTokens !== undefined) {
          this.tokenCount = opts.totalTokens;
          const tokEl = document.getElementById('perf-stat-tokens');
          if (tokEl) tokEl.innerText = this.tokenCount + ' tok';
        }
        if (opts && opts.totalSecs !== undefined) {
          const timeEl = document.getElementById('perf-stat-time');
          if (timeEl) timeEl.innerText = opts.totalSecs.toFixed(1) + 's';
        }
      }
      this.sessionTokens += this.tokenCount;
      this.promptCount++;
      if (opts && opts.totalSecs) {
        this.totalGenerationTime += opts.totalSecs;
      }
      this.renderLiveChart();
    } catch (e) {
      console.warn("perfSidebar.onGenDone failed:", e);
    }
  }
`;

// Insert the methods right before the closing brace of the class.
// The class ends right before `function escapeHtml(str)`
c = c.replace(/\n\}\n\nfunction escapeHtml\(str\)/, '\n' + newMethods + '\n}\n\nfunction escapeHtml(str)');


// Now fix the hardcoded scaling factors.
c = c.replace(/this\.scalingFactors = \[[\s\S]*?\];/, 'this.observedScaling = new Map(); // clusterSize -> peakTps');

c = c.replace(/const data = this\.scalingFactors;[\s\S]*?this\.updateScalingLegend\(\);/, `
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
`);

c = c.replace(/legend\.innerHTML = this\.scalingFactors\.map\([\s\S]*?\}\)\.join\(""\);/, `
    legend.innerHTML = [1, 2, 3, 4, 5].map(n => {
      const isActive = (n === this.clusterSize) || (n === 5 && this.clusterSize >= 5);
      const label = n === 5 ? "5+ devices" : n + " device" + (n > 1 ? "s" : "");
      const speed = this.observedScaling.get(n);
      const speedText = speed ? speed.toFixed(1) + " tok/s" : "— waiting for benchmark";
      return \`
        <div class="perf-scaling-row \${isActive ? 'active' : ''}">
          <span class="scaling-node-label">
            \${label}
            \${isActive ? '<span class="scaling-active-tag">CURRENT</span>' : ''}
          </span>
          <span class="scaling-node-mult">\${speedText}</span>
        </div>
      \`;
    }).join("");
`);

fs.writeFileSync('room/perf-sidebar.js', c);
console.log('done');
