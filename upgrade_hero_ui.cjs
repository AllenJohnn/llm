const fs = require('fs');

let html = fs.readFileSync('index.html', 'utf8');

// 1. Inject GSAP and Tailwind Config if not present
if (!html.includes('gsap.min.js')) {
  html = html.replace('</head>', `
  <script src="https://cdnjs.cloudflare.com/ajax/libs/gsap/3.12.2/gsap.min.js"></script>
  <script>
    tailwind.config = {
      theme: {
        extend: {
          animation: {
            blob: "blob 7s infinite",
          },
          keyframes: {
            blob: {
              "0%": { transform: "translate(0px, 0px) scale(1)" },
              "33%": { transform: "translate(30px, -50px) scale(1.1)" },
              "66%": { transform: "translate(-20px, 20px) scale(0.9)" },
              "100%": { transform: "translate(0px, 0px) scale(1)" },
            }
          }
        }
      }
    }
  </script>
  <style>
    .animation-delay-2000 { animation-delay: 2s; }
    .animation-delay-4000 { animation-delay: 4s; }
  </style>
</head>`);
}

// 2. Replace the old #hero block
const oldHeroRegex = /<div id="hero">[\s\S]*?<main>/;
const newHero = `
<div id="hero-modern" class="relative overflow-hidden bg-[#0d0f14] text-white min-h-[100svh] flex flex-col justify-center items-center pointer-events-auto">
  <!-- Animated Background Blobs -->
  <div class="absolute top-1/4 left-1/4 w-72 h-72 lg:w-96 lg:h-96 bg-indigo-600 rounded-full mix-blend-screen filter blur-[100px] opacity-40 animate-blob"></div>
  <div class="absolute top-1/3 right-1/4 w-72 h-72 lg:w-96 lg:h-96 bg-purple-600 rounded-full mix-blend-screen filter blur-[100px] opacity-40 animate-blob animation-delay-2000"></div>
  <div class="absolute bottom-1/4 left-1/3 w-72 h-72 lg:w-96 lg:h-96 bg-pink-600 rounded-full mix-blend-screen filter blur-[100px] opacity-40 animate-blob animation-delay-4000"></div>

  <!-- Hero Content -->
  <div class="relative z-10 max-w-6xl mx-auto px-6 text-center flex flex-col items-center">
    
    <div class="gsap-reveal inline-block px-5 py-2 rounded-full border border-gray-700 bg-gray-800/40 backdrop-blur-md text-xs sm:text-sm font-bold tracking-[0.2em] text-gray-300 uppercase mb-8 shadow-lg">
      Mesh Inference Engine
    </div>
    
    <h1 class="gsap-reveal text-transparent bg-clip-text bg-gradient-to-r from-blue-400 via-indigo-300 to-purple-400 font-extrabold tracking-tight leading-[1.1] mb-2" style="font-size: clamp(2rem, 5vw, 4rem);">
      WebGPU-accelerated Sharded LLM Inference
    </h1>
    <h2 class="gsap-reveal text-white font-extrabold tracking-tight leading-[1.1] mb-8" style="font-size: clamp(1.8rem, 4.5vw, 3.5rem);">
      across Compute-constrained Edge devices
    </h2>
    
    <div class="gsap-reveal mb-8 text-5xl sm:text-7xl font-black text-white drop-shadow-[0_0_25px_rgba(255,255,255,0.4)] tracking-tight">
      (WebSLICE)
    </div>

    <p class="gsap-reveal text-lg sm:text-xl text-gray-400 max-w-3xl mx-auto leading-relaxed mb-12">
      A large language model, sharded across your devices' browser tabs &mdash; no install, no server, no single GPU big enough required.
    </p>

    <a class="gsap-reveal inline-flex items-center gap-3 px-8 py-4 rounded-full bg-white text-gray-950 font-bold text-lg sm:text-xl transition-all hover:scale-105 hover:shadow-[0_0_40px_rgba(255,255,255,0.4)] pointer-events-auto" href="/room">
      Start a WebSLICE
      <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M14 5l7 7m0 0l-7 7m7-7H3"></path></svg>
    </a>
  </div>
</div>
<main>
`;

html = html.replace(oldHeroRegex, newHero);

// 3. Inject GSAP initialization script at the bottom
if (!html.includes('gsap.from')) {
  html = html.replace('</body>', `
  <script>
    if (typeof gsap !== 'undefined') {
      gsap.from(".gsap-reveal", {
        y: 40,
        opacity: 0,
        duration: 1,
        stagger: 0.15,
        ease: "power3.out",
        delay: 0.2
      });
    }
  </script>
</body>`);
}

fs.writeFileSync('index.html', html, 'utf8');
console.log('index.html hero redesigned.');
