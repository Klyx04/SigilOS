import { getPlatformConfig } from "@/server/actions/changelog-actions";

export interface SafetyResult {
    isSafe: boolean;
    reason?: string;
    predictions?: any[];
    /** Avertissement non bloquant (ex : filtre indisponible / timeout). */
    warning?: string;
}

let cachedModel: any = null;
let isLoadingModel = false;

/**
 * Pré-charge le modèle NSFWJS (fire-and-forget) dès l'ouverture d'un formulaire
 * pour que le premier collage/sélection ne subisse pas le téléchargement du modèle.
 */
export function warmUpSafetyModel() {
    if (cachedModel || isLoadingModel) return;
    Promise.all([import("nsfwjs"), import("@tensorflow/tfjs")])
        .then(async ([nsfwjs, tf]) => {
            await tf.ready();
            cachedModel = await nsfwjs.load();
        })
        .catch(() => { /* best-effort — la prochaine analyse retentera */ });
}

/** Timeout borné (perf #21) : une classification ne doit jamais geler le formulaire. */
function withClassifyTimeout<T>(p: Promise<T>, ms = 6_000): Promise<T> {
    return Promise.race([
        p,
        new Promise<T>((_, reject) => setTimeout(() => reject(new Error(`NSFW classify timeout (${ms}ms)`)), ms)),
    ]);
}

/** Cache session de la config (évite un round-trip server action à chaque image). */
let nsfwConfigCache: boolean | null = null;

/**
 * 🛡️ SigilOS Safety Core
 * TensorFlow + NSFWJS analysis (filtre dissuasif côté client — pas de coût IA serveur).
 */
export async function analyzeImageSafety(file: File): Promise<SafetyResult> {
    try {
        // 1. Config globale (cachée par session) — off → on ne bloque rien.
        if (nsfwConfigCache === null) {
            const configRes = await getPlatformConfig();
            nsfwConfigCache = configRes.success ? (configRes.config?.nsfwFilterEnabled ?? true) : true;
        }
        if (nsfwConfigCache === false) {
            return { isSafe: true, predictions: [] };
        }

        // 2. Load dependencies lazily
        const [nsfwjs, tf] = await Promise.all([
            import("nsfwjs"),
            import("@tensorflow/tfjs")
        ]);

        await tf.ready();

        // 3. Singleton model loading
        if (!cachedModel && !isLoadingModel) {
            isLoadingModel = true;
            try {
                cachedModel = await nsfwjs.load(); // mobilenet_v2 is standard
            } finally {
                isLoadingModel = false;
            }
        }

        // Wait if loading
        while (isLoadingModel) {
            await new Promise(r => setTimeout(r, 100));
        }

        if (!cachedModel) return { isSafe: true, warning: "Filtre de sécurité indisponible (modèle non chargé)." };

        // 4. Create image and classify (borné 6s — l'aperçu est déjà affiché, on ne gèle pas le formulaire)
        const img = new Image();
        const objectUrl = URL.createObjectURL(file);
        img.src = objectUrl;

        return new Promise((resolve) => {
            img.onload = async () => {
                try {
                    const predictions = await withClassifyTimeout<any[]>(cachedModel.classify(img));
                    URL.revokeObjectURL(objectUrl);

                    const porn = predictions.find((p: any) => p.className === "Porn")?.probability || 0;
                    const hentai = predictions.find((p: any) => p.className === "Hentai")?.probability || 0;
                    const sexy = predictions.find((p: any) => p.className === "Sexy")?.probability || 0;

                    // Calibrated thresholds for Dofus False Positives
                    const isNsfw = porn > 0.75 || hentai > 0.75 || sexy > 0.95;

                    if (isNsfw) {
                        resolve({ 
                            isSafe: false, 
                            reason: "Contenu inapproprié détecté par l'IA.",
                            predictions 
                        });
                    } else {
                        resolve({ isSafe: true, predictions });
                    }
                } catch {
                    URL.revokeObjectURL(objectUrl);
                    resolve({ isSafe: true, warning: "Filtre de sécurité indisponible (analyse expirée). L'image n'est pas bloquée." });
                }
            };
            img.onerror = () => {
                URL.revokeObjectURL(objectUrl);
                resolve({ isSafe: true, warning: "Image illisible par le filtre de sécurité." });
            };
        });
    } catch (e) {
        console.error("[Safety Engine] Fatal error:", e);
        return { isSafe: true, warning: "Filtre de sécurité indisponible." };
    }
}

/**
 * 🔐 Journalise une tentative NSFW bloquée : côté guilde (audit SECURITY_ALERT +
 * alerte Discord) ET côté God (notification système). Non bloquant (best-effort).
 */
export async function logNsfwAttempt(guildId: string, detail?: string): Promise<void> {
    const message = detail || "Tentative d'upload d'une image bloquée par le filtre NSFW.";
    try {
        const { reportSecurityIncident } = await import("@/server/actions/audit-actions");
        await reportSecurityIncident(guildId, "NSFW_BLOCKED", message, { source: "client-safety", clientOnly: true });
    } catch { /* best-effort */ }
    try {
        const { notifyGod } = await import("@/server/actions/god-notif-actions");
        await notifyGod({
            title: "🚫 Upload NSFW bloqué",
            message,
            type: "SECURITY_ALERT",
            success: false,
            metadata: { guildId },
        });
    } catch { /* best-effort */ }
}
