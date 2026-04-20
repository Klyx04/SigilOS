const puppeteer = require('puppeteer');

async function scrapeDuffus() {
  const browser = await puppeteer.launch({ 
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  const page = await browser.newPage();
  
  // Set a realistic User-Agent
  await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');

  try {
    console.log('Navigating to Duffus...');
    await page.goto('https://duffus.fr/avis-de-recherche', { waitUntil: 'networkidle2', timeout: 60000 });
    
    // Wait for content that isn't the challenge
    console.log('Waiting for content...');
    await page.waitForSelector('h1', { timeout: 10000 }); 

    const content = await page.evaluate(() => {
      // Small helper to scrape items
      const items = [];
      const rows = document.querySelectorAll('tr'); // Assuming it's a table, adjust if not
      rows.forEach(row => {
          items.push(row.innerText);
      });
      return {
          title: document.querySelector('h1')?.innerText,
          sampleRows: items.slice(0, 10),
          htmlSample: document.body.innerHTML.substring(0, 2000)
      };
    });

    console.log('Scraped Data:', JSON.stringify(content, null, 2));

  } catch (error) {
    console.error('Puppeteer failed:', error.message);
    // Take a screenshot to see what's happening
    await page.screenshot({ path: 'duffus_error.png' });
    console.log('Screenshot saved to duffus_error.png');
  } finally {
    await browser.close();
  }
}

scrapeDuffus();
