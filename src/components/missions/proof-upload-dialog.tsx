'use client'

import { useState, useRef, useTransition, useEffect } from "react";

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
    Clock,
    Users
} from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { submitMissionProof, cancelMissionSubmission } from "@/server/actions/mission-actions";
import { reportSecurityIncident } from "@/server/actions/audit-actions";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { Progress } from "@/components/ui/progress";
import { type MissionCategory, type MissionPayload } from "@/types/missions";



import { analyzeImageSafety } from "@/lib/safety-client";
import { MemberSelector } from "./member-selector"; // Import MemberSelector
import { Honeypot } from "@/components/shared/honeypot";

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
    const [ocrResult, setOcrResult] = useState<any | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [isCheckingSafety, setIsCheckingSafety] = useState(false);
    const [helperIds, setHelperIds] = useState<string[]>([]); // State for helpers

    const fileInputRef = useRef<HTMLInputElement>(null);
    const router = useRouter();
    const [isPending, startTransition] = useTransition();



    const resetState = () => {
        if (preview) URL.revokeObjectURL(preview);
        setFile(null);
        setPreview(null);
        setState("idle");
        setError(null);
        setHelperIds([]); // Reset helpers
    };


    const handleClose = () => {
        resetState();
        onOpenChange(false);
    };

    // --- Refactored File Handler (Shared between Input, Drop, and Paste) ---
    const validateAndSetFile = async (selectedFile: File) => {
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
                toast.error("INFRACTION DÉTECTÉE : Contenu inapproprié.", {
                    description: "Ce type de contenu est strictement interdit sur la plateforme. L'incident a été enregistré.",
                    duration: 8000,
                    style: {
                        borderColor: '#ef4444',
                        backgroundColor: '#450a0a',
                        color: '#fca5a5'
                    }
                });

                // Logging the incident
                reportSecurityIncident(
                    guildId,
                    "NSFW_ATTEMPT",
                    `Tentative d'upload NSFW par l'utilisateur (Fichier: ${selectedFile.name})`,
                    {
                        category: category || "Unknown",
                        reason: safety.reason,
                        fileName: selectedFile.name,
                        fileSize: selectedFile.size,
                        missionTitle: missionTitle,
                        scores: safety.predictions
                    }
                ).catch((err: Error) => console.error("Failed to log incident", err));

                resetState();
                onOpenChange(false);
                return;
            }
        } finally {
            setIsCheckingSafety(false);
        }

        setFile(selectedFile);
        setPreview(URL.createObjectURL(selectedFile));
        setError(null);
        setOcrResult(null);
    };

    const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        const selectedFile = e.target.files?.[0];
        if (selectedFile) {
            validateAndSetFile(selectedFile);
        }
    };

    // --- Clipboard Paste Support ---
    // eslint-disable-next-line react-hooks/rules-of-hooks

    // eslint-disable-next-line react-hooks/rules-of-hooks
    useEffect(() => {
        if (!open) return;

        const handlePaste = (e: ClipboardEvent) => {
            if (e.clipboardData && e.clipboardData.files.length > 0) {
                const file = e.clipboardData.files[0];
                if (file.type.startsWith("image/")) {
                    e.preventDefault();
                    validateAndSetFile(file);
                    toast.info("Image collée depuis le presse-papier ! 📋");
                }
            }
        };

        window.addEventListener("paste", handlePaste);
        return () => window.removeEventListener("paste", handlePaste);
    }, [open]);


    const handleUpload = async () => {
        if (!file) return;

        setState("analyzing");
        setError(null);

        try {
            // Convert to Base64 AND Compress
            setState("analyzing"); // Re-using analyzing state for compression

            // Dynamic import to avoid SSR issues if any
            const { compressImage } = await import("@/lib/image-compression");

            // Compress: Max 1920x1080, 80% quality
            const compressedDataUrl = await compressImage(file, {
                maxWidth: 1920,
                maxHeight: 1080,
                quality: 0.8
            });

            // 1. Submit to server action (which handles OCR + Storage)
            setState("uploading");
            
            // 🍯 Honeypot check
            const hpValue = (document.getElementById("hp_ignore_field") as HTMLInputElement)?.value;
            
            const result = await submitMissionProof(missionId, compressedDataUrl, helperIds, hpValue); // Pass helperIds + Honeypot

            if (!result.success) {
                throw new Error(result.error || "Échec de la soumission");
            }

            toast.success("Preuve soumise ! En attente de validation par un modérateur.");

            startTransition(() => {
                router.refresh();
            });

            setState("success");


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
                validateAndSetFile(droppedFile); // Use the new function
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
                    <Honeypot />
                    {/* ═══════════════════════════════════════ */}
                    {/* CONTRIBUTOR SECTION — Always visible in idle/preview */}
                    {/* ═══════════════════════════════════════ */}
                    {(state === "idle") && (
                        <div className="relative rounded-xl border border-amber-500/40 bg-gradient-to-br from-amber-950/40 via-amber-900/20 to-zinc-900/60 p-4 space-y-3 shadow-[0_0_20px_-5px_rgba(245,158,11,0.3)]">
                            {/* Glow accent */}
                            <div className="absolute -top-px left-6 right-6 h-px bg-gradient-to-r from-transparent via-amber-400/60 to-transparent" />

                            <div className="flex items-start gap-3">
                                <div className="mt-0.5 p-2 rounded-lg bg-amber-500/20 border border-amber-500/30 shrink-0">
                                    <Users className="w-5 h-5 text-amber-400" />
                                </div>
                                <div className="flex-1 min-w-0 space-y-1">
                                    <div className="flex items-center gap-2">
                                        <h3 className="text-sm font-black text-amber-300 uppercase tracking-wider">Contributeurs</h3>
                                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-400 border border-amber-500/30">OPTIONNEL</span>
                                    </div>
                                    <p className="text-xs text-amber-200/80 leading-relaxed">
                                        Ils vous ont aidé ? Sélectionnez-les — ils recevront{" "}
                                        <span className="font-black text-amber-300">des points de contribution</span>{" "}
                                        dès validation de votre preuve !
                                    </p>
                                </div>
                            </div>

                            <MemberSelector
                                guildId={guildId}
                                selectedIds={helperIds}
                                onSelect={setHelperIds}
                                maxSelection={7}
                            />
                        </div>
                    )}

                    {/* Drop Zone */}
                    {!preview && state === "idle" && (
                        <div
                            className={cn(
                                "relative border-2 border-dashed border-slate-700 rounded-lg p-8 text-center transition-colors",
                                isCheckingSafety ? "opacity-50 cursor-wait" : "hover:border-indigo-500/50 hover:bg-indigo-500/5"
                            )}
                            onDrop={handleDrop}
                            onDragOver={(e) => e.preventDefault()}
                        >
                            <ImageIcon className="w-12 h-12 mx-auto text-slate-600 mb-4" />
                            <p className="text-sm text-slate-400 mb-2">
                                Glissez votre screenshot ici, coller (CTRL+V) ou{" "}
                                <button
                                    type="button"
                                    onClick={() => !isCheckingSafety && fileInputRef.current?.click()}
                                    className="text-indigo-400 hover:text-indigo-300 font-medium hover:underline focus:outline-none"
                                >
                                    cliquez pour sélectionner
                                </button>
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
                                    <p className="text-xs text-slate-500">Processing...</p>

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
                                        <Clock className="w-12 h-12 text-amber-400 mx-auto mb-2" />
                                        <p className="text-sm text-amber-300 font-medium">Envoyée à la modération</p>
                                    </div>
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
                                variant="sigil-destructive"
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
                                variant="sigil-emerald"
                                className="h-10 px-6"
                            >
                                {state === "analyzing" ? (
                                    <>
                                        <Eye className="w-4 h-4 mr-2 animate-pulse" />
                                        Analyse...
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
