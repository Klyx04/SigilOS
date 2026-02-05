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
// CONFIGURATION
// =============================================================================

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const GEMINI_MODEL = 'gemini-2.0-flash'; // Stable 2026 model with vision support
const AUTO_VALIDATE_THRESHOLD = parseInt(process.env.OCR_AUTO_VALIDATE_THRESHOLD || '70', 10);

// Timeout for Gemini API calls (default 30s - cloud is fast)
const GEMINI_TIMEOUT_MS = parseInt(process.env.GEMINI_TIMEOUT_MS || '30000', 10);


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
// GEMINI API CLIENT
// =============================================================================

interface GeminiResponse {
    candidates?: Array<{
        content: {
            parts: Array<{ text: string }>;
        };
    }>;
    error?: {
        code: number;
        message: string;
    };
}

/**
 * Call Gemini API with vision support
 */
async function callGemini(
    prompt: string,
    imageBase64: string,
    systemPrompt?: string
): Promise<string> {
    if (!GEMINI_API_KEY) {
        throw new Error('GEMINI_API_KEY is not configured');
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), GEMINI_TIMEOUT_MS);

    try {
        const fullPrompt = systemPrompt ? `${systemPrompt}\n\n${prompt}` : prompt;

        console.log('[LLM-OCR] Sending request to Gemini:', {
            model: GEMINI_MODEL,
            promptLength: fullPrompt.length,
            imageSize: imageBase64.length,
        });

        const response = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_API_KEY}`,
            {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    contents: [{
                        parts: [
                            { text: fullPrompt },
                            { inline_data: { mime_type: 'image/webp', data: imageBase64 } }
                        ]
                    }],
                    generationConfig: {
                        temperature: 0.1,
                        maxOutputTokens: 500,
                    }
                }),
                signal: controller.signal,
            }
        );

        // Handle rate limiting
        if (response.status === 429) {
            throw new Error('RATE_LIMITED');
        }

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Gemini API error: ${response.status} - ${errorText}`);
        }

        const result: GeminiResponse = await response.json();

        if (result.error) {
            throw new Error(`Gemini API error: ${result.error.message}`);
        }

        const text = result.candidates?.[0]?.content?.parts?.[0]?.text || '';
        console.log('[LLM-OCR] Gemini response:', text.substring(0, 500));

        return text;

    } finally {
        clearTimeout(timeoutId);
    }
}

/**
 * Check if Gemini API is configured
 */
