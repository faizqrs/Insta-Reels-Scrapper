const express = require('express');
const cors = require('cors');
const scrapeRoutes = require('./routes/scrapeRoutes');
const errorHandler = require('./middleware/errorHandler');
const apiLimiter = require('./middleware/rateLimiter');

const app = express();

app.use(cors());
app.use(express.json());

app.use(apiLimiter);  // apply global rate limiter

// Health check
app.get("/", (req, res) => {
  res.send("✅ Insta Reels Scrapper API is running!");
});


app.use('/', scrapeRoutes);

app.use(errorHandler);

module.exports = app;
