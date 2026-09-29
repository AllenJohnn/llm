const fs = require('fs');
const p2p = fs.readFileSync('p2p.html', 'utf8');
const scriptMatch = p2p.match(/<script type="module">([\s\S]*?)<\/script>/);
if (scriptMatch) {
  fs.writeFileSync('p2p_script.js', scriptMatch[1]);
  console.log('Script extracted to p2p_script.js');
} else {
  console.log('Script not found');
}
