'use client';

/**
 * Client-Side OCR Service
 * Runs Tesseract.js in the browser for mission screenshot validation
 * 
 * Benefits:
 * - No server load for OCR
 * - Scalable (each user processes their own image)
 * - Works with Next.js App Router
 */

import { useState, useCallback } from 'react';
import Tesseract from 'tesseract.js';

// --- Types ---

export interface OcrResult {
    isValid: boolean;
    score: number;
    categoryMatch: boolean;
    contentMatch: boolean;
    victoryDetected: boolean;
    matchedElements: string[];
    missingElements: string[];
    rawText: string;
    confidence: number;
}

export type MissionCategory =
    | 'DONJON'
    | 'REGULATION'
    | 'ANOMALIE'
    | 'SONGES'
    | 'EXPEDITION'
    | 'EVENT';

export interface MissionPayload {
    dungeonName?: string;
    bossName?: string;
    monsterName?: string;
    difficulty?: string;
    floorTarget?: number;
    mode?: string;
    type?: string;
    description?: string;
}

// --- Patterns for Dofus Screenshots ---

const VICTORY_PATTERNS = [
    /victoire/i,
    /victoire\s*!/i,
    /vous\s+avez\s+gagn/i,
    /combat\s+gagn/i,
    /remport/i,
    // Contextual patterns for mission cards (if user uploads the card itself instead of victory screen)
    /vaincre/i,
    /succès/i,
    /terminer/i,
    /lanc[eé]r/i,
];

const DUNGEON_PATTERNS = [
    /donjon/i,
    /salle\s*\d+/i,
    /boss/i,
    /gardien/i,
    /vaincre/i, // "Vaincre le Roi Nidas"
    /palais/i, // "Palais du roi..."
    /dimensi/i, // "Dimension..."
];

const ANOMALY_PATTERNS = [
    /anomalie/i,
    /elixir\s*uchronique/i,
    /uchronique/i,
    /faille/i,
    /zaap/i,
    /pixel/i,
];

const SONGES_PATTERNS = [
    /songe/i,
    /r[eê]ve/i,
    /cauchemar/i,
    /paradoxe/i,
    /palier/i,
    /étage/i,
    /reflet/i,
    /infini/i,
];

const EXPEDITION_PATTERNS = [
    /exp[eé]dition/i,
    /bravoure/i,
    /audace/i,
    /mercenaire/i,
];

const LEVEL_PATTERNS = [
    /niv\.?\s*(\d+)/i, // Niv. 200
    /niveau\s*(\d+)/i,
    /lvl\.?\s*(\d+)/i,
];

const RANK_PATTERNS = [
    /rang\s*(\d+)/i, // RANG 3
    /rank\s*(\d+)/i,
];

// --- Normalization Helpers ---

function normalizeText(text: string): string {
    return text
        .toLowerCase()
        .normalize('NFD') // Decompose combined graphemes
        .replace(/[\u0300-\u036f]/g, '') // Remove accents
        .replace(/[^a-z0-9\s]/g, ' ') // Replace symbols with space
        .replace(/\s+/g, ' ') // Collapse spaces
        .trim();
}

function fuzzyMatch(text: string, target: string, threshold = 0.6): boolean {
    if (!target) return false;
    const normalizedText = normalizeText(text);
    const normalizedTarget = normalizeText(target);

    // Direct inclusion check
    if (normalizedText.includes(normalizedTarget)) return true;

    // Check overlapping words
    const targetWords = normalizedTarget.split(' ').filter(w => w.length > 2);
    if (targetWords.length === 0) return false;

    const matchedWords = targetWords.filter(word =>
        normalizedText.includes(word)
    );

    // Lower threshold for short names vs long sentences
    const adjustedThreshold = targetWords.length > 3 ? 0.5 : threshold;

    return matchedWords.length / targetWords.length >= adjustedThreshold;
}

// --- Category Validation Functions ---

