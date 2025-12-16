export default async function handler(req, res) {
  try {
    const q = (req.query.q || "").toString();
    if (!q || q.length < 4) {
      return res.status(200).json({ results: [] });
    }

    const key = process.env.NEXT_PUBLIC_GOOGLE_PLACES_API_KEY;
    if (!key) {
      return res.status(500).json({ error: "Google Places API key missing" });
    }

    // Autocomplete
    const autoUrl =
      "https://maps.googleapis.com/maps/api/place/autocomplete/json" +
      `?input=${encodeURIComponent(q)}` +
      "&components=country:us" +
      `&key=${encodeURIComponent(key)}`;

    const autoRes = await fetch(autoUrl);
    const autoData = await autoRes.json();

    const predictions = autoData.predictions || [];
    const results = [];

    for (const p of predictions.slice(0, 5)) {
      const detailsUrl =
        "https://maps.googleapis.com/maps/api/place/details/json" +
        `?place_id=${encodeURIComponent(p.place_id)}` +
        "&fields=address_component" +
        `&key=${encodeURIComponent(key)}`;

      const detRes = await fetch(detailsUrl);
      const detData = await detRes.json();

      const comps = detData?.result?.address_components || [];
      const get = (type) => comps.find((c) => c.types.includes(type))?.long_name;

      const streetNumber = get("street_number") || "";
      const route = get("route") || "";
      const state = get("administrative_area_level_1") || "";
      const city = get("locality") || get("sublocality") || "";
      const zip = get("postal_code") || "";

      if (!streetNumber || !route || !state) continue;

      results.push({
        streetNumber,
        streetName: route,
        state,
        city,
        zip,
      });
    }

    return res.status(200).json({ results });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ results: [] });
  }
}
