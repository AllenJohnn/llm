const fs = require('fs');
const glob = require('fs').readdirSync;

function renameInFile(file) {
  if (!fs.existsSync(file)) return;
  let t = fs.readFileSync(file, 'utf8');
  let original = t;

  // Caches, IDs, console logs
  t = t.replace(/swarmllm-room-/g, 'webslice-room-');
  t = t.replace(/swarmllm-weights-v1/g, 'webslice-weights-v1');
  t = t.replace(/swarm-crumb/g, 'webslice-crumb');
  t = t.replace(/swarm_think_mode/g, 'webslice_think_mode');
  t = t.replace(/swarm_fallbackmode/g, 'webslice_fallbackmode');
  t = t.replace(/x-swarm-len/g, 'x-webslice-len');
  t = t.replace(/\[SwarmLLM\]/g, '[WebSLICE]');
  t = t.replace(/SwarmLLM/g, 'WebSLICE');
  t = t.replace(/swarmLLM/g, 'WebSLICE');
  
  // UI texts
  t = t.replace(/Swarm WebGPU mode/g, 'WebSLICE WebGPU mode');
  t = t.replace(/local WebGPU swarm/g, 'local WebGPU cluster');
  t = t.replace(/the swarm is still answering/g, 'the room is still answering');
  t = t.replace(/Swarmy/g, 'Slicey');
  t = t.replace(/swarmDebug/g, 'sliceDebug');
  t = t.replace(/log\("swarm",/g, 'log("room",');
  t = t.replace(/weights\.swarmllm\.ai/g, 'weights.webslice.ai');

  // Some leftovers
  t = t.replace(/Ask the swarm/g, 'Ask the room');

  if (t !== original) {
    fs.writeFileSync(file, t, 'utf8');
    console.log(`Cleaned ${file}`);
  }
}

['room.js', 'p2p.html', 'index.html', 'room/index.html', 'room/perf-sidebar.js', 'room/groq-client.js'].forEach(renameInFile);
