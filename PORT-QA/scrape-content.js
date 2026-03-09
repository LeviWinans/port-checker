const cheerio = require('cheerio');
const fs = require('fs');
const path = require('path');

// Load pages from JSON file
const pagesData = JSON.parse(fs.readFileSync(path.join(__dirname, 'pages-sorted.json'), 'utf8'));

async function scrape() {
  const baseDir = path.join(__dirname, 'scraped_content');
  if (!fs.existsSync(baseDir)) fs.mkdirSync(baseDir);

  for (const { oldPage, newPage } of pagesData) {
    // 1. Determine folder name from newPage endpoint
    const urlObj = new URL(newPage);
    const folderName = urlObj.pathname.replace(/^\/|\/$/g, '').replace(/\//g, '_') || 'root';
    const dir = path.join(baseDir, folderName);

    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

    // 2. Process both pages
    const targets = [
      { label: 'old', url: oldPage },
      { label: 'new', url: newPage }
    ];

    for (const target of targets) {
      try {
        console.log(`Fetching ${target.label}: ${target.url}`);
        const res = await fetch(target.url);
        if (!res.ok) throw new Error(`Status ${res.status}`);
        
        const html = await res.text();
        const $ = cheerio.load(html);

        // Remove header, nav, footer, and other non-content elements
        $('script, style, noscript, .skip-link, iframe, .entry-title, .rich-snippet-hidden, .fusion-footer, .fusion-header-wrapper, .fusion-header, header, .header, nav, .nav, .navigation, .main-navigation, footer, .footer, .footer-form-container, .accessibility-widget-container, .logos-section-container, .site-header, .site-footer, .site-navigation').remove();

        // Try to find main content area, fallback to body
        // Use .first() to ensure we only get one container
        let $content = $('main, article, .content, .entry-content, .post-content, .page-content, #content, #main-content').first();
        
        // If no specific content container found, use body but exclude header/footer
        if ($content.length === 0) {
          $content = $('body');
          // Remove header/footer if they still exist
          $content.find('header, footer, nav, .header, .footer, .nav').remove();
        }

        // Find the first h1 tag in the content area to start extraction from there
        const $firstH1 = $content.find('h1').first();
        
        let $contentToExtract;
        if ($firstH1.length > 0) {
          // Clone the entire content area
          const $cloned = $content.clone();
          
          // Find the h1 in the cloned content
          const $clonedH1 = $cloned.find('h1').first();
          
          // Find the direct parent of the h1
          const $h1Parent = $clonedH1.parent();
          
          // Remove all siblings that come before the h1 in the parent
          let foundH1 = false;
          $h1Parent.children().each((i, el) => {
            const $el = $(el);
            if ($el.is($clonedH1) || $el.find($clonedH1).length > 0) {
              foundH1 = true;
            } else if (!foundH1) {
              $el.remove();
            }
          });
          
          // If h1's parent is not the content container, also remove previous siblings of the parent
          if (!$h1Parent.is($cloned)) {
            let foundParent = false;
            const $grandParent = $h1Parent.parent();
            $grandParent.children().each((i, el) => {
              const $el = $(el);
              if ($el.is($h1Parent) || $el.find($h1Parent).length > 0) {
                foundParent = true;
              } else if (!foundParent) {
                $el.remove();
              }
            });
          }
          
          $contentToExtract = $cloned;
        } else {
          // No h1 found, use the original content area
          console.log(`  ⚠️  No h1 tag found on ${target.label} page, extracting from content area start`);
          $contentToExtract = $content.clone();
        }

        // Replace images with their alt text marked directly
        const images = $contentToExtract.find('img');
        images.each((i, el) => {
          const $el = $(el);
          const alt = $el.attr('alt');
          const marker = alt && alt.trim() ? `[ALT TAG: ${alt.trim()}]` : `[IMAGE: no alt text]`;
          $el.replaceWith(` ${marker} `);
        });

        // Replace videos with their descriptions marked directly
        const videos = $contentToExtract.find('video');
        videos.each((i, el) => {
          const $el = $(el);
          const title = $el.attr('title') || $el.attr('aria-label') || $el.attr('src') || '';
          const marker = title && title.trim() ? `[VIDEO: ${title.trim()}]` : `[VIDEO: no description]`;
          $el.replaceWith(` ${marker} `);
        });

        // Add newlines between block elements
        $contentToExtract.find('h1, h2, h3, h4, h5, h6, p, div, section, article, li').each((i, el) => {
          $(el).after('\n\n');
        });

        // Get all text content (markers should now be in the text)
        let textContent = $contentToExtract.text();

        // Normalize whitespace and format
        textContent = textContent
          .replace(/\s+/g, ' ')  // Replace multiple whitespace with single space
          .replace(/\s*\[ALT TAG:/g, '\n\n[ALT TAG:')  // Ensure alt tags are on their own lines
          .replace(/\s*\[VIDEO:/g, '\n\n[VIDEO:')  // Ensure videos are on their own lines
          .replace(/\s*\[IMAGE:/g, '\n\n[IMAGE:')  // Ensure images are on their own lines
          .replace(/\]\s+/g, ']\n')  // Add line break after closing bracket
          .trim();

        // Split into paragraphs
        const paragraphs = textContent
          .split(/\n\s*\n/)
          .map(p => p.trim())
          .filter(p => p.length > 0);

        // Combine content
        let output = `Source: ${target.url}\n`;
        output += `Scraped: ${new Date().toISOString()}\n`;
        output += `------------------------------------------\n\n`;
        output += "MAIN CONTENT (Alt tags and videos are marked):\n\n";
        output += paragraphs.join('\n\n');

        // Write to file
        fs.writeFileSync(path.join(dir, `${target.label}.txt`), output);
        console.log(`  ✓ Saved ${target.label} content`);
      } catch (e) {
        console.error(`  ✗ Error scraping ${target.url}: ${e.message}`);
      }
    }
  }
  console.log('\n✅ Scraping process complete.');
}

scrape();