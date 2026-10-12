import { getPlatformConfig } from "@/server/actions/changelog-actions";

export const metadata = {
    // Le proxy réécrit TOUTES les URL vers /maintenance quand la maintenance est active,
    // en 200 : sans ce noindex, Google pourrait publier cette page à la place du contenu réel.
    title: "Maintenance en cours",
    description: "SigilOS est temporairement en maintenance. Nous revenons très vite.",
    robots: { index: false, follow: false },
};

export default async function MaintenancePage() {
    const { getServerI18n } = await import("@/lib/i18n/server");
    const { t } = await getServerI18n();
    const { config } = await getPlatformConfig();
    const message = config?.maintenanceMessage || t.maintenance.defaultMessage;

    return (
        <div className="registre min-h-screen bg-background text-foreground flex flex-col">
            <a className="reg-skip" href="#contenu">
                Aller au contenu
            </a>

            <header className="border-b border-border">
                <div className="reg-shell flex flex-wrap items-center justify-between gap-3 py-3.5">
                    <span className="inline-flex items-center gap-2.5 text-[1.0625rem] font-bold tracking-tight">
                        <img src="/assets/ui/logo-v2.png" alt="" width="28" height="28" className="w-7 h-7 object-contain" />
                        SigilOS
                    </span>
                    <p className="reg-mono flex items-center gap-2 text-xs text-muted-foreground">
                        <span className="w-1.5 h-1.5 rounded-full bg-warning" aria-hidden="true" />
                        {t.maintenance.title}
                    </p>
                </div>
            </header>

            <main id="contenu" className="flex-1 w-full">
                <section className="border-b border-border">
                    <div className="reg-shell grid gap-10 pt-12 pb-14 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:gap-14 lg:pt-16 lg:pb-20 lg:items-start">
                        <div>
                            <p className="reg-eyebrow">Maintenance · retour rapide</p>

                            <h1 className="mt-5 max-w-[13ch] text-[clamp(2rem,4.2vw,3.1rem)] font-bold leading-[1.06] tracking-tight text-foreground">
                                SigilOS est en maintenance.
                            </h1>

                            <p className="mt-5 max-w-[34rem] text-base text-muted-foreground leading-relaxed">
                                {t.maintenance.subtitle} — {message}
                            </p>

                            <div className="mt-6 pt-5 border-t border-border/60 space-y-2 text-xs text-muted-foreground">
                                <p className="font-mono text-[11px]">
                                    Aucune action requise · Réessayez dans quelques minutes
                                </p>
                            </div>
                        </div>

                        <div className="reg-panel p-0 overflow-hidden">
                            <table className="reg-table m-0">
                                <thead>
                                    <tr>
                                        <th scope="col">Service</th>
                                        <th scope="col">État</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    <tr>
                                        <td>SigilOS</td>
                                        <td>
                                            <span className="reg-tag">{t.maintenance.title}</span>
                                        </td>
                                    </tr>
                                    <tr>
                                        <td>Message de l’équipe</td>
                                        <td className="text-muted-foreground">{message}</td>
                                    </tr>
                                </tbody>
                            </table>
                        </div>
                    </div>
                </section>
            </main>

            <footer className="border-t border-border py-6 text-[0.8125rem] text-muted-foreground">
                <div className="reg-shell">
                    <p>© SigilOS 2026 · {t.maintenance.managedBy}</p>
                </div>
            </footer>
        </div>
    );
}
