const fs = require('fs');
const path = require('path');

// Load pages from JSON file
const pagesData = JSON.parse(fs.readFileSync(path.join(__dirname, 'pages-sorted.json'), 'utf8'));

/**
 * Normalize text for comparison - preserves punctuation and special characters
 * Only normalizes whitespace and case for comparison
 */
function normalizeText(text) {
  return text
    .toLowerCase()
    .replace(/\s+/g, ' ')  // Normalize whitespace only
    .trim();
}

/**
 * Extract words from text (preserves punctuation within words, removes standalone punctuation)
 */
function extractWords(text) {
  // Normalize and split into words
  const normalized = normalizeText(text);
  // Split on whitespace and filter out empty strings
  return normalized
    .split(/\s+/)
    .filter(word => word.length > 0)
    .map(word => word.trim());
}

/**
 * Check if words from oldText exist in newText (order-independent)
 * Returns true if at least 80% of significant words match
 */
function wordsExistInText(oldText, newText, threshold = 0.8) {
  const oldWords = extractWords(oldText);
  const newWords = extractWords(newText);
  
  // Filter out very short words (1-2 chars) as they're often noise
  const significantOldWords = oldWords.filter(w => w.length > 2);
  
  if (significantOldWords.length === 0) return true; // No significant words to check
  
  const newWordSet = new Set(newWords);
  const matchingWords = significantOldWords.filter(word => newWordSet.has(word));
  
  const matchRatio = matchingWords.length / significantOldWords.length;
  return matchRatio >= threshold;
}

/**
 * Extract all text chunks from content (excluding markers)
 * Returns array of objects with both original and normalized versions
 * Chunks are split on periods or double line breaks, not single line breaks
 */
function extractTextChunks(content) {
  // Remove markers but keep track of alt tags and videos separately
  const withoutMarkers = content.replace(/\[ALT TAG:[^\]]+\]/g, '').replace(/\[VIDEO:[^\]]+\]/g, '');
  
  // First, replace single line breaks with spaces (keep sentences together)
  const withSpaces = withoutMarkers.replace(/\n+/g, ' ');
  
  // Split into sentences/phrases - split on periods followed by space, or double periods
  const chunks = withSpaces
    .split(/\.\s+/)  // Split on period followed by space
    .map(chunk => chunk.trim())
    .filter(chunk => chunk.length > 10) // Filter out very short chunks
    .map(chunk => ({
      original: chunk,
      normalized: normalizeText(chunk)
    }));
  
  return chunks;
}

/**
 * Extract alt tags from content
 * Returns array of objects with both original and normalized versions
 */
function extractAltTags(content) {
  const altTagRegex = /\[ALT TAG: ([^\]]+)\]/g;
  const altTags = [];
  let match;
  while ((match = altTagRegex.exec(content)) !== null) {
    const original = match[1];
    altTags.push({
      original: original,
      normalized: normalizeText(original)
    });
  }
  return altTags;
}

/**
 * Extract video descriptions from content
 * Returns array of objects with both original and normalized versions
 */
function extractVideos(content) {
  const videoRegex = /\[VIDEO: ([^\]]+)\]/g;
  const videos = [];
  let match;
  while ((match = videoRegex.exec(content)) !== null) {
    const original = match[1];
    videos.push({
      original: original,
      normalized: normalizeText(original)
    });
  }
  return videos;
}

/**
 * Find missing text chunks in new content that exist in old content
 * Uses word-based matching to handle different formatting/order
 */
function findMissingTextChunks(oldChunks, newChunks) {
  // Create a combined text from all new chunks for word searching
  const newContentText = newChunks.map(c => c.normalized).join(' ');
  
  return oldChunks.filter(oldChunk => {
    // Check if words from old chunk exist in new content
    return !wordsExistInText(oldChunk.normalized, newContentText);
  });
}

/**
 * Find missing items (alt tags, videos) in new content that exist in old content
 * Items are objects with {original, normalized} properties
 * Uses word-based matching for flexibility
 */
function findMissingItems(oldItems, newItems) {
  // Create a combined text from all new items for word searching
  const newContentText = newItems.map(item => item.normalized).join(' ');
  
  return oldItems.filter(oldItem => {
    // Check if words from old item exist in new content
    return !wordsExistInText(oldItem.normalized, newContentText);
  });
}

/**
 * Compare two content files
 */
