/**
 * Landing — recadrage des visuels (`public/assets/screenshots/`).
 *
 * ⚠️ **REMPLACÉ le 17/09/2026 par `scripts/capture-landing-visuels.mjs`.** Ce
 * script rogne une capture large : rogner, c'est **zoomer** sur un fragment de
 * l'écran (texte coupé en plein mot, bouton amputé, curseur figé dans l'image)
 * et laisser le fichier sous-doté pour un écran 2×. La bonne recette est de
 * **capturer le composant à la largeur où il s'affiche** (`data-tour`, viewport
 * = slot, `deviceScaleFactor: 2`) — cf. l'en-tête de `capture-landing-visuels.mjs`
 * et `docs/MAINTENANCE.md` §3e.
 *
 * Ce fichier est conservé pour **tracer l'origine** des quatre visuels du
 * 17/09 (`dashboard-guilde.png`, `calendrier-sorties.png`, `missions-guilde.png`,
 * `guide-sylvestre.png`) : ils sont meilleurs que les captures ×5 d'origine,
 * mais encore sous-dotés (1080-1280 px pour un besoin de 1238-1436 px).
 * Ne pas réutiliser pour de nouveaux visuels.
 *
 * Pourquoi : une capture d'écran d'interface affichée dans une colonne de
 * ~640 px subit une réduction égale à (largeur du fichier / 640). Une capture
 * 4K (3280 px) est donc réduite **×5,1** → un texte de 13 px dans l'interface
 * tombe à 2,5 px : illisible et perçu comme flou.
 *
 * Usage : `node scripts/crop-landing-visuels.mjs`
 * Les fichiers source sont **conservés** (ils servent la doc de l'app) ; les
 * recadrages sortent sous un **nom neuf** — obligatoire, sinon le cache de
 * `next/image` ressert l'ancienne image (cf. `docs/MAINTENANCE.md` §3e).
 */
import sharp from "sharp";

/**
 * [source, sortie, zone à garder : gauche, haut, largeur, hauteur].
 *
 * On garde l'**élément qui raconte quelque chose**, pas l'écran entier : un
 * écran complet réduit ×5 ne montre rien, un panneau réduit ×2 se lit.
 */
const JOBS = [
    // Hero — « Tableau de bord » : Aujourd'hui + Événement majeur + Agenda.
    ["tableau-de-bord.png", "dashboard-guilde.png", { left: 500, top: 20, width: 1080, height: 540 }],
    // Workflow — « Calendrier des sorties » : la semaine et une sortie planifiée.
    ["screenshot3.png", "calendrier-sorties.png", { left: 155, top: 760, width: 1280, height: 690 }],
    // Guide (figure secondaire) — « Missions de guilde » : coordonnées du hall.
    // Cadré dans la marge du bloc : à gauche démarrait un fragment du bloc voisin.
    ["screenshot6.png", "missions-guilde.png", { left: 2100, top: 580, width: 1180, height: 700 }],
    // Guide (figure principale) — « Guide Sylvestre » : le retour de quête, seule
    // zone nette de la capture d'origine (une seconde modale recouvre le haut de
    // l'écran, et le fond est presque noir).
    ["guide-complet.png", "guide-sylvestre.png", { left: 800, top: 700, width: 1030, height: 500 }],
];

const DIR = "public/assets/screenshots";

for (const [source, sortie, zone] of JOBS) {
    const src = `${DIR}/${source}`;
    const meta = await sharp(src).metadata();
    const { left, top, width, height } = zone;

    // Garde-fou : on refuse de rogner hors du cadre (sharp tronquerait en silence).
    if (left + width > meta.width || top + height > meta.height) {
        throw new Error(
            `${source} (${meta.width}×${meta.height}) : zone ${left},${top} ${width}×${height} hors cadre`,
        );
    }

    await sharp(src).extract(zone).png({ compressionLevel: 9 }).toFile(`${DIR}/${sortie}`);

    const out = await sharp(`${DIR}/${sortie}`).metadata();
    const reduction = (out.width / 640).toFixed(2);
    console.log(
        `${source} ${meta.width}×${meta.height} → ${sortie} ${out.width}×${out.height} ` +
            `(réduction ×${reduction} à 640 px d'affichage)`,
    );
}
