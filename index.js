// index.js
const express = require('express');
const axios = require('axios');
const cheerio = require('cheerio');
const rateLimit = require('express-rate-limit');
const NodeCache = require('node-cache');
const cors = require('cors');

const app = express();
app.use(cors()); // in production restrict origin to your frontend domain
app.use(express.json());

const cache = new NodeCache({ stdTTL: 60*60 }); // 1 hour cache

const limiter = rateLimit({
  windowMs: 60*1000, // 1 minute
  max: 20,           // per IP
  message: { error: 'Too many requests, slow down' }
});

// helper: validate youtube url
function isYoutubeUrl(url){
  try{
    const u = new URL(url);
    return /(^|.)youtube\.com$/.test(u.hostname) || /(^|.)youtu\.be$/.test(u.hostname);
  }catch(e){
    return false;
  }
}

// try extract tags using multiple strategies
function extractFromMeta(html){
  const $ = cheerio.load(html);
  const meta = $('meta[name="keywords"]').attr('content');
  if (meta){
    return meta.split(',').map(s => s.trim()).filter(Boolean);
  }
  return [];
}

function extractFromYtInitialPlayerResponse(html){
  // look for ytInitialPlayerResponse = { ... };
  const m = html.match(/ytInitialPlayerResponse\s*=\s*({[\s\S]*?});/);
  if (m && m[1]){
    try {
      const obj = JSON.parse(m[1]);
      const kws = obj?.videoDetails?.keywords;
      if (Array.isArray(kws)) return kws.map(s=>s.trim()).filter(Boolean);
    } catch(e){
      // ignore parse errors
    }
  }
  // alternate pattern: "window["ytInitialPlayerResponse"] = {...}"
  const m2 = html.match(/window\["ytInitialPlayerResponse"\]\s*=\s*({[\s\S]*?});/);
  if (m2 && m2[1]){
    try {
      const obj = JSON.parse(m2[1]);
      const kws = obj?.videoDetails?.keywords;
      if (Array.isArray(kws)) return kws.map(s=>s.trim()).filter(Boolean);
    } catch(e){}
  }
  return [];
}

function unique(arr){ return Array.from(new Set(arr)); }

app.get('/extract-tags', limiter, async (req, res) => {
  const videoUrl = req.query.url;
  if (!videoUrl) return res.status(400).json({ error: 'Missing url query param' });
  if (!isYoutubeUrl(videoUrl)) return res.status(400).json({ error: 'Invalid YouTube URL' });

  // caching key
  const cacheKey = `tags:${videoUrl}`;
  const cached = cache.get(cacheKey);
  if (cached) return res.json({ tags: cached, source: 'cache' });

  try {
    // fetch page with a realistic user-agent
    const resp = await axios.get(videoUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; Bot/1.0; +https://example.com/bot)',
        'Accept-Language': 'en-US,en;q=0.9'
      },
      timeout: 15000
    });
    const html = resp.data;

    // strategy 1: meta keywords
    let tags = extractFromMeta(html);

    // strategy 2: ytInitialPlayerResponse JSON
    if (!tags.length) {
      tags = extractFromYtInitialPlayerResponse(html);
    }

    // final cleanup & unique
    tags = unique(tags).slice(0, 200);

    // cache result (empty array also cached briefly)
    cache.set(cacheKey, tags);

    return res.json({ tags, source: 'scrape' });
  } catch (err) {
    console.error('extract-tags error:', err.message || err);
    return res.status(500).json({ error: 'Failed to fetch or parse video page' });
  }
});

// health
app.get('/health', (req,res) => res.json({ ok: true }));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`listening on ${PORT}`));