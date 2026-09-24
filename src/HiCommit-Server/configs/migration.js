require('dotenv').config();

module.exports = {
  development: {
    username: process.env.MIGRATION_DB_USER || process.env.DB_USER,
    password: process.env.MIGRATION_DB_PASSWORD || process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    host: process.env.DB_HOST,
    dialect: 'mysql'
  },
  production: {
    username: process.env.MIGRATION_DB_USER || process.env.DB_USER,
    password: process.env.MIGRATION_DB_PASSWORD || process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    host: process.env.DB_HOST,
    dialect: 'mysql'
  }
};
