const fs = require('fs');
const path = require('path');
const puppeteer = require('puppeteer');
const cheerio = require('cheerio');

const START_URL = 'https://aereaesthetics.com/';
const OUTPUT_FILE = path.join(__dirname, 'aere_empty_divs_report.txt');

// Track visited URLs to prevent infinite loops
const visitedUrls = new Set();
const urlsToVisit = [START_URL];
const reportResults = [];

// Helper to sanitize and resolve internal links
function getValidInternalLink(href, origin) {
  try {
    const url = new URL(href, origin);
    // Ignore external links, anchors, mailto/tel, and media files
    if (url.origin !== origin) return null;
    if (url.pathname.match(/\.(pdf|jpg|jpeg|png|gif|svg|css|js|zip)$/i)) return null;
    return url.href.split('#')[0]; // strip hash fragments
  } catch {
    return null;
  }
}

// Helper to extract CSS class name or fall back to closest named parent
function getTargetIdentifier($, element) {
  const $el = $(element);
  const className = $el.attr('class');
  
  if (className && className.trim()) {
    return `.${className.trim().split(/\s+/).join('.')}`;
  }

  // Traverse up to find closest parent with a class name
  const $parentWithClass = $el.parents('[class]').first();
  if ($parentWithClass.length > 0) {
    const parentClass = $parentWithClass.attr('class').trim().split(/\s+/).join('.');
    return `(No Class) -> Closest Parent: .${parentClass}`;
  }

  return `(No Class) -> Closest Parent: <${$el.parent().prop('tagName').toLowerCase()}>`;
}

async function crawlSite() {
  console.log(`Starting crawl on: ${START_URL}\n`);
  
  const browser = await puppeteer.launch({ headless: 'new' });
  const page = await browser.newPage();
  const targetOrigin = new URL(START_URL).origin;

  while (urlsToVisit.length > 0) {
    const currentUrl = urlsToVisit.shift();
    if (visitedUrls.has(currentUrl)) continue;

    visitedUrls.add(currentUrl);
    console.log(`Scanning [${visitedUrls.size}]: ${currentUrl}`);

    try {
      // Navigate to the page and wait for DOM network idle
      await page.goto(currentUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
      const html = await page.content();
      const $ = cheerio.load(html);

      // --- TASK 1: Find empty space divs (> <) ---
      const pageFindings = [];

      $('div').each((_, el) => {
        const text = $(el).text();
        const hasNoChildElements = $(el).children().length === 0;

        // Check if div contains only spaces/whitespace with no nested elements
        if (hasNoChildElements && text.length > 0 && text.trim() === '') {
          const identifier = getTargetIdentifier($, el);
          pageFindings.push(`  - ${identifier}`);
        }
      });

      if (pageFindings.length > 0) {
        reportResults.push(`Page: ${currentUrl}\n` + pageFindings.join('\n'));
      }

      // --- TASK 2: Discover new internal links ---
      $('a[href]').each((_, el) => {
        const href = $(el).attr('href');
        const resolvedLink = getValidInternalLink(href, targetOrigin);
        if (resolvedLink && !visitedUrls.has(resolvedLink) && !urlsToVisit.includes(resolvedLink)) {
          urlsToVisit.push(resolvedLink);
        }
      });

    } catch (err) {
      console.error(`Failed to scan ${currentUrl}:`, err.message);
    }
  }

  await browser.close();

  // Save findings to text file
  const fileContent = reportResults.length > 0
    ? `EMPTY SPACE DIV REPORT (${START_URL})\n` +
      `Scanned Pages: ${visitedUrls.size}\n` +
      `==================================================\n\n` +
      reportResults.join('\n\n')
    : `Scan complete. No empty space divs (> <) found across ${visitedUrls.size} page(s).`;

  fs.writeFileSync(OUTPUT_FILE, fileContent, 'utf-8');
  console.log(`\nCrawl finished! Scanned ${visitedUrls.size} pages.`);
  console.log(`Report written to: ${OUTPUT_FILE}`);
}

crawlSite();