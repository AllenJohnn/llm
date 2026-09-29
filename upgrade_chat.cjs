const fs = require('fs');

let content = fs.readFileSync('room.js', 'utf8');

const newChatUser = `function chatUser(name, text) {
  const o = aiOut();
  const m = document.createElement("div");
  // Added animate.css classes for chat slides and tailwind for layout
  m.className = "m user animate__animated animate__fadeInUp animate__faster flex flex-col items-end my-4";
  const initials = getInitials(name);
  const time = formatTime();
  m.innerHTML = \`
    <div class="msg-header flex items-center gap-2 mb-1 text-sm text-gray-500">
      <span class="who font-semibold">\${esc(name)}</span>
      <span class="msg-time text-xs">\${time}</span>
    </div>
    <div class="msg-body flex gap-3 flex-row-reverse max-w-[85%]">
      <div class="user-avatar flex-shrink-0 w-8 h-8 bg-blue-500 text-white rounded-full flex items-center justify-center font-bold shadow-md" title="\${esc(name)}">\${esc(initials)}</div>
      <div class="bubble bg-blue-600 text-white p-3 rounded-2xl rounded-tr-none shadow-md">\${esc(text)}</div>
    </div>\`;
  o.appendChild(m);
  o.scrollTop = o.scrollHeight;
}`;

content = content.replace(/function chatUser\(name, text\) \{[\s\S]*?o\.scrollTop = o\.scrollHeight;\n\}/, newChatUser);

const newChatBotStart = `function chatBotStart() {
  const o = aiOut();
  const m = document.createElement("div");
  // Added animate.css classes for chat slides and tailwind for layout
  m.className = "m bot streaming animate__animated animate__fadeInUp animate__faster flex flex-col items-start my-4";
  const modelLabel = MODELS[ai.model]?.label.split("\\u00b7")[0].trim() || "Mesh";
  const time = formatTime();
  m.innerHTML = \`
    <div class="msg-header flex items-center gap-2 mb-1 text-sm text-gray-500">
      <span class="who font-semibold">WebSLICE</span>
      <span class="model-badge bg-gray-200 text-gray-700 px-2 py-0.5 rounded text-xs">\${esc(modelLabel)}</span>
      <span class="msg-time text-xs">\${time}</span>
    </div>
    <div class="msg-body flex gap-3 max-w-[85%]">
      <div class="bot-avatar flex-shrink-0 w-8 h-8 bg-purple-600 text-white rounded-full flex items-center justify-center shadow-md" title="WebSLICE Mesh">
        <svg class="bot-mesh-icon w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
          <polygon points="12 2 2 7 12 12 22 7 12 2"></polygon>
          <polyline points="2 17 12 22 22 17"></polyline>
          <polyline points="2 12 12 17 22 12"></polyline>
        </svg>
      </div>
      <div class="bubble bg-white text-gray-800 p-3 rounded-2xl rounded-tl-none shadow-md border border-gray-100">
        <div class="bubble-content prose prose-sm max-w-none"><span class="cursor"></span></div>
      </div>
    </div>\`;
  o.appendChild(m);
  o.scrollTop = o.scrollHeight;
  botEl = m;
}`;

content = content.replace(/function chatBotStart\(\) \{[\s\S]*?botEl = m;\n\}/, newChatBotStart);

// Also replace mascot swarmLLM to WebSLICE in chatBotStart if not caught by previous global replace
content = content.replace(/swarmLLM/g, 'WebSLICE');

fs.writeFileSync('room.js', content, 'utf8');
console.log('Patched room.js with new chat styles.');
