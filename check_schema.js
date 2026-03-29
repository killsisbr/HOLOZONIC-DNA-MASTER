const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('d:/VENDA/HOLOZONIC/prisma/prod.db');

db.all("PRAGMA table_info(Appointment)", (err, rows) => {
  if (err) {
    console.error(err);
    return;
  }
  console.log("Appointment Schema:");
  rows.forEach(row => {
    console.log(`- ${row.name} (${row.type})`);
  });
  db.close();
});
