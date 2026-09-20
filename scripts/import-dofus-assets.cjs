#!/usr/bin/env node
/**
 * Import des assets « game data » (👑 god) vers le cache WebP servi par SigilOS.
 *
 *   node scripts/import-dofus-assets.cjs [options]
 *
 * Options :
 *   --src <dir>       racine des assets 2x (défaut : $DOFUS_ASSETS_DIR puis
 *                     <Bureau>/dofus_assets, résolu via le dossier utilisateur)
 *   --type <t>        items | spells | monsters | all   (défaut : all)
 *   --limit <n>       ne traite que n fichiers (test)
 *   --quality <n>     qualité WebP (défaut 85)
 *   --concurrency <n> conversions parallèles (défaut 4)
 *   --force           reconvertit même si le WebP existe déjà
 *   --dry-run         n'écrit rien, affiche seulement ce qui serait fait
 *
 * But : le proxy `/api/assets-dofus/{type}/{id}` sert d'abord le cache local
 * (`public/uploads/assets-dofus/...`) — persistant en prod via le volume
 * `assets-prod-data`. En pré-remplissant ce cache, la prod ne dépend PLUS de
 * DofusDB pour les icônes existantes (DofusDB ne reste que le dernier recours).
 *
 * Idempotent : relançable à tout moment, les fichiers déjà convertis sont ignorés.
 */
const fs = require("fs");
const os = require("os");
const path = require("path");
const sharp = require("sharp");

const SUB_DIRS = { items: "items_2x", spells: "spells_2x", monsters: "monsters_2x" };
const TARGET_DIRS = {
    items: path.join(process.cwd(), "public", "uploads", "assets-dofus", "items"),
    spells: path.join(process.cwd(), "public", "uploads", "assets-dofus", "spells"),
    monsters: path.join(process.cwd(), "public", "uploads", "assets-dofus", "monsters"),
};

function parseArgs(argv) {
    const args = { type: "all", quality: 85, concurrency: 4, force: false, dryRun: false, limit: 0 };
    for (let i = 0; i < argv.length; i++) {
        const a = argv[i];
        if (a === "--src") args.src = argv[++i];
        else if (a === "--type") args.type = argv[++i];
        else if (a === "--limit") args.limit = parseInt(argv[++i], 10) || 0;
        else if (a === "--quality") args.quality = parseInt(argv[++i], 10) || 85;
        else if (a === "--concurrency") args.concurrency = Math.max(1, parseInt(argv[++i], 10) || 4);
        else if (a === "--force") args.force = true;
        else if (a === "--dry-run") args.dryRun = true;
        else if (a === "--help" || a === "-h") args.help = true;
    }
    return args;
}

function resolveSources(args) {
    const roots = [
        args.src,
        ...String(process.env.DOFUS_ASSETS_DIR || "").split(/[;,]/),
        // Poste de dev : dump posé sur le Bureau. Aucun chemin machine en dur
        // (nom d'utilisateur / arborescence locale) — cf. docs/RULES.md §Sécurité.
        path.join(os.homedir(), "Desktop", "dofus_assets"),
    ].map((r) => (r || "").trim()).filter(Boolean);
    return [...new Set(roots)];
}

/** `sort_1234.png` (sorts) → `1234` ; sinon le nom de fichier sans extension. */
function toAssetId(fileName, type) {
    const base = fileName.replace(/\.(png|webp|jpg|jpeg)$/i, "");
    const match = base.match(/^sort_(\d+)$/i);
    if (type === "spells" && match) return match[1];
    return base;
}

async function importType(type, srcFile, targetDir, args, stats) {
    if (!fs.existsSync(srcFile)) {
        console.log(`  ⚠️  introuvable : ${srcFile}`);
        return;
    }
    if (!fs.existsSync(targetDir)) fs.mkdirSync(targetDir, { recursive: true });

    let files = fs.readdirSync(srcFile).filter((f) => /\.(png|webp|jpg|jpeg)$/i.test(f));
    if (args.limit) files = files.slice(0, args.limit);

    console.log(`\n▶ ${type} : ${files.length} fichier(s) dans ${srcFile}`);

    const queue = [...files];
    let done = 0;
    const worker = async () => {
        while (queue.length) {
            const file = queue.shift();
            const id = toAssetId(file, type);
            const target = path.join(targetDir, `${id}.webp`);
            if (!args.force && fs.existsSync(target) && fs.statSync(target).size > 50) {
                stats.skipped++;
                continue;
            }
            if (args.dryRun) {
                stats.wouldConvert++;
                continue;
            }
            try {
                await sharp(path.join(srcFile, file))
                    .webp({ quality: args.quality, effort: 2 })
                    .toFile(target);
                stats.converted++;
            } catch (err) {
                stats.failed++;
                if (stats.failed <= 5) console.warn(`  ⚠️  ${file} : ${err.message}`);
            }
            if (++done % 500 === 0) {
                process.stdout.write(`  … ${done}/${files.length} (${stats.converted} convertis)\r`);
            }
        }
    };
    await Promise.all(Array.from({ length: args.concurrency }, worker));
    process.stdout.write(" ".repeat(60) + "\r");
}

async function main() {
    const args = parseArgs(process.argv.slice(2));
    if (args.help) {
        console.log(fs.readFileSync(__filename, "utf8").split("*/")[0].replace(/^#!.*\n/, ""));
        return;
    }
    const roots = resolveSources(args);
    console.log("Racines « god » testées :\n  " + roots.join("\n  "));

    const srcRoot = roots.find((r) => fs.existsSync(r));
    if (!srcRoot) {
        console.error("❌ Aucune racine d'assets 2x trouvée (--src ou DOFUS_ASSETS_DIR).");
        process.exit(1);
    }
    console.log(`\nRacine utilisée : ${srcRoot}`);

    const types = args.type === "all" ? Object.keys(SUB_DIRS) : [args.type];
    for (const t of types) {
        if (!SUB_DIRS[t]) {
            console.error(`❌ type inconnu : ${t}`);
            process.exit(1);
        }
    }

    const stats = { converted: 0, skipped: 0, failed: 0, wouldConvert: 0 };
    for (const type of types) {
        await importType(type, path.join(srcRoot, SUB_DIRS[type]), TARGET_DIRS[type], args, stats);
    }

    console.log(
        `\n${args.dryRun ? "DRY-RUN" : "Terminé"} · ${stats.converted} converti(s) · ${stats.skipped} déjà présent(s)` +
            (stats.wouldConvert ? ` · ${stats.wouldConvert} à convertir` : "") +
            (stats.failed ? ` · ${stats.failed} échec(s)` : "")
    );
}

main().catch((err) => {
    console.error("Erreur :", err);
    process.exit(1);
});
