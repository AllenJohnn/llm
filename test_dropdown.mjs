import puppeteer from 'puppeteer';

(async () => {
  const browser = await puppeteer.launch({ headless: true });
  const page = await browser.newPage();
  
  console.log("Navigating to http://localhost:8080/room");
  await page.goto('http://localhost:8080/room', { waitUntil: 'networkidle0' });

  // Wait for model select to be present
  await page.waitForSelector('#ai-model');

  // Select Qwen 0.6B
  console.log("Selecting qwen3-0.6b");
  await page.select('#ai-model', 'qwen3-0.6b');
  
  // Need to click Start or wait for it to load? 
  // It should auto-start or we click #ai-start
  const startBtn = await page.$('#ai-start');
  if (startBtn) {
    const disabled = await page.evaluate(el => el.disabled, startBtn);
    if (!disabled) {
      console.log("Clicking start...");
      await page.click('#ai-start');
    }
  }

  // Wait for cluster online (mascot message or loading to finish)
  console.log("Waiting for model to load...");
  await page.waitForFunction(() => {
    const panel = document.getElementById('ai-panel');
    return panel && panel.classList.contains('online') && !panel.classList.contains('loading');
  }, { timeout: 60000 });
  
  console.log("Model loaded.");

  // Check state before generation
  let aiModelDisabled = await page.evaluate(() => document.getElementById('ai-model').disabled);
  console.log(`[Before Generation] #ai-model.disabled: ${aiModelDisabled}`);

  // Generate a short response
  console.log("Typing prompt...");
  await page.type('#ai-prompt', 'Hello');
  console.log("Clicking send...");
  await page.click('#ai-send');

  // Wait for generation to start
  console.log("Waiting for generation to start...");
  await page.waitForFunction(() => {
    return window.ai && window.ai.busy === "gen";
  }, { timeout: 10000 });

  // Check state during generation
  aiModelDisabled = await page.evaluate(() => document.getElementById('ai-model').disabled);
  console.log(`[During Generation] #ai-model.disabled: ${aiModelDisabled}`);

  // Wait for generation to finish
  console.log("Waiting for generation to finish...");
  await page.waitForFunction(() => {
    return window.ai && window.ai.busy === false;
  }, { timeout: 60000 });
  console.log("Generation finished.");

  // Check state after generation
  aiModelDisabled = await page.evaluate(() => document.getElementById('ai-model').disabled);
  console.log(`[After Generation] #ai-model.disabled: ${aiModelDisabled}`);
  
  const busy = await page.evaluate(() => window.ai.busy);
  console.log(`[After Generation] ai.busy: ${busy}`);

  // Select Phi-4 mini
  if (!aiModelDisabled) {
    console.log("Selecting Phi-4 mini...");
    await page.select('#ai-model', 'phi4-mini');
    const selectedModel = await page.evaluate(() => document.getElementById('ai-model').value);
    console.log(`[After Change] selected model: ${selectedModel}`);
  } else {
    console.log("Cannot select Phi-4 mini because selector is disabled!");
  }

  await browser.close();
})();
