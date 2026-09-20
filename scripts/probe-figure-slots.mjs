/**
 * Sonde (non commitée) — « à quelle taille le navigateur demande-t-il les figures ? »
 *
 * Question posée : les visuels de la landing sont déclarés avec des dimensions
 * intrinsèques (1080, 1180, 1030…), mais **quelle largeur CSS** occupent-ils
 * réellement dans le slot, et **quelle URL `/_next/image`** le navigateur
 * réclame-t-il selon le `devicePixelRatio` (DPR) ?
 *
 * C'est cette largeur × DPR qui donne la largeur minimale du fichier pour un
 * rendu sans rééchantillonnage. Mesuré le 17/09/2026 :
 *   - `next/image` **ne remonte jamais** une image (demande `w=1920` sur un
 *     fichier de 1180 px renvoie du 1180 px) → un fichier trop petit est
 *     agrandi par le **navigateur**, jamais par le serveur : flou côté client.
 *
 * Usage : `node scripts/probe-figure-slots.mjs`
 * Env : `SIGILOS_URL` (défaut `http://localhost:3000`), `WIDTH` (viewport CSS px).
 */
import { chromium } from "playwright";

const BASE = process.env.SIGILOS_URL || "http://localhost:3000";
const WIDTH = Number(process.env.WIDTH || 1470);
const HEIGHT = Number(process.env.HEIGHT || 950);

const browser = await chromium.launch();

for (const dpr of [1, 2]) {
    const page = await browser.newPage({ viewport: { width: WIDTH, height: HEIGHT }, deviceScaleFactor: dpr });
    await page.goto(`${BASE}/`, { waitUntil: "networkidle" });
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await page.waitForTimeout(1500);
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.waitForTimeout(800);

    // ⚠️ `naturalWidth` est **corrigé en densité** par le navigateur (spec img
    // `srcset`/`sizes`) : avec `sizes="… 640px"` et un candidat `w=1920`, la
    // densité vaut 3 et `naturalWidth` renvoie `1030 / 2,82 ≈ 364` pour un
    // fichier de 1030 px. On lit donc les **vrais pixels** en décodant le flux.
    const rows = await page.$$eval("figure.reg-screen", async (nodes) => {
        const out = [];
        for (const n of nodes) {
            const img = n.querySelector("img");
            const box = img?.getBoundingClientRect();
            let real = 0;
            try {
                const blob = await (await fetch(img.currentSrc)).blob();
                real = (await createImageBitmap(blob)).width;
            } catch {
                real = img?.naturalWidth || 0;
            }
            out.push({
                label: (n.querySelector("figcaption")?.textContent || "").trim(),
                slot: Math.round(n.getBoundingClientRect().width),
                cssWidth: Math.round(box?.width || 0),
                natural: real,
                attr: `${img?.getAttribute("width")}×${img?.getAttribute("height")}`,
                src: (img?.currentSrc || "").replace(/^https?:\/\/[^/]+/, "") || "(pas encore chargé)",
            });
        }
        return out;
    });

    console.log(`\n=== viewport ${WIDTH}×${HEIGHT} · DPR ${dpr} ===`);
    for (const r of rows) {
        const s = new URLSearchParams(r.src.split("?")[1] || "");
        const asked = s.get("w") || "-";
        const need = r.cssWidth * dpr;
        const verdict = r.natural === 0 ? "non chargé" : r.natural >= need ? "OK (aucun agrandissement)" : `AGRANDI ×${(need / r.natural).toFixed(2)}`;
        console.log(
            `  · « ${r.label} » — slot ${r.slot}px, image rendue ${r.cssWidth}px\n` +
                `      fichier ${r.natural}px (déclaré ${r.attr}) — demandé w=${asked} — besoin ${need}px → ${verdict}\n` +
                `      ${r.src}`
        );
    }
    await page.close();
}
await browser.close();
