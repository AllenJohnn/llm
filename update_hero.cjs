const fs = require('fs');

let html = fs.readFileSync('index.html', 'utf8');

// Replace the h1 and paragraph
const oldH1 = `<h1 class="ri d1">Your phone <span class="dim">can't run</span><br>Qwen 3.8<br><span class="acc">Your room can.</span></h1>`;
const newH1 = `<h1 class="ri d1">WebSLICE<br><span class="acc">Split the model. Not the hardware.</span></h1>`;

const oldP = `<p class="sub ri d2">Phones, laptops, friends' PCs: <b>one room code</b> away from becoming a single machine. Each holds a slice of the model; together they run the whole thing. Nothing to install.</p>`;
const newP = `<p class="sub ri d2">— large language model, sharded across your devices' browser tabs — no install, no server, no single GPU big enough required.</p>`;

html = html.replace(oldH1, newH1);
html = html.replace(oldP, newP);

// Let's also update the meta description
html = html.replace(
  /<meta name="description" content="Pool your phone, laptop, and friends' devices into one room, and run AI models none of them could hold alone.">/g, 
  `<meta name="description" content="— large language model, sharded across your devices' browser tabs — no install, no server, no single GPU big enough required.">`
);

fs.writeFileSync('index.html', html, 'utf8');
console.log('Hero text updated.');
