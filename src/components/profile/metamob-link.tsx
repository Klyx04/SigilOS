import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, ExternalLink, Loader2, RefreshCw, Unlink, Link2, Crown, ArrowRightLeft, ShieldCheck } from "lucide-react";
import { linkOcreAccount, unlinkOcreAccount, forceRefreshOcre, getAvailableOcreQuests, switchOcreQuest } from "@/server/actions/ocre-actions";
import { toast } from "sonner";
import Link from "next/link";
import { formatDistanceToNow } from "date-fns";
import { fr } from "date-fns/locale";
import { cn } from "@/lib/utils";
import type { UserQuest } from "@/lib/metamob-client";

interface MetamobLinkProps {
    guildId: string;
    metamobPseudo?: string | null;
    metamobVerified?: boolean;
    metamobLastSync?: Date | null;
    readOnly?: boolean;
}

export function MetamobLink({
    guildId,
    metamobPseudo,
    metamobVerified = false,
    metamobLastSync,
    readOnly = false,
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

    // Multi-Quest Support
    const [showSwitchDialog, setShowSwitchDialog] = useState(false);
    const [isSwitching, setIsSwitching] = useState(false);
    const [availableQuests, setAvailableQuests] = useState<UserQuest[]>([]);
    const [questsLoading, setQuestsLoading] = useState(false);

    const handleLink = async () => {
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
        });

        if (result.success && result.data) {
            setIsLinked(true);
            setCurrentPseudo(result.data.pseudo);
            setShowLinkDialog(false);
            setInputPseudo("");
            setInputApiKey("");
            const serverInfo = result.data.serverName ? ` (${result.data.serverName})` : "";
            toast.success(`Compte Metamob "${result.data.pseudo}" lié${serverInfo} !`);
        } else {
            setLinkError(result.error || "Erreur lors de la liaison du compte");
        }

        setIsLinking(false);
    };

    const handleUnlink = async () => {
        setIsUnlinking(true);

        const result = await unlinkOcreAccount({ guildId });

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

        const result = await forceRefreshOcre(guildId);

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
        const result = await getAvailableOcreQuests(guildId);
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
        const result = await switchOcreQuest(guildId, questSlug);
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
                    <div className="flex flex-1 flex-wrap gap-3 w-full items-center justify-end">
                        {metamobLastSync && (
                            <span className="text-xs text-zinc-500 whitespace-nowrap hidden lg:block text-right">
                                Màj {formatDistanceToNow(new Date(metamobLastSync), { addSuffix: true, locale: fr })}
                            </span>
                        )}

                        <div className="flex flex-wrap items-center gap-2 justify-end">
                            <Button variant="outline" size="sm" asChild className="h-9 border-white/10 bg-white/5 hover:bg-amber-500/10 hover:text-amber-400 hover:border-amber-500/20 text-zinc-300">
                                <a
                                    href={`https://www.metamob.fr/profile/${encodeURIComponent(currentPseudo)}`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                >
                                    <ExternalLink className="h-3.5 w-3.5 mr-2" />
                                    Voir Profil
                                </a>
                            </Button>

                            <Button size="sm" asChild className="h-9 bg-amber-600 hover:bg-amber-700 text-white shadow-lg shadow-amber-900/20 border border-amber-500/20">
                                <Link href={`/dashboard/${guildId}/quete-ocre`}>
                                    <Crown className="h-3.5 w-3.5 mr-2" />
                                    Quête Ocre
                                </Link>
                            </Button>
                        </div>

                        {!readOnly && (
                            <div className="flex gap-2 ml-1 border-l border-white/10 pl-3 shrink-0">
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={handleRefresh}
                                    disabled={isRefreshing}
                                    className="h-9 px-3 bg-white/5 border-white/10 hover:bg-emerald-500/10 hover:border-emerald-500/20 hover:text-emerald-400 text-zinc-400 transition-all font-medium flex items-center gap-2"
                                >
                                    <RefreshCw className={cn("h-3.5 w-3.5", isRefreshing ? "animate-spin" : "")} />
                                    <span className="hidden lg:inline">Synchro</span>
                                </Button>

                                <Dialog open={showSwitchDialog} onOpenChange={setShowSwitchDialog}>
                                    <DialogTrigger asChild>
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            onClick={handleOpenSwitch}
                                            className="h-9 px-3 bg-white/5 border-white/10 hover:bg-blue-500/10 hover:border-blue-500/20 hover:text-blue-400 text-zinc-400 transition-all font-medium flex items-center gap-2"
                                        >
                                            <ArrowRightLeft className="h-3.5 w-3.5" />
                                            <span className="hidden lg:inline">Changer</span>
                                        </Button>
                                    </DialogTrigger>
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
                                    <DialogTrigger asChild>
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            className="h-9 px-3 bg-white/5 border-red-500/10 hover:bg-red-500/10 hover:border-red-500/20 text-zinc-400 hover:text-red-400 transition-all font-medium flex items-center gap-2"
                                        >
                                            <Unlink className="h-3.5 w-3.5" />
                                            <span className="hidden lg:inline">Délier</span>
                                        </Button>
                                    </DialogTrigger>
                                    <DialogContent>
                                        <DialogHeader>
                                            <DialogTitle>Délier le compte Metamob ?</DialogTitle>
                                            <DialogDescription>
                                                Vous ne pourrez plus accéder à la Quête Ocre.
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
                        )}
                    </div>
                ) : (
                    !readOnly && (
                        <div className="flex justify-end w-full sm:w-auto">
                            <Dialog open={showLinkDialog} onOpenChange={(open) => {
                                setShowLinkDialog(open);
                                if (!open) {
                                    setLinkError(null);
                                    setInputPseudo("");
                                    setInputApiKey("");
                                }
                            }}>
                                <DialogTrigger asChild>
                                    <Button className="bg-amber-600 hover:bg-amber-700 text-white font-medium shadow-lg shadow-amber-900/20">
                                        <Link2 className="h-4 w-4 mr-2" />
                                        Connecter Metamob
                                    </Button>
                                </DialogTrigger>
                                <DialogContent>
                                    <DialogHeader>
                                        <DialogTitle>Lier votre compte Metamob</DialogTitle>
                                        <DialogDescription>
                                            Entrez votre pseudo Metamob. Nous chercherons automatiquement votre quête "L'éternelle moisson".
                                        </DialogDescription>
                                    </DialogHeader>

                                    <div className="space-y-4 py-4">
                                        <div className="space-y-4">
                                            <div className="space-y-2">
                                                <label htmlFor="metamob-pseudo" className="text-sm font-medium">
                                                    Pseudo Metamob
                                                </label>
                                                <Input
                                                    id="metamob-pseudo"
                                                    placeholder="Ex: MonPseudo"
                                                    value={inputPseudo}
                                                    onChange={(e) => {
                                                        setInputPseudo(e.target.value);
                                                        setLinkError(null);
                                                    }}
                                                    className="bg-zinc-900 border-zinc-800"
                                                />
                                                <p className="text-xs text-zinc-500">
                                                    Visible dans l'URL de votre profil Metamob.
                                                </p>
                                            </div>

                                            <div className="space-y-2">
                                                <div className="flex items-center justify-between">
                                                    <label htmlFor="metamob-key" className="text-sm font-medium">
                                                        Clé API (Optionnelle)
                                                    </label>
                                                    <a
                                                        href="https://www.metamob.fr/profile/settings"
                                                        target="_blank"
                                                        className="text-[10px] text-amber-500 hover:underline"
                                                    >
                                                        Où la trouver ?
                                                    </a>
                                                </div>
                                                <Input
                                                    id="metamob-key"
                                                    type="password"
                                                    placeholder="VOTRE_CLE_API"
                                                    value={inputApiKey}
                                                    onChange={(e) => setInputApiKey(e.target.value)}
                                                    className="bg-zinc-900 border-zinc-800"
                                                />
                                                <p className="text-[10px] text-zinc-500">
                                                    Recommandé pour les profils privés ou l'accès aux doublons.
                                                </p>
                                            </div>
                                        </div>


                                        {linkError && (
                                            <div className="flex items-start gap-2 p-3 rounded-lg bg-red-500/10 text-red-500 text-sm border border-red-500/20">
                                                <span>{linkError}</span>
                                            </div>
                                        )}
                                    </div>

                                    <DialogFooter>
                                        <Button variant="ghost" onClick={() => setShowLinkDialog(false)}>
                                            Annuler
                                        </Button>
                                        <Button onClick={() => handleLink()} disabled={isLinking || !inputPseudo.trim()}>
                                            {isLinking && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                                            Vérifier & Lier
                                        </Button>
                                    </DialogFooter>
                                </DialogContent>
                            </Dialog>
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
