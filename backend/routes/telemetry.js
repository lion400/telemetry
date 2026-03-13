const express = require('express');
const router = express.Router();
const db = require('../db');

// Latest telemetry for a device
router.get('/:deviceId/latest', async (req, res) => {
  const row = await db.get(
    'SELECT * FROM telemetry WHERE device_id=? ORDER BY ts DESC LIMIT 1',
    [req.params.deviceId]
  );
  res.json(row || {});
});

// Historical telemetry
router.get('/:deviceId/history', async (req, res) => {
  const { from, to, limit = 500 } = req.query;
  let sql = 'SELECT * FROM telemetry WHERE device_id=?';
  const params = [req.params.deviceId];
  if (from) { sql += ' AND ts >= ?'; params.push(from); }
  if (to)   { sql += ' AND ts <= ?'; params.push(to); }
  sql += ' ORDER BY ts DESC LIMIT ?';
  params.push(parseInt(limit));
  const rows = await db.all(sql, params);
  res.json(rows.reverse());
});

// Battery SOC history (last 24h, grouped by hour)
router.get('/:deviceId/soc', async (req, res) => {
  const rows = await db.all(`
    SELECT strftime('%Y-%m-%dT%H:00:00', ts) as hour,
           AVG(soc) as soc,
           AVG(voltage) as voltage,
           AVG(temperature) as temperature
    FROM telemetry
    WHERE device_id=? AND ts > datetime('now', '-24 hours') AND soc IS NOT NULL
    GROUP BY hour ORDER BY hour
  `, [req.params.deviceId]);
  res.json(rows);
});

// Solar generation history (last 7 days)
router.get('/:deviceId/solar', async (req, res) => {
  const rows = await db.all(`
    SELECT strftime('%Y-%m-%dT%H:00:00', ts) as hour,
           AVG(panel_power) as panel_power,
           SUM(panel_power) / 60.0 as energy_kwh
    FROM telemetry
    WHERE device_id=? AND ts > datetime('now', '-7 days') AND panel_power IS NOT NULL
    GROUP BY hour ORDER BY hour
  `, [req.params.deviceId]);
  res.json(rows);
});

// GPS track
router.get('/:deviceId/track', async (req, res) => {
  const { hours = 24 } = req.query;
  const rows = await db.all(`
    SELECT lat, lng, speed, ts FROM telemetry
    WHERE device_id=? AND lat IS NOT NULL AND lng IS NOT NULL
      AND ts > datetime('now', '-${parseInt(hours)} hours')
    ORDER BY ts ASC
  `, [req.params.deviceId]);
  res.json(rows);
});

// Signal quality history (last 24h)
router.get('/:deviceId/signal', async (req, res) => {
  const rows = await db.all(`
    SELECT strftime('%Y-%m-%dT%H:00:00', ts) as hour,
           AVG(rssi) as rssi,
           AVG(rsrp) as rsrp,
           AVG(rsrq) as rsrq
    FROM telemetry
    WHERE device_id=? AND ts > datetime('now', '-24 hours') AND rssi IS NOT NULL
    GROUP BY hour ORDER BY hour
  `, [req.params.deviceId]);
  res.json(rows);
});

module.exports = router;
