const { scrapeReels } = require('../services/scraperService');

async function getReels(req, res) {
  const { username, limit } = req.query;

  try {
    const reels = await scrapeReels(username, limit ? parseInt(limit) : 10);
    res.json({ username, reels });
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message || 'Internal error' });
  }
}

module.exports = { getReels };
