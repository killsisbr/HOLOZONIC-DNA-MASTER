const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('d:/VENDA/HOLOZONIC/prisma/prod.db');

db.serialize(() => {
  db.run("ALTER TABLE Appointment ADD COLUMN meetLink TEXT", (err) => {
    if (err) {
      if (err.message.includes("duplicate column name")) {
        console.log("Column 'meetLink' already exists.");
      } else {
        console.error("Error adding column:", err.message);
      }
    } else {
      console.log("Column 'meetLink' added successfully to Appointment table.");
    }
    db.close();
  });
});
