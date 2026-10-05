
  async function initSwarm() {
    const s = document.getElementById('join-status');
    const notify = (msg, isErr = true) => {
      if (s) {
        s.style.color = isErr ? 'var(--err, #d1242f)' : 'var(--warn, #b58500)';
        s.innerHTML = msg;
      }
      console.warn('[WebSlice Loader]', msg);
    };

    const roomUrl = '/room.js?v=' + Date.now();

    // 1. Test fetching /room.js directly
    try {
      const resp = await fetch(roomUrl);
      if (!resp.ok) {
        notify(`<b>HTTP ${resp.status}:</b> Could not fetch <code>${roomUrl}</code>.<br>Make sure <code>npx serve</code> is running in the project directory.`);
        return;
      }
      const ct = resp.headers.get('content-type') || '';
      if (!ct.includes('javascript')) {
        notify(`<b>Unexpected MIME type:</b> Server returned <code>${ct}</code> for <code>room.js</code> (expected JavaScript).`);
        return;
      }
    } catch (e) {
      notify(`<b>Network error:</b> Cannot fetch <code>room.js</code> (${e.message}).<br>Check if an ad-blocker or browser shield is blocking local scripts.`);
      return;
    }

    // 2. Test fetching all imported submodules
    const subs = [
      ['/engine/wgsl/base.js', 'engine/wgsl/base.js'],
      ['/engine/wgsl/gemm.js', 'engine/wgsl/gemm.js'],
      ['/engine/wgsl/coop.js', 'engine/wgsl/coop.js'],
      ['/engine/wgsl/qwen35.js', 'engine/wgsl/qwen35.js'],
      ['/engine/quantize.js', 'engine/quantize.js'],
      ['/engine/sampling.js', 'engine/sampling.js'],
      ['/engine/tokenizer.js', 'engine/tokenizer.js'],
      ['/engine/autotune.js', 'engine/autotune.js'],
      ['/engine/safetensors.js', 'engine/safetensors.js'],
      ['/engine/gguf.js', 'engine/gguf.js'],
      ['/engine/dense.js', 'engine/dense.js'],
      ['/engine/selftest.js', 'engine/selftest.js'],
      ['/engine/engine.js', 'engine/engine.js'],
      ['/engine/qwen35.js', 'engine/qwen35.js'],
      ['/room/wire.js', 'room/wire.js'],
      ['/vendor/marked.esm.js', 'vendor/marked.esm.js'],
      ['/room/markdown.js', 'room/markdown.js'],
      ['/room/sampling.js', 'room/sampling.js'],
      ['/room/visibility.js', 'room/visibility.js'],
      ['/room/models.js', 'room/models.js'],
      ['/room/transport.js', 'room/transport.js'],
      ['/room/groq.js', 'room/groq.js'],
      ['/room/groq-client.js', 'room/groq-client.js'],
      ['/room/perf-sidebar.js', 'room/perf-sidebar.js']
    ];

    // 2. Test fetching all imported submodules in parallel
    try {
      await Promise.all(subs.map(async ([url, name]) => {
        const subResp = await fetch(url);
        if (!subResp.ok) {
          throw new Error(`Missing file: ${name} returned HTTP ${subResp.status}`);
        }
      }));
    } catch (e) {
      notify(`<b>Network error:</b> ${e.message}`);
      return;
    }

    // 3. Test importing submodules individually to isolate syntax/eval issues
    try {
      await Promise.all(subs.map(([url, name]) => import(url).catch(e => {
        throw new Error(`Submodule error in ${name}: ${e.message || e}`);
      })));
    } catch (e) {
      notify(`<b>${e.message}</b>`);
      return;
    }

    // 4. Finally import room.js
    try {
      await import(roomUrl);
      if (s && (s.textContent.includes('Loading') || s.textContent.includes('HTTP'))) {
        s.textContent = '';
      }
      console.log('WebSlice room module loaded and initialized successfully');
    } catch (e) {
      notify(`<b>Error in room.js:</b> ${e.message || e}`);
    }
  }

  initSwarm();
