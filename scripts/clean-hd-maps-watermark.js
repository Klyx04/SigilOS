#!/usr/bin/env node
/**
 * Retire le filigrane « DofusDB » des images HD par-map (`public/game-data/hd_maps/*.webp`).
 *
 * Pourquoi : les images officielles sont servies par le CDN DofusDB
 * (`https://api.dofusdb.fr/img/maps/1/{id}.jpg`, 1910×970) avec le filigrane
 * incrusté dans le coin bas-droit — il apparaît dans l'onglet « Tuile HD » de la
 * fiche de zone, le panneau d'analyse, le survol de la carte et le révélé de
 * Sigil Guesser. L'API n'expose aucune variante sans filigrane.
 *
 * Comment : le rectangle du filigrane (mesuré sur plusieurs mondes : x 1 727→1 890
 * et y 910→943 d'une image 1910×970, soit ≈ W−183→W−20 / H−60→H−27) est
 * **recouvert par la bande d'image située juste au-dessus** (même largeur, même
 * hauteur), avec un fondu sur les deux bords INTÉRIEURS. Le bord droit et le bord
 * bas étant ceux de l'image, il n'y a aucune couture à masquer là. Dimensions,
 * cadrage et qualité (webp 82, comme au téléchargement) sont conservés : la tuile
 * reste alignée sur la grille de jeu.
 *
 * Usage :
 *   node scripts/clean-hd-maps-watermark.js                 # tout le dossier
 *   node scripts/clean-hd-maps-watermark.js --limit 20      # passe d'essai
 *   node scripts/clean-hd-maps-watermark.js --only 5        # une image (hd_maps/5.webp)
 *   node scripts/clean-hd-maps-watermark.js --dry-run       # mesure sans écrire
 *
 * ⚠️ Les images ne sont **pas versionnées** (`/public/game-data/hd_maps/` est
 * ignoré par git) : après la passe locale, re-synchroniser le dossier sur le VPS
 * (`./scripts/sync-assets.ps1 beta hd_maps` puis `prod`) — cf. docs/MAINTENANCE.md.
 */
const fs = require('fs');
const path = require('path');
const os = require('os');
const sharp = require('sharp');

/** Parallélisme : une tuile par cœur (l'encodage webp est le coût dominant). */
const CONCURRENCY = Math.max(4, os.cpus().length);

const ROOT = path.join(__dirname, '..');
const HD_MAPS_DIR = path.join(ROOT, 'public', 'game-data', 'hd_maps');

/** Rectangle retouché, exprimé depuis le coin bas-droit (voir mesure en tête). */
const PATCH = {
    width: 300,
    height: 110,
    /** Fondu sur les bords GAUCHE et HAUT uniquement (droite/bas = bords d'image). */
    feather: 14,
    /** Durée d'encodage webp (0-6) : 2 = ~3× plus rapide que le défaut (4) pour
     *  ~2 % d'octets en plus — le lot fait 15 356 tuiles, ce compromis est mesuré. */
    effort: 2,
    quality: 82,
};

/**
 * Recouvre le filigrane d'une image HD et retourne le webp nettoyé (Buffer).
 *
 * Un SEUL décodage + un SEUL encodage : le recouvrement se fait en pixels bruts
 * (boucle JS sur ~33 000 pixels, fondu sur les bords gauche/haut). Le premier
 * jet passait par un PNG intermédiaire et coûtait ~0,42 s/image — soit 1 h 48
 * pour les 15 356 tuiles ; ici c'est ~10× plus rapide.
 */
