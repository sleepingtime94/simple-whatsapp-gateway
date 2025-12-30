const mysql = require("mysql2/promise");

const pool = mysql.createPool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
});

async function logMessage(phone, message, status, session) {
  try {
    const query =
      "INSERT INTO message_logs (phone, message, status, session) VALUES (?, ?, ?, ?)";
    await pool.execute(query, [phone, message, status, session]);
    console.log(`:: Log saved: ${phone}`);
  } catch (err) {
    console.error(":: Failed to save log:", err.message);
  }
}

module.exports = { logMessage };
