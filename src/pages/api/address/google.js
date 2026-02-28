// Simple in-memory rate limiter (per-serverless-instance)
const rateLimitMap = new Map();
const RATE_LIMIT_WINDOW_MS = 60_000; // 1 minute
const MAX_REQUESTS_PER_WINDOW = 30;

function isRateLimited(ip) {
  const now = Date.now();
  const entry = rateLimitMap.get(ip);
  if (!entry || now - entry.windowStart > RATE_LIMIT_WINDOW_MS) {
    rateLimitMap.set(ip, { windowStart: now, count: 1 });
    return false;
  }
  entry.count++;
  return entry.count > MAX_REQUESTS_PER_WINDOW;
}

// Only allow alphanumeric, spaces, and common address chars
const ADDRESS_RE = /^[a-zA-Z0-9\s,.\-#'/]{4,200}$/;

export default async function handler(req, res) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    // Rate limit by IP
    const ip =
      req.headers["x-forwarded-for"]?.split(",")[0]?.trim() ||
      req.socket?.remoteAddress ||
      "unknown";
    if (isRateLimited(ip)) {
      return res.status(429).json({ error: "Too many requests" });
    }

    const q = (req.query.q || "").trim();

    if (q.length < 4) {
      return res.status(200).json({ results: [] });
    }

    if (!ADDRESS_RE.test(q)) {
      return res.status(400).json({ error: "Invalid query" });
    }

    const key = process.env.GOOGLE_PLACES_API_KEY;
    if (!key) {
      console.error("Missing GOOGLE_PLACES_API_KEY");
      return res.status(500).json({ error: "Server misconfiguration" });
    }

    const url =
      "https://maps.googleapis.com/maps/api/place/autocomplete/json?" +
      new URLSearchParams({
        input: q,
        components: "country:us",
        types: "address",
        key,
      });

    const r = await fetch(url);
    const j = await r.json();

    if (j.status !== "OK") {
      return res.status(200).json({ results: [] });
    }

    const results = j.predictions.map((p) => {
      const terms = p.terms || [];
      return {
        streetNumber: terms[0]?.value || "",
        streetName: terms[1]?.value || "",
        city: terms[2]?.value || "",
        state: terms[terms.length - 2]?.value || "",
        zip: "",
      };
    });

    return res.status(200).json({ results });
  } catch (err) {
    console.error("Address API error:", err.message);
    return res.status(500).json({ error: "Internal Server Error" });
  }
}