function validateDonjon(
    payload: MissionPayload,
    textLower: string,
    matched: string[],
    missing: string[]
): { categoryMatch: boolean; contentMatch: boolean } {
    let categoryMatch = DUNGEON_PATTERNS.some(p => p.test(textLower));
    let contentMatch = false;

    const bossName = payload.bossName || payload.dungeonName;
    if (bossName) {
        if (fuzzyMatch(textLower, bossName)) {
            matched.push(`Boss: ${bossName}`);
            contentMatch = true;
        } else {
            // Try matching "Vaincre [Boss]" pattern widely
            if (fuzzyMatch(textLower, `vaincre ${bossName}`)) {
                matched.push(`Boss: ${bossName}`);
                contentMatch = true;
            } else {
                missing.push(`Boss: ${bossName}`);
            }
        }
    }

    if (categoryMatch) matched.push("Contexte Donjon");

    return { categoryMatch, contentMatch };
}

function validateRegulation(
    payload: MissionPayload,
    textLower: string,
    matched: string[],
    missing: string[]
): { categoryMatch: boolean; contentMatch: boolean } {
    const categoryMatch = true; // Combat is always valid for regulation
    let contentMatch = false;

    const monsterName = payload.monsterName;
    if (monsterName) {
        if (fuzzyMatch(textLower, monsterName)) {
            matched.push(`Monstre: ${monsterName}`);
            contentMatch = true;
        } else {
            missing.push(`Monstre: ${monsterName}`);
        }
    }

    return { categoryMatch, contentMatch };
}

function validateAnomalie(
    payload: MissionPayload,
    textLower: string,
    matched: string[],
    missing: string[]
): { categoryMatch: boolean; contentMatch: boolean } {
    let categoryMatch = ANOMALY_PATTERNS.some(p => p.test(textLower));
    let contentMatch = false;

    // Look for "Elixir Uchronique" specifically
    if (/elixir\s*uchronique/i.test(textLower) || /uchronique/i.test(textLower)) {
        matched.push("Élixir Uchronique");
        contentMatch = true;
    } else {
        missing.push("Élixir Uchronique");
    }

    if (categoryMatch) matched.push("Contexte Anomalie");

    return { categoryMatch, contentMatch };
}

function validateSonges(
    payload: MissionPayload,
    textLower: string,
    matched: string[],
    missing: string[]
): { categoryMatch: boolean; contentMatch: boolean } {
    let categoryMatch = SONGES_PATTERNS.some(p => p.test(textLower));
    let contentMatch = false;

    // Check difficulty
    const difficulty = payload.difficulty?.toLowerCase();
    if (difficulty) {
        if (textLower.includes(difficulty)) {
            matched.push(`Difficulté: ${payload.difficulty}`);
            contentMatch = true;
        } else {
            missing.push(`Difficulté: ${payload.difficulty}`);
        }
    }

    // Check floor
    if (payload.floorTarget) {
        const floorMatch = textLower.match(/(?:palier|étage|floor)\s*(\d+)/i);
        if (floorMatch && parseInt(floorMatch[1]) >= payload.floorTarget) {
            matched.push(`Palier: ${floorMatch[1]}`);
            contentMatch = true;
        }
    }

    // Check boss name (Many Songes missions are "Kill Boss in Songes")
    const bossName = payload.bossName || payload.dungeonName;
    if (bossName) {
        if (fuzzyMatch(textLower, bossName)) {
            matched.push(`Boss: ${bossName}`);
            contentMatch = true;
        } else {
            missing.push(`Boss: ${bossName}`);
        }
    }

    if (categoryMatch) matched.push("Contexte Songes");

    return { categoryMatch, contentMatch };
}

function validateExpedition(
    payload: MissionPayload,
    textLower: string,
    matched: string[],
    missing: string[]
): { categoryMatch: boolean; contentMatch: boolean } {
    let categoryMatch = EXPEDITION_PATTERNS.some(p => p.test(textLower));
    let contentMatch = false;

    // Check mode
    const mode = payload.mode?.toLowerCase();
    if (mode) {
        if (textLower.includes(mode)) {
            matched.push(`Mode: ${payload.mode}`);
            contentMatch = true;
        } else {
            missing.push(`Mode: ${payload.mode}`);
        }
    }

    // Check boss name
    const bossName = payload.bossName || payload.dungeonName;
    if (bossName) {
        if (fuzzyMatch(textLower, bossName)) {
            matched.push(`Boss: ${bossName}`);
            contentMatch = true;
        } else {
            missing.push(`Boss: ${bossName}`);
        }
    }

    if (categoryMatch) matched.push("Contexte Expédition");

    return { categoryMatch, contentMatch };
}

