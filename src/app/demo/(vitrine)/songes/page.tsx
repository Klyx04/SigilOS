import { DemoRuns } from "../../_components/demo-runs";
import { getServerI18n } from "@/lib/i18n/server";

/**
 * `/demo/songes` — les Songes en **lecture seule** (lot S-2a).
 *
 * Vue de démo **dédiée** (`DemoRuns`) : le composant réel `RunCard` interroge la base au
 * montage, ce que la démo ne peut pas faire (aucune base, décision D1).
 */
export default async function DemoSongesPage() {
    const { t } = await getServerI18n();
    const d = t.demoPage;

    return (
        <section aria-labelledby="demo-songes-titre" className="reg-section">
            <div className="reg-shell">
                <p className="reg-eyebrow">{d.songesEyebrow}</p>
                <h2
                    id="demo-songes-titre"
                    className="mt-3 max-w-[30ch] text-[clamp(1.5rem,2.6vw,2rem)] font-bold leading-[1.12] tracking-tight text-foreground"
                >
                    {d.songesTitle}
                </h2>
                <p className="mt-3 max-w-[64ch] text-base leading-relaxed text-muted-foreground">
                    {d.songesDesc}
                </p>

                <div className="mt-8">
                    <DemoRuns />
                </div>
            </div>
        </section>
    );
}
