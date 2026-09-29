const fs = require('fs');
let code = fs.readFileSync('room.js', 'utf8');
code = code.replaceAll('$("ai-row").style.display = "none";', '// $("ai-row").style.display = "none";');
code = code.replaceAll('if ($("ai-row")) $("ai-row").style.display = "none";', '// if ($("ai-row")) $("ai-row").style.display = "none";');
code = code.replace('$("ai-row").style.display = ai.readyPeers.size >= ai.chain.length ? "flex" : "none";', '$("ai-row").style.display = "flex";');
fs.writeFileSync('room.js', code);
