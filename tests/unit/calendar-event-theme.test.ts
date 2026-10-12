/**
 * Identité des types d'événement (`@/lib/calendar-event-theme`) — **source unique**.
 *
 * Constat user du 19/09/2026 (« deslop IA » sur la modale de raid) : la MÊME table
 * (libellé + icône + « dégradé ») était recopiée dans **six** composants du
 * calendrier, avec à chaque fois une icône **lucide** de remplacement — d'où des
 * pictos qui divergeaient d'un écran à l'autre et l'effet « maquette IA ».
 *
 * Verrouillé ici : un type = un libellé + des **tokens sémantiques** + un **picto
 * Dofus** valide ; et aucun composant ne réintroduit sa propre table ni un dégradé
 * « d'une couleur vers elle-même ».
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { DOFUS_UI_ICON_FILES } from "@/components/shared/dofus-ui-icon";
import { CALENDAR_EVENT_THEME_TYPES, calendarEventTheme } from "@/lib/calendar-event-theme";

/** Composants branchés sur la source unique (aucune table locale autorisée). */
const COMPONENTS = [
    "src/components/calendar/event-detail-modal.tsx",
    "src/components/calendar/event-card.tsx",
    "src/components/calendar/calendar-grid.tsx",
    "src/components/calendar/calendar-dashboard.tsx",
    "src/components/calendar/upcoming-events-widget.tsx",
    "src/components/calendar/featured-events-carousel.tsx",
];

/** Le formulaire garde SES libellés de formulaire, mais plus aucun picto en propre. */
const FORM = "src/components/calendar/event-form.tsx";

/** Dégradés décoratifs retirés (une couleur vers elle-même, ou un duo arbitraire). */
const SLOP_GRADIENTS =
    /from-danger to-danger|from-info to-fuchsia-600|from-warning to-warning|from-success to-green-600|from-pink-600 to-danger|from-muted to-muted/;

function codeOnly(source: string): string {
    return source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/[^\n]*/g, "$1");
}

describe("calendarEventTheme", () => {
    it("donne un libellé, un libellé court et un picto Dofus VALIDE à chaque type", () => {
        for (const type of CALENDAR_EVENT_THEME_TYPES) {
            const theme = calendarEventTheme(type);
            expect(theme.label, `${type} : libellé`).toBeTruthy();
            expect(theme.shortLabel, `${type} : libellé court`).toBeTruthy();
            expect(
                Object.keys(DOFUS_UI_ICON_FILES),
                `${type} : « ${theme.picto} » n'est pas un picto Dofus connu`
            ).toContain(theme.picto);
        }
    });

    it("n'utilise que des tokens sémantiques (aucune couleur de palette codée à la main)", () => {
        for (const type of CALENDAR_EVENT_THEME_TYPES) {
            const theme = calendarEventTheme(type);
            for (const value of [theme.color, theme.bg, theme.border, theme.dot]) {
                expect(value, `${type} : ${value}`).toMatch(/^(text|bg|border)-(danger|success|warning|info|muted|border|pink)/);
                expect(value, `${type} : ${value} contient une palette brute`).not.toMatch(
                    /(slate|gray|zinc|red|green|blue|yellow|orange|indigo|violet|cyan|teal)-\d/
                );
            }
        }
    });

    it("replie les types inconnus ou absents sur OTHERS (jamais undefined)", () => {
        expect(calendarEventTheme("TYPE_QUI_N_EXISTE_PAS").label).toBe("Autres");
        expect(calendarEventTheme(null).label).toBe("Autres");
        expect(calendarEventTheme(undefined).label).toBe("Autres");
        expect(calendarEventTheme("").label).toBe("Autres");
        // Un type connu reste connu (pas de repli abusif).
        expect(calendarEventTheme("RAID_OFFICIAL").label).toBe("Raid 3.6");
        expect(calendarEventTheme("RAID_OFFICIAL").picto).toBe("dungeon");
    });
});

describe("Composants du calendrier — une seule table, plus de pictos lucide par type", () => {
    for (const file of COMPONENTS) {
        it(`${file} : passe par \`calendarEventTheme\``, () => {
            const code = codeOnly(readFileSync(file, "utf8"));
            expect(code, "doit lire la source unique").toMatch(/calendarEventTheme/);
            expect(code, "table de types recopiée dans le composant").not.toMatch(
                /const TYPE_(THEMES|CONFIG)\s*[:=]|const FILTER_TYPES\s*[:=]/
            );
            expect(code, "dégradé de type réintroduit").not.toMatch(SLOP_GRADIENTS);
            expect(code, "icône lucide utilisée comme picto de type").not.toMatch(
                /icon:\s*(Swords|PartyPopper|Target|Wheat|Eye|Diamond)\b/
            );
        });
    }

    it(`${FORM} : garde ses libellés mais emprunte le picto Dofus`, () => {
        const code = codeOnly(readFileSync(FORM, "utf8"));
        expect(code, "le picto doit venir de la source unique").toMatch(/calendarEventTheme\(\w+\)\.picto/);
        expect(code, "plus d'emoji de type dans le formulaire").not.toMatch(/icon:\s*["']/);
        expect(code, "plus de champ icône/dégradé dans la table du formulaire").not.toMatch(
            /^\s*(icon|gradient):\s/m
        );
        expect(code).not.toMatch(SLOP_GRADIENTS);
    });
});
