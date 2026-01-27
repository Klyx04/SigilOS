'use client';

import * as nsfwjs from 'nsfwjs';
import * as tf from '@tensorflow/tfjs';

// Initialize TensorFlow.js (WASM backend is often better for CPU but webgl is default and faster)
// We don't strictly need to call this, but it's good practice.
tf.ready();

let model: nsfwjs.NSFWJS | null = null;
let modelLoadingPromise: Promise<nsfwjs.NSFWJS> | null = null;

/**
 * Load the NSFW model (Singleton)
 */
/**
 * Load the NSFW model (Singleton)
 */
async function loadModel(): Promise<nsfwjs.NSFWJS> {
    if (model) return model;
    if (modelLoadingPromise) return modelLoadingPromise;

    console.log('[Safety-Client] Loading NSFW model...');

    const load = async () => {
        try {
            // Loading strictly from local files - detected as Layers Model
            return await nsfwjs.load('/models/nsfw/', { type: 'layers' });
        } catch (err) {
            console.error('[Safety-Client] Failed to load model from CDN:', err);
            throw err;
        }
    };

    modelLoadingPromise = load();
    model = await modelLoadingPromise;
    console.log('[Safety-Client] NSFW model loaded successfully.');
    return model;
}

export interface SafetyResult {
    isSafe: boolean;
    reason?: string;
    predictions: nsfwjs.PredictionType[];
}

/**
 * Analyze an image file for inappropriate content
 */
export async function analyzeImageSafety(file: File): Promise<SafetyResult> {
    try {
        const nsfwModel = await loadModel();

        // Create an image element to analyze
        return new Promise((resolve) => {
            const img = new Image();
            img.onload = async () => {
                try {
                    const predictions = await nsfwModel.classify(img);

                    // DEBUG: Log predictions to console for owner investigation
                    console.log('[Safety-Client] Predictions:', predictions);
                    console.table(predictions.map(p => ({ category: p.className, score: (p.probability * 100).toFixed(2) + '%' })));

                    // ACCESSIBLE THRESHOLDS (HARDENED - PARANOID MODE)
                    // Porn or Hentai matching - extremely sensitive
                    const nsfwFlag = predictions.find(p =>
                        (p.className === 'Porn' || p.className === 'Hentai') && p.probability > 0.15 // Lowered to 15%
                    );

                    // Also watch for "Sexy" (suggestive content)
                    const sexyFlag = predictions.find(p =>
                        p.className === 'Sexy' && p.probability > 0.4 // Lowered to 40%
                    );

                    const isSafe = !nsfwFlag && !sexyFlag;

                    let reason = undefined;
                    // Always format scores for debugging
                    const debugScores = predictions.map(p => `${p.className}: ${Math.round(p.probability * 100)}%`).join(', ');

                    if (nsfwFlag) reason = `Contenu explicite détecté (${(nsfwFlag.probability * 100).toFixed(0)}%)`;
                    else if (sexyFlag) reason = `Contenu suggestif détecté (${(sexyFlag.probability * 100).toFixed(0)}%)`;



                    // Cleanup
                    URL.revokeObjectURL(img.src);

                    resolve({
                        isSafe,
                        reason,
                        predictions
                    });
                } catch (err) {
                    console.error('[Safety-Client] Classification error:', err);
                    // SECURITY BY DEFAULT: Block if analysis fails
                    resolve({ isSafe: false, reason: "Échec de l'analyse de sécurité. Veuillez réessayer.", predictions: [] });
                }
            };
            img.onerror = () => {
                URL.revokeObjectURL(img.src);
                resolve({ isSafe: false, reason: "Impossible de charger l'image pour analyse de sécurité.", predictions: [] });
            };
            img.src = URL.createObjectURL(file);
        });
    } catch (error) {
        console.error('[Safety-Client] Safety analysis initialization failed:', error);
        // SECURITY BY DEFAULT: Block if model fails to load
        return {
            isSafe: false,
            reason: `Erreur d'init: ${(error as any).message || error}`,
            predictions: []
        };
    }
}
