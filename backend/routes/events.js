const express = require('express');
const router = express.Router();
const db = require('../db');

// List events with filters
router.get('/', async (req, res) => {
  try {
    const { device_id, type, severity, from, to, limit = 200, offset = 0 } = req.query;
    let sql = `
      SELECT e.*, d.name as device_name
      FROM events e
      LEFT JOIN devices d ON e.device_id = d.device_id
      WHERE 1=1
    `;
    const params = [];
    if (device_id) { sql += ' AND e.device_id=?'; params.push(device_id); }
    if (type)      { sql += ' AND e.type=?';      params.push(type); }
    if (severity)  { sql += ' AND e.severity=?';  params.push(severity); }
    if (from)      { sql += ' AND e.ts >= ?';      params.push(from); }
    if (to)        { sql += ' AND e.ts <= ?';      params.push(to); }

    // Count total (without pagination)
    const countSql = sql.replace('SELECT e.*, d.name as device_name', 'SELECT COUNT(*) as count');
    const { count } = await db.get(countSql, params);

    sql += ' ORDER BY e.ts DESC LIMIT ? OFFSET ?';
    params.push(parseInt(limit), parseInt(offset));

    const events = await db.all(sql, params);
    res.json({ events, total: count });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: e.message });
  }
});

// Resolve event
router.put('/:id/resolve', async (req, res) => {
  await db.run('UPDATE events SET resolved=1 WHERE id=?', [req.params.id]);
  res.json({ ok: true });
});

// Create event manually (for testing)
router.post('/', async (req, res) => {
  const { device_id, type, message, severity, address } = req.body;
  const result = await db.run(
    'INSERT INTO events (device_id, type, message, severity, address) VALUES (?,?,?,?,?)',
    [device_id, type, message, severity || 'info', address]
  );
  res.json({ id: result.lastID });
});

module.exports = router;
