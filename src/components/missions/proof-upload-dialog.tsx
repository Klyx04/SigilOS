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
    Check
} from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { submitMissionProof } from "@/server/actions/mission-actions";
import { useRouter } from "next/navigation";
import Image from "next/image";

interface ProofUploadDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    missionId: string;
    missionTitle: string;
    guildId: string;
}

type UploadState = "idle" | "uploading" | "processing" | "success" | "error";

// Updated interface for smart OCR results
interface OcrResult {
    score: number;
    isValid: boolean;
    categoryMatch: boolean;
    contentMatch: boolean;
    victoryDetected: boolean;
    matchedElements: string[];
    missingElements: string[];
    confidence: number;
}

interface UploadResult {
    proofUrl: string;
    ocr: OcrResult;
}

export function ProofUploadDialog({
    open,
    onOpenChange,
    missionId,
    missionTitle,
    guildId
}: ProofUploadDialogProps) {
    const [file, setFile] = useState<File | null>(null);
    const [preview, setPreview] = useState<string | null>(null);
    const [state, setState] = useState<UploadState>("idle");
    const [uploadResult, setUploadResult] = useState<UploadResult | null>(null);
    const [error, setError] = useState<string | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const router = useRouter();

    const resetState = () => {
        setFile(null);
        setPreview(null);
        setState("idle");
        setUploadResult(null);
        setError(null);
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
    };

    const handleUpload = async () => {
        if (!file) return;

        setState("uploading");
        setError(null);

        try {
            // 1. Upload to API for processing + OCR
            const formData = new FormData();
            formData.append("file", file);
            formData.append("guildId", guildId);
            formData.append("missionId", missionId);

            const response = await fetch("/api/upload", {
                method: "POST",
                body: formData,
            });

            if (!response.ok) {
                const data = await response.json();
                throw new Error(data.error || "Upload failed");
            }

            const result = await response.json();
            setUploadResult(result);

            setState("processing");

            // 2. Create submission in database with OCR results
            const submitResult = await submitMissionProof(
                missionId,
                result.proofUrl,
                result.ocr.score,
                {
                    matchedElements: result.ocr.matchedElements,
                    missingElements: result.ocr.missingElements,
                    isValid: result.ocr.isValid,
                    categoryMatch: result.ocr.categoryMatch,
                    contentMatch: result.ocr.contentMatch,
                    victoryDetected: result.ocr.victoryDetected,
                    confidence: result.ocr.confidence,
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
                    result.ocr.isValid && result.ocr.score >= 95
                        ? "Preuve soumise et auto-validée ! 🎉"
                        : "Preuve soumise avec succès !"
                );
            }, 2500);

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
            // Create a synthetic event
            const dataTransfer = new DataTransfer();
            dataTransfer.items.add(droppedFile);

            if (fileInputRef.current) {
                fileInputRef.current.files = dataTransfer.files;
                handleFileSelect({ target: { files: dataTransfer.files } } as any);
            }
        }
    };

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
                            {/* Processing overlay */}
                            {(state === "uploading" || state === "processing") && (
                                <div className="absolute inset-0 bg-black/70 flex items-center justify-center">
                                    <div className="text-center">
                                        <Loader2 className="w-8 h-8 animate-spin text-indigo-400 mx-auto mb-2" />
                                        <p className="text-sm text-slate-300">
                                            {state === "uploading" ? "Upload en cours..." : "Analyse intelligente..."}
                                        </p>
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

                    {/* Smart OCR Results */}
                    {uploadResult && state !== "idle" && (
                        <div className="bg-slate-900 rounded-lg p-4 border border-slate-800 space-y-3">
                            {/* Header with Score */}
                            <div className="flex items-center justify-between">
                                <h4 className="text-sm font-medium text-slate-300 flex items-center gap-2">
                                    <Sparkles className="w-4 h-4 text-indigo-400" />
                                    Analyse intelligente
                                </h4>
                                <Badge
                                    className={cn(
                                        "font-mono text-xs",
                                        uploadResult.ocr.isValid && uploadResult.ocr.score >= 95
                                            ? "bg-green-500/20 text-green-400 border-green-500/30"
                                            : uploadResult.ocr.isValid
                                                ? "bg-yellow-500/20 text-yellow-400 border-yellow-500/30"
                                                : "bg-red-500/20 text-red-400 border-red-500/30"
                                    )}
                                >
                                    Score: {uploadResult.ocr.score}%
                                </Badge>
                            </div>

                            {/* Validation Status Indicators */}
                            <div className="grid grid-cols-3 gap-2">
                                <div className={cn(
                                    "flex items-center gap-1.5 px-2 py-1.5 rounded-md text-xs",
                                    uploadResult.ocr.victoryDetected
                                        ? "bg-green-500/10 text-green-400"
                                        : "bg-red-500/10 text-red-400"
                                )}>
                                    {uploadResult.ocr.victoryDetected ? <Check className="w-3 h-3" /> : <X className="w-3 h-3" />}
                                    Victoire
                                </div>
                                <div className={cn(
                                    "flex items-center gap-1.5 px-2 py-1.5 rounded-md text-xs",
                                    uploadResult.ocr.categoryMatch
                                        ? "bg-green-500/10 text-green-400"
                                        : "bg-red-500/10 text-red-400"
                                )}>
                                    {uploadResult.ocr.categoryMatch ? <Check className="w-3 h-3" /> : <X className="w-3 h-3" />}
                                    Catégorie
                                </div>
                                <div className={cn(
                                    "flex items-center gap-1.5 px-2 py-1.5 rounded-md text-xs",
                                    uploadResult.ocr.contentMatch
                                        ? "bg-green-500/10 text-green-400"
                                        : "bg-red-500/10 text-red-400"
                                )}>
                                    {uploadResult.ocr.contentMatch ? <Check className="w-3 h-3" /> : <X className="w-3 h-3" />}
                                    Contenu
                                </div>
                            </div>

                            {/* Auto-validation banner */}
                            {uploadResult.ocr.isValid && uploadResult.ocr.score >= 95 && (
                                <div className="flex items-center gap-2 text-green-400 text-xs bg-green-500/10 px-3 py-2 rounded-md border border-green-500/20">
                                    <CheckCircle2 className="w-4 h-4" />
                                    Auto-validation activée !
                                </div>
                            )}

                            {/* Matched Elements */}
                            {uploadResult.ocr.matchedElements.length > 0 && (
                                <div className="space-y-1.5">
                                    <p className="text-xs text-green-400/80 font-medium">✓ Détecté :</p>
                                    <div className="flex flex-wrap gap-1.5">
                                        {uploadResult.ocr.matchedElements.map((el, i) => (
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
                            {uploadResult.ocr.missingElements.length > 0 && !uploadResult.ocr.isValid && (
                                <div className="space-y-1.5">
                                    <p className="text-xs text-red-400/80 font-medium">✗ Non trouvé :</p>
                                    <div className="flex flex-wrap gap-1.5">
                                        {uploadResult.ocr.missingElements.map((el, i) => (
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
                            {!uploadResult.ocr.isValid && (
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
                    <Button variant="ghost" onClick={handleClose} disabled={state === "uploading" || state === "processing"}>
                        Annuler
                    </Button>
                    <Button
                        onClick={handleUpload}
                        disabled={!file || state !== "idle"}
                        className="bg-indigo-600 hover:bg-indigo-500"
                    >
                        {state === "uploading" ? (
                            <>
                                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                Upload...
                            </>
                        ) : state === "processing" ? (
                            <>
                                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                Analyse...
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
