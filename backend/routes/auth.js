const express = require('express');
const bcrypt = require('bcryptjs');
const router = express.Router();
const db = require('../db');
const { signToken, verifyToken } = require('../middleware/auth');

// Geolocalización IP usando ip-api.com (gratis, sin API key, 45 req/min)
// Devuelve "Ciudad, País" o null si falla / es IP local
async function geolocateIP(ip) {
  try {
    // IPs locales / loopback → no tienen geolocalización
    if (!ip || ip === '::1' || ip === '127.0.0.1' || ip.startsWith('192.168') || ip.startsWith('10.') || ip.startsWith('::ffff:127')) {
      return 'Red local';
    }

    // Limpiar IPv4-mapped IPv6 (::ffff:1.2.3.4 → 1.2.3.4)
    const cleanIP = ip.replace(/^::ffff:/, '');

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 3000); // 3s timeout

    const res = await fetch(
      `http://ip-api.com/json/${cleanIP}?fields=status,city,regionName,country,countryCode,query&lang=es`,
      { signal: controller.signal }
    );
    clearTimeout(timeout);

    const data = await res.json();
    if (data.status === 'success') {
      return `${data.city}, ${data.country}`;
    }
    return cleanIP; // fallback: mostrar la IP limpia
  } catch (e) {
    return null; // timeout o sin internet
  }
}

// ── Login ─────────────────────────────────────────────────────────────────────
router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) return res.status(400).json({ error: 'Credenciales requeridas' });

    const user = await db.get(
      'SELECT * FROM users WHERE (username=? OR email=?) AND active=1',
      [username, username]
    );
    if (!user) return res.status(401).json({ error: 'Usuario no encontrado' });

    const valid = await bcrypt.compare(password, user.password);
    if (!valid) return res.status(401).json({ error: 'Contraseña incorrecta' });

    // Obtener IP real (Render/nginx pueden usar X-Forwarded-For)
    const rawIP = req.headers['x-forwarded-for']?.split(',')[0].trim() || req.ip;

    // Geolocalizar en background — no bloquea el login
    geolocateIP(rawIP).then(location => {
      db.run(
        'INSERT INTO access_log (user_id, action, ip, location) VALUES (?,?,?,?)',
        [user.id, 'login', rawIP, location]
      ).catch(() => {});
    });

    await db.run('UPDATE users SET last_login=CURRENT_TIMESTAMP WHERE id=?', [user.id]);

    const token = signToken({ id: user.id, username: user.username, role: user.role, email: user.email });
    res.json({ token, user: { id: user.id, username: user.username, role: user.role, email: user.email } });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Error del servidor' });
  }
});

// ── Me ────────────────────────────────────────────────────────────────────────
router.get('/me', verifyToken, async (req, res) => {
  const user = await db.get(
    'SELECT id, username, email, role, created_at, last_login FROM users WHERE id=?',
    [req.user.id]
  );
  res.json(user);
});

// ── Logout ────────────────────────────────────────────────────────────────────
router.post('/logout', verifyToken, async (req, res) => {
  const rawIP = req.headers['x-forwarded-for']?.split(',')[0].trim() || req.ip;
  geolocateIP(rawIP).then(location => {
    db.run(
      'INSERT INTO access_log (user_id, action, ip, location) VALUES (?,?,?,?)',
      [req.user.id, 'logout', rawIP, location]
    ).catch(() => {});
  });
  res.json({ ok: true });
});

module.exports = router;
