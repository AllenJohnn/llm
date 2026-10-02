import sys
with open('room/perf-sidebar.js', 'r', encoding='utf8') as f:
    c = f.read()

find_str = """      const selfDev = this.devices.find(d => d.id === 'self');
      if (selfDev) {
        selfDev.tps = instantTps;
        selfDev.tokens = this.tokenCount;
        if (!selfDev.streamPoints) selfDev.streamPoints = [];
        selfDev.streamPoints.push({ t: elapsedSec, tps: instantTps, total: this.tokenCount });
      }"""

rep_str = """      const targetDev = this.devices.find(d => d.workerRole === 'Host') || this.devices.find(d => d.id === 'self');
      if (targetDev) {
        targetDev.tps = instantTps;
        targetDev.tokens = this.tokenCount;
        if (!targetDev.streamPoints) targetDev.streamPoints = [];
        targetDev.streamPoints.push({ t: elapsedSec, tps: instantTps, total: this.tokenCount });
      }"""

if find_str in c:
    c = c.replace(find_str, rep_str)
elif find_str.replace('\n', '\r\n') in c:
    c = c.replace(find_str.replace('\n', '\r\n'), rep_str.replace('\n', '\r\n'))
else:
    print('Failed to find JS to replace.')

with open('room/perf-sidebar.js', 'w', encoding='utf8') as f:
    f.write(c)
