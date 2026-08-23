#!/usr/bin/env node
/**
 * Capture des captures d'écran 4K pour la landing SigilOS (#80).
 *
 * Mode « capture produit » : on cadre sur la zone de contenu principale
 * (`main[data-scroll-container="true"]`, sans la sidebar ni le chrome), on masque
 * les éléments flottants (footer pill, support orb, toaster) et on produit des
 * PNG nets (viewport 1920×1080, deviceScaleFactor 2 => sortie ~3260×2160).
 *
 * ── Prérequis (une fois) ──────────────────────────────────────────────
 *   npm i -D playwright
 *   npx playwright install chromium
 *
 * ── Usage ─────────────────────────────────────────────────────────────
 *   node scripts/capture-screenshots.mjs            # BASE_URL=http://localhost:3000
 *   node scripts/capture-screenshots.mjs --login    # 1ʳᵉ fois : se connecter avec Discord
 *   GUILD_ID=1290442961380835451 node scripts/capture-screenshots.mjs
 *   BASE_URL=https://beta.sigilos.fr node scripts/capture-screenshots.mjs --login
 *   FULL_PAGE=1 node scripts/capture-screenshots.mjs   # capture pleine page (au lieu du cadrage produit)
 *   HEADLESS=1 node scripts/capture-screenshots.mjs    # sans fenêtre (session déjà dans le profil)
 *
 *   Le profil de navigation est persisté dans .playwright-profile/ (gitignoré) :
 *   la connexion Discord n'est demandée qu'une fois (mode --login).
 *
 * ── Sortie ────────────────────────────────────────────────────────────
 *   Écrase les fichiers publics de la landing :
 *   - screenshot1.png     /dashboard/{guildId}                        (hero)
 *   - guide-complet.png   /dashboard/{guildId}/quetes-dofus/guide/rush-sylvestre
 *   - screenshot3.png     /dashboard/{guildId}/calendar
 *   - screenshot6.png     /dashboard/{guildId}/missions
 */

import { chromium } from "playwright";
import { statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createInterface } from "node:readline";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const BASE_URL = process.env.BASE_URL || "http://localhost:3000";
const GUILD_ID = process.env.GUILD_ID || "1290442961380835451";
const PROFILE_DIR = path.join(ROOT, ".playwright-profile");
const OUT_DIR = path.join(ROOT, "public", "assets", "screenshots");
const HEADLESS = process.env.HEADLESS === "1";
const FULL_PAGE = process.env.FULL_PAGE === "1";
const LOGIN_MODE = process.argv.includes("--login");
// Filtre par fichier cible (ex. TARGET=screenshot1 pour re-capturer une seule page).
const TARGETS_FILTER = process.env.TARGET ? process.env.TARGET.split(",") : null;

const VIEWPORT = { width: 1920, height: 1080 };
const DEVICE_SCALE_FACTOR = 2; // => sortie ~3260×2160

// Zone de contenu principale (sidebar exclue) dans le layout dashboard.
const MAIN_SELECTOR = 'main[data-scroll-container="true"]';

// Éléments flottants à masquer pour une capture propre.
const FLOAT_SELECTORS = [
  ".support-orb", // bouton « Soutenir SigilOS » (bas droite)
  'div[class~="fixed"][class~="bottom-4"]', // footer pill compact
  ".sonner-toaster", // toasts
  '[data-slot="toaster"]',
];

const TARGETS = [
  { file: "screenshot1.png", url: `${BASE_URL}/dashboard/${GUILD_ID}`, label: "Tableau de bord (hero)", zone: "main", heightRatio: 0.85 },
  { file: "guide-complet.png", url: `${BASE_URL}/dashboard/${GUILD_ID}/quetes-dofus/guide/rush-sylvestre`, label: "Guide quête (ProductStory 1)", zone: "main", heightRatio: 0.9 },
  { file: "screenshot3.png", url: `${BASE_URL}/dashboard/${GUILD_ID}/calendar`, label: "Calendrier (ProductStory 2)", zone: "main", heightRatio: 0.85 },
  { file: "screenshot6.png", url: `${BASE_URL}/dashboard/${GUILD_ID}/missions`, label: "Missions (ProductStory 3)", zone: "main", heightRatio: 0.9 },
];

function ask(question) {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) => rl.question(question, (answer) => { rl.close(); resolve(answer); }));
}

