"use client";

import { useState, useEffect, useRef } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Trophy, Loader2, Sparkles, RefreshCw, Edit2, ExternalLink, UserSearch, Info, Camera, Upload, Check, X } from "lucide-react";
import { refreshUserSuccessPoints, getLadderPreview, syncMemberSuccessPoints } from "@/server/actions/profile-actions";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import Link from "next/link";
import { DOFUS_UNITY_SERVERS } from "@/lib/presentation-constants";
import { getClass } from "@/lib/dofus-assets";
import { getDofusServerImage } from "@/lib/dofus-assets";

interface SuccessSyncProps {
    guildId: string;
    pseudoDofus?: string | null;
    dofusServerId?: string | null;
    successPoints?: number | null;
    lastUpdate?: Date | null;
    readOnly?: boolean;
    onTabChange?: (tab: string) => void;
    onSuccess?: (points: number) => void;
    canSyncLadder?: boolean;
    canManualSyncLadder?: boolean;
}

export function SuccessSync({
    guildId,
    pseudoDofus,
    dofusServerId,
    successPoints = 0,
    lastUpdate,
    readOnly = false,
    onTabChange,
    onSuccess,
    canSyncLadder = false,
    canManualSyncLadder = false,
}: SuccessSyncProps) {
    const [isSyncing, setIsSyncing] = useState(false);
    const [previewData, setPreviewData] = useState<{ 
        points: number, 
        level: number, 
        className?: string, 
        rank?: number,
        guildRank?: number
    } | null>(null);
    const [loadingPreview, setLoadingPreview] = useState(false);
    const [previewFetched, setPreviewFetched] = useState(false);

    // OCR Manual Sync State (#81bis)
    const [ocrModalOpen, setOcrModalOpen] = useState(false);
    const [ocrImage, setOcrImage] = useState<string | null>(null);
    const [isOcrProcessing, setIsOcrProcessing] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        if (!pseudoDofus || previewFetched || readOnly) return;
        let isMounted = true;
        
        const fetchPreview = async () => {
            setLoadingPreview(true);
            // #231 — Cible explicite : le God qui consulte le profil d'un membre ne doit pas
            // récupérer SES propres données. On passe pseudo + serveur du membre consulté.
            const res = await getLadderPreview(guildId, { pseudoDofus, dofusServerId });
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

    const serverId = dofusServerId || "295";
    const serverName = [...Object.values(DOFUS_UNITY_SERVERS).flat()].find(s => s.id.toString() === serverId)?.name || "Draconiros";
    const ladderUrl = pseudoDofus ? `https://www.dofus.com/fr/mmorpg/communaute/ladder/succes?server_id=${serverId}&name=${pseudoDofus}#jt_list` : null;

    const handleLadderSync = async () => {
        if (isSyncing) return;

        setIsSyncing(true);
        try {
            const res = await refreshUserSuccessPoints(guildId);
            if (res.success && res.data) {
                toast.success(`Succès synchronisés via Ladder : ${res.data.points} points ! (Niv. ${res.data.level})`);
                onSuccess?.(res.data.points);
            } else {
                toast.error(res.error || "Échec de la synchronisation via Ladder.");
            }
        } catch (err) {
            toast.error("Une erreur est survenue lors de la synchronisation.");
        } finally {
            setIsSyncing(false);
        }
    };

    // OCR Image handlers (#81bis)
    const handleFileSelect = (file: File) => {
        if (!file.type.startsWith("image/")) {
            toast.error("Veuillez sélectionner un fichier image valide (PNG/JPG/WebP).");
            return;
        }
        if (file.size > 4 * 1024 * 1024) {
            toast.error("L'image ne doit pas dépasser 4 Mo.");
            return;
        }
        const reader = new FileReader();
        reader.onload = (e) => {
            setOcrImage(e.target?.result as string);
        };
        reader.readAsDataURL(file);
    };

    const handlePaste = (e: React.ClipboardEvent) => {
        const items = e.clipboardData?.items;
        if (!items) return;
        for (let i = 0; i < items.length; i++) {
            if (items[i].type.startsWith("image/")) {
                const file = items[i].getAsFile();
                if (file) handleFileSelect(file);
                break;
            }
        }
    };

    const handleOcrSubmit = async () => {
        if (!ocrImage || isOcrProcessing) return;
        setIsOcrProcessing(true);
        try {
            const res = await syncMemberSuccessPoints({
                guildId,
                imageData: ocrImage,
            });

            if (res.success && res.data) {
                if (res.data.pending) {
                    toast.info("Capture enregistrée et soumise à la validation des administrateurs.");
                } else {
                    toast.success(`Points de succès détectés et validés par OCR : ${res.data.points.toLocaleString()} pts !`);
                    onSuccess?.(res.data.points);
                }
                setOcrModalOpen(false);
                setOcrImage(null);
            } else {
                toast.error(res.error || "Impossible d'analyser les points sur cette capture.");
            }
        } catch (err) {
            toast.error("Erreur de traitement de l'image.");
        } finally {
            setIsOcrProcessing(false);
        }
    };

    if (readOnly && !successPoints) return null;

    return (
        <Card className="overflow-hidden border-border bg-black/20 backdrop-blur-md">
            <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <div className="p-2 rounded-lg bg-warning/20 text-warning">
                            <Trophy className="w-5 h-5" />
                        </div>
                        <div>
                            <CardTitle className="text-lg">Points de Succès</CardTitle>
                            <CardDescription>Synchronisation des points</CardDescription>
                        </div>
                    </div>
                    {successPoints ? (
                        <div className="text-2xl font-bold text-warning">
                            {successPoints.toLocaleString()}
                        </div>
                    ) : null}
                </div>
            </CardHeader>
            <CardContent className="space-y-4">
                {/* Ladder Sync & Manual OCR Buttons */}
                {!readOnly && (canSyncLadder || canManualSyncLadder) && (
                    <div className="pt-2 flex flex-col sm:flex-row gap-3 animate-in fade-in slide-in-from-bottom-2 duration-300">
                        {canSyncLadder && (
                            <Button
                                onClick={handleLadderSync}
                                disabled={isSyncing || !pseudoDofus}
                                className="flex-1 h-12 bg-warning hover:bg-warning/90 text-warning-foreground font-black uppercase tracking-wider transition-all active:scale-95 disabled:opacity-50 group gap-2.5"
                            >
                                {isSyncing ? (
                                    <Loader2 className="w-4 h-4 animate-spin" />
                                ) : (
                                    <RefreshCw className="w-4 h-4 group-hover:rotate-180 transition-transform duration-300" />
                                )}
                                <span>Sync via Ladder</span>
                            </Button>
                        )}

                        {canManualSyncLadder && (
                            <Dialog open={ocrModalOpen} onOpenChange={setOcrModalOpen}>
                                <DialogTrigger asChild>
                                    <Button
                                        variant="outline"
                                        className="flex-1 h-12 border-warning/40 bg-warning/10 text-warning hover:bg-warning/20 hover:text-warning-foreground font-black uppercase tracking-wider gap-2.5"
                                    >
                                        <Camera className="w-4 h-4 text-warning" />
                                        <span>Capture OCR (Manuel)</span>
                                    </Button>
                                </DialogTrigger>
                                <DialogContent onPaste={handlePaste} className="sm:max-w-lg border-border bg-background/95 backdrop-blur-xl">
                                    <DialogHeader>
                                        <DialogTitle className="flex items-center gap-2 text-foreground">
                                            <Camera className="w-5 h-5 text-warning" />
                                            Synchronisation par Capture d'Écran (OCR)
                                        </DialogTitle>
                                        <DialogDescription className="text-muted-foreground">
                                            Collez (<kbd className="px-1.5 py-0.5 rounded bg-muted font-mono text-xs text-foreground">Ctrl+V</kbd>) ou glissez une capture en jeu montrant votre score de points de succès.
                                        </DialogDescription>
                                    </DialogHeader>

                                    <div className="space-y-4 pt-2">
                                        {!ocrImage ? (
                                            <div
                                                onClick={() => fileInputRef.current?.click()}
                                                onDragOver={(e) => e.preventDefault()}
                                                onDrop={(e) => {
                                                    e.preventDefault();
                                                    const file = e.dataTransfer.files?.[0];
                                                    if (file) handleFileSelect(file);
                                                }}
                                                className="border-2 border-dashed border-border hover:border-warning/50 rounded-2xl p-8 flex flex-col items-center justify-center gap-3 cursor-pointer bg-surface/30 hover:bg-surface/50 transition-colors text-center"
                                            >
                                                <div className="p-3 rounded-full bg-warning/10 text-warning">
                                                    <Upload className="w-6 h-6" />
                                                </div>
                                                <div className="space-y-1">
                                                    <p className="text-sm font-bold text-foreground">Glissez-déposez ou cliquez pour choisir une image</p>
                                                    <p className="text-xs text-muted-foreground">Coller directement depuis le presse-papier fonctionne également</p>
                                                </div>
                                                <input
                                                    ref={fileInputRef}
                                                    type="file"
                                                    accept="image/png,image/jpeg,image/webp"
                                                    className="hidden"
                                                    onChange={(e) => {
                                                        const file = e.target.files?.[0];
                                                        if (file) handleFileSelect(file);
                                                    }}
                                                />
                                            </div>
                                        ) : (
                                            <div className="relative rounded-xl overflow-hidden border border-border bg-black/40 p-2">
                                                <img
                                                    src={ocrImage}
                                                    alt="Aperçu capture"
                                                    className="w-full max-h-60 object-contain rounded-lg"
                                                />
                                                <Button
                                                    size="icon"
                                                    variant="destructive"
                                                    className="absolute top-4 right-4 h-8 w-8 rounded-full shadow-lg"
                                                    onClick={() => setOcrImage(null)}
                                                >
                                                    <X className="w-4 h-4" />
                                                </Button>
                                            </div>
                                        )}

                                        <div className="flex justify-end gap-3 pt-2">
                                            <Button
                                                variant="ghost"
                                                onClick={() => {
                                                    setOcrModalOpen(false);
                                                    setOcrImage(null);
                                                }}
                                                disabled={isOcrProcessing}
                                            >
                                                Annuler
                                            </Button>
                                            <Button
                                                onClick={handleOcrSubmit}
                                                disabled={!ocrImage || isOcrProcessing}
                                                className="bg-warning hover:bg-warning text-warning-foreground font-bold gap-2"
                                            >
                                                {isOcrProcessing ? (
                                                    <>
                                                        <Loader2 className="w-4 h-4 animate-spin" />
                                                        <span>Analyse OCR en cours...</span>
                                                    </>
                                                ) : (
                                                    <>
                                                        <Check className="w-4 h-4" />
                                                        <span>Analyser & Synchroniser</span>
                                                    </>
                                                )}
                                            </Button>
                                        </div>
                                    </div>
                                </DialogContent>
                            </Dialog>
                        )}
                    </div>
                )}

                {lastUpdate && (
                    <div className="flex items-center justify-between text-sm text-foreground/50 bg-surface p-3 rounded-xl border border-border">
                        <span className="font-medium">Dernière synchronisation</span>
                        <span className="font-bold text-foreground/90">{new Date(lastUpdate).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}</span>
                    </div>
                )}

                {/* Ladder Link Option */}
                {!readOnly && (
                    <div className="pt-2 border-t border-border space-y-3">
                        <div className="flex flex-col gap-4 bg-surface p-4 rounded-xl border border-border hover:border-warning/30 transition-colors">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    <div className="p-2.5 rounded-xl bg-info/20 text-info border border-info/10 shadow-lg shadow-blue-500/5">
                                        <ExternalLink className="w-5 h-5" />
                                    </div>
                                    <div className="flex flex-col gap-0.5">
                                        <div className="flex items-center gap-2.5">
                                            <span className="text-base font-bold text-foreground tracking-tight">Lien Ladder Officiel</span>
                                            <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-elevated text-caption font-black text-foreground border border-border uppercase tracking-wider">
                                                {getDofusServerImage(serverId) && (
                                                    // eslint-disable-next-line @next/next/no-img-element
                                                    <img
                                                        src={getDofusServerImage(serverId)!}
                                                        alt=""
                                                        loading="lazy"
                                                        decoding="async"
                                                        draggable={false}
                                                        className="w-4 h-4 rounded object-cover"
                                                    />
                                                )}
                                                {serverName}
                                            </span>
                                        </div>
                                        <span className="text-sm text-muted-foreground font-medium">Consulter vos points en temps réel sur Ankama</span>
                                    </div>
                                </div>
                                {pseudoDofus ? (
                                    <Button
                                        variant="outline"
                                        size="default"
                                        className="h-10 border-border hover:bg-surface text-sm font-bold min-w-[100px]"
                                        asChild
                                    >
                                        <a href={ladderUrl!} target="_blank" rel="noopener noreferrer">
                                            Ouvrir
                                        </a>
                                    </Button>
                                ) : (
                                    <span className="text-caption text-foreground/20 italic">Pseudo requis</span>
                                )}
                            </div>

                            {pseudoDofus && (
                                <div className="px-3 py-2 bg-black/60 rounded-lg border border-border overflow-hidden transition-all hover:border-border-strong">
                                    <p className="text-caption text-muted-foreground truncate font-mono select-all leading-none">
                                        {ladderUrl}
                                    </p>
                                </div>
                            )}

                            {pseudoDofus && (
                                <div className="mt-2 p-3 rounded-xl border border-border bg-background/50 flex flex-col gap-2">
                                    <div className="flex justify-between items-center text-xs font-semibold uppercase text-muted-foreground tracking-wider">
                                        <div className="flex items-center gap-2">
                                            <span>Aperçu en Direct</span>
                                            {loadingPreview && <Loader2 className="w-3 h-3 animate-spin" />}
                                        </div>
                                        
                                        {!readOnly && (
                                            <button
                                                onClick={() => onTabChange?.('overview')}
                                                className="flex items-center gap-1.5 text-caption font-black uppercase tracking-widest text-muted-foreground hover:text-warning transition-all bg-surface hover:bg-warning/10 px-3 py-1.5 rounded-xl border border-border hover:border-warning/30 shadow-lg"
                                                title="Modifier l'identité de combat"
                                            >
                                                <Edit2 className="w-3 h-3" strokeWidth={2.5} />
                                                <span>Éditer</span>
                                            </button>
                                        )}
                                    </div>
                                    {loadingPreview && !previewData && (
                                        <div className="h-10 flex items-center justify-center">
                                            <span className="text-xs text-muted-foreground font-medium">Recherche du personnage...</span>
                                        </div>
                                    )}
                                    {!loadingPreview && !previewData && previewFetched && (
                                        <div className="h-10 flex flex-col items-center justify-center text-muted-foreground">
                                            <span className="text-xs font-medium">Personnage introuvable ou erreur.</span>
                                            <span className="text-caption italic">Vérifiez les majuscules et le serveur.</span>
                                        </div>
                                    )}
                                    {previewData && (() => {
                                        const dofusClass = previewData.className ? getClass(previewData.className.trim()) : null;
                                        return (
                                        <div className="flex items-center justify-between mt-1 px-1">
                                            <div className="flex items-center gap-3">
                                                {/* Class Icon */}
                                                <div className="relative group/icon">
                                                    <div className="absolute inset-0 bg-surface blur-md rounded-full scale-0 group-hover/icon:scale-110 transition-transform duration-300" />
                                                    {dofusClass?.icon ? (
                                                        <img 
                                                            src={dofusClass.icon} 
                                                            alt={previewData.className} 
                                                            className="w-10 h-10 object-contain relative z-10 drop-shadow-[0_0_8px_rgba(0,0,0,0.5)]" 
                                                        />
                                                    ) : (
                                                        <div className="w-10 h-10 rounded-full bg-elevated flex items-center justify-center border border-border relative z-10">
                                                            <UserSearch className="w-5 h-5 text-muted-foreground" />
                                                        </div>
                                                    )}
                                                </div>

                                                <div className="flex flex-col">
                                                    <div className="flex items-center gap-2">
                                                        <span className="text-sm font-black text-warning">{pseudoDofus}</span>
                                                    </div>
                                                    <span className={cn(
                                                        "text-caption font-medium transition-colors flex items-center gap-1",
                                                        dofusClass ? "text-warning/80" : "text-muted-foreground"
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
                                                <div className="border-b border-dashed border-border flex-1" />
                                                <span className="inline-flex items-center gap-2 font-mono text-caption font-bold text-muted-foreground uppercase tracking-widest text-center">
                                                    {getDofusServerImage(serverId) && (
                                                        // eslint-disable-next-line @next/next/no-img-element
                                                        <img
                                                            src={getDofusServerImage(serverId)!}
                                                            alt=""
                                                            loading="lazy"
                                                            decoding="async"
                                                            draggable={false}
                                                            className="w-5 h-5 rounded object-cover"
                                                        />
                                                    )}
                                                    SERVEUR {serverName}
                                                </span>
                                                <div className="border-b border-dashed border-border flex-1" />
                                            </div>

                                            <div className="flex items-center gap-6 text-right shrink-0">
                                                <div className="flex flex-col items-end">
                                                    <span className="text-caption uppercase font-bold text-muted-foreground leading-none mb-1">Points</span>
                                                    <span className="text-sm font-black text-warning tabular-nums">{previewData.points.toLocaleString()}</span>
                                                </div>
                                                
                                                <div className="flex gap-3">
                                                    <div className="flex flex-col items-end border-l border-border pl-3">
                                                        <span className="text-caption uppercase font-bold text-muted-foreground leading-none mb-1">Monde</span>
                                                        <span className="text-caption font-black text-foreground/90 tabular-nums">
                                                            {previewData.rank ? `#${previewData.rank.toLocaleString()}` : '—'}
                                                        </span>
                                                    </div>
                                                    <div className="flex flex-col items-end border-l border-border pl-3">
                                                        <span className="text-caption uppercase font-bold text-muted-foreground leading-none mb-1">Guilde</span>
                                                        <span className={cn(
                                                            "text-sm font-black tabular-nums",
                                                            previewData.guildRank === 1 ? "text-warning drop-shadow-[0_0_8px_rgba(250,204,21,0.4)]" : "text-foreground/90"
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
                            <div className="p-4 rounded-xl border border-warning/20 bg-warning/10 flex flex-col sm:flex-row items-center justify-between gap-4">
                                <div className="flex items-center gap-3 text-warning">
                                    <Info className="w-5 h-5 shrink-0" />
                                    <div className="space-y-0.5">
                                        <p className="text-sm font-bold">Pseudo Dofus requis</p>
                                        <p className="text-xs text-warning/80">Configurez votre identité pour débloquer le lien officiel.</p>
                                    </div>
                                </div>
                                <Button 
                                    onClick={() => onTabChange?.('overview')}
                                    className="bg-warning hover:bg-warning text-warning-foreground font-black uppercase text-xs w-full sm:w-auto "
                                >
                                    Configurer
                                </Button>
                            </div>
                        )}
                    </div>
                )}

                {/* Direct Links to Guild Ladder & Achievement Trackers (#27) */}
                <div className="pt-4 mt-2 border-t border-border flex flex-col sm:flex-row gap-3">
                    <Button
                        asChild
                        variant="sigil"
                        className="flex-1 h-11"
                    >
                        <Link href={`/dashboard/${guildId}/ladder?tab=success`}>
                            <Trophy className="w-4 h-4" />
                            <span>Classement de Guilde</span>
                        </Link>
                    </Button>

                    <Button
                        asChild
                        variant="outline"
                        className="flex-1 h-11 border-border bg-surface hover:bg-elevated text-foreground font-bold"
                    >
                        <Link href={`/dashboard/${guildId}/succes?view=guilde`}>
                            <Trophy className="w-4 h-4 text-warning" />
                            <span>Succès Communs</span>
                        </Link>
                    </Button>
                </div>
            </CardContent>
        </Card >
    );
}
