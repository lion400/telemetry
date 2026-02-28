const express = require('express');
const router = express.Router();
const db = require('../db');
const { verifyToken } = require('../middleware/auth');

// SLA por severidad
const SLA = {
  critical: { attend: 12,  resolve: 24 },  // Alto: atención ≤12h, solución ≤24h
  warning:  { attend: 48,  resolve: 48 },  // Medio: atención ≤2 días hábiles
  info:     { attend: 48,  resolve: 48 },
};

// List events with filters
router.get('/', async (req, res) => {
  try {
    const { device_id, type, severity, from, to, status, limit = 200, offset = 0 } = req.query;
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
    if (status)    { sql += ' AND e.status=?';    params.push(status); }
    if (from)      { sql += ' AND e.ts >= ?';     params.push(from); }
    if (to)        { sql += ' AND e.ts <= ?';     params.push(to); }

    const countSql = sql.replace('SELECT e.*, d.name as device_name', 'SELECT COUNT(*) as count');
    const { count } = await db.get(countSql, params);

    sql += ' ORDER BY e.ts DESC LIMIT ? OFFSET ?';
    params.push(parseInt(limit), parseInt(offset));

    const events = await db.all(sql, params);

    // Agregar SLA deadlines calculados
    const enriched = events.map(ev => {
      const sla = SLA[ev.severity] || SLA.info;
      const ts = new Date(ev.ts.endsWith('Z') ? ev.ts : ev.ts + 'Z').getTime();
      return {
        ...ev,
        sla_attend_deadline: new Date(ts + sla.attend * 3600000).toISOString(),
        sla_resolve_deadline: new Date(ts + sla.resolve * 3600000).toISOString(),
        sla_attend_hours: sla.attend,
        sla_resolve_hours: sla.resolve,
      };
    });

    res.json({ events: enriched, total: count });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: e.message });
  }
});

// Operador marca "Atendiendo"
router.put('/:id/attend', verifyToken, async (req, res) => {
  try {
    await db.run(
      `UPDATE events SET status='attending', attended_at=CURRENT_TIMESTAMP, attended_by=? WHERE id=?`,
      [req.user.username, req.params.id]
    );
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Operador marca "Resuelto"
router.put('/:id/resolve', verifyToken, async (req, res) => {
  try {
    await db.run(
      `UPDATE events SET status='resolved', resolved=1, resolved_at=CURRENT_TIMESTAMP, resolved_by=? WHERE id=?`,
      [req.user.username, req.params.id]
    );
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Crear evento manualmente
router.post('/', async (req, res) => {
  const { device_id, type, message, severity, address } = req.body;
  const result = await db.run(
    'INSERT INTO events (device_id, type, message, severity, address) VALUES (?,?,?,?,?)',
    [device_id, type, message, severity || 'info', address]
  );
  res.json({ id: result.lastID });
});

module.exports = router;
