const scraperService = require('../services/scraperService');

async function scrapeHandler(req, res, next) {
  const { username, limit } = req.method === 'POST' ? req.body : req.query;

  if (!username) {
    return res.status(400).json({ error: 'Username is required' });
  }

  const reelLimit = Math.min(parseInt(limit) || 5, parseInt(process.env.MAX_REELS_LIMIT) || 30);

  try {
    const reels = await scraperService.scrapeReels(username, reelLimit);
    if (!reels.length) {
      return res.status(404).json({ error: 'No public reels found or profile is private' });
    }
    res.json({ username, reels });
  } catch (err) {
    console.error('Error in scrapeHandler:', err); // log error
    res.status(err.status || 500).json({ error: err.message || 'Internal Server Error' });
  }
}


module.exports = { scrapeHandler };
