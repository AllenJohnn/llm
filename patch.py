import sys
with open('room/perf-sidebar.js', 'r', encoding='utf8') as f:
    c = f.read()

find_html = """        return `
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
              </div>"""

rep_html = """        const workerText = d.workerRole === "Worker" ? "Distributed Worker" : (d.workerRole === "Host" ? "Host" : (d.stage || "Idle"));
        return `
          <div class="perf-dev-card ${this.isStreaming ? 'streaming' : ''}" id="dev-card-${escapeHtml(d.id)}">
            <div class="perf-dev-top">
              <div class="perf-dev-title-wrap">
                <span class="perf-dev-dot" style="background:${d.color};"></span>
                <span class="perf-dev-name" title="${escapeHtml(d.name)}">${escapeHtml(d.name)}</span>
                <span class="perf-dev-stage-badge">${escapeHtml(workerText)}</span>
              </div>
              <div class="perf-dev-rates">
                ${d.workerRole === "Worker"
                  ? `<span class="perf-dev-toks" id="dev-role-${escapeHtml(d.id)}">${escapeHtml(d.layers)}</span>`
                  : `<span class="perf-dev-tps" id="dev-tps-${escapeHtml(d.id)}">${d.tps.toFixed(1)} tok/s</span>
                     <span class="perf-dev-toks" id="dev-toks-${escapeHtml(d.id)}">${d.tokens} tok</span>`
                }
              </div>"""

if find_html in c:
    c = c.replace(find_html, rep_html)
elif find_html.replace('\n', '\r\n') in c:
    c = c.replace(find_html.replace('\n', '\r\n'), rep_html.replace('\n', '\r\n'))
else:
    print('Failed to find html to replace.')

with open('room/perf-sidebar.js', 'w', encoding='utf8') as f:
    f.write(c)
