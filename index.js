const express = require("express");
const cors = require("cors");

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());

// Root route
app.get("/", (req, res) => {
  res.send("Backend running fine on Render!");
});

// Dummy extract-tags route
app.get("/extract-tags", (req, res) => {
  const videoUrl = req.query.url;

  if (!videoUrl) {
    return res.status(400).json({ error: "Video URL is required" });
  }

  // फिलहाल dummy tags देंगे
  const tags = ["youtube", "seo", "shorts", "trending", "viral"];
  res.json({ url: videoUrl, tags });
});

// Start server
app.listen(PORT, () => {
  console.log("Server started on port " + PORT);
});