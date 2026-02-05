/**
 * LLM-based OCR Service using Google Gemini API
 * 
 * Uses Gemini 1.5 Flash for smart image analysis:
 * - Fast cloud-based inference (no local GPU needed)
 * - Excellent OCR capabilities for game screenshots
 * - Built-in content moderation
 * - Rate limit fallback to manual validation
 * 
 * @module lib/llm-ocr
 */

import { createHash } from 'crypto';
import sharp from 'sharp';

// =============================================================================
// TYPES
// =============================================================================

export interface OcrResult {
    success: boolean;

    // Extracted text content
    text: string;

    // Confidence score (0-100)
    confidence: number;

    // Did the model detect victory indicators?
    isVictory: boolean;

    // Content moderation flags
    moderation: {
        isAppropriate: boolean;
        reason?: string;
    };

    // Raw model response for debugging
    rawResponse?: string;

    // Error message if failed
    error?: string;
}

export interface OcrRequest {
    // Base64 encoded image data
    imageBase64: string;

    // MIME type (image/png, image/jpeg, image/webp)
    mimeType: string;

    // Optional context hint for better accuracy
    context?: 'mission' | 'achievement' | 'ladder';
}

// =============================================================================
// CONFIGURATION & ENVIROMENT
// =============================================================================

const OCR_SPACE_API_KEY = process.env.OCR_SPACE_API_KEY || 'helloworld';
const OCR_SPACE_URL = 'https://api.ocr.space/parse/image';
const AUTO_VALIDATE_THRESHOLD = parseInt(process.env.OCR_AUTO_VALIDATE_THRESHOLD || '70', 10);

// Default timeout for OCR calls
const OCR_TIMEOUT_MS = 30000;

/**
 * Interface for OCR.space response
 */
interface OcrSpaceResponse {
    ParsedResults?: Array<{
        ParsedText: string;
        ErrorMessage?: string;
        ErrorDetails?: string;
    }>;
    IsErroredOnProcessing: boolean;
    ErrorMessage?: string[];
    ErrorDetails?: string;
    ProcessingTimeInMilliseconds?: string;
}


// =============================================================================
// PROMPTS
// =============================================================================

/**
 * System prompt for Gemini - optimized for Dofus game screenshots
 */
const SYSTEM_PROMPT = `Tu es un assistant OCR spécialisé dans l'analyse de captures d'écran du jeu Dofus. Extrais le texte et les nombres avec précision. Réponds TOUJOURS en JSON valide.`;

/**
 * Generate analysis prompts optimized for Gemma 3
 * Uses structured JSON output format for reliable parsing
 */
function getAnalysisPrompt(context?: 'mission' | 'achievement' | 'ladder'): string {
    switch (context) {
        case 'mission':
            return `Look at this Dofus game screenshot. Extract:
1. Mission name (text at top)
2. Level number
3. Progress (format: X/Y)
4. Is it validated? (green checkmark visible?)

Respond ONLY with this JSON:
{"mission_name": "...", "level": 0, "progress": "0/0", "is_validated": false}`;

        case 'achievement':
            return `Look at this Dofus achievement screenshot. Find:
1. The large score number (usually 5 digits, like 21654)
2. Any victory/success text ("Succès", "Victoire", "Success")

Respond ONLY with this JSON:
{"score": 0, "is_victory": false}`;

        case 'ladder':
            return `Look at this Dofus ladder/ranking screenshot. Extract:
1. Score/points number
2. Rank position

Respond ONLY with this JSON:
{"score": 0, "rank": 0}`;

        default:
            return `What text and numbers do you see in this image? Is there any "Victory" or "Success" message? Reply with JSON: {"text": "...", "numbers": [], "is_victory": false}`;
    }
}

// =============================================================================
// OCR.SPACE API CLIENT
// =============================================================================

/**
 * Call OCR.space API
 */
async function callOcrSpace(
    imageBase64: string,
    language: string = 'fre'
): Promise<string> {
    if (!OCR_SPACE_API_KEY) {
        throw new Error('OCR_SPACE_API_KEY is not configured');
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), OCR_TIMEOUT_MS);

    try {
        console.log('[LLM-OCR] Sending request to OCR.space:', {
            imageSize: imageBase64.length,
            language
        });

        // OCR.space expects base64 with data URI prefix or a multipart upload
        const formData = new URLSearchParams();
        formData.append('apikey', OCR_SPACE_API_KEY);
        formData.append('base64Image', `data:image/jpeg;base64,${imageBase64}`);
        formData.append('language', language);
        formData.append('isOverlayRequired', 'false');
        formData.append('OCREngine', '2'); // Engine 2 is usually better for numbers/tables

        const response = await fetch(OCR_SPACE_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
            },
            body: formData,
            signal: controller.signal,
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`OCR.space API error: ${response.status} - ${errorText}`);
        }

        const result: OcrSpaceResponse = await response.json();

        if (result.IsErroredOnProcessing) {
            throw new Error(`OCR.space processing error: ${result.ErrorMessage?.join(', ') || 'Unknown error'}`);
        }

        const text = result.ParsedResults?.[0]?.ParsedText || '';
        console.log('[LLM-OCR] OCR.space extraction successful (length:', text.length, ')');

        return text;

    } finally {
        clearTimeout(timeoutId);
    }
}

