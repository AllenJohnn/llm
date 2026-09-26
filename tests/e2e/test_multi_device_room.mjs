import { chromium } from "playwright";

const CHROME_PATH = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const BASE_URL = "http://localhost:8080/room?signal=localhost:9000";

async function run() {
  console.log("=== Starting Multi-Device End-to-End Room Test ===");
  const browser = await chromium.launch({
    executablePath: CHROME_PATH,
    headless: true,
    args: ["--no-sandbox", "--disable-gpu", "--allow-loopback-in-peer-connection"]
  });

  const ctx1 = await browser.newContext();
  const ctx2 = await browser.newContext();

  const hostPage = await ctx1.newPage();
  const workerPage = await ctx2.newPage();

  hostPage.on("console", (msg) => {
    console.log("[Host Console]", msg.type(), msg.text().slice(0, 150));
  });
  workerPage.on("console", (msg) => {
    console.log("[Worker Console]", msg.type(), msg.text().slice(0, 150));
  });

  try {
    // 1. Open Host tab
    console.log("1. Opening Host tab...");
    await hostPage.goto(BASE_URL);
    await hostPage.waitForSelector("#name-input", { state: "visible", timeout: 10000 });
    await hostPage.fill("#name-input", "Laptop Host");
    await hostPage.click("#create-btn");

    // Wait for room to be created and code displayed
    await hostPage.waitForFunction(() => {
      const code = document.getElementById("side-code")?.textContent?.trim();
      return code && code !== "----" && code.length >= 4;
    }, { timeout: 15000 });

    const roomCode = (await hostPage.textContent("#side-code")).trim();
    console.log(`   Host created room with code: [${roomCode}]`);

    // 2. Open Worker tab and join
    console.log("2. Opening Worker tab and joining room...");
    await workerPage.goto(BASE_URL);
    await workerPage.waitForSelector("#name-input", { state: "visible", timeout: 10000 });
    await workerPage.fill("#name-input", "Worker Tab");
    await workerPage.fill("#code-input", roomCode);
    await workerPage.click("#join-btn");

    // 3. Wait for peer card to appear on Host
    console.log("3. Waiting for WebRTC connection between devices...");
    await hostPage.waitForFunction(() => document.querySelectorAll("#topbar-peers .topbar-peer-chip").length >= 2, { timeout: 20000 });
    await workerPage.waitForFunction(() => document.querySelectorAll("#topbar-peers .topbar-peer-chip").length >= 2, { timeout: 20000 });
    console.log("   Both devices connected via WebRTC in the room!");

    // 4. Host starts model
    console.log("4. Host starting Qwen 3.8 27B (via Groq mode)...");
    await hostPage.selectOption("#ai-model", "qwen3.8-27b");
    if (await hostPage.isVisible("#ai-start")) {
      await hostPage.click("#ai-start");
    } else {
      await hostPage.evaluate(() => window.aiStart && window.aiStart("qwen3.8-27b"));
    }

    // 5. Verify room ready status on both tabs
    console.log("5. Verifying room ready status on both tabs...");
    await hostPage.waitForSelector("#ai-row", { state: "visible", timeout: 10000 });
    await workerPage.waitForSelector("#ai-row", { state: "visible", timeout: 10000 });
    console.log("   Both tabs are in ready state via Groq!");

    // 6. Test submitting prompt from host and verify streaming on both screens
    console.log("6. Submitting prompt: 'Say hello in 3 words'...");
    await hostPage.fill("#ai-prompt", "Say hello in 3 words");
    await hostPage.click("#ai-send");

    // 7. Verify both tabs see the chat update and response
    console.log("7. Waiting for response update on both screens...");
    // Wait until send button returns to 'send' state
    await hostPage.waitForFunction(() => {
      const btn = document.getElementById("ai-send");
      const out = document.getElementById("ai-output")?.textContent?.trim();
      return btn && !btn.classList.contains("stop-mode") && out && out.length > 5;
    }, { timeout: 20000 });

    // Allow brief moment for final message propagation over WebRTC
    await new Promise(r => setTimeout(r, 1000));

    const hostChat = await hostPage.textContent("#ai-output");
    const workerChat = await workerPage.textContent("#ai-output");

    console.log("\n=== Responses on Both Devices ===");
    console.log("Host Screen Chat:\n", hostChat.trim());
    console.log("Worker Screen Chat:\n", workerChat.trim());

    if (hostChat.length > 10 && workerChat.length > 10) {
      console.log("\n✓ Multi-device chat over WebRTC via Groq completed successfully!");
    } else {
      throw new Error("Chat did not propagate to both devices");
    }
  } finally {
    await browser.close();
  }
}

run().catch((err) => {
  console.error("Test failed:", err);
  process.exit(1);
});
