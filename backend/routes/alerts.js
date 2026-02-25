const express = require('express');
const router = express.Router();
const db = require('../db');

// List alert contacts
router.get('/contacts', async (req, res) => {
  const contacts = await db.all('SELECT * FROM alert_contacts WHERE active=1 ORDER BY name');
  res.json(contacts);
});

// Create contact
router.post('/contacts', async (req, res) => {
  const { name, email, whatsapp, event_types } = req.body;
  const result = await db.run(
    'INSERT INTO alert_contacts (name, email, whatsapp, event_types) VALUES (?,?,?,?)',
    [name, email || null, whatsapp || null, JSON.stringify(event_types || [])]
  );
  res.json({ id: result.lastID });
});

// Update contact
router.put('/contacts/:id', async (req, res) => {
  const { name, email, whatsapp, event_types } = req.body;
  await db.run(
    'UPDATE alert_contacts SET name=?, email=?, whatsapp=?, event_types=? WHERE id=?',
    [name, email, whatsapp, JSON.stringify(event_types || []), req.params.id]
  );
  res.json({ ok: true });
});

// Delete contact (soft)
router.delete('/contacts/:id', async (req, res) => {
  await db.run('UPDATE alert_contacts SET active=0 WHERE id=?', [req.params.id]);
  res.json({ ok: true });
});

module.exports = router;
