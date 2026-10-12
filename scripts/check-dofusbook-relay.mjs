/**
 * Diagnostic du relais Dofusbook — vérifie ce que feront réellement l'app (VPS) et le
 * navigateur d'un membre :
 *   · route SERVEUR  `GET /{id}`          (en-tête `X-SigilOS-Key`) → `getDofusbookPreview()`
 *   · route PUBLIQUE `GET /s/{id}?e=&t=`  (jeton HMAC 5 min)       → bake navigateur
 *   · fail-closed (401 sans clé, 403 jeton invalide) et CORS
 *
 * Usage (Windows PowerShell comme Linux/macOS) :
 *   node --env-file=.env --env-file=.env.local scripts/check-dofusbook-relay.mjs [buildId]
 *
 * Sortie attendue si le relais est sain :
 *   1. serveur  → 200 application/json … JSON <nom du build> · items=N · cloths=M
 *   2. serveur  → 401 (clé absente)
 *   3. navigateur → 200 application/json …
 *   4. navigateur → 403 (jeton faux)
 */
import crypto from "node:crypto";

const RELAY = (process.env.DOFUSBOOK_CF_WORKER_URL || "").replace(/\/+$/, "");
const SECRET = process.env.DOFUSBOOK_WORKER_SECRET || "";
const SIGN = process.env.DOFUSBOOK_WORKER_SIGN_SECRET || SECRET;
const ID = process.argv[2] || "16582901";

if (!RELAY) {
    console.error("❌ DOFUSBOOK_CF_WORKER_URL absent (voir docs/reference/GALERIE-DOFUSBOOK-RELAIS.md §3)");
    process.exit(1);
}

async function probe(label, url, headers) {
    const t0 = Date.now();
    try {
        const res = await fetch(url, { headers, signal: AbortSignal.timeout(20000) });
        const text = await res.text();
        let summary = "";
        try {
            const json = JSON.parse(text);
            const items = Array.isArray(json?.items) ? json.items.length : 0;
            const cloths = Array.isArray(json?.cloths) ? json.cloths.length : 0;
            summary = `JSON ${json?.stuff?.name ?? "?"} · items=${items} · cloths=${cloths}`;
        } catch {
            summary = text.slice(0, 60).replace(/\s+/g, " ");
        }
        console.log(`${label} → ${res.status} ${res.headers.get("content-type")} ${text.length} o · ${summary} (${Date.now() - t0} ms)`);
        return res.status;
    } catch (err) {
        console.log(`${label} → ERREUR ${err?.name}: ${err?.message} (${Date.now() - t0} ms)`);
        return 0;
    }
}

const exp = Math.floor(Date.now() / 1000) + 300;
const token = crypto.createHmac("sha256", SIGN).update(`${ID}.${exp}`).digest("hex");

console.log(`relais : ${RELAY}`);
console.log(`secret : ${SECRET ? `${SECRET.length} car.` : "❌ ABSENT"} · sign secret : ${SIGN ? `${SIGN.length} car.` : "❌ ABSENT"}\n`);

await probe("1. serveur    /{id}   (X-SigilOS-Key)", `${RELAY}/${ID}`, { Accept: "application/json", "X-SigilOS-Key": SECRET });
await probe("2. serveur    /{id}   (sans clé → 401 attendu)", `${RELAY}/${ID}`, { Accept: "application/json" });
await probe("3. navigateur /s/{id} (HMAC valide)", `${RELAY}/s/${ID}?e=${exp}&t=${token}`, { Accept: "application/json" });
await probe("4. navigateur /s/{id} (HMAC faux → 403 attendu)", `${RELAY}/s/${ID}?e=${exp}&t=${"0".repeat(64)}`, { Accept: "application/json" });
