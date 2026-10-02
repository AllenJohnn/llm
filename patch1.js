const fs = require('fs');
let c = fs.readFileSync('room/perf-sidebar.js', 'utf8');

c = c.replace(
  'updateDeviceListUI() {\r\n    if (typeof document === \"undefined\") return;\r\n\r\n    // 1. Legend Chips above Canvas',
  \updateDeviceListUI() {\r
    if (typeof document === \"undefined\") return;\r
\r
    // 0. Update Hero Sub and Grid Badge\r
    const activeNodes = this.devices.filter(d => d.workerRole && d.workerRole !== \"Idle\").length;\r
    const isDistributed = activeNodes > 1;\r
    const heroSubEl = document.getElementById(\"perf-hero-sub\");\r
    if (heroSubEl) {\r
      heroSubEl.textContent = isDistributed ? \"Distributed Execution\" : \"Solo Device Execution\";\r
    }\r
    const gridShareBadgeEl = document.getElementById(\"perf-grid-share-badge\");\r
    if (gridShareBadgeEl) {\r
      const displayCount = activeNodes > 0 ? activeNodes : this.devices.length;\r
      gridShareBadgeEl.textContent = displayCount === 1 ? \"1 NODE\" : \\\\ NODES\\\;\r
    }\r
\r
    // 1. Legend Chips above Canvas\
);

c = c.replace(
  'updateDeviceListUI() {\n    if (typeof document === \"undefined\") return;\n\n    // 1. Legend Chips above Canvas',
  \updateDeviceListUI() {\n    if (typeof document === \"undefined\") return;\n\n    // 0. Update Hero Sub and Grid Badge\n    const activeNodes = this.devices.filter(d => d.workerRole && d.workerRole !== \"Idle\").length;\n    const isDistributed = activeNodes > 1;\n    const heroSubEl = document.getElementById(\"perf-hero-sub\");\n    if (heroSubEl) {\n      heroSubEl.textContent = isDistributed ? \"Distributed Execution\" : \"Solo Device Execution\";\n    }\n    const gridShareBadgeEl = document.getElementById(\"perf-grid-share-badge\");\n    if (gridShareBadgeEl) {\n      const displayCount = activeNodes > 0 ? activeNodes : this.devices.length;\n      gridShareBadgeEl.textContent = displayCount === 1 ? \"1 NODE\" : \\\\ NODES\\\;\n    }\n\n    // 1. Legend Chips above Canvas\
);


c = c.replace(
  '<span>GRID TOKENS PROCESSED</span>',
  '<span>GRID PARTICIPATION</span>'
);

fs.writeFileSync('room/perf-sidebar.js', c);