// --- Color Analysis ---

interface ColorResult {
    hasGreenValidation: boolean;
    greenRatio: number;
}

// Range for Dofus "Green" validation (approx. #55aa55 or similar bright greens)
// We look for pixels where Green is dominant and significantly brighter than Red/Blue
function analyzeColors(imageFile: File): Promise<ColorResult> {
    return new Promise((resolve) => {
        const img = new Image();
        img.onload = () => {
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            if (!ctx) {
                resolve({ hasGreenValidation: false, greenRatio: 0 });
                return;
            }

            canvas.width = img.width;
            canvas.height = img.height;
            ctx.drawImage(img, 0, 0);

            const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
            const data = imageData.data;
            let greenPixelCount = 0;
            const totalPixels = data.length / 4;

            // Sample pixels (every 4th pixel for performance)
            for (let i = 0; i < data.length; i += 16) {
                const r = data[i];
                const g = data[i + 1];
                const b = data[i + 2];

                // Check for "Validation Green" - Multiple conditions for different green shades:
                // 1. Bright Neon Green (Dofus checkmark): High G (>150), G dominates R and B significantly
                // 2. Muted/Forest Green: G > 100, G dominates by 1.2x ratio
                const isBrightGreen = g > 150 && g > r * 1.5 && g > b * 1.2;
                const isMutedGreen = g > 100 && g > r * 1.2 && g > b * 1.2 && (g - r) > 30;

                if (isBrightGreen || isMutedGreen) {
                    greenPixelCount++;
                }
            }

            const greenRatio = (greenPixelCount * 4) / totalPixels;
            console.log(`[OCR-Client] Color Analysis - Green Ratio: ${(greenRatio * 100).toFixed(2)}%`);

            // Threshold: If > 0.3% of the image is "Validation Green", it's likely a checked card
            resolve({
                hasGreenValidation: greenRatio > 0.003,
                greenRatio
            });
        };
        img.onerror = (err) => {
            console.error("[OCR-Client] Color Analysis Image Load Error:", err);
            URL.revokeObjectURL(img.src);
            resolve({ hasGreenValidation: false, greenRatio: 0 });
        };
        const objectUrl = URL.createObjectURL(imageFile);
        img.src = objectUrl;

        // Ensure we revoke even if it hangs or other issues
        setTimeout(() => URL.revokeObjectURL(objectUrl), 10000);
    });
}

// --- Main Analysis Function ---

