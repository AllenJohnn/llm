const fs = require('fs');

let html = fs.readFileSync('p2p.html', 'utf8');

const oldJoinScreenRegex = /<div id="join-screen">[\s\S]*?<\/div>\s*<\/div>/;

// The #join-screen ends at `<div id="join-status"></div>\n  </div>`
const regex = /<div id="join-screen">[\s\S]*?<div id="join-status"><\/div>\s*<\/div>/;

const newJoinScreen = `
<div id="join-screen" class="flex-1 flex flex-col items-center justify-center p-6 relative overflow-hidden bg-[#0d0f14] text-white">
  <!-- Decorative Background Glow -->
  <div class="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-indigo-600/20 rounded-full blur-[120px] pointer-events-none"></div>

  <div class="relative z-10 flex flex-col items-center w-full max-w-md bg-white/5 backdrop-blur-xl border border-white/10 p-10 rounded-3xl shadow-[0_0_40px_rgba(0,0,0,0.5)]">
    
    <div class="kicker text-[10px] tracking-[0.25em] text-indigo-400 font-bold mb-4 uppercase">Mesh Inference</div>
    
    <h1 class="text-4xl font-extrabold tracking-tight mb-3 text-white">Start a <span class="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-purple-500">WebSLICE</span></h1>
    <p class="text-sm text-gray-400 text-center mb-8 max-w-[280px]">One room code. Every device that types it becomes part of one machine.</p>
    
    <div class="w-full flex flex-col gap-4 mb-8">
      <input id="name-input" class="w-full bg-black/40 border border-gray-700 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 rounded-xl px-5 py-3.5 text-center text-white placeholder-gray-500 outline-none transition-all" placeholder="Device name (e.g. Mac, Phone)" maxlength="20">
      
      <input id="code-input" class="w-full bg-black/40 border border-gray-700 focus:border-purple-500 focus:ring-1 focus:ring-purple-500 rounded-xl px-5 py-3.5 text-center text-white placeholder-gray-500 font-mono tracking-[0.3em] uppercase outline-none transition-all" placeholder="ROOM CODE" maxlength="6">
    </div>

    <div class="join-row flex gap-3 w-full mb-6">
      <button id="create-btn" class="flex-1 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-semibold py-3.5 rounded-xl shadow-lg transition-transform hover:scale-[1.02] active:scale-95" type="button" onclick="window.sliceStart && window.sliceStart(true)">Create Room</button>
      
      <button id="join-btn" class="flex-1 bg-white/10 hover:bg-white/20 border border-white/10 text-white font-semibold py-3.5 rounded-xl transition-transform hover:scale-[1.02] active:scale-95" type="button" onclick="window.sliceStart && window.sliceStart(false)">Join Room</button>
    </div>

    <div id="join-pledge" class="flex items-center justify-center gap-3 text-xs text-gray-400 font-mono bg-black/30 py-2 px-4 rounded-full border border-gray-800">
      <span>Give</span>
      <button class="step w-7 h-7 rounded-full bg-gray-800 hover:bg-gray-700 flex items-center justify-center text-white transition-colors" id="gb-minus" type="button" onclick="window.stepGB && window.stepGB(-1)">-</button>
      <input id="join-gb" type="number" min="1" max="64" step="1" value="1" inputmode="numeric" class="w-12 bg-transparent text-center text-white text-sm outline-none font-bold">
      <button class="step w-7 h-7 rounded-full bg-gray-800 hover:bg-gray-700 flex items-center justify-center text-white transition-colors" id="gb-plus" type="button" onclick="window.stepGB && window.stepGB(1)">+</button>
      <span>GB of memory</span>
    </div>

    <div id="join-hint" class="mt-6 text-[11px] text-gray-500 font-mono">
      Local / Single-System Network: <a href="?signal=localhost:9000" class="text-indigo-400 hover:text-indigo-300 underline">Local Tracker (:9000)</a>
    </div>
    
    <div id="join-status" class="mt-4 font-mono text-xs text-pink-400 text-center min-h-[18px]"></div>
  </div>
</div>
`;

html = html.replace(regex, newJoinScreen);

// Inject GSAP into p2p.html as well for consistent animations
if (!html.includes('gsap.min.js')) {
  html = html.replace('</head>', `
  <script src="https://cdnjs.cloudflare.com/ajax/libs/gsap/3.12.2/gsap.min.js"></script>
</head>`);
}

// Add animation code at the bottom of p2p.html
if (!html.includes('gsap.from("#join-screen"')) {
  html = html.replace('</body>', `
  <script>
    if (typeof gsap !== 'undefined') {
      gsap.from("#join-screen .relative.z-10", {
        y: 30,
        opacity: 0,
        duration: 0.8,
        ease: "power3.out"
      });
    }
  </script>
</body>`);
}

fs.writeFileSync('p2p.html', html, 'utf8');
console.log('p2p.html join screen upgraded.');
