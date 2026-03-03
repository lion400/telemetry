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

// Editar usuario completo (username, email, password opcional, profile)
router.put('/:id', requireRole('gerente'), async (req, res) => {
  try {
    const { username, email, password, role, profile } = req.body;
    const updates = []
    const params = []
    if (username) { updates.push('username=?'); params.push(username) }
    if (email)    { updates.push('email=?');    params.push(email) }
    if (role)     { updates.push('role=?');     params.push(role) }
    if (profile !== undefined) { updates.push('profile=?'); params.push(JSON.stringify(profile)) }
    if (password && password.trim()) {
      const bcrypt = require('bcrypt')
      const hash = await bcrypt.hash(password, 10)
      updates.push('password=?'); params.push(hash)
    }
    if (!updates.length) return res.status(400).json({ error: 'Nada que actualizar' })
    params.push(req.params.id)
    await run(`UPDATE users SET ${updates.join(',')} WHERE id=?`, params)
    res.json({ ok: true })
  } catch(e) {
    if (e.message?.includes('UNIQUE')) return res.status(400).json({ error: 'Usuario o email ya existe' })
    res.status(500).json({ error: e.message })
  }
});


// ── PDF Reporte de usuarios (solo gerente) ─────────────────────────────────
router.get("/report/pdf", requireRole("gerente"), async (req, res) => {
  try {
    const users = await db.all(
      "SELECT u.id, u.username, u.email, u.role, u.active, u.created_at, u.last_login, u.profile, " +
      "GROUP_CONCAT(DISTINCT d.name) as devices " +
      "FROM users u " +
      "LEFT JOIN user_devices ud ON ud.user_id = u.id " +
      "LEFT JOIN devices d ON d.device_id = ud.device_id " +
      "GROUP BY u.id ORDER BY u.role, u.username", []
    )
    const now = new Date().toLocaleString("es-EC", { timeZone: "America/Guayaquil" })
    const roleLabel = { gerente: "Gerente", supervisor: "Supervisor", operador: "Operador" }
    const rows = users.map(u => {
      const profile = (() => { try { return JSON.parse(u.profile || "{}") } catch { return {} } })()
      const profileStr = Object.entries(profile).map(([k,v]) => k + ": " + v).join(", ") || "—"
      const lastLogin = u.last_login
        ? new Date(u.last_login.endsWith("Z") ? u.last_login : u.last_login + "Z")
            .toLocaleString("es-EC", { timeZone: "America/Guayaquil" })
        : "Nunca"
      const rc = { gerente: "#ffd740", supervisor: "#00d4ff", operador: "#00e676" }[u.role] || "#aaa"
      return "<tr><td>" + u.id + "</td><td><strong>" + u.username + "</strong></td><td>" + u.email + "</td>" +
        "<td><span style=\"padding:2px 8px;border-radius:12px;font-size:10px;font-weight:600;background:" + rc + "22;color:" + rc + "\">" + (roleLabel[u.role]||u.role) + "</span></td>" +
        "<td><span style=\"padding:2px 8px;border-radius:12px;font-size:10px;background:" + (u.active?"#00e67622":"#ff525222") + ";color:" + (u.active?"#00e676":"#ff5252") + "\">" + (u.active?"Activo":"Inactivo") + "</span></td>" +
        "<td style=\"font-size:11px\">" + profileStr + "</td>" +
        "<td style=\"font-size:11px\">" + (u.devices||"—") + "</td>" +
        "<td style=\"font-size:11px\">" + lastLogin + "</td></tr>"
    }).join("")
    const totals = { total: users.length, gerentes: users.filter(u=>u.role==="gerente").length,
      supervisores: users.filter(u=>u.role==="supervisor").length,
      operadores: users.filter(u=>u.role==="operador").length, activos: users.filter(u=>u.active).length }
    const html = "<!DOCTYPE html><html><head><meta charset=\"UTF-8\"><style>" +
      "body{font-family:Helvetica,Arial,sans-serif;color:#1a2a3a;margin:0;padding:24px;font-size:13px}" +
      "h1{font-size:22px;margin-bottom:4px;color:#0a1628}" +
      ".subtitle{color:#6b8ab0;font-size:12px;margin-bottom:20px}" +
      ".meta{display:flex;gap:24px;margin-bottom:20px;padding:12px 16px;background:#f4f8ff;border-radius:8px}" +
      ".mi{font-size:12px}.mi strong{display:block;font-size:20px;color:#1a6fff}" +
      "table{width:100%;border-collapse:collapse;font-size:12px}" +
      "th{background:#0a1628;color:#fff;padding:9px 12px;text-align:left;font-size:10px;letter-spacing:.5px;text-transform:uppercase}" +
      "td{padding:8px 12px;border-bottom:1px solid #e8f0fe;vertical-align:top}" +
      "tr:nth-child(even) td{background:#f8faff}" +
      ".footer{margin-top:24px;font-size:10px;color:#6b8ab0;text-align:right}" +
      ".logo{color:#DD102E;font-weight:900;font-size:24px}" +
      "</style></head><body>" +
      "<div style=\"display:flex;align-items:center;justify-content:space-between;margin-bottom:8px\">" +
        "<div class=\"logo\">EMOV · SolarTrack</div>" +
        "<div style=\"font-size:10px;color:#6b8ab0\">Generado: " + now + "</div>" +
      "</div>" +
      "<h1>Reporte de Usuarios del Sistema</h1>" +
      "<p class=\"subtitle\">Gestión de usuarios y roles — Paradas Seguras, Cuenca, Ecuador</p>" +
      "<div class=\"meta\">" +
        "<div class=\"mi\"><strong>" + totals.total + "</strong> Total</div>" +
        "<div class=\"mi\"><strong>" + totals.gerentes + "</strong> Gerentes</div>" +
        "<div class=\"mi\"><strong>" + totals.supervisores + "</strong> Supervisores</div>" +
        "<div class=\"mi\"><strong>" + totals.operadores + "</strong> Operadores</div>" +
        "<div class=\"mi\"><strong>" + totals.activos + "</strong> Activos</div>" +
      "</div>" +
      "<table><thead><tr><th>#</th><th>Usuario</th><th>Email</th><th>Rol</th><th>Estado</th><th>Perfil</th><th>Paradas</th><th>Último acceso</th></tr></thead>" +
      "<tbody>" + rows + "</tbody></table>" +
      "<div class=\"footer\">EMOV EP · SolarTrack · Cuenca, Ecuador · Confidencial</div>" +
      "</body></html>"
    res.setHeader("Content-Type", "text/html; charset=utf-8")
    res.setHeader("X-PDF-Print", "true")
    res.send(html)
  } catch(e) { res.status(500).json({ error: e.message }) }
});

module.exports = router;
