const fs = require('fs/promises');
const path = require('path');
const express = require('express');
const { Pool } = require('pg');

const app = express();
const rootDir = __dirname;
const port = Number(process.env.PORT || 3000);
const snapshotId = process.env.APP_SNAPSHOT_ID || 'default';
const databaseUrl = process.env.DATABASE_URL || '';
const pool = databaseUrl ? new Pool({ connectionString: databaseUrl }) : null;
const localDataDir = path.join(rootDir, '.data');
const localSnapshotPath = path.join(localDataDir, 'snapshot.json');

app.disable('x-powered-by');
app.use(express.json({ limit: '25mb' }));

function requireBasicAuth(req, res, next) {
  const expectedUser = process.env.BASIC_AUTH_USER || '';
  const expectedPass = process.env.BASIC_AUTH_PASSWORD || '';
  if (!expectedUser || !expectedPass || req.path === '/api/health') {
    next();
    return;
  }

  const header = req.headers.authorization || '';
  const [scheme, encoded] = header.split(' ');
  if (scheme !== 'Basic' || !encoded) {
    res.set('WWW-Authenticate', 'Basic realm="CEE ONE Billing"');
    res.status(401).send('Authentication required.');
    return;
  }

  const decoded = Buffer.from(encoded, 'base64').toString('utf8');
  const splitAt = decoded.indexOf(':');
  const user = splitAt >= 0 ? decoded.slice(0, splitAt) : '';
  const pass = splitAt >= 0 ? decoded.slice(splitAt + 1) : '';
  if (user !== expectedUser || pass !== expectedPass) {
    res.set('WWW-Authenticate', 'Basic realm="CEE ONE Billing"');
    res.status(401).send('Invalid credentials.');
    return;
  }

  next();
}

app.use(requireBasicAuth);

async function initStore() {
  if (!pool) return;
  await pool.query(`
    CREATE TABLE IF NOT EXISTS app_snapshots (
      id TEXT PRIMARY KEY,
      data JSONB NOT NULL,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
}

function validateSnapshot(payload) {
  if (!payload || typeof payload !== 'object') {
    throw new Error('Snapshot payload is required.');
  }
  if (!payload.data || typeof payload.data !== 'object') {
    throw new Error('Snapshot payload must include a data object.');
  }
}

async function readSnapshot() {
  if (pool) {
    const result = await pool.query(
      'SELECT data, updated_at FROM app_snapshots WHERE id = $1',
      [snapshotId]
    );
    const row = result.rows[0];
    return row ? { payload: row.data, updatedAt: row.updated_at.toISOString() } : null;
  }

  try {
    const raw = await fs.readFile(localSnapshotPath, 'utf8');
    return JSON.parse(raw);
  } catch (error) {
    if (error.code === 'ENOENT') return null;
    throw error;
  }
}

async function writeSnapshot(payload) {
  validateSnapshot(payload);
  if (pool) {
    const result = await pool.query(
      `INSERT INTO app_snapshots (id, data, updated_at)
       VALUES ($1, $2::jsonb, NOW())
       ON CONFLICT (id)
       DO UPDATE SET data = EXCLUDED.data, updated_at = NOW()
       RETURNING updated_at`,
      [snapshotId, JSON.stringify(payload)]
    );
    return result.rows[0].updated_at.toISOString();
  }

  await fs.mkdir(localDataDir, { recursive: true });
  const updatedAt = new Date().toISOString();
  await fs.writeFile(localSnapshotPath, JSON.stringify({ payload, updatedAt }, null, 2));
  return updatedAt;
}

app.get('/api/health', async (_req, res) => {
  try {
    if (pool) await pool.query('SELECT 1');
    res.json({
      ok: true,
      database: pool ? 'postgres' : 'local-file'
    });
  } catch (error) {
    res.status(500).json({
      ok: false,
      error: error.message
    });
  }
});

app.get('/api/snapshot', async (_req, res) => {
  try {
    const snapshot = await readSnapshot();
    res.json({
      exists: Boolean(snapshot),
      updatedAt: snapshot?.updatedAt || null,
      payload: snapshot?.payload || null
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.put('/api/snapshot', async (req, res) => {
  try {
    const updatedAt = await writeSnapshot(req.body?.payload || req.body);
    res.json({ ok: true, updatedAt });
  } catch (error) {
    res.status(400).json({ ok: false, error: error.message });
  }
});

app.use(express.static(rootDir, {
  extensions: ['html'],
  setHeaders(res, filePath) {
    if (filePath.endsWith('index.html') || filePath.endsWith('sw.js')) {
      res.setHeader('Cache-Control', 'no-cache');
    }
  }
}));

app.get(/^(?!\/api\/).*/, (_req, res) => {
  res.sendFile(path.join(rootDir, 'index.html'));
});

async function start() {
  await initStore();
  const server = app.listen(port, () => {
    console.log(`CEE ONE app running on port ${port}`);
  });

  const shutdown = async () => {
    server.close(async () => {
      if (pool) await pool.end();
      process.exit(0);
    });
  };

  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);
}

start().catch((error) => {
  console.error('Failed to start server:', error);
  process.exit(1);
});
