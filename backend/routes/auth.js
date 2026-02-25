const express = require('express');
const bcrypt = require('bcryptjs');
const router = express.Router();
const db = require('../db');
const { signToken, verifyToken } = require('../middleware/auth');

// Login
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

    await db.run('UPDATE users SET last_login=CURRENT_TIMESTAMP WHERE id=?', [user.id]);
    await db.run('INSERT INTO access_log (user_id, action, ip) VALUES (?,?,?)',
      [user.id, 'login', req.ip]);

    const token = signToken({ id: user.id, username: user.username, role: user.role, email: user.email });
    res.json({ token, user: { id: user.id, username: user.username, role: user.role, email: user.email } });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Error del servidor' });
  }
});

// Me
router.get('/me', verifyToken, async (req, res) => {
  const user = await db.get(
    'SELECT id, username, email, role, created_at, last_login FROM users WHERE id=?',
    [req.user.id]
  );
  res.json(user);
});

// Logout
router.post('/logout', verifyToken, async (req, res) => {
  await db.run('INSERT INTO access_log (user_id, action, ip) VALUES (?,?,?)',
    [req.user.id, 'logout', req.ip]);
  res.json({ ok: true });
});

module.exports = router;
