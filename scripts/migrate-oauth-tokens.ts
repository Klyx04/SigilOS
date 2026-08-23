/**
 * MIGRATION DES JETONS OAuth — SigilOS
 * ===================================================================
 * SECURITY (F-05 / audit 2026)
 * ---------------------------------
 * Avant la correction, `auth.ts` écrivait les jetons Discord via
 * `updateMany` brut → ils étaient stockés EN CLAIR en base.
 * Ce script chiffre rétroactivement les jetons déjà présents.
 *
 * Usage (compilé en JS puis exécuté dans le conteneur worker qui a accès
 * à la base et aux variables d'env) :
 *   # DRY-RUN : affiche combien de jetons seraient chiffrés, SANS rien modifier
 *   node migrate-oauth-tokens.js --dry-run
 *   # RUN RÉEL : chiffre les jetons (à exécuter APRÈS un backup de la BDD)
 *   node migrate-oauth-tokens.js
 *
 * Impact utilisateur : AUCUN — les utilisateurs restent connectés.
 * NOTE : on utilise `db.$queryRaw` / `db.$executeRaw` pour contourner les
 * hooks Prisma qui chiffreraient à nouveau un jeton déjà chiffré, et on
 * réutilise le client `@/lib/prisma` (avec son adapter PostgreSQL) afin de
 * se connecter correctement à la bonne base selon l'environnement.
 */

import "dotenv/config";
import { db } from '../src/lib/prisma';
import { encrypt, isEncrypted } from '../src/lib/encryption';

const DRY_RUN = process.argv.includes('--dry-run');

interface AccountRow {
    id: string;
    access_token: string | null;
    refresh_token: string | null;
    id_token: string | null;
}

/** Chiffre un champ (appelé uniquement sur des valeurs non-null). */
function encryptIfNeeded(value: string): string {
    if (isEncrypted(value)) return value; // déjà chiffré → ne pas réchiffrer
    return encrypt(value);
}

async function migrate() {
    console.log(`[Migration] ${DRY_RUN ? 'DRY-RUN (aucune modification)' : 'RUN RÉEL'} — chiffrement des jetons OAuth en clair`);

    // Sélectionner les comptes Discord porteurs d'au moins un jeton
    const accounts = await db.$queryRaw<AccountRow[]>`
        SELECT id, access_token, refresh_token, id_token
        FROM "Account"
        WHERE provider = 'discord'
          AND (access_token IS NOT NULL OR refresh_token IS NOT NULL OR id_token IS NOT NULL)
    `;

    let toEncryptCount = 0;
    let alreadyEncrypted = 0;
    const fieldsByAccount: { id: string; access_token?: string; refresh_token?: string; id_token?: string }[] = [];

    for (const acc of accounts) {
        const update: { id: string; access_token?: string; refresh_token?: string; id_token?: string } = { id: acc.id };

        if (acc.access_token) {
            const at = encryptIfNeeded(acc.access_token);
            if (at !== acc.access_token) { update.access_token = at; toEncryptCount++; }
            else if (isEncrypted(acc.access_token)) alreadyEncrypted++;
        }
        if (acc.refresh_token) {
            const rt = encryptIfNeeded(acc.refresh_token);
            if (rt !== acc.refresh_token) { update.refresh_token = rt; toEncryptCount++; }
            else if (isEncrypted(acc.refresh_token)) alreadyEncrypted++;
        }
        if (acc.id_token) {
            const it = encryptIfNeeded(acc.id_token);
            if (it !== acc.id_token) { update.id_token = it; toEncryptCount++; }
            else if (isEncrypted(acc.id_token)) alreadyEncrypted++;
        }

        if (update.access_token !== undefined || update.refresh_token !== undefined || update.id_token !== undefined) {
            fieldsByAccount.push(update);
        }
    }

    console.log(`[Migration] ${accounts.length} compte(s) Discord avec jetons.`);
    console.log(`[Migration] Jetons déjà chiffrés : ${alreadyEncrypted}`);
    console.log(`[Migration] Jetons À CHIFFRER : ${toEncryptCount} (répartis sur ${fieldsByAccount.length} compte(s))`);

    if (DRY_RUN) {
        console.log('[Migration] DRY-RUN terminé — AUCUNE modification effectuée.');
        await db.$disconnect();
        return;
    }

    // RUN RÉEL — $executeRaw contourne les hooks Prisma (évite le double-chiffrement)
    let updated = 0;
    for (const row of fieldsByAccount) {
        await db.$executeRaw`
            UPDATE "Account"
            SET
                access_token = ${row.access_token ?? null}::text,
                refresh_token = ${row.refresh_token ?? null}::text,
                id_token = ${row.id_token ?? null}::text
            WHERE id = ${row.id}
        `;
        updated++;
    }

    console.log(`[Migration] ✅ ${updated} compte(s) mis à jour avec des jetons chiffrés.`);
    await db.$disconnect();
}

migrate().catch(async (err) => {
    console.error('[Migration] ❌ Erreur :', err);
    await db.$disconnect();
    process.exit(1);
});