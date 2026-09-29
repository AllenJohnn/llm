const fs = require('fs');
let html = fs.readFileSync('p2p.html', 'utf8');
html = html.replace(/<\/div>\s*<\/div>\s*<div id="room-screen">/, '</div>\n</div>\n</div>\n\n<div id="room-screen">');
fs.writeFileSync('p2p.html', html, 'utf8');
console.log('Fixed div to perfectly balanced');
