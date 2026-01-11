"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { AlertCircle, CheckCircle2, ExternalLink, Loader2, RefreshCw, Unlink, Link2, Bug } from "lucide-react";
import { linkMetamobAccount, unlinkMetamobAccount, refreshMyMetamobCache } from "@/server/actions/metamob-actions";
import { toast } from "sonner";
import Link from "next/link";
import { formatDistanceToNow } from "date-fns";
import { fr } from "date-fns/locale";

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
    const [isLinking, setIsLinking] = useState(false);
    const [isUnlinking, setIsUnlinking] = useState(false);
    const [isRefreshing, setIsRefreshing] = useState(false);
    const [showLinkDialog, setShowLinkDialog] = useState(false);
    const [showUnlinkDialog, setShowUnlinkDialog] = useState(false);
    const [linkError, setLinkError] = useState<string | null>(null);

    const handleLink = async () => {
        if (!inputPseudo.trim()) {
            setLinkError("Veuillez entrer un pseudo");
            return;
        }

        setIsLinking(true);
        setLinkError(null);

        const result = await linkMetamobAccount({ guildId, pseudo: inputPseudo.trim() });

        if (result.success && result.data) {
            setIsLinked(true);
            setCurrentPseudo(result.data.pseudo);
            setShowLinkDialog(false);
            setInputPseudo("");
            toast.success(`Compte Metamob "${result.data.pseudo}" lié avec succès !`);
        } else {
            setLinkError(result.error || "Erreur lors de la liaison");
        }

        setIsLinking(false);
    };

    const handleUnlink = async () => {
        setIsUnlinking(true);

        const result = await unlinkMetamobAccount({ guildId });

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

        const result = await refreshMyMetamobCache(guildId);

        if (result.success) {
            toast.success("Données Metamob actualisées");
        } else {
            toast.error(result.error || "Erreur lors du rafraîchissement");
        }

        setIsRefreshing(false);
    };

    return (
        <Card className="border-border/50 bg-card/50 backdrop-blur-sm">
            <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-base font-medium">
                    <Bug className="h-5 w-5 text-amber-500" />
                    Metamob
                    {isLinked && (
                        <Badge variant="outline" className="ml-auto bg-emerald-500/10 text-emerald-500 border-emerald-500/30">
                            <CheckCircle2 className="h-3 w-3 mr-1" />
                            Lié
                        </Badge>
                    )}
                </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
                {isLinked ? (
                    // =============== LINKED STATE ===============
                    <>
                        <div className="flex items-center justify-between">
                            <div className="space-y-1">
                                <p className="text-sm font-medium text-foreground">
                                    {currentPseudo}
                                </p>
                                {metamobLastSync && (
                                    <p className="text-xs text-muted-foreground">
                                        Synchro : {formatDistanceToNow(new Date(metamobLastSync), { addSuffix: true, locale: fr })}
                                    </p>
                                )}
                            </div>
                            <a
                                href={`https://www.metamob.fr/utilisateur/${encodeURIComponent(currentPseudo)}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-muted-foreground hover:text-primary transition-colors"
                            >
                                <ExternalLink className="h-4 w-4" />
                            </a>
                        </div>

                        <div className="flex gap-2">
                            <Link href={`/dashboard/${guildId}/archimonstres`} className="flex-1">
                                <Button variant="outline" size="sm" className="w-full gap-2">
                                    <Bug className="h-4 w-4" />
                                    Bourse aux Archis
                                </Button>
                            </Link>
                            <Button
                                variant="ghost"
                                size="sm"
                                onClick={handleRefresh}
                                disabled={isRefreshing}
                                className="px-3"
                            >
                                <RefreshCw className={`h-4 w-4 ${isRefreshing ? "animate-spin" : ""}`} />
                            </Button>
                        </div>

                        {!readOnly && (
                            <Dialog open={showUnlinkDialog} onOpenChange={setShowUnlinkDialog}>
                                <DialogTrigger asChild>
                                    <Button variant="ghost" size="sm" className="w-full text-muted-foreground hover:text-destructive">
                                        <Unlink className="h-4 w-4 mr-2" />
                                        Délier le compte
                                    </Button>
                                </DialogTrigger>
                                <DialogContent>
                                    <DialogHeader>
                                        <DialogTitle>Délier le compte Metamob ?</DialogTitle>
                                        <DialogDescription>
                                            Vous ne pourrez plus accéder à la Bourse aux Archimonstres tant que vous n&apos;aurez pas relié un compte.
                                        </DialogDescription>
                                    </DialogHeader>
                                    <DialogFooter>
                                        <Button variant="outline" onClick={() => setShowUnlinkDialog(false)}>
                                            Annuler
                                        </Button>
                                        <Button variant="destructive" onClick={handleUnlink} disabled={isUnlinking}>
                                            {isUnlinking && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                                            Délier
                                        </Button>
                                    </DialogFooter>
                                </DialogContent>
                            </Dialog>
                        )}
                    </>
                ) : (
                    // =============== NOT LINKED STATE ===============
                    <>
                        <p className="text-sm text-muted-foreground">
                            Liez votre compte Metamob pour accéder à la Bourse aux Archimonstres et trouver des partenaires d&apos;échange.
                        </p>

                        {!readOnly && (
                            <Dialog open={showLinkDialog} onOpenChange={(open) => {
                                setShowLinkDialog(open);
                                if (!open) {
                                    setLinkError(null);
                                    setInputPseudo("");
                                }
                            }}>
                                <DialogTrigger asChild>
                                    <Button className="w-full gap-2 bg-amber-500 hover:bg-amber-600 text-black">
                                        <Link2 className="h-4 w-4" />
                                        Lier mon compte Metamob
                                    </Button>
                                </DialogTrigger>
                                <DialogContent>
                                    <DialogHeader>
                                        <DialogTitle>Lier votre compte Metamob</DialogTitle>
                                        <DialogDescription>
                                            Entrez votre pseudo Metamob. Assurez-vous que votre profil est <strong>public</strong> sur{" "}
                                            <a href="https://www.metamob.fr" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
                                                metamob.fr
                                            </a>
                                        </DialogDescription>
                                    </DialogHeader>

                                    <div className="space-y-4 py-4">
                                        <div className="space-y-2">
                                            <label htmlFor="metamob-pseudo" className="text-sm font-medium">
                                                Pseudo Metamob
                                            </label>
                                            <Input
                                                id="metamob-pseudo"
                                                placeholder="Ex: MonPseudoMetamob"
                                                value={inputPseudo}
                                                onChange={(e) => {
                                                    setInputPseudo(e.target.value);
                                                    setLinkError(null);
                                                }}
                                                onKeyDown={(e) => e.key === "Enter" && handleLink()}
                                            />
                                        </div>

                                        {linkError && (
                                            <div className="flex items-start gap-2 p-3 rounded-lg bg-destructive/10 text-destructive text-sm">
                                                <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
                                                <span>{linkError}</span>
                                            </div>
                                        )}
                                    </div>

                                    <DialogFooter>
                                        <Button variant="outline" onClick={() => setShowLinkDialog(false)}>
                                            Annuler
                                        </Button>
                                        <Button onClick={handleLink} disabled={isLinking || !inputPseudo.trim()}>
                                            {isLinking && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                                            Vérifier & Lier
                                        </Button>
                                    </DialogFooter>
                                </DialogContent>
                            </Dialog>
                        )}
                    </>
                )}
            </CardContent>
        </Card>
    );
}
