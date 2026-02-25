const initSqlJs = require('sql.js');
const fs = require('fs');
const path = require('path');

const DB_PATH = path.join(__dirname, '../data/expenses.sqlite');

let db = null;

// Ensure data directory exists
const dataDir = path.dirname(DB_PATH);
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

// Initialize database
const initDb = async () => {
  if (db) return db;

  const SQL = await initSqlJs();

  // Load existing database or create new one
  if (fs.existsSync(DB_PATH)) {
    const buffer = fs.readFileSync(DB_PATH);
    db = new SQL.Database(buffer);
  } else {
    db = new SQL.Database();
  }

  // Create tables
  db.run(`
    CREATE TABLE IF NOT EXISTS expenses (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      description TEXT NOT NULL,
      amount REAL NOT NULL,
      category TEXT NOT NULL,
      date TEXT NOT NULL,
      created_at TEXT DEFAULT (datetime('now'))
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS budgets (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      month TEXT NOT NULL UNIQUE,
      amount REAL NOT NULL,
      created_at TEXT DEFAULT (datetime('now'))
    )
  `);

  // Create indexes
  db.run('CREATE INDEX IF NOT EXISTS idx_expenses_date ON expenses(date)');
  db.run('CREATE INDEX IF NOT EXISTS idx_expenses_category ON expenses(category)');
  db.run('CREATE INDEX IF NOT EXISTS idx_budgets_month ON budgets(month)');

  saveDb();
  console.log('Base de dados inicializada');

  return db;
};

// Save database to file
const saveDb = () => {
  if (db) {
    const data = db.export();
    const buffer = Buffer.from(data);
    fs.writeFileSync(DB_PATH, buffer);
  }
};

// Query helper
const query = async (sql, params = []) => {
  await initDb();

  try {
    const stmt = db.prepare(sql);
    stmt.bind(params);

    const rows = [];
    while (stmt.step()) {
      rows.push(stmt.getAsObject());
    }
    stmt.free();

    return rows;
  } catch (error) {
    console.error('SQL Error:', error.message);
    console.error('Query:', sql);
    throw error;
  }
};

// Run query (INSERT, UPDATE, DELETE)
const run = async (sql, params = []) => {
  await initDb();

  try {
    db.run(sql, params);
    saveDb();

    // Get last insert ID if it was an INSERT
    const lastId = db.exec("SELECT last_insert_rowid()")[0]?.values[0][0];
    return { lastId, changes: db.getRowsModified() };
  } catch (error) {
    console.error('SQL Error:', error.message);
    console.error('Query:', sql);
    throw error;
  }
};

module.exports = {
  initDb,
  query,
  run,
  saveDb
};
