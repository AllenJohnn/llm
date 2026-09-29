const fs = require('fs');

// 1. Update index.html hero
let indexHtml = fs.readFileSync('index.html', 'utf8');

const heroModernRegex = /<div id="hero-modern"[\s\S]*?<\/div>\s*<main>/;
const newCreamHero = `
<div id="hero-modern" class="relative overflow-hidden bg-[#f5f4ee] text-[#16171c] min-h-[100svh] flex flex-col justify-center items-center pointer-events-auto">
  <!-- Pastel Animated Background Blobs -->
  <div class="absolute top-1/4 left-1/4 w-72 h-72 lg:w-96 lg:h-96 bg-blue-300/50 rounded-full mix-blend-multiply filter blur-[100px] opacity-60 animate-blob"></div>
  <div class="absolute top-1/3 right-1/4 w-72 h-72 lg:w-96 lg:h-96 bg-purple-300/50 rounded-full mix-blend-multiply filter blur-[100px] opacity-60 animate-blob animation-delay-2000"></div>
  <div class="absolute bottom-1/4 left-1/3 w-72 h-72 lg:w-96 lg:h-96 bg-pink-300/50 rounded-full mix-blend-multiply filter blur-[100px] opacity-60 animate-blob animation-delay-4000"></div>

  <!-- Hero Content -->
  <div class="relative z-10 max-w-6xl mx-auto px-6 text-center flex flex-col items-center">
    
    <div class="gsap-reveal inline-block px-5 py-2 rounded-full border border-[#e1ded2] bg-[#fbfaf5]/60 backdrop-blur-md text-xs sm:text-sm font-bold tracking-[0.2em] text-[#8b877a] uppercase mb-8 shadow-sm">
      Mesh Inference Engine
    </div>
    
    <h1 class="gsap-reveal text-[#16171c] font-extrabold tracking-tight leading-[1.05] mb-2" style="font-size: clamp(2rem, 5vw, 4rem);">
      WebGPU-accelerated Sharded LLM Inference
    </h1>
    <h2 class="gsap-reveal text-[#2b4eff] font-extrabold tracking-tight leading-[1.05] mb-8" style="font-size: clamp(1.8rem, 4.5vw, 3.5rem);">
      across Compute-constrained Edge devices
    </h2>
    
    <div class="gsap-reveal mb-8 text-5xl sm:text-7xl font-black text-[#16171c] drop-shadow-sm tracking-tight">
      (WebSLICE)
    </div>

    <p class="gsap-reveal text-lg sm:text-xl text-[#8b877a] max-w-3xl mx-auto leading-relaxed mb-12">
      A large language model, sharded across your devices' browser tabs &mdash; no install, no server, no single GPU big enough required.
    </p>

    <a class="gsap-reveal inline-flex items-center gap-3 px-8 py-4 rounded-full bg-[#2b4eff] text-white font-bold text-lg sm:text-xl transition-all hover:scale-105 hover:bg-[#1a3ecc] hover:shadow-[0_10px_34px_rgba(43,78,255,0.35)] pointer-events-auto" href="/room">
      Start a WebSLICE
      <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M14 5l7 7m0 0l-7 7m7-7H3"></path></svg>
    </a>
  </div>
</div>
<main>
`;

if (heroModernRegex.test(indexHtml)) {
  indexHtml = indexHtml.replace(heroModernRegex, newCreamHero);
  fs.writeFileSync('index.html', indexHtml, 'utf8');
  console.log('Restored cream colorscheme to index.html hero.');
} else {
  console.log('Regex failed on index.html');
}

// 2. Update p2p.html join screen
let p2pHtml = fs.readFileSync('p2p.html', 'utf8');

