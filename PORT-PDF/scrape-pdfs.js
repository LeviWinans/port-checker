// pdf-scraper.js
const puppeteer = require('puppeteer');
const cheerio = require('cheerio');
const axios = require('axios');
const fs = require('fs-extra');
const path = require('path');
const url = require('url');

class PDFScraper {
    constructor(targetUrl, downloadDir = './downloads') {
        this.targetUrl = targetUrl;
        this.downloadDir = downloadDir;
        this.baseUrl = new URL(targetUrl).origin;
        this.pdfLinks = [];
    }

    async initialize() {
        // Create download directory if it doesn't exist
        await fs.ensureDir(this.downloadDir);
        console.log(`📁 Download directory: ${this.downloadDir}`);
    }

    async scrapeWithPuppeteer() {
        console.log('🚀 Launching Puppeteer to scrape page...');
        const browser = await puppeteer.launch({ headless: 'new' });
        
        try {
            const page = await browser.newPage();
            await page.goto(this.targetUrl, { waitUntil: 'networkidle0', timeout: 60000 });
            
            // Wait for content to load
            await page.waitForSelector('body');
            
            // Get the page content
            const content = await page.content();
            
            // Use Cheerio to parse the loaded content
            const $ = cheerio.load(content);
            
            // Find all PDF links
            $('a[href$=".pdf"], a[href*=".pdf?"], a[href*=".pdf#"]').each((index, element) => {
                const $element = $(element);
                let href = $element.attr('href');
                const linkText = $element.text().trim();
                
                if (href) {
                    // Convert relative URLs to absolute
                    href = url.resolve(this.targetUrl, href);
                    
                    // Extract filename from URL
                    const urlParts = href.split('/');
                    let filename = urlParts[urlParts.length - 1].split('?')[0].split('#')[0];
                    
                    // Ensure it's a PDF
                    if (!filename.toLowerCase().endsWith('.pdf')) {
                        filename += '.pdf';
                    }
                    
                    this.pdfLinks.push({
                        url: href,
                        filename: filename,
                        linkText: linkText || path.basename(filename, '.pdf').replace(/_/g, ' ')
                    });
                }
            });
            
            console.log(`📊 Found ${this.pdfLinks.length} PDF link(s)`);
            
            // Create a links.txt file with all PDF information
            await this.createLinksFile();
            
            return this.pdfLinks;
            
        } finally {
            await browser.close();
        }
    }

    async createLinksFile() {
        const linksFilePath = path.join(this.downloadDir, 'links.txt');
        let linksContent = 'PDF LINKS FOUND ON: ' + this.targetUrl + '\n';
        linksContent += '='.repeat(50) + '\n\n';
        
        this.pdfLinks.forEach((pdf, index) => {
            linksContent += `${index + 1}. Link Text: "${pdf.linkText}"\n`;
            linksContent += `   URL: ${pdf.url}\n`;
            linksContent += `   Saved As: ${pdf.filename}\n\n`;
        });
        
        linksContent += '='.repeat(50) + '\n';
        linksContent += `Total PDFs found: ${this.pdfLinks.length}\n`;
        linksContent += `Download completed on: ${new Date().toLocaleString()}\n`;
        
        await fs.writeFile(linksFilePath, linksContent);
        console.log(`📝 Links file created: ${linksFilePath}`);
    }

    async downloadPDF(pdfInfo) {
        try {
            console.log(`⬇️  Downloading: ${pdfInfo.filename}`);
            
            const response = await axios({
                method: 'GET',
                url: pdfInfo.url,
                responseType: 'stream',
                timeout: 30000,
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                    'Accept': 'application/pdf'
                }
            });

            const filePath = path.join(this.downloadDir, pdfInfo.filename);
            const writer = fs.createWriteStream(filePath);

            response.data.pipe(writer);

            return new Promise((resolve, reject) => {
                writer.on('finish', () => {
                    console.log(`✅ Downloaded: ${pdfInfo.filename}`);
                    resolve(filePath);
                });
                writer.on('error', reject);
            });
        } catch (error) {
            console.error(`❌ Failed to download ${pdfInfo.filename}:`, error.message);
            
            // Try alternative filename if download fails
            if (error.response && error.response.status === 404) {
                console.log(`🔄 Attempting alternative URL for ${pdfInfo.filename}...`);
                // Try without query parameters
                const cleanUrl = pdfInfo.url.split('?')[0];
                if (cleanUrl !== pdfInfo.url) {
                    return this.downloadPDF({
                        ...pdfInfo,
                        url: cleanUrl
                    });
                }
            }
            return null;
        }
    }

    async downloadAllPDFs() {
        console.log(`\n🚀 Starting downloads (${this.pdfLinks.length} files)...\n`);
        
        const results = [];
        for (const pdfInfo of this.pdfLinks) {
            const result = await this.downloadPDF(pdfInfo);
            if (result) {
                results.push({
                    ...pdfInfo,
                    savedPath: result
                });
            }
            // Add delay to be respectful to the server
            await new Promise(resolve => setTimeout(resolve, 1000));
        }
        
        return results;
    }

    async run() {
        console.log('🔍 Starting PDF scraper...');
        await this.initialize();
        
        // Scrape PDF links using Puppeteer + Cheerio
        const pdfLinks = await this.scrapeWithPuppeteer();
        
        if (pdfLinks.length === 0) {
            console.log('⚠️  No PDF files found on the page.');
            return;
        }

        // Display found PDFs
        console.log('\n📋 Found PDF files:');
        pdfLinks.forEach((pdf, index) => {
            console.log(`   ${index + 1}. "${pdf.linkText}" -> ${pdf.filename}`);
        });

        // Download all PDFs
        const downloaded = await this.downloadAllPDFs();
        
        console.log(`\n✨ Download complete! Downloaded ${downloaded.length} out of ${pdfLinks.length} files.`);
        console.log(`📂 Files saved to: ${path.resolve(this.downloadDir)}`);
        
        // Update links.txt with download status
        await this.updateLinksFile(downloaded);
    }

    async updateLinksFile(downloaded) {
        const linksFilePath = path.join(this.downloadDir, 'links.txt');
        let content = await fs.readFile(linksFilePath, 'utf8');
        
        content += '\n\nDOWNLOAD STATUS:\n';
        content += '-'.repeat(30) + '\n';
        content += `Successfully downloaded: ${downloaded.length}/${this.pdfLinks.length}\n`;
        
        if (downloaded.length < this.pdfLinks.length) {
            content += '\nFailed downloads:\n';
            this.pdfLinks.forEach(pdf => {
                if (!downloaded.find(d => d.url === pdf.url)) {
                    content += `- ${pdf.filename} (${pdf.url})\n`;
                }
            });
        }
        
        await fs.writeFile(linksFilePath, content);
    }
}

// Main execution
async function main() {
    const targetUrl = 'https://www.delacruzplasticsurgery.com/patient-registration-form';
    const scraper = new PDFScraper(targetUrl, './pdf_downloads');
    
    try {
        await scraper.run();
    } catch (error) {
        console.error('❌ Scraping failed:', error.message);
    }
}

// Run if called directly
if (require.main === module) {
    main();
}

module.exports = PDFScraper;