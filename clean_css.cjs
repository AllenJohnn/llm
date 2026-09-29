const fs = require('fs');
let html = fs.readFileSync('p2p.html', 'utf8');

// Strip out old CSS that conflicts with Tailwind for the chat bubbles
html = html.replace(/\.m \.bubble \{[\s\S]*?\}/g, '');
html = html.replace(/\.m\.user \.bubble \{[\s\S]*?\}/g, '');
html = html.replace(/\.m\.bot \.bubble \{[\s\S]*?\}/g, '');

fs.writeFileSync('p2p.html', html, 'utf8');
console.log('Cleaned up old bubble CSS in p2p.html');
