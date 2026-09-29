const fs = require('fs');
let html = fs.readFileSync('index.html', 'utf8');

const navIndex = html.indexOf('<nav id="nav">');
const heroIndex = html.indexOf('<div id="hero-modern">');
const mainIndex = html.indexOf('<main>');

console.log('Nav index:', navIndex);
console.log('Hero index:', heroIndex);
console.log('Main index:', mainIndex);
