"use client";

import { useState, useCallback, useEffect } from "react";
import { getPlatformConfig } from "@/server/actions/changelog-actions";
import { toast } from "sonner";

/**
 * 🛡️ SigilOS NSFW Guard
 * Uses TensorFlow.js + NSFWJS to filter images client-side.
 * Configurable via Toggle in God Dashboard.
 */

let cachedModel: any = null;
let isLoadingModel = false;

export function useNSFWDetector() {
    const [nsfwEnabled, setNsfwEnabled] = useState<boolean | null>(null);

    // Load platform setting on mount
    useEffect(() => {
        const checkConfig = async () => {
            try {
                // Not using fetch to avoid CORS/Auth complexities if we can just use the action
                const res = await getPlatformConfig();
                if (res.success) {
                    setNsfwEnabled(res.config?.nsfwFilterEnabled ?? true);
                } else {
                    setNsfwEnabled(true);
                }
            } catch (e) {
                setNsfwEnabled(true);
            }
        };
        checkConfig();
    }, []);

    /**
     * analyzeImage
     * Takes a File object, returns if it's safe plus optional error message.
     */
    const analyzeImage = useCallback(async (file: File): Promise<{ isSafe: boolean; error?: string }> => {
        // 1. Check if feature is globally toggled OFF
        if (nsfwEnabled === false) {
            return { isSafe: true };
        }

        // 2. Only analyze images (skip logs, scripts, etc. which are blocked elsewhere anyway)
        if (!file.type.startsWith("image/")) {
            return { isSafe: true };
        }

        try {
            // Lazy load libraries to avoid bloat on main bundle
            const [nsfwjs, tf] = await Promise.all([
                import("nsfwjs"),
                import("@tensorflow/tfjs")
            ]);

            // Ensure TF is ready
            await tf.ready();

            // Handle Singleton Loading
            if (!cachedModel && !isLoadingModel) {
                isLoadingModel = true;
                const loadingToast = toast.loading("Initialisation du filtre de sécurité IA (TensorFlow)...", {
                    description: "Cette opération ne se produit qu'une fois par session.",
                    duration: 5000
                });
                
                try {
                    // Load the model (Inception V3 is default and accurate)
                    cachedModel = await nsfwjs.load();
                    toast.dismiss(loadingToast);
                } catch (err) {
                    console.error("[NSFW] Model load error:", err);
                    toast.error("Échec du chargement du filtre de sécurité. Passage en mode sécurité réduite.");
                    isLoadingModel = false;
                    toast.dismiss(loadingToast);
                    return { isSafe: true }; 
                }
                isLoadingModel = false;
            }

            // Wait if another component is loading the model
            let waitCount = 0;
            while (isLoadingModel && waitCount < 50) { // Max 5s wait
                await new Promise(r => setTimeout(r, 100));
                waitCount++;
            }

            if (!cachedModel) return { isSafe: true };

            // Process image
            const img = new Image();
            const objectUrl = URL.createObjectURL(file);
            img.src = objectUrl;

            return new Promise((resolve) => {
                img.onload = async () => {
                    try {
                        const predictions = await cachedModel.classify(img);
                        URL.revokeObjectURL(objectUrl);

                        // Thresholds (Calibrated for Dofus screenshots)
                        // 'Porn', 'Hentai', 'Sexy', 'Neutral', 'Drawing'
                        const porn = predictions.find((p: any) => p.className === "Porn")?.probability || 0;
                        const hentai = predictions.find((p: any) => p.className === "Hentai")?.probability || 0;
                        const sexy = predictions.find((p: any) => p.className === "Sexy")?.probability || 0;

                        // DO NOT block 'Drawing' or 'Sexy' too aggressively to avoid false positives on Dofus characters.
                        // Porn & Hentai = Strict (75%)
                        // Sexy = Light (95%)
                        const isNsfw = porn > 0.75 || hentai > 0.75 || sexy > 0.95;

                        if (isNsfw) {
                            resolve({ 
                                isSafe: false, 
                                error: "Cette image a été bloquée par le filtre de sécurité SigilOS (Contenu inapproprié détecté)." 
                            });
                        } else {
                            resolve({ isSafe: true });
                        }
                    } catch (err) {
                        console.error("[NSFW] Classification Error:", err);
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
            console.error("[NSFW] General Error:", e);
            return { isSafe: true };
        }
    }, [nsfwEnabled]);

    return { analyzeImage, nsfwEnabled };
}
