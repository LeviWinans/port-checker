const puppeteer = require('puppeteer');
const fs = require('fs').promises;
const path = require('path');
const https = require('https');
const { URL } = require('url');

const url = 'https://www.delacruzplasticsurgery.com/surgery-center';


// Create directories if they don't exist
async function ensureDir(dir) {
  try {
    await fs.access(dir);
  } catch {
    await fs.mkdir(dir, { recursive: true });
  }
}

// Download image and save as JPG
async function downloadImageAsJpg(imageUrl, outputPath) {
  return new Promise((resolve, reject) => {
    https.get(imageUrl, (response) => {
      if (response.statusCode !== 200) {
        reject(new Error(`Failed to download: ${response.statusCode}`));
        return;
      }

      const chunks = [];
      response.on('data', (chunk) => chunks.push(chunk));
      response.on('end', async () => {
        const buffer = Buffer.concat(chunks);
        await fs.writeFile(outputPath, buffer);
        resolve();
      });
    }).on('error', reject);
  });
}

// Generate safe filename from URL
function getImageName(imgUrl, index) {
  try {
    const url = new URL(imgUrl);
    const pathname = url.pathname;
    const baseName = path.basename(pathname);
    // Remove query parameters and sanitize
    const cleanName = baseName.split('?')[0].replace(/[^a-zA-Z0-9.-]/g, '_');
    
    // Ensure it has .jpg extension
    const nameWithoutExt = cleanName.includes('.') 
      ? cleanName.substring(0, cleanName.lastIndexOf('.')) 
      : cleanName;
    
    return `${nameWithoutExt || `image_${index}`}.jpg`;
  } catch {
    return `image_${index}.jpg`;
  }
}

async function scrapeImages(url) {
  let browser = null;
  const imagesDir = path.join(__dirname, 'images');
  const altData = [];
  let footerImagesSkipped = 0;

  try {
    await ensureDir(imagesDir);

    // Launch browser
    browser = await puppeteer.launch({ headless: true });
    const page = await browser.newPage();
    
    console.log(`Navigating to ${url}...`);
    await page.goto(url, { waitUntil: 'networkidle2', timeout: 60000 });
    
    // Use Puppeteer to evaluate in the browser context
    const images = await page.evaluate(() => {
      const results = [];
      
      // Helper function to check if element is in excluded areas (footer, nav, header)
      function isInExcludedArea(element) {
        const excludedTags = ['footer', 'nav', 'header'];
        const excludedClasses = ['footer', 'footer-container', 'nav', 'navbar', 'header'];
        
        // Check if element itself is excluded
        const tagName = element.tagName.toLowerCase();
        if (excludedTags.includes(tagName)) {
          return true;
        }
        
        for (const className of excludedClasses) {
          if (element.classList.contains(className)) {
            return true;
          }
        }
        
        // Traverse up the DOM tree
        let parent = element.parentElement;
        while (parent) {
          const parentTagName = parent.tagName.toLowerCase();
          if (excludedTags.includes(parentTagName)) {
            return true;
          }
          
          for (const className of excludedClasses) {
            if (parent.classList.contains(className)) {
              return true;
            }
          }
          parent = parent.parentElement;
        }
        return false;
      }
      
      // Get all images
      const allImages = document.querySelectorAll('img');
      
      allImages.forEach((img, index) => {
        if (!img.src) return; // Skip images without src
        
        // Check if in excluded area
        if (isInExcludedArea(img)) {
          results.push({
            url: img.src,
            alt: img.alt || '',
            inExcluded: true,
            index: index
          });
        } else {
          results.push({
            url: img.src,
            alt: img.alt || '',
            inExcluded: false,
            index: index
          });
        }
      });
      
      return results;
    });

    // Separate excluded and non-excluded images
    const excludedImages = images.filter(img => img.inExcluded);
    const nonExcludedImages = images.filter(img => !img.inExcluded);
    
    footerImagesSkipped = excludedImages.length;
    
    console.log(`Found ${nonExcludedImages.length} images (skipped ${footerImagesSkipped} excluded images from nav/header/footer)`);
    
    // Log excluded images that were skipped (for debugging)
    if (excludedImages.length > 0) {
      console.log('\nSkipped excluded area images (nav/header/footer):');
      excludedImages.forEach(img => {
        console.log(`  - ${img.url.substring(0, 60)}... (alt: "${img.alt || 'none'}")`);
      });
    }

    // Download each non-excluded image
    for (const [idx, img] of nonExcludedImages.entries()) {
      try {
        const imageName = getImageName(img.url, idx);
        const outputPath = path.join(imagesDir, imageName);
        
        console.log(`Downloading image ${idx + 1}/${nonExcludedImages.length}: ${imageName}`);
        await downloadImageAsJpg(img.url, outputPath);
        
        // Store alt text info
        altData.push({
          filename: imageName,
          alt: img.alt,
          originalUrl: img.url
        });
        
        // Small delay to be respectful to the server
        await new Promise(resolve => setTimeout(resolve, 500));
        
      } catch (error) {
        console.error(`Failed to download image ${idx}:`, error.message);
        altData.push({
          filename: `failed_${idx}.jpg`,
          alt: img.alt,
          originalUrl: img.url,
          error: error.message
        });
      }
    }

    // Write alt.txt file
    const altContent = altData.map(item => {
      return `${item.filename}: ${item.alt || '[No alt text]'}`;
    }).join('\n');
    
    await fs.writeFile(path.join(imagesDir, 'alt.txt'), altContent);
    
    // Write detailed log
    const logContent = `
Image Scraping Summary
======================
Date: ${new Date().toISOString()}
URL: ${url}

Non-excluded images found: ${nonExcludedImages.length}
Excluded images skipped: ${footerImagesSkipped}
Successfully downloaded: ${altData.filter(d => !d.error).length}
Failed downloads: ${altData.filter(d => d.error).length}

Skipped Excluded Area Images (nav/header/footer):
${excludedImages.map(img => `  - ${img.url} (alt: "${img.alt}")`).join('\n')}

Alt Text Details:
${altContent}
    `;
    
    await fs.writeFile(path.join(imagesDir, 'scrape_log.txt'), logContent);
    
    console.log('\n=== Summary ===');
    console.log(`Non-excluded images found: ${nonExcludedImages.length}`);
    console.log(`Excluded images skipped: ${footerImagesSkipped}`);
    console.log(`Successfully downloaded: ${altData.filter(d => !d.error).length}`);
    console.log(`Failed downloads: ${altData.filter(d => d.error).length}`);
    console.log(`Alt text file created: images/alt.txt`);
    console.log(`Detailed log created: images/scrape_log.txt`);
    
    return { altData, footerImagesSkipped };

  } catch (error) {
    console.error('Error during scraping:', error);
    throw error;
  } finally {
    if (browser) {
      await browser.close();
    }
  }
}

// Usage

scrapeImages(url)
  .then(({ altData, footerImagesSkipped }) => {
    console.log('\n=== Final Results ===');
    console.log(`Skipped ${footerImagesSkipped} excluded images (nav/header/footer)`);
    console.log(`Downloaded ${altData.length} images`);
    console.log('\nFirst few entries from alt.txt:');
    altData.slice(0, 5).forEach(item => {
      console.log(`${item.filename} -> "${item.alt}"`);
    });
  })
  .catch(error => {
    console.error('Scraping failed:', error);
  });