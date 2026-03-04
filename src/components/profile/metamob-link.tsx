import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, ExternalLink, Loader2, RefreshCw, Unlink, Link2, Crown, ArrowRightLeft, ShieldCheck, AlertCircle, Settings, MoreVertical } from "lucide-react";
import { linkOcreAccount, unlinkOcreAccount, forceRefreshOcre, getAvailableOcreQuests, switchOcreQuest } from "@/server/actions/ocre-actions";
import { toast } from "sonner";
import Link from "next/link";
import { formatDistanceToNow } from "date-fns";
import { fr } from "date-fns/locale";
import { cn } from "@/lib/utils";
import type { UserQuest } from "@/lib/metamob-client";
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
}

export function MetamobLink({
    guildId,
    metamobPseudo,
    metamobVerified = false,
    metamobLastSync,
    readOnly = false,
    isAdmin = false,
    targetUserId,
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
            if (result.error === "MISSING_PSEUDO_DOFUS") {
                setLinkError("Configurez d'abord votre pseudo Dofus dans votre profil SigilOS.");
            } else {
                setLinkError(result.error || "Erreur lors de la liaison du compte");
            }
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
            // forceRefreshOcre was already called inside switchOcreQuest (revalidatePath)
            // But we might need to update UI if it depends on quest details not in this component.
            // This component only shows pseudo.
        } else {
            toast.error(result.error || "Impossible de changer de quête");
        }
        setIsSwitching(false);
    };

    return (
        <Card className="border-white/10 bg-black/20 backdrop-blur-md overflow-hidden relative group">
            <div className="absolute top-0 right-0 w-32 h-32 bg-amber-500/5 rounded-full blur-3xl pointer-events-none -mr-10 -mt-10" />

            <CardContent className="p-5 flex flex-col sm:flex-row gap-5 items-center justify-between">
                <div className="flex items-center gap-4">
                    <div className="relative">
                        <div className="w-12 h-12 rounded-xl bg-amber-500/10 flex items-center justify-center border border-amber-500/20 shadow-[0_0_15px_-5px_rgba(245,158,11,0.3)] shrink-0">
                            <Crown className="h-6 w-6 text-amber-500" />
                        </div>
                        {isLinked && (
                            <div className="absolute -bottom-1 -right-1 bg-zinc-950 rounded-full border border-zinc-900 p-0.5">
                                <CheckCircle2 className="w-4 h-4 text-emerald-500 fill-emerald-500/20" />
                            </div>
                        )}
                    </div>

                    <div>
                        <h3 className="text-base font-semibold text-zinc-200">Metamob</h3>
                        <div className="flex items-center gap-2 mt-0.5">
                            {isLinked ? (
                                <p className="text-sm text-zinc-400">
                                    Lié à <span className="text-zinc-200 font-medium">{currentPseudo}</span>
                                </p>
                            ) : (
                                <span className="text-xs text-zinc-500 italic">Non relié</span>
                            )}
                        </div>
                    </div>
                </div>

                {isLinked ? (
                    <div className="flex flex-1 flex-wrap gap-4 w-full items-center justify-between sm:justify-end">
                        {metamobLastSync && (
                            <div className="flex items-center gap-2 text-xs text-zinc-500 mr-auto sm:mr-0">
                                <span className="relative flex h-2 w-2">
                                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                                    <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                                </span>
                                <span>
                                    Synchro {formatDistanceToNow(new Date(metamobLastSync), { addSuffix: true, locale: fr })}
                                </span>
                            </div>
                        )}

                        <div className="flex items-center gap-2 w-full sm:w-auto">
                            <Button size="sm" asChild className="h-9 bg-amber-600 hover:bg-amber-700 text-white shadow-lg shadow-amber-900/20 border border-amber-500/20 flex-1 sm:flex-none">
                                <Link href={`/dashboard/${guildId}/quete-ocre`}>
                                    <Crown className="h-3.5 w-3.5 mr-2" />
                                    Avancement Ocre
                                </Link>
                            </Button>

                            <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                    <Button variant="outline" size="icon" className="h-9 w-9 bg-black/20 border-white/10 hover:bg-white/5 hover:border-white/20 text-zinc-400 hover:text-white">
                                        <Settings className="h-4 w-4" />
                                    </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end" className="w-56">
                                    <DropdownMenuLabel className="text-foreground font-bold">Mon compte Metamob</DropdownMenuLabel>
                                    <DropdownMenuSeparator className="bg-white/10" />

                                    <DropdownMenuItem asChild>
                                        <a
                                            href={`https://www.metamob.fr/profile/${encodeURIComponent(currentPseudo)}`}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="cursor-pointer"
                                        >
                                            <ExternalLink className="h-4 w-4 mr-2" />
                                            Voir sur Metamob.fr
                                        </a>
                                    </DropdownMenuItem>

                                    {!readOnly && (
                                        <>
                                            <DropdownMenuSeparator className="bg-white/10" />
                                            <DropdownMenuItem onClick={handleRefresh} disabled={isRefreshing} className="cursor-pointer">
                                                <RefreshCw className={cn("h-4 w-4 mr-2", isRefreshing ? "animate-spin" : "")} />
                                                Forcer la synchro
                                            </DropdownMenuItem>
                                            <DropdownMenuItem onClick={handleOpenSwitch} className="cursor-pointer">
                                                <ArrowRightLeft className="h-4 w-4 mr-2" />
                                                Changer de quête
                                            </DropdownMenuItem>
                                            <DropdownMenuSeparator className="bg-white/10" />
                                            <DropdownMenuItem onClick={() => setShowUnlinkDialog(true)} className="text-red-400 focus:text-red-400 focus:bg-red-950/30 cursor-pointer">
                                                <Unlink className="h-4 w-4 mr-2" />
                                                Délier le compte
                                            </DropdownMenuItem>
                                        </>
                                    )}
                                </DropdownMenuContent>
                            </DropdownMenu>

                            {/* Dialogs kept in DOM but triggered via state/menu */}
                            <Dialog open={showSwitchDialog} onOpenChange={setShowSwitchDialog}>
                                <DialogContent className="max-w-md">
                                    <DialogHeader>
                                        <DialogTitle>Choisir la quête active</DialogTitle>
                                        <DialogDescription>
                                            Sélectionnez la quête Ocre que vous souhaitez suivre sur SigilOS.
                                        </DialogDescription>
                                    </DialogHeader>

                                    <div className="space-y-3 py-2 max-h-[60vh] overflow-y-auto">
                                        {questsLoading ? (
                                            <div className="flex justify-center py-8">
                                                <Loader2 className="h-8 w-8 text-amber-500 animate-spin" />
                                            </div>
                                        ) : availableQuests.length === 0 ? (
                                            <div className="text-center py-6 text-muted-foreground">
                                                Aucune quête Ocre trouvée.
                                            </div>
                                        ) : (
                                            availableQuests.map((quest) => (
                                                <div
                                                    key={quest.slug}
                                                    onClick={() => handleSwitch(quest.slug)}
                                                    className="flex items-center justify-between p-3 rounded-xl border border-white/5 bg-white/5 hover:bg-white/10 hover:border-amber-500/30 cursor-pointer transition-all group"
                                                >
                                                    <div className="flex flex-col gap-1">
                                                        <div className="flex items-center gap-2">
                                                            <span className="font-medium text-zinc-200">{quest.server.name}</span>
                                                            <Badge variant="secondary" className="text-[10px] h-5 bg-black/20">
                                                                {quest.quest_template.id === 1 ? "Unity" : quest.quest_template.id === 2 ? "Rétro" : "Custom"}
                                                            </Badge>
                                                        </div>
                                                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                                            <UserCircle className="h-3.5 w-3.5" />
                                                            <span>{quest.character_name}</span>
                                                        </div>
                                                    </div>
                                                    <div className="flex flex-col items-end gap-1">
                                                        <Badge className={cn("bg-amber-500/10 text-amber-500 hover:bg-amber-500/20 border-amber-500/20")}>
                                                            Étape {quest.current_step}
                                                        </Badge>
                                                    </div>
                                                </div>
                                            ))
                                        )}
                                    </div>
                                </DialogContent>
                            </Dialog>

                            <Dialog open={showUnlinkDialog} onOpenChange={setShowUnlinkDialog}>
                                <DialogContent>
                                    <DialogHeader>
                                        <DialogTitle>Délier le compte Metamob ?</DialogTitle>
                                        <DialogDescription>
                                            Vous ne pourrez plus accéder à la Quête Ocre via SigilOS.
                                        </DialogDescription>
                                    </DialogHeader>
                                    <DialogFooter>
                                        <Button variant="ghost" onClick={() => setShowUnlinkDialog(false)}>
                                            Annuler
                                        </Button>
                                        <Button variant="destructive" onClick={handleUnlink} disabled={isUnlinking}>
                                            {isUnlinking && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                                            Délier
                                        </Button>
                                    </DialogFooter>
                                </DialogContent>
                            </Dialog>
                        </div>
                    </div>
                ) : (
                    !readOnly && (
                        <div className="flex flex-col gap-4 w-full sm:w-auto">
                            <Dialog open={showLinkDialog} onOpenChange={(open) => {
                                setShowLinkDialog(open);
                                if (!open) {
                                    setLinkError(null);
                                    setInputPseudo("");
                                    setInputApiKey("");
                                    setForceLink(false);
                                    setLinkStep(1);
                                }
                            }}>
                                <DialogTrigger asChild>
                                    <Button className="bg-amber-600 hover:bg-amber-700 text-white font-medium shadow-lg shadow-amber-900/20 w-full sm:w-auto">
                                        <Link2 className="h-4 w-4 mr-2" />
                                        Connecter Metamob
                                    </Button>
                                </DialogTrigger>
                                <DialogContent className="max-w-md">
                                    <DialogHeader>
                                        <DialogTitle>Lier votre compte Metamob</DialogTitle>
                                        <DialogDescription>
                                            {linkStep === 1
                                                ? "Entrez votre pseudo Metamob pour synchroniser votre quête Ocre."
                                                : "Optionnel : ajoutez votre clé API si votre profil est privé."}
                                        </DialogDescription>
                                    </DialogHeader>

                                    {/* Step indicator */}
                                    <div className="flex items-center gap-2 py-2">
                                        <div className={cn("flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded-full transition-all", linkStep === 1 ? "bg-amber-500/20 text-amber-400 border border-amber-500/30" : "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30")}>
                                            {linkStep === 1 ? "1" : <CheckCircle2 className="w-3 h-3" />}
                                            <span>Pseudo</span>
                                        </div>
                                        <div className="h-px flex-1 bg-white/10" />
                                        <div className={cn("flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded-full transition-all", linkStep === 2 ? "bg-amber-500/20 text-amber-400 border border-amber-500/30" : "bg-zinc-800 text-zinc-500 border border-white/5")}>
                                            2
                                            <span>Clé API</span>
                                        </div>
                                    </div>

                                    <div className="space-y-4 py-2">
                                        {linkStep === 1 ? (
                                            /* STEP 1: Pseudo */
                                            <div className="space-y-3">
                                                <div className="space-y-2">
                                                    <label htmlFor="metamob-pseudo" className="text-sm font-medium block">
                                                        Pseudo Metamob
                                                    </label>
                                                    <Input
                                                        id="metamob-pseudo"
                                                        placeholder="MonPseudo"
                                                        value={inputPseudo}
                                                        onChange={(e) => {
                                                            setInputPseudo(e.target.value);
                                                            setLinkError(null);
                                                            setForceLink(false);
                                                        }}
                                                        onKeyDown={(e) => {
                                                            if (e.key === "Enter" && inputPseudo.trim()) {
                                                                setLinkStep(2);
                                                            }
                                                        }}
                                                        className="bg-zinc-950 border-zinc-800"
                                                        autoFocus
                                                    />
                                                </div>
                                                {/* URL preview */}
                                                {inputPseudo.trim() && (
                                                    <div className="flex items-center gap-2 p-2 bg-zinc-900/50 rounded-lg border border-white/5 text-xs text-zinc-500">
                                                        <ExternalLink className="w-3 h-3 shrink-0" />
                                                        <span>metamob.fr/profile/<b className="text-amber-400">{inputPseudo.trim()}</b></span>
                                                    </div>
                                                )}
                                                <p className="text-[10px] text-zinc-500">
                                                    Pas de compte ? <a href="https://www.metamob.fr/register" target="_blank" className="text-amber-500 hover:underline">Créez-en un sur Metamob.fr</a>
                                                </p>
                                            </div>
                                        ) : (
                                            /* STEP 2: API Key (Optional) */
                                            <div className="space-y-3">
                                                <div className="p-2.5 bg-emerald-500/5 rounded-lg border border-emerald-500/10 text-xs text-emerald-400 flex items-center gap-2">
                                                    <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                                                    <span>Pseudo : <b>{inputPseudo}</b></span>
                                                    <Button variant="ghost" size="sm" className="h-5 ml-auto text-[10px] px-1.5 text-zinc-500 hover:text-white" onClick={() => setLinkStep(1)}>
                                                        Modifier
                                                    </Button>
                                                </div>

                                                <div className="space-y-2">
                                                    <div className="flex items-center justify-between">
                                                        <label htmlFor="metamob-key" className="text-sm font-medium flex items-center gap-1.5">
                                                            Clé API
                                                            <span className="text-[9px] font-normal text-zinc-500 bg-zinc-800 px-1.5 py-0.5 rounded-full">Optionnel</span>
                                                        </label>
                                                        <a
                                                            href="https://www.metamob.fr/settings#api"
                                                            target="_blank"
                                                            className="text-[10px] text-amber-500 hover:underline flex items-center gap-1"
                                                        >
                                                            Où la trouver ? <ExternalLink className="h-3 w-3" />
                                                        </a>
                                                    </div>
                                                    <Input
                                                        id="metamob-key"
                                                        type="password"
                                                        placeholder="Laissez vide si profil public"
                                                        value={inputApiKey}
                                                        onChange={(e) => setInputApiKey(e.target.value)}
                                                        className="bg-zinc-950 border-zinc-800"
                                                    />
                                                </div>

                                                <div className="p-2.5 bg-zinc-900/40 rounded-lg border border-white/5 text-[10px] text-zinc-500 space-y-1">
                                                    <p><b className="text-zinc-400">Profil public ?</b> Laissez ce champ vide, ça marchera directement.</p>
                                                    <p><b className="text-zinc-400">Profil privé ?</b> Collez votre clé API depuis les Paramètres Metamob.</p>
                                                </div>
                                            </div>
                                        )}

                                        {linkError && (
                                            <div className="space-y-3">
                                                <div className="flex items-start gap-2 p-3 rounded-lg bg-red-500/10 text-red-500 text-sm border border-red-500/20">
                                                    <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                                                    <div className="space-y-3 flex-1">
                                                        <span>{linkError}</span>
                                                        {linkError.includes("pseudo Dofus") && (
                                                            <Button
                                                                asChild
                                                                size="sm"
                                                                className="w-full bg-red-500 hover:bg-red-600 text-white font-bold"
                                                            >
                                                                <Link href={`/dashboard/${guildId}/profile?edit=identity`}>
                                                                    <Settings className="w-3.5 h-3.5 mr-2" />
                                                                    Configurer mon Pseudo
                                                                </Link>
                                                            </Button>
                                                        )}
                                                    </div>
                                                </div>

                                                {linkError.toLowerCase().includes("déjà lié") && !isAdmin && (
                                                    <div className="p-3 bg-blue-500/10 border border-blue-500/20 rounded-lg text-xs text-blue-400">
                                                        <p className="font-semibold mb-1 flex items-center gap-2">
                                                            <ShieldCheck className="h-3.5 w-3.5" />
                                                            Sécurité
                                                        </p>
                                                        <p className="opacity-90">
                                                            Ce compte Metamob semble déjà lié à un autre membre.
                                                            <br />Demandez à un <b>Admin</b> de débloquer la situation.
                                                        </p>
                                                    </div>
                                                )}

                                                {forceLink && isAdmin && (
                                                    <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-lg animate-in fade-in slide-in-from-top-2">
                                                        <h4 className="text-sm font-bold text-amber-500 mb-1 flex items-center gap-2">
                                                            <ShieldCheck className="h-4 w-4" />
                                                            Mode Admin
                                                        </h4>
                                                        <p className="text-xs text-zinc-400 mb-3">
                                                            Compte déjà utilisé. Forcer la liaison déconnectera l&apos;ancien propriétaire.
                                                        </p>
                                                        <Button
                                                            size="sm"
                                                            variant="destructive"
                                                            onClick={() => handleLink(true)}
                                                            disabled={isLinking}
                                                            className="w-full"
                                                        >
                                                            {isLinking && <Loader2 className="h-3.5 w-3.5 mr-2 animate-spin" />}
                                                            <Unlink className="h-3.5 w-3.5 mr-2" />
                                                            Forcer la liaison
                                                        </Button>
                                                    </div>
                                                )}
                                            </div>
                                        )}
                                    </div>

                                    <DialogFooter>
                                        {linkStep === 1 ? (
                                            <Button onClick={() => setLinkStep(2)} disabled={!inputPseudo.trim()}>
                                                Continuer
                                            </Button>
                                        ) : (
                                            <div className="flex gap-2 w-full">
                                                <Button variant="ghost" onClick={() => setLinkStep(1)} className="flex-1">
                                                    Retour
                                                </Button>
                                                {!forceLink && (
                                                    <Button onClick={() => handleLink(false)} disabled={isLinking || !inputPseudo.trim()} className="flex-1 bg-amber-600 hover:bg-amber-700 text-white">
                                                        {isLinking && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                                                        Vérifier & Lier
                                                    </Button>
                                                )}
                                            </div>
                                        )}
                                    </DialogFooter>
                                </DialogContent>
                            </Dialog>

                            {/* Helper Text for Unlinked State */}
                            <p className="text-[10px] text-zinc-500 text-right max-w-[200px]">
                                Liez votre compte pour accéder aux échanges d'archimonstres.
                            </p>
                        </div>
                    )
                )}
            </CardContent>
        </Card>
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
