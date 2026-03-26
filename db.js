const fs = require("fs");
const path = require("path");
const Database = require("better-sqlite3");

const dataDirectory = path.join(__dirname, "data");
const databasePath = path.join(dataDirectory, "app.db");
const schemaPath = path.join(__dirname, "schema.sql");

if (!fs.existsSync(dataDirectory)) {
  fs.mkdirSync(dataDirectory, { recursive: true });
}

const db = new Database(databasePath);

const schemaSql = fs.readFileSync(schemaPath, "utf8");
db.exec(schemaSql);

module.exports = db;
