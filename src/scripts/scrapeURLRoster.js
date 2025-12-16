/*
Uses axios to fetch raw HTML.
Uses cheerio (Node’s jQuery-like DOM parser) to parse the HTML DOM. 
Iterates over table rows, extracts email text (you may need to adjust the selector based on your HTML), lowercases and collects emails.
Writes to allowedAgents.json
*/

import axios from "axios";
import * as cheerio from "cheerio";
import fs from "fs/promises";

async function scrapeRoster() {
  const url =
    "https://ikonofashburn.com/AgentRoster?op=agent&act=list&branch_id=1097681143";

  try {
    const resp = await axios.get(filePath);
    const html = resp.data;
    const $ = cheerio.load(html);

    // Adjust selector to match your roster table / email cells
    const emails = [];

    $("table tr").each((i, row) => {
      // Example: assume email is in a cell with class .email or 3rd td
      const emailTd = $(row).find("td.email").text().trim()
        || $(row).find("td").eq(2).text().trim();
      if (emailTd && emailTd.includes("@")) {
        emails.push(emailTd.toLowerCase());
      }
    });

    await fs.writeFile(
      "allowedAgents.json",
      JSON.stringify(emails, null, 2),
      "utf-8"
    );
    console.log("✅ Scraped", emails.length, "agents.");
  } catch (err) {
    console.error("❌ Failed to scrape roster:", err);
  }
}

scrapeRoster();