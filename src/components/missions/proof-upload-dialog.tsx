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
    AlertTriangle
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

interface OcrMatch {
    category: string;
    patterns: string[];
}

interface UploadResult {
    proofUrl: string;
    ocr: {
        score: number;
        matches: OcrMatch[];
        confidence: number;
    };
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

            // 2. Create submission in database
            const submitResult = await submitMissionProof(
                missionId,
                result.proofUrl,
                result.ocr.score,
                {
                    matches: result.ocr.matches,
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
                    result.ocr.score >= 95
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
                                            {state === "uploading" ? "Upload en cours..." : "Analyse OCR..."}
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

                    {/* OCR Results */}
                    {uploadResult && state !== "idle" && (
                        <div className="bg-slate-900 rounded-lg p-4 border border-slate-800">
                            <div className="flex items-center justify-between mb-3">
                                <h4 className="text-sm font-medium text-slate-300 flex items-center gap-2">
                                    <Sparkles className="w-4 h-4 text-indigo-400" />
                                    Analyse OCR
                                </h4>
                                <Badge
                                    className={cn(
                                        "font-mono text-xs",
                                        uploadResult.ocr.score >= 95
                                            ? "bg-green-500/20 text-green-400 border-green-500/30"
                                            : uploadResult.ocr.score >= 70
                                                ? "bg-yellow-500/20 text-yellow-400 border-yellow-500/30"
                                                : "bg-red-500/20 text-red-400 border-red-500/30"
                                    )}
                                >
                                    Score: {uploadResult.ocr.score}%
                                </Badge>
                            </div>

                            {uploadResult.ocr.score >= 95 && (
                                <div className="flex items-center gap-2 text-green-400 text-xs bg-green-500/10 px-3 py-2 rounded-md border border-green-500/20 mb-3">
                                    <CheckCircle2 className="w-4 h-4" />
                                    Auto-validation activée !
                                </div>
                            )}

                            {uploadResult.ocr.matches.length > 0 && (
                                <div className="space-y-2">
                                    <p className="text-xs text-slate-500">Éléments détectés :</p>
                                    <div className="flex flex-wrap gap-1.5">
                                        {uploadResult.ocr.matches.slice(0, 6).map((match, i) => (
                                            <Badge
                                                key={i}
                                                variant="outline"
                                                className="text-xs bg-slate-800 border-slate-700"
                                            >
                                                {match.category}
                                            </Badge>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {uploadResult.ocr.matches.length === 0 && (
                                <div className="flex items-center gap-2 text-yellow-400 text-xs">
                                    <AlertTriangle className="w-4 h-4" />
                                    Aucun élément Dofus détecté - validation manuelle requise
                                </div>
                            )}
                        </div>
                    )}

                    {/* Error State */}
                    {error && (
                        <div className="bg-red-500/10 text-red-400 text-sm p-3 rounded-lg border border-red-500/20">
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
