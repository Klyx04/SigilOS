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
                                <DialogContent className="sm:max-w-2xl bg-zinc-950 border-white/10 shadow-2xl overflow-hidden p-0 gap-0">
                                    <div className="absolute top-0 left-0 w-64 h-64 bg-amber-500/5 rounded-full blur-[100px] pointer-events-none -ml-32 -mt-32" />
                                    
                                    <DialogHeader className="p-8 border-b border-white/5 relative z-10">
                                        <DialogTitle className="text-2xl font-black text-white flex items-center gap-3">
                                            <div className="p-2 rounded-lg bg-amber-500/20 text-amber-500 border border-amber-500/20">
                                                <Link2 className="h-6 w-6" />
                                            </div>
                                            Lier votre compte Metamob
                                        </DialogTitle>
                                        <DialogDescription className="text-base text-zinc-400 mt-2">
                                            {linkStep === 1
                                                ? "Entrez votre pseudo Metamob pour commencer la synchronisation."
                                                : "Votre clé API personnelle (V2) est indispensable pour accéder à vos données privées."}
                                        </DialogDescription>
                                    </DialogHeader>

                                    <div className="p-8 space-y-8 relative z-10">
                                        {/* Step indicator */}
                                        <div className="flex items-center gap-4">
                                            <div className={cn("flex items-center gap-2.5 text-xs font-black uppercase tracking-[0.2em] px-4 py-2 rounded-xl transition-all", linkStep === 1 ? "bg-amber-500/20 text-amber-400 border border-amber-500/30 shadow-[0_0_15px_-5px_rgba(245,158,11,0.5)]" : "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30")}>
                                                {linkStep === 1 ? <span className="w-5 h-5 rounded-full bg-amber-500 text-black flex items-center justify-center font-bold">1</span> : <CheckCircle2 className="w-5 h-5" />}
                                                <span>Pseudo</span>
                                            </div>
                                            <div className="h-0.5 flex-1 bg-gradient-to-r from-amber-500/20 to-zinc-800" />
                                            <div className={cn("flex items-center gap-2.5 text-xs font-black uppercase tracking-[0.2em] px-4 py-2 rounded-xl transition-all", linkStep === 2 ? "bg-amber-500/20 text-amber-400 border border-amber-500/30 shadow-[0_0_15px_-5px_rgba(245,158,11,0.5)]" : "bg-zinc-900 text-zinc-600 border border-white/5")}>
                                                <span className={cn("w-5 h-5 rounded-full flex items-center justify-center font-bold", linkStep === 2 ? "bg-amber-500 text-black" : "bg-zinc-800")}>2</span>
                                                <span>Clé API</span>
                                            </div>
                                        </div>

                                        <div className="space-y-6">
                                            {linkStep === 1 ? (
                                                /* STEP 1: Pseudo */
                                                <div className="space-y-5">
                                                    <div className="space-y-3">
                                                        <label htmlFor="metamob-pseudo" className="text-base font-bold text-zinc-200 block ml-1">
                                                            Pseudo Metamob
                                                        </label>
                                                        <Input
                                                            id="metamob-pseudo"
                                                            placeholder="Ex: MonPseudo"
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
                                                            className="h-14 bg-zinc-900/50 border-zinc-800 text-lg font-medium px-4 focus:ring-amber-500/20"
                                                            autoFocus
                                                        />
                                                    </div>
                                                    
                                                    {inputPseudo.trim() && (
                                                        <div className="flex items-center gap-3 p-4 bg-amber-500/5 rounded-2xl border border-amber-500/10 text-sm text-zinc-400">
                                                            <ExternalLink className="w-4 h-4 text-amber-500 shrink-0" />
                                                            <span>Votre profil : <b className="text-zinc-100 font-bold">metamob.fr/profile/{inputPseudo.trim()}</b></span>
                                                        </div>
                                                    )}
                                                    
                                                    <p className="text-xs text-zinc-500 ml-1">
                                                        Pas de compte ? <a href="https://www.metamob.fr/register" target="_blank" className="text-amber-500 font-bold hover:underline">Inscrivez-vous sur Metamob.fr</a>
                                                    </p>
                                                </div>
                                            ) : (
                                                /* STEP 2: API Key (Required) */
                                                <div className="space-y-6">
                                                    <div className="p-4 bg-emerald-500/5 rounded-2xl border border-emerald-500/10 flex items-center gap-4 group">
                                                        <div className="w-10 h-10 rounded-xl bg-emerald-500/20 flex items-center justify-center border border-emerald-500/20 shrink-0">
                                                            <CheckCircle2 className="w-6 h-6 text-emerald-400" />
                                                        </div>
                                                        <div className="flex flex-col">
                                                            <span className="text-[10px] font-black uppercase tracking-widest text-emerald-500/60 leading-none mb-1">Cible</span>
                                                            <span className="text-lg font-black text-white">{inputPseudo}</span>
                                                        </div>
                                                        <Button variant="ghost" size="sm" className="h-10 ml-auto px-4 bg-zinc-900/50 border border-white/5 text-zinc-400 hover:text-white" onClick={() => setLinkStep(1)}>
                                                            Modifier
                                                        </Button>
                                                    </div>

                                                    <div className="space-y-3">
                                                        <div className="flex items-center justify-between ml-1">
                                                            <label htmlFor="metamob-key" className="text-base font-bold text-zinc-200 flex items-center gap-2">
                                                                Clé API
                                                                <Badge variant="outline" className="text-[10px] border-red-500/30 text-red-400 bg-red-500/10 uppercase tracking-tighter h-5">Requis</Badge>
                                                            </label>
                                                            <a
                                                                href="https://www.metamob.fr/settings#api"
                                                                target="_blank"
                                                                className="text-xs text-amber-500 font-bold hover:underline flex items-center gap-1.5"
                                                            >
                                                                Récupérer ma clé <ExternalLink className="h-3.5 w-3.5" />
                                                            </a>
                                                        </div>
                                                        <Input
                                                            id="metamob-key"
                                                            type="password"
                                                            placeholder="Ex: 8a7f...d2c1 (64 caractères)"
                                                            value={inputApiKey}
                                                            onChange={(e) => setInputApiKey(e.target.value)}
                                                            className="h-14 bg-zinc-900/50 border-zinc-800 text-lg font-mono focus:ring-amber-500/20"
                                                        />
                                                    </div>

                                                    <div className="p-5 bg-zinc-900/80 rounded-2xl border border-white/5 space-y-3 shadow-inner">
                                                        <p className="text-sm font-black text-amber-500 flex items-center gap-2">
                                                            <Settings className="w-4 h-4" />
                                                            GUIDE D’INSTALLATION
                                                        </p>
                                                        <ul className="space-y-2.5">
                                                            <li className="flex items-start gap-3 text-xs text-zinc-400">
                                                                <span className="w-5 h-5 rounded-full bg-zinc-800 text-white flex items-center justify-center shrink-0 font-bold text-[10px]">1</span>
                                                                <span>Allez dans <a href="https://www.metamob.fr/settings#api" target="_blank" className="text-amber-500 font-bold hover:underline">Paramètres → API</a></span>
                                                            </li>
                                                            <li className="flex items-start gap-3 text-xs text-zinc-400">
                                                                <span className="w-5 h-5 rounded-full bg-zinc-800 text-white flex items-center justify-center shrink-0 font-bold text-[10px]">2</span>
                                                                <span>Copiez la <b>Clé API V2</b> (elle fait 64 caractères)</span>
                                                            </li>
                                                            <li className="flex items-start gap-3 text-xs text-zinc-400">
                                                                <span className="w-5 h-5 rounded-full bg-zinc-800 text-white flex items-center justify-center shrink-0 font-bold text-[10px]">3</span>
                                                                <span>Collez-la dans le champ ci-dessus pour finaliser</span>
                                                            </li>
                                                        </ul>
                                                    </div>
                                                </div>
                                            )}

                                            {linkError && (
                                                <div className="animate-in fade-in slide-in-from-top-4 duration-500">
                                                    <div className="flex items-start gap-4 p-5 rounded-2xl bg-red-500/10 text-red-400 border border-red-500/20 shadow-lg shadow-red-950/20">
                                                        <AlertCircle className="h-6 w-6 shrink-0 mt-0.5" />
                                                        <div className="space-y-4 flex-1">
                                                            <p className="text-base font-bold leading-tight">{linkError}</p>
                                                        </div>
                                                    </div>

                                                    {linkError.toLowerCase().includes("déjà lié") && !isAdmin && (
                                                        <div className="mt-4 p-5 bg-blue-500/10 border border-blue-500/20 rounded-2xl">
                                                            <p className="font-black text-sm text-blue-400 mb-2 flex items-center gap-2">
                                                                <ShieldCheck className="h-4 w-4" />
                                                                PROTECTION DE COMPTE
                                                            </p>
                                                            <p className="text-sm text-zinc-400 leading-relaxed">
                                                                Ce compte Metamob est déjà associé à un autre membre. 
                                                                Si vous avez changé de compte Discord, contactez un <b>Administrateur</b>.
                                                            </p>
                                                        </div>
                                                    )}

                                                    {forceLink && isAdmin && (
                                                        <div className="mt-4 p-5 bg-amber-500/10 border border-amber-500/20 rounded-2xl shadow-xl">
                                                            <h4 className="text-sm font-black text-amber-500 mb-2 flex items-center gap-2">
                                                                <ShieldCheck className="h-4 w-4" />
                                                                MODÉRATEUR : ACTION FORCÉE
                                                            </h4>
                                                            <p className="text-sm text-zinc-400 mb-4 leading-relaxed">
                                                                Vous pouvez écraser la liaison existante. L&apos;ancien utilisateur perdra son accès immédiat.
                                                            </p>
                                                            <Button
                                                                size="lg"
                                                                variant="destructive"
                                                                onClick={() => handleLink(true)}
                                                                disabled={isLinking}
                                                                className="w-full h-12 font-black uppercase tracking-widest text-[10px]"
                                                            >
                                                                {isLinking && <Loader2 className="h-4 w-4 mr-3 animate-spin" />}
                                                                Forcer le transfert de propriété
                                                            </Button>
                                                        </div>
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                    </div>

                                    <DialogFooter className="p-8 bg-zinc-900/30 border-t border-white/5 relative z-10 flex flex-col sm:flex-row gap-3">
                                        {linkStep === 1 ? (
                                            <Button 
                                                onClick={() => setLinkStep(2)} 
                                                disabled={!inputPseudo.trim()}
                                                className="w-full sm:w-auto px-10 h-12 bg-zinc-100 text-zinc-950 hover:bg-white font-black uppercase tracking-widest text-[10px]"
                                            >
                                                Étape suivante
                                                <ArrowRightLeft className="w-4 h-4 ml-3" />
                                            </Button>
                                        ) : (
                                            <div className="flex gap-3 w-full">
                                                <Button 
                                                    variant="ghost" 
                                                    onClick={() => setLinkStep(1)} 
                                                    className="flex-1 h-12 border border-white/5 hover:bg-white/5 text-zinc-400 font-bold"
                                                >
                                                    Retour
                                                </Button>
                                                {!forceLink && (
                                                    <Button 
                                                        onClick={() => handleLink(false)} 
                                                        disabled={isLinking || !inputPseudo.trim() || !inputApiKey.trim()} 
                                                        className="flex-[2] h-12 bg-amber-600 hover:bg-amber-500 text-white font-black uppercase tracking-widest text-[10px] shadow-xl shadow-amber-900/30"
                                                    >
                                                        {isLinking ? <Loader2 className="h-4 w-4 mr-3 animate-spin" /> : <ShieldCheck className="w-4 h-4 mr-3" />}
                                                        Vérifier & Lier le compte
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
