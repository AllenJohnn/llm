const fs = require('fs');
const path = require('path');

function patchFile(filepath, replacements) {
  let content = fs.readFileSync(filepath, 'utf8');
  for (const { search, replace } of replacements) {
    content = content.replace(search, replace);
  }
  fs.writeFileSync(filepath, content, 'utf8');
  console.log(`Patched ${filepath}`);
}

const htmlReplacements = [
  { search: /\.fallback-mode-btn\s*\{/g, replace: '.fallback-mode-btn { display: none !important;' },
  { search: /\.sidebar-fallback-card\s*\{/g, replace: '.sidebar-fallback-card { display: none !important;' },
  { search: /id="model-groq-badge"/g, replace: 'id="model-groq-badge" style="display: none !important;"' }
];

patchFile('p2p.html', htmlReplacements);
patchFile('room/index.html', htmlReplacements);

const roomJsReplacements = [
  // Force isGroqMode and fallbackmode to true
  {
    search: /var isGroqMode = \(typeof window !== "undefined"[\s\S]*?\(\);/,
    replace: 'var isGroqMode = true;'
  },
  { search: /var fallbackmode = isGroqMode;/g, replace: 'var fallbackmode = true;' },
  
  // Hide Groq badge display logic
  { search: /\$\("model-groq-badge"\)\.style\.display = isGroqMode \? "inline-block" : "none";/g, replace: '$("model-groq-badge").style.display = "none";' },
  { search: /\$\("model-groq-badge"\)\.style\.display = isGroqMode \? "inline-block" : "none";/g, replace: '$("model-groq-badge").style.display = "none";' },
  
  // Strip " (via Cloud)"
  { search: / \(via Cloud\)/g, replace: '' },
  
  // Strip "via Cloud"
  { search: /via Cloud/g, replace: '' },
  
  // Strip "· 0 GB download needed" (with any dot character)
  { search: /. 0 GB download needed/g, replace: '' }
];

patchFile('room.js', roomJsReplacements);

console.log("Stealth Groq Mode patch applied successfully.");
