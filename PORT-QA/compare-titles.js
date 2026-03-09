const fs = require("fs");
const axios = require("axios");
const cheerio = require("cheerio");
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

async function getHeadings(url) {
  try {
    const res = await axios.get(url, {
      timeout: 15000,
      headers: { "User-Agent": "Mozilla/5.0" },
    });

    const $ = cheerio.load(res.data);

    const headings = [];
    for (const tag of ["h1", "h2", "h3"]) {
      $(tag).each((i, el) => {
        const text = $(el).text().trim();
        if (text) {
          headings.push({ text, tag });
        }
      });
    }
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
    first: first.map((h) => {
      const matchingPort = portNormMap.get(h.norm);
      return {
        text: h.text,
        tag: h.tag,
        found: !!matchingPort,
        matchTag: matchingPort?.tag,
      };
    }),
  };
}

function formatReport(oldPage, newPage, result) {
  let out = "";

  out += `OLD PAGE:\n${oldPage}\n\n`;
  out += `NEW PAGE:\n${newPage}\n\n`;

  const missed = result.first.filter((h) => !h.found);
  const found = result.first.filter((h) => h.found);

  if (missed.length === 0) {
    out += `✓ All headings from old page found on new page (${found.length})\n`;
  } else {
    out += `MISSED HEADINGS FROM OLD PAGE (${missed.length}):\n`;
    missed.forEach((h) => {
      const tag = h.tag.toUpperCase();
      out += `  ✗ [${tag}] ${h.text}\n`;
    });

    if (found.length > 0) {
      out += `\nFOUND ON NEW PAGE (${found.length}):\n`;
      found.forEach((h) => {
        const tag = h.tag.toUpperCase();
        let line = `  ✓ [${tag}]`;
        if (h.tag !== h.matchTag) {
          line += ` (on new page as <${h.matchTag}>)`;
        }
        line += ` ${h.text}`;
        out += `${line}\n`;
      });
    }
  }

  out += "\n----------------------------------------\n\n";

  return out;
}

/* ============================
   RUNNER
============================ */

async function run() {
  let output = "";
  output += "HEADING COMPARISON REPORT\n";
  output += "Old → New (Missing Titles Only)\n";
  output += "===============================\n\n";

  for (const { oldPage, newPage } of pagesData) {
    const oldHeadings = await getHeadings(oldPage);
    const newHeadings = await getHeadings(newPage);

    const comparison = compareHeadings(oldHeadings, newHeadings);
    output += formatReport(oldPage, newPage, comparison);
  }

  fs.writeFileSync("compared-titles.txt", output, "utf8");
  // console.log("✔ Heading comparison complete → compared-titles.txt");
}

run();
