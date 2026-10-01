const puppeteer = require('puppeteer');

(async () => {
  const browser = await puppeteer.launch({ headless: "new" });
  const page = await browser.newPage();
  
  // Forward console logs
  page.on('console', msg => console.log('BROWSER LOG:', msg.text()));
  page.on('pageerror', error => console.log('BROWSER ERROR:', error.message));
  page.on('requestfailed', request => console.log('BROWSER REQ FAIL:', request.url(), request.failure().errorText));

  await page.goto('http://localhost:8080/room');
  
  console.log('Opened /room');

  // Wait for it to be ready
  await page.waitForSelector('#ai-prompt', { timeout: 5000 });
  
  // Set fallback mode false explicitly just in case
  await page.evaluate(() => {
    localStorage.setItem("swarm_fallbackmode", "false");
    if (window.fallbackMode) window.fallbackMode = false;
  });

  // Type a prompt
  await page.type('#ai-prompt', 'hi');
  console.log('Typed hi');
  
  // Click send
  await page.click('#ai-send');
  console.log('Clicked send');
  
  // Wait a bit for generation
  await new Promise(r => setTimeout(r, 4000));
  
  const assistantText = await page.evaluate(() => {
    const bubbles = document.querySelectorAll('.chat-bubble.bot');
    if (bubbles.length === 0) return 'EMPTY';
    return bubbles[bubbles.length - 1].innerText;
  });
  
  console.log('Assistant text:', assistantText);
  
  const status = await page.evaluate(() => {
    return document.getElementById('ai-status')?.innerText || 'no status';
  });
  console.log('AI status:', status);

  await browser.close();
})();
