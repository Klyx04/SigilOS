/**
 * MIGRATION DES JETONS OAuth — SigilOS (version autonome)
 * SECURITY (F-05 / audit 2026)
 * Utilise uniquement `pg` + `crypto` (déjà disponibles dans node_modules / natif node).
 * S'exécute tel quel avec `node` (pas de compilation). L'env (DATABASE_URL,
 * ENCRYPTION_KEY) vient du conteneur via docker exec.
 */
import pg from 'pg';
import { createCipheriv, scryptSync, randomBytes } from 'node:crypto';

const { Pool } = pg;
const DRY_RUN = process.argv.includes('--dry-run');
const ALG = 'aes-256-gcm', IV = 12, KL = 32;

const getKey = () => {
  const s = process.env.ENCRYPTION_KEY;
  if (!s) throw new Error('ENCRYPTION_KEY manquante - lancer via docker exec');
  return s.length === 64 ? Buffer.from(s, 'hex') : scryptSync(s, 'sigilos-salt', KL);
};
const enc = t => {
  if (!t) return t;
  const k = getKey(), iv = randomBytes(IV), c = createCipheriv(ALG, k, iv);
  let e = c.update(t, 'utf8', 'hex'); e += c.final('hex');
  return iv.toString('hex') + ':' + c.getAuthTag().toString('hex') + ':' + e;
};
const encIf = v => v.split(':').length === 3 ? v : enc(v);

async function migrate() {
  console.log('[Migration] ' + (DRY_RUN ? 'DRY-RUN (aucune modif)' : 'RUN REEL'));
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  try {
    const { rows } = await pool.query(
      'SELECT id, access_token, refresh_token, id_token FROM "Account" ' +
      "WHERE provider='discord' AND (access_token IS NOT NULL OR refresh_token IS NOT NULL OR id_token IS NOT NULL)"
    );
    let done = 0, already = 0; const upd = [];
    for (const a of rows) {
      const sets = [], vals = []; let i = 1;
      if (a.access_token) { const x = encIf(a.access_token); if (x !== a.access_token) { sets.push('access_token=$' + i++); vals.push(x); done++; } else already++; }
      if (a.refresh_token) { const x = encIf(a.refresh_token); if (x !== a.refresh_token) { sets.push('refresh_token=$' + i++); vals.push(x); done++; } else already++; }
      if (a.id_token) { const x = encIf(a.id_token); if (x !== a.id_token) { sets.push('id_token=$' + i++); vals.push(x); done++; } else already++; }
      if (sets.length) { vals.push(a.id); upd.push({ sets, vals }); }
    }
    console.log('[Migration] ' + rows.length + ' compte(s), deja chiffres: ' + already + ', A CHIFFRER: ' + done);
    if (DRY_RUN) { console.log('[Migration] DRY-RUN termine - AUCUNE modification.'); return; }
    for (const u of upd) {
      await pool.query('UPDATE "Account" SET ' + u.sets.join(', ') + ' WHERE id=$' + u.vals.length, u.vals);
    }
    console.log('[Migration] OK ' + upd.length + ' compte(s) mis a jour.');
  } finally { await pool.end(); }
}
migrate().catch(e => { console.error('[Migration] Erreur:', e.message); process.exit(1); });