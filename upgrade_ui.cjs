const fs = require('fs');

function renameSwarmLLM(filepath) {
  let content = fs.readFileSync(filepath, 'utf8');
  
  // Replace titles and mentions
  content = content.replace(/SwarmLLM/g, 'WebSLICE');
  content = content.replace(/swarmllm/g, 'webslice');
  content = content.replace(/A group of devices,\s*<br>running one AI together\./g, 'WebGPU-accelerated Sharded LLM Inference<br>across Compute-constrained Edge devices.');
  content = content.replace(/WHAT IS SWARMLLM/g, 'WHAT IS WEBSLICE');

  // Inject Tailwind if not present
  if (!content.includes('tailwindcss')) {
    content = content.replace('</head>', '  <script src="https://cdn.tailwindcss.com"></script>\n</head>');
  }

  // Inject animate.css for "chat slides" (sliding animations)
  if (!content.includes('animate.css')) {
    content = content.replace('</head>', '  <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/animate.css/4.1.1/animate.min.css"/>\n</head>');
  }
  
  // Inject Chart.js for graphjs upgrade
  if (!content.includes('chart.js')) {
    content = content.replace('</head>', '  <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>\n</head>');
  }

  fs.writeFileSync(filepath, content, 'utf8');
  console.log(`Updated ${filepath}`);
}

renameSwarmLLM('index.html');
renameSwarmLLM('p2p.html');
renameSwarmLLM('room/index.html');

console.log("Renaming and library injection complete.");
