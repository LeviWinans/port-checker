const puppeteer = require("puppeteer");
const cheerio = require("cheerio");
const fs = require("fs");
const path = require("path");
const axios = require("axios");

// Add targets here
// procedureLink is currently unused, but can be used in the future if we want to scrape additional data linking to the procedure page
const baseUrlPrefix = "https://www.advancedsurgerynj.com/gallery/minimally-invasive-surgery/";

const subcategories = [
  { subcategory: "pilonidal-cyst", procedureLink: "/" },
];

const articleTarget = ".gallery-grid__row";
const imageTarget = ".procedure-gallery__image img";
const titleTarget = ".patient-label";
const subtitleTarget = ".patient-label";
const indexTarget = ".patient-details";


async function downloadImage(url, filepath) {
  try {
    const response = await axios({
      url,
      method: "GET",
      responseType: "stream",
    });
    return new Promise((resolve, reject) => {
      response.data
        .pipe(fs.createWriteStream(filepath))
        .on("error", reject)
        .once("close", () => resolve());
    });
  } catch (e) {
    console.error(`|-- Failed to download image: ${url}`);
  }
}

(async () => {
  const browser = await puppeteer.launch({ headless: "new" });
  const page = await browser.newPage();



  for (const sub of subcategories) {
    console.log(`\n>>> Processing Category: ${sub.subcategory}`);
    const categoryDir = path.join(__dirname, sub.subcategory);
    if (!fs.existsSync(categoryDir)) fs.mkdirSync(categoryDir);

    await page.goto(`${baseUrlPrefix}${sub.subcategory}/`, { waitUntil: "networkidle2" });
    const html = await page.content();
    const $ = cheerio.load(html);
    const articles = $(articleTarget);

    for (let i = 0; i < articles.length; i++) {
      const folderName = (i + 1).toString().padStart(2, "0");
      const folderPath = path.join(categoryDir, folderName);
      if (!fs.existsSync(folderPath)) fs.mkdirSync(folderPath);

      const article = $(articles[i]);

      // Text Files
      const title = article.find(titleTarget).text().trim();
      const subtitle = article.find(subtitleTarget).text().trim();
      fs.writeFileSync(path.join(folderPath, "title.txt"), title);
      fs.writeFileSync(path.join(folderPath, "subtitle.txt"), subtitle);

      const detailUrl = article.find("a[href]").attr("href");
      if (detailUrl) {
        const cleanUrl = detailUrl.split('#')[0];
        const absoluteUrl = new URL(cleanUrl, baseUrlPrefix).href;
        const detailPage = await browser.newPage();
        try {
          await detailPage.goto(absoluteUrl, { waitUntil: "networkidle2" });
          const detailHtml = await detailPage.content();
          const $d = cheerio.load(detailHtml);

          // 1. Process index.html (View Angle Text)
          let viewIndexCopy = $d(indexTarget).html() || "";


          let processedText = viewIndexCopy
            // 1. Replace opening Bold tags (strong or b)
            .replace(/<(strong|b)[^>]*>/gi, "[.bold]")
            // 2. Replace opening Italic tags (em or i)
            .replace(/<(em|i)[^>]*>/gi, "[.italic]")
            // 3. Replace all closing tags for these specific styles with []
            .replace(/<\/(strong|b|em|i)>/gi, "[]")
            // 4. Strip all remaining HTML tags
            .replace(/<[^>]*>/g, "");

          fs.writeFileSync(
            path.join(folderPath, "index.html"),
            processedText.trim(),
          );

          // 2. Download Images (Looking inside the containers for the <img> tag)
          // We select the img tags directly inside the specific containers
          const imgElements = $d(imageTarget);
          const downloadedUrls = new Set();

          console.log(
            `|-- Folder ${folderName}: Downloading ${imgElements.length} images...`,
          );

          let imageCount = 0;
          for (let j = 0; j < imgElements.length; j++) {
            const imgUrl = $d(imgElements[j]).attr("src");
            if (imgUrl) {
              const absoluteImgUrl = new URL(imgUrl, absoluteUrl).href;
              if (!downloadedUrls.has(absoluteImgUrl)) {
                downloadedUrls.add(absoluteImgUrl);
                imageCount++;
                const imgName = imageCount.toString().padStart(2, "0") + ".jpg";
                await downloadImage(absoluteImgUrl, path.join(folderPath, imgName));
              }
            }
          }
        } catch (err) {
          console.error(`|-- Error on ${detailUrl}:`, err.message);
        }
        await detailPage.close();
      }
    }
  }

  await browser.close();
  console.log("\nAll categories finished!");
})();