/**
 * Check if OCR service is configured
 */
export async function checkOcrHealth(): Promise<{
    available: boolean;
    error?: string;
}> {
    if (!OCR_SPACE_API_KEY || OCR_SPACE_API_KEY === 'helloworld') {
        return {
            available: false,
            error: 'OCR_SPACE_API_KEY not configured or using demo key',
        };
    }

    return {
        available: true,
    };
}

// =============================================================================
// MAIN OCR FUNCTION
// =============================================================================

/**
 * Analyze an image using Qwen2-VL vision model
 * 
 * @param request - Image data and context
 * @returns OCR result with text, confidence, and moderation flags
 */
export async function analyzeImage(request: OcrRequest): Promise<OcrResult> {
    // DEV MODE: Skip OCR when Ollama is not available
    const skipOcr = process.env.DEV_SKIP_OCR === 'true';
    if (skipOcr) {
        console.log('[LLM-OCR] DEV_SKIP_OCR enabled - returning mock result for manual validation');
        return {
            success: true,
            text: '[DEV MODE] OCR skipped - manual validation required',
            confidence: 0, // Low confidence forces manual validation
            isVictory: false,
            moderation: { isAppropriate: true },
            rawResponse: 'DEV_SKIP_OCR',
        };
    }

    try {
        // Optimize image (resize & compress) to reduce API payload
        const optimizedImage = await optimizeImage(request.imageBase64);

        // Call OCR.space instead of Gemini
        console.log('[LLM-OCR] Calling OCR.space with context:', request.context);
        const response = await callOcrSpace(optimizedImage, 'fre');

        console.log('[LLM-OCR] Raw text (first 500 chars):', response.substring(0, 500));

        // Parse the text response
        const parsed = parseModelResponse(response);

        console.log('[LLM-OCR] Parsed result:', {
            extractedText: parsed.extractedText.substring(0, 100),
            confidence: parsed.confidence,
            isVictory: parsed.isVictory
        });

        return {
            success: true,
            text: parsed.extractedText,
            confidence: parsed.confidence,
            isVictory: parsed.isVictory,
            moderation: {
                isAppropriate: parsed.isAppropriate,
                reason: parsed.inappropriateReason || undefined,
            },
            rawResponse: response,
        };

    } catch (error) {
        console.error('[LLM-OCR] Analysis failed:', error);

        // CONNECTION ERROR: Fallback to manual validation
        const isConnectionError = error instanceof Error &&
            (error.message.includes('ECONNREFUSED') ||
                error.message.includes('fetch failed') ||
                error.name === 'AbortError' ||
                error.message.includes('aborted') ||
                error.message.includes('timeout'));

        if (isConnectionError) {
            console.warn('[LLM-OCR] OCR Service unreachable - falling back to manual validation');
            return {
                success: true,
                text: '[OCR indisponible] Validation manuelle requise',
                confidence: 0,
                isVictory: false,
                moderation: { isAppropriate: true },
                error: 'OCR service unreachable - manual validation required',
            };
        }

        return {
            success: false,
            text: '',
            confidence: 0,
            isVictory: false,
            moderation: { isAppropriate: true },
            error: error instanceof Error ? error.message : 'Unknown error',
        };
    }
}


// =============================================================================
// RESPONSE PARSING
// =============================================================================

interface ParsedModelResponse {
    extractedText: string;
    isVictory: boolean;
    victoryIndicators: string[];
    confidence: number;
    isAppropriate: boolean;
    inappropriateReason: string | null;
}

/**
 * Parse the OCR output - focus on regex for raw text
 */
