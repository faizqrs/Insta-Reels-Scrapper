const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const scrapeRoutes = require('./src/routes/scrapeRoutes');
const logger = require('./src/utils/logger');

const app = express();

app.use(helmet());
app.use(cors());
app.use(express.json());

app.use('/', scrapeRoutes);

// Optional: global error handler middleware

module.exports = app;