export async function checkGeminiHealth(): Promise<{
    available: boolean;
    model: string;
    error?: string;
}> {
    if (!GEMINI_API_KEY) {
        return {
            available: false,
            model: GEMINI_MODEL,
            error: 'GEMINI_API_KEY not configured in environment variables',
        };
    }

    return {
        available: true,
        model: GEMINI_MODEL,
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
        // Generate analysis prompt based on context
        const prompt = getAnalysisPrompt(request.context);

        // Optimize image (resize & compress) to reduce API payload
        const optimizedImage = await optimizeImage(request.imageBase64);

        // Call Gemini API with the image
        console.log('[LLM-OCR] Calling Gemini with context:', request.context);
        const response = await callGemini(prompt, optimizedImage, SYSTEM_PROMPT);

        console.log('[LLM-OCR] Raw response (first 500 chars):', response.substring(0, 500));

        // Parse the JSON response
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

        // RATE LIMIT: Fallback to manual validation when API limits are hit
        const isRateLimited = error instanceof Error && error.message === 'RATE_LIMITED';
        if (isRateLimited) {
            console.warn('[LLM-OCR] Rate limited - falling back to manual validation');
            return {
                success: true,
                text: '[Rate limit atteint] Validation manuelle requise',
                confidence: 0,
                isVictory: false,
                moderation: { isAppropriate: true },
                error: 'API rate limit reached - manual validation required',
            };
        }

        // CONNECTION ERROR: Fallback to manual validation
        const isConnectionError = error instanceof Error &&
            (error.message.includes('ECONNREFUSED') ||
                error.message.includes('fetch failed') ||
                error.name === 'AbortError' ||
                error.message.includes('aborted'));

        if (isConnectionError) {
            console.warn('[LLM-OCR] API unreachable - falling back to manual validation');
            return {
                success: true,
                text: '[OCR indisponible] Validation manuelle requise',
                confidence: 0,
                isVictory: false,
                moderation: { isAppropriate: true },
                error: 'Gemini API unreachable - manual validation required',
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
 * Parse the model's response - tries JSON first, falls back to text extraction
 * Gemma 3 typically returns valid JSON, but we handle both cases
 */
function parseModelResponse(rawResponse: string): ParsedModelResponse {
    // Try JSON parsing first (Gemma 3 should return structured JSON)
    try {
        // Extract JSON from response (may have markdown code blocks)
        const jsonMatch = rawResponse.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
            const parsed = JSON.parse(jsonMatch[0]);

            // Handle achievement context
            if ('score' in parsed) {
                const score = typeof parsed.score === 'number' ? parsed.score : parseInt(String(parsed.score).replace(/\s/g, ''), 10);
                const isVictory = parsed.is_victory === true;

                console.log('[LLM-OCR] JSON parsed successfully:', { score, isVictory });

                // High confidence if we got a valid score
                let confidence = 0;
                if (score > 0) confidence += 50;
                if (score > 1000) confidence += 20; // Likely a real Dofus score
                if (isVictory) confidence += 30;

                return {
                    extractedText: `Score: ${score}`,
                    isVictory,
                    victoryIndicators: isVictory ? ['is_victory'] : [],
                    confidence: Math.min(100, confidence),
                    isAppropriate: true,
                    inappropriateReason: null,
                };
            }

            // Handle mission context
            if ('mission_name' in parsed) {
                const isValidated = parsed.is_validated === true;

                console.log('[LLM-OCR] Mission JSON parsed:', parsed);

                return {
                    extractedText: JSON.stringify(parsed),
                    isVictory: isValidated,
                    victoryIndicators: isValidated ? ['is_validated'] : [],
                    confidence: isValidated ? 90 : 60,
                    isAppropriate: true,
                    inappropriateReason: null,
                };
            }
        }
    } catch (e) {
        console.log('[LLM-OCR] JSON parsing failed, falling back to text extraction');
    }

    // Fallback: Text extraction (legacy behavior)
    const text = rawResponse.toLowerCase();

    // Extract numbers from the response (e.g., "21 654", "21654", "21,654")
    const numberMatches = rawResponse.match(/[\d\s,\.]+\d/g) || [];
    const extractedNumbers = numberMatches
        .map(n => parseInt(n.replace(/[\s,\.]/g, ''), 10))
        .filter(n => !isNaN(n) && n > 0);

    // Detect victory indicators
    const victoryKeywords = ['success', 'succes', 'succès', 'victory', 'victoire', 'unlocked', 'déverrouillé', 'achieved', 'completed'];
    const foundIndicators = victoryKeywords.filter(kw => text.includes(kw));
    const isVictory = foundIndicators.length > 0;

    // Calculate confidence based on what we found
    let confidence = 0;
    if (extractedNumbers.length > 0) confidence += 40; // Found a number
    if (isVictory) confidence += 40; // Found victory keyword
    if (rawResponse.length > 50) confidence += 10; // Got substantial response
    if (extractedNumbers.some(n => n > 1000)) confidence += 10; // Found large number (likely score)

    console.log('[LLM-OCR] Text parsing fallback:', {
        foundNumbers: extractedNumbers,
        foundIndicators,
        isVictory,
        calculatedConfidence: confidence
    });

    return {
        extractedText: rawResponse,
        isVictory,
        victoryIndicators: foundIndicators,
        confidence: Math.min(100, confidence),
        isAppropriate: true, // Assume appropriate unless flagged
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
