const fs = require('fs');
let c = fs.readFileSync('room/perf-sidebar.js', 'utf8').split('\n');
for (let i = 0; i < c.slength; i++) {
  if (c[i].includes('this.currentModel = opts.model')) {
    c.splice(i + 1, 0, '      this.backend = opts.backend || \"local\";');
    break;
  }
}
for (let i = 0; i < c.length; i++) {
  if (c[i].includes('const ttftEl = document.getElementById(\"perf-stat-ttft\")')) {
    const inject = `        const curMod = document.getElementById('perf-cur-model');
        if (curMod) {
          const badgeText = this.backend === 'groq' ? 'GROQ API' : 'LOCAL WEBGPU';
          curMod.innerHTML = \`<span class="backend-badge ${this.backend}">${badgeText}</span> ${this.currentModel}\`;
        }`;
    c.splice(i, 0, inject);
    break;
  }
}
fs.writeFileSync('room/perf-sidebar.js', c.join('\n'));
console.log('Done');