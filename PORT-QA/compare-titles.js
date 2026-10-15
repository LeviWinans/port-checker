const fs = require("fs");
const puppeteer = require("puppeteer");
const path = require("path");

const pagesData = JSON.parse(
  fs.readFileSync(path.join(__dirname, "pages-sorted.json"), "utf8")
);

/* ============================
   HELPERS
============================ */

function normalizeHeading(str) {
  return str
    .replace(/\u00A0/g, " ") // nbsp → space
    .replace(/[“”]/g, '"') // smart quotes
    .replace(/[‘’]/g, "'")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

async function getHeadings(page, url) {
  try {
    await page.goto(url, {
      waitUntil: "networkidle2",
      timeout: 30000,
    });

    const headings = await page.$$eval("h1, h2, h3", (elements) => {
      return elements.map((el) => {
        const text = el.textContent.trim();
        const tag = el.tagName.toLowerCase();
        return text ? { text, tag } : null;
      }).filter(h => h !== null);
    });

    return headings;
  } catch (err) {
    return [`[ERROR FETCHING PAGE: ${err.message}]`];
  }
}

function compareHeadings(firstHeadings, portHeadings) {
  const first = firstHeadings.map((item) => ({
    text: item.text,
    tag: item.tag,
    norm: normalizeHeading(item.text),
  }));

  const port = portHeadings.map((item) => ({
    text: item.text,
    tag: item.tag,
    norm: normalizeHeading(item.text),
  }));

  const portNorms = new Set(port.map((h) => h.norm));
  const portNormMap = new Map(port.map((h) => [h.norm, h]));

  return {
    oldHeadings: first.map((h) => {
      const matchingPort = portNormMap.get(h.norm);
      return {
        text: h.text,
        tag: h.tag,
        found: !!matchingPort,
        matchTag: matchingPort?.tag,
      };
    }),
    newHeadings: port,
  };
}

function formatReport(oldPage, newPage, result) {
  let out = "";

  out += `OLD PAGE:\n${oldPage}\n\n`;
  out += `All Headings in Order:\n`;
  result.oldHeadings.forEach((h) => {
    const tag = h.tag.toUpperCase();
    const symbol = h.found ? "✓" : "✗";
    out += `  ${symbol} [${tag}] ${h.text}\n`;
  });

  out += `\nNEW PAGE:\n${newPage}\n\n`;
  out += `All Headings in Order:\n`;
  result.newHeadings.forEach((h) => {
    const tag = h.tag.toUpperCase();
    out += `  [${tag}] ${h.text}\n`;
  });

  out += "\n----------------------------------------\n\n";

  return out;
}

/* ============================
   RUNNER
============================ */

async function run() {
  const browser = await puppeteer.launch();
  const page = await browser.newPage();

  let output = "";
  output += "HEADING COMPARISON REPORT\n";
  output += "Old → New (All Headings)\n";
  output += "===============================\n\n";

  for (const { oldPage, newPage } of pagesData) {
    console.log(`Comparing: ${oldPage} → ${newPage}`);
    const oldHeadings = await getHeadings(page, oldPage);
    const newHeadings = await getHeadings(page, newPage);

    const comparison = compareHeadings(oldHeadings, newHeadings);
    output += formatReport(oldPage, newPage, comparison);
  }

  await browser.close();
  fs.writeFileSync("compared-titles.txt", output, "utf8");
  console.log("✔ Heading comparison complete → compared-titles.txt");
  process.exit(0);
}

run().catch(console.error);
