import { Button } from "@/components/ui/button";
import Link from "next/link";
import { ShieldAlert } from "lucide-react";

/**
 * Refus d'accès **dans une page du dashboard** (les écrans de refus « plein cadre »
 * — lock / ban / archive / timeout — vivent dans `src/components/layout/access-denied.tsx`).
 *
 * Déslop : l'ancienne version posait un halo `bg-red-500/20 blur-3xl` derrière l'icône,
 * `text-red-500` en dur, `font-extrabold` + `text-4xl` et une animation d'entrée. Ici :
 * icône de statut nue, jetons de thème, `Button` primitif — rien à habiller.
 */
export default function AccessDenied() {
    return (
        <div className="flex min-h-[60vh] flex-col items-center justify-center gap-6 text-center">
            <ShieldAlert className="h-16 w-16 text-danger" aria-hidden="true" />

            <div className="space-y-2">
                <h1 className="font-serif text-display-xl font-bold tracking-tight text-foreground">
                    Accès restreint
                </h1>
                <p className="mx-auto max-w-lg text-body-sm text-muted-foreground">
                    Vous n'avez pas les permissions nécessaires pour accéder à cette fonctionnalité.
                    Contactez un administrateur si vous pensez qu'il s'agit d'une erreur.
                </p>
            </div>

            <div className="flex gap-4">
                <Button asChild>
                    <Link href="/dashboard">Retourner en lieu sûr</Link>
                </Button>
            </div>
        </div>
    );
}

