const fs = require('fs');

let content = fs.readFileSync('room/perf-sidebar.js', 'utf8');

// Replace resizeCanvases implementation to let Chart.js handle it
const newResize = `
  resizeCanvases() {
    if (this.liveChartInstance) this.liveChartInstance.resize();
    if (this.scalingChartInstance) this.scalingChartInstance.resize();
  }
`;
content = content.replace(/resizeCanvases\(\) \{[\s\S]*?(?=\n  updateDeviceListUI)/, newResize);

fs.writeFileSync('room/perf-sidebar.js', content, 'utf8');
console.log('Patched resizeCanvases in perf-sidebar.js');
