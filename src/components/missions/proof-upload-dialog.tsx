'use client'

import { useState, useRef } from "react";
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
    Eye
} from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { submitMissionProof } from "@/server/actions/mission-actions";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { useClientOcr, type MissionCategory, type MissionPayload, type OcrResult } from "@/lib/ocr-client";
import { Progress } from "@/components/ui/progress";

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
    const fileInputRef = useRef<HTMLInputElement>(null);
    const router = useRouter();

    // Client-side OCR hook
    const { isAnalyzing, progress, analyze, reset: resetOcr } = useClientOcr();

    const resetState = () => {
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

    const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
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
                const data = await response.json();
                throw new Error(data.error || "Upload failed");
            }

            const result = await response.json();

            // 3. Create submission in database
            const submitResult = await submitMissionProof(
                missionId,
                result.proofUrl,
                clientOcrResult.score,
                {
                    matchedElements: clientOcrResult.matchedElements,
                    missingElements: clientOcrResult.missingElements,
                    isValid: clientOcrResult.isValid,
                    categoryMatch: clientOcrResult.categoryMatch,
                    contentMatch: clientOcrResult.contentMatch,
                    victoryDetected: clientOcrResult.victoryDetected,
                    confidence: clientOcrResult.confidence,
                }
            );

            if (!submitResult.success) {
                throw new Error(submitResult.error || "Failed to create submission");
            }

            setState("success");

            // Auto-close after success
            setTimeout(() => {
                handleClose();
                router.refresh();
                toast.success(
                    clientOcrResult.isValid && clientOcrResult.score >= 95
                        ? "Preuve soumise et auto-validée ! 🎉"
                        : "Preuve soumise avec succès !"
                );
            }, 2000);

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
                            className="border-2 border-dashed border-slate-700 rounded-lg p-8 text-center hover:border-indigo-500/50 hover:bg-indigo-500/5 transition-colors cursor-pointer"
                            onClick={() => fileInputRef.current?.click()}
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
                            />
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
                                        <CheckCircle2 className="w-12 h-12 text-green-400 mx-auto mb-2" />
                                        <p className="text-sm text-green-300 font-medium">Preuve soumise !</p>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}

                    {/* OCR Results */}
                    {ocrResult && (state === "uploading" || state === "success" || state === "error") && (
                        <div className="bg-slate-900 rounded-lg p-4 border border-slate-800 space-y-3">
                            {/* Header with Score */}
                            <div className="flex items-center justify-between">
                                <h4 className="text-sm font-medium text-slate-300 flex items-center gap-2">
                                    <Sparkles className="w-4 h-4 text-indigo-400" />
                                    Analyse OCR
                                </h4>
                                <Badge
                                    className={cn(
                                        "font-mono text-xs",
                                        ocrResult.isValid && ocrResult.score >= 95
                                            ? "bg-green-500/20 text-green-400 border-green-500/30"
                                            : ocrResult.isValid
                                                ? "bg-yellow-500/20 text-yellow-400 border-yellow-500/30"
                                                : "bg-red-500/20 text-red-400 border-red-500/30"
                                    )}
                                >
                                    Score: {ocrResult.score}%
                                </Badge>
                            </div>

                            {/* Validation Status Indicators */}
                            <div className="grid grid-cols-3 gap-2">
                                <div className={cn(
                                    "flex items-center gap-1.5 px-2 py-1.5 rounded-md text-xs",
                                    ocrResult.victoryDetected
                                        ? "bg-green-500/10 text-green-400"
                                        : "bg-red-500/10 text-red-400"
                                )}>
                                    {ocrResult.victoryDetected ? <Check className="w-3 h-3" /> : <X className="w-3 h-3" />}
                                    Victoire
                                </div>
                                <div className={cn(
                                    "flex items-center gap-1.5 px-2 py-1.5 rounded-md text-xs",
                                    ocrResult.categoryMatch
                                        ? "bg-green-500/10 text-green-400"
                                        : "bg-red-500/10 text-red-400"
                                )}>
                                    {ocrResult.categoryMatch ? <Check className="w-3 h-3" /> : <X className="w-3 h-3" />}
                                    Catégorie
                                </div>
                                <div className={cn(
                                    "flex items-center gap-1.5 px-2 py-1.5 rounded-md text-xs",
                                    ocrResult.contentMatch
                                        ? "bg-green-500/10 text-green-400"
                                        : "bg-red-500/10 text-red-400"
                                )}>
                                    {ocrResult.contentMatch ? <Check className="w-3 h-3" /> : <X className="w-3 h-3" />}
                                    Contenu
                                </div>
                            </div>

                            {/* Auto-validation banner */}
                            {ocrResult.isValid && ocrResult.score >= 95 && (
                                <div className="flex items-center gap-2 text-green-400 text-xs bg-green-500/10 px-3 py-2 rounded-md border border-green-500/20">
                                    <CheckCircle2 className="w-4 h-4" />
                                    Auto-validation activée !
                                </div>
                            )}

                            {/* Matched Elements */}
                            {ocrResult.matchedElements.length > 0 && (
                                <div className="space-y-1.5">
                                    <p className="text-xs text-green-400/80 font-medium">✓ Détecté :</p>
                                    <div className="flex flex-wrap gap-1.5">
                                        {ocrResult.matchedElements.map((el, i) => (
                                            <Badge
                                                key={i}
                                                variant="outline"
                                                className="text-xs bg-green-500/10 border-green-500/30 text-green-300"
                                            >
                                                {el}
                                            </Badge>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* Missing Elements */}
                            {ocrResult.missingElements.length > 0 && !ocrResult.isValid && (
                                <div className="space-y-1.5">
                                    <p className="text-xs text-red-400/80 font-medium">✗ Non trouvé :</p>
                                    <div className="flex flex-wrap gap-1.5">
                                        {ocrResult.missingElements.map((el, i) => (
                                            <Badge
                                                key={i}
                                                variant="outline"
                                                className="text-xs bg-red-500/10 border-red-500/30 text-red-300"
                                            >
                                                {el}
                                            </Badge>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* Manual validation notice */}
                            {!ocrResult.isValid && (
                                <div className="flex items-center gap-2 text-yellow-400 text-xs bg-yellow-500/10 px-3 py-2 rounded-md border border-yellow-500/20">
                                    <AlertTriangle className="w-4 h-4" />
                                    Validation manuelle requise par le staff
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
                    <Button variant="ghost" onClick={handleClose} disabled={isProcessing}>
                        Annuler
                    </Button>
                    <Button
                        onClick={handleUpload}
                        disabled={!file || isProcessing || state === "success"}
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
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
