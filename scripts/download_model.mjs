// SwarmLLM Model Downloader
// Downloads and sets up model weights, config, and tokenizer for offline & local demonstration.
// Usage:
//   node scripts/download_model.mjs list
//   node scripts/download_model.mjs <model-id>  (e.g. smollm-135m, qwen3-0.6b, qwen2.5-coder-7b)
//   node scripts/download_model.mjs demo        (downloads smollm-135m & qwen3-0.6b for instant local demo)
//   node scripts/download_model.mjs all

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { MODELS, LOCAL_CANDIDATES } from "../room/models.js";

try {
  if (typeof process !== "undefined" && typeof process.loadEnvFile === "function") {
    process.loadEnvFile();
  }
} catch {}

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const MODELS_DIR = path.join(ROOT, "models");

// Catalog directory mapping for primary engine layout (docs/models.md)
const TARGET_MAP = {
  "smollm-135m": { dir: "model", file: "model.safetensors", rootFile: "smollm-135m.safetensors" },
  "qwen3-0.6b": { dir: "qwen", file: "model.gguf", rootFile: "qwen3-0.6b.gguf" },
  "qwen3-1.7b": { dir: "qwen17", file: "model.gguf", rootFile: "qwen3-1.7b.gguf" },
  "qwen3-4b": { dir: "qwen4", file: "model.gguf", rootFile: "qwen3-4b.gguf" },
  "qwen2.5-coder-1.5b": { dir: "qwen25coder15", file: "model.gguf", rootFile: "qwen2.5-coder-1.5b-instruct-q4_0.gguf" },
  "qwen2.5-coder-7b": { dir: "qwen25coder", file: "model.gguf", rootFile: "qwen2.5-coder-7b.gguf" },
  "deepseek-r1-distill-qwen-14b": { dir: "r1-14b", file: "model.gguf", rootFile: "deepseek-r1-distill-qwen-14b.gguf" },
  "qwq-32b": { dir: "qwq32b", file: "model.gguf", rootFile: "qwq-32b.gguf" },
  "phi-4-mini": { dir: "phi4", file: "model.gguf", rootFile: "phi-4-mini.gguf" },
  "qwen3.8-27b": { dir: "q38", file: "model.gguf", rootFile: "qwen3.8-27b.gguf" },
};

function formatBytes(bytes) {
  if (!bytes || bytes <= 0) return "0 B";
  const units = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return `${(bytes / 1024 ** i).toFixed(1)} ${units[i]}`;
}

function checkModelStatus(id) {
  const mapping = TARGET_MAP[id];
  if (!mapping) return { downloaded: false, size: 0, path: null };
  const targetPath = path.join(MODELS_DIR, mapping.dir, mapping.file);
  const rootPath = path.join(MODELS_DIR, mapping.rootFile);

  if (fs.existsSync(targetPath)) {
    const size = fs.statSync(targetPath).size;
    if (size > 10 * 1024 * 1024) return { downloaded: true, size, path: targetPath };
  }
  if (fs.existsSync(rootPath)) {
    const size = fs.statSync(rootPath).size;
    if (size > 10 * 1024 * 1024) return { downloaded: true, size, path: rootPath };
  }
  return { downloaded: false, size: 0, path: null };
}

function listModels() {
  console.log("\n=======================================================");
  console.log("       SwarmLLM Model Catalog & Local Status          ");
  console.log("=======================================================\n");

  const isFallbackMode = process.env.FALLBACKMODE === "true" || process.env.FALLBACKMODE === "1";
  for (const [id, m] of Object.entries(MODELS)) {
    const status = checkModelStatus(id);
    let badge = status.downloaded ? `[\x1b[32mDOWNLOADED\x1b[0m] (${formatBytes(status.size)})` : "[\x1b[33mNOT DOWNLOADED\x1b[0m]";
    if (id === "qwen3.8-27b" && isFallbackMode) {
      badge = `[\x1b[35mGROQ CLOUD API DIRECT\x1b[0m] (no download required)`;
    }
    console.log(` • \x1b[1m${id.padEnd(28)}\x1b[0m ${badge}`);
    console.log(`   Label: ${m.label} | Kind: ${m.kind}`);
    console.log(`   URL:   ${m.gguf || m.st}`);
    console.log("");
  }

  console.log("Commands to download:");
  console.log("  node scripts/download_model.mjs demo       # Downloads SmolLM2-135M & Qwen3-0.6B (fastest)");
  console.log("  node scripts/download_model.mjs <model-id> # Downloads specific model");
  console.log("  node scripts/download_model.mjs all        # Downloads all models\n");
}

