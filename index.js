const express = require("express");
const axios = require("axios");
const cheerio = require("cheerio");
const cors = require("cors");

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());

app.get("/", (req, res) => {
  res.send("YouTube Tag Extractor API is running!");
});

app.get("/extract-tags", async (req, res) => {
  const videoUrl = req.query.url;
  if (!videoUrl) {
    return res.status(400).json({ error: "Video URL is required" });
  }

  try {
    const { data: html } = await axios.get(videoUrl, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36",
      },
    });

    const $ = cheerio.load(html);
    let tags = [];

    // 1. meta keywords
    const meta = $('meta[name="keywords"]').attr("content");
    if (meta) {
      tags = meta.split(",").map((t) => t.trim());
    }

    // 2. ytInitialPlayerResponse (fallback)
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
            console.error("Error parsing ytInitialPlayerResponse:", err.message);
          }
        }
      }
    }

    // 3. og:video:tag (last fallback)
    if (!tags.length) {
      $('meta[property="og:video:tag"]').each((i, el) => {
        tags.push($(el).attr("content"));
      });
    }

    if (!tags.length) {
      return res.json({ tags: [], message: "No tags found for this video" });
    }

    res.json({ url: videoUrl, tags });
  } catch (err) {
    console.error("Error fetching:", err.message);
    res.status(500).json({ error: "Failed to fetch tags" });
  }
});

app.listen(PORT, () => {
  console.log("Server running on port " + PORT);
});