const joinScreenRegex = /<div id="join-screen"[\s\S]*?<\/div>\s*<\/div>/;
const newJoinScreen = `
<div id="join-screen" class="flex-1 flex flex-col items-center justify-center p-6 relative overflow-hidden bg-[#f5f4ee] text-[#16171c]">
  <!-- Decorative Background Glow -->
  <div class="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-[#2b4eff]/10 rounded-full blur-[100px] pointer-events-none"></div>

  <div class="relative z-10 flex flex-col items-center w-full max-w-md bg-[#fbfaf5]/80 backdrop-blur-xl border border-[#e1ded2] p-10 rounded-3xl shadow-[0_14px_44px_rgba(20,21,26,0.07)]">
    
    <div class="kicker text-[10px] tracking-[0.25em] text-[#2b4eff] font-bold mb-4 uppercase">Mesh Inference</div>
    
    <h1 class="text-4xl font-extrabold tracking-tight mb-3 text-[#16171c]">Start a <span class="text-[#2b4eff]">WebSLICE</span></h1>
    <p class="text-sm text-[#8b877a] text-center mb-8 max-w-[280px]">One room code. Every device that types it becomes part of one machine.</p>
    
    <div class="w-full flex flex-col gap-4 mb-8">
      <input id="name-input" class="w-full bg-white border border-[#e1ded2] focus:border-[#2b4eff] focus:ring-1 focus:ring-[#2b4eff] rounded-xl px-5 py-3.5 text-center text-[#16171c] placeholder-[#c4c0b1] outline-none transition-all shadow-sm" placeholder="Device name (e.g. Mac, Phone)" maxlength="20">
      
      <input id="code-input" class="w-full bg-white border border-[#e1ded2] focus:border-[#2b4eff] focus:ring-1 focus:ring-[#2b4eff] rounded-xl px-5 py-3.5 text-center text-[#16171c] placeholder-[#c4c0b1] font-mono tracking-[0.3em] uppercase outline-none transition-all shadow-sm" placeholder="ROOM CODE" maxlength="6">
    </div>

    <div class="join-row flex gap-3 w-full mb-6">
      <button id="create-btn" class="flex-1 bg-[#2b4eff] hover:bg-[#1a3ecc] text-white font-semibold py-3.5 rounded-xl shadow-[0_10px_20px_rgba(43,78,255,0.2)] transition-transform hover:scale-[1.02] active:scale-95" type="button" onclick="window.sliceStart && window.sliceStart(true)">Create Room</button>
      
      <button id="join-btn" class="flex-1 bg-white hover:bg-[#fbfaf5] border border-[#e1ded2] text-[#16171c] font-semibold py-3.5 rounded-xl transition-transform hover:scale-[1.02] active:scale-95 shadow-sm" type="button" onclick="window.sliceStart && window.sliceStart(false)">Join Room</button>
    </div>

    <div id="join-pledge" class="flex items-center justify-center gap-3 text-xs text-[#8b877a] font-mono bg-white py-2 px-4 rounded-full border border-[#e1ded2] shadow-sm">
      <span>Give</span>
      <button class="step w-7 h-7 rounded-full bg-[#f5f4ee] hover:bg-[#e1ded2] border border-[#e1ded2] flex items-center justify-center text-[#16171c] transition-colors" id="gb-minus" type="button" onclick="window.stepGB && window.stepGB(-1)">-</button>
      <input id="join-gb" type="number" min="1" max="64" step="1" value="1" inputmode="numeric" class="w-12 bg-transparent text-center text-[#16171c] text-sm outline-none font-bold">
      <button class="step w-7 h-7 rounded-full bg-[#f5f4ee] hover:bg-[#e1ded2] border border-[#e1ded2] flex items-center justify-center text-[#16171c] transition-colors" id="gb-plus" type="button" onclick="window.stepGB && window.stepGB(1)">+</button>
      <span>GB of memory</span>
    </div>

    <div id="join-hint" class="mt-6 text-[11px] text-[#8b877a] font-mono">
      Local / Single-System Network: <a href="?signal=localhost:9000" class="text-[#2b4eff] hover:underline">Local Tracker (:9000)</a>
    </div>
    
    <div id="join-status" class="mt-4 font-mono text-xs text-[#2b4eff] text-center min-h-[18px]"></div>
  </div>
</div>
`;

if (joinScreenRegex.test(p2pHtml)) {
  p2pHtml = p2pHtml.replace(joinScreenRegex, newJoinScreen);
} else {
  console.log('Regex failed on p2p.html');
}

// Add the models back to the dropdown in p2p.html
const oldOptions = `<option value="qwq-32b">Qwen QwQ 32B A Q4 (Deep Reasoning)</option>\n          <option value="qwen3.8-27b">Qwen 3.8 27B A Q4</option>`;
const oldOptionsRegex = /<option value="qwq-32b">.*?<\/option>\s*<option value="qwen3\.8-27b">.*?<\/option>/;
if (oldOptionsRegex.test(p2pHtml)) {
  p2pHtml = p2pHtml.replace(oldOptionsRegex, `<option value="qwq-32b">Qwen QwQ 32B &middot; Q4 (Deep Reasoning)</option>
          <option value="phi-4-mini">Phi-4 mini &middot; Q4 (coding & reasoning)</option>
          <option value="qwen3.8-27b">Qwen 3.8 27B &middot; Q4</option>
          <option value="smollm-135m">SmolLM 135M &middot; bf16 (Fast Test &middot; 270 MB)</option>`);
}
fs.writeFileSync('p2p.html', p2pHtml, 'utf8');
console.log('Restored cream colorscheme and models to p2p.html');

