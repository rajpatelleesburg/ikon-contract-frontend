// scripts/scrapeRoster.js
const fs = require("fs");
const cheerio = require("cheerio");

const filePath = "C:/Users/rpatel/Downloads/ikon agents email addresses.html";

try {
  const html = fs.readFileSync(filePath, "utf8");
  const $ = cheerio.load(html);

  const emails = new Set();
  const phones = new Set();

  // EMAILS - from <div class="ar_agent_mail" id="email">
  $(".ar_agent_mail").each((i, el) => {
    const email = $(el).attr("id")?.trim()?.toLowerCase();
    if (email && email.includes("@")) {
      emails.add(email);
    }
  });

  // PHONES - from <div class="ar_agent_phone">(703) 987-5876</div>
  $(".ar_agent_phone").each((i, el) => {
    let rawPhone = $(el).text()?.trim();

    if (!rawPhone) return;

    // Remove non-digit chars: (703) 987-5876 --> 7039875876
    const digits = rawPhone.replace(/\D/g, "");

    // Must be 10 digits for US/Canada
    if (digits.length === 10) {
      const e164 = `+1${digits}`;
      phones.add(e164);
    }
  });

  // Save outputs
  fs.writeFileSync(
    "allowedAgents.json",
    JSON.stringify(Array.from(emails), null, 2),
    "utf8"
  );

  fs.writeFileSync(
    "allowedPhones.json",
    JSON.stringify(Array.from(phones), null, 2),
    "utf8"
  );

  console.log("✔ Extracted Agents:", emails.size);
  console.log("✔ Extracted Phones:", phones.size);
} catch (err) {
  console.error("❌ Scrape failed:", err);
}