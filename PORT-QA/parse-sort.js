const fs = require('fs');
const path = require('path');

// Read the sort.txt file
const filePath = path.join(__dirname, 'sort.txt');
const content = fs.readFileSync(filePath, 'utf8');

// Base URLs (you may need to adjust these)
const oldBaseUrl = 'https://www.zenregen.com';
const newBaseUrl = 'https://zenregen.influx-dev.com';

// Split into lines and process
const lines = content.split('\n');
const pages = [];

for (let i = 0; i < lines.length; i++) {
  const line = lines[i].trim();
  
  // Skip empty lines, header lines, and lines that are just numbers
  if (!line || 
      line.includes('Existing Page\tGoogle Doc\tURL') || 
      line.includes('100%') ||
      /^\d+\s+\d+\s+\d+$/.test(line) ||
      line === 'New Page' ||
      line.startsWith('\t')) {
    continue;
  }
  
  // Split by tab
  const parts = line.split('\t');
  
  // Need at least 3 parts (oldPage, contentSource, newPage)
  if (parts.length < 3) {
    continue;
  }
  
  const oldPage = parts[0].trim();
  const contentSource = parts[1].trim();
  const newPage = parts[2].trim();
  
  // Skip if oldPage is "New Page" or empty, or if newPage is empty
  if (oldPage === 'New Page' || !oldPage || !newPage) {
    continue;
  }
  
  // Skip if contentSource is "301"
  if (contentSource !== 'PORT') {
    continue;
  }
  
  // Build full URLs
  const oldPageUrl = oldPage.startsWith('http') ? oldPage : oldBaseUrl + oldPage;
  const newPageUrl = newPage.startsWith('http') ? newPage : newBaseUrl + newPage;
  
  pages.push({
    oldPage: oldPageUrl,
    contentSource: contentSource || '',
    newPage: newPageUrl
  });
}

// Output as JSON
console.log(`Found ${pages.length} pages`);
console.log('\nFirst few entries:');
pages.slice(0, 5).forEach((page, i) => {
  console.log(`${i + 1}. oldPage: ${page.oldPage}`);
  console.log(`   contentSource: ${page.contentSource}`);
  console.log(`   newPage: ${page.newPage}\n`);
});

// Save to JSON file
const outputPath = path.join(__dirname, 'pages-sorted.json');
fs.writeFileSync(outputPath, JSON.stringify(pages, null, 2));
console.log(`\n✅ Saved ${pages.length} pages to ${outputPath}`);

// Also export for use in other scripts
module.exports = pages;

