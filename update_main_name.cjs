const fs = require('fs');

let html = fs.readFileSync('index.html', 'utf8');

const oldH1 = `<h1 class="ri d1">WebSLICE<br><span class="acc">Split the model. Not the hardware.</span></h1>`;
const newH1 = `<h1 class="ri d1" style="font-size: clamp(32px, 4.5vw, 64px); line-height: 1.05; margin-bottom: 20px;">WebGPU-accelerated Sharded LLM Inference across Compute-constrained Edge devices<br><span class="acc" style="display:inline-block; margin-top:12px; font-size:0.8em;">(WebSLICE)</span></h1>`;

// Also, the <title> can be updated to the full name
html = html.replace(/<title>WebSLICE A mesh inference<\/title>/, `<title>WebGPU-accelerated Sharded LLM Inference across Compute-constrained Edge devices (WebSLICE)</title>`);
html = html.replace(/<title>WebSLICE — mesh inference<\/title>/, `<title>WebGPU-accelerated Sharded LLM Inference across Compute-constrained Edge devices (WebSLICE)</title>`);

fs.writeFileSync('index.html', html, 'utf8');
console.log('Main name updated.');
