import { getClass } from "@/lib/dofus-assets";
import { resolveDofusServerName } from "@/lib/presentation-constants";
import { loadPublicProfileView, requirePublicSession } from "@/server/public-account";
import { CreateProfileForm } from "../_components/create-profile-form";
import { IdentityForm } from "../_components/identity-form";
import { MetamobForm } from "../_components/metamob-form";
import { VisitorOcreCard } from "../_components/visitor-ocre-card";
import { VisitorFeedbackHistory } from "../_components/visitor-feedback-history";
import { getMyVisitorFeedbackAction } from "@/server/actions/feedback-actions";

export const metadata = {
    title: "Général — espace visiteur | SigilOS",
    description: "Ton serveur, ton pseudo, ta classe et ton nom de guilde déclaré.",
};

/** Onglet Général : la **seule** page qui accepte l'absence de profil (écran de création). */
export default async function GeneralPage() {
    const { userId } = await requirePublicSession();
    const profile = await loadPublicProfileView(userId);

    if (!profile) return <CreateProfileForm />;

    const className = profile.classe ? getClass(profile.classe)?.name ?? profile.classe : "Classe non renseignée";
    const serverName = resolveDofusServerName(null, String(profile.dofusServerId));
    const feedback = await getMyVisitorFeedbackAction();

    return (
        <div className="space-y-6">
            <header className="space-y-1">
                <h1 className="text-xl font-semibold text-foreground">Général</h1>
                <p className="text-sm text-muted-foreground">
                    {profile.pseudoDofus ?? "Pseudo non renseigné"} · {className} · {serverName}
                    {profile.declaredGuildName ? ` · Guilde déclarée : ${profile.declaredGuildName}` : ""}
                </p>
            </header>

            <IdentityForm
                serverId={profile.dofusServerId}
                pseudoDofus={profile.pseudoDofus}
                classe={profile.classe}
                declaredGuildName={profile.declaredGuildName}
            />

            {profile.hasMetamobApiKey ? (
                <div className="grid gap-4 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
                    <VisitorOcreCard />
                    <MetamobForm
                        metamobPseudo={profile.metamobPseudo}
                        hasKey={profile.hasMetamobApiKey}
                        verified={profile.metamobVerified}
                    />
                </div>
            ) : (
                <MetamobForm
                    metamobPseudo={profile.metamobPseudo}
                    hasKey={profile.hasMetamobApiKey}
                    verified={profile.metamobVerified}
                />
            )}

            <VisitorFeedbackHistory items={feedback.success ? feedback.data : []} />
        </div>
    );
}
