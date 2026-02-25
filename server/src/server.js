const express = require('express');
const cors = require('cors');
const db = require('./db');

const app = express();
const PORT = process.env.PORT || 3002;

// Middleware
app.use(cors());
app.use(express.json());

// Initialize database on startup
db.initDb().then(() => {
  console.log('Base de dados pronta');
});

// ==================== EXPENSES ====================

// Get all expenses (with optional filters)
app.get('/api/expenses', async (req, res) => {
  try {
    const { month, category } = req.query;

    let sql = 'SELECT * FROM expenses WHERE 1=1';
    const params = [];

    if (month) {
      sql += ' AND date LIKE ?';
      params.push(`${month}%`);
    }

    if (category) {
      sql += ' AND category = ?';
      params.push(category);
    }

    sql += ' ORDER BY date DESC, id DESC';

    const expenses = await db.query(sql, params);
    res.json(expenses);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get single expense
app.get('/api/expenses/:id', async (req, res) => {
  try {
    const expenses = await db.query('SELECT * FROM expenses WHERE id = ?', [req.params.id]);

    if (expenses.length === 0) {
      return res.status(404).json({ error: 'Despesa nao encontrada' });
    }

    res.json(expenses[0]);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Create expense
app.post('/api/expenses', async (req, res) => {
  try {
    const { description, amount, category, date } = req.body;

    if (!description || !amount || !category || !date) {
      return res.status(400).json({ error: 'Todos os campos sao obrigatorios' });
    }

    const result = await db.run(
      'INSERT INTO expenses (description, amount, category, date) VALUES (?, ?, ?, ?)',
      [description, amount, category, date]
    );

    const expense = await db.query('SELECT * FROM expenses WHERE id = ?', [result.lastId]);
    res.status(201).json(expense[0]);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Update expense
app.put('/api/expenses/:id', async (req, res) => {
  try {
    const { description, amount, category, date } = req.body;
    const { id } = req.params;

    // Check if expense exists
    const existing = await db.query('SELECT id FROM expenses WHERE id = ?', [id]);
    if (existing.length === 0) {
      return res.status(404).json({ error: 'Despesa nao encontrada' });
    }

    await db.run(
      'UPDATE expenses SET description = ?, amount = ?, category = ?, date = ? WHERE id = ?',
      [description, amount, category, date, id]
    );

    const expense = await db.query('SELECT * FROM expenses WHERE id = ?', [id]);
    res.json(expense[0]);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Delete expense
app.delete('/api/expenses/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const existing = await db.query('SELECT id FROM expenses WHERE id = ?', [id]);
    if (existing.length === 0) {
      return res.status(404).json({ error: 'Despesa nao encontrada' });
    }

    await db.run('DELETE FROM expenses WHERE id = ?', [id]);
    res.json({ message: 'Despesa eliminada' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ==================== BUDGETS ====================

// Get all budgets
app.get('/api/budgets', async (req, res) => {
  try {
    const budgets = await db.query('SELECT * FROM budgets ORDER BY month DESC');
    res.json(budgets);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get budget for specific month
app.get('/api/budgets/:month', async (req, res) => {
  try {
    const budgets = await db.query('SELECT * FROM budgets WHERE month = ?', [req.params.month]);

    if (budgets.length === 0) {
      return res.json({ month: req.params.month, amount: 0 });
    }

    res.json(budgets[0]);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Set budget for month (create or update)
app.post('/api/budgets', async (req, res) => {
  try {
    const { month, amount } = req.body;

    if (!month || amount === undefined) {
      return res.status(400).json({ error: 'Mes e valor sao obrigatorios' });
    }

    // Check if budget exists for this month
    const existing = await db.query('SELECT id FROM budgets WHERE month = ?', [month]);

    if (existing.length > 0) {
      // Update existing
      await db.run('UPDATE budgets SET amount = ? WHERE month = ?', [amount, month]);
    } else {
      // Create new
      await db.run('INSERT INTO budgets (month, amount) VALUES (?, ?)', [month, amount]);
    }

    const budget = await db.query('SELECT * FROM budgets WHERE month = ?', [month]);
    res.json(budget[0]);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ==================== STATS ====================

// Get monthly statistics
app.get('/api/stats/:month', async (req, res) => {
  try {
    const { month } = req.params;

    // Get total spent
    const totalResult = await db.query(
      'SELECT COALESCE(SUM(amount), 0) as total FROM expenses WHERE date LIKE ?',
      [`${month}%`]
    );

    // Get budget
    const budgetResult = await db.query('SELECT amount FROM budgets WHERE month = ?', [month]);

    // Get by category
    const categoryResult = await db.query(`
      SELECT category, SUM(amount) as total
      FROM expenses
      WHERE date LIKE ?
      GROUP BY category
      ORDER BY total DESC
    `, [`${month}%`]);

    // Get expense count
    const countResult = await db.query(
      'SELECT COUNT(*) as count FROM expenses WHERE date LIKE ?',
      [`${month}%`]
    );

    res.json({
      month,
      total: totalResult[0]?.total || 0,
      budget: budgetResult[0]?.amount || 0,
      byCategory: categoryResult,
      count: countResult[0]?.count || 0
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Start server
app.listen(PORT, () => {
  console.log(`Servidor a correr na porta ${PORT}`);
  console.log(`API: http://localhost:${PORT}/api`);
});