async function stripWatermarkBuffer(input, { quality = PATCH.quality, effort = PATCH.effort } = {}) {
    const { data, info } = await sharp(input, { failOn: 'none' })
        .raw()
        .toBuffer({ resolveWithObject: true });
    const { width, height, channels } = info;
    if (!width || !height) throw new Error('dimensions illisibles');

    const patchWidth = Math.min(PATCH.width, width);
    const patchHeight = Math.min(PATCH.height, height);
    const left = width - patchWidth;
    const top = height - patchHeight;
    // Bande source : juste au-dessus du rectangle (bornée pour les très petites images).
    const sourceTop = Math.max(0, top - patchHeight);
    const feather = Math.max(1, Math.min(PATCH.feather, patchWidth, patchHeight));

    for (let y = 0; y < patchHeight; y++) {
        const fy = Math.min(1, y / feather);
        for (let x = 0; x < patchWidth; x++) {
            const alpha = fy * Math.min(1, x / feather);
            const dst = ((top + y) * width + left + x) * channels;
            const src = ((sourceTop + y) * width + left + x) * channels;
            for (let c = 0; c < channels; c++) {
                data[dst + c] = Math.round(data[src + c] * alpha + data[dst + c] * (1 - alpha));
            }
        }
    }

    return sharp(data, { raw: { width, height, channels } }).webp({ quality, effort }).toBuffer();
}

/**
 * Écrit l'image nettoyée à la place de l'original.
 *
 * Écriture **directe** (truncate + write) et non « fichier temporaire + rename » :
 * sur 15 356 images, la variante temporaire créait deux événements disque par
 * tuile et divisait le débit par 4 (surveillance antivirus Windows). Un crash en
 * pleine écriture n'abîme qu'une image, re-téléchargeable (`sync-world-hd-maps.js`).
 */
async function stripWatermarkFile(filePath) {
    const cleaned = await stripWatermarkBuffer(fs.readFileSync(filePath));
    fs.writeFileSync(filePath, cleaned);
    return cleaned.length;
}

async function main() {
    const args = process.argv.slice(2);
    const dryRun = args.includes('--dry-run');
    const limitArg = args.indexOf('--limit');
    const onlyArg = args.indexOf('--only');
    const skipArg = args.indexOf('--skip');
    const limit = limitArg >= 0 ? Number(args[limitArg + 1]) : Infinity;
    const only = onlyArg >= 0 ? `${args[onlyArg + 1]}.webp` : null;

    if (!fs.existsSync(HD_MAPS_DIR)) {
        console.error(`❌ Dossier introuvable : ${HD_MAPS_DIR}`);
        process.exit(1);
    }

    const all = only ? [only] : fs.readdirSync(HD_MAPS_DIR).filter((f) => f.endsWith('.webp'));
    const skip = skipArg >= 0 ? Number(args[skipArg + 1]) : 0;
    const files = all.slice(skip, Number.isFinite(limit) ? skip + limit : undefined);

    console.log(`\n🖼️  ${files.length} image(s) à nettoyer${dryRun ? ' (essai à blanc)' : ''}${skip ? ` (à partir de la n°${skip})` : ''}`);

    let done = 0, failed = 0, bytesOut = 0;
    const started = Date.now();

    for (let i = 0; i < files.length; i += CONCURRENCY) {
        const batch = files.slice(i, i + CONCURRENCY);
        const results = await Promise.all(batch.map(async (file) => {
            const filePath = path.join(HD_MAPS_DIR, file);
            try {
                if (dryRun) {
                    const metadata = await sharp(filePath, { failOn: 'none' }).metadata();
                    return metadata.width && metadata.height ? 0 : -1;
                }
                // Octets écrits, ou -1 en échec (jamais 0 : 0 = essai à blanc réussi).
                return await stripWatermarkFile(filePath);
            } catch {
                return -1;
            }
        }));
        for (const bytes of results) {
            if (bytes < 0) failed++;
            else {
                done++;
                bytesOut += bytes;
            }
        }
        process.stdout.write(`\r   ${Math.min(i + CONCURRENCY, files.length)}/${files.length} — ✅${done} ❌${failed}`);
    }

    const seconds = Math.round((Date.now() - started) / 1000);
    console.log(`\n\n🏆 Terminé en ${seconds}s : ✅ ${done} | ❌ ${failed}`);
    if (!dryRun) console.log(`   ${(bytesOut / 1024 / 1024).toFixed(0)} Mo réécrits (webp q${PATCH.quality})`);
    console.log('   ⚠️  Images non versionnées : re-synchroniser hd_maps sur le VPS (docs/MAINTENANCE.md).');
}

if (require.main === module) {
    main().catch((error) => {
        console.error(error);
        process.exit(1);
    });
}

module.exports = { stripWatermarkBuffer, stripWatermarkFile, PATCH };

