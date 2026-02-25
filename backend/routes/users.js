const express = require('express');
const bcrypt = require('bcryptjs');
const router = express.Router();
const db = require('../db');
const { requireRole } = require('../middleware/auth');

// List users (gerente + supervisor can view)
router.get('/', requireRole('gerente', 'supervisor'), async (req, res) => {
  const users = await db.all(
    'SELECT id, username, email, role, active, created_at, last_login FROM users ORDER BY role, username'
  );
  res.json(users);
});

// Create user (gerente only)
router.post('/', requireRole('gerente'), async (req, res) => {
  const { username, email, password, role } = req.body;
  if (!username || !email || !password || !role) {
    return res.status(400).json({ error: 'Todos los campos son requeridos' });
  }
  try {
    const hash = await bcrypt.hash(password, 12);
    const result = await db.run(
      'INSERT INTO users (username, email, password, role) VALUES (?,?,?,?)',
      [username, email, hash, role]
    );
    await db.run('INSERT INTO access_log (user_id, action, ip) VALUES (?,?,?)',
      [result.lastID, 'created', req.ip]);
    res.json({ id: result.lastID });
  } catch (e) {
    res.status(400).json({ error: 'El usuario o email ya existe' });
  }
});

// Toggle active/inactive (gerente only)
router.put('/:id/toggle', requireRole('gerente'), async (req, res) => {
  await db.run(
    'UPDATE users SET active = CASE WHEN active=1 THEN 0 ELSE 1 END WHERE id=?',
    [req.params.id]
  );
  const user = await db.get('SELECT id, active FROM users WHERE id=?', [req.params.id]);
  await db.run('INSERT INTO access_log (user_id, action, ip) VALUES (?,?,?)',
    [req.params.id, user.active ? 'activated' : 'deactivated', req.ip]);
  res.json({ ok: true, active: user.active });
});

// Access log (gerente only)
router.get('/access-log', requireRole('gerente'), async (req, res) => {
  const rows = await db.all(`
    SELECT l.*, u.username
    FROM access_log l
    LEFT JOIN users u ON l.user_id = u.id
    ORDER BY l.created_at DESC
    LIMIT 200
  `);
  res.json(rows);
});

module.exports = router;
