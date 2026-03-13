const express = require('express');
const router = express.Router();
const db = require('../db');

// List all active geocercas
router.get('/', async (req, res) => {
  const rows = await db.all('SELECT * FROM geocercas WHERE active=1 ORDER BY device_id');
  res.json(rows);
});

// Geocercas for a specific device
router.get('/:deviceId', async (req, res) => {
  const rows = await db.all(
    'SELECT * FROM geocercas WHERE device_id=? AND active=1',
    [req.params.deviceId]
  );
  res.json(rows);
});

// Create geocerca (device_id opcional)
router.post('/', async (req, res) => {
  const { device_id, name, type, center_lat, center_lng, radius, polygon } = req.body;
  const result = await db.run(
    `INSERT INTO geocercas (device_id, name, type, center_lat, center_lng, radius, polygon)
     VALUES (?,?,?,?,?,?,?)`,
    [device_id || null, name, type || 'circle', center_lat, center_lng, radius, polygon || null]
  );
  res.json({ id: result.lastID });
});

// Update geocerca
router.put('/:id', async (req, res) => {
  const { name, center_lat, center_lng, radius, polygon } = req.body;
  await db.run(
    'UPDATE geocercas SET name=?, center_lat=?, center_lng=?, radius=?, polygon=? WHERE id=?',
    [name, center_lat, center_lng, radius, polygon, req.params.id]
  );
  res.json({ ok: true });
});

// Soft delete
router.delete('/:id', async (req, res) => {
  await db.run('UPDATE geocercas SET active=0 WHERE id=?', [req.params.id]);
  res.json({ ok: true });
});

module.exports = router;