const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('d:/VENDA/HOLOZONIC/prisma/prod.db');

db.serialize(() => {
  // Model User
  db.run(`CREATE TABLE IF NOT EXISTS User (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user TEXT UNIQUE NOT NULL,
    hash TEXT NOT NULL,
    role TEXT NOT NULL,
    googleId TEXT UNIQUE,
    refreshToken TEXT
  )`);

  // Model PotentialLead
  db.run(`CREATE TABLE IF NOT EXISTS PotentialLead (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT,
    phone TEXT,
    email TEXT,
    source TEXT,
    step INTEGER,
    data TEXT,
    createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
    updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);

  // Outros modelos (Patient, Appointment, etc)
  db.run(`CREATE TABLE IF NOT EXISTS Patient (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    cpf TEXT UNIQUE NOT NULL,
    birthDate TEXT NOT NULL,
    plan TEXT NOT NULL,
    active BOOLEAN DEFAULT 1
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS Appointment (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    patientId INTEGER NOT NULL,
    dateTime TEXT NOT NULL,
    type TEXT NOT NULL,
    status TEXT NOT NULL,
    googleEventId TEXT,
    FOREIGN KEY(patientId) REFERENCES Patient(id)
  )`);

  console.log('Database tables created manually.');
});

db.close();
