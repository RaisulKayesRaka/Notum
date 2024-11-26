require("dotenv").config();
const mysql = require("mysql2");

const connection = mysql.createConnection({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
});

connection.connect((err) => {
  if (err) {
    console.log("Error when connecting to DB:", err);
  }
  console.log("Connected to the database.");
  console.log("Open your browser and go to http://localhost:3000");
});

module.exports = connection;
