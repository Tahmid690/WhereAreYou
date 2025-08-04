import express from "express";
import fetch from "node-fetch";

const app = express();
const PORT = 3000;

app.use(express.static("public"));

app.get("/api/location", async (req, res) => {
  try {
    let ip =
      req.headers["x-forwarded-for"]?.split(",")[0] ||
      req.socket.remoteAddress;

  
    const geoRes = await fetch(`https://ipinfo.io/${ip}/json/`);
    const data = await geoRes.json();

    res.json({
      ip,
      city: data.city,
      region: data.region,
      country: data.country_name,
      latitude: data.latitude,
      longitude: data.longitude,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Unable to fetch location" });
  }
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
