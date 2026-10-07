#!/usr/bin/env node
/**
 * Porte de sécurité des dépendances — **la même commande en local et en CI**.
 *
 * Pourquoi deux portes (mesure du 05/10/2026) :
 *  - `npm audit --audit-level=high` sur **tout** l'arbre bloquait *toutes* les PR (dont celles
 *    de Dependabot) à cause d'une seule chaîne **de développement** :
 *    `eslint-config-next` → `fast-glob` → `micromatch` → `braces`. `braces` est affecté jusqu'à
 *    `3.0.3` et **3.0.3 est la dernière version publiée** : aucun correctif amont n'existe.
 *  - La production, elle, est propre : `npm audit --omit=dev` = **0 vulnérabilité**
 *    et `npm ls braces --omit=dev` = *empty*.
 *
 * D'où la règle, explicitement asymétrique :
 *  1. **GATE 1 — le livré** : `--omit=dev`, échec sur `high` ou `critical` ;
 *  2. **GATE 2 — tout l'arbre** : échec sur `critical` seulement (un `high` de dev, non livré,
 *     n'empêche plus une PR ; il reste visible dans le rapport hebdo « Full Security Audit »).
 *
 * Aucune exception n'est silencieuse : ce qui est ignoré est **écrit** dans la sortie.
 * Échappatoire assumée pour le hook local uniquement : `SKIP_AUDIT=1` (jamais en CI).
 */

import { spawnSync } from "node:child_process";

const ATTEMPTS = 3;
const RETRY_DELAY_MS = 15_000;

const isNetworkFailure = (text) =>
    /ECONNRESET|ETIMEDOUT|EAI_AGAIN|503|502|network|fetch failed/i.test(text);

function runAudit(args) {
    for (let attempt = 1; attempt <= ATTEMPTS; attempt++) {
        const res = spawnSync("npm", ["audit", ...args, "--json"], {
            encoding: "utf8",
            shell: process.platform === "win32",
            maxBuffer: 32 * 1024 * 1024,
        });
        const stdout = res.stdout ?? "";
        const stderr = res.stderr ?? "";
        try {
            return JSON.parse(stdout);
        } catch {
            if (attempt === ATTEMPTS || !isNetworkFailure(stderr + stdout)) {
                console.error("❌ npm audit n'a pas renvoyé de JSON exploitable.");
                console.error(stderr.trim() || stdout.slice(0, 500));
                process.exit(1);
            }
            console.warn(
                `::warning::npm audit illisible (tentative ${attempt}/${ATTEMPTS}) — nouvelle tentative dans ${RETRY_DELAY_MS / 1000}s`,
            );
            spawnSync("node", ["-e", `Atomics.wait(new Int32Array(new SharedArrayBuffer(4)),0,0,${RETRY_DELAY_MS})`]);
        }
    }
    return null;
}

/** Liste lisible « nom (sévérité) » des avis d'un niveau donné. */
function listAtLeast(report, severities) {
    const vulns = report?.vulnerabilities ?? {};
    return Object.entries(vulns)
        .filter(([, v]) => severities.includes(v.severity))
        .map(([name, v]) => `${name} (${v.severity})`);
}

const skip = process.env.SKIP_AUDIT === "1";
if (skip) {
    console.warn("⚠️  SKIP_AUDIT=1 — porte de sécurité ignorée (à ne jamais faire en CI).");
}

// ── GATE 1 — ce qui est livré ───────────────────────────────────────────────
const prod = runAudit(["--omit=dev", "--audit-level=high"]);
if (!skip) {
    const prodFails = listAtLeast(prod, ["high", "critical"]);
    if (prodFails.length > 0) {
        console.error(`❌ Dépendances LIVRÉES vulnérables (high/critical) : ${prodFails.join(", ")}`);
        console.error("   Corrige (`npm audit fix`, ou un pin dans `overrides`) avant de pousser.");
        process.exit(1);
    }
}
console.log(
    `✅ Production : ${prod?.metadata?.vulnerabilities?.total ?? 0} vulnérabilité(s) — ` +
        "c'est ce qui part chez l'utilisateur.",
);

// ── GATE 2 — tout l'arbre, uniquement les critiques ────────────────────────
const full = runAudit(["--audit-level=critical"]);
if (!skip) {
    const criticals = listAtLeast(full, ["critical"]);
    if (criticals.length > 0) {
        console.error(`❌ Dépendance CRITIQUE (dev comprise) : ${criticals.join(", ")}`);
        process.exit(1);
    }
}

const residual = listAtLeast(full, ["high"]);
if (residual.length > 0) {
    console.warn(
        `ℹ️  ${residual.length} avis « high » hors production (non bloquants) : ${residual.join(", ")}`,
    );
    console.warn("   Suivi : rapport hebdo « Full Security Audit » du workflow `verify`.");
}
console.log("✅ Porte de sécurité franchie.");
