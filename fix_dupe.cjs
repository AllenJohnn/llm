const fs = require('fs');
let content = fs.readFileSync('room/models.js', 'utf8');
const lines = content.split('\n');
const seen = new Set();
const newLines = lines.filter(line => {
  if (line.includes('"gemma-4-e4b": [')) {
    if (seen.has('gemma-local')) return false;
    seen.add('gemma-local');
  }
  return true;
});
fs.writeFileSync('room/models.js', newLines.join('\n'), 'utf8');
