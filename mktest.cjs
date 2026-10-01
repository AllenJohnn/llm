const fs = require('fs');
let c = fs.readFileSync('scripts/server.mjs', 'utf8');
c = c.replace(/import groqHandler from \"\.\.\/api\/groq\.js\";/g, 'const groqHandler = async () => {};');
c = c.replace(/import configHandler from \"\.\.\/api\/config\.js\";/g, 'const configHandler = async () => {};');
fs.writeFileSync('scripts/server_test.mjs', c);
