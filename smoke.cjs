const puppeteer = require('puppeteer');

(async () => {
  const browser = await puppeteer.launch({ headless: true });
  const page = await browser.newPage();
  
  page.on('console', msg => console.log('BROWSER:', msg.text()));
  page.on('pageerror', err => console.log('PAGE ERROR:', err.toString()));
  
  await page.goto('http://localhost:8080/room');
  await page.waitForTimeout(2000); // wait for load
  
  // click toggle
  console.log('Toggling fallback...');
  await page.evaluate(() => {
    window.toggleFallbackMode(true);
  });
  await page.waitForTimeout(1000);
  
  console.log('Typing prompt...');
  await page.type('#ai-prompt', 'hello');
  await page.click('#ai-send');
  
  console.log('Waiting for generation...');
  await page.waitForTimeout(5000);
  
  const text = await page.evaluate(() => {
    const bubbles = document.querySelectorAll('.bubble-content');
    return bubbles[bubbles.length - 1]?.innerText || 'No bubble';
  });
  
  const perf = await page.evaluate(() => {
    return {
      tps: document.getElementById('perf-stat-peak')?.innerText,
      tokens: document.getElementById('perf-stat-tokens')?.innerText
    };
  });
  
  console.log('Result text:', text);
  console.log('Perf:', perf);
  
  await browser.close();
})();
