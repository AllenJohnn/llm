const fs = require('fs');

function cleanFile(file) {
  if (!fs.existsSync(file)) return;
  let text = fs.readFileSync(file, 'utf8');
  text = text.replace(/swarm<em>LLM<\/em>/gi, 'WebSLICE');
  text = text.replace(/swarm<span>LLM<\/span>/gi, 'WebSLICE');
  text = text.replace(/swarm<b style="color:var\(--accent\)">LLM<\/b>/gi, 'WebSLICE');
  text = text.replace(/swarmLLM/gi, 'WebSLICE');
  text = text.replace(/start a swarm/gi, 'start a WebSLICE');
  text = text.replace(/start a <span>swarm<\/span>/gi, 'start a <span>WebSLICE</span>');
  text = text.replace(/swarm room/gi, 'WebSLICE room');
  text = text.replace(/SWARM MODEL/gi, 'WEBSLICE MODEL');
  text = text.replace(/Ask the swarm/gi, 'Ask the room');
  text = text.replace(/Offline \/ Single-System Demo/gi, 'Local \/ Single-System Network');
  text = text.replace(/Local PeerServer \(:9000\)/gi, 'Local Tracker (:9000)');
  text = text.replace(/swarmStart/gi, 'sliceStart');
  text = text.replace(/initSwarm/gi, 'initSlice');
  fs.writeFileSync(file, text, 'utf8');
}

cleanFile('room/index.html');
console.log('room/index.html cleaned');
