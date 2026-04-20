"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Trophy, Upload, Loader2, CheckCircle2, AlertCircle, Sparkles, Clock } from "lucide-react";
import { syncMemberSuccessPoints, refreshUserSuccessPoints, getLadderPreview } from "@/server/actions/profile-actions";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import Link from "next/link";
import { cancelAchievementSubmission } from "@/server/actions/achievement-actions";

interface SuccessSyncProps {
    guildId: string;
    pseudoDofus?: string | null;
    dofusServerId?: string | null;
    successPoints?: number | null;
    lastUpdate?: Date | null;
    readOnly?: boolean;
    onTabChange?: (tab: string) => void;
    onSuccess?: (points: number) => void;
    pendingSubmission?: {
        id: string;
        points: number;
        ocrScore: number;
        createdAt: Date;
    } | null;
    onCancel?: () => void;
    targetUserId?: string;
    canSyncLadder?: boolean;
    canManualSync?: boolean;
    isSuperAdmin?: boolean;
    isAdmin?: boolean;
}

import { ALL_DOFUS_SERVERS, DOFUS_UNITY_SERVERS } from "@/lib/presentation-constants";
import { getClass } from "@/lib/dofus-assets";
import { ExternalLink, Info, MapPin, MousePointer2, UserSearch, RefreshCw, Edit2 } from "lucide-react";

