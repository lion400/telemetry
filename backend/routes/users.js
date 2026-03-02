const express = require('express');
const bcrypt = require('bcryptjs');
const router = express.Router();
const db = require('../db');
const { requireRole } = require('../middleware/auth');

// List users (gerente + supervisor can view)
router.get('/', requireRole('gerente', 'supervisor'), async (req, res) => {
  const users = await db.all(
    'SELECT id, username, email, role, active, profile, created_at, last_login FROM users ORDER BY role, username'
  );
  res.json(users);
});

// Create user (gerente only)
router.post('/', requireRole('gerente'), async (req, res) => {
  const { username, email, password, role, profile } = req.body;
  if (!username || !email || !password || !role) {
    return res.status(400).json({ error: 'Todos los campos son requeridos' });
  }
  try {
    const hash = await bcrypt.hash(password, 12);
    const result = await db.run(
      'INSERT INTO users (username, email, password, role, profile) VALUES (?,?,?,?,?)',
      [username, email, hash, role, JSON.stringify(profile || {})]
    );
    await db.run('INSERT INTO access_log (user_id, action, ip) VALUES (?,?,?)',
      [result.lastID, 'created', req.ip]);
    if (req.app.locals.backup) req.app.locals.backup();
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
  if (req.app.locals.backup) req.app.locals.backup();
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

// Change role (gerente only)
router.put('/:id/role', requireRole('gerente'), async (req, res) => {
  const { role } = req.body;
  if (!['gerente', 'supervisor', 'operador'].includes(role)) {
    return res.status(400).json({ error: 'Rol inválido' });
  }
  await db.run('UPDATE users SET role=? WHERE id=?', [role, req.params.id]);
  if (req.app.locals.backup) req.app.locals.backup();
  res.json({ ok: true });
});

// Get assigned devices for a user
router.get('/:id/devices', requireRole('gerente'), async (req, res) => {
  const rows = await db.all(
    `SELECT ud.device_id, d.name, d.address, g.name as group_name
     FROM user_devices ud
     LEFT JOIN devices d ON ud.device_id = d.device_id
     LEFT JOIN groups g ON d.group_id = g.id
     WHERE ud.user_id = ?`,
    [req.params.id]
  );
  res.json(rows);
});

// Set assigned devices for a user (replaces all)
router.put('/:id/devices', requireRole('gerente'), async (req, res) => {
  const { device_ids } = req.body; // array of device_id strings
  const uid = req.params.id;
  await db.run('DELETE FROM user_devices WHERE user_id=?', [uid]);
  for (const did of (device_ids || [])) {
    await db.run('INSERT OR IGNORE INTO user_devices (user_id, device_id) VALUES (?,?)', [uid, did]);
  }
  if (req.app.locals.backup) req.app.locals.backup();
  res.json({ ok: true, assigned: device_ids?.length || 0 });
});

// Get assigned report types for a user
router.get('/:id/report-types', requireRole('gerente'), async (req, res) => {
  const rows = await db.all(
    'SELECT report_type FROM user_report_types WHERE user_id=?',
    [req.params.id]
  );
  res.json(rows.map(r => r.report_type));
});

// Set assigned report types for a user (replaces all)
router.put('/:id/report-types', requireRole('gerente'), async (req, res) => {
  const VALID = ['telemetria', 'eventos', 'alertas', 'exportaciones'];
  const { report_types } = req.body;
  const uid = req.params.id;
  await db.run('DELETE FROM user_report_types WHERE user_id=?', [uid]);
  for (const rt of (report_types || [])) {
    if (VALID.includes(rt)) {
      await db.run('INSERT OR IGNORE INTO user_report_types (user_id, report_type) VALUES (?,?)', [uid, rt]);
    }
  }
  if (req.app.locals.backup) req.app.locals.backup();
  res.json({ ok: true });
});

// Actualizar profile de usuario
router.put('/:id/profile', requireRole('gerente'), async (req, res) => {
  try {
    const { profile } = req.body;
    await run('UPDATE users SET profile=? WHERE id=?', [JSON.stringify(profile || {}), req.params.id]);
    res.json({ ok: true });
  } catch(e) {
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;