export async function analyzeScreenshot(
    imageFile: File,
    category: MissionCategory,
    payload: MissionPayload,
    onProgress?: (progress: number) => void
): Promise<OcrResult> {
    console.log(`[OCR-Client] Starting analysis for ${category} mission...`);

    try {
        // Parallel: Run OCR and Color Analysis
        const [ocrResult, colorResult] = await Promise.all([
            Tesseract.recognize(imageFile, 'fra', {
                logger: (m) => {
                    if (m.status === 'recognizing text' && onProgress) {
                        onProgress(Math.round((m.progress || 0) * 100));
                    }
                },
            }),
            analyzeColors(imageFile)
        ]);

        const rawText = ocrResult.data.text;
        const confidence = ocrResult.data.confidence;
        const textLower = rawText.toLowerCase();

        console.log(`[OCR-Client] Text extracted (${rawText.length} chars), confidence: ${confidence}%`);

        // Check for victory
        let victoryDetected = VICTORY_PATTERNS.some(p => p.test(rawText));

        const matchedElements: string[] = [];
        const missingElements: string[] = [];

        // Check for Rank and Level (Metadata)
        const levelMatch = LEVEL_PATTERNS.some(p => p.test(rawText));
        const rankMatch = RANK_PATTERNS.some(p => p.test(rawText));

        if (levelMatch) matchedElements.push("Niveau détecté");
        if (rankMatch) matchedElements.push("Rang détecté");

        // Color Feedback
        if (colorResult.hasGreenValidation) {
            matchedElements.push("Indicateur visuel vert (Validation)");
        }

        if (victoryDetected) {
            matchedElements.push("Victoire/Succès détecté");
        } else {
            // If we rely on color, we still want to mention if Victory text is missing
            // unless we are 100% sure it's a card check
            if (!colorResult.hasGreenValidation) {
                missingElements.push("Victoire ou Validation visuelle");
            }
        }

        // Validate by category
        let categoryMatch = false;
        let contentMatch = false;

        switch (category) {
            case 'DONJON':
                ({ categoryMatch, contentMatch } = validateDonjon(payload, textLower, matchedElements, missingElements));
                break;
            case 'REGULATION':
                ({ categoryMatch, contentMatch } = validateRegulation(payload, textLower, matchedElements, missingElements));
                break;
            case 'ANOMALIE':
                ({ categoryMatch, contentMatch } = validateAnomalie(payload, textLower, matchedElements, missingElements));
                break;
            case 'SONGES':
                ({ categoryMatch, contentMatch } = validateSonges(payload, textLower, matchedElements, missingElements));
                break;
            case 'EXPEDITION':
                ({ categoryMatch, contentMatch } = validateExpedition(payload, textLower, matchedElements, missingElements));
                break;
            case 'EVENT':
                categoryMatch = true;
                contentMatch = victoryDetected;
                break;
        }

        // Calculate score
        let score = 0;

        // Base score elements
        if (victoryDetected) score += 30;
        if (categoryMatch) score += 20;
        if (contentMatch) score += 30;

        // Metadata bonuses
        if (levelMatch) score += 5;
        if (rankMatch) score += 5;

        // Color Bonus (Significant!)
        if (colorResult.hasGreenValidation) score += 20;

        // Confidence bonus/malus
        score += Math.round(confidence * 0.1);

        // Smart Validation Logic
        // Valid if:
        // 1. Victory Text + Content Match (Classic Victory Screen)
        // 2. OR: Content Match + Color Validation + (Level OR Rank) (Checked Mission Card)

        const isClassicVictory = victoryDetected && contentMatch;
        const isCheckedCard = contentMatch && colorResult.hasGreenValidation && (levelMatch || rankMatch);

        // Strictly require Victory Text OR Green Validation for "isValid"
        const isValid = isClassicVictory || isCheckedCard;

        console.log(`[OCR-Client] Analysis complete. Score: ${score}%, Valid: ${isValid} (Victory: ${victoryDetected}, Green: ${colorResult.hasGreenValidation})`);

        return {
            isValid: isValid && score >= 70, // Require decent score even if logic passes
            score: Math.min(score, 100),
            categoryMatch,
            contentMatch,
            victoryDetected,
            matchedElements,
            missingElements,
            rawText,
            confidence,
        };
    } catch (error) {
        console.error('[OCR-Client] Error:', error);
        return {
            isValid: false,
            score: 0,
            categoryMatch: false,
            contentMatch: false,
            victoryDetected: false,
            matchedElements: [],
            missingElements: [`Erreur OCR: ${error instanceof Error ? error.message : 'Détails inconnus'} - validation manuelle requise`],
            rawText: '',
            confidence: 0,
        };
    }
}

// --- React Hook ---

export function useClientOcr() {
    const [isAnalyzing, setIsAnalyzing] = useState(false);
    const [progress, setProgress] = useState(0);
    const [result, setResult] = useState<OcrResult | null>(null);

    const analyze = useCallback(async (
        file: File,
        category: MissionCategory,
        payload: MissionPayload
    ) => {
        setIsAnalyzing(true);
        setProgress(0);
        setResult(null);

        try {
            const ocrResult = await analyzeScreenshot(file, category, payload, setProgress);
            setResult(ocrResult);
            return ocrResult;
        } finally {
            setIsAnalyzing(false);
        }
    }, []);

    const reset = useCallback(() => {
        setIsAnalyzing(false);
        setProgress(0);
        setResult(null);
    }, []);

    return {
        isAnalyzing,
        progress,
        result,
        analyze,
        reset,
    };
}
