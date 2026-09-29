const fs = require('fs');
let content = fs.readFileSync('room/models.js', 'utf8');

content = content.replace(/gguf: "https:\/\/hf-mirror\.com/g, 'gguf: "https://huggingface.co');
content = content.replace(/ggufFallback: "https:\/\/huggingface\.co/g, 'ggufFallback: "https://hf-mirror.com');
content = content.replace(/cfg: "https:\/\/hf-mirror\.com/g, 'cfg: "https://huggingface.co');
content = content.replace(/tok: "https:\/\/hf-mirror\.com/g, 'tok: "https://huggingface.co');
content = content.replace(/st: "https:\/\/hf-mirror\.com/g, 'st: "https://huggingface.co');
content = content.replace(/stFallback: "https:\/\/huggingface\.co/g, 'stFallback: "https://hf-mirror.com');

fs.writeFileSync('room/models.js', content, 'utf8');
console.log('Mirrors swapped successfully!');
