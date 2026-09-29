const fs = require('fs');

function cleanModelsJs() {
  let content = fs.readFileSync('room/models.js', 'utf8');
  let lines = content.split('\n');
  
  const toRemove = ['phi-4-mini', 'gemma-4-e4b', 'smollm-135m'];
  
  // Remove from NEED_GB and GROQ_MODEL_MAP and LOCAL_CANDIDATES
  lines = lines.filter(line => {
    for (const key of toRemove) {
      if (line.trim().startsWith(`"${key}":`)) {
        if (!line.includes('{')) {
          return false;
        }
      }
    }
    return true;
  });

  // Remove from MODELS
  let newLines = [];
  let inRemoveBlock = false;
  for (let line of lines) {
    let startingRemove = false;
    for (const key of toRemove) {
      if (line.trim().startsWith(`"${key}": {`)) {
        startingRemove = true;
        inRemoveBlock = true;
        break;
      }
    }
    
    if (startingRemove) continue;
    
    if (inRemoveBlock) {
      if (line.trim().endsWith('},')) {
        inRemoveBlock = false;
      }
      continue;
    }
    
    newLines.push(line);
  }

  fs.writeFileSync('room/models.js', newLines.join('\n'), 'utf8');
}

function cleanP2pHtml() {
  let content = fs.readFileSync('p2p.html', 'utf8');
  let lines = content.split('\n');
  const toRemove = ['phi-4-mini', 'gemma-4-e4b', 'smollm-135m'];
  lines = lines.filter(line => {
    if (line.includes('<option value=')) {
      for (const key of toRemove) {
        if (line.includes(`"${key}"`)) return false;
      }
    }
    return true;
  });
  fs.writeFileSync('p2p.html', lines.join('\n'), 'utf8');
}

function cleanDownloadScript() {
  let content = fs.readFileSync('scripts/download_model.mjs', 'utf8');
  let lines = content.split('\n');
  const toRemove = ['phi-4-mini', 'gemma-4-e4b', 'smollm-135m'];
  lines = lines.filter(line => {
    for (const key of toRemove) {
      if (line.trim().startsWith(`"${key}":`)) return false;
    }
    return true;
  });
  fs.writeFileSync('scripts/download_model.mjs', lines.join('\n'), 'utf8');
}

cleanModelsJs();
cleanP2pHtml();
cleanDownloadScript();
console.log('Cleanup complete');
