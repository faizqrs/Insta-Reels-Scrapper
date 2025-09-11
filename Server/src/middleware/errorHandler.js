const logger = require('../utils/logger');

function errorHandler(err, req, res, next) {
  logger.error(err.stack);
  if (err.status) {
    res.status(err.status).json({ error: err.message });
  } else {
    res.status(500).json({ error: 'Internal Server Error' });
  }
}

module.exports = errorHandler;
