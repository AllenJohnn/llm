const fs = require('fs');

function updateModels() {
  let content = fs.readFileSync('room/models.js', 'utf8');

  const gemmaModelString = `  "gemma-4-e4b": { label: "Gemma 4 E4B · Q4", kind: "gguf", arch: "gemma2", thinking: false,
    gguf: "https://hf-mirror.com/unsloth/gemma-4-e4b-GGUF/resolve/main/gemma-4-e4b-Q4_0.gguf",
    ggufFallback: "https://huggingface.co/unsloth/gemma-4-e4b-GGUF/resolve/main/gemma-4-e4b-Q4_0.gguf",
    cfg: "https://hf-mirror.com/google/gemma-4-e4b-it/resolve/main/config.json" },`;

  // Use a generic replacement for the MODELS object
  content = content.replace(/("phi-4-mini":\s*\{[^}]+\},)/s, '$1\n' + gemmaModelString);

  const candidateString = `  "gemma-4-e4b": ["/models/gemma-4-e4b.gguf", "/models/gemma-4-e4b-Q4_0.gguf", "/models/gemma4/model.gguf"],`;
  content = content.replace(/("phi-4-mini":\s*\[[^\]]+\],)/, '$1\n' + candidateString);

  fs.writeFileSync('room/models.js', content, 'utf8');
  console.log('Modified room/models.js');
}

function updateDownloadScript() {
  let content = fs.readFileSync('scripts/download_model.mjs', 'utf8');
  
  const gemmaString = `  "gemma-4-e4b": { dir: "gemma4", file: "model.gguf", rootFile: "gemma-4-e4b.gguf" },`;
  content = content.replace(/("phi-4-mini":\s*\{[^}]+\},)/s, '$1\n' + gemmaString);

  fs.writeFileSync('scripts/download_model.mjs', content, 'utf8');
  console.log('Modified scripts/download_model.mjs');
}

function updateHtml() {
  let content = fs.readFileSync('p2p.html', 'utf8');
  
  const gemmaOption = `          <option value="gemma-4-e4b">Gemma 4 E4B · Q4</option>`;
  content = content.replace(/(<option value="phi-4-mini">[^<]+<\/option>)/, '$1\n' + gemmaOption);

  fs.writeFileSync('p2p.html', content, 'utf8');
  console.log('Modified p2p.html');
}

updateModels();
updateDownloadScript();
updateHtml();
