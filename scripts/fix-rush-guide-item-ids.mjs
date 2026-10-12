#!/usr/bin/env node
/**
 * Correctif CIBLÉ des tags `item` du guide `rush-sylvestre` — PAS un re-seed.
 *
 * Mesure du 10/10/2026 : le tag « Reflet onirique » portait l'id **22058**, que DofusDB ne
 * connaît pas (l'API sert alors l'item de repli 666 : icône d'un autre objet, ou placeholder
 * si la garde d'identité du siphon refuse). Le vrai objet est **32079**
 * (`?name.fr=Reflet onirique` → id 32079, iconId 164149).
 *
 * Sûreté : on ne touche QUE les tags concernés, une séquence à la fois — jamais de
 * `deleteMany` ni de re-seed (qui écraserait les éditions faites dans le studio God).
 * DRY-RUN par défaut ; `--apply` pour écrire.
 *
 * Usage (développement local) : `node scripts/fix-rush-guide-item-ids.mjs [--apply]`
 *
 * ⚠️ **Sur le VPS, ce script ne tourne PAS** : l'image *standalone* ne trace pas toutes les
 * dépendances de `@prisma/adapter-pg` (`@prisma/driver-adapter-utils` manque ⇒
 * `ERR_MODULE_NOT_FOUND`, mesuré le 10/10/2026 — les seeds échappent au problème parce
 * qu'esbuild les **bundle**). Sur un serveur, appliquer le **même** correctif en SQL (jsonb)
 * dans le conteneur de base de données : la requête exacte et la commande `psql` vivent dans
 * `docs/plans/MODULE-RUSH-SYLVESTRE.md` § B (« Correctif de données sur le VPS »).
 */
try {
  process.env.NODE_ENV ||= "development";
  await import("dotenv/config");
} catch {}
import { PrismaClient } from "@prisma/client";
import { Pool } from "pg";
import { PrismaPg } from "@prisma/adapter-pg";

/** id fautif mesuré → id correct (source : DofusDB, égalité exacte sur le nom). */
const REMAP = new Map([[22058, 32079]]);
const APPLY = process.argv.includes("--apply");

const db = new PrismaClient({ adapter: new PrismaPg(new Pool({ connectionString: process.env.DATABASE_URL })) });

const guide = await db.optimizedGuide.findUnique({
  where: { slug: "rush-sylvestre" },
  include: { milestones: { include: { sequences: true } } },
});
if (!guide) {
  console.error("guide 'rush-sylvestre' introuvable");
  process.exit(1);
}

let n = 0;
for (const ms of guide.milestones) {
  for (const s of ms.sequences) {
    const tags = Array.isArray(s.activityTags) ? s.activityTags : [];
    let changed = false;
    const next = tags.map((t) => {
      const id = Number(t?.id);
      if (t && REMAP.has(id)) {
        changed = true;
        return { ...t, id: REMAP.get(id) };
      }
      return t;
    });
    if (!changed) continue;
    n++;
    console.log(`${APPLY ? "corrigée" : "à corriger"} : ${s.subGuideName} (${s.id})`);
    if (APPLY) await db.guideSequence.update({ where: { id: s.id }, data: { activityTags: next } });
  }
}

console.log(`séquences ${APPLY ? "corrigées" : "détectées"} = ${n}`);
await db.$disconnect();
