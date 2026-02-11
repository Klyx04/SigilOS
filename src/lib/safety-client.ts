// QUICK STUB FOR REMOVED NSFW MODULE
// The safety-client module was removed during dependency cleanup (TensorFlow.js, nsfwjs)
// This stub prevents TypeScript errors while we decide on a replacement strategy

export interface SafetyResult {
    isSafe: boolean;
    reason?: string;
    predictions: any[];
}

export async function analyzeImageSafety(_file: File): Promise<SafetyResult> {
    // STUB: Always approve images (server-side validation still applies via image-processor.ts)
    return {
        isSafe: true,
        predictions: []
    };
}
