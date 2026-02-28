// github-persist.js
// Guarda y restaura la base de datos SQLite como JSON en GitHub
// Igual que el foro anterior pero para SolarTrack

const { Octokit } = require('@octokit/rest');

const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
const GITHUB_OWNER = process.env.GITHUB_OWNER;
const GITHUB_REPO  = process.env.GITHUB_REPO;
const FILE_PATH    = 'data/solartrack-db.json';

// Solo funciona si están configuradas las variables de entorno
const enabled = !!(GITHUB_TOKEN && GITHUB_OWNER && GITHUB_REPO);

const octokit = enabled ? new Octokit({ auth: GITHUB_TOKEN }) : null;

// Leer el JSON guardado en GitHub
async function loadFromGitHub() {
  if (!enabled) return null;
  try {
    const response = await octokit.repos.getContent({
      owner: GITHUB_OWNER,
      repo:  GITHUB_REPO,
      path:  FILE_PATH,
    });
    const content = Buffer.from(response.data.content, 'base64').toString('utf-8');
    console.log('✅ DB restaurada desde GitHub');
    return { data: JSON.parse(content), sha: response.data.sha };
  } catch (error) {
    if (error.status === 404) {
      console.log('📁 No existe DB en GitHub — se usará la DB local vacía');
      return null;
    }
    console.error('❌ Error cargando DB desde GitHub:', error.message);
    return null;
  }
}

// Guardar el JSON a GitHub (crea o actualiza el archivo)
async function saveToGitHub(data, sha) {
  if (!enabled) return;
  try {
    const content = Buffer.from(JSON.stringify(data, null, 2)).toString('base64');
    await octokit.repos.createOrUpdateFileContents({
      owner:   GITHUB_OWNER,
      repo:    GITHUB_REPO,
      path:    FILE_PATH,
      message: `db: backup ${new Date().toISOString()}`,
      content: content,
      sha:     sha || undefined,
    });
  } catch (error) {
    // No interrumpir la operación principal si falla el backup
    console.error('❌ Error guardando DB en GitHub:', error.message);
  }
}

// Obtener el SHA actual del archivo (necesario para actualizarlo)
let cachedSha = null;

async function getSha() {
  if (cachedSha) return cachedSha;
  try {
    const response = await octokit.repos.getContent({
      owner: GITHUB_OWNER,
      repo:  GITHUB_REPO,
      path:  FILE_PATH,
    });
    cachedSha = response.data.sha;
    return cachedSha;
  } catch {
    return null;
  }
}

// Exportar toda la DB SQLite a un objeto JSON
async function exportDB(db) {
  try {
    const [users, access_log, events, devices, geocercas] = await Promise.all([
      db.all('SELECT * FROM users'),
      db.all('SELECT * FROM access_log ORDER BY created_at DESC LIMIT 500'),
      db.all('SELECT * FROM events ORDER BY ts DESC LIMIT 1000'),
      db.all('SELECT * FROM devices'),
      db.all('SELECT * FROM geocercas'),
    ]);
    return { users, access_log, events, devices, geocercas, exported_at: new Date().toISOString() };
  } catch (e) {
    console.error('Error exportando DB:', e.message);
    return null;
  }
}

// Importar el JSON a la DB SQLite (restaurar al arrancar)
async function importDB(db, data) {
  if (!data) return;
  try {
    // Usuarios
    for (const u of (data.users || [])) {
      const exists = await db.get('SELECT id FROM users WHERE id=?', [u.id]);
      if (!exists) {
        await db.run(
          `INSERT OR IGNORE INTO users (id, username, email, password, role, active, created_at, last_login)
           VALUES (?,?,?,?,?,?,?,?)`,
          [u.id, u.username, u.email, u.password, u.role, u.active, u.created_at, u.last_login]
        );
      }
    }

    // Access log
    for (const l of (data.access_log || [])) {
      await db.run(
        `INSERT OR IGNORE INTO access_log (id, user_id, action, ip, location, created_at)
         VALUES (?,?,?,?,?,?)`,
        [l.id, l.user_id, l.action, l.ip, l.location, l.created_at]
      );
    }

    // Eventos
    for (const e of (data.events || [])) {
      await db.run(
        `INSERT OR IGNORE INTO events
         (id, device_id, type, message, severity, address, resolved, status, attended_at, attended_by, resolved_at, resolved_by, ts)
         VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`,
        [e.id, e.device_id, e.type, e.message, e.severity, e.address,
         e.resolved, e.status||'pending', e.attended_at, e.attended_by,
         e.resolved_at, e.resolved_by, e.ts]
      );
    }

    // Geocercas
    for (const g of (data.geocercas || [])) {
      await db.run(
        `INSERT OR IGNORE INTO geocercas (id, device_id, name, type, center_lat, center_lng, radius, created_at)
         VALUES (?,?,?,?,?,?,?,?)`,
        [g.id, g.device_id, g.name, g.type, g.center_lat, g.center_lng, g.radius, g.created_at]
      );
    }

    console.log(`✅ DB importada: ${data.users?.length||0} usuarios, ${data.events?.length||0} eventos, ${data.access_log?.length||0} logins`);
  } catch (e) {
    console.error('Error importando DB:', e.message);
  }
}

// Función principal: guardar DB → GitHub (llamar después de cada write)
async function backup(db) {
  if (!enabled) return;
  try {
    const sha    = await getSha();
    const data   = await exportDB(db);
    if (!data) return;
    await saveToGitHub(data, sha);
    // Actualizar SHA cacheado
    cachedSha = null; // forzar re-fetch en próximo backup
  } catch (e) {
    console.error('backup error:', e.message);
  }
}

// Restaurar al arrancar: leer GitHub → insertar en DB local
async function restore(db) {
  if (!enabled) {
    console.log('⚠️  GitHub persist deshabilitado (faltan variables de entorno)');
    return;
  }
  const result = await loadFromGitHub();
  if (result) {
    cachedSha = result.sha;
    await importDB(db, result.data);
  }
}

module.exports = { backup, restore, enabled };
