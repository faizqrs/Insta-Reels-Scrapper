const express = require('express');
const { getReels } = require('../controllers/scrapeController');

const router = express.Router();

router.get('/scrape', getReels);

module.exports = router;
