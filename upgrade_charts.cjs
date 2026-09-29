const fs = require('fs');

let content = fs.readFileSync('room/perf-sidebar.js', 'utf8');

// Replace renderLiveChart
const newRenderLiveChart = `
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
`;

content = content.replace(/renderLiveChart\(\) \{[\s\S]*?(?=renderScalingChart\(\) \{)/, newRenderLiveChart);

// Replace renderScalingChart
const newRenderScalingChart = `
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

    const data = this.scalingFactors;
    const labels = data.map(d => d.label);
    const mults = data.map(d => d.mult);
    
    const bgColors = data.map(d => {
      const isActive = (d.nodes === this.clusterSize) || (d.nodes === 5 && this.clusterSize >= 5);
      return isActive ? 'rgba(43, 78, 255, 0.6)' : 'rgba(139, 135, 122, 0.2)';
    });

    const borderColors = data.map(d => {
      const isActive = (d.nodes === this.clusterSize) || (d.nodes === 5 && this.clusterSize >= 5);
      return isActive ? '#2b4eff' : 'transparent';
    });

    this.scalingChartInstance.data.labels = labels;
    this.scalingChartInstance.data.datasets = [
      {
        type: 'line',
        label: 'Trend',
        data: mults,
        borderColor: 'rgba(43, 78, 255, 0.7)',
        borderDash: [3, 3],
        borderWidth: 2,
        tension: 0.4,
        fill: false,
        pointRadius: 0
      },
      {
        type: 'bar',
        label: 'Multiplier',
        data: mults,
        backgroundColor: bgColors,
        borderColor: borderColors,
        borderWidth: 1.5,
        borderRadius: 4
      }
    ];
    this.scalingChartInstance.update();
    this.updateScalingLegend();
  }
`;

content = content.replace(/renderScalingChart\(\) \{[\s\S]*?(?=updateScalingLegend\(\) \{)/, newRenderScalingChart);

fs.writeFileSync('room/perf-sidebar.js', content, 'utf8');
console.log('Patched perf-sidebar.js for Chart.js');
