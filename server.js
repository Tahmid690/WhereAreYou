import express from "express";
import fetch from "node-fetch";
import mongoose from "mongoose";
import dotenv from "dotenv";

// Load environment variables
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;
const MONGODB_URI = process.env.MONGODB_URI || "mongodb://localhost:27017/location-tracker";
const IPINFO_TOKEN = process.env.IPINFO_TOKEN; // Optional: for higher rate limits

// MongoDB Connection
mongoose.connect(MONGODB_URI)
  .then(() => console.log("Connected to MongoDB"))
  .catch((err) => console.error("MongoDB connection error:", err));

// Location Schema - Updated for ipinfo.io response
const locationSchema = new mongoose.Schema({
  ip: { type: String, required: true },
  city: String,
  region: String,
  country: String,
  countryCode: String, // BD, US, etc.
  latitude: Number,
  longitude: Number,
  org: String, // ISP/Organization info
  postal: String, // Postal/ZIP code
  timezone: String,
  timestamp: { type: Date, default: Date.now },
  userAgent: String,
  referer: String
});

// Add index for better query performance
locationSchema.index({ ip: 1, timestamp: -1 });
locationSchema.index({ country: 1 });
locationSchema.index({ timestamp: -1 });

const Location = mongoose.model("Location", locationSchema);

app.use(express.static("public"));

app.get("/api/location", async (req, res) => {
  try {
    let ip =
      req.headers["x-forwarded-for"]?.split(",")[0] ||
      req.socket.remoteAddress;

    // Clean up IP (remove IPv6 prefix if present)
    if (ip?.startsWith("::ffff:")) {
      ip = ip.substring(7);
    }

    // Handle local testing: if localhost IP, fetch public IP
    if (ip === "::1" || ip?.startsWith("127.") || ip?.startsWith("::ffff:127")) {
      const ipRes = await fetch("https://api.ipify.org?format=json");
      const ipData = await ipRes.json();
      ip = ipData.ip;
    }

    // Build ipinfo.io URL with optional token
    const ipinfoUrl = IPINFO_TOKEN 
      ? `https://ipinfo.io/${ip}/json?token=${IPINFO_TOKEN}`
      : `https://ipinfo.io/${ip}/json`;

    const geoRes = await fetch(ipinfoUrl);
    const data = await geoRes.json();

    // Parse location coordinates
    const [latitude, longitude] = data.loc ? data.loc.split(',').map(Number) : [null, null];

    // Prepare location data
    const locationData = {
      ip: data.ip,
      city: data.city,
      region: data.region,
      country: data.country, // This will be country code like 'BD'
      countryCode: data.country,
      latitude,
      longitude,
      org: data.org,
      postal: data.postal,
      timezone: data.timezone,
      userAgent: req.headers['user-agent'],
      referer: req.headers['referer'] || req.headers['referrer']
    };

    // Save to MongoDB (non-blocking)
    try {
      const location = new Location(locationData);
      await location.save();
      console.log(`Location saved for IP: ${ip} - ${data.city}, ${data.country}`);
    } catch (dbError) {
      console.error("Database save error:", dbError);
      // Continue with API response even if DB save fails
    }

    // Return clean response to client
    res.json({
      ip: locationData.ip,
      city: locationData.city,
      region: locationData.region,
      country: locationData.countryCode,
      latitude: locationData.latitude,
      longitude: locationData.longitude,
      timezone: locationData.timezone,
      org: locationData.org
    });

  } catch (error) {
    console.error("API Error:", error);
    res.status(500).json({ error: "Unable to fetch location" });
  }
});


app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
  console.log(`Health check: http://localhost:${PORT}/health`);
});