async function ensureLogin(page) {
  await page.goto(`${BASE_URL}/`, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(1500);
  const url = page.url();
  const isLoggedOut = /(\/login|\/api\/auth\/signin|auth\/error)/.test(url);
  if (isLoggedOut) {
    console.log(`\n🔐 Non connecté. Complète la connexion Discord dans la fenêtre, puis appuie sur Entrée ici.`);
    await ask("   (appuie sur Entrée une fois connecté) ");
  } else {
    console.log(`\n✅ Session déjà présente (${url})`);
  }
}

// Attend que la zone de contenu principale ait du vrai contenu rendu (texte).
// Évite de capturer un dashboard encore vide (squelettes/loading) en dev.
async function waitForMainContent(page) {
  await page
    .waitForFunction(() => {
      const main = document.querySelector('main[data-scroll-container="true"]');
      return !!main && main.innerText.replace(/\s+/g, " ").trim().length > 40;
    }, { timeout: 25_000 })
    .catch(() => {
      console.warn("   ⚠️ contenu principal non détecté après 25 s — capture quand même");
    });
}

// Masque les éléments flottants et remonte le conteneur de contenu en haut.
async function prepareFrame(page) {
  await page.evaluate(
    (selectors) => {
      for (const sel of selectors) {
        document.querySelectorAll(sel).forEach((el) => {
          el.style.display = "none";
        });
      }
      document.querySelector('main[data-scroll-container="true"]')?.scrollTo({ top: 0 });
    },
    FLOAT_SELECTORS
  );
  await page.waitForTimeout(500);
}

// Capture « produit » : cadrage sur la zone de contenu principale (haut de zone).
async function captureMainZone(page, target) {
  const out = path.join(OUT_DIR, target.file);
  const main = page.locator(MAIN_SELECTOR).first();
  await main.waitFor({ state: "attached", timeout: 20_000 }).catch(() => {});
  const box = await main.boundingBox();
  if (!box || box.width === 0 || box.height === 0) {
    console.warn("   ⚠️ zone de contenu introuvable — capture viewport complète");
    await page.screenshot({ path: out });
    return;
  }
  const height = Math.round(box.height * (target.heightRatio ?? 0.85));
  await page.screenshot({
    path: out,
    clip: { x: Math.round(box.x), y: Math.round(box.y), width: Math.round(box.width), height },
  });
}

async function capture(page, target) {
  console.log(`\n📸 ${target.label} — ${target.url}`);
  try {
    await page.goto(target.url, { waitUntil: "domcontentloaded", timeout: 45_000 });
  } catch (err) {
    // net::ERR_ABORTED : la route redirige côté serveur (ex. onboarding/welcome) ou
    // Turbopack recompile au premier hit. La navigation finale s'installe ensuite.
    console.warn(`   ⚠️ navigation abortée (${String(err.message).slice(0, 90)}) — on laisse la page se poser…`);
  }
  // Laisser les fonts/images/animations se stabiliser (images lazy + fonts).
  await page.waitForLoadState("networkidle", { timeout: 15_000 }).catch(() => {});
  await page.waitForTimeout(3000);
  await waitForMainContent(page);
  await prepareFrame(page);

  const out = path.join(OUT_DIR, target.file);
  if (!FULL_PAGE && target.zone === "main") {
    await captureMainZone(page, target);
  } else {
    await page.screenshot({ path: out, fullPage: FULL_PAGE });
  }

  const size = statSync(out).size;
  if (size < 30_000) {
    console.warn("   ⚠️ capture suspecte (< 30 Ko) — la page est peut-être vide, re-vérifie");
  }
  console.log(
    `   ✅ ${target.file} — ${Math.round(VIEWPORT.width * DEVICE_SCALE_FACTOR)}×${Math.round(VIEWPORT.height * DEVICE_SCALE_FACTOR)} (zone produit) — ${Math.round(size / 1024)} Ko — URL: ${page.url()}`
  );
}

async function main() {
  const context = await chromium.launchPersistentContext(PROFILE_DIR, {
    headless: HEADLESS,
    viewport: VIEWPORT,
    deviceScaleFactor: DEVICE_SCALE_FACTOR,
    locale: "fr-FR",
    args: ["--force-device-scale-factor=1"],
  });
  const page = context.pages()[0] || (await context.newPage());

  if (LOGIN_MODE) {
    await ensureLogin(page);
  }

  const targets = TARGETS_FILTER
    ? TARGETS.filter((t) => TARGETS_FILTER.some((f) => t.file === f || t.file.replace(/\.png$/, "") === f))
    : TARGETS;
  for (const target of targets) {
    await capture(page, target);
  }

  await context.close();
  console.log(`\n✅ Terminé — ${targets.length} captures produit dans ${OUT_DIR}`);
}

main().catch((err) => {
  console.error("❌ Erreur:", err);
  process.exit(1);
});
