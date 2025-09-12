const dotenv = require('dotenv').config();
const app = require('./app');
const logger = require('./src/utils/logger');

const port = process.env.PORT || 8080;

app.listen(port, () => {
  logger.info(`Server running on port ${port}`);
});