// 3. Update room/models.js to include phi-4-mini and smollm-135m
let modelsJs = fs.readFileSync('room/models.js', 'utf8');

// Insert into MODELS
const modelsInsertRegex = /"qwq-32b": \{[^}]+\},\s*"qwen3\.8-27b": \{/;
if (modelsInsertRegex.test(modelsJs)) {
  modelsJs = modelsJs.replace(modelsInsertRegex, `"qwq-32b": { label: "Qwen QwQ 32B · Q4 (Deep Reasoning)", kind: "gguf", thinking: true,
    gguf: "https://huggingface.co/bartowski/Qwen_QwQ-32B-GGUF/resolve/main/Qwen_QwQ-32B-Q4_0.gguf",
    ggufFallback: "https://hf-mirror.com/bartowski/Qwen_QwQ-32B-GGUF/resolve/main/Qwen_QwQ-32B-Q4_0.gguf",
    cfg: "https://huggingface.co/Qwen/QwQ-32B/resolve/main/config.json",
    tok: "https://huggingface.co/Qwen/QwQ-32B/resolve/main/tokenizer.json" },
  "phi-4-mini": { label: "Phi-4 mini · Q4", kind: "gguf", arch: "phi3", thinking: false,
    gguf: "https://huggingface.co/bartowski/microsoft_Phi-4-mini-instruct-GGUF/resolve/main/microsoft_Phi-4-mini-instruct-Q4_0.gguf",
    ggufFallback: "https://hf-mirror.com/bartowski/microsoft_Phi-4-mini-instruct-GGUF/resolve/main/microsoft_Phi-4-mini-instruct-Q4_0.gguf",
    cfg: "https://huggingface.co/microsoft/Phi-4-mini-instruct/resolve/main/config.json" },
  "qwen3.8-27b": {`);
}

// Insert into LOCAL_CANDIDATES
const localCandidatesRegex = /"qwq-32b": \[[^\]]+\],\s*"qwen3\.8-27b": \[[^\]]+\]/g;
if (localCandidatesRegex.test(modelsJs)) {
  modelsJs = modelsJs.replace(localCandidatesRegex, `"qwq-32b": ["/models/qwq-32b.gguf", "/models/Qwen_QwQ-32B-Q4_0.gguf", "/models/qwq32b/model.gguf"],
  "phi-4-mini": ["/models/microsoft_Phi-4-mini-instruct-Q4_0.gguf", "/models/Phi-4-mini-instruct-Q4_0.gguf", "/models/phi-4-mini-instruct-Q4_0.gguf", "/models/phi-4-mini.gguf"],
  "qwen3.8-27b": ["/models/qwen3.8-27b.gguf", "/models/Qwen3.8-27B-Q4_0.gguf", "/models/q38/model.gguf"],
  "smollm-135m": ["/models/smollm-135m.safetensors", "/models/model.safetensors", "/models/model/model.safetensors"]`);
}

// SmolLM config was missing from MODELS replacement. Let's add it explicitly before the end of MODELS map.
const smollmReplaceRegex = /"qwen3\.8-27b": \{[^}]+\}\s*};/;
if (smollmReplaceRegex.test(modelsJs)) {
  modelsJs = modelsJs.replace(smollmReplaceRegex, `"qwen3.8-27b": { label: "Qwen 3.8 27B · Q4", kind: "qwen35", thinking: true,
    gguf: "https://huggingface.co/unsloth/Qwen3.8-27B-GGUF/resolve/main/Qwen3.8-27B-Q4_0.gguf",
    ggufFallback: "https://hf-mirror.com/unsloth/Qwen3.8-27B-GGUF/resolve/main/Qwen3.8-27B-Q4_0.gguf" },
  "smollm-135m": { label: "SmolLM 135M · bf16", kind: "safetensors", thinking: false,
    st: "https://huggingface.co/HuggingFaceTB/SmolLM2-135M-Instruct/resolve/main/model.safetensors",
    stFallback: "https://hf-mirror.com/HuggingFaceTB/SmolLM2-135M-Instruct/resolve/main/model.safetensors",
    cfg: "https://huggingface.co/HuggingFaceTB/SmolLM2-135M-Instruct/resolve/main/config.json",
    tok: "https://huggingface.co/HuggingFaceTB/SmolLM2-135M-Instruct/resolve/main/tokenizer.json" }
};`);
}

fs.writeFileSync('room/models.js', modelsJs, 'utf8');
console.log('Restored phi-4 and smollm models in room/models.js');