function compareContent(oldContent, newContent) {
  const oldTextChunks = extractTextChunks(oldContent);
  const newTextChunks = extractTextChunks(newContent);
  const missingTextChunks = findMissingTextChunks(oldTextChunks, newTextChunks);

  const oldAltTags = extractAltTags(oldContent);
  const newAltTags = extractAltTags(newContent);
  const missingAltTags = findMissingItems(oldAltTags, newAltTags);

  const oldVideos = extractVideos(oldContent);
  const newVideos = extractVideos(newContent);
  const missingVideos = findMissingItems(oldVideos, newVideos);

  return {
    oldTextCount: oldTextChunks.length,
    newTextCount: newTextChunks.length,
    missingTextChunks,
    oldAltCount: oldAltTags.length,
    newAltCount: newAltTags.length,
    missingAltTags,
    oldVideoCount: oldVideos.length,
    newVideoCount: newVideos.length,
    missingVideos
  };
}

/**
 * Main comparison function
 */
async function comparePages() {
  const baseDir = path.join(__dirname, 'scraped_content');
  const resultsDir = path.join(__dirname, 'comparison_results');
  const successDir = path.join(__dirname, 'comparison_results', 'success');
  
  if (!fs.existsSync(resultsDir)) {
    fs.mkdirSync(resultsDir, { recursive: true });
  }

  if (!fs.existsSync(successDir)) {
    fs.mkdirSync(successDir, { recursive: true });
  }

  for (const { oldPage, newPage } of pagesData) {
    // Determine folder name from newPage endpoint
    const urlObj = new URL(newPage);
    const folderName = urlObj.pathname.replace(/^\/|\/$/g, '').replace(/\//g, '_') || 'root';
    const dir = path.join(baseDir, folderName);

    const oldFile = path.join(dir, 'old.txt');
    const newFile = path.join(dir, 'new.txt');

    if (!fs.existsSync(oldFile) || !fs.existsSync(newFile)) {
      console.log(`⚠️  Skipping ${folderName} - scraped files not found. Run scraper first.`);
      continue;
    }

    console.log(`\nComparing: ${folderName}`);
    console.log(`  Old: ${oldPage}`);
    console.log(`  New: ${newPage}`);

    const oldContent = fs.readFileSync(oldFile, 'utf8');
    const newContent = fs.readFileSync(newFile, 'utf8');

    const comparison = compareContent(oldContent, newContent);

    // Generate report - focusing only on missing old page content
    let report = `CONTENT COPY VERIFICATION REPORT\n`;
    report += `===================================\n\n`;
    report += `Checking if old page content exists on new page:\n\n`;
    report += `Old Page: ${oldPage}\n`;
    report += `New Page: ${newPage}\n`;
    report += `Generated: ${new Date().toISOString()}\n\n`;

    // Only show missing items, not counts
    const hasMissingContent = comparison.missingTextChunks.length > 0 || 
                             comparison.missingAltTags.length > 0 || 
                             comparison.missingVideos.length > 0;

    if (hasMissingContent) {
      report += `⚠️  MISSING CONTENT FROM OLD PAGE:\n`;
      report += `===================================\n\n`;

      if (comparison.missingTextChunks.length > 0) {
        report += `MISSING TEXT CONTENT (${comparison.missingTextChunks.length} chunks):\n`;
        report += `----------------------------------------\n`;
        comparison.missingTextChunks.forEach((chunk, i) => {
          const text = typeof chunk === 'string' ? chunk : chunk.original;
          report += `${i + 1}. ${text.substring(0, 200)}${text.length > 200 ? '...' : ''}\n`;
        });
        report += `\n`;
      }

      if (comparison.missingAltTags.length > 0) {
        report += `MISSING ALT TAGS (${comparison.missingAltTags.length}):\n`;
        report += `----------------------------------------\n`;
        comparison.missingAltTags.forEach((alt, i) => {
          const altText = typeof alt === 'string' ? alt : alt.original;
          report += `${i + 1}. ${altText}\n`;
        });
        report += `\n`;
      }

      if (comparison.missingVideos.length > 0) {
        report += `MISSING VIDEOS (${comparison.missingVideos.length}):\n`;
        report += `----------------------------------------\n`;
        comparison.missingVideos.forEach((video, i) => {
          const videoText = typeof video === 'string' ? video : video.original;
          report += `${i + 1}. ${videoText}\n`;
        });
        report += `\n`;
      }
    } else {
      report += `✅ SUCCESS: All content from the old page appears to be present on the new page!\n`;
      report += `\nNo missing text chunks, alt tags, or videos found.\n`;
    }

    // Save report to comparison_results folder or success subfolder
    const reportDir = hasMissingContent ? resultsDir : successDir;
    const reportFile = path.join(reportDir, `${folderName}.txt`);
    fs.writeFileSync(reportFile, report);
    const reportPath = hasMissingContent ? `comparison_results/${folderName}.txt` : `comparison_results/success/${folderName}.txt`;
    console.log(`  ✓ Saved comparison report: ${reportPath}`);
  }

  console.log(`\n✅ Comparison complete!`);
  console.log(`   All comparison reports saved in the 'comparison_results' folder as .txt files.`);
}

comparePages();

