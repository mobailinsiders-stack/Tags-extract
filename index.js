const express = require("express");
const axios = require("axios");
const cheerio = require("cheerio");
const cors = require("cors");

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());

// Root test
app.get("/", (req, res) => {
  res.send("YouTube Tag Extractor API is running!");
});

// Extract tags route
app.get("/extract-tags", async (req, res) => {
  const videoUrl = req.query.url;
  if (!videoUrl) {
    return res.status(400).json({ error: "Video URL is required" });
  }

  try {
    const { data } = await axios.get(videoUrl, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36",
      },
    });

    const $ = cheerio.load(data);
    let tags = [];

    // 1. Meta keywords
    const metaKeywords = $('meta[name="keywords"]').attr("content");
    if (metaKeywords) {
      tags = metaKeywords.split(",").map((t) => t.trim());
    }

    // 2. ytInitialPlayerResponse fallback
    if (!tags.length) {
      const script = $("script")
        .filter((i, el) => $(el).html().includes("ytInitialPlayerResponse"))
        .html();

      if (script) {
        const match = script.match(/"keywords":\s*(\[[^\]]+\])/);
        if (match) {
          try {
            tags = JSON.parse(match[1]);
          } catch (err) {
            console.error("Error parsing ytInitialPlayerResponse keywords:", err.message);
          }
        }
      }
    }

    // 3. og:video:tag fallback
    if (!tags.length) {
      $('meta[property="og:video:tag"]').each((i, el) => {
        tags.push($(el).attr("content"));
      });
    }

    if (!tags.length) {
      return res.json({ tags: [], message: "No tags found for this video" });
    }

    res.json({ tags });
  } catch (error) {
    console.error("Error fetching video page:", error.message);
    res.status(500).json({ error: "Failed to fetch video data" });
  }
});

app.listen(PORT, () => {
  console.log("Server running on port " + PORT);
});