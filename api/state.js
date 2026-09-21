const MAX_BYTES = 1024 * 1024;

function validWeightEntry(entry) {
  if (!entry || (typeof entry.id !== 'string' && !Number.isFinite(entry.id)) || typeof entry.date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(entry.date) || !Number.isFinite(entry.weight) || entry.weight <= 0) return false;
  const date = new Date(`${entry.date}T12:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === entry.date;
}

function validState(state) {
  return Boolean(!!state && typeof state === 'object'
    && state.program && Object.keys(state.program).length > 0 && Object.values(state.program).every(Array.isArray)
    && (state.nextDay === undefined || (typeof state.nextDay === 'string' && Array.isArray(state.program[state.nextDay])))
    && Array.isArray(state.sessions)
    && (state.weights === undefined || (Array.isArray(state.weights) && state.weights.every(validWeightEntry)))
    && (state.theme === null || state.theme === 'light' || state.theme === 'dark')
    && (state.activeWorkout === null || (typeof state.activeWorkout === 'object' && state.activeWorkout.id)));
}

function json(body, status = 200) {
  return Response.json(body, { status, headers: { 'cache-control': 'no-store' } });
}

async function readBody(request) {
  const length = Number(request.headers.get('content-length') || 0);
  if (length > MAX_BYTES) throw new Error('Payload too large');
  const text = await request.text();
  if (text.length > MAX_BYTES) throw new Error('Payload too large');
  return JSON.parse(text);
}

async function fetchState(sql) {
  const rows = await sql`SELECT revision, state FROM workout_state WHERE id = 1`;
  return rows[0] || null;
}

async function handler(request) {
  if (!process.env.DATABASE_URL) return json({ error: 'DATABASE_URL is not configured' }, 503);
  const { neon } = require('@neondatabase/serverless');
  const sql = neon(process.env.DATABASE_URL);
  await sql`CREATE TABLE IF NOT EXISTS workout_state (id INTEGER PRIMARY KEY CHECK (id = 1), revision INTEGER NOT NULL, state JSONB NOT NULL, updated_at TIMESTAMPTZ NOT NULL DEFAULT now())`;

  if (request.method === 'GET') {
    const row = await fetchState(sql);
    return json(row ? { revision: row.revision, state: row.state } : { revision: 0, state: null });
  }
  if (request.method !== 'PUT') return json({ error: 'Method not allowed' }, 405);

  let body;
  try { body = await readBody(request); } catch (error) { return json({ error: error.message === 'Payload too large' ? error.message : 'Invalid JSON' }, 400); }
  if (!Number.isInteger(body.revision) || body.revision < 0 || !validState(body.state)) return json({ error: 'Invalid state' }, 400);

  const state = JSON.stringify(body.state);
  if (body.revision === 0) {
    const inserted = await sql`INSERT INTO workout_state (id, revision, state) VALUES (1, 1, ${state}::jsonb) ON CONFLICT (id) DO NOTHING RETURNING revision, state`;
    if (inserted[0]) return json({ revision: inserted[0].revision, state: inserted[0].state });
  } else {
    const updated = await sql`UPDATE workout_state SET revision = revision + 1, state = ${state}::jsonb, updated_at = now() WHERE id = 1 AND revision = ${body.revision} RETURNING revision, state`;
    if (updated[0]) return json({ revision: updated[0].revision, state: updated[0].state });
  }
  const current = await fetchState(sql);
  return json({ revision: current ? current.revision : 0, state: current ? current.state : null }, 409);
}

module.exports = { fetch: handler, validState };
