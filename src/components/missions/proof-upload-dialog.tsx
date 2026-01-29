'use client'

import { useState, useRef, useTransition } from "react";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
    DialogFooter
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
    Upload,
    X,
    CheckCircle2,
    Loader2,
    ImageIcon,
    Sparkles,
    AlertTriangle,
    XCircle,
    Check,
    Eye,
    Clock
} from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { submitMissionProof, cancelMissionSubmission } from "@/server/actions/mission-actions";
import { reportSecurityIncident } from "@/server/actions/audit-actions";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { useClientOcr, type MissionCategory, type MissionPayload, type OcrResult } from "@/lib/ocr-client";
import { Progress } from "@/components/ui/progress";
import { analyzeImageSafety } from "@/lib/safety-client";

interface ProofUploadDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    missionId: string;
    missionTitle: string;
    guildId: string;
    category: MissionCategory;
    payload: MissionPayload;
}

type UploadState = "idle" | "analyzing" | "uploading" | "success" | "error";

export function ProofUploadDialog({
    open,
    onOpenChange,
    missionId,
    missionTitle,
    guildId,
    category,
    payload
}: ProofUploadDialogProps) {
    const [file, setFile] = useState<File | null>(null);
    const [preview, setPreview] = useState<string | null>(null);
    const [state, setState] = useState<UploadState>("idle");
    const [ocrResult, setOcrResult] = useState<OcrResult | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [isCheckingSafety, setIsCheckingSafety] = useState(false);
    const [safetyDebug, setSafetyDebug] = useState<string | undefined>(undefined);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const router = useRouter();
    const [isPending, startTransition] = useTransition();

    // Client-side OCR hook
    const { isAnalyzing, progress, analyze, reset: resetOcr } = useClientOcr();

    const resetState = () => {
        if (preview) URL.revokeObjectURL(preview);
        setFile(null);
        setPreview(null);
        setState("idle");
        setOcrResult(null);
        setError(null);
        resetOcr();
    };

    const handleClose = () => {
        resetState();
        onOpenChange(false);
    };

    const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const selectedFile = e.target.files?.[0];
        if (!selectedFile) return;

        // Client-side validation
        const validTypes = ["image/png", "image/jpeg", "image/webp", "image/gif"];
        if (!validTypes.includes(selectedFile.type)) {
            toast.error("Format non supporté. Utilisez PNG, JPEG, WebP ou GIF.");
            return;
        }

        const maxSize = 10 * 1024 * 1024; // 10MB
        if (selectedFile.size > maxSize) {
            toast.error("Fichier trop volumineux (max 10MB)");
            return;
        }

        if (preview) URL.revokeObjectURL(preview);

        // --- Added: NSFW/Safety Check ---
        setIsCheckingSafety(true);
        try {
            const safety = await analyzeImageSafety(selectedFile);
            if (!safety.isSafe) {
                // Warning message meant to be dissuasive
                toast.error("INFRACTION DÉTECTÉE : Contenu inapproprié.", {
                    description: "Ce type de contenu est strictement interdit sur la plateforme. L'incident a été enregistré.",
                    duration: 8000,
                    style: {
                        borderColor: '#ef4444',
                        backgroundColor: '#450a0a',
                        color: '#fca5a5'
                    }
                });

                // Logging the incident (Fire and forget to not block UI)
                const description = `Tentative d'upload NSFW par l'utilisateur (Fichier: ${selectedFile.name})`;

                reportSecurityIncident(
                    guildId,
                    "NSFW_ATTEMPT",
                    description,
                    {
                        category: category || "Unknown",
                        reason: safety.reason,
                        fileName: selectedFile.name,
                        fileSize: selectedFile.size,
                        missionTitle: missionTitle,
                        scores: safety.predictions
                    }
                ).catch(e => console.error("Failed to log incident", e));

                resetState();
                onOpenChange(false);
                return;
            }
        } finally {
            setIsCheckingSafety(false);
        }
        // ------------------------------

        setFile(selectedFile);
        setPreview(URL.createObjectURL(selectedFile));
        setError(null);
        setOcrResult(null);
    };

    const handleUpload = async () => {
        if (!file) return;

        setState("analyzing");
        setError(null);

        try {
            // 1. Run OCR analysis in the browser
            console.log("[Upload] Starting client-side OCR analysis...");
            const clientOcrResult = await analyze(file, category, payload);
            setOcrResult(clientOcrResult);

            console.log(`[Upload] OCR complete. Score: ${clientOcrResult.score}%`);

            // 2. Upload image to server
            setState("uploading");

            const formData = new FormData();
            formData.append("file", file);
            formData.append("guildId", guildId);
            formData.append("missionId", missionId);
            // Send OCR results with the upload
            formData.append("ocrResult", JSON.stringify(clientOcrResult));

            const response = await fetch("/api/upload", {
                method: "POST",
                body: formData,
            });

            if (!response.ok) {
                let errorMessage = "Upload failed";
                try {
                    const contentType = response.headers.get("content-type");
                    if (contentType && contentType.indexOf("application/json") !== -1) {
                        const data = await response.json();
                        errorMessage = data.error || errorMessage;
                    } else {
                        errorMessage = `Server Error (${response.status})`;
                    }
                } catch (e) {
                    errorMessage = `Server Error (${response.status})`;
                }
                throw new Error(errorMessage);
            }

            const result = await response.json();

            // Use Server OCR result if available (it refers to the file actually processed/validated)
            // Fallback to client result only if server returned nothing (shouldn't happen on success)
            const finalOcr = result.ocr || clientOcrResult;

            // UPDATE UI with Server Reality (Score 86, Validated)
            setOcrResult(finalOcr);

            // 3. Create submission in database
            const submitResult = await submitMissionProof(
                missionId,
                result.proofUrl,
                finalOcr.score,
                {
                    matchedElements: finalOcr.matchedElements || [],
                    missingElements: finalOcr.missingElements || [],
                    isValid: finalOcr.isValid,
                    categoryMatch: finalOcr.categoryMatch,
                    contentMatch: finalOcr.contentMatch,
                    victoryDetected: finalOcr.victoryDetected,
                    confidence: finalOcr.confidence,
                }
            );

            if (!submitResult.success) {
                throw new Error(submitResult.error || "Failed to create submission");
            }

            setState("success");

            // Replaced timeout with startTransition
            startTransition(() => {
                router.refresh();
            });

            toast.success(
                finalOcr.isValid && finalOcr.score >= 70
                    ? "Preuve soumise et auto-validée ! 🎉"
                    : "Preuve soumise ! En attente de validation."
            );

        } catch (err) {
            setState("error");
            const message = err instanceof Error ? err.message : "Erreur inattendue";
            setError(message);
            toast.error(message);
        }
    };

    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault();
        const droppedFile = e.dataTransfer.files[0];
        if (droppedFile) {
            const dataTransfer = new DataTransfer();
            dataTransfer.items.add(droppedFile);

            if (fileInputRef.current) {
                fileInputRef.current.files = dataTransfer.files;
                handleFileSelect({ target: { files: dataTransfer.files } } as any);
            }
        }
    };

    const isProcessing = state === "analyzing" || state === "uploading";

    // Determine if auto-validated for UI feedback
    const isAutoValidated = ocrResult?.isValid && ocrResult.score >= 70;

    return (
        <Dialog open={open} onOpenChange={handleClose}>
            <DialogContent className="sm:max-w-lg bg-slate-950 border-slate-800">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <Upload className="w-5 h-5 text-indigo-400" />
                        Soumettre une preuve
                    </DialogTitle>
                    <DialogDescription className="text-slate-400">
                        {missionTitle}
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-4">
                    {/* Drop Zone */}
                    {!preview && state === "idle" && (
                        <div
                            className={cn(
                                "relative border-2 border-dashed border-slate-700 rounded-lg p-8 text-center transition-colors cursor-pointer",
                                isCheckingSafety ? "opacity-50 cursor-wait" : "hover:border-indigo-500/50 hover:bg-indigo-500/5"
                            )}
                            onClick={() => !isCheckingSafety && fileInputRef.current?.click()}
                            onDrop={handleDrop}
                            onDragOver={(e) => e.preventDefault()}
                        >
                            <ImageIcon className="w-12 h-12 mx-auto text-slate-600 mb-4" />
                            <p className="text-sm text-slate-400 mb-2">
                                Glissez votre screenshot ici ou cliquez pour sélectionner
                            </p>
                            <p className="text-xs text-slate-500">
                                PNG, JPEG, WebP ou GIF • Max 10MB
                            </p>
                            <input
                                ref={fileInputRef}
                                type="file"
                                accept="image/png,image/jpeg,image/webp,image/gif"
                                className="hidden"
                                onChange={handleFileSelect}
                                disabled={isCheckingSafety}
                            />
                            {isCheckingSafety && (
                                <div className="absolute inset-0 bg-slate-950/80 flex flex-col items-center justify-center gap-3 z-10 rounded-lg">
                                    <Loader2 className="w-8 h-8 animate-spin text-indigo-400" />
                                    <p className="text-sm text-slate-300">Vérification de sécurité...</p>
                                </div>
                            )}
                        </div>
                    )}

                    {/* Preview */}
                    {preview && (
                        <div className="relative rounded-lg overflow-hidden border border-slate-800 bg-black">
                            <Image
                                src={preview}
                                alt="Preview"
                                width={500}
                                height={300}
                                className="w-full h-auto max-h-64 object-contain"
                                unoptimized
                            />
                            {state === "idle" && (
                                <button
                                    onClick={resetState}
                                    className="absolute top-2 right-2 p-1.5 bg-red-500/80 rounded-full hover:bg-red-500 transition-colors"
                                >
                                    <X className="w-4 h-4 text-white" />
                                </button>
                            )}

                            {/* Analyzing overlay with progress */}
                            {state === "analyzing" && (
                                <div className="absolute inset-0 bg-black/80 flex flex-col items-center justify-center gap-3">
                                    <Eye className="w-8 h-8 text-indigo-400 animate-pulse" />
                                    <p className="text-sm text-slate-300">Analyse OCR en cours...</p>
                                    <div className="w-48">
                                        <Progress value={progress} className="h-2" />
                                    </div>
                                    <p className="text-xs text-slate-500">{progress}%</p>
                                </div>
                            )}

                            {/* Uploading overlay */}
                            {state === "uploading" && (
                                <div className="absolute inset-0 bg-black/70 flex items-center justify-center">
                                    <div className="text-center">
                                        <Loader2 className="w-8 h-8 animate-spin text-indigo-400 mx-auto mb-2" />
                                        <p className="text-sm text-slate-300">Upload en cours...</p>
                                    </div>
                                </div>
                            )}

                            {/* Success overlay */}
                            {state === "success" && (
                                <div className="absolute inset-0 bg-black/70 flex items-center justify-center">
                                    <div className="text-center">
                                        {isAutoValidated ? (
                                            <>
                                                <CheckCircle2 className="w-12 h-12 text-green-400 mx-auto mb-2" />
                                                <p className="text-sm text-green-300 font-medium">Mission validée !</p>
                                            </>
                                        ) : (
                                            <>
                                                <Clock className="w-12 h-12 text-amber-400 mx-auto mb-2" />
                                                <p className="text-sm text-amber-300 font-medium">Envoyée à la modération</p>
                                            </>
                                        )}
                                    </div>
                                </div>
                            )}
                        </div>
                    )}

                    {/* Vérification automatique Results */}
                    {ocrResult && (state === "uploading" || state === "success" || state === "error") && (
                        <div className={cn(
                            "rounded-xl p-4 border space-y-4 transition-colors",
                            isAutoValidated
                                ? "bg-green-950/30 border-green-500/30"
                                : "bg-slate-900/50 border-slate-700/50"
                        )}>
                            {/* Header - Confiance */}
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                    {isAutoValidated ? (
                                        <CheckCircle2 className="w-5 h-5 text-green-400" />
                                    ) : (
                                        <Sparkles className="w-5 h-5 text-indigo-400" />
                                    )}
                                    <span className="text-sm font-medium text-slate-200">
                                        {isAutoValidated ? "Validé automatiquement" : "Vérification automatique"}
                                    </span>
                                </div>
                                <div className="flex items-center gap-2 text-xs text-muted-foreground mt-2">
                                    {safetyDebug && <span className="text-[10px] font-mono opacity-70">{safetyDebug}</span>}
                                </div>
                                <div className="flex items-center gap-2">
                                    <span className={cn(
                                        "text-lg font-bold",
                                        ocrResult.score >= 70 ? "text-green-400"
                                            : ocrResult.score >= 40 ? "text-yellow-400"
                                                : "text-red-400"
                                    )}>
                                        {ocrResult.score}%
                                    </span>
                                </div>
                            </div>

                            {/* Score Bar */}
                            <div className="h-2 bg-slate-800 rounded-full overflow-hidden">
                                <div
                                    className={cn(
                                        "h-full rounded-full transition-all duration-500",
                                        ocrResult.score >= 70 ? "bg-gradient-to-r from-green-500 to-emerald-400"
                                            : ocrResult.score >= 40 ? "bg-gradient-to-r from-yellow-500 to-amber-400"
                                                : "bg-gradient-to-r from-red-500 to-rose-400"
                                    )}
                                    style={{ width: `${ocrResult.score}%` }}
                                />
                            </div>

                            {/* Quick Status Pills */}
                            <div className="flex flex-wrap gap-2">
                                {ocrResult.victoryDetected && (
                                    <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs bg-green-500/20 text-green-300 border border-green-500/30">
                                        <Check className="w-3 h-3" /> Victoire
                                    </span>
                                )}
                                {ocrResult.matchedElements.some(el => el.includes("vert")) && (
                                    <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                                        <Check className="w-3 h-3" /> Validé visuellement
                                    </span>
                                )}
                                {ocrResult.categoryMatch && (
                                    <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs bg-blue-500/20 text-blue-300 border border-blue-500/30">
                                        <Check className="w-3 h-3" /> Catégorie
                                    </span>
                                )}
                                {ocrResult.contentMatch && (
                                    <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs bg-purple-500/20 text-purple-300 border border-purple-500/30">
                                        <Check className="w-3 h-3" /> Contenu
                                    </span>
                                )}
                            </div>

                            {/* Éléments détectés (collapsible style) */}
                            {ocrResult.matchedElements.length > 0 && (
                                <details className="group">
                                    <summary className="text-xs text-slate-400 cursor-pointer hover:text-slate-300 flex items-center gap-1">
                                        <span className="text-green-400">✓</span> {ocrResult.matchedElements.length} élément(s) détecté(s)
                                    </summary>
                                    <div className="mt-2 flex flex-wrap gap-1.5 pl-4">
                                        {ocrResult.matchedElements.map((el, i) => (
                                            <span key={i} className="text-xs px-2 py-0.5 rounded bg-green-500/10 text-green-300/80">
                                                {el}
                                            </span>
                                        ))}
                                    </div>
                                </details>
                            )}

                            {/* Missing Elements (only if not auto-validated) */}
                            {ocrResult.missingElements.length > 0 && !isAutoValidated && (
                                <details className="group" open>
                                    <summary className="text-xs text-slate-400 cursor-pointer hover:text-slate-300 flex items-center gap-1">
                                        <span className="text-red-400">✗</span> {ocrResult.missingElements.length} élément(s) manquant(s)
                                    </summary>
                                    <div className="mt-2 flex flex-wrap gap-1.5 pl-4">
                                        {ocrResult.missingElements.map((el, i) => (
                                            <span key={i} className="text-xs px-2 py-0.5 rounded bg-red-500/10 text-red-300/80">
                                                {el}
                                            </span>
                                        ))}
                                    </div>
                                </details>
                            )}

                            {/* Status Banner */}
                            {isAutoValidated ? (
                                <div className="flex items-center gap-2 text-green-300 text-sm bg-green-500/10 px-4 py-2.5 rounded-lg border border-green-500/20">
                                    <CheckCircle2 className="w-4 h-4 shrink-0" />
                                    <span>Cette preuve sera validée automatiquement !</span>
                                </div>
                            ) : (
                                <div className="flex items-center gap-2 text-amber-300 text-sm bg-amber-500/10 px-4 py-2.5 rounded-lg border border-amber-500/20">
                                    <AlertTriangle className="w-4 h-4 shrink-0" />
                                    <span>Un modérateur vérifiera votre preuve</span>
                                </div>
                            )}
                        </div>
                    )}

                    {/* Error State */}
                    {error && (
                        <div className="bg-red-500/10 text-red-400 text-sm p-3 rounded-lg border border-red-500/20 flex items-center gap-2">
                            <XCircle className="w-4 h-4 shrink-0" />
                            {error}
                        </div>
                    )}
                </div>

                <DialogFooter className="gap-2">
                    {state === "success" ? (
                        <>
                            <Button variant="ghost" onClick={handleClose}>
                                Fermer
                            </Button>
                            {/* Allow cancelling for simple UX even if validated - user might have made mistake */}
                            <Button
                                variant="destructive"
                                disabled={isPending}
                                onClick={() => {
                                    startTransition(async () => {
                                        try {
                                            const result = await cancelMissionSubmission(missionId);
                                            if (result.success) {
                                                toast.success("Soumission annulée.");
                                                handleClose();
                                                router.refresh();
                                            } else {
                                                toast.error(result.error || "Erreur lors de l'annulation");
                                            }
                                        } catch (e) {
                                            toast.error("Erreur inattendue");
                                        }
                                    });
                                }}
                            >
                                {isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <XCircle className="w-4 h-4 mr-2" />}
                                Annuler la soumission
                            </Button>
                        </>
                    ) : (
                        <>
                            <Button variant="ghost" onClick={handleClose} disabled={isProcessing}>
                                Annuler
                            </Button>
                            <Button
                                onClick={handleUpload}
                                disabled={!file || isProcessing}
                                className="bg-indigo-600 hover:bg-indigo-500"
                            >
                                {state === "analyzing" ? (
                                    <>
                                        <Eye className="w-4 h-4 mr-2 animate-pulse" />
                                        Analyse... {progress}%
                                    </>
                                ) : state === "uploading" ? (
                                    <>
                                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                        Upload...
                                    </>
                                ) : (
                                    <>
                                        <Upload className="w-4 h-4 mr-2" />
                                        Soumettre
                                    </>
                                )}
                            </Button>
                        </>
                    )}
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
