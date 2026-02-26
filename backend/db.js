const sqlite3 = require('sqlite3').verbose();
const bcrypt = require('bcryptjs');
const path = require('path');

const DB_PATH = process.env.DB_PATH || path.join(__dirname, 'solartrack.db');
let db;

function getDb() {
  if (!db) {
    db = new sqlite3.Database(DB_PATH);
    db.run('PRAGMA journal_mode=WAL');
    db.run('PRAGMA foreign_keys=ON');
  }
  return db;
}

function run(sql, params = []) {
  return new Promise((resolve, reject) => {
    getDb().run(sql, params, function (err) {
      if (err) reject(err);
      else resolve({ lastID: this.lastID, changes: this.changes });
    });
  });
}

function all(sql, params = []) {
  return new Promise((resolve, reject) => {
    getDb().all(sql, params, (err, rows) => {
      if (err) reject(err);
      else resolve(rows);
    });
  });
}

function get(sql, params = []) {
  return new Promise((resolve, reject) => {
    getDb().get(sql, params, (err, row) => {
      if (err) reject(err);
      else resolve(row);
    });
  });
}

async function initialize() {

  // ── Usuarios ─────────────────────────────────────────────────────────────
  await run(`CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,
    email TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'operador'
      CHECK(role IN ('gerente','supervisor','operador')),
    active INTEGER DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    last_login DATETIME
  )`);

  // ── Bitácora de accesos ───────────────────────────────────────────────────
  await run(`CREATE TABLE IF NOT EXISTS access_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER,
    action TEXT,
    ip TEXT,
    location TEXT,   -- ciudad y país resuelto por geolocalización IP
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);

  // ── Grupos de paradas ─────────────────────────────────────────────────────
  await run(`CREATE TABLE IF NOT EXISTS groups (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    color TEXT DEFAULT '#1a6fff',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);

  // ── Dispositivos / Paradas ────────────────────────────────────────────────
  await run(`CREATE TABLE IF NOT EXISTS devices (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    device_id TEXT UNIQUE NOT NULL,
    imei TEXT,
    name TEXT NOT NULL,
    address TEXT,
    group_id INTEGER REFERENCES groups(id),
    lat REAL, lng REAL,
    photo_url TEXT,
    active INTEGER DEFAULT 1,
    last_seen DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);

  // ── Telemetría ────────────────────────────────────────────────────────────
  // Hardware: LFP 100Ah 12.8V + Tracer-AN G3 + Panel 350W + GV310LAU
  await run(`CREATE TABLE IF NOT EXISTS telemetry (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    device_id TEXT NOT NULL,
    ts DATETIME DEFAULT CURRENT_TIMESTAMP,
    -- GPS (GV310LAU — precisión < 2m CEP)
    lat REAL, lng REAL, speed REAL, heading REAL,
    gps_accuracy REAL,
    buffered_positions INTEGER DEFAULT 0,
    -- Batería LFP1.28KWH12.8V (nominal 12.8V, corte carga 14.4V, descarga 10.4V)
    soc INTEGER,
    voltage REAL,
    current_charge REAL,    -- A (max 100A)
    current_discharge REAL, -- A (max 150A)
    power_charge REAL,      -- W
    power_discharge REAL,   -- W
    temperature REAL,       -- °C (WMS301)
    -- Celdas individuales 4S1P (3.2V nominal cada una)
    cell_v1 REAL, cell_v2 REAL, cell_v3 REAL, cell_v4 REAL,
    -- Panel solar + MPPT Tracer-AN G3 (98% eficiencia, 3 etapas)
    panel_voltage REAL,
    panel_current REAL,
    panel_power REAL,       -- W (max 350W)
    mppt_stage TEXT,        -- Bulk | Absorción | Float
    mppt_efficiency REAL,
    -- Señal GV310LAU (LTE Cat4, bandas B1-B28, WCDMA, EGPRS)
    rssi INTEGER,
    rsrp INTEGER,
    rsrq REAL,
    snr REAL,
    lte_band TEXT,
    -- Sensores WMS301
    door1 INTEGER DEFAULT 0,
    door2 INTEGER DEFAULT 0,
    door3 INTEGER DEFAULT 0,
    door4 INTEGER DEFAULT 0,
    humidity REAL,
    -- Sistema
    uptime INTEGER
  )`);

  await run(`CREATE INDEX IF NOT EXISTS idx_tel_dev_ts ON telemetry(device_id, ts DESC)`);

  // ── Eventos ───────────────────────────────────────────────────────────────
  // Tipos según especificación: intrusion, low_battery, overtemperature,
  // power_loss, disconnect_battery, shock, geofence, weak_signal
  await run(`CREATE TABLE IF NOT EXISTS events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    device_id TEXT NOT NULL,
    type TEXT NOT NULL,
    message TEXT,
    severity TEXT DEFAULT 'info'
      CHECK(severity IN ('info','warning','critical')),
    address TEXT,
    resolved INTEGER DEFAULT 0,
    ts DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);

  await run(`CREATE INDEX IF NOT EXISTS idx_events_dev_ts ON events(device_id, ts DESC)`);

  // ── Geocercas ─────────────────────────────────────────────────────────────
  await run(`CREATE TABLE IF NOT EXISTS geocercas (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    device_id TEXT NOT NULL,
    name TEXT,
    type TEXT DEFAULT 'circle' CHECK(type IN ('circle','polygon')),
    center_lat REAL, center_lng REAL,
    radius REAL,
    polygon TEXT,  -- JSON array de coords para polígono
    active INTEGER DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);

  // ── Contactos de alerta (email + WhatsApp) ────────────────────────────────
  await run(`CREATE TABLE IF NOT EXISTS alert_contacts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    email TEXT,
    whatsapp TEXT,           -- número E.164, ej: +593987654321
    event_types TEXT DEFAULT '[]',  -- JSON array de tipos de evento
    active INTEGER DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);

  // ── Seed inicial ──────────────────────────────────────────────────────────
  const existingUser = await get('SELECT id FROM users WHERE username=?', ['admin']);
  if (!existingUser) {
    const hash = await bcrypt.hash('Admin2024!', 12);
    await run('INSERT INTO users (username,email,password,role) VALUES (?,?,?,?)',
      ['admin', 'admin@emov.gob.ec', hash, 'gerente']);

    // Grupos de paradas
    await run("INSERT INTO groups (name,color) VALUES ('Norte','#1a6fff')");
    await run("INSERT INTO groups (name,color) VALUES ('Sur','#00d4ff')");
    await run("INSERT INTO groups (name,color) VALUES ('Centro','#00e676')");

    // Paradas — La Troncal, Cañar, Ecuador
    // HMH3+675 → Parada 01 (norte), HMG5+29V → Parada 02 (centro)
    const stops = [
      ['GV310-EC-4471','863286020377033','Parada 01 - Terminal Terrestre', 'Av. 25 de Agosto y Av. Olmedo',           1, -2.4128, -79.3441],
      ['GV310-EC-4472','863286020377034','Parada 02 - Parque Central',     'Calle 4 de Noviembre y Manuel J. Calle',  3, -2.4204, -79.3437],
      ['GV310-EC-4473','863286020377035','Parada 03 - Mercado Municipal',  'Av. Olmedo y Calle 7',                    1, -2.4185, -79.3458],
      ['GV310-EC-4474','863286020377036','Parada 04 - Hospital La Troncal','Av. 3 de Noviembre s/n',                  2, -2.4230, -79.3412],
      ['GV310-EC-4475','863286020377037','Parada 05 - Colegio Técnico',    'Av. Panamericana y Calle 12',             2, -2.4162, -79.3395],
      ['GV310-EC-4476','863286020377038','Parada 06 - Barrio La Merced',   'Calle Sucre y Av. 6 de Enero',            3, -2.4251, -79.3470],
      ['GV310-EC-4477','863286020377039','Parada 07 - Ingreso Norte',      'Vía La Troncal - El Triunfo km 1',        1, -2.4095, -79.3428],
      ['GV310-EC-4478','863286020377040','Parada 08 - Barrio Los Pinos',   'Av. Los Pinos y Calle 15',                2, -2.4278, -79.3388],
    ];

    for (const s of stops) {
      await run('INSERT INTO devices (device_id,imei,name,address,group_id,lat,lng) VALUES (?,?,?,?,?,?,?)', s);
      // Geocerca circular de 50m por parada (configuración inicial)
      await run(`INSERT INTO geocercas (device_id,name,type,center_lat,center_lng,radius)
                 VALUES (?,?,?,?,?,?)`,
        [s[0], `Zona ${s[2]}`, 'circle', s[5], s[6], 50]);
    }

    // Contacto de alerta demo
    await run(`INSERT INTO alert_contacts (name,email,whatsapp,event_types)
               VALUES (?,?,?,?)`,
      ['Operaciones EMOV', 'operaciones@emov.gob.ec', '+593987654321',
       JSON.stringify(['intrusion','low_battery','power_loss','overtemperature'])]);
  }
}

module.exports = { initialize, run, all, get, getDb };
