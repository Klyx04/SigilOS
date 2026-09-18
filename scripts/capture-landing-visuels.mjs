#!/usr/bin/env node
/**
 * Landing — capture **des figures** (`public/assets/screenshots/`).
 *
 * ── Le problème que ce script résout ───────────────────────────────────────
 * Un visuel de la landing occupe **619-718 px CSS** (`hero.tsx`, `guide.tsx` :
 * `sizes="… 640px"` / `680px`). Un écran d'app entier, capturé en 1920 CSS px
 * (donc 3840 px à `deviceScaleFactor: 2`, cf. `capture-screenshots.mjs`) puis
 * posé dans ce cadre, subit une réduction **×5** : le texte d'interface de 13 px
 * tombe à 2,5 px → vignette floue. Et **recadrer après coup n'arrange rien** :
 * rogner une capture large, c'est *zoomer* sur un fragment de l'application
 * (texte coupé en plein mot, bouton amputé) au lieu de **montrer un composant
 * entier à sa taille**.
 *
 * ── La recette (mesurée le 17/09/2026) ─────────────────────────────────────
 *   1. **Cadrer sur un composant**, pas sur une page : une ancre `data-tour`
 *      (convention du projet, cf. `src/components/tour/tour-provider.tsx`).
 *   2. **Viewport ≈ largeur du slot** (CSS px) : c'est le layout compact de
 *      l'app qui fait le cadrage — le texte garde donc **sa taille réelle**
 *      (13-14 px), exactement comme le texte de la landing.
 *   3. **`deviceScaleFactor: 2`** → le fichier fait **2× la largeur du slot**,
 *      soit 1240-1440 px. `next/image` **ne remonte jamais** une image (demande
 *      `w=1920` sur un fichier de 1180 px → renvoie du 1180 px) : un fichier
 *      trop petit est agrandi **par le navigateur** → flou côté client.
 *      Constaté sur les crops du 17/09 : hero agrandi ×1,15, guide ×1,39.
 *   4. **Masquer le chrome de dev** (`nextjs-portal` = pastille « N issues »,
 *      toasts, pastille de bas de page, orbe) : ces éléments sont `fixed`, ils
 *      polluent n'importe quel cadrage. Le curseur, lui, n'est jamais capturé
 *      par Playwright (contrairement à une capture d'écran système).
 *
 * ── Prérequis (une fois) ──────────────────────────────────────────────────
 *   npx playwright install chromium
 *   node scripts/capture-landing-visuels.mjs --login     # connexion Discord
 *   (profil persisté dans `.playwright-profile/`, partagé avec
 *    `capture-screenshots.mjs` — une seule connexion suffit pour les deux)
 *
 * ── Usage ─────────────────────────────────────────────────────────────────
 *   node scripts/capture-landing-visuels.mjs                    # les 4 figures
 *   ONLY=guide-sylvestre node scripts/capture-landing-visuels.mjs
 *   OUT_DIR=src/temp/refonte_landing/_essai node …             # essai hors public/
 *   ONLY=… URL_ROUTE=/guides/rush-sylvestre node …             # route publique
 *   BASE_URL=https://beta.sigilos.fr GUILD_ID=… node …
 *
 * ⚠️ **Un contenu qui change change de NOM de fichier** : `next/image` sert
 * `/_next/image?url=…&w=…`, une URL indépendante du contenu, donc un fichier
 * écrasé reste l'ancien dans le cache du navigateur (cf. `MAINTENANCE.md` §3e).
 * Le script **refuse** d'écrire sur un fichier présent dans `HEAD` (utiliser
 * `--force` en connaissance de cause). Les figures actuelles sont donc nommées
 * `…-2x.png` : le suffixe dit la densité du fichier.
 *
 * Après capture : recopier les dimensions imprimées dans
 * `src/lib/landing-figures.ts` (le garde-fou `tests/unit/landing-figures.test.ts`
 * lit l'en-tête PNG), puis rejouer
 * `node src/temp/refonte_landing/probe-figure-slots.mjs` : les 4 figures
 * doivent afficher « OK (aucun agrandissement) » en DPR 2.
 */

