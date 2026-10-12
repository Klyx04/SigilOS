import { MemberDirectory } from "@/components/directory/member-directory";
import { DEMO_GUILD, DEMO_LEGENDARY_ITEMS, DEMO_MEMBERS } from "@/lib/demo/source";
import { getServerI18n } from "@/lib/i18n/server";

/**
 * `/demo/annuaire` — l'**annuaire réel** du produit (`MemberDirectory`) en `readOnly` :
 * pas de lien vers `/dashboard/**`, donc aucun mur de connexion sur une page publique.
 */
export default async function DemoDirectoryPage() {
    const { t } = await getServerI18n();
    const d = t.demoPage;

    return (
        <section aria-labelledby="demo-annuaire-titre" className="reg-section">
            <div className="reg-shell">
                <p className="reg-eyebrow">{d.directoryEyebrow}</p>
                <h2
                    id="demo-annuaire-titre"
                    className="mt-3 max-w-[30ch] text-[clamp(1.5rem,2.6vw,2rem)] font-bold leading-[1.12] tracking-tight text-foreground"
                >
                    {d.directoryTitle}
                </h2>
                <p className="mt-3 max-w-[64ch] text-base leading-relaxed text-muted-foreground">
                    {d.directoryDesc}
                </p>

                <div className="mt-8">
                    <MemberDirectory
                        initialMembers={DEMO_MEMBERS}
                        legendaryItems={[...DEMO_LEGENDARY_ITEMS]}
                        guildId={DEMO_GUILD.id}
                        readOnly
                    />
                </div>
            </div>
        </section>
    );
}
