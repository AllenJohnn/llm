const fs = require('fs');
let content = fs.readFileSync('scripts/download_model.mjs', 'utf8');
content = content.replace(/smollm-135m, /g, '');
content = content.replace(/smollm-135m \& qwen3-0.6b/g, 'qwen3-0.6b');
content = content.replace(/SmolLM2-135M \& Qwen3-0.6B/g, 'Qwen3-0.6B');
content = content.replace(/\s*await downloadModel\("smollm-135m"\);/g, '');
fs.writeFileSync('scripts/download_model.mjs', content, 'utf8');
console.log('Cleaned download script');
