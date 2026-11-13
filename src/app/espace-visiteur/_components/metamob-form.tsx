"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
    AlertCircle,
    CheckCircle2,
    ExternalLink,
    KeyRound,
    RefreshCw,
    Settings,
    Unlink,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { metamobProfileUrl } from "@/lib/ocre-soul-stones";
import { cn } from "@/lib/utils";
import { PUBLIC_METAMOB_KEY_MAX, PUBLIC_METAMOB_PSEUDO_MAX } from "@/lib/public-profile-input";
import { updatePublicMetamob, verifyPublicMetamob } from "@/server/actions/public-profile-actions";
import { VisitorSection } from "./visitor-section";

type FormMode = "idle" | "form" | "unlink";

/**
 * Metamob : une **fiche liée** quand la clé existe (pseudo, état, vérifier / remplacer /
 * délier), le formulaire seulement pour lier ou remplacer. La clé est **écrite chiffrée**
 * par le hook Prisma et n'est jamais relue par l'écran — seule son existence est affichée.
 */
export function MetamobForm({
    metamobPseudo,
    hasKey,
    verified,
}: {
    metamobPseudo: string | null;
    hasKey: boolean;
    verified: boolean;
}) {
    const router = useRouter();
    const [mode, setMode] = useState<FormMode>("idle");
    const [pseudo, setPseudo] = useState(metamobPseudo ?? "");
    const [apiKey, setApiKey] = useState("");
    const [error, setError] = useState<string | null>(null);
    const [saving, setSaving] = useState(false);
    const [unlinking, setUnlinking] = useState(false);
    const [checking, setChecking] = useState(false);
    const [checkMessage, setCheckMessage] = useState<{ tone: "success" | "warning"; text: string } | null>(null);

    const resetForm = () => {
        setMode("idle");
        setApiKey("");
        setError(null);
        setCheckMessage(null);
    };

    const handleVerifyKey = async () => {
        setCheckMessage(null);
        setChecking(true);
        const result = await verifyPublicMetamob();
        setChecking(false);
        if (!result.success) {
            setCheckMessage({ tone: "warning", text: result.error });
            return;
        }
        setCheckMessage({
            tone: "success",
            text: result.pseudo ? `Clé reconnue par Metamob (${result.pseudo}).` : "Clé reconnue par Metamob.",
        });
        router.refresh();
    };

    const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        setError(null);
        setSaving(true);

        const result = await updatePublicMetamob({
            metamobPseudo: pseudo,
            ...(apiKey.trim().length > 0 ? { apiKey } : {}),
        });
        setSaving(false);

        if (!result.success) {
            setError(result.error);
            return;
        }

        setApiKey("");
        setMode("idle");
        toast.success("Informations Metamob enregistrées.");
        router.refresh();
    };

    const handleUnlink = async () => {
        setError(null);
        setUnlinking(true);
        const result = await updatePublicMetamob({ metamobPseudo: "", apiKey: "" });
        setUnlinking(false);

        if (!result.success) {
            setError(result.error);
            return;
        }

        setPseudo("");
        setApiKey("");
        setCheckMessage(null);
        setMode("idle");
        toast.success("Compte Metamob délié.");
        router.refresh();
    };


    if (hasKey && mode === "idle") {
        const profileUrl = metamobProfileUrl(metamobPseudo) ?? "https://www.metamob.fr";
        return (
            <section className="reg-panel p-4 sm:p-5" aria-label="Registre Metamob">
                <div className="flex items-center justify-between gap-3">
                    <h2 className="flex items-center gap-2 text-base font-semibold text-foreground">
                        <img
                            src="/assets/brands/metamob.png"
                            alt=""
                            className="size-4 shrink-0 object-contain"
                        />
                        Registre Metamob
                    </h2>
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button
                                type="button"
                                variant="ghost"
                                size="icon-sm"
                                aria-label="Actions Metamob"
                                disabled={checking || unlinking}
                            >
                                <Settings className="size-4" aria-hidden="true" />
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-56">
                            <DropdownMenuLabel>Mon compte Metamob</DropdownMenuLabel>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem asChild>
                                <a
                                    href={profileUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                >
                                    <ExternalLink className="mr-2 size-4" aria-hidden="true" />
                                    Voir sur Metamob.fr
                                </a>
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={handleVerifyKey} disabled={checking}>
                                <RefreshCw
                                    className={cn("mr-2 size-4", checking && "animate-spin")}
                                    aria-hidden="true"
                                />
                                Vérifier la clé
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => setMode("form")}>
                                <KeyRound className="mr-2 size-4" aria-hidden="true" />
                                Remplacer la clé
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                                onClick={() => setMode("unlink")}
                                className="text-danger focus:text-danger"
                            >
                                <Unlink className="mr-2 size-4" aria-hidden="true" />
                                Délier le compte
                            </DropdownMenuItem>
                        </DropdownMenuContent>
                    </DropdownMenu>
                </div>

                <div className="mt-4 flex items-center gap-3">
                    <img
                        src="/assets/brands/metamob.png"
                        alt=""
                        className="size-12 shrink-0 object-contain"
                    />
                    <div className="min-w-0">
                        <p className="text-xs text-muted-foreground">Pseudo</p>
                        <p className="truncate text-lg font-semibold text-foreground">
                            {metamobPseudo ?? "—"}
                        </p>
                        <p className="mt-0.5 flex items-center gap-1.5 text-xs text-muted-foreground">
                            {verified ? (
                                <CheckCircle2
                                    className="size-3.5 text-success"
                                    aria-hidden="true"
                                />
                            ) : (
                                <AlertCircle
                                    className="size-3.5 text-warning"
                                    aria-hidden="true"
                                />
                            )}
                            Statut{" "}
                            <span className="text-foreground">
                                {verified ? "Clé vérifiée" : "À vérifier"}
                            </span>
                        </p>
                    </div>
                </div>

                {checkMessage ? (
                    <p
                        className={
                            checkMessage.tone === "success"
                                ? "mt-3 text-xs text-success"
                                : "mt-3 text-xs text-warning"
                        }
                    >
                        {checkMessage.text}
                    </p>
                ) : null}
                {error ? (
                    <p role="alert" className="mt-3 text-sm text-danger">
                        {error}
                    </p>
                ) : null}
            </section>
        );
    }

    if (mode === "unlink") {
        return (
            <VisitorSection
                title="Metamob"
                description="Délier ton compte Metamob de ton profil visiteur."
            >
                <p className="text-sm text-foreground">
                    Ton pseudo et ta clé seront supprimés de ton profil visiteur. La vue
                    « Échanges » ne pourra plus lire ta quête Metamob.
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                    Tu pourras relier un compte à tout moment.
                </p>
                {error ? (
                    <p role="alert" className="mt-3 text-sm text-danger">
                        {error}
                    </p>
                ) : null}
                <div className="mt-4 flex flex-wrap items-center gap-2">
                    <Button
                        type="button"
                        variant="destructive"
                        size="sm"
                        onClick={handleUnlink}
                        disabled={unlinking}
                    >
                        {unlinking ? "Déliement…" : "Confirmer le déliement"}
                    </Button>
                    <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => {
                            setError(null);
                            setMode("idle");
                        }}
                        disabled={unlinking}
                    >
                        Annuler
                    </Button>
                </div>
            </VisitorSection>
        );
    }

    return (
        <VisitorSection
            title="Metamob"
            description={
                hasKey
                    ? "Remplace ta clé ou ton pseudo. Une clé refusée ne remplace jamais celle qui fonctionne."
                    : "Ton pseudo public et ta clé d'API. La clé reste côté serveur : elle n'est jamais renvoyée à l'écran."
            }
        >
            <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                    <Label htmlFor="metamob-pseudo">Pseudo Metamob</Label>
                    <Input
                        id="metamob-pseudo"
                        value={pseudo}
                        onChange={(event) => setPseudo(event.target.value)}
                        maxLength={PUBLIC_METAMOB_PSEUDO_MAX}
                        autoComplete="off"
                        disabled={saving}
                    />
                </div>

                <div className="space-y-2">
                    <div className="flex flex-wrap items-center gap-2">
                        <Label htmlFor="metamob-key">Clé d'API</Label>
                        <Badge variant={hasKey ? "secondary" : "outline"}>
                            {hasKey ? "Enregistrée" : "Aucune clé"}
                        </Badge>
                        {hasKey && verified ? <Badge variant="secondary">Vérifiée</Badge> : null}
                    </div>
                    <Input
                        id="metamob-key"
                        type="password"
                        value={apiKey}
                        onChange={(event) => setApiKey(event.target.value)}
                        maxLength={PUBLIC_METAMOB_KEY_MAX}
                        autoComplete="new-password"
                        placeholder={hasKey ? "Laisser vide pour conserver la clé actuelle" : "Colle ta clé Metamob"}
                        disabled={saving}
                    />
                    <p className="text-xs text-muted-foreground">
                        {hasKey
                            ? "Laisser vide conserve la clé existante. Une nouvelle clé devra être vérifiée."
                            : "Ta clé est vérifiée par Metamob avant d'être enregistrée."}{" "}
                        <a
                            href="https://www.metamob.fr/settings#api"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 font-medium text-foreground underline underline-offset-2"
                        >
                            Où trouver ma clé API ?
                            <ExternalLink className="h-3 w-3" aria-hidden="true" />
                        </a>
                    </p>
                </div>

                {!hasKey && metamobPseudo ? (
                    <p className="text-xs text-muted-foreground">
                        Pseudo enregistré. Ajoute ta clé pour activer la vue « Échanges ».
                    </p>
                ) : null}

                {error ? (
                    <p role="alert" className="text-sm text-danger">
                        {error}
                    </p>
                ) : null}

                <div className="flex flex-wrap items-center gap-2">
                    <Button type="submit" disabled={saving}>
                        {saving ? "Enregistrement…" : "Enregistrer Metamob"}
                    </Button>
                    {hasKey ? (
                        <Button type="button" variant="outline" onClick={resetForm} disabled={saving}>
                            Annuler
                        </Button>
                    ) : null}
                </div>
            </form>
        </VisitorSection>
    );
}
