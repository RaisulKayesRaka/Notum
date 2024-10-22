const mysql = require("mysql2");

const connection = mysql.createConnection({
    host: "localhost",
    user: "root",
    password: "raka",
    database: "notum",
});

connection.connect((err) => {
    if (err) {
        console.log("Error when connecting to DB:", err);
    }
    console.log("Connected to the database.");
});

module.exports = connection;