async function downloadFileWithProgress(url, fallbackUrl, destPath) {
  fs.mkdirSync(path.dirname(destPath), { recursive: true });

  const tempPath = destPath + ".tmp";
  let existingBytes = 0;
  if (fs.existsSync(tempPath)) {
    existingBytes = fs.statSync(tempPath).size;
  }

  let chosenUrl = url;
  let response = null;

  async function tryFetch(targetUrl) {
    const headers = {};
    if (existingBytes > 0) {
      headers["Range"] = `bytes=${existingBytes}-`;
    }
    return fetch(targetUrl, { headers });
  }

  try {
    response = await tryFetch(chosenUrl);
    if (!response.ok && fallbackUrl && response.status !== 416) {
      console.log(`\nMirror returned HTTP ${response.status}. Falling back to official URL: ${fallbackUrl}`);
      chosenUrl = fallbackUrl;
      response = await tryFetch(chosenUrl);
    }
  } catch (err) {
    if (fallbackUrl) {
      console.log(`\nConnection error on ${chosenUrl}: ${err.message}. Trying fallback: ${fallbackUrl}`);
      chosenUrl = fallbackUrl;
      response = await tryFetch(chosenUrl);
    } else {
      throw err;
    }
  }

  if (!response.ok && response.status !== 416) {
    throw new Error(`Failed to download ${chosenUrl}: HTTP ${response.status} ${response.statusText}`);
  }

  if (response.status === 416) {
    // Range not satisfiable, file already fully downloaded in tempPath
    fs.renameSync(tempPath, destPath);
    console.log(`File already downloaded: ${destPath}`);
    return;
  }

  const isPartial = response.status === 206;
  const contentLength = parseInt(response.headers.get("content-length") || "0", 10);
  const totalBytes = isPartial ? existingBytes + contentLength : contentLength;

  const fileStream = fs.createWriteStream(tempPath, { flags: isPartial ? "a" : "w" });
  const reader = response.body.getReader();

  let receivedBytes = isPartial ? existingBytes : 0;
  let startTime = Date.now();
  let lastLogged = 0;

  process.stdout.write(`Downloading ${path.basename(destPath)}...\n`);

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    fileStream.write(Buffer.from(value));
    receivedBytes += value.length;

    const now = Date.now();
    if (now - lastLogged > 200 || receivedBytes === totalBytes) {
      lastLogged = now;
      const elapsedSec = (now - startTime) / 1000 || 0.001;
      const speed = (receivedBytes - (isPartial ? existingBytes : 0)) / elapsedSec; // B/s
      const pct = totalBytes > 0 ? ((receivedBytes / totalBytes) * 100).toFixed(1) : "?";
      const etaSec = totalBytes > receivedBytes && speed > 0 ? Math.round((totalBytes - receivedBytes) / speed) : 0;

      const barLen = 25;
      const filled = totalBytes > 0 ? Math.round((barLen * receivedBytes) / totalBytes) : 0;
      const bar = "█".repeat(filled) + "░".repeat(Math.max(0, barLen - filled));

      process.stdout.write(`\r[${bar}] ${pct}% | ${formatBytes(receivedBytes)}/${formatBytes(totalBytes)} | ${formatBytes(speed)}/s | ETA: ${etaSec}s    `);
    }
  }

  fileStream.end();
  await new Promise((resolve) => fileStream.on("finish", resolve));
  fs.renameSync(tempPath, destPath);
  process.stdout.write(`\n✓ Finished ${path.basename(destPath)} (${formatBytes(receivedBytes)})\n`);
}

