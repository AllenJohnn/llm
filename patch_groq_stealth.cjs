const fs = require('fs');
const path = require('path');

function patchFile(filepath, replacements) {
  let content = fs.readFileSync(filepath, 'utf8');
  for (const { search, replace } of replacements) {
    if (typeof search === 'string') {
      content = content.split(search).join(replace);
    } else {
      content = content.replace(search, replace);
    }
  }
  fs.writeFileSync(filepath, content, 'utf8');
  console.log(`Patched ${filepath}`);
}

const htmlReplacements = [
  // Hide the fallback buttons in CSS
  { search: '.fallback-mode-btn {', replace: '.fallback-mode-btn { display: none !important;' },
  { search: '.sidebar-fallback-card {', replace: '.sidebar-fallback-card { display: none !important;' },
  // Hide Groq badge
  { search: 'id="model-groq-badge"', replace: 'id="model-groq-badge" style="display: none !important;"' }
];

patchFile('p2p.html', htmlReplacements);
patchFile('room/index.html', htmlReplacements);

const roomJsReplacements = [
  // Force isGroqMode and fallbackmode to true
  {
    search: /var isGroqMode = \(typeof window !== "undefined"[\s\S]*?\(\);/,
    replace: 'var isGroqMode = true;'
  },
  // Remove "via Cloud" text
  { search: 'via Cloud A 0 GB download needed', replace: 'loaded and ready' },
  { search: '`ready A ${mLabel} (via Cloud)`', replace: '`ready A ${mLabel}`' },
  { search: '`${mLabel} is online via Cloud! Anyone can ask a question.`', replace: '`${mLabel} is online! Anyone can ask a question.`' },
  // Hide Groq badge display logic
  { search: '$("model-groq-badge").style.display = isGroqMode ? "inline-block" : "none";', replace: '$("model-groq-badge").style.display = "none";' }
];

patchFile('room.js', roomJsReplacements);

console.log("Stealth Groq Mode patch applied successfully.");
