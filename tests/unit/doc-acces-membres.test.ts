/**
 * Documentation — **qui** peut la lire, et pourquoi ce n'est jamais un visiteur.
 *
 * Question user du 10/12/2026 : « mais attends les visiteurs ont accès à la doc ? je comprends
 * rien normalement c'est juste les gens des guildes ».
 *
 * Mesure (lecture seule du code, jamais supposée) :
 * - `src/app/docs/layout.tsx` : `auth()` puis, sans session,
 *   `redirect("/api/auth/signin?callbackUrl=/docs")` ⇒ **aucun visiteur anonyme** ; et sans
 *   guilde, le panneau « Accès réservé » (le centre de doc est réservé aux membres) ;
 * - `getAllDocs` : un visiteur ne recevrait que `PUBLIC` — mais il ne peut pas ouvrir la page ;
 * - **le trou trouvé le 10/12/2026** : le sélecteur de niveau du God n'offrait que `PUBLIC` et
 *   `ADMIN`, alors que le catalogue contient **14 fiches `MEMBER`** (2 `PUBLIC`, 15 `ADMIN`)
 *   et que le test `songes-docs` exige `MEMBER` ⇒ une fiche `MEMBER` s'affichait **blanche**.
 */
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const read = (p: string) => readFileSync(p, "utf8");
const LAYOUT = "src/app/docs/layout.tsx";
const EDITOR = "src/app/god/docs/_components/doc-editor.tsx";
const ACTIONS = "src/server/actions/doc-actions.ts";
const CATALOG = "src/lib/docs-catalog.ts";

const countOf = (code: string, re: RegExp) => (code.match(re) ?? []).length;

describe("documentation — accès réservé aux membres de guildes", () => {
    it("le lecteur exige une session : un visiteur anonyme est redirigé vers la connexion", () => {
        const layout = read(LAYOUT);
        expect(layout).toContain('redirect("/api/auth/signin?callbackUrl=/docs")');
        // Et sans guilde, on ne sert pas la doc : panneau explicite.
        expect(layout).toContain("Accès réservé");
        expect(layout).toContain("userGuilds.length === 0");
    });

    it("deux niveaux seulement dans le God — et le niveau staff vient du RBAC, pas d'un choix libre", () => {
        const editor = read(EDITOR);
        expect(editor).toContain('value="MEMBER"');
        expect(editor).toContain('value="ADMIN"');
        // `PUBLIC` n'est plus offert : il ne s'affiche que sur une fiche qui le porte déjà.
        expect(editor).toContain('{formData.accessLevel === "PUBLIC" && (');
        expect(editor).toContain('value="PUBLIC"');
        // Le catalogue s'appuie sur MEMBER : le sélecteur doit le proposer, sinon valeur blanche.
        expect(countOf(read(CATALOG), /accessLevel: 'MEMBER' as any/g)).toBeGreaterThan(0);
        // Le niveau « staff » suit le rôle RBAC de la guilde (fail-closed : faux par défaut).
        expect(read("src/server/actions/user-actions.ts"))
            .toContain("permissionSet.has(PERMISSIONS.STAFF_CONTENT)");
    });

    it("seul le super-admin écrit la doc — ou une délégation explicite de la brick `docs`", () => {
        const actions = read(ACTIONS);
        for (const fn of ["saveDoc", "deleteDoc"]) {
            const start = actions.indexOf(`export async function ${fn}`);
            expect(start, `${fn} introuvable`).toBeGreaterThan(-1);
            const body = actions.slice(start, start + 900);
            expect(body, fn).toContain("isSuperAdmin()");
            expect(body, fn).toContain('canAccessBrick("docs")');
        }
        // La console d'édition elle-même est fermée : /god/docs exige le super-admin.
        expect(read("src/app/god/docs/page.tsx")).toContain("isAdmin");
    });

    it("une fiche créée sans niveau explicite tombe sur MEMBER, jamais sur le plus large", () => {
        expect(read(EDITOR)).toContain('accessLevel: initialData?.accessLevel || "MEMBER"');
        const actions = read(ACTIONS);
        expect(countOf(actions, /accessLevel: data\.accessLevel \|\| "MEMBER"/g)).toBe(2);
        expect(actions).not.toContain('accessLevel: data.accessLevel || "PUBLIC"');
    });

    it("l'éditeur dit noir sur blanc qu'aucun visiteur anonyme ne lit la doc", () => {
        expect(read(EDITOR)).toContain("Aucun visiteur anonyme ne lit la doc");
    });
});