async function downloadModel(id) {
  const m = MODELS[id];
  if (!m) {
    console.error(`Error: Unknown model "${id}". Run "node scripts/download_model.mjs list" to see available models.`);
    return false;
  }

  const isFallbackMode = process.env.FALLBACKMODE === "true" || process.env.FALLBACKMODE === "1";
  if (id === "qwen3.8-27b" && isFallbackMode) {
    console.log(`\n======================================================`);
    console.log(`Preparing Model: ${m.label} (${id})`);
    console.log(`======================================================`);
    console.log(`⚡ FALLBACK MODE ACTIVE: Skipping 16.5 GB download!`);
    console.log(`   Using Groq API directly with Qwen 27B model (qwen/qwen3.8-27b).`);
    return true;
  }

  const map = TARGET_MAP[id];
  console.log(`\n======================================================`);
  console.log(`Preparing Model: ${m.label} (${id})`);
  console.log(`======================================================`);

  const primaryWeightUrl = m.gguf || m.st;
  const fallbackWeightUrl = m.ggufFallback || m.stFallback;
  const destDir = path.join(MODELS_DIR, map.dir);
  const destWeight = path.join(destDir, map.file);
  const rootWeight = path.join(MODELS_DIR, map.rootFile);

  // 1. Download weights
  if (fs.existsSync(destWeight)) {
    console.log(`Weights already present: ${destWeight} (${formatBytes(fs.statSync(destWeight).size)})`);
  } else if (fs.existsSync(rootWeight)) {
    console.log(`Weights already present: ${rootWeight} (${formatBytes(fs.statSync(rootWeight).size)})`);
  } else {
    await downloadFileWithProgress(primaryWeightUrl, fallbackWeightUrl, destWeight);
  }

  // Ensure root candidate copy/link exists so detectLocalModel finds it
  if (!fs.existsSync(rootWeight) && fs.existsSync(destWeight)) {
    try {
      fs.linkSync(destWeight, rootWeight);
      console.log(`Created hardlink: ${rootWeight}`);
    } catch {
      try {
        fs.copyFileSync(destWeight, rootWeight);
        console.log(`Copied candidate: ${rootWeight}`);
      } catch (e) {
        console.warn(`Could not create root candidate: ${e.message}`);
      }
    }
  }

  // 2. Download config.json if available
  if (m.cfg) {
    const destCfg = path.join(destDir, "config.json");
    if (!fs.existsSync(destCfg)) {
      console.log(`Fetching config.json...`);
      try {
        const r = await fetch(m.cfg);
        if (r.ok) {
          const txt = await r.text();
          fs.writeFileSync(destCfg, txt);
          console.log(`✓ Saved ${destCfg}`);
        }
      } catch (err) {
        console.warn(`Warning: Could not fetch config.json: ${err.message}`);
      }
    }
  }

  // 3. Download tokenizer.json if available
  if (m.tok) {
    const destTok = path.join(destDir, "tokenizer.json");
    if (!fs.existsSync(destTok)) {
      console.log(`Fetching tokenizer.json...`);
      try {
        const r = await fetch(m.tok);
        if (r.ok) {
          const txt = await r.text();
          fs.writeFileSync(destTok, txt);
          console.log(`✓ Saved ${destTok}`);
        }
      } catch (err) {
        console.warn(`Warning: Could not fetch tokenizer.json: ${err.message}`);
      }
    }
  }

  console.log(`\n🎉 Model ${id} is ready for local offline demonstration!`);
  return true;
}

async function main() {
  const arg = process.argv[2] || "list";

  if (arg === "list" || arg === "--help" || arg === "-h") {
    listModels();
    return;
  }

  if (arg === "demo" || arg === "quick") {
    console.log("Starting quick demo download: SmolLM2-135M & Qwen3-0.6B...");
    await downloadModel("smollm-135m");
    await downloadModel("qwen3-0.6b");
    return;
  }

  if (arg === "all") {
    console.log("Starting full download of all 10 models...");
    for (const id of Object.keys(MODELS)) {
      await downloadModel(id);
    }
    return;
  }

  await downloadModel(arg);
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
