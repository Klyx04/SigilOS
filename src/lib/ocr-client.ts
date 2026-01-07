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
];

const DUNGEON_PATTERNS = [
    /donjon/i,
    /salle\s*\d+/i,
    /boss/i,
    /gardien/i,
];

const ANOMALY_PATTERNS = [
    /anomalie/i,
    /elixir\s*uchronique/i,
    /uchronique/i,
    /faille/i,
];

const SONGES_PATTERNS = [
    /songe/i,
    /r[eê]ve/i,
    /cauchemar/i,
    /paradoxe/i,
    /palier/i,
    /étage/i,
];

const EXPEDITION_PATTERNS = [
    /exp[eé]dition/i,
    /bravoure/i,
    /audace/i,
];

// --- Normalization Helpers ---

function normalizeText(text: string): string {
    return text
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '') // Remove accents
        .replace(/[^a-z0-9\s]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
}

function fuzzyMatch(text: string, target: string, threshold = 0.7): boolean {
    const normalizedText = normalizeText(text);
    const normalizedTarget = normalizeText(target);

    // Direct inclusion check
    if (normalizedText.includes(normalizedTarget)) return true;

    // Check each word
    const targetWords = normalizedTarget.split(' ');
    const matchedWords = targetWords.filter(word =>
        word.length > 2 && normalizedText.includes(word)
    );

    return matchedWords.length / targetWords.length >= threshold;
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
            missing.push(`Boss: ${bossName}`);
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

// --- Main Analysis Function ---

export async function analyzeScreenshot(
    imageFile: File,
    category: MissionCategory,
    payload: MissionPayload,
    onProgress?: (progress: number) => void
): Promise<OcrResult> {
    console.log(`[OCR-Client] Starting analysis for ${category} mission...`);

    try {
        // Run Tesseract OCR
        const result = await Tesseract.recognize(imageFile, 'fra', {
            logger: (m) => {
                if (m.status === 'recognizing text' && onProgress) {
                    onProgress(Math.round((m.progress || 0) * 100));
                }
            },
        });

        const rawText = result.data.text;
        const confidence = result.data.confidence;
        const textLower = rawText.toLowerCase();

        console.log(`[OCR-Client] Text extracted (${rawText.length} chars), confidence: ${confidence}%`);

        // Check for victory
        const victoryDetected = VICTORY_PATTERNS.some(p => p.test(rawText));

        const matchedElements: string[] = [];
        const missingElements: string[] = [];

        if (victoryDetected) {
            matchedElements.push("Victoire détectée");
        } else {
            missingElements.push("Victoire");
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
        if (victoryDetected) score += 30;
        if (categoryMatch) score += 25;
        if (contentMatch) score += 35;
        score += Math.round(confidence * 0.1);

        const isValid = victoryDetected && categoryMatch && contentMatch;

        console.log(`[OCR-Client] Analysis complete. Score: ${score}%, Valid: ${isValid}`);

        return {
            isValid,
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
            missingElements: ['Erreur OCR - validation manuelle requise'],
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