import { chromium } from "playwright";
import { execFileSync } from "node:child_process";
import { mkdirSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createInterface } from "node:readline";
import sharp from "sharp";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const BASE_URL = process.env.BASE_URL || "http://localhost:3000";
const GUILD_ID = process.env.GUILD_ID || "1290442961380835451";
const PROFILE_DIR = path.join(ROOT, ".playwright-profile");
const OUT_DIR = path.resolve(ROOT, process.env.OUT_DIR || "public/assets/screenshots");
const LOGIN_MODE = process.argv.includes("--login");
const FORCE = process.argv.includes("--force");
const ONLY = process.env.ONLY ? process.env.ONLY.split(",") : null;
const ROUTE_OVERRIDE = process.env.URL_ROUTE || null;
/** Sélecteur libre (validation / page publique sans ancre `data-tour`), ex. `ANCHOR='section:has-text("À faire")'`. */
const ANCHOR_OVERRIDE = process.env.ANCHOR || null;
/** Nombre de parents à remonter (validation / recadrage fin), remplace `figure.up`. */
const UP_OVERRIDE = process.env.UP ? Number(process.env.UP) : null;
const HEADLESS = LOGIN_MODE ? false : process.env.HEADLESS !== "0";

/** Marge autour du composant : le `main` du dashboard a ~16 px de padding de chaque côté. */
const WIDTH_PAD = 48;
const DEVICE_SCALE_FACTOR = 2;
/** Hauteur de fenêtre par défaut ; ajustée à la hauteur du composant avant capture. */
const VIEWPORT_HEIGHT = 1000;

/**
 * `anchor` = valeur d'un `data-tour` du projet ; `up` = nombre de parents à
 * remonter pour englober le composant (0 = l'ancre elle-même).
 * `slot` = largeur CSS réelle du cadre dans la landing (mesurée par
 * `src/temp/refonte_landing/probe-figure-slots.mjs`, à rejouer si la mise en
 * page change : c'est elle qui fixe la densité minimale du fichier).
 */
const FIGURES = [
    {
        name: "dashboard-guilde-2x.png",
        url: `${BASE_URL}/dashboard/${GUILD_ID}`,
        anchor: "dash-stats",
        up: 1,
        slot: 619,
        subject: "Tableau de bord — le bandeau de tête (activité, événements, progression)",
    },
    {
        name: "calendrier-sorties-2x.png",
        url: `${BASE_URL}/dashboard/${GUILD_ID}/calendar`,
        anchor: "calendar-board",
        up: 0,
        slot: 628,
        subject: "Calendrier des sorties — la semaine et une sortie planifiée",
    },
    {
        name: "missions-guilde-2x.png",
        url: `${BASE_URL}/dashboard/${GUILD_ID}/missions`,
        anchor: "missions-hall",
        up: 0,
        slot: 628,
        subject: "Missions de guilde — le hall et ses coordonnées de ralliement",
    },
    {
        name: "guide-sylvestre-2x.png",
        url: `${BASE_URL}/dashboard/${GUILD_ID}/quetes-dofus/guide/rush-sylvestre`,
        anchor: "guide-hud",
        up: 0,
        slot: 718,
        subject: "Guide Sylvestre — le HUD d'étape (position, reprise, progression)",
    },
];

/** Éléments flottants / de dev à masquer : ils se posent sur n'importe quel cadrage. */
const FLOAT_SELECTORS = [
    "nextjs-portal", // pastille de dev Next (« N issues »)
    ".support-orb",
    'div[class~="fixed"][class~="bottom-4"]',
    ".sonner-toaster",
    '[data-slot="toaster"]',
];

function ask(question) {
    const rl = createInterface({ input: process.stdin, output: process.stdout });
    return new Promise((resolve) =>
        rl.question(question, (answer) => {
            rl.close();
            resolve(answer);
        })
    );
}

