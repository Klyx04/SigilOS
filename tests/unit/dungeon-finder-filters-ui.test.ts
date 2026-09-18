/**
 * Régression (18/09/2026, constat beta) — module Donjons & Quêtes + rosters
 * (Songes, Calendrier/Raid).
 *
 * Trois défauts mesurés sur la beta :
 *   1. **Couleurs « maquette »** : la barre de filtres et les cartes empilaient des
 *      aplats bleu/vert/ambre (segment de mode actif en `bg-info` plein, bandeau de
 *      date pleine largeur, paliers de niveau bleus, pastilles vert « OUVERT » et
 *      ambre « succès »). L'accent ne hiérarchisait plus rien.
 *   2. **Bouton « Pseudos » global** : il collait toute la liste `\n/w Pseudo` —
 *      inutilisable pour chuchoter à UN joueur (DJ, Songes, Calendrier/Raid).
 *   3. **Classe absente des rosters** : il fallait ouvrir chaque profil pour savoir
 *      qui jouait quoi.
 *
 * Corrigé et verrouillé ici :
 *   - pictos **Dofus réels** (`public/assets/dofus/icons/*.png`, via `DofusUiIcon`)
 *     au lieu d'émojis, avec états actifs **neutres** (`bg-elevated` +
 *     `border-border-strong`) : l'accent reste réservé au CTA ;
 *   - copie **unitaire** `/w <pseudo>` via `PseudoChip`, boutons globaux supprimés ;
 *   - icône de classe Dofus **devant chaque pseudo** d'inscrit, sur les 4 flows.
 *
 * Comme les autres tests de câblage du repo, on lit les sources (vitest tourne en
 * environnement `node`) : on verrouille le code, pas la prose.
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";

const BAR = "src/components/dungeon-finder/DjFiltersBar.tsx";
const CARD = "src/components/dungeon-finder/DjPostCard.tsx";
const CLIENT = "src/components/dungeon-finder/DungeonFinderClient.tsx";
const DJ_MODAL = "src/components/dungeon-finder/DjPostDetailModal.tsx";
const RUN_CARD = "src/components/songes/RunCard.tsx";
const EVENT_MODAL = "src/components/calendar/event-detail-modal.tsx";
const PSEUDO_CHIP = "src/components/shared/pseudo-chip.tsx";
const DOFUS_ICON = "src/components/shared/dofus-ui-icon.tsx";

/** Retire les commentaires : on verrouille le **code**, pas la prose. */
function codeOnly(source: string): string {
    return source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/[^\n]*/g, "$1");
}

function read(path: string): string {
    return codeOnly(readFileSync(path, "utf8"));
}

const BAR_CODE = read(BAR);
const CARD_CODE = read(CARD);
const CLIENT_CODE = read(CLIENT);
const DJ_MODAL_CODE = read(DJ_MODAL);
const RUN_CARD_CODE = read(RUN_CARD);
const EVENT_MODAL_CODE = read(EVENT_MODAL);

describe("Pictos Dofus réels — plus d'émojis ni d'aplats colorés", () => {
    it("`DofusUiIcon` pointe sur les assets officiels du jeu", () => {
        const code = read(DOFUS_ICON);
        expect(code).toMatch(/\/assets\/dofus\/icons\/\$\{DOFUS_UI_ICON_FILES\[name\]\}\.png/);
        expect(code, "le mapping doit réutiliser le référentiel Succès/Ladder").toMatch(/dungeon: "crossedSwords"/);
        expect(code).toMatch(/quest: "quests"/);
        expect(code).toMatch(/challenge: "challenges"/);
        expect(code).toMatch(/leader: "crown"/);
    });

    it("la barre de filtres utilise les pictos (et garde la cible du tour)", () => {
        expect(BAR_CODE).toMatch(/import \{ DofusUiIcon, type DofusUiIconName \} from "@\/components\/shared\/dofus-ui-icon"/);
        expect(BAR_CODE).toMatch(/<DofusUiIcon name=\{asset\} size=\{13\} \/>/);
        expect(BAR_CODE, "l'étape `donjons-filters` du tour vise une cible inexistante").toMatch(
            /data-tour="donjons-filters"/
        );
    });

    it("l'état actif des segments et des paliers est neutre", () => {
        expect(BAR_CODE, "l'ancien pavé `bg-info text-info-foreground` est de retour").not.toMatch(
            /bg-info text-info-foreground/
        );
        expect(BAR_CODE, "les paliers actifs en `bg-info/20` sont de retour").not.toMatch(/bg-info\/20/);
        expect(BAR_CODE).toMatch(/bg-elevated border-border-strong text-foreground shadow-sm/);
    });

    it("chaque mode affiche son compteur, calculé sur le périmètre affiché", () => {
        expect(BAR_CODE).toMatch(/modeCounts\?: Record<string, number>/);
        expect(BAR_CODE).toMatch(/const count = modeCounts\[value\] \?\? 0/);
        expect(CLIENT_CODE).toMatch(/modeCounts=\{modeCounts\}/);
        expect(CLIENT_CODE).toMatch(/counts\[p\.mode\] = \(counts\[p\.mode\] \?\? 0\) \+ 1/);
    });
});

