import { getPlatformConfig } from "@/server/actions/changelog-actions";

export interface SafetyResult {
    isSafe: boolean;
    reason?: string;
    predictions?: any[];
}

let cachedModel: any = null;
let isLoadingModel = false;

/**
 * 🛡️ SigilOS Safety Core
 * Replaced the stub with real TensorFlow + NSFWJS analysis.
 */
export async function analyzeImageSafety(file: File): Promise<SafetyResult> {
    try {
        // 1. Check if feature is globally toggled (cached for current session? No, let's just fetch once or rely on server action caching)
        const configRes = await getPlatformConfig();
        if (configRes.success && configRes.config?.nsfwFilterEnabled === false) {
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

        if (!cachedModel) return { isSafe: true };

        // 4. Create image and classify
        const img = new Image();
        const objectUrl = URL.createObjectURL(file);
        img.src = objectUrl;

        return new Promise((resolve) => {
            img.onload = async () => {
                try {
                    const predictions = await cachedModel.classify(img);
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
                } catch (err) {
                    URL.revokeObjectURL(objectUrl);
                    resolve({ isSafe: true });
                }
            };
            img.onerror = () => {
                URL.revokeObjectURL(objectUrl);
                resolve({ isSafe: true });
            };
        });
    } catch (e) {
        console.error("[Safety Engine] Fatal error:", e);
        return { isSafe: true };
    }
}
