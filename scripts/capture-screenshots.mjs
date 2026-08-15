#!/usr/bin/env node
/**
 * Capture des captures d'écran 4K pour la landing SigilOS (#80).
 *
 * Les captures actuelles (public/assets/screenshots/*.png) sont des PNG basse
 * résolution (695→1695px) : elles paraissent floues sur écrans DPI élevés.
 * Ce script produit de vraies captures 4K (viewport 1920×1080, deviceScaleFactor
 * 2 => PNG 3840×2160) depuis l'app en local.
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
 *   FULL_PAGE=1 node scripts/capture-screenshots.mjs   # capture pleine page (au lieu du viewport)
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

const VIEWPORT = { width: 1920, height: 1080 };
const DEVICE_SCALE_FACTOR = 2; // => PNG 3840×2160 (4K)

const TARGETS = [
  { file: "screenshot1.png", url: `${BASE_URL}/dashboard/${GUILD_ID}`, label: "Tableau de bord (hero)" },
  { file: "guide-complet.png", url: `${BASE_URL}/dashboard/${GUILD_ID}/quetes-dofus/guide/rush-sylvestre`, label: "Guide quête (ProductStory 1)" },
  { file: "screenshot3.png", url: `${BASE_URL}/dashboard/${GUILD_ID}/calendar`, label: "Calendrier (ProductStory 2)" },
  { file: "screenshot6.png", url: `${BASE_URL}/dashboard/${GUILD_ID}/missions`, label: "Missions (ProductStory 3)" },
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

async function capture(page, target) {
  console.log(`\n📸 ${target.label} — ${target.url}`);
  await page.goto(target.url, { waitUntil: "domcontentloaded", timeout: 45_000 });
  // Laisser les fonts/images/animations se stabiliser (images lazy + fonts).
  await page.waitForLoadState("networkidle", { timeout: 15_000 }).catch(() => {});
  await page.waitForTimeout(3000);
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForTimeout(400);

  const out = path.join(OUT_DIR, target.file);
  await page.screenshot({ path: out, fullPage: FULL_PAGE });
  const size = statSync(out).size;
  const physical = {
    width: Math.round(VIEWPORT.width * DEVICE_SCALE_FACTOR),
    height: Math.round(VIEWPORT.height * DEVICE_SCALE_FACTOR),
  };
  console.log(`   ✅ ${target.file} — ${physical.width}×${physical.height} (${Math.round(size / 1024)} Ko)`);
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

  for (const target of TARGETS) {
    await capture(page, target);
  }

  await context.close();
  console.log(`\n✅ Terminé — ${TARGETS.length} captures 4K dans ${OUT_DIR}`);
}

main().catch((err) => {
  console.error("❌ Erreur:", err);
  process.exit(1);
});
