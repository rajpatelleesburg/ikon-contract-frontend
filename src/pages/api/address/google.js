export default async function handler(req, res) {
  try {
    const q = (req.query.q || "").trim();

    if (q.length < 4) {
      return res.status(200).json({ results: [] });
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
      console.error("Google Places error:", j);
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
    console.error("Address API crash:", err);
    return res.status(500).json({ error: "Internal Server Error" });
  }
}