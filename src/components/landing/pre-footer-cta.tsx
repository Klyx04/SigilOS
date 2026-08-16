"use client";

import { useState } from "react";
import { AccessRequestModal } from "./AccessRequestModal";
import { loginWithDiscord } from "@/server/actions/auth-actions";

export function PreFooterCta() {
    const [showAccessModal, setShowAccessModal] = useState(false);

    return (
        <section className="w-full border-t border-border py-24">
            <div className="mx-auto max-w-[1100px] px-4 sm:px-6 lg:px-8">
                <div className="rounded-3xl border border-border bg-surface px-6 py-14 md:p-16 text-center">
                    <h2 className="text-2xl md:text-4xl font-bold tracking-tight text-foreground mb-4">
                        Prêt à réunir votre guilde au même endroit ?
                    </h2>
                    <p className="text-muted-foreground text-[15px] max-w-md mx-auto mb-8 leading-relaxed">
                        Commencez avec Discord. Configurez vos modules ensuite. Le reste se construit avec votre communauté.
                    </p>
                    <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
                        <button
                            onClick={() => setShowAccessModal(true)}
                            className="inline-flex items-center justify-center gap-2 h-12 px-6 rounded-xl bg-success hover:bg-success text-success-foreground font-bold text-sm transition-colors"
                        >
                            Créer l&apos;espace de ma guilde
                        </button>
                        <form action={loginWithDiscord}>
                            <button
                                type="submit"
                                className="h-12 px-6 rounded-xl border border-border hover:border-success/40 text-foreground font-semibold text-sm transition-colors"
                            >
                                Déjà membre ? Se connecter
                            </button>
                        </form>
                    </div>
                </div>
            </div>
            <AccessRequestModal open={showAccessModal} onClose={() => setShowAccessModal(false)} />
        </section>
    );
}