describe("Cartes de post Donjons — fin des pastilles vert/ambre/bleu", () => {
    it("le mode et le statut passent par des pictos Dofus", () => {
        expect(CARD_CODE).toMatch(/DONJON: \{ label: "Donjon", asset: "dungeon" \}/);
        expect(CARD_CODE).toMatch(/QUETE: \{ label: "Quête", asset: "quest" \}/);
        expect(CARD_CODE).toMatch(/DEFI: \{ label: "Défi", asset: "challenge" \}/);
        expect(CARD_CODE).toMatch(/OPEN: \{ label: "Ouvert", asset: "open" \}/);
        expect(CARD_CODE, "ternaire mort `\"text-info\" : \"text-info\"` de retour").not.toMatch(
            /"text-info" : "text-info"/
        );
    });

    it("aucun aplat vert ni ambre ne subsiste dans la carte", () => {
        expect(CARD_CODE, "les pastilles vertes (statut/places) sont de retour").not.toMatch(/bg-success\//);
        expect(CARD_CODE, "les pastilles ambre (statut/succès/couronne) sont de retour").not.toMatch(/bg-warning\//);
    });

    it("la date de rendez-vous est une ligne compacte, plus un bandeau plein largeur", () => {
        expect(CARD_CODE).not.toMatch(/bg-info\/5 border-info\/20/);
        expect(CARD_CODE).toMatch(/<DofusUiIcon name="date" size=\{14\}/);
    });

    it("garde UN seul accent bleu : le CTA d'inscription", () => {
        expect(CARD_CODE).toMatch(/"bg-info\/15 text-info border border-info\/30/);
        expect(CARD_CODE).toMatch(/line-clamp-2"\s*title=\{title \|\| ""\}/);
    });

    it("chaque participant porte l'icône de sa classe sur sa bulle", () => {
        expect(CARD_CODE).toMatch(/post\.profile\.classe && \(/);
        expect(CARD_CODE).toMatch(/p\.classe && \(/);
        expect(CARD_CODE).toMatch(/rounded-tr-md bg-background\/90 p-\[1px\]/);
    });
});

describe("Copie des pseudos — unitaire partout, globale nulle part", () => {
    it("`PseudoChip` copie `/w <pseudo>` via le presse-papier robuste", () => {
        const code = read(PSEUDO_CHIP);
        expect(code).toMatch(/copyToClipboard\(`\/w \$\{pseudo\}`\)/);
        expect(code).toMatch(/<ClassIcon classId=\{classe\} size=\{iconSize\} \/>/);
    });

    it("plus aucun bouton global « Pseudos » dans les 3 flows (le CTA dupliqué ment)", () => {
        for (const [name, code] of [
            ["DjPostDetailModal", DJ_MODAL_CODE],
            ["RunCard", RUN_CARD_CODE],
            ["event-detail-modal", EVENT_MODAL_CODE],
        ] as const) {
            expect(code, `${name} : bouton global de copie encore présent`).not.toMatch(/handleCopyPseudos/);
            expect(code, `${name} : liste globale \`/w\` encore présente`).not.toMatch(/buildWhisperList/);
            expect(code, `${name} : état de copie globale encore présent`).not.toMatch(/copiedPseudos/);
        }
    });

    it("les rosters affichent le pseudo avec sa classe et sa copie `/w`", () => {
        expect(DJ_MODAL_CODE).toMatch(/<PseudoChip[\s\S]{0,220}?classe=\{p\.classe\}/);
        expect(RUN_CARD_CODE).toMatch(/<PseudoChip[\s\S]{0,220}?classe=\{memberClassId\}/);
        expect(EVENT_MODAL_CODE).toMatch(/<PseudoChip[\s\S]{0,220}?classe=\{participant\.classe\}/);
    });
});

