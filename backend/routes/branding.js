const express = require('express');
const router = express.Router();
const db = require('../db');
const { verifyToken, requireRole } = require('../middleware/auth');

// Public — frontend needs branding before login
router.get('/', async (req, res) => {
  try {
    const branding = await db.getBranding();
    res.json(branding);
  } catch (e) {
    res.json({
      app_name: 'SolarTrack',
      org_name: 'EMOV — Paradas Seguras',
      primary_color: '#1a6fff',
      logo_url: '',
      favicon_url: '',
      cover_url: '',
    });
  }
});

// Protected — only gerente can update
router.put('/', verifyToken, requireRole('gerente'), async (req, res) => {
  const allowed = ['app_name', 'org_name', 'primary_color', 'logo_url', 'favicon_url', 'cover_url', 'active_theme', 'user_form_fields', 'user_active_fields'];
  for (const [key, value] of Object.entries(req.body)) {
    if (allowed.includes(key)) {
      await db.run('INSERT OR REPLACE INTO branding (key, value) VALUES (?,?)', [key, String(value)]);
    }
  }
  res.json({ ok: true });
});

module.exports = router;
