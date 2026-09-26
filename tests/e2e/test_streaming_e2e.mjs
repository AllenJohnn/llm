import { chromium } from "playwright";

const CHROME_PATH = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const BASE_URL = "http://localhost:8080/room?signal=localhost:9000";

async function run() {
  console.log("=== Testing Real Streaming on Multi-Device Room ===");
  const browser = await chromium.launch({
    executablePath: CHROME_PATH,
    headless: true,
    args: ["--no-sandbox", "--disable-gpu", "--allow-loopback-in-peer-connection"]
  });

  const ctx1 = await browser.newContext();
  const ctx2 = await browser.newContext();

  const hostPage = await ctx1.newPage();
  const workerPage = await ctx2.newPage();

  try {
    console.log("1. Opening Host tab...");
    await hostPage.goto(BASE_URL);
    await hostPage.waitForSelector("#name-input", { state: "visible", timeout: 10000 });
    await hostPage.fill("#name-input", "Host");
    await hostPage.click("#create-btn");

    await hostPage.waitForFunction(() => {
      const code = document.getElementById("side-code")?.textContent?.trim();
      return code && code !== "----" && code.length >= 4;
    }, { timeout: 15000 });

    const roomCode = (await hostPage.textContent("#side-code")).trim();
    console.log(`   Host created room with code: [${roomCode}]`);

    console.log("2. Opening Worker tab and joining room...");
    await workerPage.goto(BASE_URL);
    await workerPage.waitForSelector("#name-input", { state: "visible", timeout: 10000 });
    await workerPage.fill("#name-input", "Worker");
    await workerPage.fill("#code-input", roomCode);
    await workerPage.click("#join-btn");

    console.log("3. Waiting for WebRTC connection between devices...");
    await hostPage.waitForFunction(() => document.querySelectorAll("#topbar-peers .topbar-peer-chip").length >= 2, { timeout: 20000 });
    await workerPage.waitForFunction(() => document.querySelectorAll("#topbar-peers .topbar-peer-chip").length >= 2, { timeout: 20000 });
    console.log("   Both devices connected via WebRTC!");

    // Test with active Groq model (qwen/qwen3.8-27b or openai/gpt-oss-20b)
    console.log("4. Setting model on Host to active Groq model: qwen/qwen3.8-27b...");
    await hostPage.evaluate(() => {
      window.ai.model = "qwen3.8-27b";
      // Point getGroqModelId mapping temporarily to the active qwen3.8-27b
      if (window.GROQ_MODEL_MAP) {
        window.GROQ_MODEL_MAP["qwen3.8-27b"] = "qwen/qwen3.8-27b";
      }
    });

    console.log("5. Host submitting prompt: 'Count 1, 2, 3 only'...");
    await hostPage.fill("#ai-prompt", "Count 1, 2, 3 only");
    await hostPage.click("#ai-send");

    console.log("6. Waiting for stream completion on both screens...");
    await hostPage.waitForFunction(() => {
      const btn = document.getElementById("ai-send");
      const out = document.getElementById("ai-output")?.textContent?.trim();
      return btn && !btn.classList.contains("stop-mode") && out && (out.includes("1") || out.includes("2") || out.includes("3"));
    }, { timeout: 25000 });

    await new Promise(r => setTimeout(r, 1500));

    const hostChat = await hostPage.textContent("#ai-output");
    const workerChat = await workerPage.textContent("#ai-output");

    console.log("\n=== Live Stream Output on Both Devices ===");
    console.log("Host Tab Content:\n", hostChat.trim());
    console.log("Worker Tab Content:\n", workerChat.trim());

    if (hostChat.includes("1") && workerChat.includes("1")) {
      console.log("\n✓ SUCCESS: Live tokens streamed from Groq and propagated across WebRTC to all devices!");
    } else {
      throw new Error("Live stream tokens did not propagate to worker");
    }
  } finally {
    await browser.close();
  }
}

run().catch((err) => {
  console.error("Test failed:", err);
  process.exit(1);
});
