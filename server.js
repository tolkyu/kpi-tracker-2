const express  = require('express');
const Database = require('better-sqlite3');
const path     = require('path');

const app = express();
const db  = new Database(path.join(__dirname, 'data.db'));

// ── Schema ────────────────────────────────────────────────────────
db.exec(`
  CREATE TABLE IF NOT EXISTS employees (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    period_key TEXT    NOT NULL,
    name       TEXT    NOT NULL,
    done       INTEGER NOT NULL DEFAULT 0,
    own        INTEGER NOT NULL DEFAULT 0,
    l1         INTEGER NOT NULL DEFAULT 0,
    l2         INTEGER NOT NULL DEFAULT 0,
    l3         INTEGER NOT NULL DEFAULT 0,
    help       INTEGER NOT NULL DEFAULT 0,
    hdone      INTEGER NOT NULL DEFAULT 0,
    blk        INTEGER NOT NULL DEFAULT 0
  )
`);

// ── Seed sample data on first run ─────────────────────────────────
const { count } = db.prepare('SELECT COUNT(*) as count FROM employees').get();
if (count === 0) {
  const ins = db.prepare(
    'INSERT INTO employees (period_key,name,done,own,l1,l2,l3,help,hdone,blk) VALUES (?,?,?,?,?,?,?,?,?,?)'
  );
  [
    ['month-2026-05', 'Sergo',    20, 18, 0, 0, 0, 4, 4, 3],
    ['month-2026-05', 'Valentin', 22, 20, 1, 0, 0, 6, 5, 4],
    ['month-2026-05', 'Seregan',  14,  8, 5, 3, 2, 2, 1, 1],
    ['month-2026-05', 'Mary',     20, 17, 2, 1, 0, 5, 4, 3],
    ['month-2026-05', 'Danylo',    9,  4, 4, 4, 3, 1, 0, 0],
  ].forEach(r => ins.run(...r));
}

// ── Middleware ────────────────────────────────────────────────────
app.use(express.json());
app.use(express.static(__dirname));

// ── Helpers ───────────────────────────────────────────────────────
const toEmp = r => ({
  id: r.id, name: r.name,
  done: r.done, own: r.own,
  l1: r.l1, l2: r.l2, l3: r.l3,
  help: r.help, hdone: r.hdone, blk: r.blk,
});

// ── Routes ────────────────────────────────────────────────────────

// GET /api/periods/:key  — all employees for a period
app.get('/api/periods/:key', (req, res) => {
  const rows = db.prepare(
    'SELECT * FROM employees WHERE period_key = ? ORDER BY id'
  ).all(req.params.key);
  res.json(rows.map(toEmp));
});

// POST /api/employees  — add employee to a period
app.post('/api/employees', (req, res) => {
  const { periodKey, name, done, own, l1, l2, l3, help, hdone, blk } = req.body;
  const { lastInsertRowid } = db.prepare(
    'INSERT INTO employees (period_key,name,done,own,l1,l2,l3,help,hdone,blk) VALUES (?,?,?,?,?,?,?,?,?,?)'
  ).run(periodKey, name, done, own, l1, l2, l3, help, hdone, blk);
  res.json({ id: lastInsertRowid });
});

// PUT /api/employees/:id  — update employee stats
app.put('/api/employees/:id', (req, res) => {
  const { name, done, own, l1, l2, l3, help, hdone, blk } = req.body;
  db.prepare(
    'UPDATE employees SET name=?,done=?,own=?,l1=?,l2=?,l3=?,help=?,hdone=?,blk=? WHERE id=?'
  ).run(name, done, own, l1, l2, l3, help, hdone, blk, req.params.id);
  res.json({ ok: true });
});

// DELETE /api/employees/:id  — remove employee
app.delete('/api/employees/:id', (req, res) => {
  db.prepare('DELETE FROM employees WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

// ── Start ─────────────────────────────────────────────────────────
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`KPI Tracker → http://localhost:${PORT}`));