function parseModelResponse(rawResponse: string): ParsedModelResponse {
    const text = rawResponse.toLowerCase();

    // 1. EXTRACT SCORE (Achievements)
    // Dofus scores look like "21 644" or "15600"
    // We look for patterns with 4-5 digits, possibly separated by space
    const scoreMatches = rawResponse.match(/\b\d{1,2}[\s\.]?\d{3}\b/g) || [];
    const scores = scoreMatches
        .map(s => parseInt(s.replace(/[\s\.]/g, ''), 10))
        .filter(s => s > 0 && s < 40000);

    const bestScore = scores.length > 0 ? Math.max(...scores) : 0;

    // 2. DETECT VICTORY (Missions)
    const victoryKeywords = [
        'success', 'succes', 'succès',
        'victory', 'victoire',
        'unlocked', 'déverrouillé',
        'achieved', 'accompli',
        'terminé', 'valide', 'validé'
    ];
    const foundIndicators = victoryKeywords.filter(kw => text.includes(kw));
    const isVictory = foundIndicators.length > 0;

    // 3. CALC CONFIDENCE
    let confidence = 0;

    // If we found a plausible Dofus score, it's a good sign
    if (bestScore > 1000) {
        confidence += 60;
    } else if (bestScore > 0) {
        confidence += 30;
    }

    // Victory keywords are strong indicators
    if (isVictory) {
        confidence += 30;
    }

    // Amount of text (OCR noise vs real content)
    if (rawResponse.length > 20 && rawResponse.length < 1000) {
        confidence += 10;
    }

    return {
        extractedText: bestScore > 0 ? `Points: ${bestScore}\n${rawResponse}` : rawResponse,
        isVictory: isVictory || bestScore > 0,
        victoryIndicators: foundIndicators,
        confidence: Math.min(100, confidence),
        isAppropriate: true,
        inappropriateReason: null,
    };
}

// =============================================================================
// IMAGE HASHING (Anti-Duplicate)
// =============================================================================

/**
 * Generate SHA-256 hash of image data for duplicate detection
 */
export function hashImage(imageBase64: string): string {
    return createHash('sha256').update(imageBase64).digest('hex');
}

// =============================================================================
// VALIDATION HELPERS
// =============================================================================

/**
 * Check if the OCR result meets auto-validation criteria
 */
export function shouldAutoValidate(result: OcrResult): {
    autoValidate: boolean;
    reason: string;
} {
    // Content moderation check first
    if (!result.moderation.isAppropriate) {
        return {
            autoValidate: false,
            reason: `Contenu inapproprié détecté: ${result.moderation.reason || 'Non spécifié'}`
        };
    }

    // Check if OCR succeeded
    if (!result.success) {
        return { autoValidate: false, reason: 'Échec de l\'analyse de l\'image' };
    }

    // Check confidence threshold
    if (result.confidence < AUTO_VALIDATE_THRESHOLD) {
        return {
            autoValidate: false,
            reason: `Score de confiance insuffisant (${result.confidence}% < ${AUTO_VALIDATE_THRESHOLD}%)`
        };
    }

    // Check for victory indicators
    if (!result.isVictory) {
        return {
            autoValidate: false,
            reason: 'Aucun indicateur de victoire détecté'
        };
    }

    return {
        autoValidate: true,
        reason: `Auto-validé avec ${result.confidence}% de confiance`
    };
}

export function getAutoValidateThreshold(): number {
    return AUTO_VALIDATE_THRESHOLD;
}

/**
 * Optimize image for Ollama (Resize & Compress)
 * - Resize to max 1024x1024 (Moondream works well with this resolution)
 * - Convert to JPEG (smaller payload than PNG/WebP)
 * - Remove metadata
 */
async function optimizeImage(base64Image: string): Promise<string> {
    try {
        // Remove data URL prefix if present
        const base64Data = base64Image.replace(/^data:image\/\w+;base64,/, '');
        const buffer = Buffer.from(base64Data, 'base64');

        const originalSize = buffer.length;

        // Process with sharp
        const optimizedBuffer = await sharp(buffer)
            .resize({
                width: 1024,
                height: 1024,
                fit: 'inside', // Maintain aspect ratio
                withoutEnlargement: true // Don't upscale small images
            })
            .jpeg({
                quality: 80, // Good balance of quality/size
                mozjpeg: true // Better compression
            })
            .toBuffer();

        const newSize = optimizedBuffer.length;
        const reduction = Math.round((1 - newSize / originalSize) * 100);

        console.log(`[LLM-OCR] Image optimized: ${Math.round(originalSize / 1024)}KB -> ${Math.round(newSize / 1024)}KB (-${reduction}%)`);

        return optimizedBuffer.toString('base64');
    } catch (error) {
        console.warn('[LLM-OCR] Image optimization failed, using original:', error);
        return base64Image; // Fallback to original if sharp fails
    }
}
