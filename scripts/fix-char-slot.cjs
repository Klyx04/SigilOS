const { Pool } = require('pg');

async function fix() {
  const pool = new Pool({ connectionString: 'postgresql://user:password@127.0.0.1:5433/sigilos' });
  
  // Set existing NULL characterSlot to "PRINCIPAL" for the default slot
  const result = await pool.query(
    'UPDATE "PlayerGuideProgress" SET "characterSlot" = \'PRINCIPAL\' WHERE "characterSlot" IS NULL'
  );
  console.log('Updated', result.rowCount, 'records with NULL characterSlot to PRINCIPAL');
  
  // Fix corrupted profileIds (containing ::)
  const { rows } = await pool.query(
    'SELECT id, "profileId", "milestoneId" FROM "PlayerGuideProgress" WHERE "profileId" LIKE \'%::%\''
  );
  console.log('Found', rows.length, 'corrupted records with :: in profileId');
  
  for (const row of rows) {
    const parts = row.profileId.split('::');
    const realProfileId = parts[0];
    const characterSlot = parts.slice(1).join('::');
    
    const existing = await pool.query(
      'SELECT id FROM "PlayerGuideProgress" WHERE "profileId" = $1 AND "milestoneId" = $2 AND "characterSlot" = $3',
      [realProfileId, row.milestoneId, characterSlot]
    );
    
    if (existing.rows.length > 0) {
      await pool.query('DELETE FROM "PlayerGuideProgress" WHERE id = $1', [row.id]);
      console.log('  Deleted duplicate:', row.id);
    } else {
      await pool.query(
        'UPDATE "PlayerGuideProgress" SET "profileId" = $1, "characterSlot" = $2 WHERE id = $3',
        [realProfileId, characterSlot, row.id]
      );
      console.log('  Fixed:', row.id, '->', realProfileId, 'slot:', characterSlot);
    }
  }
  
  console.log('Done!');
  process.exit(0);
}

fix().catch(e => { console.error(e.message); process.exit(1); });