/** La figure est-elle déjà versionnée ? (règle du nom neuf, cf. en-tête) */
function existsInHead(file) {
    try {
        execFileSync("git", ["cat-file", "-e", `HEAD:public/assets/screenshots/${file}`], { stdio: "ignore" });
        return true;
    } catch {
        return false;
    }
}

async function ensureLogin(page) {
    await page.goto(`${BASE_URL}/`, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(1500);
    if (/(\/login|\/api\/auth\/signin|auth\/error)/.test(page.url())) {
        console.log("\n🔐 Non connecté. Termine la connexion Discord dans la fenêtre, puis appuie sur Entrée ici.");
        await ask("   (appuie sur Entrée une fois connecté) ");
    } else {
        console.log(`\n✅ Session déjà présente (${page.url()})`);
    }
}

/** Attend du vrai contenu rendu (un dashboard encore en squelettes se capture vide). */
async function waitForContent(page) {
    await page
        .waitForFunction(
            () => {
                const main = document.querySelector('main[data-scroll-container="true"]') || document.body;
                return main.innerText.replace(/\s+/g, " ").trim().length > 40;
            },
            { timeout: 25_000 }
        )
        .catch(() => console.warn("   ⚠️ contenu non détecté après 25 s — capture quand même"));
    await page.evaluate(() => document.fonts?.ready).catch(() => {});
    await page
        .waitForFunction(() => Array.from(document.images).every((i) => i.complete), { timeout: 15_000 })
        .catch(() => {});
    await page.waitForTimeout(1200);
}

/**
 * Prépare le cadre : masque le chrome de dev **et tout ce qui flotte**.
 *
 * Un `position: fixed` échappe au flux : le rail de navigation du guide, la
 * pastille de dev Next ou une barre collée se posent par-dessus le composant
 * cadré (constaté le 17/09 : chevrons + pastille de carte dans le coin droit de
 * la figure). On masque donc tout élément `fixed`/`sticky` **sauf** la chaîne de
 * l'élément cadré (lui, ses ancêtres et ses descendants).
 */
async function hideFloating(page, target) {
    await page.evaluate(
        ({ node, extra }) => {
            for (const s of extra) {
                document.querySelectorAll(s).forEach((el) => {
                    el.style.display = "none";
                });
            }
            const keep = new Set();
            if (node) {
                keep.add(node);
                for (let n = node; n; n = n.parentElement) keep.add(n);
                node.querySelectorAll("*").forEach((d) => keep.add(d));
            }
            document.querySelectorAll("body *").forEach((el) => {
                if (keep.has(el)) return;
                const pos = getComputedStyle(el).position;
                if (pos === "fixed" || pos === "sticky") el.style.display = "none";
            });
        },
        { node: target, extra: FLOAT_SELECTORS }
    );
}

async function capture(page, figure) {
    const out = path.join(OUT_DIR, figure.name);
    const target = ROUTE_OVERRIDE ? `${BASE_URL}${ROUTE_OVERRIDE}` : figure.url;
    const viewportWidth = figure.slot + WIDTH_PAD;
    const isPublic = OUT_DIR === path.join(ROOT, "public", "assets", "screenshots");
    const selector = ANCHOR_OVERRIDE || `[data-tour="${figure.anchor}"]`;

    console.log(`\n📸 ${figure.name} — ${figure.subject}`);
    console.log(`   ${target}`);
    console.log(
        `   cadrage : ${selector}${figure.up ? ` + ${figure.up} parent(s)` : ""}` +
            ` — viewport ${viewportWidth} CSS px → fichier ${viewportWidth * DEVICE_SCALE_FACTOR} px`
    );

    if (isPublic && !FORCE && existsInHead(figure.name)) {
        console.log("   ⛔ refusé : ce nom existe déjà dans HEAD → déposer un NOUVEAU nom (règle du cache `next/image`).");
        return { name: figure.name, skipped: true };
    }

    await page.setViewportSize({ width: viewportWidth, height: VIEWPORT_HEIGHT });
    await page.goto(target, { waitUntil: "domcontentloaded", timeout: 45_000 }).catch((err) => {
        console.warn(`   ⚠️ navigation : ${String(err.message).slice(0, 80)}`);
    });
    await page.waitForLoadState("networkidle", { timeout: 20_000 }).catch(() => {});
    await waitForContent(page);

    const steps = UP_OVERRIDE ?? figure.up;
    let locator = page.locator(selector).first();
    for (let i = 0; i < steps; i += 1) {
        locator = locator.locator("xpath=..");
    }
    if ((await locator.count()) === 0) {
        throw new Error(`ancre introuvable : ${selector} sur ${page.url()} — session expirée ?`);
    }

    await hideFloating(page, await locator.elementHandle());
    await locator.scrollIntoViewIfNeeded();
    await page.waitForTimeout(600);
    const box = await locator.boundingBox();
    if (!box) throw new Error(`boîte vide pour ${selector} (élément masqué ?)`);
    const excerpt = (await locator.innerText()).replace(/\s+/g, " ").slice(0, 70);
    console.log(`   composant : ${Math.round(box.width)}×${Math.round(box.height)} CSS px — « ${excerpt} »`);

    // Fenêtre assez haute pour contenir le composant (Playwright recadre sinon).
    await page.setViewportSize({
        width: viewportWidth,
        height: Math.min(Math.max(Math.ceil(box.height) + 40, 600), 2600),
    });
    await page.waitForTimeout(300);

    mkdirSync(OUT_DIR, { recursive: true });
    await locator.screenshot({ path: out, animations: "disabled", caret: "hide", scale: "device" });

    const meta = await sharp(out).metadata();
    const need = figure.slot * DEVICE_SCALE_FACTOR;
    const verdict =
        meta.width >= need
            ? "OK (aucun agrandissement au rendu)"
            : `TROP PETIT — agrandi ×${(need / meta.width).toFixed(2)} (élargir le viewport)`;
    console.log(
        `   ✅ ${figure.name} — ${meta.width}×${meta.height} px, ${Math.round(statSync(out).size / 1024)} Ko` +
            ` — besoin ${need} px → ${verdict}`
    );
    return { name: figure.name, width: meta.width, height: meta.height, url: figure.url, subject: figure.subject };
}

async function main() {
    const context = await chromium.launchPersistentContext(PROFILE_DIR, {
        headless: HEADLESS,
        viewport: { width: 1280, height: VIEWPORT_HEIGHT },
        deviceScaleFactor: DEVICE_SCALE_FACTOR,
        locale: "fr-FR",
    });
    const page = context.pages()[0] || (await context.newPage());

    if (LOGIN_MODE) await ensureLogin(page);

    const figures = ONLY ? FIGURES.filter((f) => ONLY.some((k) => f.name.includes(k) || f.anchor === k)) : FIGURES;
    const results = [];
    for (const figure of figures) {
        try {
            results.push(await capture(page, figure));
        } catch (err) {
            console.error(`   ❌ ${figure.name} : ${err.message}`);
            results.push({ name: figure.name, error: err.message });
        }
    }
    await context.close();

    const done = results.filter((r) => r.width);
    console.log(`\n✅ ${done.length}/${figures.length} figure(s) capturée(s) dans ${OUT_DIR}`);
    if (done.length === figures.length && results.length === FIGURES.length) {
        console.log("\nDimensions à recopier dans src/lib/landing-figures.ts (width/height) :");
        for (const r of results) {
            console.log(`  ${r.name} → ${r.width}×${r.height}   // ${r.url.replace(BASE_URL, "")}`);
        }
    }
    if (results.some((r) => r.error || r.skipped)) process.exitCode = 1;
}

main().catch((err) => {
    console.error("❌ Erreur:", err);
    process.exit(1);
});
