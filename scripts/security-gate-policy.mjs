/**
 * Porte de sécurité — **politique d'exceptions temporaires** (règle pure, testée).
 *
 * Pourquoi ce fichier (mesure du 17/11/2026) : l'avis **GHSA-fc5q-39xc-vjpf**
 * (picomatch ≤ 4.0.7, ReDoS, CVE-2026-112366) n'a **aucune version corrigée**
 * (`Patched versions: None`). Il est tiré en production **par classification npm**
 * (`@sentry/nextjs` déclare son *loader de build* et `@rollup/plugin-commonjs` dans
 * `dependencies`), alors que le code fautif ne s'exécute qu'au `next build` :
 * le SDK runtime (`dist/index.js`) ne l'importe pas et le dernier `.next/standalone`
 * ne contient aucun paquet `picomatch` npm (seule la copie compilée de Next, saine).
 *
 * Une exception n'est donc acceptable qu'à quatre conditions, toutes vérifiées ici :
 *  ① **datée** — elle expire d'elle-même (7 jours, revue rapprochée) ;
 *  ② **nominative** — une seule GHSA, jamais « toutes les alertes » ;
 *  ③ **couvrante** — TOUS les paquets `high`/`critical` bloqués doivent descendre de
 *     cette seule GHSA (sinon une autre faille passerait avec elle) ;
 *  ④ **fail-closed** — un avis sans URL, une date invalide ou un paquet non couvert
 *     ⇒ pas d'exception, la porte échoue comme avant.
 *
 * À retirer dès que picomatch publie un correctif (ou au plus tard à `expiresAt`).
 */

/** Exceptions actives de la porte « livré » (GATE 1). Toute extension est un nouveau commit. */
export const PROD_AUDIT_EXCEPTIONS = [
    {
        advisory: "GHSA-fc5q-39xc-vjpf",
        expiresAt: "2026-11-24",
        reason:
            "picomatch ReDoS (CVE-2026-112366), aucune version corrigée au 17/11/2026 ; " +
            "code atteint uniquement par le loader de build de Sentry (withSentryConfig), " +
            "absent de l'image standalone.",
    },
];

const GHSA_PATTERN = /GHSA-[a-z0-9]{4}-[a-z0-9]{4}-[a-z0-9]{4}/i;

/** Identifiant GHSA **canonique** (`GHSA-xxxx-xxxx-xxxx`) extrait d'une URL, sinon `null`. */
export function advisoryIdFromUrl(url) {
    if (typeof url !== "string") return null;
    const match = url.match(GHSA_PATTERN);
    if (!match) return null;
    return `GHSA-${match[0].slice(5).toLowerCase()}`;
}

/** Fin de validité inclusive d'une exception (23:59:59.999 UTC du jour indiqué). */
function exceptionEnd(exception) {
    const end = new Date(`${exception?.expiresAt}T23:59:59.999Z`);
    return Number.isNaN(end.getTime()) ? null : end;
}

export function isExceptionExpired(exception, now = new Date()) {
    const end = exceptionEnd(exception);
    return end === null || now.getTime() > end.getTime();
}

/**
 * Un paquet vulnérable est **couvert** si toute sa chaîne `via` se termine sur l'avis
 * autorisé : un seul avis différent, une dépendance absente du rapport ou une boucle
 * suffisent à refuser (fail-closed).
 */
function isCoveredByAdvisory(name, vulnerabilities, allowedId, seen) {
    if (seen.has(name)) return false;
    const vuln = vulnerabilities[name];
    if (!vuln) return false;
    // Copie par branche : un diamant (pluginutils ET picomatch directs) ne doit pas
    // « consommer » le nœud partagé et faire échouer la seconde branche.
    const path = new Set(seen);
    path.add(name);

    let covered = false;
    for (const via of vuln.via ?? []) {
        if (typeof via === "string") {
            if (!isCoveredByAdvisory(via, vulnerabilities, allowedId, path)) return false;
            covered = true;
            continue;
        }
        if (advisoryIdFromUrl(via?.url)?.toLowerCase() !== allowedId) return false;
        covered = true;
    }
    return covered;
}

/**
 * Exception applicable à un rapport `npm audit --omit=dev`, ou `null`.
 * `null` ⇒ la porte doit échouer (comportement historique).
 */
export function findApplicableException({
    report,
    exceptions = PROD_AUDIT_EXCEPTIONS,
    now = new Date(),
    severities = ["high", "critical"],
}) {
    const vulnerabilities = report?.vulnerabilities ?? {};
    const failing = Object.entries(vulnerabilities).filter(([, vuln]) => severities.includes(vuln?.severity));
    if (failing.length === 0) return null;

    for (const exception of exceptions) {
        const declared = advisoryIdFromUrl(exception?.advisory);
        if (!declared) continue;
        const allowedId = declared.toLowerCase();
        if (isExceptionExpired(exception, now)) continue;

        const covered = failing.every(([name]) =>
            isCoveredByAdvisory(name, vulnerabilities, allowedId, new Set()),
        );
        if (covered) {
            return { ...exception, advisory: declared, packages: failing.map(([name]) => name) };
        }
    }
    return null;
}
