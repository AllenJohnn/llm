const fs = require('fs');
let c = fs.readFileSync('room/perf-sidebar.js', 'utf8');

c = c.replace(
  /const timeEl = document\.getElementById\('perf-stat-time'\);\s*if \(timeEl\) timeEl\.innerText = '0\.0s';/g,
  `const timeEl = document.getElementById('perf-stat-time');
        if (timeEl) timeEl.innerText = '0.0s';
        const heroTps = document.getElementById('perf-hero-tps');
        if (heroTps) heroTps.innerText = '0.0';`
);

c = c.replace(
  /const topRate = document\.getElementById\('topbar-perf-rate'\);\s*if \(topRate\) topRate\.innerText = instantTps\.toFixed\(1\) \+ ' tok\/s';/g,
  `const topRate = document.getElementById('topbar-perf-rate');
        if (topRate) topRate.innerText = instantTps.toFixed(1) + ' tok/s';
        const heroTps = document.getElementById('perf-hero-tps');
        if (heroTps) heroTps.innerText = instantTps.toFixed(1);`
);

fs.writeFileSync('room/perf-sidebar.js', c);
console.log('Replaced successfully.');
