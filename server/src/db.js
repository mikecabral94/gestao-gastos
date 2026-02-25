const { Pool } = require('pg');
const initSqlJs = require('sql.js');
const fs = require('fs');
const path = require('path');

// Check if we're using PostgreSQL (production) or SQLite (local)
const usePostgres = !!process.env.DATABASE_URL;

// PostgreSQL pool
let pgPool = null;

// SQLite database
let sqliteDb = null;
const DB_PATH = path.join(__dirname, '../data/expenses.sqlite');

// Ensure data directory exists for SQLite
if (!usePostgres) {
  const dataDir = path.dirname(DB_PATH);
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }
}

// Initialize database
const initDb = async () => {
  if (usePostgres) {
    // PostgreSQL initialization
    if (pgPool) return pgPool;

    pgPool = new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: { rejectUnauthorized: false }
    });

    // Create tables
    await pgPool.query(`
      CREATE TABLE IF NOT EXISTS expenses (
        id SERIAL PRIMARY KEY,
        description TEXT NOT NULL,
        amount REAL NOT NULL,
        category TEXT NOT NULL,
        date TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT NOW()
      )
    `);

    await pgPool.query(`
      CREATE TABLE IF NOT EXISTS budgets (
        id SERIAL PRIMARY KEY,
        month TEXT NOT NULL UNIQUE,
        amount REAL NOT NULL,
        created_at TIMESTAMP DEFAULT NOW()
      )
    `);

    // Create indexes
    await pgPool.query('CREATE INDEX IF NOT EXISTS idx_expenses_date ON expenses(date)');
    await pgPool.query('CREATE INDEX IF NOT EXISTS idx_expenses_category ON expenses(category)');
    await pgPool.query('CREATE INDEX IF NOT EXISTS idx_budgets_month ON budgets(month)');

    console.log('PostgreSQL database initialized');
    return pgPool;
  } else {
    // SQLite initialization
    if (sqliteDb) return sqliteDb;

    const SQL = await initSqlJs();

    if (fs.existsSync(DB_PATH)) {
      const buffer = fs.readFileSync(DB_PATH);
      sqliteDb = new SQL.Database(buffer);
    } else {
      sqliteDb = new SQL.Database();
    }

    sqliteDb.run(`
      CREATE TABLE IF NOT EXISTS expenses (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        description TEXT NOT NULL,
        amount REAL NOT NULL,
        category TEXT NOT NULL,
        date TEXT NOT NULL,
        created_at TEXT DEFAULT (datetime('now'))
      )
    `);

    sqliteDb.run(`
      CREATE TABLE IF NOT EXISTS budgets (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        month TEXT NOT NULL UNIQUE,
        amount REAL NOT NULL,
        created_at TEXT DEFAULT (datetime('now'))
      )
    `);

    sqliteDb.run('CREATE INDEX IF NOT EXISTS idx_expenses_date ON expenses(date)');
    sqliteDb.run('CREATE INDEX IF NOT EXISTS idx_expenses_category ON expenses(category)');
    sqliteDb.run('CREATE INDEX IF NOT EXISTS idx_budgets_month ON budgets(month)');

    saveDb();
    console.log('SQLite database initialized');
    return sqliteDb;
  }
};

// Save SQLite database to file
const saveDb = () => {
  if (!usePostgres && sqliteDb) {
    const data = sqliteDb.export();
    const buffer = Buffer.from(data);
    fs.writeFileSync(DB_PATH, buffer);
  }
};

// Query helper
const query = async (sql, params = []) => {
  await initDb();

  if (usePostgres) {
    // Convert ? placeholders to $1, $2, etc for PostgreSQL
    let paramIndex = 0;
    const pgSql = sql.replace(/\?/g, () => `$${++paramIndex}`);

    try {
      const result = await pgPool.query(pgSql, params);
      return result.rows;
    } catch (error) {
      console.error('SQL Error:', error.message);
      console.error('Query:', pgSql);
      throw error;
    }
  } else {
    try {
      const stmt = sqliteDb.prepare(sql);
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
  }
};

// Run query (INSERT, UPDATE, DELETE)
const run = async (sql, params = []) => {
  await initDb();

  if (usePostgres) {
    // Convert ? placeholders to $1, $2, etc for PostgreSQL
    let paramIndex = 0;
    let pgSql = sql.replace(/\?/g, () => `$${++paramIndex}`);

    // Add RETURNING id for INSERT statements
    if (pgSql.trim().toUpperCase().startsWith('INSERT') && !pgSql.toUpperCase().includes('RETURNING')) {
      pgSql += ' RETURNING id';
    }

    try {
      const result = await pgPool.query(pgSql, params);
      return {
        lastId: result.rows[0]?.id,
        changes: result.rowCount
      };
    } catch (error) {
      console.error('SQL Error:', error.message);
      console.error('Query:', pgSql);
      throw error;
    }
  } else {
    try {
      sqliteDb.run(sql, params);
      saveDb();

      const lastId = sqliteDb.exec("SELECT last_insert_rowid()")[0]?.values[0][0];
      return { lastId, changes: sqliteDb.getRowsModified() };
    } catch (error) {
      console.error('SQL Error:', error.message);
      console.error('Query:', sql);
      throw error;
    }
  }
};

module.exports = {
  initDb,
  query,
  run,
  saveDb
};
