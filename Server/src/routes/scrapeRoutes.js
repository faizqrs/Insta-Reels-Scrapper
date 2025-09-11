const express = require('express');
const { scrapeHandler } = require('../controllers/scrapeController');
const router = express.Router();

router.get('/scrape', scrapeHandler);
router.post('/scrape', scrapeHandler);

module.exports = router;
