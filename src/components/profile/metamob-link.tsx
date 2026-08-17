"use client";

import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, ExternalLink, Loader2, RefreshCw, Unlink, Link2, Crown, ArrowRightLeft, ShieldCheck, AlertCircle, Settings, MoreVertical } from "lucide-react";
import { linkOcreAccount, unlinkOcreAccount, forceRefreshOcre, getAvailableOcreQuests, switchOcreQuest, type OcreProgressData } from "@/server/actions/ocre-actions";
import { toast } from "sonner";
import Link from "next/link";
import Image from "next/image";
import { formatDistanceToNow } from "date-fns";
import { fr } from "date-fns/locale";
import { cn } from "@/lib/utils";
import type { UserQuest } from "@/lib/metamob-client";
import { OcreSettingsModal } from "../ocre/ocre-settings-modal";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface MetamobLinkProps {
    guildId: string;
    metamobPseudo?: string | null;
    metamobVerified?: boolean;
    metamobLastSync?: Date | null;
    readOnly?: boolean;
    isAdmin?: boolean;
    targetUserId?: string;
    progressData?: OcreProgressData;
}

export function MetamobLink({
    guildId,
    metamobPseudo,
    metamobVerified,
    metamobLastSync,
    readOnly = false,
    isAdmin = false,
    targetUserId,
    progressData,
}: MetamobLinkProps) {
    const [isLinked, setIsLinked] = useState(Boolean(metamobPseudo && metamobVerified));
    const [currentPseudo, setCurrentPseudo] = useState(metamobPseudo || "");
    const [inputPseudo, setInputPseudo] = useState("");
    const [inputApiKey, setInputApiKey] = useState("");
    const [isLinking, setIsLinking] = useState(false);
    const [isUnlinking, setIsUnlinking] = useState(false);
    const [isRefreshing, setIsRefreshing] = useState(false);
    const [showLinkDialog, setShowLinkDialog] = useState(false);

    const [showUnlinkDialog, setShowUnlinkDialog] = useState(false);
    const [linkError, setLinkError] = useState<string | null>(null);
    const [forceLink, setForceLink] = useState(false);
    const [linkStep, setLinkStep] = useState(1);

    // Multi-Quest Support
    const [showSwitchDialog, setShowSwitchDialog] = useState(false);
    const [isSwitching, setIsSwitching] = useState(false);
    const [availableQuests, setAvailableQuests] = useState<UserQuest[]>([]);
    const [questsLoading, setQuestsLoading] = useState(false);

    const handleLink = async (force: boolean = false) => {
        if (!inputPseudo.trim()) {
            setLinkError("Veuillez entrer un pseudo");
            return;
        }

        setIsLinking(true);
        setLinkError(null);
        setForceLink(false);

        const result = await linkOcreAccount({
            guildId,
            pseudo: inputPseudo.trim(),
            apiKey: inputApiKey.trim() || undefined,
            force,
            targetUserId,
        });

        if (result.success && result.data) {
            setIsLinked(true);
            setCurrentPseudo(result.data.pseudo);
            setShowLinkDialog(false);
            setInputPseudo("");
            setInputApiKey("");
            setForceLink(false);
            const serverInfo = result.data.serverName ? ` (${result.data.serverName})` : "";
            toast.success(`Compte Metamob "${result.data.pseudo}" lié${serverInfo} !`);
        } else {
            setLinkError(result.error || "Erreur lors de la liaison du compte");
            // Detect if it's an ownership error and user is admin
            if (result.error?.includes("déjà lié") && isAdmin) {
                setForceLink(true);
            }
        }

        setIsLinking(false);
    };

    const handleUnlink = async () => {
        setIsUnlinking(true);

        const result = await unlinkOcreAccount({ guildId, targetUserId });

        if (result.success) {
            setIsLinked(false);
            setCurrentPseudo("");
            setShowUnlinkDialog(false);
            toast.success("Compte Metamob délié");
        } else {
            toast.error(result.error || "Erreur lors de la suppression");
        }

        setIsUnlinking(false);
    };

    const handleRefresh = async () => {
        setIsRefreshing(true);

        const result = await forceRefreshOcre(guildId, targetUserId);

        if (result.success) {
            toast.success("Données Metamob actualisées");
        } else {
            toast.error(result.error || "Erreur lors du rafraîchissement");
        }

        setIsRefreshing(false);
    };

    const handleOpenSwitch = async () => {
        setQuestsLoading(true);
        setShowSwitchDialog(true);
        const result = await getAvailableOcreQuests(guildId, targetUserId);
        if (result.success && result.data) {
            setAvailableQuests(result.data.sort((a, b) => b.quest_template.id - a.quest_template.id)); // Unity first? Or by date?
        } else {
            toast.error("Impossible de charger les quêtes");
            setShowSwitchDialog(false);
        }
        setQuestsLoading(false);
    };

    const handleSwitch = async (questSlug: string) => {
        setIsSwitching(true);
        const result = await switchOcreQuest(guildId, questSlug, targetUserId);
        if (result.success) {
            toast.success("Quête active mise à jour !");
            setShowSwitchDialog(false);
            // Refresh page to show new data? Client side navigation sufficient?
        } else {
            toast.error(result.error || "Impossible de changer de quête");
        }
        setIsSwitching(false);
    };

    return (
        <div className="p-4 bg-surface/40 backdrop-blur-md rounded-xl border border-border transition-all hover:border-border-strong group">
            <div className="flex items-center justify-between mb-4">
                <h3 className="text-base font-semibold text-foreground flex items-center gap-2">
                    <div className="relative w-4 h-4 opacity-80">
                        <Image src="/assets/icons/ocre.png" alt="Ocre" fill sizes="16px" className="object-contain" />
                    </div>
                    Registre Metamob
                </h3>
                {!readOnly && (
                    <div className="flex items-center gap-2">
                        {isLinked ? (
                            <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                    <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-warning hover:bg-warning/10 border border-transparent hover:border-warning/20">
                                        <Settings className="w-4 h-4" />
                                    </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end" className="w-56 bg-background border-border">
                                    <DropdownMenuLabel className="text-foreground font-bold uppercase tracking-widest text-caption">Mon compte Metamob</DropdownMenuLabel>
                                    <DropdownMenuSeparator className="bg-surface" />
                                    <DropdownMenuItem asChild>
                                        <a href={`https://www.metamob.fr/profile/${encodeURIComponent(currentPseudo)}`} target="_blank" rel="noopener noreferrer" className="cursor-pointer text-foreground">
                                            <ExternalLink className="h-4 w-4 mr-2" />
                                            Voir sur Metamob.fr
                                        </a>
                                    </DropdownMenuItem>
                                    <DropdownMenuSeparator className="bg-surface" />
                                    <DropdownMenuItem onClick={handleRefresh} disabled={isRefreshing} className="cursor-pointer text-foreground">
                                        <RefreshCw className={cn("h-4 w-4 mr-2", isRefreshing ? "animate-spin" : "")} />
                                        Forcer la synchro
                                    </DropdownMenuItem>
                                    <DropdownMenuItem onClick={handleOpenSwitch} className="cursor-pointer text-foreground">
                                        <ArrowRightLeft className="h-4 w-4 mr-2" />
                                        Changer de quête
                                    </DropdownMenuItem>
                                    {progressData && (
                                        <OcreSettingsModal
                                            data={progressData}
                                            guildId={guildId}
                                            trigger={
                                                <DropdownMenuItem 
                                                    onSelect={(e) => e.preventDefault()}
                                                    className="cursor-pointer text-foreground"
                                                >
                                                    <Settings className="h-4 w-4 mr-2" />
                                                    Réglages Expert
                                                </DropdownMenuItem>
                                            }
                                        />
                                    )}
                                    <DropdownMenuSeparator className="bg-surface" />
                                    <DropdownMenuItem onClick={() => setShowUnlinkDialog(true)} className="text-danger focus:text-danger focus:bg-danger/30 cursor-pointer">
                                        <Unlink className="h-4 w-4 mr-2" />
                                        Délier le compte
                                    </DropdownMenuItem>
                                </DropdownMenuContent>
                            </DropdownMenu>
                        ) : (
                            <Button 
                                variant="ghost" 
                                size="sm" 
                                className="h-8 px-3 text-xs font-bold text-muted-foreground hover:text-warning hover:bg-warning/10 border border-transparent hover:border-warning/20"
                                onClick={() => setShowLinkDialog(true)}
                            >
                                <Link2 className="w-3.5 h-3.5 mr-2" />
                                Lier mon compte
                            </Button>
                        )}
                    </div>
                )}
            </div>

            <div className="relative overflow-hidden rounded-xl border border-border bg-gradient-to-br from-surface to-elevated p-4 shadow-sm">
                <div className="relative flex items-center gap-4">
                    <div className="relative flex items-center justify-center w-14 h-14 rounded-xl bg-elevated border border-border shadow-md shrink-0">
                        <div className={cn("relative h-8 w-8 transition-all", !isLinked && "opacity-40 grayscale")}>
                            <Image src="/assets/icons/ocre.png" alt="Dofus Ocre" fill sizes="32px" className="object-contain drop-shadow-[0_0_8px_rgba(245,158,11,0.5)]" />
                        </div>
                        {isLinked && <div className="absolute -bottom-1 -right-1 bg-surface rounded-full border border-border p-0.5"><CheckCircle2 className="w-3.5 h-3.5 text-success" /></div>}
                    </div>
                    <div className="flex-1 space-y-1.5">
                        <div className="flex items-baseline gap-2">
                            <span className="text-xs font-bold text-muted-foreground uppercase tracking-widest shrink-0">Pseudo</span>
                            <span className="text-lg font-black text-warning italic tracking-tight">{isLinked ? currentPseudo : "Non relié"}</span>
                        </div>
                        <div className="flex items-baseline gap-2">
                            <span className="text-xs font-bold text-muted-foreground uppercase tracking-widest shrink-0">Statut</span>
                            {isLinked ? (
                                <span className="text-sm font-black text-foreground">{metamobLastSync ? `Synchronisé ${formatDistanceToNow(new Date(metamobLastSync), { addSuffix: true, locale: fr })}` : "En attente"}</span>
                            ) : (
                                <span className="text-caption font-bold text-muted-foreground uppercase italic">Liaison requise</span>
                            )}
                        </div>
                    </div>
                </div>
            </div>

            <Dialog open={showSwitchDialog} onOpenChange={setShowSwitchDialog}>
                <DialogContent className="max-w-md bg-background border-border">
                    <DialogHeader>
                        <DialogTitle className="text-foreground">Choisir la quête active</DialogTitle>
                        <DialogDescription className="text-muted-foreground">Sélectionnez la quête Ocre que vous souhaitez suivre sur SigilOS.</DialogDescription>
                    </DialogHeader>
                    <div className="space-y-3 py-2 max-h-[60vh] overflow-y-auto pr-2">
                        {questsLoading ? (
                            <div className="flex justify-center py-8"><Loader2 className="h-8 w-8 text-warning animate-spin" /></div>
                        ) : availableQuests.length === 0 ? (
                            <div className="text-center py-6 text-muted-foreground">Aucune quête Ocre trouvée.</div>
                        ) : (
                            availableQuests.map((quest) => (
                                <div key={quest.slug} onClick={() => handleSwitch(quest.slug)} className="flex items-center justify-between p-3 rounded-xl border border-border bg-surface hover:bg-surface cursor-pointer">
                                    <div className="flex flex-col gap-1">
                                        <div className="flex items-center gap-2">
                                            <span className="font-medium text-foreground">{quest.server.name}</span>
                                            <Badge variant="secondary" className="text-caption h-5 bg-black/20 border-border">{quest.quest_template.id === 1 ? "Unity" : "Rétro"}</Badge>
                                        </div>
                                        <div className="flex items-center gap-2 text-xs text-muted-foreground"><UserCircle className="h-3.5 w-3.5" /><span>{quest.character_name}</span></div>
                                    </div>
                                    <Badge className="bg-warning/10 text-warning border-warning/20">Étape {quest.current_step}</Badge>
                                </div>
                            ))
                        )}
                    </div>
                </DialogContent>
            </Dialog>

            <Dialog open={showUnlinkDialog} onOpenChange={setShowUnlinkDialog}>
                <DialogContent className="sm:max-w-md bg-background border-border">
                    <DialogHeader>
                        <DialogTitle className="text-foreground">Délier le compte Metamob ?</DialogTitle>
                        <DialogDescription className="text-muted-foreground">Vous ne pourrez plus accéder à la Quête Ocre via SigilOS.</DialogDescription>
                    </DialogHeader>
                    <DialogFooter>
                        <Button variant="ghost" onClick={() => setShowUnlinkDialog(false)} className="text-muted-foreground">Annuler</Button>
                        <Button variant="destructive" onClick={handleUnlink} disabled={isUnlinking}>{isUnlinking && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}Délier</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
 
            <Dialog open={showLinkDialog} onOpenChange={(open) => {
                setShowLinkDialog(open);
                if (!open) { setLinkError(null); setInputPseudo(""); setInputApiKey(""); setForceLink(false); setLinkStep(1); }
            }}>
                <DialogContent className="sm:max-w-2xl bg-background border-border shadow-2xl p-0 gap-0">
                    <DialogHeader className="p-8 border-b border-border">
                        <DialogTitle className="text-2xl font-black text-foreground flex items-center gap-3"><Link2 className="h-6 w-6 text-warning" />Lier votre compte Metamob</DialogTitle>
                    </DialogHeader>
                    <div className="p-8 space-y-6">
                        <div className="flex items-center gap-4">
                            <div className={cn("px-4 py-2 rounded-xl text-xs font-black uppercase", linkStep === 1 ? "bg-warning/20 text-warning" : "bg-success/20 text-success")}>1. Pseudo</div>
                            <div className="flex-1 h-0.5 bg-elevated" />
                            <div className={cn("px-4 py-2 rounded-xl text-xs font-black uppercase", linkStep === 2 ? "bg-warning/20 text-warning" : "bg-surface text-muted-foreground")}>2. Clé API</div>
                        </div>
                        {linkStep === 1 ? (
                            <div className="space-y-4">
                                <label className="text-sm font-bold text-foreground">Pseudo Metamob</label>
                                <Input placeholder="Ex: MonPseudo" value={inputPseudo} onChange={(e) => setInputPseudo(e.target.value)} className="h-12 bg-surface/50 border-border" />
                            </div>
                        ) : (
                            <div className="space-y-4">
                                <div className="flex items-center justify-between">
                                    <label className="text-sm font-bold text-foreground">Clé API V2</label>
                                    <a 
                                        href="https://www.metamob.fr/settings#api" 
                                        target="_blank" 
                                        rel="noopener noreferrer" 
                                        className="text-xs text-warning hover:text-warning font-semibold flex items-center gap-1 transition-colors"
                                    >
                                        Où trouver ma clé API ? <ExternalLink className="h-3 w-3" />
                                    </a>
                                </div>
                                <Input type="password" placeholder="64 caractères..." value={inputApiKey} onChange={(e) => setInputApiKey(e.target.value)} className="h-12 bg-surface/50 border-border" />
                                <p className="text-xs text-muted-foreground leading-relaxed">
                                    Votre clé API est requise pour synchroniser automatiquement vos archimonstres et vos quêtes. Elle est disponible dans l'onglet <strong>API</strong> des paramètres de votre compte Metamob.fr.
                                </p>
                            </div>
                        )}
                        {linkError && <div className="p-4 rounded-xl bg-danger/10 text-danger border border-danger/20 text-sm font-bold">{linkError}</div>}
                    </div>
                    <DialogFooter className="p-8 border-t border-border flex gap-3">
                        {linkStep === 1 ? (
                            <Button onClick={() => setLinkStep(2)} disabled={!inputPseudo.trim()} className="w-full bg-warning font-bold">Suivant</Button>
                        ) : (
                            <>
                                <Button variant="ghost" onClick={() => setLinkStep(1)}>Retour</Button>
                                <Button onClick={() => handleLink(false)} disabled={isLinking} className="bg-success font-bold">{isLinking ? <Loader2 className="animate-spin" /> : "Lier le compte"}</Button>
                            </>
                        )}
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}

function UserCircle({ className }: { className?: string }) {
    return (
        <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className={className}
        >
            <circle cx="12" cy="12" r="10" />
            <circle cx="12" cy="10" r="3" />
            <path d="M7 20.662V19a2 2 0 0 1 2-2h6a2 2 0 0 1 2 2v1.662" />
        </svg>
    );
}
