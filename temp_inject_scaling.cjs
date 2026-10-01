const fs = require('fs');
let c = fs.readFileSync('room/perf-sidebar.js', 'utf8');

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
    this.scalingChartInstance.update();
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

// also record the peak in onToken
c = c.replace(/this\.peakTps = instantTps;/, `
      this.peakTps = instantTps;
      const bucket = this.clusterSize >= 5 ? 5 : this.clusterSize;
      const currentRecord = this.observedScaling.get(bucket) || 0;
      if (this.peakTps > currentRecord) {
        this.observedScaling.set(bucket, this.peakTps);
        this.renderScalingChart(); // update the chart and legend immediately
      }
`);

fs.writeFileSync('room/perf-sidebar.js', c);
console.log('done');