export function SuccessSync({
    guildId,
    pseudoDofus,
    dofusServerId,
    successPoints = 0,
    lastUpdate,
    readOnly = false,
    onTabChange,
    onSuccess,
    pendingSubmission,
    onCancel,
    targetUserId,
    canSyncLadder = false,
    canManualSync = true,
    isSuperAdmin = false,
    isAdmin = false
}: SuccessSyncProps) {
    const [isUploading, setIsUploading] = useState(false);
    const [dragActive, setDragActive] = useState(false);
    const [lastScanResult, setLastScanResult] = useState<{ points?: number, error?: string, pending?: boolean, confidence?: number, debugImage?: string } | null>(
        pendingSubmission ? { points: pendingSubmission.points, pending: true, confidence: pendingSubmission.ocrScore } : null
    );

    const [previewData, setPreviewData] = useState<{ 
        points: number, 
        level: number, 
        className?: string, 
        rank?: number,
        guildRank?: number
    } | null>(null);
    const [loadingPreview, setLoadingPreview] = useState(false);
    const [previewFetched, setPreviewFetched] = useState(false);

    useEffect(() => {
        if (!pseudoDofus || previewFetched || readOnly) return;
        let isMounted = true;
        
        const fetchPreview = async () => {
            setLoadingPreview(true);
            const res = await getLadderPreview(guildId);
            if (isMounted) {
                if (res.success && res.data) {
                    setPreviewData(res.data);
                }
                setPreviewFetched(true);
                setLoadingPreview(false);
            }
        };

        fetchPreview();
        return () => { isMounted = false; };
    }, [pseudoDofus, previewFetched, readOnly, guildId]);

    // Use provided server ID from guild config or fallback to Draconiros (295)
    const serverId = dofusServerId || "295";
    const serverName = [...Object.values(DOFUS_UNITY_SERVERS).flat()].find(s => s.id.toString() === serverId)?.name || "Draconiros";

    const ladderUrl = pseudoDofus ? `https://www.dofus.com/fr/mmorpg/communaute/ladder/succes?server_id=${serverId}&name=${pseudoDofus}#jt_list` : null;

    const handleCancel = async () => {
        setIsUploading(true);
        const res = await cancelAchievementSubmission(guildId, targetUserId);
        setIsUploading(false);
        if (res.success) {
            toast.success("Demande annulée");
            setLastScanResult(null);
            onCancel?.();
        } else {
            toast.error(res.error || "Erreur lors de l'annulation");
        }
    };

    const handleLadderSync = async () => {
        if (isUploading || lastScanResult?.pending) return;

        setIsUploading(true);
        try {
            const res = await refreshUserSuccessPoints(guildId);
            if (res.success && res.data) {
                toast.success(`Succès synchronisés via Ladder : ${res.data.points} points ! (Niv. ${res.data.level})`);
                setLastScanResult({ points: res.data.points });
                onSuccess?.(res.data.points);
            } else {
                toast.error(res.error || "Échec de la synchronisation via Ladder.");
            }
        } catch (err) {
            toast.error("Une erreur est survenue lors de la synchronisation.");
        } finally {
            setIsUploading(false);
        }
    };

    const handleFile = async (file: File) => {
        if (lastScanResult?.pending) {
            toast.error("Vous avez déjà une demande en cours.");
            return;
        }
        if (!file.type.startsWith("image/")) {
            toast.error("Veuillez sélectionner une image.");
            return;
        }

        // 🛡️ NSFW Safety Check
        const { analyzeImageSafety } = await import("@/lib/safety-client");
        const safety = await analyzeImageSafety(file);
        if (!safety.isSafe) {
            toast.error(safety.reason || "Contenu inapproprié détecté. L'image a été bloquée.");
            return;
        }

        setIsUploading(true);
        const reader = new FileReader();
        reader.readAsDataURL(file);

        reader.onload = async () => {
            // const base64 = reader.result as string; // OLD
            try {
                // NEW: Compression
                const { compressImage } = await import("@/lib/image-compression");
                const compressedBase64 = await compressImage(file, {
                    maxWidth: 1920,
                    maxHeight: 1080,
                    quality: 0.8
                });

                const res = await syncMemberSuccessPoints({
                    guildId,
                    imageData: compressedBase64,
                    targetUserId,
                });

                if (res.success) {
                    if (res.data?.pending) {
                        const conf = Math.round(res.data.confidence || 0);
                        toast.info("Votre capture est en cours de vérification par le staff.");
                        setLastScanResult({
                            points: res.data?.points,
                            pending: true,
                            confidence: res.data?.confidence,
                            debugImage: res.data?.debugImage
                        });
                    } else {
                        toast.success(`Succès synchronisés : ${res.data?.points} points !`);
                        setLastScanResult({ points: res.data?.points, debugImage: res.data?.debugImage });
                        if (res.data?.points) {
                            onSuccess?.(res.data.points);
                        }
                    }
                } else {
                    toast.error(res.error || "Échec de la synchronisation.");
                    setLastScanResult({ error: res.error });
                }
            } catch (err) {
                toast.error("Une erreur est survenue lors de l'envoi.");
            } finally {
                setIsUploading(false);
                setDragActive(false);
            }
        };
    };

    const handleBrowseClick = () => {
        const fileInput = document.getElementById("success-upload-input");
        if (fileInput) fileInput.click();
    };


    const onDragOver = (e: React.DragEvent) => {
        e.preventDefault();
        setDragActive(true);
    };

    const onDragLeave = () => {
        setDragActive(false);
    };

    const onDrop = (e: React.DragEvent) => {
        e.preventDefault();
        setDragActive(false);
        if (e.dataTransfer.files && e.dataTransfer.files[0]) {
            handleFile(e.dataTransfer.files[0]);
        }
    };

    // START: Clipboard Paste Support
    useEffect(() => {
        if (readOnly) return;

        const handlePaste = (e: ClipboardEvent) => {
            if (e.clipboardData && e.clipboardData.files.length > 0) {
                const file = e.clipboardData.files[0];
                if (file.type.startsWith("image/")) {
                    e.preventDefault();
                    handleFile(file);
                    toast.info("Image collée depuis le presse-papier ! 📋");
                }
            }
        };

        window.addEventListener("paste", handlePaste);
        return () => window.removeEventListener("paste", handlePaste);
    }, [readOnly, isUploading, lastScanResult]); // Re-bind if these change, though handleFile uses them
    // END: Clipboard Paste Support

    if (readOnly && !successPoints) return null;

    return (
        <Card className="overflow-hidden border-white/10 bg-black/20 backdrop-blur-md">
            <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <div className="p-2 rounded-lg bg-amber-500/20 text-amber-400">
                            <Trophy className="w-5 h-5" />
                        </div>
                        <div>
                            <CardTitle className="text-lg">Points de Succès</CardTitle>
                            <CardDescription>Synchronisation des points</CardDescription>
                        </div>
                    </div>
                    {successPoints ? (
                        <div className="text-2xl font-bold text-amber-400">
                            {successPoints.toLocaleString()}
                        </div>
                    ) : null}
                </div>
            </CardHeader>
            <CardContent className="space-y-4">
                {!readOnly && canManualSync && (
                    <div className="space-y-4 animate-in fade-in slide-in-from-top-2 duration-500">
                        <div
                            onDragOver={onDragOver}
                            onDragLeave={onDragLeave}
                            onDrop={onDrop}
                            className={cn(
                                "relative group flex flex-col items-center justify-center gap-3 p-6 border-2 border-dashed rounded-xl transition-all",
                                dragActive ? "border-amber-500 bg-amber-500/10" : "border-white/10 hover:border-white/20 hover:bg-white/5",
                                (isUploading || lastScanResult?.pending) && "opacity-50 pointer-events-none cursor-not-allowed"
                            )}
                        >
                            {lastScanResult?.pending ? (
                                <div className="flex flex-col items-center gap-2 p-4 text-center">
                                    <Clock className="w-8 h-8 text-blue-400 animate-pulse" />
                                    <p className="text-sm font-bold text-blue-200 uppercase">Demande en attente</p>
                                    <p className="text-xs text-blue-300/60 max-w-[200px]">Une capture est déjà en cours de validation par le staff.</p>
                                </div>
                            ) : isUploading ? (
                                <div className="flex flex-col items-center gap-2 animate-pulse">
                                    <Loader2 className="w-8 h-8 text-amber-500 animate-spin" />
                                    <span className="text-sm font-medium text-amber-200">Synchronisation en cours...</span>
                                </div>
                            ) : (
                                <>
                                    <div className="p-3 rounded-full bg-white/5 group-hover:scale-110 transition-transform">
                                        <Upload className="w-6 h-6 text-white/40 group-hover:text-amber-400" />
                                    </div>
                                    <div className="text-center space-y-1">
                                        <p className="text-base font-bold text-white/90">Déposez votre capture</p>
                                        <p className="text-sm text-white/40">
                                            coller (CTRL+V) ou{" "}
                                            <button
                                                type="button"
                                                onClick={handleBrowseClick}
                                                className="text-amber-400 hover:text-amber-300 font-medium hover:underline focus:outline-none"
                                            >
                                                cliquez pour sélectionner
                                            </button>
                                        </p>
                                    </div>
                                    <input
                                        id="success-upload-input"
                                        type="file"
                                        className="hidden"
                                        onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
                                        accept="image/*"
                                    />
                                </>
                            )}
                        </div>

                        {/* Instructional Tip with Full Examples */}
                        <div className="p-5 rounded-2xl bg-zinc-900/50 border border-white/5 space-y-4">
                            <div className="flex items-center gap-2 text-amber-400">
                                <div className="p-2 rounded-lg bg-amber-500/10">
                                    <MousePointer2 className="w-5 h-5" />
                                </div>
                                <span className="text-sm font-bold uppercase tracking-wider">Bien cadrer la capture</span>
                            </div>
                            <p className="text-sm text-zinc-300 leading-relaxed font-medium">
                                Ne prenez pas tout l'écran ! Utilisez un outil de capture d'écran (Snipping Tool, Greenshot, etc) pour détourer uniquement la zone avec vos points. Si vous incluez la barre de progression à droite de vos points, l'IA sera encore plus précise.
                            </p>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-xl mx-auto">
                                <div className="rounded-xl overflow-hidden border border-white/10 bg-black/40 flex items-center justify-center p-2">
                                    <img
                                        src="/assets/ladder/exemple-succes.png"
                                        alt="Exemple valide 1"
                                        className="w-full h-auto rounded-lg"
                                    />
                                </div>
                                <div className="rounded-xl overflow-hidden border border-white/10 bg-black/40 flex items-center justify-center p-2">
                                    <img
                                        src="/assets/ladder/exemple4.png"
                                        alt="Exemple valide 2"
                                        className="w-full h-auto rounded-lg"
                                    />
                                </div>
                            </div>
                        </div>

                        {/* Pseudo Configuration Instruction */}
                        {!pseudoDofus && (
                            <div className="p-5 rounded-2xl bg-amber-500/5 border border-amber-500/10 flex items-start gap-5">
                                <div className="p-3 rounded-2xl bg-amber-500/10 text-amber-400 shrink-0">
                                    <UserSearch className="w-6 h-6" />
                                </div>
                                <div className="space-y-2">
                                    <p className="text-base font-bold text-amber-200 uppercase tracking-tight">Pseudo Dofus requis</p>
                                    <p className="text-sm text-amber-400/80 leading-relaxed font-medium">
                                        Pour activer le lien direct vers le ladder officiel, rendez-vous dans l'onglet{" "}
                                        <button
                                            onClick={() => onTabChange?.('overview')}
                                            className="text-amber-200 underline decoration-amber-200/30 underline-offset-4 hover:text-white transition-colors cursor-pointer"
                                        >
                                            Général
                                        </button>
                                        {" "}et modifiez votre bloc{" "}
                                        <button
                                            onClick={() => onTabChange?.('overview')}
                                            className="text-amber-200 underline decoration-amber-200/30 underline-offset-4 hover:text-white transition-colors cursor-pointer text-left"
                                        >
                                            Identité de Combat
                                        </button>
                                        {" "}pour y ajouter votre pseudo exact.
                                    </p>
                                </div>
                            </div>
                        )}
                    </div>
                )}

                {/* Ladder Sync Button (if enabled) */}
                {!readOnly && canSyncLadder && (
                    <div className="pt-2 animate-in fade-in slide-in-from-bottom-2 duration-700">
                        <Button
                            onClick={handleLadderSync}
                            disabled={isUploading || !pseudoDofus || (lastScanResult?.pending ?? false)}
                            className="w-full h-12 bg-amber-500 hover:bg-amber-600 text-black font-black uppercase tracking-widest shadow-[0_0_20px_rgba(245,158,11,0.3)] transition-all active:scale-95 disabled:opacity-50 group gap-3"
                        >
                            {isUploading ? (
                                <Loader2 className="w-5 h-5 animate-spin" />
                            ) : (
                                <RefreshCw className="w-5 h-5 group-hover:rotate-180 transition-transform duration-500" />
                            )}
                            <span>Synchroniser via Ladder</span>
                        </Button>
                        {!pseudoDofus && (
                            <p className="text-[10px] text-zinc-500 text-center mt-2 italic font-medium">
                                Le pseudo Dofus est requis pour la synchronisation automatique.
                            </p>
                        )}
                    </div>
                )}

                {lastScanResult?.pending && (
                    <div className="relative overflow-hidden p-5 rounded-2xl bg-blue-500/10 text-blue-300 border border-blue-500/20 animate-in fade-in zoom-in-95 duration-500">
                        {/* Status bar background */}
                        <div className="absolute top-0 left-0 h-1 bg-blue-500/10 w-full" />
                        <div
                            className="absolute top-0 left-0 h-1 bg-blue-400 shadow-[0_0_10px_rgba(96,165,250,0.5)] transition-all duration-1000"
                            style={{ width: `${Math.round(lastScanResult.confidence || 0)}%` }}
                        />

                        <div className="flex flex-col gap-4 relative z-10">
                            <div className="flex items-start gap-3">
                                <Clock className="w-5 h-5 mt-1 shrink-0 text-blue-400" />
                                <div className="flex-1 space-y-1">
                                    <p className="text-xs leading-relaxed opacity-80 font-medium">
                                        Votre capture est en cours de vérification par le staff.
                                    </p>
                                </div>
                            </div>

                            <div className="flex items-center justify-end gap-3 pt-2">
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-8 text-[10px] font-bold text-white/40 hover:text-red-400 hover:bg-red-500/10"
                                    onClick={handleCancel}
                                    disabled={isUploading}
                                >
                                    Annuler la demande
                                </Button>
                                <Button
                                    className="h-8 text-[10px] font-bold bg-blue-500/20 hover:bg-blue-500/30 text-blue-200 border border-blue-500/30 pointer-events-none"
                                >
                                    Attente Staff
                                </Button>
                            </div>
                        </div>
                    </div>
                )}

                {lastUpdate && (
                    <div className="flex items-center justify-between text-sm text-white/50 bg-white/5 p-3 rounded-xl border border-white/5">
                        <span className="font-medium">Dernière synchronisation</span>
                        <span className="font-bold text-white/90">{new Date(lastUpdate).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}</span>
                    </div>
                )}

                {/* Ladder Link Option */}
                {!readOnly && (
                    <div className="pt-2 border-t border-white/5 space-y-3">
                        <div className="flex flex-col gap-4 bg-white/5 p-4 rounded-xl border border-white/10 hover:border-amber-500/30 transition-colors">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    <div className="p-2.5 rounded-xl bg-blue-500/20 text-blue-400 border border-blue-500/10 shadow-lg shadow-blue-500/5">
                                        <ExternalLink className="w-5 h-5" />
                                    </div>
                                    <div className="flex flex-col gap-0.5">
                                        <div className="flex items-center gap-2.5">
                                            <span className="text-base font-bold text-white tracking-tight">Lien Ladder Officiel</span>
                                            <span className="px-2 py-0.5 rounded-md bg-zinc-800 text-[11px] font-black text-zinc-300 border border-white/10 uppercase tracking-wider">
                                                {serverName}
                                            </span>
                                        </div>
                                        <span className="text-sm text-zinc-400 font-medium">Consulter vos points en temps réel sur Ankama</span>
                                    </div>
                                </div>
                                {pseudoDofus ? (
                                    <Button
                                        variant="outline"
                                        size="default"
                                        className="h-10 border-white/10 hover:bg-white/10 text-sm font-bold min-w-[100px]"
                                        asChild
                                    >
                                        <a href={ladderUrl!} target="_blank" rel="noopener noreferrer">
                                            Ouvrir
                                        </a>
                                    </Button>
                                ) : (
                                    <span className="text-[10px] text-white/20 italic">Pseudo requis</span>
                                )}
                            </div>

                            {pseudoDofus && (
                                <div className="px-3 py-2 bg-black/60 rounded-lg border border-white/10 overflow-hidden transition-all hover:border-white/20">
                                    <p className="text-[11px] text-zinc-400 truncate font-mono select-all leading-none">
                                        {ladderUrl}
                                    </p>
                                </div>
                            )}

                            {pseudoDofus && (
                                <div className="mt-2 p-3 rounded-xl border border-white/5 bg-zinc-950/50 flex flex-col gap-2">
                                    <div className="flex justify-between items-center text-xs font-semibold uppercase text-zinc-500 tracking-wider">
                                        <div className="flex items-center gap-2">
                                            <span>Aperçu en Direct</span>
                                            {loadingPreview && <Loader2 className="w-3 h-3 animate-spin" />}
                                        </div>
                                        
                                        {!readOnly && (
                                            <button
                                                onClick={() => onTabChange?.('overview')}
                                                className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-zinc-400 hover:text-amber-400 transition-all bg-white/5 hover:bg-amber-500/10 px-3 py-1.5 rounded-xl border border-white/5 hover:border-amber-500/30 shadow-lg"
                                                title="Modifier l'identité de combat"
                                            >
                                                <Edit2 className="w-3 h-3" strokeWidth={2.5} />
                                                <span>Éditer</span>
                                            </button>
                                        )}
                                    </div>
                                    {loadingPreview && !previewData && (
                                        <div className="h-10 flex items-center justify-center">
                                            <span className="text-xs text-zinc-500 font-medium">Recherche du personnage...</span>
                                        </div>
                                    )}
                                    {!loadingPreview && !previewData && previewFetched && (
                                        <div className="h-10 flex flex-col items-center justify-center text-zinc-500">
                                            <span className="text-xs font-medium">Personnage introuvable ou erreur.</span>
                                            <span className="text-[10px] italic">Vérifiez les majuscules et le serveur.</span>
                                        </div>
                                    )}
                                    {previewData && (() => {
                                        const dofusClass = previewData.className ? getClass(previewData.className.trim()) : null;
                                        return (
                                        <div className="flex items-center justify-between mt-1 px-1">
                                            <div className="flex items-center gap-3">
                                                {/* Class Icon */}
                                                <div className="relative group/icon">
                                                    <div className="absolute inset-0 bg-white/10 blur-md rounded-full scale-0 group-hover/icon:scale-110 transition-transform duration-500" />
                                                    {dofusClass?.icon ? (
                                                        <img 
                                                            src={dofusClass.icon} 
                                                            alt={previewData.className} 
                                                            className="w-10 h-10 object-contain relative z-10 drop-shadow-[0_0_8px_rgba(0,0,0,0.5)]" 
                                                        />
                                                    ) : (
                                                        <div className="w-10 h-10 rounded-full bg-zinc-800 flex items-center justify-center border border-white/5 relative z-10">
                                                            <UserSearch className="w-5 h-5 text-zinc-600" />
                                                        </div>
                                                    )}
                                                </div>

                                                <div className="flex flex-col">
                                                    <div className="flex items-center gap-2">
                                                        <span className="text-sm font-black text-amber-50">{pseudoDofus}</span>
                                                    </div>
                                                    <span className={cn(
                                                        "text-[10px] font-medium transition-colors flex items-center gap-1",
                                                        dofusClass ? "text-amber-400/80" : "text-zinc-500"
                                                    )}>
                                                        {dofusClass?.name || previewData.className || "Classe Inconnue"} • {previewData.level > 200 ? (
                                                            <span className="font-bold text-sky-400 drop-shadow-[0_0_8px_rgba(56,189,248,0.4)]">
                                                                Ω {previewData.level - 200}
                                                            </span>
                                                        ) : (
                                                            `Niveau ${previewData.level}`
                                                        )}
                                                    </span>
                                                </div>
                                            </div>
                                            
                                            {/* Visual Connector with Centered Server */}
                                            <div className="flex-1 mx-6 flex items-center justify-center gap-3">
                                                <div className="border-b border-dashed border-white/10 flex-1" />
                                                <span className="font-mono text-[9px] font-bold text-zinc-500 uppercase tracking-widest text-center">
                                                    SERVEUR {serverName}
                                                </span>
                                                <div className="border-b border-dashed border-white/10 flex-1" />
                                            </div>

                                            <div className="flex items-center gap-6 text-right shrink-0">
                                                <div className="flex flex-col items-end">
                                                    <span className="text-[10px] uppercase font-bold text-zinc-500 leading-none mb-1">Points</span>
                                                    <span className="text-sm font-black text-amber-500 tabular-nums">{previewData.points.toLocaleString()}</span>
                                                </div>
                                                
                                                <div className="flex gap-3">
                                                    <div className="flex flex-col items-end border-l border-white/5 pl-3">
                                                        <span className="text-[9px] uppercase font-bold text-zinc-600 leading-none mb-1">Monde</span>
                                                        <span className="text-[11px] font-black text-white/90 tabular-nums">
                                                            {previewData.rank ? `#${previewData.rank.toLocaleString()}` : '—'}
                                                        </span>
                                                    </div>
                                                    <div className="flex flex-col items-end border-l border-white/5 pl-3">
                                                        <span className="text-[9px] uppercase font-bold text-zinc-600 leading-none mb-1">Guilde</span>
                                                        <span className={cn(
                                                            "text-sm font-black tabular-nums",
                                                            previewData.guildRank === 1 ? "text-yellow-400 drop-shadow-[0_0_8px_rgba(250,204,21,0.4)]" : "text-white/90"
                                                        )}>
                                                            #{previewData.guildRank || '—'}
                                                        </span>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                        );
                                    })()}
                                </div>
                            )}
                        </div>

                        {!pseudoDofus && (
                            <div className="p-4 rounded-xl border border-amber-500/20 bg-amber-500/10 flex flex-col sm:flex-row items-center justify-between gap-4">
                                <div className="flex items-center gap-3 text-amber-400">
                                    <Info className="w-5 h-5 shrink-0" />
                                    <div className="space-y-0.5">
                                        <p className="text-sm font-bold">Pseudo Dofus requis</p>
                                        <p className="text-xs text-amber-400/80">Configurez votre identité pour débloquer le lien officiel.</p>
                                    </div>
                                </div>
                                <Button 
                                    onClick={() => onTabChange?.('overview')}
                                    className="bg-amber-500 hover:bg-amber-600 text-black font-black uppercase text-xs w-full sm:w-auto shadow-[0_0_15px_rgba(245,158,11,0.2)]"
                                >
                                    Configurer
                                </Button>
                            </div>
                        )}
                    </div>
                )}

                {/* Link to Guild Ladder Module */}
                <div className="pt-4 mt-2 border-t border-white/5">
                    <Button
                        asChild
                        variant="sigil"
                        className="w-full h-11"
                    >
                        <Link href={`/dashboard/${guildId}/ladder`}>
                            <Trophy className="w-5 h-5" />
                            <span>VOIR LE CLASSEMENT DE GUILDE</span>
                        </Link>
                    </Button>
                </div>

                {!successPoints && !readOnly && (
                    <div className="flex items-start gap-3 p-4 rounded-xl bg-blue-500/10 text-blue-300 border border-blue-500/20">
                        <AlertCircle className="w-5 h-5 mt-0.5 shrink-0" />
                        <div className="space-y-1">
                            <p className="text-sm font-bold text-blue-200">Ladder vide</p>
                            <p className="text-sm leading-relaxed opacity-80">Synchronisez vos points pour apparaître dans le classement mondial et de guilde.</p>
                        </div>
                    </div>
                )}
            </CardContent>
        </Card >
    );
}
