const express = require("express");
const axios = require("axios");
const cheerio = require("cheerio");
const cors = require("cors");

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());

// Add error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).send('Something broke!');
});

app.get("/", (req, res) => {
  res.send("YouTube Tag Extractor API is running!");
});

app.get("/extract-tags", async (req, res) => {
  try {
    const videoUrl = req.query.url;
    if (!videoUrl) {
      return res.status(400).json({ error: "Video URL is required" });
    }

    const { data: html } = await axios.get(videoUrl, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36"
      },
      timeout: 10000
    });

    const $ = cheerio.load(html);
    let tags = [];

    // Try multiple methods to extract tags
    const metaKeywords = $('meta[name="keywords"]').attr("content");
    if (metaKeywords) {
      tags = metaKeywords.split(",").map(t => t.trim());
    }

    // Fallback to og:video:tag
    if (tags.length === 0) {
      $('meta[property="og:video:tag"]').each((i, el) => {
        const tag = $(el).attr("content");
        if (tag) tags.push(tag);
      });
    }

    // Final fallback - look for JSON data in scripts
    if (tags.length === 0) {
      $('script').each((i, el) => {
        const scriptContent = $(el).html();
        if (scriptContent && scriptContent.includes('keywords')) {
          const match = scriptContent.match(/"keywords":\s*(\[[^\]]+\])/);
          if (match) {
            try {
              const parsedTags = JSON.parse(match[1]);
              if (Array.isArray(parsedTags)) {
                tags = parsedTags;
                return false; // Break the loop
              }
            } catch (e) {
              // Continue to next script
            }
          }
        }
      });
    }

    res.json({ url: videoUrl, tags });
  } catch (err) {
    console.error("Error:", err.message);
    res.status(500).json({ error: "Failed to fetch tags", details: err.message });
  }
});

app.listen(PORT, "0.0.0.0", () => {
  console.log(`Server running on port ${PORT}`);
});